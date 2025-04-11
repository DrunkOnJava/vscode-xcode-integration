import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';

// Active resources
let outputChannel: vscode.OutputChannel | undefined;
let isInitialized = false;
let gitEnabled = false;

/**
 * Initialize version control integration
 * @param context Extension context
 * @param channel Output channel for logging
 */
export function initialize(context: vscode.ExtensionContext, channel: vscode.OutputChannel): void {
    outputChannel = channel;
    
    // Check if git is available
    checkGitAvailability().then(available => {
        gitEnabled = available;
        
        if (gitEnabled) {
            outputChannel?.appendLine('Git integration enabled');
            registerCommands(context);
        } else {
            outputChannel?.appendLine('Git integration disabled (Git not found)');
        }
        
        isInitialized = true;
    });
}

/**
 * Register git-related commands
 * @param context Extension context
 */
function registerCommands(context: vscode.ExtensionContext): void {
    // Register a command to commit the current file
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-xcode-integration.commitCurrentFile', async () => {
            if (!gitEnabled) {
                vscode.window.showErrorMessage('Git integration is not enabled');
                return;
            }
            
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No file is currently open');
                return;
            }
            
            await commitFile(editor.document.uri.fsPath);
        })
    );
    
    // Register a command to show git history for the current file
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-xcode-integration.showFileHistory', async () => {
            if (!gitEnabled) {
                vscode.window.showErrorMessage('Git integration is not enabled');
                return;
            }
            
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No file is currently open');
                return;
            }
            
            await showFileHistory(editor.document.uri.fsPath);
        })
    );
    
    // Register a command to show git changes for the current file
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-xcode-integration.showFileChanges', async () => {
            if (!gitEnabled) {
                vscode.window.showErrorMessage('Git integration is not enabled');
                return;
            }
            
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No file is currently open');
                return;
            }
            
            await showFileChanges(editor.document.uri.fsPath);
        })
    );
}

/**
 * Commit a file to git
 * @param filePath Path to the file
 * @returns Promise resolving when the commit is complete
 */
async function commitFile(filePath: string): Promise<void> {
    try {
        // Open an input box for the commit message
        const commitMessage = await vscode.window.showInputBox({
            prompt: 'Enter a commit message',
            placeHolder: 'Commit message'
        });
        
        if (!commitMessage) {
            // User cancelled
            return;
        }
        
        // Execute git add
        const addResult = await executeGitCommand(['add', filePath]);
        
        if (addResult.stderr) {
            throw new Error(`Git add failed: ${addResult.stderr}`);
        }
        
        // Execute git commit
        const commitResult = await executeGitCommand(['commit', '-m', commitMessage]);
        
        if (commitResult.stderr && !commitResult.stderr.includes('nothing to commit')) {
            throw new Error(`Git commit failed: ${commitResult.stderr}`);
        }
        
        outputChannel?.appendLine(`Committed ${path.basename(filePath)}: ${commitMessage}`);
        vscode.window.showInformationMessage(`Committed ${path.basename(filePath)}`);
    } catch (error) {
        outputChannel?.appendLine(`Error committing file: ${error}`);
        vscode.window.showErrorMessage(`Error committing file: ${error}`);
    }
}

/**
 * Show git history for a file
 * @param filePath Path to the file
 * @returns Promise resolving when the history is shown
 */
