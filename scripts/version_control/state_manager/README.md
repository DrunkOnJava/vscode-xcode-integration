# Project State Manager

This directory contains scripts for managing the state of Xcode projects, enabling snapshots, rollbacks, and state recovery.

## Components

- **state_saver.sh**: Creates named snapshots of project state
- **state_restorer.sh**: Restores projects to previously saved states
- **state_tracker.sh**: Tracks and manages project state history

## Features

### State Saving
Create named states that can be easily restored later:

```bash
# Save current state with a name
./scripts/version_control/state_manager/state_saver.sh save "Before refactoring" "Major refactoring of login flow"
```

### State Restoration
Restore the project to a previously saved state:

```bash
# Restore to a named state
./scripts/version_control/state_manager/state_restorer.sh restore "Before refactoring"

# List available states
./scripts/version_control/state_manager/state_restorer.sh list
```

### State Tracking
Monitor and manage project states:

```bash
# View state history
./scripts/version_control/state_manager/state_tracker.sh history

# Clean up old states
./scripts/version_control/state_manager/state_tracker.sh cleanup --older-than 30d
```

## Integration

The state management system integrates with:
- Git operations through hooks (automatic state saving)
- The VSCode extension's commands for saving/restoring states
- The transaction-based error handling system

## Usage from VSCode

States can be managed directly from VSCode:

1. Save a state:
   - Run command: `Xcode: Save Project State`
   - Enter a name and description

2. Restore a state:
   - Run command: `Xcode: Restore Project State`
   - Select from available states

3. View history:
   - Run command: `Xcode: Show Project State History`

## Configuration

State management can be configured through the VSCode settings:

```json
"vscode-xcode-integration.versionControl.stateTrackingEnabled": true,
"vscode-xcode-integration.versionControl.notifyOnStateChange": true,
"vscode-xcode-integration.versionControl.maxStateHistory": 10
```

## Storage

States are stored in the `.vscode-xcode-integration/states` directory with:
- Metadata in JSON format
- File backups in compressed format
- A full history log
