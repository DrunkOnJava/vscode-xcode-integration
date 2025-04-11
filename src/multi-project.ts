import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as util from 'util';

// Promisify file system operations
// @ts-ignore - Used in other files or for future use
const readFile = util.promisify(fs.readFile);
// @ts-ignore - Used in other files or for future use
const writeFile = util.promisify(fs.writeFile);
// @ts-ignore - Used in other files or for future use
const mkdir = util.promisify(fs.mkdir);
// @ts-ignore - Used in other files or for future use
const exists = util.promisify(fs.exists);

// Types for Xcode workspace data
interface XcodeProject {
    path: string;
    name: string;
}

interface XcodeWorkspace {
    workspace: string;
    projects: XcodeProject[];
}

interface SchemeInfo {
    name: string;
    path: string;
    isShared: boolean;
    defaultTarget: string;
    defaultProject: string;
    buildConfiguration: string;
    testConfiguration: string;
    launchConfiguration: string;
    testTargets: string[];
}

interface ProjectDependency {
    path: string;
    dependencies: string[];
}

interface DependencyGraph {
    workspace: string;
    projectDependencies: { [projectName: string]: ProjectDependency };
}

/**
 * Multi-Project Manager for VSCode-Xcode Integration
 * Handles workspace detection, scheme management, and cross-project references
 */
export class MultiProjectManager {
    private workspaceDetectorPath: string;
    private crossRefManagerPath: string;
    private schemeManagerPath: string;
    private statusBarItem: vscode.StatusBarItem;
    private _currentWorkspace: XcodeWorkspace | undefined;
    private _workspaceSchemes: SchemeInfo[] = [];
    private _dependencyGraph: DependencyGraph | undefined;
    private _outputChannel: vscode.OutputChannel;

    constructor(context: vscode.ExtensionContext) {
        const extensionPath = context.extensionPath;
        
        // Set paths to script files
        this.workspaceDetectorPath = path.join(extensionPath, 'scripts', 'multi_project', 'workspace_detector.sh');
        this.crossRefManagerPath = path.join(extensionPath, 'scripts', 'multi_project', 'cross_reference_manager.sh');
        this.schemeManagerPath = path.join(extensionPath, 'scripts', 'multi_project', 'scheme_manager.sh');
        
        // Create output channel
        this._outputChannel = vscode.window.createOutputChannel('Xcode Multi-Project');
        
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'vscode-xcode-integration.selectWorkspaceScheme';
        this.statusBarItem.show();
        context.subscriptions.push(this.statusBarItem);
        
        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('vscode-xcode-integration.detectWorkspace', this.detectWorkspace, this),
            vscode.commands.registerCommand('vscode-xcode-integration.selectWorkspaceScheme', this.selectWorkspaceScheme, this),
            vscode.commands.registerCommand('vscode-xcode-integration.updateCrossReferences', this.updateCrossReferences, this),
            vscode.commands.registerCommand('vscode-xcode-integration.buildDependencyGraph', this.buildDependencyGraph, this),
            vscode.commands.registerCommand('vscode-xcode-integration.determineBuildOrder', this.determineBuildOrder, this)
        );
        
        // Initialize scripts
        this.initializeScripts();
        
