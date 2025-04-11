#!/bin/bash
# Script to test the extension locally

# Set colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Building and Testing VS Code Xcode Integration Extension ===${NC}"

# Step 1: Compile the extension
echo -e "${GREEN}Compiling extension...${NC}"
npm run compile

# Step 2: Package the extension
echo -e "${GREEN}Packaging extension...${NC}"
vsce package

# Step 3: Install the extension
echo -e "${GREEN}Installing extension locally...${NC}"
code --install-extension vscode-xcode-integration-0.1.0.vsix --force

echo -e "${YELLOW}=== Extension installed successfully! ===${NC}"
echo -e "You can now test the extension in VS Code."
echo -e "To uninstall, run: code --uninstall-extension griffin.vscode-xcode-integration"
