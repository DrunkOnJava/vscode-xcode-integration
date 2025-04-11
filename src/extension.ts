import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { debounce } from './utils';
import * as versionControl from './version-control';
import * as performanceOptimization from './performance';
import { PBXProjEditorProvider } from './pbxproj-editor';
import { ensureCodeMirror } from './codemirror-loader';
import { MultiProjectManager } from './multi-project';

// Status bar items
let syncStatusItem: vscode.StatusBarItem;
let xcodeStatusItem: vscode.StatusBarItem;
let securityStatusItem: vscode.StatusBarItem;
let transactionStatusItem: vscode.StatusBarItem;

// File watcher
let fileWatcher: vscode.FileSystemWatcher | undefined;

// Extension state
// @ts-ignore - Used in other files or for future use
// @ts-ignore - Used in other files or for future use
let isSync: boolean = true;
// @ts-ignore - Used for future implementations
// @ts-ignore - Used in status updates and for future implementation
let lastSyncFile: string = '';
// @ts-ignore - Used for future implementations
// @ts-ignore - Used in status updates and for future implementation
let lastSyncTime: Date | null = null;
let securityEnabled: boolean = false;
let errorHandlingEnabled: boolean = false;
let multiProjectManager: MultiProjectManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('VSCode Xcode Integration is now active');

    // Initialize status bar items
    syncStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    syncStatusItem.text = "$(sync) Xcode: Synced";
    syncStatusItem.tooltip = "Xcode Integration Status";
    syncStatusItem.command = 'vscode-xcode-integration.showStatus';
    syncStatusItem.show();

    xcodeStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    xcodeStatusItem.text = "$(tools) Xcode";
    xcodeStatusItem.tooltip = "Xcode Integration Actions";
    xcodeStatusItem.command = 'vscode-xcode-integration.showMenu';
    xcodeStatusItem.show();

    securityStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
    updateSecurityStatusItem();
    securityStatusItem.tooltip = "Xcode Integration Security Status";
    securityStatusItem.command = 'vscode-xcode-integration.showSecurityStatus';
    securityStatusItem.show();

    // Create transaction status item
    transactionStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 97);
    transactionStatusItem.text = "$(database) Transactions: Ready";
    transactionStatusItem.tooltip = "Transaction Status";
    transactionStatusItem.command = 'vscode-xcode-integration.viewTransactionLog';
    transactionStatusItem.show();

    // Create output channel for logging
    const outputChannel = vscode.window.createOutputChannel('Xcode Integration');

    // Initialize multi-project manager
    multiProjectManager = new MultiProjectManager(context);

    // Check for security components
    checkSecurityComponents(outputChannel);

    // Check for error handling components
    checkErrorHandlingComponents(outputChannel);

    // Set up the file watcher
    setupFileWatcher(context, outputChannel);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-xcode-integration.syncFile', () => {
            syncCurrentFile(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.syncProject', () => {
            syncEntireProject(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.buildProject', () => {
            buildProject(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.runTests', () => {
            runTests(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.updateDependencies', () => {
            updateDependencies(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.showStatus', () => {
            showStatus(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.showMenu', () => {
            showMenu();
        }),
        // Security commands
        vscode.commands.registerCommand('vscode-xcode-integration.scanForSensitiveData', () => {
            scanForSensitiveData(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.validateProjectPaths', () => {
            validateProjectPaths(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.checkPermissions', () => {
            checkFilePermissions(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.showSecurityStatus', () => {
            showSecurityStatus(outputChannel);
        }),
        // Error handling commands
        vscode.commands.registerCommand('vscode-xcode-integration.checkProjectIntegrity', () => {
            checkProjectIntegrity(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.repairProject', () => {
            repairProject(outputChannel);
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.viewTransactionLog', () => {
            viewTransactionLog(outputChannel);
        }),
        // Multi-project commands
        vscode.commands.registerCommand('vscode-xcode-integration.detectWorkspace', () => {
            multiProjectManager.detectWorkspace();
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.selectWorkspaceScheme', () => {
            multiProjectManager.selectWorkspaceScheme();
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.updateCrossReferences', () => {
            multiProjectManager.updateCrossReferences();
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.buildDependencyGraph', () => {
            multiProjectManager.buildDependencyGraph();
        }),
        vscode.commands.registerCommand('vscode-xcode-integration.determineBuildOrder', () => {
            multiProjectManager.determineBuildOrder();
        })
    );

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('vscode-xcode-integration')) {
                setupFileWatcher(context, outputChannel);
                updateSecurityStatusItem();
                updateTransactionStatusItem();
            }
        })
    );

    // Listen for editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            updateStatusBar(editor);
        })
    );

    // Initialize status based on current editor
    updateStatusBar(vscode.window.activeTextEditor);

    // Detect Xcode project or workspace
    detectXcodeProject(outputChannel);
    
    // Initialize version control integration
    versionControl.initialize(context, outputChannel);
    
    // Initialize performance optimization
    performanceOptimization.initialize(context, outputChannel);
    
    // Ensure CodeMirror is available for editors
    ensureCodeMirror(context, outputChannel).then(success => {
        if (success) {
            // Register custom editors
            context.subscriptions.push(PBXProjEditorProvider.register(context));
        }
    });
}

export function deactivate() {
    if (fileWatcher) {
        fileWatcher.dispose();
    }
    syncStatusItem.dispose();
    xcodeStatusItem.dispose();
    securityStatusItem.dispose();
    transactionStatusItem.dispose();
    
    // Dispose version control resources
    versionControl.dispose();
    
    // Dispose performance optimization resources
    performanceOptimization.dispose();
}

// Check for error handling components
function checkErrorHandlingComponents(outputChannel: vscode.OutputChannel) {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        errorHandlingEnabled = false;
        return;
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const errorHandlingPath = path.join(workspaceFolder, 'scripts', 'error_handling');
    
    try {
        if (fs.existsSync(errorHandlingPath)) {
            // Check for core error handling files
            const coreFiles = [
                'transaction_manager.sh',
                'logger.sh',
                'integrity_checker.sh',
                'self_healer.sh',
                'error_common.sh'
            ];
            
            let missingFiles = coreFiles.filter(file => 
                !fs.existsSync(path.join(errorHandlingPath, file))
            );
            
            if (missingFiles.length === 0) {
                errorHandlingEnabled = true;
                outputChannel.appendLine('Error handling components found and enabled');
                
                // Create necessary directories
                try {
                    // Run the make_dirs.sh script
                    const makeDirsPath = path.join(errorHandlingPath, 'make_dirs.sh');
                    if (fs.existsSync(makeDirsPath)) {
                        // Make sure the script is executable
                        cp.spawnSync('chmod', ['+x', makeDirsPath]);
                        
                        // Run the script
                        const makeDirsProcess = cp.spawnSync(makeDirsPath, [], {
                            cwd: workspaceFolder,
                            encoding: 'utf8',
                            shell: true
                        });
                        
                        if (makeDirsProcess.error) {
                            outputChannel.appendLine(`Error creating directories: \${makeDirsProcess.stderr || makeDirsProcess.error?.message || "Unknown error".stderr || processResult.error?.message || "Unknown error"}`);
                        } else {
                            outputChannel.appendLine(`Directory setup complete: \${makeDirsProcess.stdout}`);
                        }
                    } else {
                        // Create dirs manually
                        const dirs = [
                            path.join(workspaceFolder, '.vscode-xcode-integration'),
                            path.join(workspaceFolder, '.vscode-xcode-integration', 'logs'),
                            path.join(workspaceFolder, '.vscode-xcode-integration', 'temp'),
                            path.join(workspaceFolder, '.vscode-xcode-integration', 'temp', 'transactions'),
                            path.join(workspaceFolder, '.vscode-xcode-integration', 'backups')
                        ];
                        
                        dirs.forEach(dir => {
                            if (!fs.existsSync(dir)) {
                                fs.mkdirSync(dir, { recursive: true });
                                outputChannel.appendLine(`Created directory: \${dir}`);
                            }
                        });
                    }
                } catch (error) {
                    outputChannel.appendLine(`Error setting up error handling directories: \${error}`);
                }
                
                // Make scripts executable
                try {
                    // Run the make_scripts_executable.sh script
                    const makeExecPath = path.join(errorHandlingPath, 'make_scripts_executable.sh');
                    if (fs.existsSync(makeExecPath)) {
                        // Make sure the script itself is executable
                        cp.spawnSync('chmod', ['+x', makeExecPath]);
                        
                        // Run the script
                        const makeExecProcess = cp.spawnSync(makeExecPath, [], {
                            cwd: workspaceFolder,
                            encoding: 'utf8',
                            shell: true
                        });
                        
                        if (makeExecProcess.error) {
                            outputChannel.appendLine(`Error making scripts executable: \${makeExecProcess.stderr || makeExecProcess.error?.message || "Unknown error".stderr || processResult.error?.message || "Unknown error"}`);
                        } else {
                            outputChannel.appendLine(`Scripts made executable: \${makeExecProcess.stdout}`);
                        }
                    } else {
                        // Make scripts executable manually
                        coreFiles.forEach(file => {
                            const scriptPath = path.join(errorHandlingPath, file);
                            cp.spawnSync('chmod', ['+x', scriptPath]);
                            outputChannel.appendLine(`Made executable: \${scriptPath}`);
                        });
                    }
                } catch (error) {
                    outputChannel.appendLine(`Error making scripts executable: \${error}`);
                }
            } else {
                errorHandlingEnabled = false;
                outputChannel.appendLine(`Error handling components missing: \${missingFiles.join(', ')}`);
            }
        } else {
            errorHandlingEnabled = false;
            outputChannel.appendLine('Error handling components not found at: ' + errorHandlingPath);
        }
    } catch (err) {
        errorHandlingEnabled = false;
        outputChannel.appendLine(`Error checking error handling components: \${err}`);
    }
    
    updateTransactionStatusItem();
}

