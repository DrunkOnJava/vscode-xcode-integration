# Git Hooks

This directory contains specialized Git hooks for Xcode project management that help maintain project integrity through Git operations.

## Available Hooks

- **pre-commit**: Runs before a commit is finalized, ensuring Xcode project files are properly formatted
- **post-commit**: Executes after a commit, updating file references as needed
- **post-checkout**: Runs after checking out a branch or commit, restoring project state
- **post-merge**: Executes after a merge operation, handling file references
- **post-rebase**: Runs after a rebase, updating project state

## Installation

The hooks are installed automatically when you run the setup script:

```bash
./scripts/version_control/setup_git_hooks.sh
```

You can also install them via the VSCode command:
```
Xcode: Set Up Git Hooks
```

## Hook Behaviors

### pre-commit
- Validates Xcode project files (`.pbxproj`) for correct syntax
- Ensures proper formatting of project files
- Detects potential issues before they're committed
- Can be bypassed with `git commit --no-verify` if needed

### post-commit
- Updates file references after commit
- Logs changes to the transaction log
- Ensures consistent project state

### post-checkout
- Restores project state after checkout
- Updates file references to match the checked-out branch
- Regenerates necessary project files if needed

### post-merge
- Handles file references after merge
- Tries to resolve simple conflicts automatically
- For complex conflicts, suggests using the specialized merge tools

### post-rebase
- Updates project state after rebase
- Ensures consistent file references

## Configuration

Git hooks behavior can be configured through the VSCode settings:

```json
"vscode-xcode-integration.versionControl.autoRepairEnabled": true,
"vscode-xcode-integration.versionControl.stateTrackingEnabled": true,
"vscode-xcode-integration.versionControl.autoSetupGitHooks": true
```

## Disabling Hooks

If you need to temporarily disable the hooks:

```bash
# To disable all hooks
git config core.hooksPath /dev/null

# To restore hooks
git config core.hooksPath .git/hooks
```

## Integration

These hooks integrate with other components:
- The state management system for saving/restoring project state
- The specialized merge tools for conflict resolution
- The transaction-based error handling system
