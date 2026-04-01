# ASDM — Agent Skills Distribution Manager

## Especificação Técnica e Plano de Desenvolvimento

> **Versão:** 1.0.0  
> **Data:** 31 de Março de 2026  
> **Status:** RFC — Request for Comments

---

## Sumário Executivo

O ASDM é uma plataforma corporativa para gestão centralizada, distribuição segura e metrificação de agents, commands e skills para AI coding assistants. Opera sob o princípio **Write Once, Emit Many**: um único source-of-truth que emite configurações nativas para OpenCode (via OCX), Claude Code e GitHub Copilot.

O problema que resolve é a fragmentação atual onde cada provider exige formatos distintos, não existe governança sobre o que os devs recebem, e não há visibilidade sobre adoção ou integridade dos arquivos distribuídos.

---

## 1. Contexto e Motivação

### 1.1 Estado Atual

A empresa utiliza OpenCode como ferramenta principal de AI-assisted coding, com OCX (`kdcokenny/ocx`) para gestão de perfis. Existem três perfis ativos: `fullstack-engineer`, `data-analytics` e `mobile`. Adicionalmente, foi avaliado o `numman-ali/openskills` como solução de gestão de skills universal.

### 1.2 Problemas Identificados

**Fragmentação de formatos** — OpenCode usa `.opencode/` com agents, skills e `opencode.jsonc`. Claude Code usa `.claude/` com `CLAUDE.md` e skills em `.claude/skills/`. GitHub Copilot usa `.github/copilot-instructions.md`, `.github/agents/*.agent.md` e `AGENTS.md`. Manter três configurações é insustentável.

**Ausência de governança** — Qualquer desenvolvedor pode alterar arquivos de agents e skills localmente. Não há versionamento central, audit trail de mudanças, nem aprovação para modificações em instruções que afetam a qualidade do código gerado.

**Sem visibilidade operacional** — Não há como saber quais devs estão com perfis atualizados, quais skills são efetivamente usados, ou se alguém modificou um agent corporativo sem autorização.

**Distribuição manual** — Atualizar um agent exige comunicar a mudança, esperar que cada dev atualize manualmente, e torcer para que ninguém tenha problemas no processo.

### 1.3 Ecossistema Analisado

| Ferramenta | O que faz | Limitação para nosso caso |
|---|---|---|
| **OCX** (`kdcokenny/ocx`) | Gerencia perfis e componentes para OpenCode com SHA-256, registries isolados e modelo copy-and-own | Específico para OpenCode, não emite para outros providers |
| **OpenSkills** (`numman-ali/openskills`) | Instala skills universais via `AGENTS.md` para múltiplos agents (Claude Code, Cursor, Codex) | Foco em skills públicos, sem governança corporativa, sem verificação de integridade pós-install, sem métricas |
| **AGENTS.md** (spec) | Formato universal reconhecido por Copilot, Cursor, Windsurf, Gemini CLI e outros | Apenas instructions, não cobre agents com config de modelo, permissões ou MCP servers |

### 1.4 Decisão Arquitetural

Nenhuma ferramenta existente resolve o problema completo. O ASDM será construído como uma camada acima, consumindo conceitos do OCX (SHA-256, profiles, registries) e do OpenSkills (universalidade via AGENTS.md/SKILL.md), mas adicionando governança corporativa, emissão multi-provider e telemetria.

---

## 2. Requisitos

### 2.1 Requisitos Funcionais

| ID | Requisito | Prioridade |
|---|---|---|
| RF-01 | Sincronizar agents, skills e commands de um registry central para a máquina do dev | Must |
| RF-02 | Emitir arquivos no formato nativo de OpenCode, Claude Code e GitHub Copilot | Must |
| RF-03 | Suportar perfis com herança (base → especialização) | Must |
| RF-04 | Verificar integridade de arquivos locais via SHA-256 | Must |
| RF-05 | Detectar e reportar modificações não autorizadas (tampering) | Must |
| RF-06 | Bloquear commits com arquivos adulterados via git hooks | Should |
| RF-07 | Coletar métricas de sincronização, adoção e drift | Should |
| RF-08 | Permitir overlay local aditivo para customizações pessoais | Should |
| RF-09 | Suportar sync incremental (apenas arquivos alterados) | Should |
| RF-10 | Notificar devs quando nova versão está disponível | Could |
| RF-11 | Auto-sync ao executar git pull | Could |
| RF-12 | Suportar providers adicionais (Cursor, Windsurf, Aider) via plugin | Could |

### 2.2 Requisitos Não-Funcionais