// Update transaction status item
function updateTransactionStatusItem() {
    const errorHandlingConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.errorHandling');
    const enableTransactions = errorHandlingConfig.get<boolean>('enableTransactions', true) && errorHandlingEnabled;
    
    if (enableTransactions) {
        transactionStatusItem.text = "$(database) Transactions: Ready";
        transactionStatusItem.tooltip = "Transaction Status: Enabled";
        transactionStatusItem.show();
    } else {
        transactionStatusItem.text = "$(database) Transactions: Disabled";
        transactionStatusItem.tooltip = "Transaction Status: Disabled";
        transactionStatusItem.show();
    }
}

// Check for security components
function checkSecurityComponents(outputChannel: vscode.OutputChannel) {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        securityEnabled = false;
        return;
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const securityPath = path.join(workspaceFolder, 'scripts', 'security');
    
    try {
        if (fs.existsSync(securityPath)) {
            // Check for core security files
            const coreFiles = [
                'security_common.sh',
                'path_validator.sh',
                'permissions_checker.sh',
                'sensitive_data_scanner.sh'
            ];
            
            let missingFiles = coreFiles.filter(file => 
                !fs.existsSync(path.join(securityPath, file))
            );
            
            if (missingFiles.length === 0) {
                securityEnabled = true;
                outputChannel.appendLine('Security components found and enabled');
                
                // Update security config with allowed paths
                updateSecurityConfig(outputChannel);
            } else {
                securityEnabled = false;
                outputChannel.appendLine(`Security components missing: \${missingFiles.join(', ')}`);
            }
        } else {
            securityEnabled = false;
            outputChannel.appendLine('Security components not found at: ' + securityPath);
        }
    } catch (err) {
        securityEnabled = false;
        outputChannel.appendLine(`Error checking security components: \${err}`);
    }
    
    updateSecurityStatusItem();
}

// Update security configuration
function updateSecurityConfig(outputChannel: vscode.OutputChannel) {
    try {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return;
        }
        
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const securityConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.security');
        
        // Get paths to update
        const allowedExternalPaths = securityConfig.get<string[]>('allowedExternalPaths', []);
        const securityLogLevel = securityConfig.get<string>('securityLogLevel', 'INFO');
        const securityLogFile = securityConfig.get<string>('securityLogFile', '');
        const interactiveMode = securityConfig.get<boolean>('interactiveMode', true);
        
        // Create the config file
        const configPath = path.join(workspaceFolder, 'scripts', 'security', 'security_config.json');
        
        // Create config object
        const config = {
            log_level: securityLogLevel,
            log_file: securityLogFile,
            interactive: interactiveMode,
            auto_fix: securityConfig.get<string>('autoFixPermissions', 'ask') === 'auto',
            scan_settings: {
                entropy_threshold: 3.5,
                max_file_size: 5242880,
                skip_extensions: ["jpg", "jpeg", "png", "gif", "ico", "svg", "ttf", "woff", "woff2", "eot", "mp3", "mp4", "avi", "webm", "pdf", "doc", "docx", "xls", "xlsx", "bin"]
            },
            path_validation: {
                enable_validation: securityConfig.get<boolean>('validatePaths', true),
                default_action: "block",
                allowed_external_dirs: allowedExternalPaths
            },
            permission_checking: {
                check_before_operations: securityConfig.get<boolean>('checkPermissions', true),
                auto_fix_level: securityConfig.get<string>('autoFixPermissions', 'ask')
            }
        };
        
        // Write config file
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        outputChannel.appendLine(`Updated security configuration at \${configPath}`);
        
        // Update allowlist file for paths
        const pathAllowlistPath = path.join(workspaceFolder, 'scripts', 'security', 'path_allowlist.txt');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(path.dirname(pathAllowlistPath))) {
            fs.mkdirSync(path.dirname(pathAllowlistPath), { recursive: true });
        }
        
        // Write allowlist file with header
        const allowlistContent = 
            "# VSCode-Xcode Integration path allowlist\n" +
            "# Add one absolute path per line\n" +
            "# These paths will be allowed for operations even if outside the project boundaries\n" +
            allowedExternalPaths.join('\n');
            
        fs.writeFileSync(pathAllowlistPath, allowlistContent);
        outputChannel.appendLine(`Updated path allowlist at \${pathAllowlistPath}`);
        
    } catch (err) {
        outputChannel.appendLine(`Error updating security configuration: \${err}`);
    }
}

// Update security status item
function updateSecurityStatusItem() {
    const securityConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.security');
    const enabled = securityConfig.get<boolean>('enableSecurityChecks', true) && securityEnabled;
    
    if (enabled) {
        securityStatusItem.text = "$(shield) Secure";
        securityStatusItem.tooltip = "Xcode Integration Security: Enabled";
        securityStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        securityStatusItem.text = "$(shield) Security Disabled";
        securityStatusItem.tooltip = "Xcode Integration Security: Disabled";
        securityStatusItem.backgroundColor = undefined;
    }
}

