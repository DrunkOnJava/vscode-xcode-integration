# Change Log

All notable changes to the "VSCode Xcode Integration" extension will be documented in this file.

## [0.3.0] - 2025-04-10

### Added
- Xcode Explorer sidebar with three dedicated views:
  - Projects view for navigating Xcode projects and workspaces
  - Targets & Schemes view for building targets and running schemes
  - Files view for organizing Swift and Objective-C files
- Context menu actions for building targets, running schemes, and opening projects
- Auto-refresh functionality for the explorer views
- Added detailed README.md files to key directories:
  - Resource handlers documentation
  - Performance optimization documentation
  - Git hooks documentation
  - Merge tools documentation
  - State manager documentation

### Changed
- Improved target detection using xcodebuild with fallback to direct parsing
- Enhanced error handling for project file parsing
- Better timeout handling for xcodebuild commands
- Improved installation scripts for both standard VS Code and VS Code Insiders
- Completely rewritten main README.md with comprehensive documentation

### Fixed
- Fixed issue with command not found errors during installation
- Added safeguards for invalid or malformed project files
- Improved xcodebuild output parsing

## [0.2.0] - 2025-04-09

### Added
- Security features for protecting sensitive data
- Transaction-based error handling system
- Project integrity checking and self-healing
- Multi-project support for Xcode workspaces
- Version control integration with specialized merge tools
- Performance optimization for large projects

### Changed
- Improved synchronization algorithm
- Enhanced resource file handling
- More robust error reporting

## [0.1.0] - 2025-04-08