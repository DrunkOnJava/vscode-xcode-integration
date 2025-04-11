import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
// @ts-ignore - Used in other files or for future use
// @ts-ignore - Used in other files or for future use
import { debounce } from './utils';

// Terminal for performance monitoring
let performanceTerminal: vscode.Terminal | undefined;

// Status bar item for performance
let performanceStatusItem: vscode.StatusBarItem;

/**
 * Initialize performance optimization features
 * @param context Extension context
 * @param outputChannel Output channel for logging
 */
export function initialize(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): void {
    // Create status bar item
    performanceStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 96);
    performanceStatusItem.text = "$(dashboard) Perf: Loading...";
    performanceStatusItem.tooltip = "Xcode Integration Performance Status";
    performanceStatusItem.command = 'vscode-xcode-integration.showPerformanceStatus';
    performanceStatusItem.show();

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-xcode-integration.startSelectiveWatcher', () => {
            startSelectiveWatcher(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.analyzeProject', () => {
            analyzeProject(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.showPerformanceStatus', () => {
            showPerformanceStatus(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.monitorPerformance', () => {
            monitorPerformance(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.configurePerformance', () => {
            configurePerformance(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.applyPerformanceProfile', (profile: string) => {
            applyPerformanceProfile(profile, outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.togglePerformanceFeatures', () => {
            togglePerformanceFeatures(outputChannel);
        })
    );

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('vscode-xcode-integration')) {
                updatePerformanceSettings(outputChannel);
            }
        })
    );

    // Check performance status and update
    checkPerformanceStatus(outputChannel);
}

/**
 * Dispose performance resources
 */
export function dispose(): void {
    if (performanceTerminal) {
        performanceTerminal.dispose();
        performanceTerminal = undefined;
    }

    if (performanceStatusItem) {
        performanceStatusItem.dispose();
    }
}

/**
 * Check if performance scripts are available
 */
function arePerformanceScriptsAvailable(): boolean {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return false;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const performancePath = path.join(workspaceFolder, 'scripts', 'performance');
    const mainScriptPath = path.join(performancePath, 'performance.sh');

    return fs.existsSync(mainScriptPath);
}

/**
 * Check if performance features are enabled
 */
function arePerformanceFeaturesEnabled(): boolean {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return false;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const disabledFlagPath = path.join(workspaceFolder, '.vscode-xcode-integration', 'performance_disabled');

    return !fs.existsSync(disabledFlagPath);
}

/**
 * Check performance status
 * @param outputChannel Output channel for logging
 */
function checkPerformanceStatus(outputChannel: vscode.OutputChannel): void {
    const scriptsAvailable = arePerformanceScriptsAvailable();
    const featuresEnabled = arePerformanceFeaturesEnabled();
    
    if (!scriptsAvailable) {
        performanceStatusItem.text = "$(dashboard) Perf: Not Available";
        performanceStatusItem.tooltip = "Performance optimization scripts not found";
        outputChannel.appendLine("Performance optimization scripts not found");
        return;
    }
    
    if (!featuresEnabled) {
        performanceStatusItem.text = "$(dashboard) Perf: Disabled";
        performanceStatusItem.tooltip = "Performance optimization features are disabled";
        outputChannel.appendLine("Performance optimization features are disabled");
        return;
    }
    
    // Check for running processes
    checkRunningProcesses(outputChannel);
}

/**
 * Check running performance processes
 * @param outputChannel Output channel for logging
 */
function checkRunningProcesses(outputChannel: vscode.OutputChannel): void {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return;
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const performanceScript = path.join(workspaceFolder, 'scripts', 'performance', 'performance.sh');
    
    try {
        const processResult = cp.spawnSync(performanceScript, ['status'], {
            cwd: workspaceFolder,
            encoding: 'utf8',
            shell: true
        });
        
        const output = processResult.stdout;
        
        if (output && output.includes('Selective file watcher is running')) {
            performanceStatusItem.text = "$(dashboard) Perf: Active";
            performanceStatusItem.tooltip = "Performance optimization features are active";
            outputChannel.appendLine("Performance optimization features are active");
        } else {
            performanceStatusItem.text = "$(dashboard) Perf: Idle";
            performanceStatusItem.tooltip = "Performance optimization features are idle";
            outputChannel.appendLine("Performance optimization features are idle");
        }
    } catch (err) {
        outputChannel.appendLine(`Error checking performance status: ${err}`);
        performanceStatusItem.text = "$(dashboard) Perf: Error";
        performanceStatusItem.tooltip = "Error checking performance status";
    }
}