async function showFileHistory(filePath: string): Promise<void> {
    try {
        // Execute git log
        const logResult = await executeGitCommand(['log', '--pretty=format:%h%x09%an%x09%ad%x09%s', '--date=short', filePath]);
        
        if (logResult.stderr) {
            throw new Error(`Git log failed: ${logResult.stderr}`);
        }
        
        // Parse the log output
        const logs = logResult.stdout.split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => {
                const parts = line.split('\t');
                return {
                    hash: parts[0],
                    author: parts[1],
                    date: parts[2],
                    message: parts[3]
                };
            });
        
        if (logs.length === 0) {
            vscode.window.showInformationMessage(`No git history found for ${path.basename(filePath)}`);
            return;
        }
        
        // Show the history in a quick pick
        const items = logs.map(log => ({
            label: log.message,
            description: `${log.date} by ${log.author}`,
            detail: `Commit: ${log.hash}`,
            log
        }));
        
        vscode.window.showQuickPick(items, {
            placeHolder: `Git history for ${path.basename(filePath)}`
        }).then(selected => {
            if (selected) {
                // Show the commit details
                showCommitDetails(selected.log.hash, filePath);
            }
        });
    } catch (error) {
        outputChannel?.appendLine(`Error showing file history: ${error}`);
        vscode.window.showErrorMessage(`Error showing file history: ${error}`);
    }
}

/**
 * Show details for a specific commit
 * @param hash The commit hash
 * @param filePath Path to the file
 */
async function showCommitDetails(hash: string, filePath: string): Promise<void> {
    try {
        // Execute git show
        const showResult = await executeGitCommand(['show', hash, '--', filePath]);
        
        if (showResult.stderr) {
            throw new Error(`Git show failed: ${showResult.stderr}`);
        }
        
        // Create a temporary document to show the diff
        const doc = await vscode.workspace.openTextDocument({
            content: showResult.stdout,
            language: 'git-commit'
        });
        
        await vscode.window.showTextDocument(doc);
    } catch (error) {
        outputChannel?.appendLine(`Error showing commit details: ${error}`);
        vscode.window.showErrorMessage(`Error showing commit details: ${error}`);
    }
}

/**
 * Show changes for a file
 * @param filePath Path to the file
 * @returns Promise resolving when the changes are shown
 */
async function showFileChanges(filePath: string): Promise<void> {
    try {
        // Execute git diff
        const diffResult = await executeGitCommand(['diff', filePath]);
        
        if (diffResult.stderr) {
            throw new Error(`Git diff failed: ${diffResult.stderr}`);
        }
        
        if (!diffResult.stdout) {
            vscode.window.showInformationMessage(`No changes found for ${path.basename(filePath)}`);
            return;
        }
        
        // Create a temporary document to show the diff
        const doc = await vscode.workspace.openTextDocument({
            content: diffResult.stdout,
            language: 'diff'
        });
        
        await vscode.window.showTextDocument(doc);
    } catch (error) {
        outputChannel?.appendLine(`Error showing file changes: ${error}`);
        vscode.window.showErrorMessage(`Error showing file changes: ${error}`);
    }
}

/**
 * Check if git is available
 * @returns Promise resolving to true if git is available
 */
async function checkGitAvailability(): Promise<boolean> {
    try {
        const result = await executeCommand('git', ['--version']);
        return result.stdout.includes('git version');
    } catch (error) {
        outputChannel?.appendLine(`Git not found: ${error}`);
        return false;
    }
}

/**
 * Execute a git command
 * @param args Command arguments
 * @returns Promise resolving to the command result
 */
async function executeGitCommand(args: string[]): Promise<{ stdout: string, stderr: string }> {
    // Get the workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceFolder) {
        throw new Error('No workspace folder is open');
    }
    
    return executeCommand('git', args, workspaceFolder);
}

/**
 * Execute a command
 * @param command The command to execute
 * @param args Command arguments
 * @param cwd Working directory
 * @returns Promise resolving to the command result
 */
async function executeCommand(command: string, args: string[], cwd?: string): Promise<{ stdout: string, stderr: string }> {
    return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
        cp.execFile(command, args, { cwd }, (error, stdout, stderr) => {
            if (error && !stderr) {
                reject(error);
                return;
            }
            
            resolve({ stdout, stderr });
        });
    });
}

/**
 * Clean up resources
 */
export function dispose(): void {
    isInitialized = false;
    gitEnabled = false;
}