// Setup file watcher with configuration options
function setupFileWatcher(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
    // Get configuration
    // @ts-ignore
// @ts-ignore - Used for reading configuration
const config = vscode.workspace.getConfiguration('vscode-xcode-integration');
    const enableAutoSync = config.get<boolean>('enableAutoSync', true);
    const watchExclude = config.get<string[]>('watchExclude', []);
    const debounceDelay = config.get<number>('debounceDelay', 1000);

    // Dispose of existing watcher
    if (fileWatcher) {
        fileWatcher.dispose();
    }

    if (!enableAutoSync) {
        outputChannel.appendLine('Auto sync is disabled - file watcher not created');
        syncStatusItem.text = "$(sync-ignored) Xcode: Manual";
        return;
    }

    try {
        // Create a new file watcher for Swift and other relevant files
        const fileWatcherPatterns = [
            '**/*.swift', '**/*.h', '**/*.m', '**/*.mm', 
            '**/*.c', '**/*.cpp', '**/*.storyboard', '**/*.xib',
            '**/*.xcassets/**/*.{json,png,jpg,jpeg}', '**/*.xcdatamodeld/**/*.{xcdatamodel}'
        ];

        fileWatcher = vscode.workspace.createFileSystemWatcher(
            `{\${fileWatcherPatterns.join(',')}}`,
            false, // Don't ignore creates
            false, // Don't ignore changes
            false  // Don't ignore deletes
        );

        // Create a debounced function for file changes
        const debouncedHandleFileChange = debounce((uri: vscode.Uri) => {
            // Skip excluded paths
            for (const pattern of watchExclude) {
                if (uri.fsPath.match(new RegExp(pattern.replace(/\*/g, ".*")))) {
                    outputChannel.appendLine(`File ${uri.fsPath} excluded from sync (matched ${pattern})`);
                    return;
                }
            }

            handleFileChange(uri, outputChannel);
        }, debounceDelay);

        // Add event listeners
        fileWatcher.onDidChange(debouncedHandleFileChange);
        fileWatcher.onDidCreate(debouncedHandleFileChange);
        fileWatcher.onDidDelete(uri => {
            outputChannel.appendLine(`File deleted: ${uri.fsPath} - notifying Xcode`);
            // We need special handling for file deletion
            handleFileDelete(uri, outputChannel);
        });

        outputChannel.appendLine('File watcher created with patterns: ' + fileWatcherPatterns.join(', '));
        syncStatusItem.text = "$(sync) Xcode: Ready";
        
        context.subscriptions.push(fileWatcher);
    } catch (err) {
        outputChannel.appendLine(`Error setting up file watcher: \${err}`);
        vscode.window.showErrorMessage(`Failed to set up Xcode integration: \${err}`);
    }
}

// Handle file changes
function handleFileChange(uri: vscode.Uri, outputChannel: vscode.OutputChannel) {
    // @ts-ignore
// @ts-ignore - Used for processing the file path
const filePath = uri.fsPath;
    outputChannel.appendLine(`File changed: \${filePath}`);
    
    // Update status bar
    syncStatusItem.text = "$(sync~spin) Xcode: Syncing...";
    
    try {
        let scriptPath: string;
        let args: string[];
        let extraEnv: {[key: string]: string} = {};
        
        // Add security configuration
        const securityConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.security');
        // @ts-ignore
// @ts-ignore - Used for configuration status
const securityEnabled = securityConfig.get<boolean>('enableSecurityChecks', true);
        
        if (securityEnabled) {
            // Pass security settings via environment variables
            extraEnv['SECURITY_LOG_LEVEL'] = securityConfig.get<string>('securityLogLevel', 'INFO');
            extraEnv['SECURITY_INTERACTIVE'] = securityConfig.get<boolean>('interactiveMode', true) ? 'true' : 'false';
            
            // Set log file if specified
            const logFile = securityConfig.get<string>('securityLogFile', '');
            if (logFile) {
                extraEnv['SECURITY_LOG_FILE'] = logFile;
            }
            
            // Set auto-fix level
            const autoFixLevel = securityConfig.get<string>('autoFixPermissions', 'ask');
            extraEnv['SECURITY_AUTO_FIX'] = autoFixLevel === 'auto' ? 'true' : 'false';
        }
        
        // Add error handling configuration
        const errorHandlingConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.errorHandling');
        const enableTransactions = errorHandlingConfig.get<boolean>('enableTransactions', true) && errorHandlingEnabled;
        
        if (enableTransactions) {
            // Pass error handling settings via environment variables
            extraEnv['ERROR_HANDLING_ENABLED'] = 'true';
            extraEnv['LOG_LEVEL'] = errorHandlingConfig.get<string>('logLevel', 'INFO');
            
            // Set auto-repair level
            const autoRepair = errorHandlingConfig.get<boolean>('autoRepair', false);
            extraEnv['AUTO_REPAIR'] = autoRepair ? 'true' : 'false';
            
            // Set transaction log file if specified
            const transactionLogFile = errorHandlingConfig.get<string>('transactionLogFile', '');
            if (transactionLogFile) {
                extraEnv['TRANSACTION_LOG_FILE'] = transactionLogFile;
            }
            
            // Update transaction status
            transactionStatusItem.text = "$(database~spin) Transactions: Active";
        }
        
        // Determine if this is a resource file that needs special handling
        if (isResourceFile(filePath)) {
            outputChannel.appendLine(`Resource file detected, using specialized handler`);
            scriptPath = getScriptPath('handle_resource_file.sh');
            args = [filePath];
        } else {
            scriptPath = getScriptPath('update_xcode_references.sh');
            args = [filePath];
        }
        
        // Run the sync script
        const processResult = cp.spawnSync(scriptPath, args, {
            cwd: vscode.workspace.workspaceFolders![0].uri.fsPath,
            encoding: 'utf8',
            shell: true,
            env: { ...process.env, ...extraEnv }
        });
        
        if ((process as any).error) {
            outputChannel.appendLine(`Error executing script: \${process.stderr || process.error?.message || "Unknown error".stderr || processResult.error?.message || "Unknown error"}`);
            vscode.window.showErrorMessage(`Failed to sync with Xcode: \${process.stderr || process.error?.message || "Unknown error".stderr || processResult.error?.message || "Unknown error"}`);
            syncStatusItem.text = "$(error) Xcode: Sync Error";
            
            // Update transaction status on error
            if (enableTransactions) {
                transactionStatusItem.text = "$(database) Transactions: Error";
                transactionStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            }
            
            return;
        }
        
        outputChannel.appendLine(`Script output: \${processResult.stdout}`);
        if (processResult.stdout) {
            outputChannel.appendLine(`Script error: \${processResult.stdout}`);
        }
        
        // Check for security warnings in output
        if (processResult.stdout && processResult.stdout.includes('security') || 
            processResult.stdout && processResult.stdout.includes('Security')) {
            vscode.window.showWarningMessage('Security warning during sync. Check the output for details.', 'Show Details')
                .then(selection => {
                    if (selection === 'Show Details') {
                        outputChannel.show();
                    }
                });
        }
        
        // Check for error handling messages
        if (processResult.stdout && processResult.stdout.includes('ERROR') || 
            processResult.stdout && processResult.stdout.includes('ERROR')) {
            vscode.window.showWarningMessage('Errors occurred during sync. Check the output for details.', 'Show Details', 'Repair')
                .then(selection => {
                    if (selection === 'Show Details') {
                        outputChannel.show();
                    } else if (selection === 'Repair') {
                        vscode.commands.executeCommand('vscode-xcode-integration.repairProject');
                    }
                });
        }
        
        // Update status
        syncStatusItem.text = "$(check) Xcode: Synced";
        lastSyncFile = filePath;
        lastSyncTime = new Date();
        
        // Update transaction status
        if (enableTransactions) {
            transactionStatusItem.text = "$(database) Transactions: Ready";
            transactionStatusItem.backgroundColor = undefined;
        }
        
        // Show notification
        // @ts-ignore
// @ts-ignore - Used for reading configuration
const config = vscode.workspace.getConfiguration('vscode-xcode-integration');
        if (config.get<boolean>('showNotifications', true)) {
            // @ts-ignore
// @ts-ignore - Used in notification display
const fileType = isResourceFile(filePath) ? 
                getResourceFileType(filePath) : 
                path.extname(filePath).replace('.', '');
                
            vscode.window.showInformationMessage(`Synced \${fileType} file with Xcode: ${path.basename(filePath)}`);
        }
    } catch (err) {
        outputChannel.appendLine(`Error syncing file: \${err}`);
        vscode.window.showErrorMessage(`Failed to sync with Xcode: \${err}`);
        syncStatusItem.text = "$(error) Xcode: Sync Error";
        
        // Update transaction status on error
        const errorHandlingConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.errorHandling');
        const enableTransactions = errorHandlingConfig.get<boolean>('enableTransactions', true) && errorHandlingEnabled;
        
        if (enableTransactions) {
            transactionStatusItem.text = "$(database) Transactions: Error";
            transactionStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    }
}

// Handle file deletion
function handleFileDelete(uri: vscode.Uri, outputChannel: vscode.OutputChannel) {
    // @ts-ignore
// @ts-ignore - Used for processing the file path
const filePath = uri.fsPath;
    outputChannel.appendLine(`File deleted: \${filePath}`);
    
    // Update Xcode project file to reflect deletion
    try {
        // We need to find the Xcode project file and touch it to ensure Xcode sees the changes
        const workspaceFolder = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const findProcess = cp.spawnSync('find', ['.', '-name', '*.xcodeproj', '-depth', '1', '-print', '-quit'], {
            cwd: workspaceFolder,
            encoding: 'utf8'
        });
        
        if (findProcess.error) {
            outputChannel.appendLine(`Error finding Xcode project: \${findProcess.stderr || findProcess.error?.message || "Unknown error".stderr || processResult.error?.message || "Unknown error"}`);
            return;
        }
        
        const xcodeProjectPath = findProcess.stdout.trim();
        if (!xcodeProjectPath) {
            outputChannel.appendLine('No Xcode project found');
            return;
        }
        
        const projectFilePath = path.join(workspaceFolder, xcodeProjectPath, 'project.pbxproj');
        
        // Security check before touching project file
        const securityConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.security');
        // @ts-ignore
// @ts-ignore - Used for configuration status
const securityEnabled = securityConfig.get<boolean>('enableSecurityChecks', true);
        
        if (securityEnabled) {
            // Check permissions first
            const scriptPath = getScriptPath('security/permissions_checker.sh');
            const args = ['-o', 'write', projectFilePath];
            
            const permProcess = cp.spawnSync(scriptPath, args, {
                cwd: workspaceFolder,
                encoding: 'utf8',
                shell: true
            });
            
            if (permProcess.status !== 0) {
                outputChannel.appendLine(`Security check failed for project file: \${permProcess.stderr}`);
                vscode.window.showWarningMessage(`Cannot update project file due to permission issues. \${permProcess.stderr}`);
                return;
            }
        }
        
        // Add error handling with transactions
        const errorHandlingConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.errorHandling');
        const enableTransactions = errorHandlingConfig.get<boolean>('enableTransactions', true) && errorHandlingEnabled;
        
        if (enableTransactions) {
            // Pass error handling settings via environment variables
            let extraEnv: {[key: string]: string} = {};
            extraEnv['ERROR_HANDLING_ENABLED'] = 'true';
            extraEnv['LOG_LEVEL'] = errorHandlingConfig.get<string>('logLevel', 'INFO');
            
            // Set transaction log file if specified
            const transactionLogFile = errorHandlingConfig.get<string>('transactionLogFile', '');
            if (transactionLogFile) {
                extraEnv['TRANSACTION_LOG_FILE'] = transactionLogFile;
            }
            
            // Update transaction status
            transactionStatusItem.text = "$(database~spin) Transactions: Active";
            
            // Start a transaction for the file deletion
            const transactionScriptPath = getScriptPath('error_handling/transaction_manager.sh');
            const transactionProcess = cp.spawnSync(transactionScriptPath, ['start', 'FILE_DELETE'], {
                cwd: workspaceFolder,
                encoding: 'utf8',
                shell: true,
                env: { ...process.env, ...extraEnv }
            });
            
            if (transactionProcess.error) {
                outputChannel.appendLine(`Error starting transaction: \${transactionProcess.stderr || transactionProcess.error?.message || "Unknown error".stderr || processResult.error?.message || "Unknown error"}`);
            } else {
                const transactionId = transactionProcess.stdout.trim();
                outputChannel.appendLine(`Started transaction ${transactionId} for file deletion`);
                
                // Backup the project file before modifying
                const backupScriptPath = getScriptPath('error_handling/transaction_manager.sh');
                cp.spawnSync(backupScriptPath, ['backup_file', transactionId, projectFilePath], {
                    cwd: workspaceFolder,
                    encoding: 'utf8',
                    shell: true
                });
                
                // Touch the project file
                cp.spawnSync('touch', [projectFilePath], { cwd: workspaceFolder });
                outputChannel.appendLine(`Touched Xcode project file: \${projectFilePath}`);
                
                // Commit the transaction
                cp.spawnSync(transactionScriptPath, ['commit', transactionId], {
                    cwd: workspaceFolder,
                    encoding: 'utf8',
                    shell: true
                });
                
                // Update transaction status
                transactionStatusItem.text = "$(database) Transactions: Ready";
            }
        } else {
            // Without transactions, just touch the project file
            cp.spawnSync('touch', [projectFilePath], { cwd: workspaceFolder });
            outputChannel.appendLine(`Touched Xcode project file: \${projectFilePath}`);
        }
        
        // Show notification
        // @ts-ignore
// @ts-ignore - Used for reading configuration
const config = vscode.workspace.getConfiguration('vscode-xcode-integration');
        if (config.get<boolean>('showNotifications', true)) {
            vscode.window.showInformationMessage(`Notified Xcode of deleted file: \${path.basename(filePath)}`);
        }
    } catch (err) {
        outputChannel.appendLine(`Error handling file deletion: \${err}`);
        
        // Update transaction status on error
        const errorHandlingConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.errorHandling');
        const enableTransactions = errorHandlingConfig.get<boolean>('enableTransactions', true) && errorHandlingEnabled;
        
        if (enableTransactions) {
            transactionStatusItem.text = "$(database) Transactions: Error";
            transactionStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    }
}

// Sync current file
function syncCurrentFile(outputChannel: vscode.OutputChannel) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage('No file is currently open');
        return;
    }
    
    handleFileChange(editor.document.uri, outputChannel);
}

