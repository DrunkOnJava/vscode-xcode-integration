#!/bin/bash

cd /Users/griffin/Projects/vscode-xcode-integration/vscode-extension
echo "Running TypeScript compiler..."
npx tsc -p ./
EXIT_CODE=$?
echo "Exit code: $EXIT_CODE"

if [ $EXIT_CODE -eq 0 ]; then
  echo "Compilation successful! No errors found."
else
  echo "Compilation failed with errors."
fi