| ID | Requisito | Meta |
|---|---|---|
| RNF-01 | Tempo de sync completo | < 5 segundos em conexão corporativa |
| RNF-02 | Tempo de sync incremental | < 1 segundo quando não há mudanças |
| RNF-03 | Tamanho do CLI (instalado) | < 5 MB |
| RNF-04 | Zero dependências nativas | Apenas Node.js ≥ 18 como pré-requisito |
| RNF-05 | Funcionar offline | `asdm verify` funciona sem rede |
| RNF-06 | Compatível com macOS, Linux e Windows | Todos os paths normalizados |
| RNF-07 | Telemetria opt-in com dados anonimizados | machine_id = hash truncado |

---

## 3. Arquitetura

### 3.1 Visão Geral dos Componentes

```
┌──────────────────────────────────────────────────────────────┐
│                     DEV MACHINES                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Dev A    │  │ Dev B    │  │ Dev N    │                   │
│  │ profile: │  │ profile: │  │ profile: │                   │
│  │ fullstack│  │ data     │  │ mobile   │                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                   │
│       └──────────────┼──────────────┘                        │
│                      │ npx asdm sync                         │
└──────────────────────┼───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    ASDM CLI                                  │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌───────────────┐   │
│  │ Syncer  │ │ Verifier │ │ Emitters  │ │ Telemetry     │   │
│  │         │ │          │ │           │ │ Client        │   │
│  │ - diff  │ │ - sha256 │ │ - opencode│ │               │   │
│  │ - fetch │ │ - lock   │ │ - claude  │ │ - beacons     │   │
│  │ - cache │ │ - hooks  │ │ - copilot │ │ - events      │   │
│  └─────────┘ └──────────┘ └───────────┘ └───────────────┘   │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                  ASDM REGISTRY API                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Manifest    │  │ Asset       │  │ Telemetry           │  │
│  │ Service     │  │ Service     │  │ Collector           │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         ▼                ▼                     ▼             │
│  ┌─────────────────────────────┐  ┌─────────────────────┐   │
│  │ Git Repo (Source of Truth)  │  │ Metrics Store       │   │
│  │ - profiles/                 │  │ (Postgres / SQLite  │   │
│  │ - agents/                   │  │  / Analytics SaaS)  │   │
│  │ - skills/                   │  │                     │   │
│  │ - commands/                 │  └─────────────────────┘   │
│  └─────────────────────────────┘                             │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Source Repo (Monorepo)

O source repo é o single source-of-truth. Toda mudança passa por PR com review obrigatório. O CI gera o manifest com checksums e faz deploy ao registry.

```
asdm-registry/
├── profiles/
│   ├── base/
│   │   └── profile.yaml           # Agents e skills comuns a todos
│   ├── fullstack-engineer/
│   │   └── profile.yaml           # Extends base
│   ├── data-analytics/
│   │   └── profile.yaml           # Extends base
│   └── mobile/
│       ├── profile.yaml           # Extends base
│       └── ios/
│           └── profile.yaml       # Extends mobile
│
├── agents/
│   ├── code-reviewer.asdm.md      # Formato canônico com frontmatter multi-provider
│   ├── tdd-guide.asdm.md
│   ├── architect.asdm.md
│   ├── data-pipeline.asdm.md
│   ├── sql-optimizer.asdm.md
│   ├── mobile-architect.asdm.md
│   └── security-scanner.asdm.md
│
├── skills/
│   ├── react-best-practices/
│   │   ├── SKILL.asdm.md          # Skill definition
│   │   └── examples/              # Arquivos auxiliares bundled
│   ├── api-design/
│   │   └── SKILL.asdm.md
│   ├── pandas/
│   │   └── SKILL.asdm.md
│   ├── sql/
│   │   └── SKILL.asdm.md
│   ├── react-native/
│   │   └── SKILL.asdm.md
│   └── swift-ui/
│       └── SKILL.asdm.md
│
├── commands/
│   ├── review.asdm.md             # Slash command definitions
│   ├── test.asdm.md
│   ├── deploy-preview.asdm.md
│   └── query.asdm.md
│
├── adapters/
│   ├── base.ts                    # Interface e helpers comuns
│   ├── opencode.ts                # Emit adapter para OpenCode/OCX
│   ├── claude-code.ts             # Emit adapter para Claude Code
│   └── copilot.ts                 # Emit adapter para GitHub Copilot
│
├── schemas/
│   ├── profile.schema.json        # JSON Schema para profile.yaml
│   ├── agent.schema.json          # JSON Schema para agents .asdm.md frontmatter
│   ├── skill.schema.json          # JSON Schema para skills .asdm.md frontmatter
│   ├── command.schema.json        # JSON Schema para commands .asdm.md frontmatter
│   └── manifest.schema.json       # JSON Schema para manifest.json gerado
│
├── scripts/
│   ├── build-manifest.ts          # Gera manifest.json com checksums
│   ├── validate.ts                # Valida todos os schemas
│   └── publish.ts                 # Publica no registry endpoint
│
├── .github/
│   └── workflows/
│       ├── validate.yml           # Roda em PRs: lint, schema validation, dry-run build
│       └── publish.yml            # Roda em merge to main: build manifest, deploy registry
│
├── manifest.json                  # Gerado automaticamente pelo CI (não editar)
├── asdm.config.ts                 # Configuração do build pipeline
├── package.json
├── tsconfig.json
└── README.md
```

### 3.3 Formato Canônico — Agents

Cada agent é um arquivo `.asdm.md` com frontmatter YAML contendo metadados e configurações por provider, seguido do corpo em Markdown que contém as instruções do agent.

```markdown
---
name: code-reviewer
type: agent
description: "Revisa PRs com foco em segurança, performance e clean code"
version: 1.3.0
tags: [review, security, quality]