// Sync entire project
function syncEntireProject(outputChannel: vscode.OutputChannel) {
    outputChannel.appendLine('Syncing entire project with Xcode');
    syncStatusItem.text = "$(sync~spin) Xcode: Syncing Project...";
    
    try {
        const scriptPath = getScriptPath('monitor_project_structure.sh');
        const args = ['--project-dir', vscode.workspace.workspaceFolders![0].uri.fsPath, '--one-time'];
        
        // Add security configuration
        let extraEnv: {[key: string]: string} = {};
        const securityConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.security');
        // @ts-ignore
// @ts-ignore - Used for configuration status
const securityEnabled = securityConfig.get<boolean>('enableSecurityChecks', true);
        
        if (securityEnabled) {
            // Pass security settings via environment variables
            extraEnv['SECURITY_LOG_LEVEL'] = securityConfig.get<string>('securityLogLevel', 'INFO');
            extraEnv['SECURITY_INTERACTIVE'] = securityConfig.get<boolean>('interactiveMode', true) ? 'true' : 'false';
            
            // Set log file if specified
            const logFile = securityConfig.get<string>('securityLogFile', '');
            if (logFile) {
                extraEnv['SECURITY_LOG_FILE'] = logFile;
            }
            
            // Set auto-fix level
            const autoFixLevel = securityConfig.get<string>('autoFixPermissions', 'ask');
            extraEnv['SECURITY_AUTO_FIX'] = autoFixLevel === 'auto' ? 'true' : 'false';
        }
        
        // Add error handling configuration
        const errorHandlingConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.errorHandling');
        const enableTransactions = errorHandlingConfig.get<boolean>('enableTransactions', true) && errorHandlingEnabled;
        
        if (enableTransactions) {
            // Pass error handling settings via environment variables
            extraEnv['ERROR_HANDLING_ENABLED'] = 'true';
            extraEnv['LOG_LEVEL'] = errorHandlingConfig.get<string>('logLevel', 'INFO');
            
            // Set auto-repair level
            const autoRepair = errorHandlingConfig.get<boolean>('autoRepair', false);
            extraEnv['AUTO_REPAIR'] = autoRepair ? 'true' : 'false';
            
            // Set transaction log file if specified
            const transactionLogFile = errorHandlingConfig.get<string>('transactionLogFile', '');
            if (transactionLogFile) {
                extraEnv['TRANSACTION_LOG_FILE'] = transactionLogFile;
            }
            
            // Update transaction status
            transactionStatusItem.text = "$(database~spin) Transactions: Active";
        }
        
        const processResult = cp.spawnSync(scriptPath, args, {
            cwd: vscode.workspace.workspaceFolders![0].uri.fsPath,
            encoding: 'utf8',
            shell: true,
            env: { ...process.env, ...extraEnv }
        });
        
        if ((process as any).error) {
            outputChannel.appendLine(`Error executing script: \${process.stderr || process.error?.message || "Unknown error".stderr || processResult.error?.message || "Unknown error"}`);
            vscode.window.showErrorMessage(`Failed to sync project with Xcode: \${processResult.stderr || processResult.error?.message || "Unknown error"}`);
            syncStatusItem.text = "$(error) Xcode: Sync Error";
            
            // Update transaction status on error
            if (enableTransactions) {
                transactionStatusItem.text = "$(database) Transactions: Error";
                transactionStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            }
            
            return;
        }
        
        outputChannel.appendLine(`Script output: \${processResult.stdout}`);
        if (processResult.stdout) {
            outputChannel.appendLine(`Script error: \${processResult.stdout}`);
        }
        
        // Update status
        syncStatusItem.text = "$(check) Xcode: Project Synced";
        lastSyncTime = new Date();
        
        // Update transaction status
        if (enableTransactions) {
            transactionStatusItem.text = "$(database) Transactions: Ready";
            transactionStatusItem.backgroundColor = undefined;
        }
        
        // Show notification
        // @ts-ignore
// @ts-ignore - Used for reading configuration
const config = vscode.workspace.getConfiguration('vscode-xcode-integration');
        if (config.get<boolean>('showNotifications', true)) {
            vscode.window.showInformationMessage('Project successfully synced with Xcode');
        }
    } catch (err) {
        outputChannel.appendLine(`Error syncing project: \${err}`);
        vscode.window.showErrorMessage(`Failed to sync project with Xcode: \${err}`);
        syncStatusItem.text = "$(error) Xcode: Sync Error";
        
        // Update transaction status on error
        const errorHandlingConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.errorHandling');
        const enableTransactions = errorHandlingConfig.get<boolean>('enableTransactions', true) && errorHandlingEnabled;
        
        if (enableTransactions) {
            transactionStatusItem.text = "$(database) Transactions: Error";
            transactionStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    }
}

// Check project integrity
function checkProjectIntegrity(outputChannel: vscode.OutputChannel) {
    if (!errorHandlingEnabled) {
        vscode.window.showWarningMessage('Error handling features are disabled. Enable them in settings to use this function.', 'Open Settings')
            .then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'vscode-xcode-integration.errorHandling');
                }
            });
        return;
    }
    
    outputChannel.appendLine('Checking project integrity...');
    outputChannel.show();
    
    try {
        // Get Xcode project path from settings
        // @ts-ignore
// @ts-ignore - Used for reading configuration
const config = vscode.workspace.getConfiguration('vscode-xcode-integration');
        const projectPathSetting = config.get<string>('projectPath', '');
        const workspaceFolder = vscode.workspace.workspaceFolders![0].uri.fsPath;
        
        let projectPath = '';
        if (projectPathSetting) {
            projectPath = path.join(workspaceFolder, projectPathSetting);
        } else {
            // Try to find the Xcode project
            const findProcess = cp.spawnSync('find', ['.', '-name', '*.xcodeproj', '-depth', '1', '-print', '-quit'], {
                cwd: workspaceFolder,
                encoding: 'utf8'
            });
            
            if (findProcess.error) {
                outputChannel.appendLine(`Error finding Xcode project: \${findProcess.stderr || findProcess.error?.message || "Unknown error".stderr || processResult.error?.message || "Unknown error"}`);
                vscode.window.showErrorMessage('Failed to find Xcode project. Set project path in settings.');
                return;
            }
            
            projectPath = path.join(workspaceFolder, findProcess.stdout.trim());
        }
        
        if (!projectPath || !fs.existsSync(projectPath)) {
            outputChannel.appendLine(`Xcode project not found: \${projectPath}`);
            vscode.window.showErrorMessage('Xcode project not found. Set correct project path in settings.');
            return;
        }
        
        // Ask for verbosity level
        vscode.window.showQuickPick(
            [
                { label: 'Minimal', description: 'Basic checks only', id: 'minimal' },
                { label: 'Normal', description: 'Standard integrity checks', id: 'normal' },
                { label: 'Detailed', description: 'Comprehensive checks (may take longer)', id: 'detailed' }
            ],
            { placeHolder: 'Select integrity check verbosity level' }
        ).then(selection => {
            if (!selection) return;
            
            // Get error handling configuration
            const errorHandlingConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.errorHandling');
            const logLevel = errorHandlingConfig.get<string>('logLevel', 'INFO');
            
            // Set up environment variables
            const extraEnv: {[key: string]: string} = {
                'LOG_LEVEL': logLevel
            };
            
            // Set log file if specified
            const logFile = errorHandlingConfig.get<string>('transactionLogFile', '');
            if (logFile) {
                extraEnv['LOG_FILE'] = logFile;
            }
            
            // Open a terminal for the check (more interactive)
            const terminal = vscode.window.createTerminal('Project Integrity Check');
            terminal.sendText(`export LOG_LEVEL=\${logLevel}`);
            if (logFile) {
                terminal.sendText(`export LOG_FILE="${logFile}"`);
            }
            
            // @ts-ignore
// @ts-ignore - Used in terminal commands
const integrityCheckerPath = getScriptPath('error_handling/integrity_checker.sh');
            terminal.sendText(`\${integrityCheckerPath} check "${projectPath}" ${selection.id}`);
            terminal.show();
        });
    } catch (err) {
        outputChannel.appendLine(`Error checking project integrity: \${err}`);
        vscode.window.showErrorMessage(`Failed to check project integrity: \${err}`);
    }
}

