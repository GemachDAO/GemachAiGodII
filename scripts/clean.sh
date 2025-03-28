#!/bin/bash

# Navigate to the script's directory
cd "$(dirname "$0")"/..
echo "Cleanup started."
# Find and remove node_modules directories, dist directories.
find . -type d -name "node_modules" -exec rm -rf {} + \
    -o -type d -name "dist" -exec rm -rf {} + \
    -o -type d -name ".turbo" -exec rm -rf {} +

# Remove core cache
rm -rf ./packages/core/cache ./dist ./data


# Remove pnpm-lock.yaml
rm -rf pnpm-lock.yaml

pnpm store prune 
pnpm cache delete




echo "Cleanup completed."
