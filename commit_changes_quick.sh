#!/bin/bash
# Make sure to run: chmod +x commit_changes_quick.sh

# Script to commit remaining changed files automatically without confirmation
# Created on April 10, 2025

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}Committing modified and new files...${NC}"

# Navigate to the repository root
cd "$(dirname "$0")"
echo -e "${YELLOW}Working directory: $(pwd)${NC}"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo -e "${YELLOW}Warning: Not in a git repository root. Make sure you run this from the repository root.${NC}"
  exit 1
fi

# Show status before changes
echo -e "${GREEN}Current git status:${NC}"
git status

# Add modified files
echo -e "${BLUE}Adding modified files...${NC}"
git add CHANGELOG.md
git add install_extension.sh
git add package-lock.json
git add package.json
git add package_extension.sh
git add src/extension.ts

# Add new files (excluding backup files)
echo -e "${BLUE}Adding new files...${NC}"
git add LICENSE.txt
git add build_and_package.sh
git add make_executable.sh
git add make_scripts_executable.sh
git add media/xcode-icon.svg
git add src/xcodeExplorer.ts
git add test_extension.sh

# Add all remaining files in the scripts directory
echo -e "${BLUE}Adding remaining script files...${NC}"
git add scripts/

# Show what's being committed
echo -e "${GREEN}Files staged for commit:${NC}"
git diff --name-only --cached

# Commit the changes
echo -e "${GREEN}Committing changes...${NC}"
git commit -m "Update project files and add new functionality"

# Push to GitHub
echo -e "${GREEN}Pushing to GitHub...${NC}"
git push origin main

echo -e "${GREEN}Done!${NC}"
