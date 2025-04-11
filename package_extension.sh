#!/bin/bash

echo "=== Packaging VSCode Xcode Integration Extension v0.2.0 ==="
echo "Installing dependencies..."
npm install

echo "Compiling TypeScript..."
npm run compile

echo "Packaging extension..."
npm run vscode:prepublish
npx vsce package

echo "=== Packaging complete! ==="
echo "VSIX file created. You can install it with:"
echo "code --install-extension vscode-xcode-integration-0.2.0.vsix"