providers:
  opencode:
    model: anthropic/claude-sonnet-4
    permissions:
      - read
      - write
    tools:
      - bash
      - glob

  claude-code:
    model: claude-sonnet-4-20250514
    allowedTools:
      - Read
      - Write
      - Bash

  copilot:
    on: pull_request
    safe-outputs:
      - "*.md"
      - "review-*.json"
    permissions:
      contents: read
      pull-requests: write
---

# Code Reviewer

Você é um code reviewer sênior com experiência em sistemas distribuídos,
segurança de aplicações e design patterns.

## Responsabilidades

- Revisar cada arquivo alterado no PR com atenção a vulnerabilidades
  OWASP Top 10
- Verificar se há testes adequados para lógica de negócio
- Avaliar performance de queries N+1, loops desnecessários e
  alocações excessivas
- Sugerir refactorings quando o código viola princípios SOLID

## Regras

- NUNCA aprove código sem tratamento de erro adequado
- SEMPRE verifique se secrets não estão hardcoded
- Priorize clareza sobre cleverness
- Quando sugerir mudanças, forneça o código corrigido, não apenas
  a descrição do problema

## Formato de Output

Para cada arquivo revisado, produza:

1. **Severidade**: CRITICAL / HIGH / MEDIUM / LOW / INFO
2. **Localização**: arquivo:linha
3. **Problema**: descrição objetiva
4. **Sugestão**: código corrigido ou recomendação
```

### 3.4 Formato Canônico — Skills

```markdown
---
name: react-best-practices
type: skill
description: "Padrões e best practices para projetos React da empresa"
version: 2.0.0
tags: [react, frontend, patterns]
trigger: "Quando o dev pedir ajuda com componentes React ou mencionar React"

providers:
  opencode:
    location: skills/react-best-practices/
  claude-code:
    location: skills/react-best-practices/
  copilot:
    applyTo: "**/*.tsx,**/*.jsx"
---

# React Best Practices

## Estrutura de Componentes

- Use functional components com hooks exclusivamente
- Prefira composição sobre herança
- Um componente por arquivo, nomeado igual ao arquivo
...
```

### 3.5 Formato Canônico — Commands

```markdown
---
name: review
type: command
description: "Inicia uma revisão de código no branch atual"
version: 1.1.0

providers:
  opencode:
    slash_command: /review
    agent: code-reviewer
  claude-code:
    slash_command: /review
    agent: code-reviewer
  copilot:
    slash_command: /review
    agent: code-reviewer
---

# /review

Executa uma revisão completa do diff atual contra a branch principal.

## Uso

```
/review                    # Revisa todo o diff
/review --files src/       # Revisa apenas arquivos em src/
/review --severity high    # Mostra apenas issues HIGH e CRITICAL
```

## Comportamento

1. Identifica a branch base (main ou master)
2. Obtém o diff completo
3. Delega ao agent code-reviewer
4. Produz relatório formatado com findings
```

### 3.6 Profile Schema

```yaml
# profiles/fullstack-engineer/profile.yaml
name: fullstack-engineer
description: "Perfil para desenvolvedores fullstack"
extends:
  - base

agents:
  - code-reviewer
  - tdd-guide
  - architect

skills:
  - react-best-practices
  - api-design
  - sql

commands:
  - review
  - test
  - deploy-preview

providers:
  - opencode
  - claude-code
  - copilot

# Configurações específicas por provider (opcionais, fazem merge)
provider_config:
  opencode:
    mcp_servers:
      - name: postgres
        command: npx
        args: ["-y", "@modelcontextprotocol/server-postgres"]
    theme: dark

  claude-code:
    permissions:
      allow:
        - "Read(**)"
        - "Write(src/**)"
        - "Bash(npm test)"
