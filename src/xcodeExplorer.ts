import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Tree item for Xcode projects
export class XcodeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: 'project' | 'target' | 'scheme' | 'file' | 'folder',
        public readonly children?: XcodeItem[],
        public readonly filePath?: string
    ) {
        super(label, collapsibleState);

        // Set contextValue for tree item to enable context menu filtering
        this.contextValue = type;

        // Set icon based on item type
        switch (type) {
            case 'project':
                this.iconPath = new vscode.ThemeIcon('project');
                break;
            case 'target':
                this.iconPath = new vscode.ThemeIcon('package');
                break;
            case 'scheme':
                this.iconPath = new vscode.ThemeIcon('play-circle');
                break;
            case 'file':
                this.iconPath = new vscode.ThemeIcon('file-code');
                break;
            case 'folder':
                this.iconPath = new vscode.ThemeIcon('folder');
                break;
        }

        // Set command to open file when clicked
        if (filePath && type === 'file') {
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.file(filePath)]
            };
        }
    }
}

// Project Provider - Shows Xcode projects
export class XcodeProjectProvider implements vscode.TreeDataProvider<XcodeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<XcodeItem | undefined | null | void> = 
        new vscode.EventEmitter<XcodeItem | undefined | null | void>();
    
    readonly onDidChangeTreeData: vscode.Event<XcodeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string | undefined) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: XcodeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: XcodeItem): Thenable<XcodeItem[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No Xcode project found in empty workspace');
            return Promise.resolve([]);
        }

        try {
            if (element) {
                // Return children of the element if provided
                return Promise.resolve(element.children || []);
            } else {
                // Root level - find .xcodeproj or .xcworkspace files
                return this.getXcodeProjects();
            }
        } catch (error) {
            const errorMessage = `Error retrieving Xcode projects: ${error}`;
            vscode.window.showErrorMessage(errorMessage);
            console.error(errorMessage);
            return Promise.resolve([]);
        }
    }

    private async getXcodeProjects(): Promise<XcodeItem[]> {
        if (!this.workspaceRoot) {
            return [];
        }

        try {
            // Find all .xcodeproj and .xcworkspace directories
            const projects: XcodeItem[] = [];
            
            // Use vscode file system API to find project files
            const files = await vscode.workspace.findFiles('**/*.xcodeproj') || [];
            const workspaces = await vscode.workspace.findFiles('**/*.xcworkspace') || [];
            
            if (files.length === 0 && workspaces.length === 0) {
                vscode.window.showInformationMessage('No Xcode projects or workspaces found in the workspace');
                return [];
            }
            
            // Add each project to the list
            for (const file of [...files, ...workspaces]) {
                const relativePath = path.relative(this.workspaceRoot, file.fsPath);
                const isWorkspace = file.fsPath.endsWith('.xcworkspace');
                const projectType = isWorkspace ? 'Workspace' : 'Project';
                
                // Create project item with description showing the relative path
                const projectItem = new XcodeItem(
                    path.basename(file.fsPath),
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'project',
                    [], // Will populate children dynamically
                    file.fsPath
                );
                
                projectItem.description = relativePath;
                projectItem.tooltip = `${projectType}: ${file.fsPath}`;
                
                projects.push(projectItem);
            }
            
            return projects;
        } catch (error) {
            const errorMessage = `Error finding Xcode projects: ${error}`;
            vscode.window.showErrorMessage(errorMessage);
            console.error(errorMessage);
            return [];
        }
    }
}