/**
 * Update performance settings from configuration
 * @param outputChannel Output channel for logging
 */
function updatePerformanceSettings(outputChannel: vscode.OutputChannel): void {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return;
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const performanceScript = path.join(workspaceFolder, 'scripts', 'performance', 'performance_config.sh');
    
    // Get configuration values
    const config = vscode.workspace.getConfiguration('vscode-xcode-integration');
    const watchExclude = config.get<string[]>('watchExclude', []);
    const debounceDelay = config.get<number>('debounceDelay', 1000);
    
    try {
        // Update exclude patterns
        if (watchExclude.length > 0) {
            const excludePatterns = watchExclude.join(',');
            cp.spawnSync(performanceScript, ['set', 'watch_exclude_patterns', excludePatterns], {
                cwd: workspaceFolder,
                encoding: 'utf8',
                shell: true
            });
        }
        
        // Update debounce delay
        cp.spawnSync(performanceScript, ['set', 'debounce_delay', debounceDelay.toString()], {
            cwd: workspaceFolder,
            encoding: 'utf8',
            shell: true
        });
        
        outputChannel.appendLine("Performance settings updated from configuration");
    } catch (err) {
        outputChannel.appendLine(`Error updating performance settings: ${err}`);
    }
}

/**
 * Start the selective file watcher
 * @param outputChannel Output channel for logging
 */
function startSelectiveWatcher(outputChannel: vscode.OutputChannel): void {
    if (!arePerformanceScriptsAvailable()) {
        vscode.window.showErrorMessage("Performance optimization scripts not found");
        return;
    }
    
    if (!arePerformanceFeaturesEnabled()) {
        vscode.window.showWarningMessage("Performance optimization features are disabled", "Enable")
            .then(selection => {
                if (selection === "Enable") {
                    togglePerformanceFeatures(outputChannel);
                    // Try again after enabling
                    setTimeout(() => startSelectiveWatcher(outputChannel), 1000);
                }
            });
        return;
    }
    
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return;
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const performanceScript = path.join(workspaceFolder, 'scripts', 'performance', 'performance.sh');
    
    // Create and show terminal
    performanceTerminal = vscode.window.createTerminal('Selective File Watcher');
    performanceTerminal.show();
    
    // Execute command in terminal
    performanceTerminal.sendText(`${performanceScript} selective-watch`);
    
    outputChannel.appendLine("Started selective file watcher");
    
    // Update status
    setTimeout(() => checkPerformanceStatus(outputChannel), 2000);
}

/**
 * Analyze project dependencies
 * @param outputChannel Output channel for logging
 */
function analyzeProject(outputChannel: vscode.OutputChannel): void {
    if (!arePerformanceScriptsAvailable()) {
        vscode.window.showErrorMessage("Performance optimization scripts not found");
        return;
    }
    
    if (!arePerformanceFeaturesEnabled()) {
        vscode.window.showWarningMessage("Performance optimization features are disabled", "Enable")
            .then(selection => {
                if (selection === "Enable") {
                    togglePerformanceFeatures(outputChannel);
                    // Try again after enabling
                    setTimeout(() => analyzeProject(outputChannel), 1000);
                }
            });
        return;
    }
    
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return;
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const performanceScript = path.join(workspaceFolder, 'scripts', 'performance', 'performance.sh');
    
    // Create and show terminal
    const analyzeTerminal = vscode.window.createTerminal('Project Dependency Analysis');
    analyzeTerminal.show();
    
    // Execute command in terminal
    analyzeTerminal.sendText(`${performanceScript} analyze-project`);
    
    outputChannel.appendLine("Started project dependency analysis");
}

/**
 * Show performance status
 * @param outputChannel Output channel for logging
 */
