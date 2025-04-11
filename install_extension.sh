#!/bin/bash

echo "=== Installing VSCode Xcode Integration Extension v0.3.0 ==="

# Try with 'code' first (standard VSCode)
if command -v code &> /dev/null; then
    echo "Installing for Visual Studio Code..."
    code --install-extension vscode-xcode-integration-0.3.0.vsix
    echo "Installation complete!"
    exit 0
fi

# If 'code' command isn't found, try with 'code-insiders'
if command -v code-insiders &> /dev/null; then
    echo "Installing for Visual Studio Code Insiders..."
    code-insiders --install-extension vscode-xcode-integration-0.3.0.vsix
    echo "Installation complete!"
    exit 0
fi

echo "Error: Neither 'code' nor 'code-insiders' command found."
echo "Please ensure Visual Studio Code is installed and the command line tools are set up."
echo "To install manually, use: code --install-extension vscode-xcode-integration-0.3.0.vsix"
exit 1
