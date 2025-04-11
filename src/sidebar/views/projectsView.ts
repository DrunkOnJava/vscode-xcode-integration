import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProjectDetector, DetectedProject } from '../projectDetector';
import { getErrorHandler, ErrorCategory } from '../errorHandler';

/**
 * Tree item for the Xcode projects view
 */
export class ProjectViewItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly projectPath?: string,
        public readonly children?: ProjectViewItem[],
        public readonly projectType?: 'project' | 'workspace'
    ) {
        super(label, collapsibleState);
        
        // Set icon based on context value
        switch (contextValue) {
            case 'project':
                this.iconPath = new vscode.ThemeIcon('project');
                break;
            case 'workspace':
                this.iconPath = new vscode.ThemeIcon('layers');
                break;
            case 'target':
                this.iconPath = new vscode.ThemeIcon('package');
                break;
            case 'scheme':
                this.iconPath = new vscode.ThemeIcon('play');
                break;
            case 'dropzone':
                this.iconPath = new vscode.ThemeIcon('cloud-download');
                break;
            case 'add':
                this.iconPath = new vscode.ThemeIcon('add');
                break;
            case 'refresh':
                this.iconPath = new vscode.ThemeIcon('refresh');
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('circle-outline');
                break;
        }
        
        // Set tooltip
        if (projectPath) {
            this.tooltip = projectPath;
        }
        
        // Set command when clicking on a project
        if (contextValue === 'project' || contextValue === 'workspace') {
            this.command = {
                command: 'vscode-xcode-integration.openProject',
                title: 'Open in Xcode',
                arguments: [{ label: this.label, filePath: projectPath }]
            };
        }
    }
}

/**
 * Tree data provider for the projects view
 */
