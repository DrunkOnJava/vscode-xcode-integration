import * as vscode from 'vscode';
import * as path from 'path';
import { debounce } from '../utils';
import { getErrorHandler, ErrorCategory } from './errorHandler';

/**
 * Manages optimized file watching for Xcode projects
 */
export class FileWatcherManager {
    private watchers: Map<string, vscode.FileSystemWatcher> = new Map();
    private activeDirectories: Set<string> = new Set();
    private lastChangedFiles: Map<string, number> = new Map();
    private changeHandlers: Map<string, (uri: vscode.Uri) => void> = new Map();
    
    constructor(private outputChannel: vscode.OutputChannel) {}
    
    /**
     * Create an optimized file watcher
     * @param patterns File patterns to watch
     * @param excludePatterns Patterns to exclude
     * @param handler Event handler for file changes
     * @returns The created file watcher
     */
    public createOptimizedFileWatcher(
        patterns: string[],
        excludePatterns: string[],
        handler: (uri: vscode.Uri) => void
    ): vscode.FileSystemWatcher | undefined {
        try {
            // Get configuration
            const config = vscode.workspace.getConfiguration('vscode-xcode-integration.performance');
            const useSelectiveWatch = config.get<boolean>('useSelectiveWatch', false);
            const useThrottling = config.get<boolean>('useThrottling', false);
            const activeOnlyWatching = config.get<boolean>('activeOnlyWatching', true);
            const debounceDelay = vscode.workspace.getConfiguration('vscode-xcode-integration').get<number>('debounceDelay', 1000);
            
            // Create the base file pattern
            const pattern = `{${patterns.join(',')}}`;
            
            // Generate a key for this watcher
            const watcherKey = `${pattern}|${excludePatterns.join(',')}`;
            
            // Reuse existing watcher if available
            if (this.watchers.has(watcherKey)) {
                const existingWatcher = this.watchers.get(watcherKey);
                if (existingWatcher) {
                    this.outputChannel.appendLine(`Reusing existing file watcher for pattern: ${pattern}`);
                    
                    // Store the handler with this watcher
                    this.changeHandlers.set(watcherKey, handler);
                    
                    return existingWatcher;
                }
            }
            
            // Create the file watcher
            const watcher = vscode.workspace.createFileSystemWatcher(
                pattern,
                false, // Don't ignore creates
                false, // Don't ignore changes
                false  // Don't ignore deletes
            );
            
            // Initialize active directories if using selective watching
            if (useSelectiveWatch && activeOnlyWatching) {
                this.initializeActiveDirectories(patterns, excludePatterns);
            }
            
            // Create a debounced handler if throttling is enabled
            const processFile = useThrottling ? 
                debounce((uri: vscode.Uri) => this.handleFileEvent(uri, handler, excludePatterns, useSelectiveWatch, activeOnlyWatching), debounceDelay) :
                (uri: vscode.Uri) => this.handleFileEvent(uri, handler, excludePatterns, useSelectiveWatch, activeOnlyWatching);
            
            // Store the handler with this watcher
            this.changeHandlers.set(watcherKey, handler);
            
            // Attach event handlers
            watcher.onDidChange(processFile);
            watcher.onDidCreate(processFile);
            watcher.onDidDelete(processFile);
            
            // Store the watcher
            this.watchers.set(watcherKey, watcher);
            
            this.outputChannel.appendLine(`Created optimized file watcher for pattern: ${pattern}`);
            return watcher;
        } catch (error) {
            getErrorHandler().handleError(error as Error, {
                category: ErrorCategory.General,
                operation: 'Creating file watcher'
            });
            return undefined;
        }
    }
    
    /**
     * Initialize the set of active directories
     * @param patterns File patterns to consider
     * @param excludePatterns Patterns to exclude
     */
    private initializeActiveDirectories(patterns: string[], excludePatterns: string[]): void {
        // Start with directories containing open files
        vscode.workspace.textDocuments.forEach(doc => {
            if (this.isRelevantFile(doc.fileName, patterns, excludePatterns)) {
                this.activeDirectories.add(path.dirname(doc.fileName));
            }
        });
        
        // Listen for document open events
        vscode.workspace.onDidOpenTextDocument(doc => {
            if (this.isRelevantFile(doc.fileName, patterns, excludePatterns)) {
                this.activeDirectories.add(path.dirname(doc.fileName));
            }
        });
    }
    
