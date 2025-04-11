import * as vscode from 'vscode';
import * as path from 'path';
import { debounce } from '../utils';

/**
 * Manages file watching with optimized performance
 */
export class FileWatcherManager {
    /**
     * Active file watchers
     */
    private watchers: vscode.FileSystemWatcher[] = [];
    
    /**
     * Constructor
     * @param outputChannel Output channel for logging
     */
    constructor(private outputChannel: vscode.OutputChannel) {}
    
    /**
     * Create an optimized file watcher
     * @param patterns Array of glob patterns to watch
     * @param excludePatterns Array of glob patterns to exclude
     * @param onFileChange Handler for file changes
     * @returns The file watcher
     */
    public createOptimizedFileWatcher(
        patterns: string[],
        excludePatterns: string[],
        onFileChange: (uri: vscode.Uri) => void
    ): vscode.FileSystemWatcher {
        try {
            // Get configuration
            const config = vscode.workspace.getConfiguration('vscode-xcode-integration.performance');
            const useThrottling = config.get<boolean>('useThrottling', false);
            const debounceDelay = config.get<number>('debounceDelay', 1000);
            
            // Create a combined pattern for the watcher
            const watchPattern = `{${patterns.join(',')}}`;
            
            // Create the file watcher
            const watcher = vscode.workspace.createFileSystemWatcher(
                watchPattern,
                false, // Don't ignore creates
                false, // Don't ignore changes
                false  // Don't ignore deletes
            );
            
            // Store the watcher for cleanup
            this.watchers.push(watcher);
            
            // Create a debounced handler if throttling is enabled
            const fileChangeHandler = useThrottling
                ? debounce((uri: vscode.Uri) => {
                    // Skip excluded paths
                    for (const pattern of excludePatterns) {
                        if (this.matchesPattern(uri.fsPath, pattern)) {
                            this.outputChannel.appendLine(`File ${uri.fsPath} excluded from watch (matched ${pattern})`);
                            return;
                        }
                    }
                    
                    onFileChange(uri);
                }, debounceDelay)
                : (uri: vscode.Uri) => {
                    // Skip excluded paths
                    for (const pattern of excludePatterns) {
                        if (this.matchesPattern(uri.fsPath, pattern)) {
                            this.outputChannel.appendLine(`File ${uri.fsPath} excluded from watch (matched ${pattern})`);
                            return;
                        }
                    }
                    
                    onFileChange(uri);
                };
            
            // Register event handlers
            watcher.onDidChange(fileChangeHandler);
            watcher.onDidCreate(fileChangeHandler);
            watcher.onDidDelete(fileChangeHandler);
            
            this.outputChannel.appendLine(`Created optimized file watcher for patterns: ${patterns.join(', ')}`);
            this.outputChannel.appendLine(`Excluded patterns: ${excludePatterns.join(', ')}`);
            
            return watcher;
        } catch (error) {
            this.outputChannel.appendLine(`Error creating optimized file watcher: ${error}`);
            
            // Fall back to a simple file watcher
            this.outputChannel.appendLine('Falling back to simple file watcher');
            
            const watcher = vscode.workspace.createFileSystemWatcher(
                patterns[0],
                false, // Don't ignore creates
                false, // Don't ignore changes
                false  // Don't ignore deletes
            );
            
            watcher.onDidChange(onFileChange);
            watcher.onDidCreate(onFileChange);
            watcher.onDidDelete(onFileChange);
            
            this.watchers.push(watcher);
            
            return watcher;
        }
    }
    
    /**
     * Dispose all file watchers
     */
    public dispose(): void {
        for (const watcher of this.watchers) {
            watcher.dispose();
        }
        
        this.watchers = [];
    }
    
    /**
     * Check if a file path matches a pattern
     * @param filePath The file path to check
     * @param pattern The pattern to match against
     * @returns True if the file path matches the pattern
     */
    private matchesPattern(filePath: string, pattern: string): boolean {
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]');
        
        const regex = new RegExp(`^${regexPattern}$`, 'i');
        
        return regex.test(filePath);
    }
}
