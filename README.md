# VSCode Xcode Integration

![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A comprehensive extension that seamlessly integrates Visual Studio Code with Xcode, enabling Swift development in VSCode while maintaining perfect synchronization with Xcode. Perfect for developers who love VSCode's editor experience but still need Xcode's build system and Interface Builder.

![Xcode Integration Screenshot](https://raw.githubusercontent.com/drunkonjava/vscode-xcode-integration/main/docs/images/xcode-integration-screenshot.png)

**[NEW: Xcode Explorer Sidebar]** Navigate projects, targets, schemes, and source files directly in VSCode!

**[NEW: DEPLOYMENT GUIDE AVAILABLE](DEPLOYMENT.md)** - Instructions for building, testing, and deploying the extension

## Features

### Core Features
- **Bidirectional File Synchronization**: Changes in VSCode are automatically reflected in Xcode and vice versa
- **Intelligent Project Structure Monitoring**: Detects new, modified, or moved files and updates references
- **Specialized Resource Handling**: Proper support for Asset Catalogs, Interface Builder files, and CoreData models
- **Comprehensive Build Integration**: Run builds, tests, and manage dependencies directly from VSCode
- **Interactive Status Bar**: Visual indicators show sync status and provide quick access to commands

### Advanced Features

#### New in 0.3.0:
- **Xcode Explorer Sidebar**: Navigate your Xcode projects with three dedicated views:
  - **Projects View**: For navigating Xcode projects and workspaces
  - **Targets & Schemes View**: For building targets and running schemes
  - **Files View**: For organizing Swift and Objective-C files
- **Context Menu Actions**: Build targets, run schemes, and open projects with right-click
- **Auto-refresh Functionality**: Explorer views automatically update when projects change
- **Improved Target Detection**: Using xcodebuild with fallback to direct parsing
- **Enhanced Error Handling**: Better project file parsing and error recovery
- **Improved Installation**: Better scripts for both standard VS Code and VS Code Insiders

#### Security and Error Handling:
- **Enterprise-Grade Security**: Protection against path traversal, sensitive data exposure, and permission issues
- **Transaction-Based Operations**: All changes are atomic with automatic rollback on failure
- **Self-Healing Capabilities**: Detect and repair common issues automatically
- **Multi-Project Support**: Seamlessly work with complex Xcode workspaces

#### Version Control Integration:
- **Git Hooks**: Pre-commit, post-commit, post-checkout, post-merge, and post-rebase
- **Specialized Merge Tools**: Custom mergers for pbxproj, Swift, Asset Catalog, and XIB files
- **Project State Management**: Create, restore, and track named project states

#### Performance Features:
- **Selective File Watching**: Reduces resource usage by only watching relevant files
- **Throttling**: Prevents excessive operations during high-frequency changes
- **Incremental Updates**: Enables partial updates instead of full synchronization for large projects

## Screenshots

### Xcode Explorer Sidebar
![Xcode Explorer Sidebar](https://raw.githubusercontent.com/drunkonjava/vscode-xcode-integration/main/docs/images/xcode-explorer.png)

### Status Bar Integration
![Status Bar](https://raw.githubusercontent.com/drunkonjava/vscode-xcode-integration/main/docs/images/status-bar.png)

### PBXProj Editor
![PBXProj Editor](https://raw.githubusercontent.com/drunkonjava/vscode-xcode-integration/main/docs/images/pbxproj-editor.png)

## Prerequisites

Before installing the extension, ensure you have:

1. **Required VSCode Extensions**:
   - [Swift for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=swift-lang.swift) (`swift-lang.swift`)
   - [Swift Language](https://marketplace.visualstudio.com/items?itemName=sswg.swift-lang) (`sswg.swift-lang`)
   - [SourceKit-LSP](https://marketplace.visualstudio.com/items?itemName=pvasek.sourcekit-lsp) (`pvasek.sourcekit-lsp`)

2. **Command Line Tools**:
   ```bash
   # Install SourceKit-LSP
   brew install sourcekit-lsp
   
   # Verify Xcode command line tools are installed
   xcodebuild -version
   ```

## Installation

### Option 1: Quick Install (Recommended)

```bash
# Clone the repository
git clone https://github.com/drunkonjava/vscode-xcode-integration.git
cd vscode-xcode-integration

# Run the setup script (replace with your project path)
./setup.sh --project-dir /path/to/your/xcode/project

# Install the extension
cd vscode-extension
./install_extension.sh

# Open your project in VSCode
code /path/to/your/xcode/project
```

### Option 2: Manual Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/drunkonjava/vscode-xcode-integration.git
   ```

2. **Copy Configuration Files**:
   ```bash
   # Copy .vscode directory to your project
   cp -r vscode-xcode-integration/.vscode /path/to/your/xcode/project/
   
   # Copy scripts directory to your project
   cp -r vscode-xcode-integration/scripts /path/to/your/xcode/project/
   ```

3. **Make Scripts Executable**:
   ```bash
   cd /path/to/your/xcode/project
   chmod +x scripts/*.sh
   chmod +x scripts/security/*.sh
   chmod +x scripts/error_handling/*.sh
   chmod +x scripts/multi_project/*.sh
   scripts/security/make_scripts_executable.sh
   scripts/error_handling/make_scripts_executable.sh
   scripts/multi_project/make_scripts_executable.sh
   ```

4. **Create Required Directories**:
   ```bash
   scripts/error_handling/make_dirs.sh
   ```

5. **Install the VSCode Extension**:
   ```bash
   cd /path/to/vscode-xcode-integration/vscode-extension
   ./package_extension.sh
   code --install-extension ./vscode-xcode-integration-0.3.0.vsix
   ```

6. **Open Your Project**:
   ```bash
   code /path/to/your/xcode/project
   ```

7. **Customize Configuration**: Edit `.vscode/tasks.json` and `.vscode/launch.json` to match your Xcode scheme and app name.

## Usage Guide

### Xcode Explorer Sidebar

The new Xcode Explorer sidebar provides a convenient way to navigate and interact with your Xcode projects:

1. **Access the Sidebar**: Click the Xcode hammer icon in the Activity Bar (left side of VSCode)

2. **Projects View**:
   - Shows all .xcodeproj and .xcworkspace files in your workspace
   - Right-click on a project to open it in Xcode
   - Automatically refreshes when projects are added or modified

3. **Targets & Schemes View**:
   - Displays all targets and associated build schemes
   - Right-click on a target to build it
   - Right-click on a scheme to run it
   - Shows product type for each target

4. **Files View**:
   - Shows all Swift and Objective-C files organized by directory
   - Click on a file to open it in the editor
   - Automatically updates when files are added, moved, or deleted

5. **Refresh Button**: Each view has a refresh button in its title bar for manual updates

### Status Bar Commands

The extension adds these status bar items when working with Swift files:

- **Sync Status**: Shows the current synchronization state (Synced, Syncing, Error)
- **Xcode Menu**: Provides quick access to all Xcode commands
- **Security Status**: Shows the status of security features
- **Transaction Status**: Shows the status of the transaction system

### Command Palette

Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux) and type `Xcode:` to access all commands:

- **Synchronization Commands**:
  - `Xcode: Sync Current File` - Synchronize the current file with Xcode
  - `Xcode: Sync Entire Project` - Synchronize all files with Xcode
  
- **Build Commands**:
  - `Xcode: Build Project` - Build the Xcode project
  - `Xcode: Run Tests` - Run tests for the Xcode project
  - `Xcode: Update Dependencies` - Update Swift Packages, CocoaPods, or Carthage

- **Security Commands**:
  - `Xcode: Scan for Sensitive Data` - Check for API keys and secrets
  - `Xcode: Validate Project Paths` - Ensure operations stay within project boundaries
  - `Xcode: Check File Permissions` - Verify permissions on project files
  
- **Error Handling Commands**:
  - `Xcode: Check Project Integrity` - Verify project structure and files
  - `Xcode: Repair Project` - Fix detected issues automatically
  - `Xcode: View Transaction Log` - Show active transactions

- **Multi-Project Commands**:
  - `Xcode: Detect Workspace` - Find Xcode workspace for the current project
  - `Xcode: Select Workspace Scheme` - Select a build scheme from the workspace
  - `Xcode: Build Dependency Graph` - Visualize project dependencies
  - `Xcode: Determine Build Order` - Calculate optimal build order

- **Version Control Commands**:
  - `Xcode: Save Project State` - Create a named project state snapshot
  - `Xcode: Restore Project State` - Restore to a previously saved state
  - `Xcode: Show Project State History` - View state history
  - `Xcode: Set Up Git Hooks` - Configure Git hooks for Xcode projects

### Explorer Context Menu

Right-click on files in the Explorer view to access:

- `Xcode: Sync File` - For Swift files
- `Xcode: Check Permissions` - For any file
- `Xcode: Scan for Sensitive Data` - For any file
- `Xcode: Save/Restore Project State` - When Git is enabled
- `Xcode: Update Cross-References` - For Xcode project files

## Configuration Options

The extension can be configured through VSCode's settings (`Cmd+,` or `Ctrl+,`):

### General Settings

```json
"vscode-xcode-integration.projectPath": "Path to Xcode project/workspace from workspace root",
"vscode-xcode-integration.enableAutoSync": true,
"vscode-xcode-integration.showNotifications": true,
"vscode-xcode-integration.logLevel": "info",
"vscode-xcode-integration.watchExclude": ["**/Pods/**", "**/Carthage/**", "**/DerivedData/**", "**/build/**"],
"vscode-xcode-integration.debounceDelay": 1000,
"vscode-xcode-integration.autoRefreshExplorer": true
```

### Security Settings

```json
"vscode-xcode-integration.security.enableSecurityChecks": true,
"vscode-xcode-integration.security.interactiveMode": true,
"vscode-xcode-integration.security.createBackups": true,
"vscode-xcode-integration.security.checkSensitiveData": true,
"vscode-xcode-integration.security.validatePaths": true,
"vscode-xcode-integration.security.checkPermissions": true,
"vscode-xcode-integration.security.allowedExternalPaths": [],
"vscode-xcode-integration.security.securityLogLevel": "INFO",
"vscode-xcode-integration.security.autoFixPermissions": "ask"
```

### Error Handling Settings

```json
"vscode-xcode-integration.errorHandling.enableTransactions": true,
"vscode-xcode-integration.errorHandling.autoRepair": false,
"vscode-xcode-integration.errorHandling.logLevel": "INFO",
"vscode-xcode-integration.errorHandling.transactionLogFile": "",
"vscode-xcode-integration.errorHandling.autoCommitDelay": 5000,
"vscode-xcode-integration.errorHandling.keepBackupDays": 7,
"vscode-xcode-integration.errorHandling.integrityCheckMode": "normal"
```

### Multi-Project Settings

```json
"vscode-xcode-integration.multiProject.autoDetectWorkspace": true,
"vscode-xcode-integration.multiProject.updateReferencesOnSync": false,
"vscode-xcode-integration.multiProject.schemeSelectionMode": "auto"
```

### Version Control Settings

```json
"vscode-xcode-integration.versionControl.autoRepairEnabled": true,
"vscode-xcode-integration.versionControl.stateTrackingEnabled": true,
"vscode-xcode-integration.versionControl.autoSetupGitHooks": true,
"vscode-xcode-integration.versionControl.mergeStrategy": "interactive",
"vscode-xcode-integration.versionControl.notifyOnStateChange": true,
"vscode-xcode-integration.versionControl.maxStateHistory": 10
```

### Performance Settings

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

## Resource File Handling

The extension includes specialized handlers for Xcode-specific resource files:

### Asset Catalog (.xcassets)

- Validates Contents.json files in image sets, color sets, etc.
- Regenerates invalid or missing Contents.json files
- Maintains bundle integrity when files are added or modified

### Interface Builder (.xib and .storyboard)

- XML validation to ensure files remain valid when edited in VSCode
- Automatic formatting and minor error correction
- Backup creation before making changes

### CoreData Model (.xcdatamodeld)

- Validation of model files for Xcode compatibility
- Version management for multi-version models
- Creation and maintenance of .xccurrentversion files

## Version Control Features

### Git Hooks

- **pre-commit**: Ensures Xcode project files are properly formatted
- **post-commit**: Updates file references after commit
- **post-checkout**: Restores project state after checkout
- **post-merge**: Handles file references after merge
- **post-rebase**: Updates project state after rebase

### Specialized Merge Tools

- **PBXProj Merger**: Intelligently merges Xcode project files
- **Swift Merger**: Merges Swift files with proper reference handling
- **Asset Catalog Merger**: Merges asset catalog files with JSON awareness
- **Interface Builder Merger**: Merges XIB and storyboard files with XML awareness

### Project State Management

- Create named states that can be easily restored
- Automatic state saving before Git operations
- Quick rollback to previous states
- State history tracking

## Performance Optimization

The extension includes several performance optimization features for large projects:

### Selective File Watching

Reduces resource usage by only watching files that are relevant to the current operation or have been recently modified.

### Throttling

Prevents excessive operations during high-frequency file changes, such as during large refactoring operations or when using certain tools.

### Incremental Updates

For large projects, enables partial updates instead of full synchronization to improve performance.

## Troubleshooting

### Common Issues

#### Xcode Doesn't Recognize Changes

If Xcode doesn't recognize your changes:
1. Run the "Synchronize Xcode Project" task in VSCode
2. Try closing and reopening the file in Xcode
3. Restart Xcode if the issue persists

#### New Files Not Appearing in Xcode

If new files aren't showing up:
1. Run the project structure monitor script
2. Try manually adding the file to Xcode using File > Add Files to "YourProject"

#### Xcode Explorer Not Showing Targets

If the Xcode Explorer isn't showing targets:
1. Click the refresh button in the Targets & Schemes view
2. Make sure xcodebuild is working correctly from the command line
3. Check the extension's log output for any errors

### Diagnostic Steps

1. **Check Extension Status**:
   - Click the shield icon in the status bar to view security status
   - Click the database icon to view transaction status
   - Run "Show Status" command to see the overall integration status

2. **Check Logs**:
   - Open the Output panel (View > Output)
   - Select "Xcode Integration" from the dropdown
   - Look for error messages or warnings

3. **Run Integrity Check**:
   - Run the "Check Project Integrity" command
   - Select "Detailed" for a comprehensive analysis
   - Review the results for any issues

4. **Repair Project**:
   - If issues are found, run the "Repair Project" command
   - Select "Guided" mode for interactive repair
   - Follow the prompts to fix detected issues

## Building and Deploying

For detailed instructions on building, testing, and deploying the extension, please refer to the [Deployment Guide](DEPLOYMENT.md).

### Quick Build Instructions

```bash
# Clone the repository
git clone https://github.com/drunkonjava/vscode-xcode-integration.git
cd vscode-xcode-integration

# Make scripts executable
chmod +x vscode-extension/make_scripts_executable.sh
./vscode-extension/make_scripts_executable.sh

# Build and package the extension
cd vscode-extension
./package_extension.sh

# Install the extension locally
./install_extension.sh
```

## Additional Documentation

- [Resource Handlers Documentation](scripts/handlers/README.md)
- [Performance Optimization Documentation](scripts/performance/README.md)
- [Git Hooks Documentation](scripts/version_control/git_hooks/README.md)
- [Specialized Merge Tools Documentation](scripts/version_control/merge_tools/README.md)
- [Project State Manager Documentation](scripts/version_control/state_manager/README.md)
- [Error Handling Documentation](ERROR_HANDLING.md)
- [Deployment Guide](DEPLOYMENT.md)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- The Swift community for excellent tools and documentation
- The VS Code team for creating an extensible editor
- All contributors who have helped improve this extension

---

**Enjoy coding Swift in VS Code with all the power of Xcode!**