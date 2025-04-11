#!/bin/bash


# Set colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}=== Packaging VSCode Xcode Integration Extension ===${NC}"

# Check for required tools
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed. Please install Node.js and npm.${NC}"
    exit 1
fi

if ! command -v vsce &> /dev/null; then
    echo -e "${YELLOW}Warning: vsce not found. Installing globally...${NC}"
    npm install -g @vscode/vsce
fi

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
cd "$SCRIPT_DIR"
npm install

# Compile TypeScript
echo -e "${BLUE}Compiling TypeScript...${NC}"
npm run compile

# Package extension
echo -e "${BLUE}Packaging extension...${NC}"
vsce package

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Extension packaged successfully!${NC}"
    echo -e "${YELLOW}You can now install the extension using:${NC}"
    echo -e "code --install-extension vscode-xcode-integration-*.vsix"
else
    echo -e "${RED}Error: Failed to package extension${NC}"
    exit 1
fi