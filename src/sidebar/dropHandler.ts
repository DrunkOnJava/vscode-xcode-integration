import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProjectDetector, DetectedProject } from './ProjectDetector';

/**
 * Handles drag and drop operations for Xcode projects
 */
export class DropHandler {
    /**
     * Constructor
     * @param projectDetector Project detector instance
     * @param outputChannel Output channel for logging
     */
    constructor(
        private projectDetector: ProjectDetector,
        private outputChannel: vscode.OutputChannel
    ) {}
    
    /**
     * Register the drop handler for the project explorer view
     * @param context Extension context
     */
    public registerDropProvider(context: vscode.ExtensionContext): void {
        // Create a TreeDataProvider that can handle drops
        class XcodeProjectsProvider implements vscode.TreeDataProvider<any> {
            constructor(private dropHandler: DropHandler) {}
            
            getTreeItem(element: any): vscode.TreeItem {
                return element;
            }
            
            getChildren(element?: any): Thenable<any[]> {
                return Promise.resolve([]);
            }
        }
        
        // Create the data provider
        const dataProvider = new XcodeProjectsProvider(this);
        
        // Register the tree data provider
        vscode.window.createTreeView('xcode-projects', {
            treeDataProvider: dataProvider,
            canSelectMany: false,
            showCollapseAll: true,
            dragAndDropController: {
                dropMimeTypes: ['application/vnd.code.file-drop'],
                dragMimeTypes: [],
                handleDrop: async (target: any, sources: vscode.DataTransfer) => {
                    try {
                        // Process dropped files
                        const fileDrops = sources.get('application/vnd.code.file-drop');
                        if (fileDrops) {
                            const rawData = await fileDrops.asString();
                            const paths = JSON.parse(rawData);
                            
                            for (const droppedPath of paths) {
                                await this.processDroppedFile(droppedPath);
                            }
                        }
                    } catch (error) {
                        this.outputChannel.appendLine(`Error handling drop: ${error}`);
                        vscode.window.showErrorMessage(`Error handling drop: ${error}`);
                    }
                }
            }
        });
        
        // Register the command to manually add a project
        context.subscriptions.push(
            vscode.commands.registerCommand('vscode-xcode-integration.addProject', async () => {
                try {
                    // Show file picker to select a project
                    const files = await vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        openLabel: 'Select Xcode Project',
                        filters: {
                            'Xcode Projects': ['xcodeproj', 'xcworkspace']
                        }
                    });
                    
                    if (files && files.length > 0) {
                        // Process the selected project
                        await this.processDroppedFile(files[0].fsPath);
                    }
                } catch (error) {
                    this.outputChannel.appendLine(`Error adding project: ${error}`);
                    vscode.window.showErrorMessage(`Error adding project: ${error}`);
                }
            })
        );
    }
    
    /**
     * Process a dropped Xcode project or workspace file
     * @param filePath Path to the dropped file
     */
    public async processDroppedFile(filePath: string): Promise<void> {
        try {
            this.outputChannel.appendLine(`Processing dropped file: ${filePath}`);
            
            // Validate the file
            if (!await this.isValidXcodeProject(filePath)) {
                this.outputChannel.appendLine(`Invalid Xcode project: ${filePath}`);
                vscode.window.showErrorMessage(`${filePath} is not a valid Xcode project or workspace.`);
                return;
            }
            
            // Check if the file is already in the workspace
            if (await this.isProjectInWorkspace(filePath)) {
                this.outputChannel.appendLine(`Project already in workspace: ${filePath}`);
                vscode.window.showInformationMessage(`${path.basename(filePath)} is already in your workspace.`);
                return;
            }
            
            // Add the project to the workspace
            await this.addProjectToWorkspace(filePath);
            
            // Refresh the project list
            await this.projectDetector.detectProjects(true);
            
            vscode.window.showInformationMessage(`Added ${path.basename(filePath)} to the workspace.`);
        } catch (error) {
            this.outputChannel.appendLine(`Error processing dropped file: ${error}`);
            vscode.window.showErrorMessage(`Error processing dropped file: ${error}`);
        }
    }
    
    /**
     * Check if a file is a valid Xcode project or workspace
     * @param filePath Path to the file
     * @returns Promise resolving to true if the file is a valid Xcode project or workspace
     */
    private async isValidXcodeProject(filePath: string): Promise<boolean> {
        try {
            // Check if the file exists
            if (!await this.pathExists(filePath)) {
                return false;
            }
            
            // Check if the file is a directory (Xcode projects and workspaces are directories)
            const stats = await fs.promises.stat(filePath);
            if (!stats.isDirectory()) {
                return false;
            }
            
            // Check if the file has a .xcodeproj or .xcworkspace extension
            const ext = path.extname(filePath).toLowerCase();
            if (ext !== '.xcodeproj' && ext !== '.xcworkspace') {
                return false;
            }
            
            // For .xcodeproj, check if project.pbxproj exists
            if (ext === '.xcodeproj') {
                const pbxprojPath = path.join(filePath, 'project.pbxproj');
                return await this.pathExists(pbxprojPath);
            }
            
            // For .xcworkspace, check if contents.xcworkspacedata exists
            if (ext === '.xcworkspace') {
                const workspaceDataPath = path.join(filePath, 'contents.xcworkspacedata');
                return await this.pathExists(workspaceDataPath);
            }
            
            return false;
        } catch (error) {
            this.outputChannel.appendLine(`Error validating Xcode project: ${error}`);
            return false;
        }
    }
    
    /**
     * Check if a project is already in the workspace
     * @param filePath Path to the project
     * @returns Promise resolving to true if the project is already in the workspace
     */
    private async isProjectInWorkspace(filePath: string): Promise<boolean> {
        try {
            // Get all projects in the workspace
            const projects = await this.projectDetector.detectProjects();
            
            // Check if the project is already in the list
            return projects.some(project => {
                return project.path === filePath || 
                      (project.isWorkspace && project.includedProjects?.some(p => p.path === filePath));
            });
        } catch (error) {
            this.outputChannel.appendLine(`Error checking if project is in workspace: ${error}`);
            return false;
        }
    }
    
    /**
     * Add a project to the workspace
     * @param filePath Path to the project
     */
    private async addProjectToWorkspace(filePath: string): Promise<void> {
        try {
            // Get the current workspace folders
            const workspaceFolders = vscode.workspace.workspaceFolders || [];
            
            // If the project is not in a workspace folder, add it
            const projectDir = path.dirname(filePath);
            const isInWorkspace = workspaceFolders.some(folder => {
                return projectDir.startsWith(folder.uri.fsPath);
            });
            
            if (!isInWorkspace) {
                // Add the project directory to the workspace
                const projectUri = vscode.Uri.file(projectDir);
                vscode.workspace.updateWorkspaceFolders(workspaceFolders.length, 0, { uri: projectUri });
                
                this.outputChannel.appendLine(`Added ${projectDir} to the workspace`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`Error adding project to workspace: ${error}`);
            throw error;
        }
    }
    
    /**
     * Check if a path exists
     * @param filePath The path to check
     * @returns Promise resolving to true if the path exists
     */
    private async pathExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}