// Repair project
function repairProject(outputChannel: vscode.OutputChannel) {
    if (!errorHandlingEnabled) {
        vscode.window.showWarningMessage('Error handling features are disabled. Enable them in settings to use this function.', 'Open Settings')
            .then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'vscode-xcode-integration.errorHandling');
                }
            });
        return;
    }
    
    outputChannel.appendLine('Initiating project repair...');
    outputChannel.show();
    
    try {
        // Get Xcode project path from settings
        // @ts-ignore
// @ts-ignore - Used for reading configuration
const config = vscode.workspace.getConfiguration('vscode-xcode-integration');
        const projectPathSetting = config.get<string>('projectPath', '');
        const workspaceFolder = vscode.workspace.workspaceFolders![0].uri.fsPath;
        
        let projectPath = '';
        if (projectPathSetting) {
            projectPath = path.join(workspaceFolder, projectPathSetting);
        } else {
            // Try to find the Xcode project
            const findProcess = cp.spawnSync('find', ['.', '-name', '*.xcodeproj', '-depth', '1', '-print', '-quit'], {
                cwd: workspaceFolder,
                encoding: 'utf8'
            });
            
            if (findProcess.error) {
                outputChannel.appendLine(`Error finding Xcode project: \${findProcess.stderr || findProcess.error?.message || "Unknown error".stderr || processResult.error?.message || "Unknown error"}`);
                vscode.window.showErrorMessage('Failed to find Xcode project. Set project path in settings.');
                return;
            }
            
            projectPath = path.join(workspaceFolder, findProcess.stdout.trim());
        }
        
        if (!projectPath || !fs.existsSync(projectPath)) {
            outputChannel.appendLine(`Xcode project not found: \${projectPath}`);
            vscode.window.showErrorMessage('Xcode project not found. Set correct project path in settings.');
            return;
        }
        
        // Ask for repair mode
        vscode.window.showQuickPick(
            [
                { label: 'Interactive', description: 'Confirm each repair action', id: 'interactive' },
                { label: 'Guided', description: 'Confirm major repair actions', id: 'guided' },
                { label: 'Automatic', description: 'Automatically repair all issues', id: 'automatic' }
            ],
            { placeHolder: 'Select repair mode' }
        ).then(selection => {
            if (!selection) return;
            
            // Get error handling configuration
            const errorHandlingConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.errorHandling');
            const logLevel = errorHandlingConfig.get<string>('logLevel', 'INFO');
            
            // Set up environment variables
            const extraEnv: {[key: string]: string} = {
                'LOG_LEVEL': logLevel
            };
            
            // Set log file if specified
            const logFile = errorHandlingConfig.get<string>('transactionLogFile', '');
            if (logFile) {
                extraEnv['LOG_FILE'] = logFile;
            }
            
            // Open a terminal for the repair (more interactive)
            const terminal = vscode.window.createTerminal('Project Repair');
            terminal.sendText(`export LOG_LEVEL=\${logLevel}`);
            if (logFile) {
                terminal.sendText(`export LOG_FILE="${logFile}"`);
            }
            
            // @ts-ignore
// @ts-ignore - Used in terminal commands
const selfHealerPath = getScriptPath('error_handling/self_healer.sh');
            terminal.sendText(`\${selfHealerPath} repair "${projectPath}" ${selection.id}`);
            terminal.show();
        });
    } catch (err) {
        outputChannel.appendLine(`Error repairing project: \${err}`);
        vscode.window.showErrorMessage(`Failed to repair project: \${err}`);
    }
}

