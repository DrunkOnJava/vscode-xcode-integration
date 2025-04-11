import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import { DetectedProject } from './ProjectDetector';

/**
 * Build configuration for Xcode projects
 */
export interface BuildConfiguration {
    /**
     * Configuration name (Debug, Release, etc.)
     */
    configuration: string;
    
    /**
     * SDK to build for (iphoneos, iphonesimulator, macosx, etc.)
     */
    sdk?: string;
    
    /**
     * Destination to build for (platform=iOS Simulator,name=iPhone 14, etc.)
     */
    destination?: string;
    
    /**
     * Additional build settings
     */
    buildSettings?: { [key: string]: string };
    
    /**
     * Additional build arguments
     */
    additionalArgs?: string[];
}

/**
 * Build result
 */
export interface BuildResult {
    /**
     * Whether the build was successful
     */
    success: boolean;
    
    /**
     * Build output
     */
    output: string;
    
    /**
     * Error message if the build failed
     */
    error?: string;
    
    /**
     * Duration of the build in milliseconds
     */
    duration: number;
}

/**
 * Manages build operations for Xcode projects
 */
export class BuildManager {
    /**
     * Terminal for running builds
     */
    private terminal: vscode.Terminal | undefined;
    
    /**
     * Whether a build is in progress
     */
    private buildInProgress: boolean = false;
    
    /**
     * Constructor
     * @param context Extension context
     * @param outputChannel Output channel for logging
     */
    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {
        this.registerCommands();
    }
    
    /**
     * Register build-related commands
     */
    private registerCommands(): void {
        // Build project
        this.context.subscriptions.push(
            vscode.commands.registerCommand('vscode-xcode-integration.buildProject', async () => {
                await this.buildProject();
            })
        );
        
        // Build scheme
        this.context.subscriptions.push(
            vscode.commands.registerCommand('vscode-xcode-integration.buildScheme', async (scheme: string) => {
                await this.buildScheme(scheme);
            })
        );
        
        // Clean project
        this.context.subscriptions.push(
            vscode.commands.registerCommand('vscode-xcode-integration.cleanProject', async () => {
                await this.cleanProject();
            })
        );
        
        // Run project
        this.context.subscriptions.push(
            vscode.commands.registerCommand('vscode-xcode-integration.runProject', async () => {
                await this.runProject();
            })
        );
        
        // Run scheme
        this.context.subscriptions.push(
            vscode.commands.registerCommand('vscode-xcode-integration.runScheme', async (scheme: string) => {
                await this.runScheme(scheme);
            })
        );
        
        // Run tests
        this.context.subscriptions.push(
            vscode.commands.registerCommand('vscode-xcode-integration.runTests', async () => {
                await this.runTests();
            })
        );
    }
    
    /**
     * Build the active Xcode project
     * @returns Promise resolving when the build is complete
     */
    public async buildProject(): Promise<void> {
        if (this.buildInProgress) {
            vscode.window.showInformationMessage('A build is already in progress');
            return;
        }
        
        this.outputChannel.appendLine('Building project...');
        
        try {
            // Get the active project
            const project = await this.getActiveProject();
            if (!project) {
                vscode.window.showErrorMessage('No Xcode project found in the workspace');
                return;
            }
            
            // Get the build configuration
            const config = await this.getBuildConfiguration();
            if (!config) {
                // User cancelled
                return;
            }
            
            // Create a terminal for building
            this.ensureTerminal('Xcode Build');
            
            // Build the project
            this.buildInProgress = true;
            
            // Create the build command
            const buildCommand = this.createBuildCommand(project, undefined, config);
            
            // Execute the build
            this.terminal!.sendText(buildCommand);
            this.terminal!.show();
            
            vscode.window.showInformationMessage(`Building ${project.name} (${config.configuration})...`);
        } catch (error) {
            this.outputChannel.appendLine(`Error building project: ${error}`);
            vscode.window.showErrorMessage(`Error building project: ${error}`);
        } finally {
            this.buildInProgress = false;
        }
    }
    