function showPerformanceStatus(outputChannel: vscode.OutputChannel): void {
    if (!arePerformanceScriptsAvailable()) {
        vscode.window.showErrorMessage("Performance optimization scripts not found");
        return;
    }
    
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return;
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const performanceScript = path.join(workspaceFolder, 'scripts', 'performance', 'performance.sh');
    
    try {
        const processResult = cp.spawnSync(performanceScript, ['status'], {
            cwd: workspaceFolder,
            encoding: 'utf8',
            shell: true
        });
        
        const statusOutput = processResult.stdout;
        
        if (statusOutput) {
            // Create a new output channel for status
            const statusChannel = vscode.window.createOutputChannel('Xcode Performance Status');
            statusChannel.appendLine(statusOutput);
            statusChannel.show();
        } else {
            vscode.window.showErrorMessage("Failed to get performance status");
        }
    } catch (err) {
        outputChannel.appendLine(`Error showing performance status: ${err}`);
        vscode.window.showErrorMessage(`Error showing performance status: ${err}`);
    }
}

/**
 * Monitor performance in real-time
 * @param outputChannel Output channel for logging
 */
function monitorPerformance(outputChannel: vscode.OutputChannel): void {
    if (!arePerformanceScriptsAvailable()) {
        vscode.window.showErrorMessage("Performance optimization scripts not found");
        return;
    }
    
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return;
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const performanceScript = path.join(workspaceFolder, 'scripts', 'performance', 'performance.sh');
    
    // Create and show terminal
    const monitorTerminal = vscode.window.createTerminal('Performance Monitor');
    monitorTerminal.show();
    
    // Execute command in terminal
    monitorTerminal.sendText(`${performanceScript} monitor-resources`);
    
    outputChannel.appendLine("Started performance monitoring");
}

/**
 * Configure performance settings
 * @param outputChannel Output channel for logging
 */
function configurePerformance(outputChannel: vscode.OutputChannel): void {
    if (!arePerformanceScriptsAvailable()) {
        vscode.window.showErrorMessage("Performance optimization scripts not found");
        return;
    }
    
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return;
    }
    
    // Show available configuration options
    vscode.window.showQuickPick([
        { label: 'Show Current Settings', id: 'show' },
        { label: 'Apply Profile: Default', id: 'default' },
        { label: 'Apply Profile: Performance', id: 'performance' },
        { label: 'Apply Profile: Lightweight', id: 'lightweight' },
        { label: 'Apply Profile: Large Project', id: 'large-project' },
        { label: 'Toggle Performance Features', id: 'toggle' },
        { label: 'Configure Using Editor...', id: 'editor' }
    ], {
        placeHolder: 'Select Performance Configuration Option'
    }).then(selection => {
        if (!selection) return;
        
        switch (selection.id) {
            case 'show':
                showPerformanceStatus(outputChannel);
                break;
            case 'default':
            case 'performance':
            case 'lightweight':
            case 'large-project':
                applyPerformanceProfile(selection.id, outputChannel);
                break;
            case 'toggle':
                togglePerformanceFeatures(outputChannel);
                break;
            case 'editor':
                openConfigEditor(outputChannel);
                break;
        }
    });
}

/**
 * Apply a performance profile
 * @param profile Profile name
 * @param outputChannel Output channel for logging
 */
function applyPerformanceProfile(profile: string, outputChannel: vscode.OutputChannel): void {
    if (!arePerformanceScriptsAvailable()) {
        vscode.window.showErrorMessage("Performance optimization scripts not found");
        return;
    }
    
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return;
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const performanceScript = path.join(workspaceFolder, 'scripts', 'performance', 'performance.sh');
    
    try {
        const processResult = cp.spawnSync(performanceScript, ['apply-profile', profile], {
            cwd: workspaceFolder,
            encoding: 'utf8',
            shell: true
        });
        
        if (processResult.status === 0) {
            vscode.window.showInformationMessage(`Applied performance profile: ${profile}`);
            outputChannel.appendLine(`Applied performance profile: ${profile}`);
            
            // Update VSCode settings to match the profile
            updateVSCodeSettingsForProfile(profile, outputChannel);
        } else {
            vscode.window.showErrorMessage(`Failed to apply performance profile: ${profile}`);
            outputChannel.appendLine(`Failed to apply performance profile: ${profile}\n${processResult.stdout}`);
        }
    } catch (err) {
        outputChannel.appendLine(`Error applying performance profile: ${err}`);
        vscode.window.showErrorMessage(`Error applying performance profile: ${err}`);
    }
}

