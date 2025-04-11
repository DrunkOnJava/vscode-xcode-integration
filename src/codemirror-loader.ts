import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Ensure CodeMirror is available for custom editors
 * @param context Extension context
 * @param outputChannel Output channel for logging
 * @returns Promise resolving to true if CodeMirror is available
 */
export async function ensureCodeMirror(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
): Promise<boolean> {
    try {
        outputChannel.appendLine('Checking CodeMirror availability...');
        
        // Get the CodeMirror directory
        const codeMirrorDir = path.join(context.extensionPath, 'resources', 'codemirror');
        
        // Check if the directory exists
        if (await pathExists(codeMirrorDir)) {
            // Check if essential files exist
            const essentialFiles = [
                'codemirror.js',
                'codemirror.css',
                'mode/javascript/javascript.js',
                'mode/xml/xml.js'
            ];
            
            for (const file of essentialFiles) {
                const filePath = path.join(codeMirrorDir, file);
                
                if (!await pathExists(filePath)) {
                    outputChannel.appendLine(`Missing CodeMirror file: ${file}`);
                    return false;
                }
            }
            
            outputChannel.appendLine('CodeMirror is available');
            return true;
        } else {
            // Try to download CodeMirror
            outputChannel.appendLine('CodeMirror directory not found, attempting to download...');
            
            const result = await downloadCodeMirror(context, outputChannel);
            if (result) {
                outputChannel.appendLine('CodeMirror downloaded successfully');
                return true;
            } else {
                outputChannel.appendLine('Failed to download CodeMirror');
                return false;
            }
        }
    } catch (error) {
        outputChannel.appendLine(`Error ensuring CodeMirror availability: ${error}`);
        return false;
    }
}

/**
 * Download CodeMirror resources
 * @param context Extension context
 * @param outputChannel Output channel for logging
 * @returns Promise resolving to true if download was successful
 */
async function downloadCodeMirror(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
): Promise<boolean> {
    try {
        // Create the CodeMirror directory
        const codeMirrorDir = path.join(context.extensionPath, 'resources', 'codemirror');
        await fs.promises.mkdir(codeMirrorDir, { recursive: true });
        
        // In a real implementation, this would download the CodeMirror library
        // For this placeholder, we'll just create a dummy file
        const dummyFile = path.join(codeMirrorDir, 'codemirror.js');
        await fs.promises.writeFile(dummyFile, '// CodeMirror placeholder');
        
        // Create CSS file
        const cssFile = path.join(codeMirrorDir, 'codemirror.css');
        await fs.promises.writeFile(cssFile, '/* CodeMirror CSS placeholder */');
        
        // Create mode directories
        const javascriptDir = path.join(codeMirrorDir, 'mode', 'javascript');
        const xmlDir = path.join(codeMirrorDir, 'mode', 'xml');
        
        await fs.promises.mkdir(javascriptDir, { recursive: true });
        await fs.promises.mkdir(xmlDir, { recursive: true });
        
        // Create mode files
        const javascriptFile = path.join(javascriptDir, 'javascript.js');
        const xmlFile = path.join(xmlDir, 'xml.js');
        
        await fs.promises.writeFile(javascriptFile, '// JavaScript mode placeholder');
        await fs.promises.writeFile(xmlFile, '// XML mode placeholder');
        
        return true;
    } catch (error) {
        outputChannel.appendLine(`Error downloading CodeMirror: ${error}`);
        return false;
    }
}

/**
 * Check if a path exists
 * @param filePath Path to check
 * @returns Promise resolving to true if the path exists
 */
async function pathExists(filePath: string): Promise<boolean> {
    try {
        await fs.promises.access(filePath);
        return true;
    } catch {
        return false;
    }
}