```

### 3.7 Manifest (Gerado pelo CI)

```json
{
  "$schema": "./schemas/manifest.schema.json",
  "version": "2.1.0",
  "built_at": "2026-03-31T12:00:00Z",
  "commit_sha": "a1b2c3d4e5f6",

  "profiles": {
    "base": {
      "extends": [],
      "agents": ["code-reviewer", "security-scanner"],
      "skills": ["conventional-commits"],
      "commands": ["review"]
    },
    "fullstack-engineer": {
      "extends": ["base"],
      "agents": ["tdd-guide", "architect"],
      "skills": ["react-best-practices", "api-design", "sql"],
      "commands": ["test", "deploy-preview"],
      "providers": ["opencode", "claude-code", "copilot"]
    }
  },

  "assets": {
    "agents/code-reviewer.asdm.md": {
      "sha256": "e3b0c44298fc1c149afbf4c8996fb924...",
      "size": 2847,
      "version": "1.3.0"
    },
    "skills/react-best-practices/SKILL.asdm.md": {
      "sha256": "d7a8fbb307d7809469ca9abcb0082e4f...",
      "size": 5123,
      "version": "2.0.0"
    }
  }
}
```

### 3.8 Registry API

O Registry é um serviço HTTP stateless que serve o manifest e os assets. Pode ser implementado como Cloudflare Worker, container Docker ou server Node.js convencional.

**Endpoints:**

| Método | Path | Descrição | Auth |
|---|---|---|---|
| `GET` | `/v1/manifest` | Retorna manifest completo com checksums | API Key |
| `GET` | `/v1/manifest/version` | Retorna apenas a versão atual (health check rápido) | API Key |
| `GET` | `/v1/profiles/:name` | Retorna definição resolvida de um perfil (com herança aplicada) | API Key |
| `GET` | `/v1/assets/*path` | Download de um asset com header `X-SHA256` | API Key |
| `POST` | `/v1/sync` | Recebe checksums locais, retorna lista de arquivos a atualizar | API Key |
| `POST` | `/v1/verify` | Valida integridade de um conjunto de checksums | API Key |
| `POST` | `/v1/telemetry` | Recebe beacon de métricas (fire-and-forget) | API Key |

**Request/Response — POST /v1/sync:**

```json
// Request
{
  "profile": "fullstack-engineer",
  "providers": ["opencode", "claude-code"],
  "current_version": "2.0.0",
  "local_checksums": {
    "agents/code-reviewer.asdm.md": "e3b0c442...",
    "skills/react-best-practices/SKILL.asdm.md": "d7a8fbb3..."
  }
}

// Response
{
  "manifest_version": "2.1.0",
  "action": "update",
  "updates": [
    {
      "path": "agents/code-reviewer.asdm.md",
      "sha256": "new_hash...",
      "size": 2900,
      "reason": "content_changed"
    }
  ],
  "additions": [
    {
      "path": "skills/sql/SKILL.asdm.md",
      "sha256": "another_hash...",
      "size": 3200,
      "reason": "added_to_profile"
    }
  ],
  "removals": []
}
```

### 3.9 Emit Adapters

Cada adapter implementa a interface `EmitAdapter` e é responsável por converter o formato canônico para o formato nativo do provider.

```typescript
// adapters/base.ts
interface EmitAdapter {
  name: string;
  
  /** Converte um agent .asdm.md para o formato do provider */
  emitAgent(parsed: ParsedAsset, targetDir: string): EmittedFile[];
  
  /** Converte uma skill .asdm.md para o formato do provider */
  emitSkill(parsed: ParsedAsset, targetDir: string): EmittedFile[];
  
  /** Converte um command .asdm.md para o formato do provider */
  emitCommand(parsed: ParsedAsset, targetDir: string): EmittedFile[];
  
  /** Gera/atualiza o arquivo de instructions raiz (AGENTS.md, CLAUDE.md, etc.) */
  emitRootInstructions(profile: ResolvedProfile, targetDir: string): EmittedFile[];
  
  /** Gera/atualiza a config do provider (opencode.jsonc, settings.json, etc.) */
  emitConfig(profile: ResolvedProfile, targetDir: string): EmittedFile[];
}

interface ParsedAsset {
  name: string;
  type: 'agent' | 'skill' | 'command';
  frontmatter: Record<string, any>;
  providerConfig: Record<string, any>;  // Seção específica do provider
  body: string;                         // Markdown body
  sourcePath: string;
  sha256: string;
}