// View transaction log
function viewTransactionLog(outputChannel: vscode.OutputChannel) {
    if (!errorHandlingEnabled) {
        vscode.window.showWarningMessage('Error handling features are disabled. Enable them in settings to use this function.', 'Open Settings')
            .then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'vscode-xcode-integration.errorHandling');
                }
            });
        return;
    }
    
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders![0].uri.fsPath;
        
        // Look for transaction log file
        const errorHandlingConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.errorHandling');
        let logFile = errorHandlingConfig.get<string>('transactionLogFile', '');
        
        if (!logFile) {
            // Use default log file
            logFile = path.join(workspaceFolder, '.vscode-xcode-integration', 'logs', 'integration.log');
        }
        
        if (fs.existsSync(logFile)) {
            // Open the log file
            vscode.workspace.openTextDocument(logFile).then(document => {
                vscode.window.showTextDocument(document);
            });
        } else {
            // Try to get active transactions
            const transactionScriptPath = getScriptPath('error_handling/transaction_manager.sh');
            
            // List active transactions in terminal
            const terminal = vscode.window.createTerminal('Transactions');
            terminal.sendText(`${transactionScriptPath} list`);
            terminal.show();
        }
    } catch (err) {
        outputChannel.appendLine(`Error viewing transaction log: \${err}`);
        vscode.window.showErrorMessage(`Failed to view transaction log: \${err}`);
    }
}

// Security functions
// Scan for sensitive data
function scanForSensitiveData(outputChannel: vscode.OutputChannel) {
    const securityConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.security');
    // @ts-ignore
// @ts-ignore - Used for configuration status
const securityEnabled = securityConfig.get<boolean>('enableSecurityChecks', true);
    
    if (!securityEnabled) {
        vscode.window.showWarningMessage('Security features are disabled. Enable them in settings to use this function.', 'Open Settings')
            .then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'vscode-xcode-integration.security');
                }
            });
        return;
    }
    
    // Get target to scan
    let scanTarget: string | undefined;
    let scanType: string = 'file';
    
    // If a file is open, use that as default
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        scanTarget = editor.document.uri.fsPath;
    }
    
    // Ask user what to scan
    vscode.window.showQuickPick([
        { label: 'Current File', description: editor ? path.basename(editor.document.uri.fsPath) : 'None open', id: 'file' },
        { label: 'Current Directory', description: 'Scan current directory', id: 'dir' },
        { label: 'Entire Project', description: 'Scan the entire project (may take a while)', id: 'project' }
    ], {
        placeHolder: 'Select what to scan for sensitive data'
    }).then(selection => {
        if (!selection) return;
        
        try {
            outputChannel.appendLine(`Starting sensitive data scan for \${selection.label}`);
            outputChannel.show();
            
            switch (selection.id) {
                case 'file':
                    scanType = 'file';
                    scanTarget = editor ? editor.document.uri.fsPath : undefined;
                    break;
                case 'dir':
                    scanType = 'directory';
                    scanTarget = vscode.workspace.workspaceFolders![0].uri.fsPath;
                    break;
                case 'project':
                    scanType = 'project';
                    scanTarget = vscode.workspace.workspaceFolders![0].uri.fsPath;
                    break;
            }
            
            if (!scanTarget) {
                vscode.window.showInformationMessage('No scan target selected.');
                return;
            }
            
            // Open a terminal for interactive scanning
            const terminal = vscode.window.createTerminal('Sensitive Data Scan');
            const scriptPath = getScriptPath('security/sensitive_data_scanner.sh');
            
            // Add arguments based on scan type
            if (scanType === 'project') {
                terminal.sendText(`${scriptPath} "${scanTarget}"`);
            } else if (scanType === 'directory') {
                terminal.sendText(`${scriptPath} "${scanTarget}"`);
            } else {
                // For file scanning, we can handle it within the extension
                const scanProcess = cp.spawnSync(scriptPath, [scanTarget], {
                    cwd: vscode.workspace.workspaceFolders![0].uri.fsPath,
                    encoding: 'utf8',
                    shell: true
                });
                
                outputChannel.appendLine(scanProcess.stdout);
                if (scanProcess.stderr) {
                    outputChannel.appendLine(scanProcess.stderr);
                }
                
                if (scanProcess.status === 0) {
                    vscode.window.showInformationMessage(`No sensitive data found in \${path.basename(scanTarget)}`);
                } else {
                    vscode.window.showWarningMessage(`Potential sensitive data found in ${path.basename(scanTarget)}. See output for details.`);
                    outputChannel.show();
                }
                
                return;
            }
            
            terminal.show();
            
        } catch (err) {
            outputChannel.appendLine(`Error during sensitive data scan: \${err}`);
            vscode.window.showErrorMessage(`Failed to scan for sensitive data: \${err}`);
        }
    });
}

// Validate project paths
function validateProjectPaths(outputChannel: vscode.OutputChannel) {
    const securityConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.security');
    // @ts-ignore
// @ts-ignore - Used for configuration status
const securityEnabled = securityConfig.get<boolean>('enableSecurityChecks', true);
    
    if (!securityEnabled) {
        vscode.window.showWarningMessage('Security features are disabled. Enable them in settings to use this function.', 'Open Settings')
            .then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'vscode-xcode-integration.security');
                }
            });
        return;
    }
    
    try {
        const scriptPath = getScriptPath('security/path_validator.sh');
        const projectPath = vscode.workspace.workspaceFolders![0].uri.fsPath;
        
        vscode.window.showInformationMessage(`Validating project paths. This may take a moment...`);
        outputChannel.appendLine('Validating project paths for potential security issues...');
        outputChannel.show();
        
        // Create a terminal for the validation
        const terminal = vscode.window.createTerminal('Path Validation');
        
        // Find project files
        terminal.sendText(`echo "Scanning project for path security issues..."`);
        terminal.sendText(`find "${projectPath}" -type f -name "*.swift" -o -name "*.h" -o -name "*.m" -o -name "*.mm" | while read file; do`);
        terminal.sendText(`  echo "Checking: $file"`);
        terminal.sendText(`  ${scriptPath} "$file" "${projectPath}" read`);
        terminal.sendText(`done`);
        terminal.sendText(`echo "Path validation complete!"`);
        
        terminal.show();
        
    } catch (err) {
        outputChannel.appendLine(`Error validating project paths: \${err}`);
        vscode.window.showErrorMessage(`Failed to validate project paths: \${err}`);
    }
}

