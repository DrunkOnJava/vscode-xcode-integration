# VSCode Xcode Integration

A Visual Studio Code extension that provides seamless integration between VS Code and Xcode for Swift development.

## Features

- **File Synchronization**: Automatically sync files between VS Code and Xcode
- **Build Integration**: Run Xcode build commands directly from VS Code
- **Multi-Project Support**: Handle Xcode workspaces with multiple projects
- **Version Control Integration**: Specialized Git integration for Xcode projects
- **Performance Optimization**: Smart file watching and dependency analysis
- **Security & Error Handling**: Protect your project and recover from errors

## Requirements

- Visual Studio Code 1.60.0 or later
- Xcode installed on your Mac
- macOS system

## Installation

Download the VSIX file from the releases page and install it in VS Code:
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Click the "..." menu and select "Install from VSIX..."
4. Select the downloaded VSIX file

## Usage

After installation, you'll find various commands in the Command Palette (Ctrl+Shift+P / Cmd+Shift+P):

- `Xcode: Sync Current File`: Sync the active file with Xcode
- `Xcode: Sync Entire Project`: Sync all project files
- `Xcode: Build Project`: Build the project using Xcode
- `Xcode: Run Tests`: Run tests using Xcode
- And many more...

## Configuration

Configure the extension in your VS Code settings:

```json
"vscode-xcode-integration.enableAutoSync": true,
"vscode-xcode-integration.showNotifications": true,
"vscode-xcode-integration.logLevel": "info"
```

See the extension settings for all available options.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