interface EmittedFile {
  relativePath: string;   // Ex: ".opencode/agents/code-reviewer.md"
  content: string | Buffer;
  sha256: string;
  adapter: string;
  sourcePath: string;     // Asset canônico de origem
}
```

**Mapeamento de emissão por provider:**

| Asset Type | OpenCode | Claude Code | GitHub Copilot |
|---|---|---|---|
| Agent | `.opencode/agents/{name}.md` + entry em `opencode.jsonc` | `.claude/agents/{name}.md` | `.github/agents/{name}.agent.md` com frontmatter YAML |
| Skill | `.opencode/skills/{name}/SKILL.md` | `.claude/skills/{name}/SKILL.md` | Inline em `.github/instructions/{name}.instructions.md` |
| Command | `.opencode/commands/{name}.md` | `.claude/commands/{name}.md` | Não suportado nativamente (emitido como instruction) |
| Root instructions | `AGENTS.md` com `<available_skills>` | `CLAUDE.md` referenciando `AGENTS.md` | `.github/copilot-instructions.md` |
| Config | `.opencode/opencode.jsonc` | `.claude/settings.json` | N/A |

---

## 4. ASDM CLI — Especificação

### 4.1 Instalação e Setup

```bash
# Via npx (zero install, sempre atualizado)
npx asdm sync

# Ou instalação global
npm install -g @company/asdm

# Inicializar projeto
npx asdm init --profile fullstack-engineer
```

### 4.2 Comandos

```
asdm <command> [options]

Comandos principais:
  init          Inicializa .asdm.json no projeto atual
  sync          Sincroniza assets do registry para a máquina local
  verify        Verifica integridade dos arquivos managed
  status        Mostra diff entre local e registry

Comandos informativos:
  profiles      Lista perfis disponíveis no registry
  agents        Lista agents do perfil ativo
  skills        Lista skills do perfil ativo
  commands      Lista commands do perfil ativo
  version       Mostra versão da CLI e do manifest local

Comandos de manutenção:
  doctor        Diagnostica problemas de configuração
  clean         Remove todos os arquivos managed (para reinstalar)
  hooks         Instala/remove git hooks de verificação
```

**Opções do `sync`:**

```
asdm sync [options]

Opções:
  --profile <name>     Override do perfil (ignora .asdm.json)
  --provider <name>    Sincroniza apenas para um provider específico
  --force              Re-download de todos os assets (ignora cache)
  --dry-run            Mostra o que seria feito sem executar
  --no-emit            Baixa assets canônicos sem emitir para providers
  --no-telemetry       Desabilita beacon de telemetria para este sync
  --verbose            Output detalhado
```

### 4.3 Configuração — `.asdm.json`

```json
{
  "$schema": "https://asdm.internal.company.com/schemas/config.json",
  "registry": "https://asdm.internal.company.com",
  "profile": "fullstack-engineer",
  "providers": ["opencode", "claude-code", "copilot"],
  "auth": {
    "type": "api-key",
    "env_var": "ASDM_API_KEY"
  },
  "options": {
    "auto_verify": true,
    "telemetry": true,
    "sync_on_git_pull": false,
    "install_hooks": true
  }
}
```

### 4.4 Lockfile — `.asdm-lock.json`

Gerado automaticamente em cada sync. Serve para: detecção de drift, reprodutibilidade, verificação offline e audit trail.

```json
{
  "$schema": "https://asdm.internal.company.com/schemas/lock.json",
  "synced_at": "2026-03-31T14:22:00Z",
  "cli_version": "1.2.0",
  "manifest_version": "2.1.0",
  "manifest_commit": "a1b2c3d4e5f6",
  "profile": "fullstack-engineer",
  "resolved_profiles": ["base", "fullstack-engineer"],
  "files": {
    ".opencode/agents/code-reviewer.md": {
      "sha256": "a1b2c3d4...",
      "source": "agents/code-reviewer.asdm.md",
      "adapter": "opencode",
      "version": "1.3.0"
    },
    ".claude/agents/code-reviewer.md": {
      "sha256": "e5f6a7b8...",
      "source": "agents/code-reviewer.asdm.md",
      "adapter": "claude-code",
      "version": "1.3.0"
    },
    ".github/agents/code-reviewer.agent.md": {
      "sha256": "c9d0e1f2...",
      "source": "agents/code-reviewer.asdm.md",
      "adapter": "copilot",
      "version": "1.3.0"
    }
  }
}
```

### 4.5 Overlay Local — `.asdm-overlay.json`

Permite que devs adicionem skills ou agents pessoais sem conflitar com o managed set. Overlays são estritamente aditivos.

```json
{
  "additional_skills": [
    {
      "name": "my-custom-prompt",
      "source": "local",
      "path": "./my-skills/custom-prompt/SKILL.md"
    },
    {
      "name": "community-skill",
      "source": "github",
      "repo": "VoltAgent/awesome-agent-skills",
      "path": "skills/some-skill"
    }
  ],
  "additional_agents": [],
  "provider_overrides": {
    "opencode": {
      "mcp_servers": [
        {
          "name": "my-local-db",
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-sqlite", "./dev.db"]
        }
      ]
    }
  }
}
```

---

## 5. Segurança e Integridade

### 5.1 Modelo de Ameaças

| Ameaça | Impacto | Mitigação |
|---|---|---|
| Dev modifica agent para remover guardrails de segurança | Alto — código gerado sem revisão de segurança | SHA-256 verify + git hook + drift reporting |
| Supply chain — asset malicioso no registry | Crítico — instruções maliciosas distribuídas a todos | PR review obrigatório + CI validation + checksums no manifest |
| Man-in-the-middle no sync | Alto — assets substituídos em trânsito | HTTPS + verificação de SHA-256 pós-download |
| Dev bypassa git hooks | Médio — commit sem verificação | Telemetria de drift + CI check no pipeline |
| API key vazada | Médio — acesso não autorizado ao registry | Rotação automática + scoped keys + audit log |

### 5.2 Cadeia de Integridade

```
Source Repo (PR reviewed)
    │
    ▼ CI: build-manifest.ts
