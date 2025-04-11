#!/bin/bash
# Make this file executable first: chmod +x commit_all_changes.sh

# Script to commit ALL changed files including script files
# Created on April 10, 2025

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Committing ALL modified and new files...${NC}"

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

echo -e "${YELLOW}Which method would you like to use to add files?${NC}"
echo -e "1) ${BLUE}Add specific files${NC} (carefully curated list)"
echo -e "2) ${BLUE}Add all files${NC} (git add -u; git add .; excludes only .bak files)"
read -r method_choice

if [ "$method_choice" = "1" ]; then
  # Add modified files
  echo -e "${BLUE}Adding modified files...${NC}"
  git add CHANGELOG.md
  git add install_extension.sh
  git add package-lock.json
  git add package.json
  git add package_extension.sh
  git add src/extension.ts

  # Add new files (including script files, excluding backup files)
  echo -e "${BLUE}Adding new files...${NC}"
  git add LICENSE.txt
  git add build_and_package.sh
  git add make_executable.sh
  git add make_scripts_executable.sh
  git add media/xcode-icon.svg
  git add src/xcodeExplorer.ts
  git add test_extension.sh

  # Add all shell scripts in root directory
  echo -e "${BLUE}Adding all shell scripts in root directory...${NC}"
  git add *.sh

  # Add all remaining files in the scripts directory
  echo -e "${BLUE}Adding remaining script files...${NC}"
  git add scripts/
elif [ "$method_choice" = "2" ]; then
  # Add all tracked and modified files
  echo -e "${BLUE}Adding all tracked changes...${NC}"
  git add -u
  
  # Add all new files
  echo -e "${BLUE}Adding all new files...${NC}"
  git add .
  
  # Remove any .bak files from being staged
  echo -e "${BLUE}Removing backup files from commit...${NC}"
  git reset -- *.bak
else
  echo -e "${RED}Invalid choice. Exiting.${NC}"
  exit 1
fi

# Show what's being committed
echo -e "${GREEN}Files staged for commit:${NC}"
git diff --name-only --cached

# Commit the changes
echo -e "${GREEN}Committing changes...${NC}"
git commit -m "Update project files and add new scripts and functionality"

# Push to GitHub
echo -e "${GREEN}Pushing to GitHub...${NC}"
git push origin main

echo -e "${GREEN}Done!${NC}"
