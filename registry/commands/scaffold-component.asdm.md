---
name: scaffold-component
type: command
description: "Scaffolds a new UI component with boilerplate, types, and test file"
version: 1.0.0

providers:
  opencode:
    slash_command: /scaffold-component
    agent: architect
  claude-code:
    slash_command: /scaffold-component
    agent: architect
  copilot:
    slash_command: /scaffold-component
    agent: architect
---

# /scaffold-component

Generates a new UI component with all required boilerplate: component file, TypeScript props interface, CSS module (or styled component), and a test file with basic render assertions.

## Usage

```
/scaffold-component <name>
/scaffold-component Button
/scaffold-component UserCard --dir src/components/users
/scaffold-component DataTable --framework flutter
```

## Options

- `<name>` — Required. PascalCase component name (e.g., `UserCard`, `PaymentForm`)
- `--dir <path>` — Output directory (default: `src/components/<name>`)
- `--framework <name>` — Target framework: `react` (default), `react-native`, `flutter`
- `--no-tests` — Skip test file generation
- `--no-styles` — Skip style file generation
- `--story` — Also generate a Storybook story file

## Generated Files (React)

For `/scaffold-component UserCard --dir src/components/users`:

```
src/components/users/UserCard/
├── UserCard.tsx         # Component implementation
├── UserCard.module.css  # CSS module
├── UserCard.test.tsx    # Vitest/Jest test file
└── index.ts             # Re-export barrel
```

### Component Template

```tsx
import styles from './UserCard.module.css'

export interface UserCardProps {
  // TODO: define props
}

export function UserCard(props: UserCardProps) {
  return (
    <div className={styles.container}>
      {/* TODO: implement */}
    </div>
  )
}
```

### Test Template

```tsx
import { render, screen } from '@testing-library/react'
import { UserCard } from './UserCard'

describe('UserCard', () => {
  it('renders without crashing', () => {
    render(<UserCard />)
    // TODO: add meaningful assertions
  })
})
```

## Notes

- Component names are validated as PascalCase before generation
- If the target directory already exists, the command fails with an error — no accidental overwrites
- For React Native, generates a `StyleSheet.create` style block instead of a CSS module
