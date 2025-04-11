import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as url from 'url';
// @ts-ignore - Used in other files or for future use
import * as os from 'os';

// Status bar items for version control integration
let versionControlStatusItem: vscode.StatusBarItem;
let gitStateStatusItem: vscode.StatusBarItem;

// State variables
let currentGitState: string = 'unknown';
// @ts-ignore - Used in other files or for future use
let lastSavedState: string = '';
let server: http.Server | null = null;
let notificationPort: number = 0;

/**
 * Initialize version control integration
 */
export function initialize(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): void {
    outputChannel.appendLine('Initializing version control integration...');
    
    // Create status bar items
    versionControlStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 96);
    versionControlStatusItem.text = "$(git-branch) Git: Initializing...";
    versionControlStatusItem.tooltip = "Git Integration Status";
    versionControlStatusItem.command = 'vscode-xcode-integration.showGitStatus';
    versionControlStatusItem.show();
    
    gitStateStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 95);
    gitStateStatusItem.text = "$(history) State: Initializing...";
    gitStateStatusItem.tooltip = "Xcode Project State Status";
    gitStateStatusItem.command = 'vscode-xcode-integration.showStateHistory';
    gitStateStatusItem.show();
    
    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-xcode-integration.setupGitHooks', () => {
            setupGitHooks(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.resolveConflicts', () => {
            resolveConflicts(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.showGitStatus', () => {
            showGitStatus(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.saveProjectState', () => {
            saveProjectState(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.restoreProjectState', () => {
            restoreProjectState(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.showStateHistory', () => {
            showProjectStateHistory(outputChannel);
        })
    );
    
    // Set up the HTTP notification server
    setupNotificationServer(outputChannel);
    
    // Initialize status bar
    updateVersionControlStatus();
    updateGitStateStatus();
    
    // If auto setup is enabled, check if Git hooks need to be installed
    const config = vscode.workspace.getConfiguration('vscode-xcode-integration.versionControl');
    const autoSetup = config.get<boolean>('autoSetupGitHooks', true);
    
    if (autoSetup) {
        setTimeout(() => {
            checkGitHooks(outputChannel);
        }, 5000);
    }
    
    // Set up file watchers for project files
    setupProjectFileWatchers(context, outputChannel);
    
    outputChannel.appendLine('Version control integration initialized');
}

/**
 * Dispose of version control resources
 */
export function dispose(): void {
    if (versionControlStatusItem) {
        versionControlStatusItem.dispose();
    }
    
    if (gitStateStatusItem) {
        gitStateStatusItem.dispose();
    }
    
    if (server) {
        server.close();
        server = null;
    }
}

/**
 * Set up HTTP server to receive notifications from Git hooks
 */
function setupNotificationServer(outputChannel: vscode.OutputChannel): void {
    try {
        // Choose a random port between 10000 and 60000
        notificationPort = Math.floor(Math.random() * 50000) + 10000;
        
        // Create a server that listens for notifications from Git hooks
        server = http.createServer((req, res) => {
            const parsedUrl = url.parse(req.url || '', true);
            
            // Handle different notification types based on path
            if (parsedUrl.pathname === '/notify/git-state-change') {
                // Handle Git state change notification
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });
                req.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        outputChannel.appendLine(`Received Git state change: ${JSON.stringify(data)}`);
                        
                        // Update UI based on notification type
                        if (data.type === 'commit') {
                            vscode.window.showInformationMessage(`Commit: ${data.message}`);
                        } else if (data.type === 'conflict') {
                            vscode.window.showWarningMessage('Git conflicts detected', 'Resolve Now')
                                .then(selection => {
                                    if (selection === 'Resolve Now') {
                                        vscode.commands.executeCommand('vscode-xcode-integration.resolveConflicts');
                                    }
                                });
                        } else if (data.type === 'state_save') {
                            const config = vscode.workspace.getConfiguration('vscode-xcode-integration.versionControl');
                            if (config.get<boolean>('notifyOnStateChange', true)) {
                                vscode.window.showInformationMessage(`Project state saved: ${data.stateId}`);
                            }
                            lastSavedState = data.stateId;
                        } else if (data.type === 'state_restore') {
                            vscode.window.showInformationMessage(`Project state restored: ${data.stateId}`);
                        }
                        
                        // Update status bar
                        updateVersionControlStatus();
                        updateGitStateStatus();
                        
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                        res.end('OK');
                    } catch (err) {
                        outputChannel.appendLine(`Error processing notification: ${err}`);
                        res.writeHead(400, { 'Content-Type': 'text/plain' });
                        res.end('Error processing request');
                    }
                });
            } else if (parsedUrl.pathname === '/healthcheck') {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('OK');
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            }
        });
        
        server.listen(notificationPort, '127.0.0.1', () => {
            outputChannel.appendLine(`Notification server listening on port ${notificationPort}`);
            
            // Write the port to a file that Git hooks can read
            writePortFile(outputChannel);
        });
    } catch (err) {
        outputChannel.appendLine(`Error setting up notification server: ${err}`);
    }
}