        // Auto-detect workspace
        this.detectWorkspace();
    }
    
    /**
     * Ensure script files are executable
     */
    private async initializeScripts(): Promise<void> {
        try {
            await this.execCommand(`chmod +x "${this.workspaceDetectorPath}"`);
            await this.execCommand(`chmod +x "${this.crossRefManagerPath}"`);
            await this.execCommand(`chmod +x "${this.schemeManagerPath}"`);
            this.log('Multi-project scripts initialized');
        } catch (error) {
            this.logError('Failed to initialize scripts', error);
        }
    }
    
    /**
     * Execute shell command and return output
     */
    private async execCommand(command: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            cp.exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(`${error.message}\n${stderr}`);
                    return;
                }
                resolve(stdout.trim());
            });
        });
    }
    
    /**
     * Log message to output channel
     */
    private log(message: string): void {
        this._outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
    }
    
    /**
     * Log error message to output channel
     */
    private logError(message: string, error: any): void {
        this._outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ERROR: ${message}`);
        if (error) {
            this._outputChannel.appendLine(error.toString());
        }
    }
    
    /**
     * Update status bar with current workspace info
     */
    private updateStatusBar(): void {
        if (this._currentWorkspace) {
            const workspaceName = path.basename(this._currentWorkspace?.workspace || '', '.xcworkspace');
            const projectCount = this._currentWorkspace?.projects.length || 0;
            this.statusBarItem.text = `$(project) ${workspaceName} (${projectCount} projects)`;
            this.statusBarItem.tooltip = `Xcode Workspace: ${workspaceName}\nProjects: ${projectCount}\nClick to select scheme`;
            this.statusBarItem.show();
        } else {
            this.statusBarItem.text = '$(project) No Xcode Workspace';
            this.statusBarItem.tooltip = 'No Xcode workspace detected';
            this.statusBarItem.show();
        }
    }
    
    /**
     * Detect Xcode workspace in the current workspace
     */
    public async detectWorkspace(): Promise<void> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showWarningMessage('No workspace folder open');
                return;
            }
            
            const rootPath = workspaceFolders[0].uri.fsPath;
            this.log(`Searching for Xcode workspace in: ${rootPath}`);
            
            // Use workspace detector script to find workspace
            const workspacePathsOutput = await this.execCommand(`"${this.workspaceDetectorPath}" "${rootPath}"`);
            const workspacePaths = workspacePathsOutput.split('\n').filter(line => line.endsWith('.xcworkspace'));
            
            if (workspacePaths.length === 0) {
                vscode.window.showInformationMessage('No Xcode workspace found');
                this._currentWorkspace = undefined;
                this.updateStatusBar();
                return;
            }
            
            // If multiple workspaces found, let user select one
            let selectedWorkspacePath: string;
            if (workspacePaths.length === 1) {
                selectedWorkspacePath = workspacePaths[0];
            } else {
                const workspaceItems = workspacePaths.map(wp => ({
                    label: path.basename(wp),
                    description: wp,
                    path: wp
                }));
                
                const selected = await vscode.window.showQuickPick(workspaceItems, {
                    placeHolder: 'Select Xcode workspace'
                });
                
                if (!selected) {
                    return;
                }
                
                selectedWorkspacePath = selected.path;
            }
            
            // Parse workspace contents
            const workspaceContentsOutput = await this.execCommand(
                `"${this.workspaceDetectorPath}" "${selectedWorkspacePath}"`
            );
            
            try {
                const workspaceJson = JSON.parse(workspaceContentsOutput.substring(
                    workspaceContentsOutput.indexOf('{'),
                    workspaceContentsOutput.lastIndexOf('}') + 1
                ));
                
                this._currentWorkspace = workspaceJson;
                this.log(`Detected workspace: ${path.basename(this._currentWorkspace?.workspace || '')}`);
                this.log(`Found ${this._currentWorkspace?.projects.length || 0} projects in workspace`);
                
                // Update status bar
                this.updateStatusBar();
                
                // Load workspace schemes
                await this.loadWorkspaceSchemes();
                
                // Show success message
                vscode.window.showInformationMessage(
                    `Detected Xcode workspace: ${path.basename(this._currentWorkspace?.workspace || '')} ` +
                    `(${this._currentWorkspace?.projects.length || 0} projects)`
                );
            } catch (parseError) {
                this.logError('Failed to parse workspace data', parseError);
                vscode.window.showErrorMessage('Failed to parse workspace data');
            }
        } catch (error) {
            this.logError('Error detecting workspace', error);
            vscode.window.showErrorMessage('Error detecting Xcode workspace');
        }
    }
    
    /**
     * Load schemes from current workspace
     */
    private async loadWorkspaceSchemes(): Promise<void> {
        if (!this._currentWorkspace) {
            return;
        }
        
        try {
            this.log('Loading workspace schemes...');
            
            // Find all schemes in workspace
            const schemesOutput = await this.execCommand(
                `"${this.schemeManagerPath}" find "${this._currentWorkspace.workspace}"`
            );
            
            const schemePaths = schemesOutput.split('\n').filter(line => line.endsWith('.xcscheme'));
            this._workspaceSchemes = [];
            
            for (const schemePath of schemePaths) {
                try {
                    const schemeInfoOutput = await this.execCommand(
                        `"${this.schemeManagerPath}" parse "${schemePath}"`
                    );
                    
                    const schemeInfo = JSON.parse(schemeInfoOutput.substring(
                        schemeInfoOutput.indexOf('{'),
                        schemeInfoOutput.lastIndexOf('}') + 1
                    ));
                    
                    this._workspaceSchemes.push(schemeInfo);
                } catch (error) {
                    this.logError(`Error parsing scheme: ${schemePath}`, error);
                }
            }
            
            this.log(`Loaded ${this._workspaceSchemes.length} schemes from workspace`);
        } catch (error) {
            this.logError('Error loading workspace schemes', error);
        }
    }
    
    /**
     * Select a scheme from the current workspace
     */
    public async selectWorkspaceScheme(): Promise<SchemeInfo | undefined> {
        if (!this._currentWorkspace) {
            vscode.window.showWarningMessage('No Xcode workspace detected');
            return;
        }
        
        if (this._workspaceSchemes.length === 0) {
            await this.loadWorkspaceSchemes();
            
            if (this._workspaceSchemes.length === 0) {
                vscode.window.showWarningMessage('No schemes found in workspace');
                return;
            }
        }
        
        // Create quick pick items for schemes
        const schemeItems = this._workspaceSchemes.map(scheme => ({
            label: scheme.name,
            description: scheme.isShared ? 'Shared' : 'User',
            detail: `Target: ${scheme.defaultTarget} (${scheme.buildConfiguration})`,
            scheme: scheme
        }));
        
        // Show quick pick
        const selected = await vscode.window.showQuickPick(schemeItems, {
            placeHolder: 'Select Xcode scheme'
        });
        
        if (!selected) {
            return;
        }
        
        this.log(`Selected scheme: ${selected.scheme.name}`);
        return selected.scheme;
    }
    
    /**
     * Build dependency graph for current workspace
     */
    public async buildDependencyGraph(): Promise<void> {
        if (!this._currentWorkspace) {
            vscode.window.showWarningMessage('No Xcode workspace detected');
            return;
        }
        
        try {
            this.log('Building dependency graph...');
            
            const graphOutput = await this.execCommand(
                `"${this.crossRefManagerPath}" graph "${this._currentWorkspace.workspace}"`
            );
            
            try {
                const graphJson = JSON.parse(graphOutput.substring(
                    graphOutput.indexOf('{'),
                    graphOutput.lastIndexOf('}') + 1
                ));
                
                this._dependencyGraph = graphJson;
                this.log('Dependency graph built successfully');
                
                // Show dependency graph 
                this._outputChannel.show();
                this._outputChannel.appendLine('\n--- Dependency Graph ---');
                for (const projectName in this._dependencyGraph?.projectDependencies || {}) {
                    const projectDep = this._dependencyGraph?.projectDependencies?.[projectName];
                    if (projectDep) {
                        this._outputChannel.appendLine(`Project: ${projectName}`);
                        this._outputChannel.appendLine(`  Path: ${projectDep.path}`);
                        this._outputChannel.appendLine(`  Dependencies: ${projectDep.dependencies.join(', ') || 'none'}`);
                    }
                }
                this._outputChannel.appendLine('------------------------\n');
                
                vscode.window.showInformationMessage('Dependency graph built successfully');
            } catch (parseError) {
                this.logError('Failed to parse dependency graph', parseError);
                vscode.window.showErrorMessage('Failed to parse dependency graph');
            }
        } catch (error) {
            this.logError('Error building dependency graph', error);
            vscode.window.showErrorMessage('Error building dependency graph');
        }
    }
    
    /**
     * Determine build order for current workspace
     */
    public async determineBuildOrder(): Promise<string[] | undefined> {
        if (!this._currentWorkspace) {
            vscode.window.showWarningMessage('No Xcode workspace detected');
            return undefined;
        }
        
        // If we don't have a dependency graph yet, build it
        if (!this._dependencyGraph) {
            await this.buildDependencyGraph();
            
            if (!this._dependencyGraph) {
                return undefined;
            }
        }
        
        try {
            this.log('Determining build order...');
            
            const orderOutput = await this.execCommand(
                `"${this.crossRefManagerPath}" order "${this._currentWorkspace.workspace}"`
            );
            
            try {
                const buildOrder = JSON.parse(orderOutput.substring(
                    orderOutput.indexOf('['),
                    orderOutput.lastIndexOf(']') + 1
                ));
                
                this.log(`Determined build order: ${buildOrder.join(' → ')}`);
                
                // Show build order
                this._outputChannel.show();
                this._outputChannel.appendLine('\n--- Build Order ---');
                this._outputChannel.appendLine(buildOrder.join(' → '));
                this._outputChannel.appendLine('------------------\n');
                
                vscode.window.showInformationMessage(`Build order: ${buildOrder.join(' → ')}`);
                return buildOrder;
            } catch (parseError) {
                this.logError('Failed to parse build order', parseError);
                vscode.window.showErrorMessage('Failed to parse build order');
                return undefined;
            }
        } catch (error) {
            this.logError('Error determining build order', error);
            vscode.window.showErrorMessage('Error determining build order');
            return undefined;
        }
    }
    
    /**
     * Update cross-references in workspace projects
     */
    public async updateCrossReferences(): Promise<void> {
        if (!this._currentWorkspace) {
            vscode.window.showWarningMessage('No Xcode workspace detected');
            return;
        }
        
        try {
            this.log('Updating cross-references...');
            
            // Track success/failure for each project
            let successCount = 0;
            let failureCount = 0;
            
            for (const project of this._currentWorkspace.projects) {
                try {
                    await this.execCommand(
                        `"${this.crossRefManagerPath}" update "${this._currentWorkspace.workspace}" "${project.path}"`
                    );
                    
                    this.log(`Updated cross-references for: ${project.name}`);
                    successCount++;
                } catch (error) {
                    this.logError(`Failed to update cross-references for: ${project.name}`, error);
                    failureCount++;
                }
            }
            
            if (failureCount === 0) {
                vscode.window.showInformationMessage(`Updated cross-references for ${successCount} projects`);
            } else {
                vscode.window.showWarningMessage(
                    `Updated ${successCount} projects, ${failureCount} failed. See output for details.`
                );
                this._outputChannel.show();
            }
        } catch (error) {
            this.logError('Error updating cross-references', error);
            vscode.window.showErrorMessage('Error updating cross-references');
        }
    }
    
    /**
     * Get current workspace
     */
    public get currentWorkspace(): XcodeWorkspace | undefined {
        return this._currentWorkspace;
    }
    
    /**
     * Get workspace schemes
     */
    public get workspaceSchemes(): SchemeInfo[] {
        return this._workspaceSchemes;
    }
    
    /**
     * Get dependency graph
     */
    public get dependencyGraph(): DependencyGraph | undefined {
        return this._dependencyGraph;
    }
}