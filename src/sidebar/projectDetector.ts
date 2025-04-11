import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as util from 'util';

/**
 * Interface representing a detected Xcode project
 */
export interface DetectedProject {
    /**
     * Project name
     */
    name: string;
    
    /**
     * Absolute path to the project
     */
    path: string;
    
    /**
     * Project type (xcodeproj or xcworkspace)
     */
    type: 'xcodeproj' | 'xcworkspace';
    
    /**
     * Last modified date
     */
    lastModified: Date;
    
    /**
     * Array of target names (if available)
     */
    targets?: string[];
    
    /**
     * Array of scheme names (if available)
     */
    schemes?: string[];
    
    /**
     * Whether this is a workspace
     */
    isWorkspace: boolean;
    
    /**
     * For workspaces, the list of included projects
     */
    includedProjects?: DetectedProject[];
}

/**
 * Error categories for project detection
 */
export enum ErrorCategory {
    General = 'general',
    FileSystem = 'filesystem',
    Configuration = 'configuration',
    Process = 'process'
}

/**
 * Class for detecting and managing Xcode projects
 */
export class ProjectDetector {
    /**
     * Cache of detected projects by workspace folder path
     */
    private cachedProjects: Map<string, DetectedProject[]> = new Map();
    
    /**
     * Cache expiry timestamps by workspace folder path
     */
    private cacheExpiry: Map<string, number> = new Map();
    
    /**
     * Time-to-live for cached projects (1 minute)
     */
    private readonly cacheTTL = 60000;
    
    /**
     * Constructor
     * @param outputChannel Output channel for logging
     */
    constructor(private outputChannel: vscode.OutputChannel) {}
    
