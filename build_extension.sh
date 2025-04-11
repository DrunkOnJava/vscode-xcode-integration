#!/bin/bash
# ======================================================
# build_extension.sh
# Build the VSCode extension
# ======================================================

# Set up error handling
set -e

# Color definitions
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

# Print header
echo -e "${BOLD}${CYAN}=====================================================${RESET}"
echo -e "${BOLD}${CYAN}        Building VSCode-Xcode Integration Extension  ${RESET}"
echo -e "${BOLD}${CYAN}=====================================================${RESET}"
echo

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check for required tools
echo -e "${CYAN}Checking for required tools...${RESET}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed. Please install Node.js and npm.${RESET}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: node is not installed. Please install Node.js.${RESET}"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx is not installed. Please install Node.js and npm.${RESET}"
    exit 1
fi

echo -e "${GREEN}✓${RESET} All required tools are installed."

# Check for package.json
if [ ! -f "$SCRIPT_DIR/package.json" ]; then
    echo -e "${RED}Error: package.json not found in $SCRIPT_DIR${RESET}"
    exit 1
fi

# Install dependencies if node_modules doesn't exist or --force flag is used
if [ ! -d "$SCRIPT_DIR/node_modules" ] || [[ "$*" == *"--force"* ]]; then
    echo -e "${CYAN}Installing dependencies...${RESET}"
    npm install
    echo -e "${GREEN}✓${RESET} Dependencies installed."
else
    echo -e "${CYAN}Skipping dependency installation (node_modules exists).${RESET}"
    echo -e "  Use --force to force reinstallation."
fi

# Make sure the media directory exists
if [ ! -d "$SCRIPT_DIR/media" ]; then
    echo -e "${CYAN}Creating media directory...${RESET}"
    mkdir -p "$SCRIPT_DIR/media"
fi

# Build the extension
echo -e "${CYAN}Building extension...${RESET}"
npm run compile
echo -e "${GREEN}✓${RESET} Extension built successfully."

# Check if out directory exists
if [ ! -d "$SCRIPT_DIR/out" ]; then
    echo -e "${RED}Error: Build failed. out directory not found.${RESET}"
    exit 1
fi

# Package the extension
if [[ "$*" == *"--package"* ]]; then
    echo -e "${CYAN}Packaging extension...${RESET}"
    npx vsce package
    echo -e "${GREEN}✓${RESET} Extension packaged successfully."
    
    # Move the VSIX file to the repo root if it exists
    VSIX_FILE=$(ls -t *.vsix | head -1)
    if [ -n "$VSIX_FILE" ]; then
        mv "$VSIX_FILE" "$REPO_ROOT/"
        echo -e "${GREEN}✓${RESET} Extension package moved to $REPO_ROOT/$VSIX_FILE"
    fi
fi

# Install the extension if --install flag is used
if [[ "$*" == *"--install"* ]]; then
    echo -e "${CYAN}Installing extension...${RESET}"
    code --install-extension "$(ls -t "$REPO_ROOT"/*.vsix | head -1)"
    echo -e "${GREEN}✓${RESET} Extension installed successfully."
fi

echo
echo -e "${BOLD}${GREEN}VSCode-Xcode Integration Extension built successfully!${RESET}"
echo -e "${BOLD}${CYAN}=====================================================${RESET}"

exit 0