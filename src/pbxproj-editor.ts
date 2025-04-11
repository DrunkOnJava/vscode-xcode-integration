import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Provider for custom editor for Xcode project files
 */
export class PBXProjEditorProvider implements vscode.CustomTextEditorProvider {
    
    /**
     * Register the editor provider
     */
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new PBXProjEditorProvider(context);
        return vscode.window.registerCustomEditorProvider('vscode-xcode-integration.pbxprojEditor', provider);
    }
    
    private readonly outputChannel: vscode.OutputChannel;
    
    constructor(
        private readonly context: vscode.ExtensionContext
    ) {
        this.outputChannel = vscode.window.createOutputChannel('PBXProj Editor');
    }
    
    /**
     * Called when our custom editor is opened
     */
    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Setup webview
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
            ]
        };
        
        // Initialize HTML content
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
        
        // Set up document-webview communication
        const updateWebview = () => {
            webviewPanel.webview.postMessage({
                command: 'update',
                text: document.getText()
            });
        };
        
        // Update webview when document is first opened
        updateWebview();
        
        // Update webview when document changes in the editor
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });
        
        // Clean up event listeners when the editor is closed
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });
        
        // Handle messages from the webview
        webviewPanel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'save':
                    this.saveDocument(document, message.text);
                    return;
                    
                case 'analyzeConflicts':
                    this.analyzeConflicts(document, webviewPanel.webview);
                    return;
            }
        });
    }
    
    /**
     * Get the webview HTML
     */
    private getHtmlForWebview(webview: vscode.Webview): string {
        // Get URIs for scripts and CSS
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'pbxproj-editor.js'))
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'pbxproj-editor.css'))
        );
        const codemirrorCssUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'codemirror.css'))
        );
        const codemirrorJsUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'codemirror.js'))
        );
        
        // Use a nonce to allow only specific scripts to be run
        const nonce = this.getNonce();
        
        return /* html */`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            
            <!-- Use CSP to restrict script execution -->
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            
            <link href="${styleUri}" rel="stylesheet">
            <link href="${codemirrorCssUri}" rel="stylesheet">
            <title>PBXProj Editor</title>
        </head>
        <body>
            <!-- Control panel -->
            <div class="controls">
                <button id="analyze-conflicts">Analyze Conflicts</button>
                <button id="resolve-all">Resolve All</button>
                <div class="conflict-stats">
                    <span id="conflict-count">0</span> conflicts found
                </div>
            </div>
            
            <!-- Main editor container -->
            <div class="editor-container">
                <!-- Section list sidebar -->
                <div class="section-list"></div>
                
                <!-- Editor main area -->
                <div class="editor">
                    <div id="editor-wrapper"></div>
                </div>
                
                <!-- Conflict viewer sidebar -->
                <div class="conflict-view">
                    <h3>Conflicts</h3>
                    <div id="conflicts-list"></div>
                </div>
            </div>
            
            <!-- Scripts -->
            <script nonce="${nonce}" src="${codemirrorJsUri}"></script>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
    
    /**
     * Save the document
     */
    private saveDocument(document: vscode.TextDocument, text: string): void {
        const edit = new vscode.WorkspaceEdit();
        
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            text
        );
        
        // Apply the edit
        vscode.workspace.applyEdit(edit);
    }
    
    /**
     * Analyze conflicts in the document
     */
    private async analyzeConflicts(document: vscode.TextDocument, webview: vscode.Webview): Promise<void> {
        try {
            // Get workspace folder
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }
            
            // Get the conflict analyzer script path
            const scriptPath = path.join(
                workspaceFolder.uri.fsPath,
                'scripts',
                'version_control',
                'merge_tools',
                'pbxproj_analyzer.sh'
            );
            
            // Check if the script exists
            if (!fs.existsSync(scriptPath)) {
                throw new Error(`Conflict analyzer script not found: ${scriptPath}`);
            }
            
            // Create a temporary file with the document content
            const tempFile = path.join(os.tmpdir(), `pbxproj-${Date.now()}.pbxproj`);
            fs.writeFileSync(tempFile, document.getText());
            
            try {
                // Run the analyzer script
                const process = cp.spawn(scriptPath, [tempFile], {
                    cwd: workspaceFolder.uri.fsPath,
                    stdio: 'pipe',
                    shell: true
                });
                
                // Collect stdout data
                let stdout = '';
                let stderr = '';
                
                process.stdout.on('data', (data) => {
                    stdout += data.toString();
                });
                
                process.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
                
                // Handle process completion
                await new Promise<void>((resolve, reject) => {
                    process.on('close', (code) => {
                        if (code === 0) {
                            resolve();
                        } else {
                            reject(new Error(`Process exited with code ${code}: ${stderr}`));
                        }
                    });
                    
                    process.on('error', reject);
                });
                
                try {
                    // Parse the analysis results
                    const conflictData = JSON.parse(stdout);
                    
                    // Send results to webview
                    webview.postMessage({
                        command: 'setConflicts',
                        conflicts: conflictData
                    });
                    
                    // Log conflicts found
                    const conflictCount = conflictData.hasConflicts ? conflictData.conflicts.length : 0;
                    this.outputChannel.appendLine(`Found ${conflictCount} conflicts in the file`);
                } catch (parseError) {
                    this.outputChannel.appendLine(`Error parsing analyzer output: ${parseError}`);
                    this.outputChannel.appendLine(`Output: ${stdout}`);
                    
                    throw new Error(`Failed to parse analyzer output: ${parseError}`);
                }
            } catch (processError) {
                throw new Error(`Error executing analyzer script: ${processError}`);
            } finally {
                // Clean up temp file
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            }
        } catch (error) {
            this.outputChannel.appendLine(`Error analyzing conflicts: ${error}`);
            vscode.window.showErrorMessage(`Failed to analyze conflicts: ${error}`);
        }
    }
    
    /**
     * Generate a nonce string
     */
    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