    /**
     * Handle a file event
     * @param uri URI of the affected file
     * @param handler Event handler to call
     * @param excludePatterns Patterns to exclude
     * @param useSelectiveWatch Whether to use selective watching
     * @param activeOnlyWatching Whether to only watch active directories
     */
    private handleFileEvent(
        uri: vscode.Uri, 
        handler: (uri: vscode.Uri) => void,
        excludePatterns: string[],
        useSelectiveWatch: boolean,
        activeOnlyWatching: boolean
    ): void {
        try {
            // Skip excluded paths
            if (this.isExcludedPath(uri.fsPath, excludePatterns)) {
                this.outputChannel.appendLine(`File ${uri.fsPath} excluded from watching`);
                return;
            }
            
            // Apply selective watching if enabled
            if (useSelectiveWatch && activeOnlyWatching) {
                const fileDir = path.dirname(uri.fsPath);
                
                // Track when this file was last changed
                this.lastChangedFiles.set(uri.fsPath, Date.now());
                
                if (!this.activeDirectories.has(fileDir)) {
                    // First time seeing this directory - add it and process the file
                    this.activeDirectories.add(fileDir);
                    this.outputChannel.appendLine(`Added directory to active set: ${fileDir}`);
                    
                    // Call the handler directly
                    handler(uri);
                    return;
                }
            }
            
            // Call the handler
            handler(uri);
        } catch (error) {
            getErrorHandler().handleError(error as Error, {
                category: ErrorCategory.General,
                operation: 'Processing file event',
                filePath: uri.fsPath
            });
        }
    }
    
    /**
     * Check if a file is relevant (matches patterns and isn't excluded)
     * @param filePath Path to the file
     * @param patterns File patterns to match
     * @param excludePatterns Patterns to exclude
     * @returns True if the file is relevant
     */
    private isRelevantFile(filePath: string, patterns: string[], excludePatterns: string[]): boolean {
        // Check if file matches any pattern
        const fileExt = path.extname(filePath).toLowerCase();
        
        // See if it matches any of the include patterns
        const matchesInclude = patterns.some(pattern => {
            if (pattern.includes('*.')) {
                // Handle extension pattern
                const ext = pattern.replace('*.', '.');
                return fileExt === ext;
            }
            return filePath.includes(pattern);
        });
        
        if (!matchesInclude) {
            return false;
        }
        
        // Check if file is excluded
        return !this.isExcludedPath(filePath, excludePatterns);
    }
    
    /**
     * Check if a path is excluded
     * @param filePath Path to check
     * @param excludePatterns Patterns to check against
     * @returns True if the path is excluded
     */
    private isExcludedPath(filePath: string, excludePatterns: string[]): boolean {
        return excludePatterns.some(pattern => 
            filePath.match(new RegExp(pattern.replace(/\*/g, ".*")))
        );
    }
    
    /**
     * Refresh active directories based on recent activity
     * @param maxAgeMs Maximum age in milliseconds for files to be considered active
     */
    public refreshActiveDirectories(maxAgeMs: number = 3600000): void {
        const now = Date.now();
        
        // Remove files that haven't been changed recently
        for (const [filePath, timestamp] of this.lastChangedFiles.entries()) {
            if (now - timestamp > maxAgeMs) {
                this.lastChangedFiles.delete(filePath);
            }
        }
        
        // Rebuild active directories set
        this.activeDirectories.clear();
        
        // Add directories of recently changed files
        for (const filePath of this.lastChangedFiles.keys()) {
            this.activeDirectories.add(path.dirname(filePath));
        }
        
        // Add directories of open documents
        vscode.workspace.textDocuments.forEach(doc => {
            this.activeDirectories.add(path.dirname(doc.fileName));
        });
    }
    
    /**
     * Dispose all watchers
     */
    public dispose(): void {
        for (const watcher of this.watchers.values()) {
            watcher.dispose();
        }
        this.watchers.clear();
        this.changeHandlers.clear();
    }
}