/**
 * Write the notification port to a file for Git hooks to read
 */
function writePortFile(outputChannel: vscode.OutputChannel): void {
    try {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return;
        }
        
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const vscodeDir = path.join(workspaceFolder, '.vscode');
        const portFile = path.join(vscodeDir, 'vscode_xcode_port');
        
        // Create .vscode directory if it doesn't exist
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir);
        }
        
        // Write port to file
        fs.writeFileSync(portFile, notificationPort.toString());
        
        outputChannel.appendLine(`Set up VSCode port ${notificationPort} for Git hook communication`);
    } catch (err) {
        outputChannel.appendLine(`Error writing port file: ${err}`);
    }
}

/**
 * Check if Git hooks are installed and prompt to install if not
 */
function checkGitHooks(outputChannel: vscode.OutputChannel): void {
    try {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return;
        }
        
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const gitDir = path.join(workspaceFolder, '.git');
        
        // Check if .git directory exists
        if (!fs.existsSync(gitDir)) {
            outputChannel.appendLine('No .git directory found, skipping Git hook check');
            return;
        }
        
        // Check if hooks directory exists
        const hooksDir = path.join(gitDir, 'hooks');
        if (!fs.existsSync(hooksDir)) {
            outputChannel.appendLine('No .git/hooks directory found, creating it');
            fs.mkdirSync(hooksDir, { recursive: true });
        }
        
        // Check if pre-commit hook is installed
        const preCommitHook = path.join(hooksDir, 'pre-commit');
        
        if (!fs.existsSync(preCommitHook) || 
            !fs.readFileSync(preCommitHook, 'utf8').includes('VSCode-Xcode integration')) {
            // Hooks are not installed, prompt to install
            vscode.window.showInformationMessage(
                'VSCode-Xcode Git integration is not set up. Set up now?',
                'Set Up', 'Later'
            ).then(selection => {
                if (selection === 'Set Up') {
                    setupGitHooks(outputChannel);
                }
            });
        } else {
            outputChannel.appendLine('Git hooks are already installed');
        }
    } catch (err) {
        outputChannel.appendLine(`Error checking Git hooks: ${err}`);
    }
}

/**
 * Set up Git hooks for Xcode project integration
 */
function setupGitHooks(outputChannel: vscode.OutputChannel): void {
    outputChannel.appendLine('Setting up Git hooks...');
    
    try {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace is open');
        }
        
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const scriptPath = getScriptPath('setup_git_hooks.sh');
        
        // Show progress notification
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Setting up Git hooks",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: "Starting setup..." });
            
            // Run the setup script with the notification port
            const result = cp.spawnSync(scriptPath, [
                '--use-http-notifications',
                `--notification-port=${notificationPort}`
            ], {
                cwd: workspaceFolder,
                encoding: 'utf8',
                shell: true
            });
            
            if (result.error) {
                outputChannel.appendLine(`Error executing script: ${result.stderr || result.error?.message || "Unknown error"}`);
                vscode.window.showErrorMessage(`Failed to set up Git hooks: ${result.stderr || result.error?.message || "Unknown error"}`);
                return;
            }
            
            outputChannel.appendLine(`Script output: ${result.stdout}`);
            if (result.stderr) {
                outputChannel.appendLine(`Script error: ${result.stderr}`);
            }
            
            progress.report({ increment: 100, message: "Hooks installed" });
            
            // Update status bar
            updateVersionControlStatus();
            
            vscode.window.showInformationMessage('Git hooks set up successfully');
        });
    } catch (err) {
        outputChannel.appendLine(`Error setting up Git hooks: ${err}`);
        vscode.window.showErrorMessage(`Failed to set up Git hooks: ${err}`);
    }
}