// Target Provider - Shows targets and schemes in a project
export class XcodeTargetProvider implements vscode.TreeDataProvider<XcodeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<XcodeItem | undefined | null | void> = 
        new vscode.EventEmitter<XcodeItem | undefined | null | void>();
    
    readonly onDidChangeTreeData: vscode.Event<XcodeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string | undefined) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: XcodeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: XcodeItem): Thenable<XcodeItem[]> {
        if (!this.workspaceRoot) {
            return Promise.resolve([]);
        }

        try {
            if (element) {
                // Element has children (e.g., it's a target and we want to show its schemes)
                return Promise.resolve(element.children || []);
            } else {
                // Root level - parse the project file to get targets
                return this.getXcodeTargets();
            }
        } catch (error) {
            const errorMessage = `Error retrieving Xcode targets: ${error}`;
            vscode.window.showErrorMessage(errorMessage);
            console.error(errorMessage);
            return Promise.resolve([]);
        }
    }

    private async getXcodeTargets(): Promise<XcodeItem[]> {
        try {
            // Find the first Xcode project file
            const projectFiles = await vscode.workspace.findFiles('**/*.xcodeproj/project.pbxproj', '**/node_modules/**');
            if (projectFiles.length === 0) {
                // Try finding workspace files if no project files found
                const workspaceFiles = await vscode.workspace.findFiles('**/*.xcworkspace/contents.xcworkspacedata', '**/node_modules/**');
                if (workspaceFiles.length === 0) {
                    vscode.window.showInformationMessage('No Xcode project or workspace files found');
                    return [];
                }
                
                // For workspaces, we need to extract the referenced projects
                // This would be a more complex implementation using the workspace data
                return this.getTargetsFromWorkspace(workspaceFiles[0]);
            }
            
            // Use xcodebuild to get targets
            const projectDir = path.dirname(path.dirname(projectFiles[0].fsPath));
            const projectName = path.basename(projectDir);
            
            try {
                return this.getTargetsUsingXcodebuild(projectDir, projectName);
            } catch (xcodebuildError) {
                console.error('Error using xcodebuild:', xcodebuildError);
                // Fallback to parsing project file directly (partial implementation)
                return this.getTargetsFromProjectFile(projectFiles[0].fsPath, projectName);
            }
        } catch (error) {
            const errorMessage = `Error parsing Xcode project: ${error}`;
            vscode.window.showErrorMessage(errorMessage);
            console.error(errorMessage);
            return [];
        }
    }

    private async getTargetsUsingXcodebuild(projectDir: string, projectName: string): Promise<XcodeItem[]> {
        return new Promise<XcodeItem[]>((resolve, reject) => {
            const cp = require('child_process');
            
            // Add timeout to prevent hanging if xcodebuild is stuck
            const timeoutMs = 10000; // 10 seconds timeout
            let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
                if (process && !process.killed) {
                    process.kill();
                    reject(new Error(`xcodebuild command timed out after ${timeoutMs}ms`));
                }
            }, timeoutMs);
            
            // Launch xcodebuild process
            const process = cp.spawn('xcodebuild', ['-list', '-json'], {
                cwd: projectDir
            });
            
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });
            
            process.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });
            
            process.on('error', (error: Error) => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                reject(new Error(`Failed to launch xcodebuild: ${error.message}`));
            });
            
            process.on('close', (code: number) => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                
                if (code !== 0) {
                    console.error(`xcodebuild process exited with code ${code}`);
                    console.error(`stderr: ${stderr}`);
                    reject(new Error(`xcodebuild failed with code ${code}: ${stderr}`));
                    return;
                }
                
                try {
                    // Check if stdout contains valid JSON
                    if (!stdout.trim()) {
                        reject(new Error('xcodebuild returned empty output'));
                        return;
                    }
                    
                    const xcodebuildOutput = JSON.parse(stdout);
                    
                    // Validate the output structure
                    if (!xcodebuildOutput.project) {
                        reject(new Error('xcodebuild output does not contain project information'));
                        return;
                    }
                    
                    const targets = xcodebuildOutput.project.targets || [];
                    const schemes = xcodebuildOutput.project.schemes || [];
                    
                    if (targets.length === 0) {
                        // No targets found - may be a workspace or non-standard project
                        // Return a message item instead of empty array
                        const messageItem = new XcodeItem(
                            `No targets found in ${projectName}`,
                            vscode.TreeItemCollapsibleState.None,
                            'target'
                        );
                        messageItem.description = 'Check project configuration';
                        messageItem.tooltip = 'This might be a non-standard project or a workspace';
                        resolve([messageItem]);
                        return;
                    }
                    
                    // Create target items
                    const targetItems = targets.map((targetName: string) => {
                        // Find schemes associated with this target
                        const targetSchemes = schemes.filter((scheme: string) => 
                            scheme.toLowerCase().includes(targetName.toLowerCase()));
                            
                        const schemeItems = targetSchemes.map((scheme: string) => {
                            const schemeItem = new XcodeItem(
                                scheme, 
                                vscode.TreeItemCollapsibleState.None, 
                                'scheme'
                            );
                            schemeItem.tooltip = `Scheme: ${scheme} (Target: ${targetName})`;
                            return schemeItem;
                        });
                            
                        const targetItem = new XcodeItem(
                            targetName,
                            schemeItems.length > 0 ? 
                                vscode.TreeItemCollapsibleState.Collapsed : 
                                vscode.TreeItemCollapsibleState.None,
                            'target',
                            schemeItems
                        );
                        targetItem.tooltip = `Target: ${targetName} (${projectName})`;
                        return targetItem;
                    });
                    
                    resolve(targetItems);
                } catch (error) {
                    // Handle JSON parsing errors or other issues
                    console.error('Error parsing xcodebuild output:', error);
                    console.error('Raw output:', stdout);
                    reject(new Error(`Failed to parse xcodebuild output: ${error}`));
                }
            });
        });
    }

    private async getTargetsFromProjectFile(projectFilePath: string, projectName: string): Promise<XcodeItem[]> {
        try {
            // Read the project file content
            const content = await fs.promises.readFile(projectFilePath, 'utf8');
            
            // Check if file is empty or doesn't look like a pbxproj file
            if (!content || content.length < 100 || !content.includes('// !$*UTF8*$!')) {
                throw new Error('Invalid or empty pbxproj file');
            }
            
            // Simple regex-based extraction - this is a simplified approach
            // In a full implementation, you'd use a proper pbxproj parser
            
            // Look for PBXNativeTarget sections
            const targetMatches = content.match(/name = ([^;]+); productType = "([^"]+)"/g) || [];
            const targetSet = new Map<string, string>();  // Map of targetName -> productType
            
            // Extract unique target names and their product types
            for (const match of targetMatches) {
                const nameMatch = match.match(/name = ([^;]+);/);
                const productTypeMatch = match.match(/productType = "([^"]+)"/); 
                
                if (nameMatch && nameMatch[1] && productTypeMatch && productTypeMatch[1]) {
                    const targetName = nameMatch[1].replace(/"/g, '').trim();
                    const productType = productTypeMatch[1].trim();
                    targetSet.set(targetName, productType);
                }
            }
            
            // Try to extract schemes from the shared data directory
            const schemesDir = path.join(path.dirname(projectFilePath), '..', 'xcshareddata', 'xcschemes');
            const schemeFiles: string[] = [];
            
            try {
                if (fs.existsSync(schemesDir)) {
                    const files = await fs.promises.readdir(schemesDir);
                    schemeFiles.push(...files.filter(file => file.endsWith('.xcscheme')).map(file => file.replace('.xcscheme', '')));
                }
            } catch (error) {
                console.log(`No shared schemes found: ${error}`);
                // Continue with empty schemes list
            }
            
            // Create target items with found schemes or default schemes if none found
            const targets = Array.from(targetSet.entries()).map(([targetName, productType]) => {
                // Try to find schemes matching this target name
                const targetSchemes = schemeFiles.filter(scheme => 
                    scheme.toLowerCase().includes(targetName.toLowerCase()));
                
                let schemeItems: XcodeItem[] = [];
                
                if (targetSchemes.length > 0) {
                    // Use found schemes
                    schemeItems = targetSchemes.map(scheme => {
                        const schemeItem = new XcodeItem(
                            scheme, 
                            vscode.TreeItemCollapsibleState.None, 
                            'scheme'
                        );
                        schemeItem.tooltip = `Scheme: ${scheme} (Target: ${targetName})`;
                        return schemeItem;
                    });
                } else {
                    // Use default schemes
                    schemeItems = [
                        new XcodeItem('Debug', vscode.TreeItemCollapsibleState.None, 'scheme'),
                        new XcodeItem('Release', vscode.TreeItemCollapsibleState.None, 'scheme')
                    ];
                }
                
                // Create target item with product type in description
                const targetItem = new XcodeItem(
                    targetName,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'target',
                    schemeItems
                );
                
                // Show product type in the description
                const productTypeShort = productType.replace('com.apple.product-type.', '');
                targetItem.description = productTypeShort;
                targetItem.tooltip = `Target: ${targetName} (${productTypeShort})
Project: ${projectName}
Note: Parsed from project file`;
                
                return targetItem;
            });
            
            if (targets.length === 0) {
                // No targets found
                return [new XcodeItem(
                    `No targets found in ${projectName}`,
                    vscode.TreeItemCollapsibleState.None,
                    'target',
                    undefined
                )];
            }
            
            return targets;
            
        } catch (error) {
            console.error(`Error parsing project file: ${error}`);
            // Return a single item explaining the error
            const errorItem = new XcodeItem(
                'Error parsing project file',
                vscode.TreeItemCollapsibleState.None,
                'target'
            );
            errorItem.tooltip = `Error: ${error}`;
            return [errorItem];
        }
    }

    private async getTargetsFromWorkspace(workspaceFile: vscode.Uri): Promise<XcodeItem[]> {
        // This would involve parsing the workspace file to find referenced projects
        // For now, return a message indicating this is a workspace
        const workspaceName = path.basename(path.dirname(workspaceFile.fsPath));
        
        const workspaceItem = new XcodeItem(
            `${workspaceName} Workspace`, 
            vscode.TreeItemCollapsibleState.None,
            'target'
        );
        workspaceItem.tooltip = 'Workspace targets will be shown in a future update';
        workspaceItem.description = 'Workspace support coming soon';
        
        return [workspaceItem];
    }
}