Manifest com SHA-256 de cada asset canônico
    │
    ▼ CI: publish.ts → Registry
Registry serve assets com header X-SHA256
    │
    ▼ CLI: sync → download + verify
Assets canônicos verificados na máquina do dev
    │
    ▼ CLI: emit adapters
Arquivos emitidos com SHA-256 registrados no lockfile
    │
    ▼ CLI: verify (pre-commit hook)
Verificação contínua contra lockfile
```

### 5.3 Git Hooks

```bash
# Instalação
npx asdm hooks --install

# O que instala:
# .husky/pre-commit (ou .git/hooks/pre-commit):
npx asdm verify --strict --quiet

# Exit codes:
#   0 — Todos os arquivos managed estão íntegros
#   1 — Arquivos modificados (lista quais no stderr)
#   2 — Lockfile ausente (precisa rodar asdm sync)
#   3 — Versão desatualizada (nova versão disponível no registry)
```

### 5.4 Permissões do Registry

| Role | Sync | Verify | Ver métricas próprias | Ver métricas do time | Publicar versões | Criar perfis |
|---|---|---|---|---|---|---|
| Developer | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Tech Lead | ✅ | ✅ | ✅ | ✅ | ❌ (propõe via PR) | ❌ |
| Platform Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 6. Metrificação

### 6.1 Beacon de Telemetria

Enviado pela CLI no final de cada `sync` e opcionalmente em `verify`. É fire-and-forget — falha no envio não bloqueia a operação.

```json
{
  "event": "sync_complete",
  "timestamp": "2026-03-31T14:22:00Z",
  "machine_id": "sha256(hostname+username)[0:12]",
  "cli_version": "1.2.0",
  "profile": "fullstack-engineer",
  "manifest_version": "2.1.0",
  "providers": ["opencode", "claude-code"],
  "stats": {
    "files_synced": 24,
    "files_unchanged": 18,
    "files_updated": 4,
    "files_added": 2,
    "sync_duration_ms": 1230
  },
  "integrity": {
    "status": "ok",
    "violations": [],
    "drift_files": []
  }
}
```

### 6.2 Eventos Rastreados

| Evento | Quando | Dados |
|---|---|---|
| `sync_complete` | Após sync bem-sucedido | Profile, version, providers, contagem de arquivos, duração |
| `sync_failed` | Após sync com erro | Tipo de erro, profile, version tentada |
| `verify_pass` | `asdm verify` sem violações | Profile, version, contagem de arquivos |
| `verify_fail` | `asdm verify` com violações | Lista de arquivos violados, tipo de violação |
| `version_outdated` | Sync detecta nova versão | Versão atual vs. versão disponível |
| `profile_changed` | Dev troca de perfil | Perfil anterior, perfil novo |

### 6.3 Dashboards

**Dashboard de Adoção:**
- Total de devs sincronizados na última versão (% e absoluto)
- Breakdown por perfil (fullstack, data, mobile)
- Breakdown por provider
- Tempo médio para atualização após nova release

**Dashboard de Compliance:**
- Devs com drift ativo (arquivos modificados)
- Histórico de violações de integridade por time
- Devs com versões desatualizadas (> 7 dias)
- Taxa de adoção de git hooks

**Dashboard de Operações:**
- Latência média de sync por região
- Taxa de erro de sync
- Tamanho total dos assets distribuídos
- Frequência de releases

---

## 7. Plano de Desenvolvimento

### Fase 1 — Foundation (Semanas 1–4)

**Objetivo:** CLI funcional que sincroniza profiles do registry para OpenCode.

**Entregas:**
- Source repo scaffolding com estrutura de diretórios
- JSON Schemas para todos os formatos (profile, agent, skill, command, manifest)
- Script `build-manifest.ts` que gera manifest.json com SHA-256
- GitHub Actions workflow para validação de PRs
- GitHub Actions workflow para build + publish do manifest
- Registry API mínima (GET manifest, GET assets, POST sync)
- CLI: comandos `init`, `sync`, `verify`, `status`, `profiles`
- Adapter OpenCode funcional (agents + skills + commands + config)
- Lockfile generation e verificação

**Critérios de aceite:**
- `npx asdm init --profile fullstack-engineer` cria `.asdm.json`
- `npx asdm sync` baixa assets e emite para `.opencode/`
- `npx asdm verify` detecta arquivo modificado manualmente
- CI bloqueia PR com schema inválido
- CI publica manifest ao fazer merge em main

**Tech stack:**
- CLI: TypeScript, tsx, commander.js
- Registry: Cloudflare Worker ou Node.js + Express
- CI: GitHub Actions
- Schemas: JSON Schema Draft 2020-12

---

### Fase 2 — Multi-Provider (Semanas 5–7)

**Objetivo:** Emitir para Claude Code e GitHub Copilot além de OpenCode.

**Entregas:**
- Adapter Claude Code (agents → `.claude/agents/`, skills → `.claude/skills/`, CLAUDE.md)
- Adapter GitHub Copilot (agents → `.github/agents/*.agent.md`, instructions, copilot-instructions.md)
- Formato canônico `.asdm.md` com frontmatter multi-provider
- Profile inheritance com deep merge
- CLI: flag `--provider` para sync seletivo
- Testes de integração com cada provider

**Critérios de aceite:**
- `npx asdm sync` emite para os 3 providers simultaneamente
- Cada provider recebe arquivos no formato nativo correto
- OpenCode, Claude Code e Copilot conseguem ler os arquivos sem erro
- Herança de perfis funciona (base + especialização)

---

### Fase 3 — Integrity & Governance (Semanas 8–9)

**Objetivo:** Garantir que arquivos managed não sejam adulterados.

**Entregas:**
- Comando `asdm hooks --install` para git hooks
- Pre-commit hook que roda `asdm verify --strict`
- Exit codes semânticos (0=ok, 1=modified, 2=no-lock, 3=outdated)
- Overlay system (`.asdm-overlay.json`)
- Separação clara entre managed files e overlay files no lockfile
- `.gitignore` templates para arquivos managed vs. overlay
- Documentação de políticas de integridade

**Critérios de aceite:**
- Commit é bloqueado se arquivo managed foi modificado
- Dev consegue adicionar skill pessoal via overlay sem conflito
- `asdm doctor` diagnostica problemas de setup

---

### Fase 4 — Metrics & Observability (Semanas 10–12)

**Objetivo:** Visibilidade completa de adoção, compliance e operações.

**Entregas:**
- Endpoint `POST /v1/telemetry` no registry
- Beacon client na CLI (fire-and-forget, opt-in)
- Schema de eventos de telemetria
- Metrics store (Postgres ou serviço de analytics)
- Dashboard de adoção
- Dashboard de compliance
- Dashboard operacional
- Alertas para drift prolongado (> N dias)

**Critérios de aceite:**
- Após sync, beacon é enviado com dados corretos
- Dashboard mostra % de devs na última versão
- Dashboard mostra devs com violações de integridade
- Alertas disparam para drift > 7 dias

---

### Fase 5 — Polish & DX (Semanas 13–14)

**Objetivo:** Experiência de desenvolvedor polida e documentação completa.

**Entregas:**
- `sync_on_git_pull` (post-merge hook opcional)
- Notificação no terminal quando nova versão disponível
- `asdm clean` para reset completo
- `asdm doctor` com diagnósticos detalhados
- Documentação de onboarding para devs
- Documentação de administração para platform team
- Runbook de operações do registry
- Guia de criação de novos agents/skills
- Template para PR de novos assets

**Critérios de aceite:**
- Dev novo consegue fazer onboarding em < 5 minutos seguindo docs
- Platform admin consegue publicar nova versão em < 10 minutos
- `asdm doctor` identifica e sugere fix para 100% dos problemas comuns

---

## 8. Decisões Técnicas

### 8.1 Por que não usar OCX diretamente?

O OCX é excelente para OpenCode, mas é específico para esse provider. Ele não emite para Claude Code ou Copilot. O modelo copy-and-own do OCX é ideal para flexibilidade individual, mas conflita com governança corporativa onde queremos garantir que todos usem a mesma versão dos agents.

O ASDM pode coexistir com o OCX — inclusive, o adapter OpenCode pode gerar estrutura compatível com OCX para que devs que já usam OCX não precisem mudar seu workflow.

### 8.2 Por que não usar OpenSkills diretamente?

O OpenSkills resolve o problema de universalidade de skills via `AGENTS.md`, mas não oferece: verificação de integridade pós-instalação, governança sobre quem pode publicar, perfis corporativos com herança, telemetria de adoção, ou suporte a agents e commands (apenas skills).

O ASDM se inspira no modelo universal do OpenSkills para skills, mas expande para agents e commands, e adiciona toda a camada de governance.

### 8.3 Formato canônico vs. formato nativo

A decisão de manter um formato canônico (`.asdm.md`) ao invés de manter N formatos nativos foi tomada para: evitar drift entre providers quando um asset é atualizado, garantir single source-of-truth, e permitir adicionar novos providers sem duplicar assets.

O trade-off é a complexidade dos adapters, mas essa complexidade é isolada e testável.

### 8.4 Registry como serviço vs. Git-only

Consideramos servir assets diretamente do Git (via raw URLs ou GitHub Releases), mas um serviço de registry permite: sync incremental (POST /v1/sync com diff), coleta de telemetria, controle de acesso granular, e caching de assets compilados.

Para equipes menores, o registry pode ser um Cloudflare Worker com assets em R2 — custo próximo de zero.

### 8.5 Telemetria opt-in vs. mandatória

A telemetria é configurada como opt-in por respeito ao dev, mas recomendamos que a empresa habilite via configuração corporativa no `.asdm.json` distribuído pelo onboarding. O `machine_id` é um hash truncado que não identifica o dev individualmente — apenas permite contar máquinas únicas e detectar drift.

---

## 9. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Baixa adoção pelos devs | Média | Alto | UX extremamente simples (`npx asdm sync`), onboarding automatizado, valor claro desde a Fase 1 |
| Adapters quebram com atualização do provider | Média | Médio | Testes de integração por provider, versionamento de adapters, CI que testa contra providers reais |
| Registry indisponível bloqueia devs | Baixa | Alto | Cache local persistente, `asdm verify` funciona offline, failover para asset estático |
| Resistência ao modelo managed (vs. copy-and-own) | Média | Médio | Overlay system para customizações, comunicação clara do valor de governança |
| Conflito com OCX existente | Baixa | Baixo | Adapter OpenCode gera estrutura compatível, coexistência documentada |

---

## 10. Métricas de Sucesso

| Métrica | Meta (3 meses) | Meta (6 meses) |
|---|---|---|
| Devs com sync ativo (semanal) | 70% | 90% |
| Tempo médio de adoção de nova versão | < 48h | < 24h |
| Taxa de integridade (sem drift) | 80% | 95% |
| Providers ativos por dev (média) | 1.5 | 2.0 |
| Tempo de onboarding de dev novo | < 10 min | < 5 min |
| Uptime do registry | 99.5% | 99.9% |

---

## 11. Glossário

| Termo | Definição |
|---|---|
| **Agent** | Personalidade de AI com instruções, modelo e permissões definidos |
| **Skill** | Conjunto de instruções estáticas que ensinam o AI a completar uma tarefa específica (formato SKILL.md) |
| **Command** | Slash command que o dev invoca para acionar um agent ou workflow |
| **Profile** | Conjunto nomeado de agents, skills e commands para um papel específico |
| **Manifest** | Arquivo JSON com metadados e checksums de todos os assets de uma versão |
| **Lockfile** | Arquivo local que registra checksums de todos os arquivos emitidos |
| **Adapter** | Módulo que converte formato canônico ASDM para formato nativo de um provider |
| **Provider** | Ferramenta de AI coding (OpenCode, Claude Code, GitHub Copilot) |
| **Overlay** | Customizações pessoais do dev que são aditivas ao perfil managed |
| **Drift** | Divergência entre o estado local e o esperado pelo lockfile |
| **Beacon** | Pacote leve de telemetria enviado pela CLI ao registry |
| **Tampering** | Modificação não autorizada de um arquivo managed |

---

## Aprovações

| Papel | Nome | Data | Status |
|---|---|---|---|
| Platform Lead | | | Pendente |
| Engineering Manager | | | Pendente |
| Security | | | Pendente |
| Dev Experience Lead | | | Pendente |

---

*Documento gerado em 31 de Março de 2026. Versão 1.0.0.*