/**
 * Resolve Git conflicts in Xcode project files
 */
function resolveConflicts(outputChannel: vscode.OutputChannel): void {
    outputChannel.appendLine('Resolving merge conflicts...');
    
    try {
        // Check if there are any conflicts
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace is open');
        }
        
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        // Run git status to check for conflicts
        const gitStatusProcess = cp.spawnSync('git', ['status', '--porcelain'], {
            cwd: workspaceFolder,
            encoding: 'utf8'
        });
        
        if (gitStatusProcess.error) {
            outputChannel.appendLine(`Error executing git status: ${gitStatusProcess.stderr || gitStatusProcess.error?.message || "Unknown error"}`);
            vscode.window.showErrorMessage(`Failed to check for conflicts: ${gitStatusProcess.stderr || gitStatusProcess.error?.message || "Unknown error"}`);
            return;
        }
        
        const conflictedFiles = gitStatusProcess.stdout
            .split('\n')
            .filter(line => line.startsWith('UU'))
            .map(line => line.substring(3).trim());
        
        if (conflictedFiles.length === 0) {
            vscode.window.showInformationMessage('No merge conflicts found');
            return;
        }
        
        // Group conflicts by file type
        const xcodeProjectConflicts = conflictedFiles.filter(file => file.includes('.xcodeproj/project.pbxproj'));
        const swiftConflicts = conflictedFiles.filter(file => file.endsWith('.swift'));
        const resourceConflicts = conflictedFiles.filter(file => 
            file.includes('.xcassets') || 
            file.endsWith('.storyboard') || 
            file.endsWith('.xib') || 
            file.includes('.xcdatamodeld')
        );
        const otherConflicts = conflictedFiles.filter(file => 
            !xcodeProjectConflicts.includes(file) && 
            !swiftConflicts.includes(file) && 
            !resourceConflicts.includes(file)
        );
        
        // Create quick pick items
        const quickPickItems = [
            { 
                label: `Resolve ${xcodeProjectConflicts.length} Xcode Project Conflicts`, 
                description: 'Use specialized merger for Xcode project files', 
                id: 'xcode', 
                conflicts: xcodeProjectConflicts, 
                count: xcodeProjectConflicts.length 
            },
            { 
                label: `Resolve ${swiftConflicts.length} Swift File Conflicts`, 
                description: 'Merge Swift files with reference handling', 
                id: 'swift', 
                conflicts: swiftConflicts, 
                count: swiftConflicts.length 
            },
            { 
                label: `Resolve ${resourceConflicts.length} Resource File Conflicts`, 
                description: 'Merge resource files with specialized handlers', 
                id: 'resource', 
                conflicts: resourceConflicts, 
                count: resourceConflicts.length 
            },
            { 
                label: `Resolve ${otherConflicts.length} Other Conflicts`, 
                description: 'Use standard merge tools', 
                id: 'other', 
                conflicts: otherConflicts, 
                count: otherConflicts.length 
            },
            { 
                label: 'Resolve All Conflicts', 
                description: 'Attempt to resolve all conflicts automatically', 
                id: 'all', 
                conflicts: conflictedFiles, 
                count: conflictedFiles.length 
            }
        ].filter(item => item.count > 0);
        
        // Show conflict resolution options
        vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select conflicts to resolve'
        }).then(selection => {
            if (!selection) return;
            
            // Get the conflict resolver script
            const scriptPath = getScriptPath('conflict_resolver.sh');
            
            // Open terminal for conflict resolution (better for interactive feedback)
            const terminal = vscode.window.createTerminal('Conflict Resolution');
            
            // Get the version control configuration
            const config = vscode.workspace.getConfiguration('vscode-xcode-integration.versionControl');
            const mergeStrategy = config.get<string>('mergeStrategy', 'interactive');
            
            // Build paths string
            const conflictPaths = selection.conflicts.join(' ');
            terminal.sendText(`${scriptPath} ${mergeStrategy} ${selection.id} ${conflictPaths}`);
            terminal.show();
            
            // Show progress notification
            vscode.window.showInformationMessage(
                `Resolving ${selection.conflicts.length} conflicts using ${mergeStrategy} mode`,
                'View Terminal'
            ).then(result => {
                if (result === 'View Terminal') {
                    terminal.show();
                }
            });
        });
    } catch (err) {
        outputChannel.appendLine(`Error resolving conflicts: ${err}`);
        vscode.window.showErrorMessage(`Failed to resolve conflicts: ${err}`);
    }
}

