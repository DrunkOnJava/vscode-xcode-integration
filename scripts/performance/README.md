# Performance Optimization

This directory contains scripts for optimizing the performance of the VSCode-Xcode Integration extension, particularly for large projects.

## Components

- **performance.sh**: Main entry point for performance-related operations
- **performance_config.sh**: Configuration settings for performance optimization
- **selective_watcher.sh**: Implementation of selective file watching to reduce resource usage
- **throttle_manager.sh**: Handles throttling for high-frequency file changes
- **incremental_updater.sh**: Implements incremental updates for large projects

## Features

### Selective File Watching
Reduces resource usage by only watching files that are relevant to the current operation or have been recently modified.

```bash
# Start selective file watching
./scripts/performance/selective_watcher.sh start

# Stop selective file watching
./scripts/performance/selective_watcher.sh stop
```

### Throttling
Prevents excessive operations during high-frequency file changes, such as during large refactoring operations or when using certain tools.

```bash
# Configure throttling
./scripts/performance/throttle_manager.sh configure --delay 500
```

### Incremental Updates
For large projects, enables partial updates instead of full synchronization.

```bash
# Perform an incremental update
./scripts/performance/incremental_updater.sh --mode smart
```

## Configuration Options

Performance features can be configured through the VSCode settings:

```json
"vscode-xcode-integration.performance.enabled": true,
"vscode-xcode-integration.performance.useSelectiveWatch": false,
"vscode-xcode-integration.performance.useThrottling": false,
"vscode-xcode-integration.performance.useIncrementalUpdates": false,
"vscode-xcode-integration.performance.updateMode": "smart",
"vscode-xcode-integration.performance.batchSize": 20,
"vscode-xcode-integration.performance.activeOnlyWatching": true,
"vscode-xcode-integration.performance.memoryLimit": 100,
"vscode-xcode-integration.performance.cpuLimit": 20
```

## Integration

These performance scripts are integrated with the main extension through:
- Status bar indicators showing performance status
- The Performance menu in the Command Palette
- Automatic activation based on project size and activity

## Troubleshooting

If you experience high CPU or memory usage:
1. Enable selective file watching
2. Increase throttling delay
3. Use incremental updates with "minimal" mode
4. Reduce batch size for file operations