// Files Provider - Shows Swift files and other source code
export class XcodeFileProvider implements vscode.TreeDataProvider<XcodeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<XcodeItem | undefined | null | void> = 
        new vscode.EventEmitter<XcodeItem | undefined | null | void>();
    
    readonly onDidChangeTreeData: vscode.Event<XcodeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string | undefined) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: XcodeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: XcodeItem): Thenable<XcodeItem[]> {
        if (!this.workspaceRoot) {
            return Promise.resolve([]);
        }

        try {
            if (element) {
                // Return element's children if any
                return Promise.resolve(element.children || []);
            } else {
                // Find Swift files
                return this.getSwiftFiles();
            }
        } catch (error) {
            const errorMessage = `Error retrieving Xcode files: ${error}`;
            vscode.window.showErrorMessage(errorMessage);
            console.error(errorMessage);
            return Promise.resolve([]);
        }
    }

    private async getSwiftFiles(): Promise<XcodeItem[]> {
        if (!this.workspaceRoot) {
            return [];
        }

        try {
            // Get exclude patterns from settings
            const config = vscode.workspace.getConfiguration('vscode-xcode-integration');
            const excludePatterns = config.get<string[]>('watchExclude', ['**/Pods/**', '**/Carthage/**', '**/DerivedData/**', '**/build/**']);
            const globExcludePattern = excludePatterns.join(',');
            // Find Swift files in the workspace, excluding certain directories
            const files = await vscode.workspace.findFiles(
                '**/*.{swift,h,m,mm,c,cpp}', 
                globExcludePattern
            );
            
            if (files.length === 0) {
                vscode.window.showInformationMessage('No Swift or Objective-C files found in the workspace');
                return [];
            }
            
            // Group files by directory
            const filesByDirectory = new Map<string, XcodeItem[]>();
            
            // Add each file to the appropriate directory
            for (const file of files) {
                const relativePath = path.relative(this.workspaceRoot, file.fsPath);
                const directory = path.dirname(relativePath);
                
                const fileItem = new XcodeItem(
                    path.basename(file.fsPath),
                    vscode.TreeItemCollapsibleState.None,
                    'file',
                    undefined,
                    file.fsPath
                );
                
                if (!filesByDirectory.has(directory)) {
                    filesByDirectory.set(directory, []);
                }
                
                filesByDirectory.get(directory)?.push(fileItem);
            }
            
            // Create directory structure
            const rootItems: XcodeItem[] = [];
            
            for (const [dirPath, children] of filesByDirectory) {
                if (dirPath === '.') {
                    // Files in root directory
                    rootItems.push(...children);
                } else {
                    // Create folder structure
                    const parts = dirPath.split(path.sep);
                    let currentItems = rootItems;
                    let currentPath = '';
                    
                    for (let i = 0; i < parts.length; i++) {
                        const part = parts[i];
                        currentPath = currentPath ? path.join(currentPath, part) : part;
                        
                        // Find or create folder item
                        let folderItem = currentItems.find(item => item.label === part && item.type === 'folder');
                        
                        if (!folderItem) {
                            folderItem = new XcodeItem(
                                part,
                                vscode.TreeItemCollapsibleState.Collapsed,
                                'folder',
                                [],
                                path.join(this.workspaceRoot, currentPath)
                            );
                            currentItems.push(folderItem);
                        }
                        
                        if (i === parts.length - 1) {
                            // Add children to the last folder
                            folderItem.children?.push(...children);
                        }
                        
                        currentItems = folderItem.children as XcodeItem[];
                    }
                }
            }
            
            return rootItems;
        } catch (error) {
            const errorMessage = `Error finding source files: ${error}`;
            vscode.window.showErrorMessage(errorMessage);
            console.error(errorMessage);
            return [];
        }
    }
}