/**
 * Show Git status and project state history
 */
function showGitStatus(outputChannel: vscode.OutputChannel): void {
    outputChannel.appendLine('Showing Git status...');
    
    try {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace is open');
        }
        
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        // Run git status
        const gitStatusProcess = cp.spawnSync('git', ['status'], {
            cwd: workspaceFolder,
            encoding: 'utf8'
        });
        
        if (gitStatusProcess.error) {
            outputChannel.appendLine(`Error executing git status: ${gitStatusProcess.stderr || gitStatusProcess.error?.message || "Unknown error"}`);
            vscode.window.showErrorMessage(`Failed to get Git status: ${gitStatusProcess.stderr || gitStatusProcess.error?.message || "Unknown error"}`);
            return;
        }
        
        // Show Git status in output channel
        outputChannel.show();
        outputChannel.appendLine('=== Git Status ===');
        outputChannel.appendLine(gitStatusProcess.stdout);
        
        // Run git branch to show branches
        const gitBranchProcess = cp.spawnSync('git', ['branch', '-v'], {
            cwd: workspaceFolder,
            encoding: 'utf8'
        });
        
        if (gitBranchProcess.error) {
            outputChannel.appendLine(`Error executing git branch: ${gitBranchProcess.stderr || gitBranchProcess.error?.message || "Unknown error"}`);
        } else {
            outputChannel.appendLine('=== Git Branches ===');
            outputChannel.appendLine(gitBranchProcess.stdout);
        }
        
        // Show saved states if available
        const stateTrackerPath = getScriptPath('state_manager/state_tracker.sh');
        
        try {
            const stateListProcess = cp.spawnSync('bash', [stateTrackerPath, 'list', '5'], {
                cwd: workspaceFolder,
                encoding: 'utf8',
                shell: true
            });
            
            outputChannel.appendLine('=== Recent States ===');
            if (stateListProcess.stdout) {
                outputChannel.appendLine(stateListProcess.stdout);
            } else {
                outputChannel.appendLine('No saved states found');
            }
        } catch (err) {
            outputChannel.appendLine(`Error getting state history: ${err}`);
        }
    } catch (err) {
        outputChannel.appendLine(`Error showing Git status: ${err}`);
        vscode.window.showErrorMessage(`Failed to show Git status: ${err}`);
    }
}

/**
 * Save the current project state
 */
function saveProjectState(outputChannel: vscode.OutputChannel): void {
    outputChannel.appendLine('Saving project state...');
    
    try {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace is open');
        }
        
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        // Prompt for state ID and description
        vscode.window.showInputBox({
            prompt: 'Enter a unique identifier for this state',
            placeHolder: 'my-feature-state',
            value: `state-${new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '')}`
        }).then(stateId => {
            if (!stateId) return;
            
            vscode.window.showInputBox({
                prompt: 'Enter a description for this state',
                placeHolder: 'Before implementing feature X',
                value: `Manual save at ${new Date().toLocaleString()}`
            }).then(description => {
                if (!description) return;
                
                // Show progress notification
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Saving project state",
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: "Saving..." });
                    
                    // Get state saver script path
                    const stateSaverPath = getScriptPath('state_manager/state_saver.sh');
                    
                    // Run state saver script
                    const processResult = cp.spawnSync(stateSaverPath, [stateId, description, 'manual'], {
                        cwd: workspaceFolder,
                        encoding: 'utf8',
                        shell: true,
                        env: { 
                            ...process.env, 
                            VSCODE_PORT: notificationPort.toString() 
                        }
                    });
                    
                    if (processResult.error) {
                        outputChannel.appendLine(`Error executing script: ${processResult.stderr || processResult.error?.message || "Unknown error"}`);
                        vscode.window.showErrorMessage(`Failed to save project state: ${processResult.stderr || processResult.error?.message || "Unknown error"}`);
                        return;
                    }
                    
                    outputChannel.appendLine(`Script output: ${processResult.stdout}`);
                    if (processResult.stderr) {
                        outputChannel.appendLine(`Script error: ${processResult.stderr}`);
                    }
                    
                    progress.report({ increment: 100, message: "State saved" });
                    
                    // Update status
                    lastSavedState = stateId;
                    updateGitStateStatus();
                    
                    vscode.window.showInformationMessage(`Project state saved: ${stateId}`);
                });
            });
        });
    } catch (err) {
        outputChannel.appendLine(`Error saving project state: ${err}`);
        vscode.window.showErrorMessage(`Failed to save project state: ${err}`);
    }
}

