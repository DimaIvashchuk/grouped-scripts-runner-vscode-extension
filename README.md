# Grouped Scripts Runner

A VS Code extension that allows you to run nested scripts from `package.json` files using hover actions. Perfect for organizing complex build pipelines, testing suites, and development workflows.

## Features

- **Hover-to-Run**: Hover over script names in `package.json` to see a run button
- **Nested Script Support**: Organize scripts in nested objects for better categorization
- **Progress Indication**: Visual feedback during script execution
- **Cancellable Execution**: Cancel running scripts if needed

## Usage

1. Add a `groupedScripts` field to your `package.json`:

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "groupedScripts": {
    "development": {
      "server": {
        "start": "nodemon server.js",
        "debug": "nodemon --inspect server.js"
      },
      "client": {
        "start": "react-scripts start",
        "build": "react-scripts build"
      }
    },
    "testing": {
      "unit": "jest",
      "e2e": "cypress run"
    },
    "utilities": {
      "format": "prettier --write .",
      "lint": "eslint . --fix"
    }
  }
}
```

2. Open your `package.json` file in VS Code
3. Hover over any script name (the final key with a string value)
4. Click the "▶️ Run Script" button that appears in the hover tooltip

## How It Works

The extension:
- Detects `package.json` files with a `groupedScripts` field
- Parses the nested object structure
- Provides hover tooltips for leaf nodes (actual script commands)
- Executes scripts directly in the workspace directory

## Requirements

- VS Code 1.104.0 or higher
- Node.js and npm/npx installed in your system

## Extension Settings

This extension doesn't contribute any VS Code settings currently.

## Known Issues

- The extension only works with `package.json` files named exactly "package.json"

**Enjoy!**
