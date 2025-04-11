import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Implementation of the Xcode project (pbxproj) file editor
 */
export class PBXProjEditorProvider implements vscode.CustomTextEditorProvider {
    /**
     * Register the custom editor provider
     * @param context Extension context
     * @returns Disposable for the registered provider
     */
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        // Register the custom editor provider
        const provider = new PBXProjEditorProvider(context);
        
        return vscode.window.registerCustomEditorProvider(
            PBXProjEditorProvider.viewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                },
                supportsMultipleEditorsPerDocument: false
            }
        );
    }
    
    /**
     * Custom editor view type
     */
    private static readonly viewType = 'vscode-xcode-integration.pbxprojEditor';
    
    /**
     * Constructor
     * @param context Extension context
     */
    constructor(private readonly context: vscode.ExtensionContext) {}
    
    /**
     * Resolve a custom editor for a given text document
     * @param document The document to create a custom editor for
     * @param webviewPanel The webview panel used to display the editor UI
     * @param token A cancellation token
     */
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Set up the webview
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'resources'))
            ]
        };
        
        // Initialize the webview content
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);
        
        // Set up message handling
        this.setupMessageHandling(document, webviewPanel);
        
        // Handle document changes
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                this.updateWebview(document, webviewPanel);
            }
        });
        
        // Clean up event listener when the editor is closed
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });
        
        // Initialize with document content
        this.updateWebview(document, webviewPanel);
    }
    
    /**
     * Get the HTML for the webview
     * @param webview The webview to create content for
     * @param document The document being edited
     * @returns HTML string for the webview
     */
    private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): string {
        // Get resource URIs
        const codemirrorJsUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'codemirror', 'codemirror.js'))
        );
        
        const codemirrorCssUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'codemirror', 'codemirror.css'))
        );
        
        const javascriptModeUri = webview.asWebviewUri(
            vscode.Uri.file(
                path.join(this.context.extensionPath, 'resources', 'codemirror', 'mode', 'javascript', 'javascript.js')
            )
        );
        
        const editorJsUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'pbxproj-editor.js'))
        );
        
        const editorCssUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'pbxproj-editor.css'))
        );
        
        // Get the initial content
        const initialContent = document.getText();
        
        // Build the HTML
        return /* html */ `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>PBXProj Editor</title>
                
                <link href="${codemirrorCssUri}" rel="stylesheet">
                <link href="${editorCssUri}" rel="stylesheet">
                
                <script src="${codemirrorJsUri}"></script>
                <script src="${javascriptModeUri}"></script>
            </head>
            <body>
                <div class="editor-container">
                    <div class="toolbar">
                        <button id="btn-format">Format</button>
                        <button id="btn-add-file">Add File</button>
                        <button id="btn-remove-file">Remove File</button>
                        <select id="select-view-mode">
                            <option value="tree">Tree View</option>
                            <option value="text">Text View</option>
                        </select>
                    </div>
                    
                    <div class="editor-panels">
                        <div id="tree-view" class="panel">
                            <div class="tree-container"></div>
                        </div>
                        
                        <div id="text-view" class="panel">
                            <textarea id="editor"></textarea>
                        </div>
                    </div>
                </div>
                
                <script>
                    // Initial content from the document
                    const initialContent = ${JSON.stringify(initialContent)};
                </script>
                
                <script src="${editorJsUri}"></script>
            </body>
            </html>
        `;
    }
    
    /**
     * Set up message handling between the webview and extension
     * @param document The document being edited
     * @param webviewPanel The webview panel
     */
    private setupMessageHandling(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
        webviewPanel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'update':
                        this.updateTextDocument(document, message.content);
                        break;
                        
                    case 'format':
                        await this.formatDocument(document);
                        break;
                        
                    case 'addFile':
                        await this.addFile(document, message.filePath);
                        break;
                        
                    case 'removeFile':
                        await this.removeFile(document, message.fileId);
                        break;
                        
                    case 'error':
                        vscode.window.showErrorMessage(message.message);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }
    
    /**
     * Update the webview with the current document content
     * @param document The document being edited
     * @param webviewPanel The webview panel
     */
    private updateWebview(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
        webviewPanel.webview.postMessage({
            type: 'update',
            content: document.getText()
        });
    }
    
    /**
     * Update the text document with new content
     * @param document The document to update
     * @param content The new content
     */
    private updateTextDocument(document: vscode.TextDocument, content: string): void {
        const edit = new vscode.WorkspaceEdit();
        
        // Replace the entire document
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            content
        );
        
        // Apply the edit
        vscode.workspace.applyEdit(edit);
    }
    
    /**
     * Format the document
     * @param document The document to format
     */
    private async formatDocument(document: vscode.TextDocument): Promise<void> {
        try {
            // In a real implementation, this would parse and format the pbxproj file
            // For this placeholder, we'll just use the built-in formatter
            await vscode.commands.executeCommand('editor.action.formatDocument', document.uri);
        } catch (error) {
            vscode.window.showErrorMessage(`Error formatting document: ${error}`);
        }
    }
    
    /**
     * Add a file to the Xcode project
     * @param document The pbxproj document
     * @param filePath The path to the file to add
     */
    private async addFile(document: vscode.TextDocument, filePath: string): Promise<void> {
        try {
            // In a real implementation, this would parse the pbxproj and add the file
            // For this placeholder, we'll just show a message
            vscode.window.showInformationMessage(`Adding file to project: ${filePath}`);
            
            // Show a notification that this is just a placeholder
            vscode.window.showInformationMessage('This is a placeholder implementation. File was not actually added to the project.');
        } catch (error) {
            vscode.window.showErrorMessage(`Error adding file: ${error}`);
        }
    }
    
    /**
     * Remove a file from the Xcode project
     * @param document The pbxproj document
     * @param fileId The ID of the file to remove
     */
    private async removeFile(document: vscode.TextDocument, fileId: string): Promise<void> {
        try {
            // In a real implementation, this would parse the pbxproj and remove the file
            // For this placeholder, we'll just show a message
            vscode.window.showInformationMessage(`Removing file from project: ${fileId}`);
            
            // Show a notification that this is just a placeholder
            vscode.window.showInformationMessage('This is a placeholder implementation. File was not actually removed from the project.');
        } catch (error) {
            vscode.window.showErrorMessage(`Error removing file: ${error}`);
        }
    }
}