export class ProjectsViewProvider implements vscode.TreeDataProvider<ProjectViewItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProjectViewItem | undefined | null | void> = 
        new vscode.EventEmitter<ProjectViewItem | undefined | null | void>();
    
    readonly onDidChangeTreeData: vscode.Event<ProjectViewItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;
    
    private projects: DetectedProject[] = [];
    
    constructor(
        private projectDetector: ProjectDetector,
        private outputChannel: vscode.OutputChannel
    ) {
        // Initial project detection
        this.detectProjects();
    }
    
    /**
     * Refresh the tree view
     */
    public refresh(): void {
        this.detectProjects();
        this._onDidChangeTreeData.fire();
    }
    
    /**
     * Get the tree item for an element
     * @param element Element to get tree item for
     * @returns Tree item
     */
    public getTreeItem(element: ProjectViewItem): vscode.TreeItem {
        return element;
    }
    
    /**
     * Get children of an element
     * @param element Parent element or undefined for root
     * @returns Children of the element
     */
    public getChildren(element?: ProjectViewItem): Thenable<ProjectViewItem[]> {
        if (element) {
            // Return children if this element has any
            return Promise.resolve(element.children || []);
        } else {
            // Root level - show projects and action items
            return this.getRootItems();
        }
    }
    
    /**
     * Get items for the root level
     * @returns Root level items
     */
    private async getRootItems(): Promise<ProjectViewItem[]> {
        try {
            const items: ProjectViewItem[] = [];
            
            // Add a drop zone item
            const dropZone = new ProjectViewItem(
                'Drop Xcode Project or Workspace Here',
                vscode.TreeItemCollapsibleState.None,
                'dropzone'
            );
            dropZone.tooltip = 'Drag and drop .xcodeproj or .xcworkspace files here';
            items.push(dropZone);
            
            // Add detected projects
            for (const project of this.projects) {
                // Get project details
                const projectItem = await this.createProjectItem(project);
                items.push(projectItem);
            }
            
            // Add action items
            const addProject = new ProjectViewItem(
                'Add Project...',
                vscode.TreeItemCollapsibleState.None,
                'add'
            );
            addProject.command = {
                command: 'vscode-xcode-integration.addProject',
                title: 'Add Project'
            };
            
            const refreshProjects = new ProjectViewItem(
                'Refresh Projects',
                vscode.TreeItemCollapsibleState.None,
                'refresh'
            );
            refreshProjects.command = {
                command: 'vscode-xcode-integration.refreshProjects',
                title: 'Refresh Projects'
            };
            
            items.push(addProject);
            items.push(refreshProjects);
            
            return items;
        } catch (error) {
            getErrorHandler().handleError(error as Error, {
                category: ErrorCategory.General,
                operation: 'Getting project tree items'
            });
            return [];
        }
    }
    
    /**
     * Create a tree item for a project
     * @param project Project to create item for
     * @returns Project tree item
     */
    private async createProjectItem(project: DetectedProject): Promise<ProjectViewItem> {
        try {
            // Try to get project details if not loaded
            if (!project.targets || !project.schemes) {
                project = await this.projectDetector.refreshProjectDetails(project);
            }
            
            // Create child items based on project type
            const children: ProjectViewItem[] = [];
            
            if (project.isWorkspace) {
                // For workspaces, try to get referenced projects
                const projectPaths = await this.projectDetector.getWorkspaceProjects(project.path);
                
                if (projectPaths.length > 0) {
                    // Create items for referenced projects
                    for (const projectPath of projectPaths) {
                        if (fs.existsSync(projectPath)) {
                            const projectName = path.basename(projectPath, '.xcodeproj');
                            
                            // Create child item
                            const projectItem = new ProjectViewItem(
                                projectName,
                                vscode.TreeItemCollapsibleState.Collapsed,
                                'project',
                                projectPath,
                                [], // Children will be loaded on expansion
                                'project'
                            );
                            
                            children.push(projectItem);
                        }
                    }
                } else {
                    // No projects found
                    children.push(new ProjectViewItem(
                        'No projects found in workspace',
                        vscode.TreeItemCollapsibleState.None,
                        'info'
                    ));
                }
            } else {
                // For regular projects, show targets
                if (project.targets && project.targets.length > 0) {
                    // Create items for targets
                    for (const target of project.targets) {
                        // Find schemes for this target
                        const targetSchemes = (project.schemes || []).filter(scheme => 
                            scheme.toLowerCase().includes(target.toLowerCase()));
                        
                        // Create scheme items if any
                        const schemeItems: ProjectViewItem[] = targetSchemes.map(scheme => 
                            new ProjectViewItem(
                                scheme,
                                vscode.TreeItemCollapsibleState.None,
                                'scheme'
                            )
                        );
                        
                        // Create target item
                        const targetItem = new ProjectViewItem(
                            target,
                            schemeItems.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                            'target',
                            undefined,
                            schemeItems
                        );
                        
                        children.push(targetItem);
                    }
                } else {
                    // No targets found
                    children.push(new ProjectViewItem(
                        'No targets found',
                        vscode.TreeItemCollapsibleState.None,
                        'info'
                    ));
                }
            }
            
            // Create project item
            return new ProjectViewItem(
                project.name,
                vscode.TreeItemCollapsibleState.Collapsed,
                project.isWorkspace ? 'workspace' : 'project',
                project.path,
                children,
                project.isWorkspace ? 'workspace' : 'project'
            );
        } catch (error) {
            getErrorHandler().handleError(error as Error, {
                category: ErrorCategory.General,
                operation: 'Creating project item',
                projectName: project.name
            });
            
            // Return a simple item on error
            return new ProjectViewItem(
                project.name,
                vscode.TreeItemCollapsibleState.None,
                project.isWorkspace ? 'workspace' : 'project',
                project.path,
                [],
                project.isWorkspace ? 'workspace' : 'project'
            );
        }
    }
    
    /**
     * Detect projects in the workspace
     */
    private async detectProjects(): Promise<void> {
        try {
            this.projects = await this.projectDetector.detectProjects();
            this.outputChannel.appendLine(`Detected ${this.projects.length} Xcode projects`);
        } catch (error) {
            getErrorHandler().handleError(error as Error, {
                category: ErrorCategory.General,
                operation: 'Detecting projects'
            });
        }
    }
}
