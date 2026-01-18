# Dotfile Toggle

One-click value toggling for dot files (`.env`, `.flags`, `.config`).

## Features

- **Sidebar Panel** — View and toggle values from Explorer with filter controls
- **Status Bar** — Quick pick menu for all toggleable values
- **CodeLens & Hover** — Toggle directly in the editor
- **Gitignore Protection** — Warns when toggling untracked files

## Supported Values

| Cycles |
|--------|
| `true` ↔ `false`, `TRUE` ↔ `FALSE` |
| `yes` ↔ `no`, `YES` ↔ `NO` |
| `1` ↔ `0`, `on` ↔ `off`, `ON` ↔ `OFF` |
| `enabled` ↔ `disabled`, `ENABLED` ↔ `DISABLED` |
| `production` ↔ `development`, `prod` ↔ `dev` |

Quoted values preserved (`"true"` → `"false"`).

## Configuration

```json
{
  "dotfileToggle.filePatterns": ["**/.env*", "**/.flags", "**/.config"],
  "dotfileToggle.toggleValues": [
    ["true", "false"],
    ["dev", "staging", "prod"]
  ],
  "dotfileToggle.showOnlyToggleable": true,
  "dotfileToggle.showGitignoreWarning": true
}
```

## Installation

Search **"Dotfile Toggle"** in the VS Code Extensions marketplace.

## License

MIT
