import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as vscode from 'vscode';

/**
 * Ensures CodeMirror is available for the editor
 */
export async function ensureCodeMirror(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): Promise<boolean> {
    const mediaFolder = path.join(context.extensionPath, 'media');
    const codeMirrorJsPath = path.join(mediaFolder, 'codemirror.js');
    const codeMirrorCssPath = path.join(mediaFolder, 'codemirror.css');
    
    // Check if CodeMirror files exist
    if (fs.existsSync(codeMirrorJsPath) && fs.existsSync(codeMirrorCssPath)) {
        outputChannel.appendLine('CodeMirror is already available');
        return true;
    }
    
    // Create media folder if it doesn't exist
    if (!fs.existsSync(mediaFolder)) {
        fs.mkdirSync(mediaFolder, { recursive: true });
    }
    
    // Download CodeMirror files
    outputChannel.appendLine('Downloading CodeMirror...');
    
    try {
        // Show progress notification
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Downloading CodeMirror",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: "Starting download..." });
            
            // Download JavaScript file
            await downloadFile(
                'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js',
                codeMirrorJsPath
            );
            
            progress.report({ increment: 50, message: "Downloaded JS file" });
            
            // Download CSS file
            await downloadFile(
                'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css',
                codeMirrorCssPath
            );
            
            progress.report({ increment: 50, message: "Download complete" });
        });
        
        outputChannel.appendLine('CodeMirror downloaded successfully');
        return true;
    } catch (error) {
        outputChannel.appendLine(`Error downloading CodeMirror: ${error}`);
        vscode.window.showErrorMessage(`Failed to download CodeMirror: ${error}`);
        return false;
    }
}

/**
 * Download a file from a URL to a local path
 */
function downloadFile(url: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
                return;
            }
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (error) => {
            fs.unlink(filePath, () => {});
            reject(error);
        });
    });
}