// Check file permissions
function checkFilePermissions(outputChannel: vscode.OutputChannel) {
    const securityConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.security');
    // @ts-ignore
// @ts-ignore - Used for configuration status
const securityEnabled = securityConfig.get<boolean>('enableSecurityChecks', true);
    
    if (!securityEnabled) {
        vscode.window.showWarningMessage('Security features are disabled. Enable them in settings to use this function.', 'Open Settings')
            .then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'vscode-xcode-integration.security');
                }
            });
        return;
    }
    
    // Get target to check
    let checkTarget: string | undefined;
    
    // If a file is open, use that as default
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        checkTarget = editor.document.uri.fsPath;
        runPermissionCheck(checkTarget, outputChannel);
    } else {
        // Ask user to select a file
        vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Check Permissions'
        }).then(fileUri => {
            if (fileUri && fileUri.length > 0) {
                checkTarget = fileUri[0].fsPath;
                runPermissionCheck(checkTarget, outputChannel);
            }
        });
    }
}

// Run permission check on a file
function runPermissionCheck(filePath: string, outputChannel: vscode.OutputChannel) {
    try {
        const scriptPath = getScriptPath('security/permissions_checker.sh');
        
        outputChannel.appendLine(`Checking permissions for: \${filePath}`);
        outputChannel.show();
        
        // Run the permission check
        const checkProcess = cp.spawnSync(scriptPath, ['-f', filePath, 'rwx'], {
            cwd: vscode.workspace.workspaceFolders![0].uri.fsPath,
            encoding: 'utf8',
            shell: true
        });
        
        outputChannel.appendLine(checkProcess.stdout);
        if (checkProcess.stderr) {
            outputChannel.appendLine(checkProcess.stderr);
        }
        
        if (checkProcess.status === 0) {
            vscode.window.showInformationMessage(`Permissions check passed for \${path.basename(filePath)}`);
        } else {
            vscode.window.showWarningMessage(`Permission issues found with ${path.basename(filePath)}. See output for details.`);
            outputChannel.show();
        }
    } catch (err) {
        outputChannel.appendLine(`Error checking permissions: \${err}`);
        vscode.window.showErrorMessage(`Failed to check permissions: \${err}`);
    }
}

// Show security status
function showSecurityStatus(outputChannel: vscode.OutputChannel) {
    const securityConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.security');
    // @ts-ignore
// @ts-ignore - Used for configuration status
const securityEnabled = securityConfig.get<boolean>('enableSecurityChecks', true);
    
    const status = [
        `Xcode Integration Security Status:`,
        `- Security checks: \${securityEnabled ? 'Enabled' : 'Disabled'}`,
        `- Path validation: \${securityConfig.get<boolean>('validatePaths', true) ? 'Enabled' : 'Disabled'}`,
        `- Permission checks: \${securityConfig.get<boolean>('checkPermissions', true) ? 'Enabled' : 'Disabled'}`,
        `- Sensitive data scanning: \${securityConfig.get<boolean>('checkSensitiveData', true) ? 'Enabled' : 'Disabled'}`,
        `- Automatic backups: \${securityConfig.get<boolean>('createBackups', true) ? 'Enabled' : 'Disabled'}`,
        `- Interactive mode: \${securityConfig.get<boolean>('interactiveMode', true) ? 'Enabled' : 'Disabled'}`,
        `- Auto-fix permissions: \${securityConfig.get<string>('autoFixPermissions', 'ask')}`,
        `- Security log level: \${securityConfig.get<string>('securityLogLevel', 'INFO')}`
    ];
    
    outputChannel.appendLine(status.join('\n'));
    outputChannel.show();
    
    // Show security configuration dialog
    vscode.window.showInformationMessage(status.join('\n'), 'Configure Security', 'View Security Log')
        .then(selection => {
            if (selection === 'Configure Security') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'vscode-xcode-integration.security');
            } else if (selection === 'View Security Log') {
                const logFile = securityConfig.get<string>('securityLogFile', '');
                if (logFile && fs.existsSync(logFile)) {
                    vscode.workspace.openTextDocument(logFile).then(doc => {
                        vscode.window.showTextDocument(doc);
                    });
                } else {
                    vscode.window.showInformationMessage('No security log file configured or file does not exist.');
                }
            }
        });
}

// Build project
function buildProject(outputChannel: vscode.OutputChannel) {
    outputChannel.appendLine('Building Xcode project');
    vscode.window.showInformationMessage('Building Xcode project...');
    
    // Execute the build task
    vscode.commands.executeCommand('workbench.action.tasks.runTask', 'Build with Xcode');
}

// Run tests
function runTests(outputChannel: vscode.OutputChannel) {
    outputChannel.appendLine('Running Xcode tests');
    vscode.window.showInformationMessage('Running Xcode tests...');
    
    // Execute the test task
    vscode.commands.executeCommand('workbench.action.tasks.runTask', 'Test with Xcode');
}

// Update dependencies
function updateDependencies(outputChannel: vscode.OutputChannel) {
    outputChannel.appendLine('Updating dependencies');
    
    // Show quick pick to choose dependency manager
    vscode.window.showQuickPick(
        ['Swift Package Manager', 'CocoaPods', 'Carthage', 'All'],
        { placeHolder: 'Select dependency manager to update' }
    ).then(selection => {
        if (!selection) return;
        
        let taskName = "";
        switch (selection) {
            case 'Swift Package Manager':
                taskName = 'Update Swift Packages';
                break;
            case 'CocoaPods':
                taskName = 'Update CocoaPods';
                break;
            case 'Carthage':
                taskName = 'Update Carthage';
                break;
            case 'All':
                // For 'All', we'll run the dependency manager script with appropriate args
                const scriptPath = getScriptPath('dependency_manager.sh');
                vscode.window.showInformationMessage('Updating all dependencies...');
                
                // Run the script in a terminal
                const terminal = vscode.window.createTerminal('Dependency Update');
                terminal.sendText(`${scriptPath} check`);
                terminal.sendText(`${scriptPath} update-spm`);
                terminal.sendText(`${scriptPath} update-pods`);
                terminal.sendText(`${scriptPath} update-carthage`);
                terminal.show();
                return;
        }
        
        // Execute the selected task
        vscode.commands.executeCommand('workbench.action.tasks.runTask', taskName);
    });
}

// Show status
function showStatus(outputChannel: vscode.OutputChannel) {
    // @ts-ignore
// @ts-ignore - Used for reading configuration
const config = vscode.workspace.getConfiguration('vscode-xcode-integration');
    const securityConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.security');
    // @ts-ignore
// @ts-ignore - Used for configuration status
const securityEnabled = securityConfig.get<boolean>('enableSecurityChecks', true);
    const errorHandlingConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.errorHandling');
    // @ts-ignore
// @ts-ignore - Used for status display
const errorHandlingActivated = errorHandlingConfig.get<boolean>('enableTransactions', true) && errorHandlingEnabled;
    
    // Get workspace info
    const hasWorkspace = multiProjectManager && multiProjectManager.currentWorkspace;
    const workspaceInfo = hasWorkspace ? 
        `- Workspace: \${path.basename(multiProjectManager.currentWorkspace!.workspace)}` : 
        `- Workspace: None detected`;
    
    const status = [
        `Xcode Integration Status:`,
        `- Auto sync: \${config.get<boolean>('enableAutoSync', true) ? 'Enabled' : 'Disabled'}`,
        `- Security: \${securityEnabled ? 'Enabled' : 'Disabled'}`,
        `- Error handling: \${errorHandlingActivated ? 'Enabled' : 'Disabled'}`,
        `- Multi-project support: \${hasWorkspace ? 'Active' : 'Inactive'}`,
        workspaceInfo,
        `- Last synced file: \${lastSyncFile ? path.basename(lastSyncFile) : 'N/A'}`,
        `- Last sync time: \${lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'N/A'}`
    ];
    
    outputChannel.appendLine(status.join('\n'));
    outputChannel.show();
    
    // Show a message dialog with status
    vscode.window.showInformationMessage(status.join('\n'), { modal: true });
}

