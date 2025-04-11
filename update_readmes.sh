#!/bin/bash

# Script to commit and push README files
# Created on April 10, 2025

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Updating README files in GitHub repository...${NC}"

# Navigate to the repository root
cd "$(dirname "$0")"
echo -e "${YELLOW}Working directory: $(pwd)${NC}"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo -e "${YELLOW}Warning: Not in a git repository root. Make sure you run this from the repository root.${NC}"
  exit 1
fi

# Copy the README files from parent directory to appropriate locations
echo -e "${GREEN}Copying README files...${NC}"
mkdir -p scripts/handlers
mkdir -p scripts/performance
mkdir -p scripts/version_control/git_hooks
mkdir -p scripts/version_control/merge_tools
mkdir -p scripts/version_control/state_manager

cp ../scripts/handlers/README.md scripts/handlers/
cp ../scripts/performance/README.md scripts/performance/
cp ../scripts/version_control/git_hooks/README.md scripts/version_control/git_hooks/
cp ../scripts/version_control/merge_tools/README.md scripts/version_control/merge_tools/
cp ../scripts/version_control/state_manager/README.md scripts/version_control/state_manager/

# Show status before changes
echo -e "${GREEN}Current git status:${NC}"
git status

# Add the README files
echo -e "${GREEN}Adding README files...${NC}"
git add scripts/handlers/README.md
git add scripts/performance/README.md
git add scripts/version_control/git_hooks/README.md
git add scripts/version_control/merge_tools/README.md
git add scripts/version_control/state_manager/README.md

# Show what's being committed
echo -e "${GREEN}Files staged for commit:${NC}"
git diff --name-only --cached

# Commit the changes
echo -e "${GREEN}Committing changes...${NC}"
git commit -m "Add README files for subdirectories to improve documentation"

# Push to GitHub
echo -e "${GREEN}Pushing to GitHub...${NC}"
git push origin main

echo -e "${GREEN}Done!${NC}"