    /**
     * Build a specific scheme
     * @param scheme The scheme to build
     * @returns Promise resolving when the build is complete
     */
    public async buildScheme(scheme: string): Promise<void> {
        if (this.buildInProgress) {
            vscode.window.showInformationMessage('A build is already in progress');
            return;
        }
        
        this.outputChannel.appendLine(`Building scheme ${scheme}...`);
        
        try {
            // Get the active project
            const project = await this.getActiveProject();
            if (!project) {
                vscode.window.showErrorMessage('No Xcode project found in the workspace');
                return;
            }
            
            // Get the build configuration
            const config = await this.getBuildConfiguration();
            if (!config) {
                // User cancelled
                return;
            }
            
            // Create a terminal for building
            this.ensureTerminal('Xcode Build');
            
            // Build the scheme
            this.buildInProgress = true;
            
            // Create the build command
            const buildCommand = this.createBuildCommand(project, scheme, config);
            
            // Execute the build
            this.terminal!.sendText(buildCommand);
            this.terminal!.show();
            
            vscode.window.showInformationMessage(`Building scheme ${scheme} (${config.configuration})...`);
        } catch (error) {
            this.outputChannel.appendLine(`Error building scheme: ${error}`);
            vscode.window.showErrorMessage(`Error building scheme: ${error}`);
        } finally {
            this.buildInProgress = false;
        }
    }
    
    /**
     * Clean the active Xcode project
     * @returns Promise resolving when the clean is complete
     */
    public async cleanProject(): Promise<void> {
        if (this.buildInProgress) {
            vscode.window.showInformationMessage('A build is already in progress');
            return;
        }
        
        this.outputChannel.appendLine('Cleaning project...');
        
        try {
            // Get the active project
            const project = await this.getActiveProject();
            if (!project) {
                vscode.window.showErrorMessage('No Xcode project found in the workspace');
                return;
            }
            
            // Create a terminal for cleaning
            this.ensureTerminal('Xcode Clean');
            
            // Clean the project
            this.buildInProgress = true;
            
            // Create the clean command
            const cleanCommand = this.createCleanCommand(project);
            
            // Execute the clean
            this.terminal!.sendText(cleanCommand);
            this.terminal!.show();
            
            vscode.window.showInformationMessage(`Cleaning ${project.name}...`);
        } catch (error) {
            this.outputChannel.appendLine(`Error cleaning project: ${error}`);
            vscode.window.showErrorMessage(`Error cleaning project: ${error}`);
        } finally {
            this.buildInProgress = false;
        }
    }
    
    /**
     * Run the active Xcode project
     * @returns Promise resolving when the run is complete
     */
    public async runProject(): Promise<void> {
        if (this.buildInProgress) {
            vscode.window.showInformationMessage('A build is already in progress');
            return;
        }
        
        this.outputChannel.appendLine('Running project...');
        
        try {
            // Get the active project
            const project = await this.getActiveProject();
            if (!project) {
                vscode.window.showErrorMessage('No Xcode project found in the workspace');
                return;
            }
            
            // Get a scheme to run
            const scheme = await this.promptForScheme(project);
            if (!scheme) {
                // User cancelled
                return;
            }
            
            // Run the scheme
            await this.runScheme(scheme);
        } catch (error) {
            this.outputChannel.appendLine(`Error running project: ${error}`);
            vscode.window.showErrorMessage(`Error running project: ${error}`);
        }
    }
    
    /**
     * Run a specific scheme
     * @param scheme The scheme to run
     * @returns Promise resolving when the run is complete
     */
    public async runScheme(scheme: string): Promise<void> {
        if (this.buildInProgress) {
            vscode.window.showInformationMessage('A build is already in progress');
            return;
        }
        
        this.outputChannel.appendLine(`Running scheme ${scheme}...`);
        
        try {
            // Get the active project
            const project = await this.getActiveProject();
            if (!project) {
                vscode.window.showErrorMessage('No Xcode project found in the workspace');
                return;
            }
            
            // Get the build configuration
            const config = await this.getBuildConfiguration();
            if (!config) {
                // User cancelled
                return;
            }
            
            // Create a terminal for running
            this.ensureTerminal('Xcode Run');
            
            // Run the scheme
            this.buildInProgress = true;
            
            // Create the run command
            const runCommand = this.createRunCommand(project, scheme, config);
            
            // Execute the run
            this.terminal!.sendText(runCommand);
            this.terminal!.show();
            
            vscode.window.showInformationMessage(`Running scheme ${scheme} (${config.configuration})...`);
        } catch (error) {
            this.outputChannel.appendLine(`Error running scheme: ${error}`);
            vscode.window.showErrorMessage(`Error running scheme: ${error}`);
        } finally {
            this.buildInProgress = false;
        }
    }
    
