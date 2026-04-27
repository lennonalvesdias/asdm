import type { WorkItem, WorkItemFilter, Sprint } from "../types";

export class AzureBoardsClient {
  private organizationUrl: string;
  private projectName: string;
  private accessToken: string;

  constructor(organizationUrl: string, projectName: string, accessToken: string) {
    this.organizationUrl = organizationUrl.replace(/\/$/, "");
    this.projectName = projectName;
    this.accessToken = accessToken;
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private get apiBase() {
    return `${this.organizationUrl}/${this.projectName}/_apis`;
  }

  async getMyWorkItems(filter: WorkItemFilter = {}): Promise<WorkItem[]> {
    const wiql = this.buildWiql(filter);
    const queryUrl = `${this.apiBase}/wit/wiql?api-version=7.1`;

    const queryRes = await fetch(queryUrl, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ query: wiql }),
    });

    if (!queryRes.ok) {
      throw new Error(`Azure Boards WIQL query failed: ${queryRes.status}`);
    }

    const queryData = (await queryRes.json()) as { workItems: { id: number }[] };
    const ids = queryData.workItems.map((wi) => wi.id).slice(0, 50);

    if (ids.length === 0) return [];

    const fieldsUrl = `${this.apiBase}/wit/workitems?ids=${ids.join(",")}&$expand=all&api-version=7.1`;
    const itemsRes = await fetch(fieldsUrl, { headers: this.headers });

    if (!itemsRes.ok) {
      throw new Error(`Azure Boards work items fetch failed: ${itemsRes.status}`);
    }

    const itemsData = (await itemsRes.json()) as { value: AzureWorkItemRaw[] };
    return itemsData.value.map(mapAzureWorkItem);
  }

  async updateWorkItemStatus(id: string, newStatus: string): Promise<void> {
    const url = `${this.organizationUrl}/${this.projectName}/_apis/wit/workitems/${id}?api-version=7.1`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        ...this.headers,
        "Content-Type": "application/json-patch+json",
      },
      body: JSON.stringify([
        {
          op: "replace",
          path: "/fields/System.State",
          value: newStatus,
        },
      ]),
    });

    if (!res.ok) {
      throw new Error(`Failed to update work item status: ${res.status}`);
    }
  }

  async getSprints(): Promise<Sprint[]> {
    const url = `${this.apiBase}/work/teamsettings/iterations?api-version=7.1`;
    const res = await fetch(url, { headers: this.headers });

    if (!res.ok) {
      throw new Error(`Failed to fetch sprints: ${res.status}`);
    }

    const data = (await res.json()) as { value: AzureIterationRaw[] };
    return data.value.map(mapAzureSprint);
  }

  async addComment(workItemId: string, text: string): Promise<void> {
    const url = `${this.organizationUrl}/${this.projectName}/_apis/wit/workItems/${workItemId}/comments?api-version=7.1-preview.3`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      throw new Error(`Failed to add comment: ${res.status}`);
    }
  }

  private buildWiql(filter: WorkItemFilter): string {
    const conditions: string[] = [
      "[System.AssignedTo] = @Me",
    ];

    if (filter.status && filter.status.length > 0) {
      const statuses = filter.status.map((s) => `'${cockpitStatusToAzure(s)}'`).join(", ");
      conditions.push(`[System.State] IN (${statuses})`);
    }

    if (filter.searchQuery) {
      conditions.push(`[System.Title] CONTAINS '${filter.searchQuery}'`);
    }

    return `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType] FROM WorkItems WHERE ${conditions.join(" AND ")} ORDER BY [System.ChangedDate] DESC`;
  }
}

// ----- Mapping helpers -----

type AzureWorkItemRaw = {
  id: number;
  url: string;
  fields: Record<string, unknown>;
};

type AzureIterationRaw = {
  id: string;
  name: string;
  path: string;
  attributes?: {
    startDate?: string;
    finishDate?: string;
    timeFrame?: string;
  };
};

function azureStatusToCockpit(state: string): WorkItem["status"] {
  const map: Record<string, WorkItem["status"]> = {
    "New": "backlog",
    "Active": "active",
    "In Progress": "active",
    "Resolved": "testing",
    "Closed": "done",
    "Removed": "done",
    "Code Review": "code-review",
    "Testing": "testing",
    "Blocked": "blocked",
  };
  return map[state] ?? "backlog";
}

function cockpitStatusToAzure(status: WorkItem["status"]): string {
  const map: Record<WorkItem["status"], string> = {
    backlog: "New",
    active: "Active",
    "code-review": "Code Review",
    testing: "Testing",
    done: "Closed",
    blocked: "Blocked",
  };
  return map[status];
}

function azureTypeToCockpit(type: string): WorkItem["type"] {
  const map: Record<string, WorkItem["type"]> = {
    "User Story": "user-story",
    "Bug": "bug",
    "Task": "task",
    "Epic": "epic",
    "Feature": "feature",
    "Impediment": "impediment",
  };
  return map[type] ?? "task";
}

function mapAzureWorkItem(raw: AzureWorkItemRaw): WorkItem {
  const f = raw.fields;

  return {
    id: String(raw.id),
    title: (f["System.Title"] as string) ?? "",
    description: (f["System.Description"] as string) ?? undefined,
    status: azureStatusToCockpit((f["System.State"] as string) ?? "New"),
    type: azureTypeToCockpit((f["System.WorkItemType"] as string) ?? "Task"),
    priority: "medium",
    assignee: f["System.AssignedTo"]
      ? {
          id: ((f["System.AssignedTo"] as Record<string, string>).uniqueName) ?? "",
          displayName: ((f["System.AssignedTo"] as Record<string, string>).displayName) ?? "",
          email: ((f["System.AssignedTo"] as Record<string, string>).uniqueName) ?? "",
          avatarUrl: ((f["System.AssignedTo"] as Record<string, string>).imageUrl) ?? undefined,
        }
      : undefined,
    tags: ((f["System.Tags"] as string) ?? "")
      .split(";")
      .map((t) => t.trim())
      .filter(Boolean),
    createdAt: (f["System.CreatedDate"] as string) ?? new Date().toISOString(),
    updatedAt: (f["System.ChangedDate"] as string) ?? new Date().toISOString(),
    storyPoints: (f["Microsoft.VSTS.Scheduling.StoryPoints"] as number) ?? undefined,
    remainingHours: (f["Microsoft.VSTS.Scheduling.RemainingWork"] as number) ?? undefined,
    availableTransitions: [],
    providerMetadata: {
      provider: "azure-boards",
      rawId: raw.id,
      url: raw.url,
      raw: f,
    },
  };
}

function mapAzureSprint(raw: AzureIterationRaw): Sprint {
  const timeFrame = raw.attributes?.timeFrame ?? "future";
  return {
    id: raw.id,
    name: raw.name,
    path: raw.path,
    startDate: raw.attributes?.startDate ?? "",
    finishDate: raw.attributes?.finishDate ?? "",
    status:
      timeFrame === "current"
        ? "current"
        : timeFrame === "past"
        ? "past"
        : "future",
  };
}