// Show quick menu for Xcode actions
function showMenu() {
    // Get security status
    const securityConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.security');
    // @ts-ignore
// @ts-ignore - Used for configuration status
const securityEnabled = securityConfig.get<boolean>('enableSecurityChecks', true);
    
    // Get error handling status
    const errorHandlingConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.errorHandling');
    // @ts-ignore
// @ts-ignore - Used for status display
const errorHandlingActivated = errorHandlingConfig.get<boolean>('enableTransactions', true) && errorHandlingEnabled;
    
    // Get multi-project status
    const hasWorkspace = multiProjectManager && multiProjectManager.currentWorkspace;
    
    const securityMenuItems = securityEnabled ? [
        { label: '$(shield) Scan for Sensitive Data', id: 'scanSensitiveData' },
        { label: '$(shield) Validate Project Paths', id: 'validatePaths' },
        { label: '$(shield) Check File Permissions', id: 'checkPermissions' },
        { label: '$(shield) Show Security Status', id: 'securityStatus' }
    ] : [];
    
    const errorHandlingMenuItems = errorHandlingActivated ? [
        { label: '$(tools) Check Project Integrity', id: 'checkIntegrity' },
        { label: '$(tools) Repair Project', id: 'repairProject' },
        { label: '$(database) View Transaction Log', id: 'viewTransactionLog' }
    ] : [];
    
    const multiProjectMenuItems = [
        { label: '$(file-directory) Detect Xcode Workspace', id: 'detectWorkspace' },
        ...(hasWorkspace ? [
            { label: '$(list-selection) Select Workspace Scheme', id: 'selectScheme' },
            { label: '$(references) Update Cross-References', id: 'updateReferences' },
            { label: '$(graph) Build Dependency Graph', id: 'buildGraph' },
            { label: '$(list-ordered) Determine Build Order', id: 'determineBuildOrder' }
        ] : [])
    ];
    
    vscode.window.showQuickPick([
        { label: '$(sync) Sync Current File', id: 'syncFile' },
        { label: '$(repo-sync) Sync Entire Project', id: 'syncProject' },
        { label: '$(play) Build Project', id: 'buildProject' },
        { label: '$(beaker) Run Tests', id: 'runTests' },
        { label: '$(package) Update Dependencies', id: 'updateDependencies' },
        { label: '$(info) Show Status', id: 'showStatus' },
        ...securityMenuItems,
        ...errorHandlingMenuItems,
        ...multiProjectMenuItems
    ], {
        placeHolder: 'Select Xcode Integration Action'
    }).then(selection => {
        if (!selection) return;
        
        switch (selection.id) {
            case 'syncFile':
                vscode.commands.executeCommand('vscode-xcode-integration.syncFile');
                break;
            case 'syncProject':
                vscode.commands.executeCommand('vscode-xcode-integration.syncProject');
                break;
            case 'buildProject':
                vscode.commands.executeCommand('vscode-xcode-integration.buildProject');
                break;
            case 'runTests':
                vscode.commands.executeCommand('vscode-xcode-integration.runTests');
                break;
            case 'updateDependencies':
                vscode.commands.executeCommand('vscode-xcode-integration.updateDependencies');
                break;
            case 'showStatus':
                vscode.commands.executeCommand('vscode-xcode-integration.showStatus');
                break;
            case 'scanSensitiveData':
                vscode.commands.executeCommand('vscode-xcode-integration.scanForSensitiveData');
                break;
            case 'validatePaths':
                vscode.commands.executeCommand('vscode-xcode-integration.validateProjectPaths');
                break;
            case 'checkPermissions':
                vscode.commands.executeCommand('vscode-xcode-integration.checkPermissions');
                break;
            case 'securityStatus':
                vscode.commands.executeCommand('vscode-xcode-integration.showSecurityStatus');
                break;
            case 'checkIntegrity':
                vscode.commands.executeCommand('vscode-xcode-integration.checkProjectIntegrity');
                break;
            case 'repairProject':
                vscode.commands.executeCommand('vscode-xcode-integration.repairProject');
                break;
            case 'viewTransactionLog':
                vscode.commands.executeCommand('vscode-xcode-integration.viewTransactionLog');
                break;
            case 'detectWorkspace':
                vscode.commands.executeCommand('vscode-xcode-integration.detectWorkspace');
                break;
            case 'selectScheme':
                vscode.commands.executeCommand('vscode-xcode-integration.selectWorkspaceScheme');
                break;
            case 'updateReferences':
                vscode.commands.executeCommand('vscode-xcode-integration.updateCrossReferences');
                break;
            case 'buildGraph':
                vscode.commands.executeCommand('vscode-xcode-integration.buildDependencyGraph');
                break;
            case 'determineBuildOrder':
                vscode.commands.executeCommand('vscode-xcode-integration.determineBuildOrder');
                break;
        }
    });
}

// Update status bar based on editor
function updateStatusBar(editor: vscode.TextEditor | undefined) {
    if (!editor) {
        syncStatusItem.hide();
        xcodeStatusItem.hide();
        securityStatusItem.hide();
        transactionStatusItem.hide();
        return;
    }
    
    const document = editor.document;
    
    // Check if this is a Swift, Objective-C, or resource file
    const isRelevantFile = /\.(swift|h|m|mm|c|cpp)$/i.test(document.fileName) || isResourceFile(document.fileName);
    
    if (isRelevantFile) {
        syncStatusItem.show();
        xcodeStatusItem.show();
        securityStatusItem.show();
        transactionStatusItem.show();
    } else {
        syncStatusItem.hide();
        xcodeStatusItem.hide();
        securityStatusItem.hide();
        transactionStatusItem.hide();
    }
}

// Detect Xcode project or workspace
function detectXcodeProject(outputChannel: vscode.OutputChannel) {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return;
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    
    try {
        // Look for .xcodeproj files
        const findProcess = cp.spawnSync('find', ['.', '-name', '*.xcodeproj', '-depth', '1', '-print', '-quit'], {
            cwd: workspaceFolder,
            encoding: 'utf8'
        });
        
        const xcodeProjectPath = findProcess.stdout.trim();
        
        if (xcodeProjectPath) {
            outputChannel.appendLine(`Found Xcode project: \${xcodeProjectPath}`);
            return;
        }
        
        // Look for .xcworkspace files
        const findWorkspaceProcess = cp.spawnSync('find', ['.', '-name', '*.xcworkspace', '-depth', '1', '-print', '-quit'], {
            cwd: workspaceFolder,
            encoding: 'utf8'
        });
        
        const xcodeWorkspacePath = findWorkspaceProcess.stdout.trim();
        
        if (xcodeWorkspacePath) {
            outputChannel.appendLine(`Found Xcode workspace: \${xcodeWorkspacePath}`);
            return;
        }
        
        outputChannel.appendLine('No Xcode project or workspace found in the workspace');
        vscode.window.showWarningMessage('No Xcode project or workspace found. Some features may not work correctly.');
    } catch (err) {
        outputChannel.appendLine(`Error detecting Xcode project: \${err}`);
    }
}

// Helper function to get script paths
function getScriptPath(scriptName: string): string {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        throw new Error('No workspace folder is open');
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const scriptPath = path.join(workspaceFolder, 'scripts', scriptName);
    
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Script not found: \${scriptPath}`);
    }
    
    return scriptPath;
}

// Helper function to check if a file is a resource file
function isResourceFile(filePath: string): boolean {
    return filePath.includes('.xcassets') || 
           filePath.endsWith('.storyboard') || 
           filePath.endsWith('.xib') || 
           filePath.includes('.xcdatamodeld') || 
           filePath.includes('.xcdatamodel');
}

// Helper function to get a friendly name for resource file types
function getResourceFileType(filePath: string): string {
    if (filePath.includes('.xcassets')) {
        return 'Asset Catalog';
    } else if (filePath.endsWith('.storyboard')) {
        return 'Storyboard';
    } else if (filePath.endsWith('.xib')) {
        return 'Interface Builder';
    } else if (filePath.includes('.xcdatamodeld') || filePath.includes('.xcdatamodel')) {
        return 'CoreData Model';
    } else {
        return 'unknown';
    }
}