    /**
     * Run tests for the active Xcode project
     * @returns Promise resolving when the tests are complete
     */
    public async runTests(): Promise<void> {
        if (this.buildInProgress) {
            vscode.window.showInformationMessage('A build is already in progress');
            return;
        }
        
        this.outputChannel.appendLine('Running tests...');
        
        try {
            // Get the active project
            const project = await this.getActiveProject();
            if (!project) {
                vscode.window.showErrorMessage('No Xcode project found in the workspace');
                return;
            }
            
            // Get a scheme for testing
            const scheme = await this.promptForScheme(project);
            if (!scheme) {
                // User cancelled
                return;
            }
            
            // Create a terminal for testing
            this.ensureTerminal('Xcode Tests');
            
            // Run the tests
            this.buildInProgress = true;
            
            // Create the test command
            const testCommand = this.createTestCommand(project, scheme);
            
            // Execute the tests
            this.terminal!.sendText(testCommand);
            this.terminal!.show();
            
            vscode.window.showInformationMessage(`Running tests for scheme ${scheme}...`);
        } catch (error) {
            this.outputChannel.appendLine(`Error running tests: ${error}`);
            vscode.window.showErrorMessage(`Error running tests: ${error}`);
        } finally {
            this.buildInProgress = false;
        }
    }
    
    /**
     * Get the active Xcode project
     * @returns Promise resolving to the active project or undefined if not found
     */
    private async getActiveProject(): Promise<DetectedProject | undefined> {
        try {
            // Get the active project from the workspace state
            const activeProjectPath = this.context.workspaceState.get<string>('xcode-integration.activeProject');
            
            if (activeProjectPath) {
                // Try to get the project by path
                const projects = await vscode.commands.executeCommand<DetectedProject[]>('vscode-xcode-integration.getProjects');
                if (projects && projects.length > 0) {
                    const activeProject = projects.find(p => p.path === activeProjectPath);
                    if (activeProject) {
                        return activeProject;
                    }
                }
            }
            
            // If no active project, prompt the user to select one
            return this.promptForProject();
        } catch (error) {
            this.outputChannel.appendLine(`Error getting active project: ${error}`);
            throw error;
        }
    }
    
    /**
     * Prompt the user to select a project
     * @returns Promise resolving to the selected project or undefined if cancelled
     */
    private async promptForProject(): Promise<DetectedProject | undefined> {
        try {
            // Get all projects
            const projects = await vscode.commands.executeCommand<DetectedProject[]>('vscode-xcode-integration.getProjects');
            
            if (!projects || projects.length === 0) {
                vscode.window.showErrorMessage('No Xcode projects found in the workspace');
                return undefined;
            }
            
            // If only one project, use it automatically
            if (projects.length === 1) {
                return projects[0];
            }
            
            // Prompt the user to select a project
            const projectItems = projects.map(p => ({
                label: p.name,
                description: path.relative(vscode.workspace.workspaceFolders![0].uri.fsPath, p.path),
                project: p
            }));
            
            const selected = await vscode.window.showQuickPick(projectItems, {
                placeHolder: 'Select a project',
                ignoreFocusOut: true
            });
            
            if (!selected) {
                return undefined;
            }
            
            // Save the selected project as the active project
            this.context.workspaceState.update('xcode-integration.activeProject', selected.project.path);
            
            return selected.project;
        } catch (error) {
            this.outputChannel.appendLine(`Error prompting for project: ${error}`);
            throw error;
        }
    }
    