    /**
     * Detect all Xcode projects in the current workspace
     * @param forceRefresh Whether to force a refresh of the cache
     * @returns Promise resolving to an array of detected projects
     */
    public async detectProjects(forceRefresh = false): Promise<DetectedProject[]> {
        try {
            // Check workspace folders
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return [];
            }
            
            let allProjects: DetectedProject[] = [];
            
            for (const folder of workspaceFolders) {
                const folderPath = folder.uri.fsPath;
                
                // Check cache unless force refresh requested
                if (!forceRefresh && this.cachedProjects.has(folderPath)) {
                    const expiry = this.cacheExpiry.get(folderPath) || 0;
                    if (Date.now() < expiry) {
                        allProjects = allProjects.concat(this.cachedProjects.get(folderPath) || []);
                        continue;
                    }
                }
                
                // Detect projects in this folder
                const projects = await this.findProjectsInDirectory(folderPath);
                
                // Update cache
                this.cachedProjects.set(folderPath, projects);
                this.cacheExpiry.set(folderPath, Date.now() + this.cacheTTL);
                
                allProjects = allProjects.concat(projects);
            }
            
            return allProjects;
        } catch (error) {
            this.handleError(error as Error, {
                category: ErrorCategory.General,
                operation: 'Detecting Xcode projects'
            });
            return [];
        }
    }
    
    /**
     * Find Xcode projects in a specific directory
     * @param directory The directory to search
     * @returns Promise resolving to an array of detected projects
     */
    public async findProjectsInDirectory(directory: string): Promise<DetectedProject[]> {
        try {
            this.outputChannel.appendLine(`Searching for Xcode projects in ${directory}`);
            
            // Use find command for better performance
            const xcodeprojs = await this.runFindCommand(directory, '*.xcodeproj');
            const xcworkspaces = await this.runFindCommand(directory, '*.xcworkspace');
            
            const projects: DetectedProject[] = [];
            
            // Process .xcodeproj files
            for (const projectPath of xcodeprojs) {
                try {
                    const stats = await fs.promises.stat(projectPath);
                    const project: DetectedProject = {
                        name: path.basename(projectPath),
                        path: projectPath,
                        type: 'xcodeproj',
                        lastModified: stats.mtime,
                        isWorkspace: false
                    };
                    
                    projects.push(project);
                } catch (err) {
                    this.outputChannel.appendLine(`Error processing project ${projectPath}: ${err}`);
                }
            }
            
            // Process .xcworkspace files
            for (const workspacePath of xcworkspaces) {
                try {
                    const stats = await fs.promises.stat(workspacePath);
                    const workspace: DetectedProject = {
                        name: path.basename(workspacePath),
                        path: workspacePath,
                        type: 'xcworkspace',
                        lastModified: stats.mtime,
                        isWorkspace: true
                    };
                    
                    projects.push(workspace);
                } catch (err) {
                    this.outputChannel.appendLine(`Error processing workspace ${workspacePath}: ${err}`);
                }
            }
            
            return projects;
        } catch (error) {
            this.handleError(error as Error, {
                category: ErrorCategory.FileSystem,
                operation: 'Finding projects in directory'
            });
            return [];
        }
    }
    
    /**
     * Refresh project details like targets and schemes
     * @param project The project to refresh
     * @returns Promise resolving to the updated project
     */
    public async refreshProjectDetails(project: DetectedProject): Promise<DetectedProject> {
        try {
            // Clone the project to avoid modifying the original
            const updatedProject = { ...project };
            
            // Get targets
            updatedProject.targets = await this.getProjectTargets(project.path);
            
            // Get schemes
            updatedProject.schemes = await this.getProjectSchemes(project.path);
            
            // If this is a workspace, get the included projects
            if (project.isWorkspace) {
                updatedProject.includedProjects = await this.getWorkspaceProjects(project.path);
            }
            
            return updatedProject;
        } catch (error) {
            this.handleError(error as Error, {
                category: ErrorCategory.Process,
                operation: 'Refreshing project details'
            });
            return project;
        }
    }
    
    /**
     * Get targets for a project
     * @param projectPath Path to the Xcode project
     * @returns Promise resolving to an array of target names
     */
    private async getProjectTargets(projectPath: string): Promise<string[]> {
        try {
            // Use xcodebuild to list targets
            const isWorkspace = projectPath.endsWith('.xcworkspace');
            const flag = isWorkspace ? '-workspace' : '-project';
            
            const command = `xcodebuild ${flag} "${projectPath}" -list`;
            const result = await this.runCommand(command);
            
            // Parse the output to extract targets
            const targets: string[] = [];
            let inTargetsSection = false;
            
            for (const line of result.split('\n')) {
                const trimmedLine = line.trim();
                
                if (trimmedLine === 'Targets:') {
                    inTargetsSection = true;
                    continue;
                }
                
                if (inTargetsSection) {
                    if (trimmedLine === '' || trimmedLine.startsWith('Build ') || trimmedLine === 'Schemes:') {
                        inTargetsSection = false;
                        continue;
                    }
                    
                    targets.push(trimmedLine);
                }
            }
            
            return targets;
        } catch (error) {
            this.outputChannel.appendLine(`Error getting targets for ${projectPath}: ${error}`);
            return [];
        }
    }
    
    /**
     * Get schemes for a project
     * @param projectPath Path to the Xcode project
     * @returns Promise resolving to an array of scheme names
     */
    private async getProjectSchemes(projectPath: string): Promise<string[]> {
        try {
            // Use xcodebuild to list schemes
            const isWorkspace = projectPath.endsWith('.xcworkspace');
            const flag = isWorkspace ? '-workspace' : '-project';
            
            const command = `xcodebuild ${flag} "${projectPath}" -list`;
            const result = await this.runCommand(command);
            
            // Parse the output to extract schemes
            const schemes: string[] = [];
            let inSchemesSection = false;
            
            for (const line of result.split('\n')) {
                const trimmedLine = line.trim();
                
                if (trimmedLine === 'Schemes:') {
                    inSchemesSection = true;
                    continue;
                }
                
                if (inSchemesSection) {
                    if (trimmedLine === '') {
                        inSchemesSection = false;
                        continue;
                    }
                    
                    schemes.push(trimmedLine);
                }
            }
            
            return schemes;
        } catch (error) {
            this.outputChannel.appendLine(`Error getting schemes for ${projectPath}: ${error}`);
            return [];
        }
    }
    
    /**
     * Get projects included in a workspace
     * @param workspacePath Path to the Xcode workspace
     * @returns Promise resolving to an array of included projects
     */
    private async getWorkspaceProjects(workspacePath: string): Promise<DetectedProject[]> {
        try {
            // Check if the workspace is valid
            if (!workspacePath.endsWith('.xcworkspace') || !await this.pathExists(workspacePath)) {
                return [];
            }
            
            // Path to the workspace contents file
            const contentsPath = path.join(workspacePath, 'contents.xcworkspacedata');
            if (!await this.pathExists(contentsPath)) {
                return [];
            }
            
            // Read the contents file
            const contents = await fs.promises.readFile(contentsPath, 'utf8');
            
            // Extract project references using regex
            const projectRefs: string[] = [];
            const regex = /location\s*=\s*["']group:(.+?)["']/g;
            let match;
            
            while ((match = regex.exec(contents)) !== null) {
                const relativePath = match[1];
                if (relativePath.endsWith('.xcodeproj')) {
                    projectRefs.push(relativePath);
                }
            }
            
            // Convert relative paths to absolute paths
            const workspaceDir = path.dirname(workspacePath);
            const projects: DetectedProject[] = [];
            
            for (const relativePath of projectRefs) {
                const projectPath = path.resolve(workspaceDir, relativePath);
                
                if (await this.pathExists(projectPath)) {
                    const stats = await fs.promises.stat(projectPath);
                    
                    projects.push({
                        name: path.basename(projectPath),
                        path: projectPath,
                        type: 'xcodeproj',
                        lastModified: stats.mtime,
                        isWorkspace: false
                    });
                }
            }
            
            return projects;
        } catch (error) {
            this.outputChannel.appendLine(`Error getting projects in workspace ${workspacePath}: ${error}`);
            return [];
        }
    }
    
    /**
     * Run a command and return its output
     * @param command The command to run
     * @returns Promise resolving to the command output
     */
    private async runCommand(command: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            cp.exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Command failed: ${error.message}\n${stderr}`));
                    return;
                }
                
                resolve(stdout);
            });
        });
    }
    
    /**
     * Run the find command to search for files
     * @param directory The directory to search
     * @param pattern The file pattern to search for
     * @returns Promise resolving to an array of file paths
     */
    private async runFindCommand(directory: string, pattern: string): Promise<string[]> {
        try {
            const command = `find "${directory}" -name "${pattern}" -type d -not -path "*/\\.*" -not -path "*/build/*" -not -path "*/DerivedData/*"`;
            const output = await this.runCommand(command);
            
            return output.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
        } catch (error) {
            this.outputChannel.appendLine(`Error running find command: ${error}`);
            return [];
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
    
    /**
     * Handle an error
     * @param error The error to handle
     * @param options Additional error handling options
     */
    private handleError(error: Error, options: { category: ErrorCategory, operation: string }): void {
        this.outputChannel.appendLine(`[${options.category}] Error during ${options.operation}: ${error.message}`);
        
        if (error.stack) {
            this.outputChannel.appendLine(error.stack);
        }
    }
}