/**
 * Update VSCode settings to match a performance profile
 * @param profile Profile name
 * @param outputChannel Output channel for logging
 */
function updateVSCodeSettingsForProfile(profile: string, outputChannel: vscode.OutputChannel): void {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return;
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const performanceConfigScript = path.join(workspaceFolder, 'scripts', 'performance', 'performance_config.sh');
    
    try {
        // Get settings from profile
        const debounceDelayProcess = cp.spawnSync(performanceConfigScript, ['get', 'debounce_delay'], {
            cwd: workspaceFolder,
            encoding: 'utf8',
            shell: true
        });
        
        const watchExcludePatternsProcess = cp.spawnSync(performanceConfigScript, ['get', 'watch_exclude_patterns'], {
            cwd: workspaceFolder,
            encoding: 'utf8',
            shell: true
        });
        
        if (debounceDelayProcess.status === 0 && watchExcludePatternsProcess.status === 0) {
            const debounceDelay = parseInt(debounceDelayProcess.stdout.trim(), 10);
            const watchExcludePatterns = watchExcludePatternsProcess.stdout.trim().split(',');
            
            // Update VSCode settings
            const config = vscode.workspace.getConfiguration('vscode-xcode-integration');
            config.update('debounceDelay', debounceDelay, vscode.ConfigurationTarget.Workspace);
            config.update('watchExclude', watchExcludePatterns, vscode.ConfigurationTarget.Workspace);
            
            outputChannel.appendLine(`Updated VSCode settings for profile: ${profile}`);
        }
    } catch (err) {
        outputChannel.appendLine(`Error updating VSCode settings for profile: ${err}`);
    }
}

/**
 * Toggle performance features on/off
 * @param outputChannel Output channel for logging
 */
function togglePerformanceFeatures(outputChannel: vscode.OutputChannel): void {
    if (!arePerformanceScriptsAvailable()) {
        vscode.window.showErrorMessage("Performance optimization scripts not found");
        return;
    }
    
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return;
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const performanceScript = path.join(workspaceFolder, 'scripts', 'performance', 'performance.sh');
    
    const currentlyEnabled = arePerformanceFeaturesEnabled();
    const command = currentlyEnabled ? 'disable' : 'enable';
    
    try {
        const processResult = cp.spawnSync(performanceScript, [command], {
            cwd: workspaceFolder,
            encoding: 'utf8',
            shell: true
        });
        
        if (processResult.status === 0) {
            const statusMessage = currentlyEnabled ? 
                'Performance optimization features disabled' : 
                'Performance optimization features enabled';
                
            vscode.window.showInformationMessage(statusMessage);
            outputChannel.appendLine(statusMessage);
            
            // Update status
            checkPerformanceStatus(outputChannel);
        } else {
            vscode.window.showErrorMessage(`Failed to ${command} performance features`);
            outputChannel.appendLine(`Failed to ${command} performance features\n${processResult.stdout}`);
        }
    } catch (err) {
        outputChannel.appendLine(`Error toggling performance features: ${err}`);
        vscode.window.showErrorMessage(`Error toggling performance features: ${err}`);
    }
}

/**
 * Open the performance configuration file in an editor
 * @param outputChannel Output channel for logging
 */
function openConfigEditor(outputChannel: vscode.OutputChannel): void {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return;
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const configPath = path.join(workspaceFolder, '.vscode-xcode-integration', 'config', 'performance.conf');
    
    // Check if config file exists
    if (!fs.existsSync(configPath)) {
        // Create default config first
        const performanceConfigScript = path.join(workspaceFolder, 'scripts', 'performance', 'performance_config.sh');
        cp.spawnSync(performanceConfigScript, ['reset'], {
            cwd: workspaceFolder,
            encoding: 'utf8',
            shell: true
        });
    }
    
    // Open the config file in editor
    vscode.workspace.openTextDocument(configPath).then(document => {
        vscode.window.showTextDocument(document);
    }).then(() => {
        // Show info about editing
        vscode.window.showInformationMessage(
            'Editing Performance Configuration', 
            'After saving, restart the file watcher to apply changes'
        );
    }).then(undefined, (err: Error) => {
        outputChannel.appendLine(`Error opening config editor: ${err}`);
        vscode.window.showErrorMessage(`Error opening config editor: ${err}`);
    });
}