    /**
     * Prompt the user to select a scheme
     * @param project The project to get schemes from
     * @returns Promise resolving to the selected scheme or undefined if cancelled
     */
    private async promptForScheme(project: DetectedProject): Promise<string | undefined> {
        try {
            // Make sure the project has schemes
            if (!project.schemes || project.schemes.length === 0) {
                // Try to refresh the project details
                try {
                    const updatedProject = await vscode.commands.executeCommand<DetectedProject>(
                        'vscode-xcode-integration.refreshProjectDetails',
                        project
                    );
                    
                    if (updatedProject) {
                        project = updatedProject;
                    }
                } catch (err) {
                    this.outputChannel.appendLine(`Error refreshing project details: ${err}`);
                }
                
                if (!project.schemes || project.schemes.length === 0) {
                    vscode.window.showErrorMessage(`No schemes found for ${project.name}`);
                    return undefined;
                }
            }
            
            // If only one scheme, use it automatically
            if (project.schemes.length === 1) {
                return project.schemes[0];
            }
            
            // Prompt the user to select a scheme
            const selected = await vscode.window.showQuickPick(project.schemes, {
                placeHolder: 'Select a scheme',
                ignoreFocusOut: true
            });
            
            return selected;
        } catch (error) {
            this.outputChannel.appendLine(`Error prompting for scheme: ${error}`);
            throw error;
        }
    }
    
    /**
     * Get a build configuration
     * @returns Promise resolving to the build configuration or undefined if cancelled
     */
    private async getBuildConfiguration(): Promise<BuildConfiguration | undefined> {
        try {
            // Get the default configuration from settings
            const config = vscode.workspace.getConfiguration('vscode-xcode-integration.build');
            const defaultConfiguration = config.get<string>('defaultConfiguration', 'Debug');
            
            // Prompt the user to select a configuration
            const configItems = [
                { label: 'Debug', description: 'Build for debugging' },
                { label: 'Release', description: 'Build for release' }
            ];
            
            const selectedConfig = await vscode.window.showQuickPick(configItems, {
                placeHolder: 'Select a build configuration',
                ignoreFocusOut: true
            });
            
            if (!selectedConfig) {
                return undefined;
            }
            
            // Create the build configuration
            const buildConfig: BuildConfiguration = {
                configuration: selectedConfig.label
            };
            
            // Get the SDK if specified
            const sdk = config.get<string>('sdk');
            if (sdk) {
                buildConfig.sdk = sdk;
            }
            
            // Get the destination if specified
            const destination = config.get<string>('destination');
            if (destination) {
                buildConfig.destination = destination;
            }
            
            // Get the build settings if specified
            const buildSettings = config.get<{ [key: string]: string }>('buildSettings');
            if (buildSettings) {
                buildConfig.buildSettings = buildSettings;
            }
            
            // Get the additional arguments if specified
            const additionalArgs = config.get<string[]>('additionalArgs');
            if (additionalArgs) {
                buildConfig.additionalArgs = additionalArgs;
            }
            
            return buildConfig;
        } catch (error) {
            this.outputChannel.appendLine(`Error getting build configuration: ${error}`);
            throw error;
        }
    }
    
    /**
     * Create a build command for the specified project and scheme
     * @param project The project to build
     * @param scheme The scheme to build (optional)
     * @param config The build configuration
     * @returns The build command
     */
    private createBuildCommand(
        project: DetectedProject,
        scheme?: string,
        config?: BuildConfiguration
    ): string {
        // Create the base command
        let command = 'cd "' + path.dirname(project.path) + '" && xcodebuild';
        
        // Add the project or workspace flag
        if (project.isWorkspace) {
            command += ' -workspace "' + path.basename(project.path) + '"';
        } else {
            command += ' -project "' + path.basename(project.path) + '"';
        }
        
        // Add the scheme if specified
        if (scheme) {
            command += ' -scheme "' + scheme + '"';
        }
        
        // Add the configuration if specified
        if (config?.configuration) {
            command += ' -configuration "' + config.configuration + '"';
        }
        
        // Add the SDK if specified
        if (config?.sdk) {
            command += ' -sdk ' + config.sdk;
        }
        
        // Add the destination if specified
        if (config?.destination) {
            command += ' -destination "' + config.destination + '"';
        }
        
        // Add build settings if specified
        if (config?.buildSettings) {
            for (const [key, value] of Object.entries(config.buildSettings)) {
                command += ' ' + key + '=' + value;
            }
        }
        
        // Add additional arguments if specified
        if (config?.additionalArgs) {
            command += ' ' + config.additionalArgs.join(' ');
        }
        
        // Add the build action
        command += ' build';
        
        return command;
    }
    
