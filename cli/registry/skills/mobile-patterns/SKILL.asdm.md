---
name: mobile-patterns
type: skill
description: "Mobile UI/UX patterns and best practices for React Native and Flutter development"
version: 1.0.0
tags: [mobile, react-native, flutter, ux, patterns, performance]
trigger: "When building mobile UI components, screens, or navigation flows in React Native or Flutter"

providers:
  opencode:
    location: skills/mobile-patterns/
  claude-code:
    location: skills/mobile-patterns/
  copilot:
    applyTo: "**/*.{tsx,jsx,dart}"
---

# Mobile Patterns Skill

## Mobile-First Mindset

Mobile UI is not a smaller desktop UI. Users interact with fingers, not cursors. Network is unreliable. Battery and CPU are constrained. Memory is limited. Every pattern in this skill accounts for these realities.

## Navigation Patterns

### Stack Navigation
Use for linear flows with a clear back destination: onboarding, checkout, detail views.
- Always provide an obvious back affordance
- Preserve scroll position when navigating back
- Deep link support: every screen should be reachable by URL/route

### Tab Navigation
Use for top-level sections of the application. 5 tabs maximum.
- Active tab must be visually distinct
- Preserve each tab's navigation stack when switching
- Badge tabs for unread counts or notifications

### Modal Navigation
Use for tasks that interrupt the primary flow: confirmation dialogs, pickers, quick actions.
- Modals must always have a dismiss gesture (swipe down or tap outside)
- Full-screen modals for multi-step flows; sheets for single-step

## List Performance

### React Native
```tsx
// Always use FlatList for dynamic lists
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemRow item={item} />}
  getItemLayout={(_, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={10}
/>
```

### Flutter
```dart
// Use ListView.builder for dynamic lists
ListView.builder(
  itemCount: items.length,
  itemBuilder: (context, index) {
    return ItemTile(item: items[index]);
  },
)
```

## Offline-First Pattern

1. **Optimistic updates**: Apply the change locally immediately; sync to server in background
2. **Conflict resolution**: Last-write-wins for simple fields; merge strategies for collaborative data
3. **Sync queue**: Persist pending mutations to local storage; retry on reconnect
4. **Connectivity awareness**: Show a subtle banner when offline; never block the UI

## Touch Interaction Standards

- Minimum touch target: 44×44 points (iOS) / 48×48dp (Android)
- Provide visual feedback for every tap: pressed state, loading state, success/error state
- Debounce rapid taps on destructive actions (delete, submit)
- Long press for secondary actions on list items; expose via context menu

## Platform Conventions

| Pattern | iOS | Android |
|---------|-----|---------|
| Back navigation | Swipe right, back button in nav bar | System back button / gesture |
| Destructive action | Red text, confirmation sheet | Snackbar with undo |
| Pull to refresh | `UIRefreshControl` pattern | `SwipeRefreshLayout` pattern |
| Loading state | Activity indicator centered | Circular progress indicator |

## Rules

- NEVER block the main thread — all I/O and heavy computation must be async
- ALWAYS handle the keyboard: inputs scroll into view, dismiss on tap-outside
- Test every screen with Dynamic Type (iOS) and Font Scale (Android) at maximum size
- Respect `prefers-reduced-motion` / `ANIMATOR_DURATION_SCALE = 0` in all animations
