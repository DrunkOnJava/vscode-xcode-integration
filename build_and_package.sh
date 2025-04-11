#!/bin/bash

chmod +x $0
chmod +x ./package_extension.sh 
chmod +x ./install_extension.sh

echo "Building and packaging VSCode-Xcode Integration v0.3.0..."

# Run the packaging script
./package_extension.sh

echo "Installation options:"
echo "1. Run './install_extension.sh' to install locally"
echo "2. Upload vscode-xcode-integration-0.3.0.vsix to VS Code Marketplace"
echo "3. Share vscode-xcode-integration-0.3.0.vsix with other developers"