    /**
     * Create a clean command for the specified project
     * @param project The project to clean
     * @returns The clean command
     */
    private createCleanCommand(project: DetectedProject): string {
        // Create the base command
        let command = 'cd "' + path.dirname(project.path) + '" && xcodebuild';
        
        // Add the project or workspace flag
        if (project.isWorkspace) {
            command += ' -workspace "' + path.basename(project.path) + '"';
        } else {
            command += ' -project "' + path.basename(project.path) + '"';
        }
        
        // Add the clean action
        command += ' clean';
        
        return command;
    }
    
    /**
     * Create a run command for the specified project and scheme
     * @param project The project to run
     * @param scheme The scheme to run
     * @param config The build configuration
     * @returns The run command
     */
    private createRunCommand(
        project: DetectedProject,
        scheme: string,
        config: BuildConfiguration
    ): string {
        // Create the base command
        let command = 'cd "' + path.dirname(project.path) + '" && xcodebuild';
        
        // Add the project or workspace flag
        if (project.isWorkspace) {
            command += ' -workspace "' + path.basename(project.path) + '"';
        } else {
            command += ' -project "' + path.basename(project.path) + '"';
        }
        
        // Add the scheme
        command += ' -scheme "' + scheme + '"';
        
        // Add the configuration if specified
        if (config.configuration) {
            command += ' -configuration "' + config.configuration + '"';
        }
        
        // Add the SDK if specified
        if (config.sdk) {
            command += ' -sdk ' + config.sdk;
        }
        
        // Add the destination if specified
        if (config.destination) {
            command += ' -destination "' + config.destination + '"';
        }
        
        // Add build settings if specified
        if (config.buildSettings) {
            for (const [key, value] of Object.entries(config.buildSettings)) {
                command += ' ' + key + '=' + value;
            }
        }
        
        // Add additional arguments if specified
        if (config.additionalArgs) {
            command += ' ' + config.additionalArgs.join(' ');
        }
        
        // Add the run action
        command += ' build run';
        
        return command;
    }
    
    /**
     * Create a test command for the specified project and scheme
     * @param project The project to test
     * @param scheme The scheme to test
     * @returns The test command
     */
    private createTestCommand(project: DetectedProject, scheme: string): string {
        // Create the base command
        let command = 'cd "' + path.dirname(project.path) + '" && xcodebuild';
        
        // Add the project or workspace flag
        if (project.isWorkspace) {
            command += ' -workspace "' + path.basename(project.path) + '"';
        } else {
            command += ' -project "' + path.basename(project.path) + '"';
        }
        
        // Add the scheme
        command += ' -scheme "' + scheme + '"';
        
        // Add the destination
        const config = vscode.workspace.getConfiguration('vscode-xcode-integration.build');
        const destination = config.get<string>('destination');
        
        if (destination) {
            command += ' -destination "' + destination + '"';
        } else {
            // Use a default destination for iOS simulators
            command += ' -destination "platform=iOS Simulator,name=iPhone 14"';
        }
        
        // Add the test action
        command += ' test';
        
        return command;
    }
    
    /**
     * Ensure a terminal exists for build operations
     * @param name Name of the terminal
     */
    private ensureTerminal(name: string): void {
        // Dispose of the existing terminal if it exists
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = undefined;
        }
        
        // Create a new terminal
        this.terminal = vscode.window.createTerminal(name);
    }
}
