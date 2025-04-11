#!/bin/bash


# Set colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}=== Installing VSCode Xcode Integration Extension ===${NC}"

# Check if the extension is already packaged
if [ ! -f "$SCRIPT_DIR"/vscode-xcode-integration-*.vsix ]; then
    echo -e "${YELLOW}Extension package not found. Packaging now...${NC}"
    "$SCRIPT_DIR/package_extension.sh"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to package extension${NC}"
        exit 1
    fi
fi

# Install the extension
echo -e "${BLUE}Installing extension...${NC}"
VSIX_PATH=$(find "$SCRIPT_DIR" -name "vscode-xcode-integration-*.vsix" -type f | head -1)

if [ -z "$VSIX_PATH" ]; then
    echo -e "${RED}Error: Could not find extension package${NC}"
    exit 1
fi

code --install-extension "$VSIX_PATH"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Extension installed successfully!${NC}"
    echo -e "${YELLOW}Please restart VSCode to activate the extension.${NC}"
else
    echo -e "${RED}Error: Failed to install extension${NC}"
    exit 1
fi