/**
 * Restore a previous project state
 */
function restoreProjectState(outputChannel: vscode.OutputChannel): void {
    outputChannel.appendLine('Restoring project state...');
    
    try {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace is open');
        }
        
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        // Get the state tracker script path
        const stateTrackerPath = getScriptPath('state_manager/state_tracker.sh');
        
        // Get list of available states
        const stateListProcess = cp.spawnSync('bash', [stateTrackerPath, 'list'], {
            cwd: workspaceFolder,
            encoding: 'utf8',
            shell: true
        });
        
        if (stateListProcess.error) {
            outputChannel.appendLine(`Error executing script: ${stateListProcess.stderr || stateListProcess.error?.message || "Unknown error"}`);
            vscode.window.showErrorMessage(`Failed to get state list: ${stateListProcess.stderr || stateListProcess.error?.message || "Unknown error"}`);
            return;
        }
        
        const statesList = stateListProcess.stdout.split('\n').filter(Boolean);
        
        if (statesList.length === 0) {
            vscode.window.showInformationMessage('No saved states found');
            return;
        }
        
        // Create quick pick items
        const quickPickItems = statesList.map(state => {
            const stateId = state.match(/\(([^)]+)\)$/)?.[1] || '';
            return {
                label: state,
                description: `Restore to this state (${stateId})`,
                stateId: stateId
            };
        });
        
        // Show state selection options
        vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select a state to restore'
        }).then(selection => {
            if (!selection) return;
            
            // Confirm restoration
            vscode.window.showWarningMessage(
                `Are you sure you want to restore to state: ${selection.stateId}? This will overwrite current project files.`,
                { modal: true },
                'Yes', 'No'
            ).then(confirmResult => {
                if (confirmResult !== 'Yes') return;
                
                // Show progress notification
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Restoring state: ${selection.stateId}`,
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: "Starting restoration..." });
                    
                    // Get restorer script
                    const stateRestorerPath = getScriptPath('state_manager/state_restorer.sh');
                    
                    // Open terminal for restoration (better for interactive feedback)
                    const terminal = vscode.window.createTerminal('State Restoration');
                    terminal.sendText(`export VSCODE_PORT=${notificationPort}`);
                    terminal.sendText(`${stateRestorerPath} restore "${selection.stateId}"`);
                    terminal.show();
                    
                    progress.report({ increment: 100, message: "Restoration started" });
                });
            });
        });
    } catch (err) {
        outputChannel.appendLine(`Error restoring project state: ${err}`);
        vscode.window.showErrorMessage(`Failed to restore project state: ${err}`);
    }
}

/**
 * Show project state history
 */
function showProjectStateHistory(outputChannel: vscode.OutputChannel): void {
    outputChannel.appendLine('Showing project state history...');
    
    try {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace is open');
        }
        
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        // Get the state tracker script path
        const stateTrackerPath = getScriptPath('state_manager/state_tracker.sh');
        
        // Get list of all states
        const stateListProcess = cp.spawnSync('bash', [stateTrackerPath, 'list'], {
            cwd: workspaceFolder,
            encoding: 'utf8',
            shell: true
        });
        
        if (stateListProcess.error) {
            outputChannel.appendLine(`Error executing script: ${stateListProcess.stderr || stateListProcess.error?.message || "Unknown error"}`);
            vscode.window.showErrorMessage(`Failed to get state history: ${stateListProcess.stderr || stateListProcess.error?.message || "Unknown error"}`);
            return;
        }
        
        // Show state history in output channel
        outputChannel.show();
        outputChannel.appendLine('=== Project State History ===');
        
        const statesList = stateListProcess.stdout.split('\n').filter(Boolean);
        
        if (statesList.length === 0) {
            outputChannel.appendLine('No saved states found');
        } else {
            outputChannel.appendLine(stateListProcess.stdout);
        }
        
        // Get current state
        const currentStateProcess = cp.spawnSync('bash', [stateTrackerPath, 'current'], {
            cwd: workspaceFolder,
            encoding: 'utf8',
            shell: true
        });
        
        if (currentStateProcess.error) {
            outputChannel.appendLine(`Error getting current state: ${currentStateProcess.stderr || currentStateProcess.error?.message || "Unknown error"}`);
            return;
        }
        
        const currentState = currentStateProcess.stdout.trim();
        
        if (currentState && currentState !== "null") {
            outputChannel.appendLine(`\nCurrent State: ${currentState}`);
        } else {
            outputChannel.appendLine('\nNo current state set');
        }
        
        // Offer additional actions
        vscode.window.showInformationMessage(
            `Found ${statesList.length} saved project states`,
            'Restore a State', 'Save Current State', 'View Details'
        ).then(selection => {
            if (selection === 'Restore a State') {
                vscode.commands.executeCommand('vscode-xcode-integration.restoreProjectState');
            } else if (selection === 'Save Current State') {
                vscode.commands.executeCommand('vscode-xcode-integration.saveProjectState');
            } else if (selection === 'View Details') {
                // The output channel is already shown with details
            }
        });
    } catch (err) {
        outputChannel.appendLine(`Error showing project state history: ${err}`);
        vscode.window.showErrorMessage(`Failed to show project state history: ${err}`);
    }
}

/**
 * Update version control status bar item
 */
function updateVersionControlStatus(): void {
    try {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            versionControlStatusItem.hide();
            return;
        }
        
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        // Check if .git directory exists
        const gitDir = path.join(workspaceFolder, '.git');
        if (!fs.existsSync(gitDir)) {
            versionControlStatusItem.hide();
            return;
        }
        
        // Get current branch
        const gitBranchProcess = cp.spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
            cwd: workspaceFolder,
            encoding: 'utf8'
        });
        
        if (gitBranchProcess.error) {
            versionControlStatusItem.text = `$(git-branch) Git: Error`;
            versionControlStatusItem.tooltip = `Error getting Git status: ${gitBranchProcess.stderr || gitBranchProcess.error?.message || "Unknown error"}`;
            versionControlStatusItem.show();
            return;
        }
        
        // Get the current branch
        const currentBranch = gitBranchProcess.stdout.trim();
        
        // Check if there are uncommitted changes
        const gitStatusProcess = cp.spawnSync('git', ['status', '--porcelain'], {
            cwd: workspaceFolder,
            encoding: 'utf8'
        });
        
        if (gitStatusProcess.error) {
            versionControlStatusItem.text = `$(git-branch) Git: Error`;
            versionControlStatusItem.tooltip = `Error getting Git status: ${gitStatusProcess.stderr || gitStatusProcess.error?.message || "Unknown error"}`;
            versionControlStatusItem.show();
            return;
        }
        
        const hasChanges = gitStatusProcess.stdout.trim().length > 0;
        
        // Check if there are conflicts
        const hasConflicts = gitStatusProcess.stdout.split('\n').some(line => line.startsWith('UU'));
        
        // Update status bar based on Git state
        if (hasConflicts) {
            versionControlStatusItem.text = `$(warning) Git: Conflicts on ${currentBranch}`;
            versionControlStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            currentGitState = 'conflicts';
        } else if (hasChanges) {
            versionControlStatusItem.text = `$(git-commit) Git: ${currentBranch}*`;
            versionControlStatusItem.backgroundColor = undefined;
            currentGitState = 'changes';
        } else {
            versionControlStatusItem.text = `$(git-branch) Git: ${currentBranch}`;
            versionControlStatusItem.backgroundColor = undefined;
            currentGitState = 'clean';
        }
        
        versionControlStatusItem.tooltip = `Current branch: ${currentBranch}${hasChanges ? ' (with uncommitted changes)' : ''}${hasConflicts ? ' (with conflicts)' : ''}`;
        versionControlStatusItem.show();
    } catch (err) {
        versionControlStatusItem.text = `$(git-branch) Git: Error`;
        versionControlStatusItem.tooltip = `Error getting Git status: ${err}`;
        versionControlStatusItem.show();
    }
}

/**
 * Update Git state status bar item
 */
function updateGitStateStatus(): void {
    try {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            gitStateStatusItem.hide();
            return;
        }
        
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        // Check if state tracking is enabled
        const config = vscode.workspace.getConfiguration('vscode-xcode-integration.versionControl');
        const stateTrackingEnabled = config.get<boolean>('stateTrackingEnabled', true);
        
        if (!stateTrackingEnabled) {
            gitStateStatusItem.text = `$(history) State: Disabled`;
            gitStateStatusItem.tooltip = `Project state tracking is disabled`;
            gitStateStatusItem.show();
            return;
        }
        
        // Get the state tracker script path
        try {
            const stateTrackerPath = getScriptPath('state_manager/state_tracker.sh');
            
            // Get current state
            const currentStateProcess = cp.spawnSync('bash', [stateTrackerPath, 'current'], {
                cwd: workspaceFolder,
                encoding: 'utf8',
                shell: true
            });
            
            if (currentStateProcess.error) {
                gitStateStatusItem.text = `$(history) State: Error`;
                gitStateStatusItem.tooltip = `Error getting state status: ${currentStateProcess.stderr || currentStateProcess.error?.message || "Unknown error"}`;
                gitStateStatusItem.show();
                return;
            }
            
            const currentState = currentStateProcess.stdout.trim();
            
            if (currentState && currentState !== "null") {
                gitStateStatusItem.text = `$(history) State: ${currentState}`;
                gitStateStatusItem.tooltip = `Current saved state: ${currentState}`;
                gitStateStatusItem.show();
            } else {
                gitStateStatusItem.text = `$(history) State: None`;
                gitStateStatusItem.tooltip = `No current saved state`;
                gitStateStatusItem.show();
            }
        } catch (err) {
            // State tracker script might not exist yet
            gitStateStatusItem.text = `$(history) State: Not Setup`;
            gitStateStatusItem.tooltip = `Project state tracking needs setup`;
            gitStateStatusItem.show();
        }
    } catch (err) {
        gitStateStatusItem.text = `$(history) State: Error`;
        gitStateStatusItem.tooltip = `Error getting state status: ${err}`;
        gitStateStatusItem.show();
    }
}

/**
 * Set up file watchers for project files to update status
 */
function setupProjectFileWatchers(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): void {
    try {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return;
        }
        
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        // Set up a file watcher for Git files
        const gitWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolder, '**/.git/**'),
            false, false, false
        );
        
        gitWatcher.onDidChange(() => {
            updateVersionControlStatus();
            updateGitStateStatus();
        });
        
        gitWatcher.onDidCreate(() => {
            updateVersionControlStatus();
            updateGitStateStatus();
        });
        
        gitWatcher.onDidDelete(() => {
            updateVersionControlStatus();
            updateGitStateStatus();
        });
        
        // Set up a file watcher for Xcode project files
        const projectWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolder, '**/*.{xcodeproj,xcworkspace}/**'),
            false, false, false
        );
        
        projectWatcher.onDidChange(() => {
            // Only update if we're not already in a conflict state
            if (currentGitState !== 'conflicts') {
                updateVersionControlStatus();
            }
        });
        
        // Add watchers to context for disposal
        context.subscriptions.push(gitWatcher, projectWatcher);
        
        outputChannel.appendLine('Project file watchers set up');
    } catch (err) {
        outputChannel.appendLine(`Error setting up project file watchers: ${err}`);
    }
}

/**
 * Helper function to get script paths
 */
function getScriptPath(scriptName: string): string {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        throw new Error('No workspace folder is open');
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const scriptPath = path.join(workspaceFolder, 'scripts', 'version_control', scriptName);
    
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Script not found: ${scriptPath}`);
    }
    
    return scriptPath;
}