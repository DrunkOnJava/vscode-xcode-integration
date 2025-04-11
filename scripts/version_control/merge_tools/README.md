# Specialized Merge Tools

This directory contains specialized merge tools designed specifically for Xcode-related files. These tools help resolve merge conflicts in a way that maintains project integrity.

## Available Tools

- **pbxproj_merger.sh**: Specialized tool for merging Xcode project files (`.pbxproj`)
- **pbxproj_analyzer.sh**: Analyzes project files to detect and prevent potential conflicts
- **swift_merger.sh**: Handles merging Swift files with proper reference handling
- **asset_merger.sh**: Merges Asset Catalog files (`.xcassets`) with JSON awareness
- **xib_merger.sh**: Merges Interface Builder files (`.xib` and `.storyboard`) with XML awareness

## Usage

These tools can be invoked manually or through the extension's conflict resolution command:

```bash
# Merge pbxproj files
./scripts/version_control/merge_tools/pbxproj_merger.sh /path/to/file.pbxproj

# Merge Swift files
./scripts/version_control/merge_tools/swift_merger.sh /path/to/file.swift

# Merge Asset Catalog files
./scripts/version_control/merge_tools/asset_merger.sh /path/to/Assets.xcassets/image.imageset/Contents.json

# Merge Interface Builder files
./scripts/version_control/merge_tools/xib_merger.sh /path/to/View.xib
```

## Features

### PBXProj Merger
- Structured parsing of project files to avoid simple text-based conflicts
- Intelligent handling of UUIDs and references
- Section-based conflict resolution
- Maintains project integrity even during complex merges

### Swift Merger
- Handles imports and module references correctly
- Preserves formatting and structure
- Special handling for Swift-specific constructs

### Asset Merger
- JSON-aware merging for asset catalog files
- Properly handles image sets, color sets, and other assets
- Maintains correct references and identifiers

### XIB/Storyboard Merger
- XML-aware merging for Interface Builder files
- Preserves UI element relationships
- Handles controller connections correctly

## Integration

The merge tools are integrated with:
- Git through custom merge drivers (when enabled)
- The VSCode extension's conflict resolution command
- The custom PBXProj editor in the extension

## Configuration

Merge behavior can be configured through the VSCode settings:

```json
"vscode-xcode-integration.versionControl.mergeStrategy": "interactive",
"vscode-xcode-integration.versionControl.customMergeTools": {
    "pbxproj": "pbxproj_merger.sh",
    "swift": "swift_merger.sh",
    "xcassets": "asset_merger.sh",
    "xib": "xib_merger.sh",
    "storyboard": "xib_merger.sh"
}
```
