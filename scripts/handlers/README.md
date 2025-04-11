# Resource Handlers

This directory contains specialized handlers for different types of resource files used in Xcode projects. These handlers ensure that resource files remain compatible with Xcode when edited in VSCode.

## Handlers

- **asset_catalog_handler.sh**: Handles `.xcassets` files (Asset Catalogs)
- **coredata_handler.sh**: Manages `.xcdatamodeld` files (CoreData Models)
- **interface_builder_handler.sh**: Processes `.xib` and `.storyboard` files
- **resource_handler.sh**: Common utilities shared by all resource handlers

## Usage

These handlers are automatically invoked by the main scripts when dealing with resource files. They can also be called directly:

```bash
# Handle an Asset Catalog file
./scripts/handlers/asset_catalog_handler.sh /path/to/Assets.xcassets/image.imageset

# Handle a CoreData Model file
./scripts/handlers/coredata_handler.sh /path/to/Model.xcdatamodeld

# Handle an Interface Builder file
./scripts/handlers/interface_builder_handler.sh /path/to/View.xib
```

## Features

### Asset Catalog Handler
- Validates Contents.json files in image sets, color sets, and other assets
- Regenerates invalid or missing Contents.json files
- Maintains bundle integrity when files are added or modified

### CoreData Model Handler
- Validates CoreData model files to ensure Xcode compatibility
- Manages version files for multi-version models
- Creates and updates .xccurrentversion files

### Interface Builder Handler
- Performs XML validation to ensure files remain valid when edited in VSCode
- Applies automatic formatting and minor error correction
- Creates backups before making changes
- Detects related Swift files that might need updates

## Integration

These handlers integrate with the main extension through:
- The VSCode extension's file watcher system
- The `handle_resource_file.sh` script in the parent directory
- The transaction-based error handling system (for safe modifications)
