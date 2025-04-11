import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Active resources
let outputChannel: vscode.OutputChannel | undefined;
let isInitialized = false;
let performanceInterval: NodeJS.Timeout | undefined;

// Performance metrics
interface PerformanceMetrics {
    cpuUsage: number;
    memoryUsage: number;
    fileCount: number;
    lastRefresh: Date;
}

let currentMetrics: PerformanceMetrics = {
    cpuUsage: 0,
    memoryUsage: 0,
    fileCount: 0,
    lastRefresh: new Date()
};

/**
 * Initialize performance monitoring
 * @param context Extension context
 * @param channel Output channel for logging
 */
export function initialize(context: vscode.ExtensionContext, channel: vscode.OutputChannel): void {
    outputChannel = channel;
    
    // Register commands
    registerCommands(context);
    
    // Check if performance monitoring is enabled
    const config = vscode.workspace.getConfiguration('vscode-xcode-integration.performance');
    const enableMonitoring = config.get<boolean>('enableMonitoring', false);
    
    if (enableMonitoring) {
        startMonitoring();
    }
    
    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('vscode-xcode-integration.performance.enableMonitoring')) {
                const newConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.performance');
                const enableMonitoring = newConfig.get<boolean>('enableMonitoring', false);
                
                if (enableMonitoring) {
                    startMonitoring();
                } else {
                    stopMonitoring();
                }
            }
        })
    );
    
    isInitialized = true;
    outputChannel.appendLine('Performance optimization initialized');
}

/**
 * Register performance-related commands
 * @param context Extension context
 */
function registerCommands(context: vscode.ExtensionContext): void {
    // Register a command to optimize the workspace
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-xcode-integration.optimizeWorkspace', async () => {
            await optimizeWorkspace();
        })
    );
    
    // Register a command to show performance metrics
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-xcode-integration.showPerformanceMetrics', () => {
            showPerformanceMetrics();
        })
    );
    
    // Register a command to clear the cache
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-xcode-integration.clearCache', async () => {
            await clearCache();
        })
    );
}

/**
 * Start performance monitoring
 */
function startMonitoring(): void {
    if (performanceInterval) {
        // Already monitoring
        return;
    }
    
    // Get the monitoring interval from configuration
    const config = vscode.workspace.getConfiguration('vscode-xcode-integration.performance');
    const intervalMs = config.get<number>('monitoringIntervalMs', 60000);
    
    // Start periodic monitoring
    performanceInterval = setInterval(async () => {
        await refreshPerformanceMetrics();
    }, intervalMs);
    
    // Initial refresh
    refreshPerformanceMetrics().catch(error => {
        outputChannel?.appendLine(`Error refreshing performance metrics: ${error}`);
    });
    
    outputChannel?.appendLine('Performance monitoring started');
}

/**
 * Stop performance monitoring
 */
function stopMonitoring(): void {
    if (performanceInterval) {
        clearInterval(performanceInterval);
        performanceInterval = undefined;
        outputChannel?.appendLine('Performance monitoring stopped');
    }
}

/**
 * Refresh performance metrics
 */
async function refreshPerformanceMetrics(): Promise<void> {
    try {
        // Get CPU usage
        const cpuUsage = await getCpuUsage();
        
        // Get memory usage
        const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
        
        // Get file count (if workspace is available)
        let fileCount = 0;
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            fileCount = await getFileCount(vscode.workspace.workspaceFolders[0].uri.fsPath);
        }
        
        // Update metrics
        currentMetrics = {
            cpuUsage,
            memoryUsage,
            fileCount,
            lastRefresh: new Date()
        };
        
        // Log metrics
        const config = vscode.workspace.getConfiguration('vscode-xcode-integration.performance');
        const logMetrics = config.get<boolean>('logMetrics', false);
        
        if (logMetrics) {
            outputChannel?.appendLine(`Performance metrics:
- CPU Usage: ${cpuUsage.toFixed(2)}%
- Memory Usage: ${memoryUsage.toFixed(2)} MB
- File Count: ${fileCount}
- Last Refresh: ${currentMetrics.lastRefresh.toLocaleString()}`);
        }
        
        // Check for high resource usage
        const cpuThreshold = config.get<number>('cpuUsageThreshold', 80);
        const memoryThreshold = config.get<number>('memoryUsageThreshold', 1000);
        
        if (cpuUsage > cpuThreshold || memoryUsage > memoryThreshold) {
            outputChannel?.appendLine(`High resource usage detected:
- CPU Usage: ${cpuUsage.toFixed(2)}% (threshold: ${cpuThreshold}%)
- Memory Usage: ${memoryUsage.toFixed(2)} MB (threshold: ${memoryThreshold} MB)`);
            
            // Show a notification if configured
            if (config.get<boolean>('showResourceWarnings', true)) {
                vscode.window.showWarningMessage(
                    `High resource usage detected (CPU: ${cpuUsage.toFixed(2)}%, Memory: ${memoryUsage.toFixed(2)} MB)`,
                    'Optimize Now',
                    'Dismiss'
                ).then(selection => {
                    if (selection === 'Optimize Now') {
                        optimizeWorkspace();
                    }
                });
            }
        }
    } catch (error) {
        outputChannel?.appendLine(`Error refreshing performance metrics: ${error}`);
    }
}

/**
 * Get CPU usage
 * @returns Promise resolving to the CPU usage percentage
 */
async function getCpuUsage(): Promise<number> {
    return new Promise<number>((resolve) => {
        try {
            const cpus = os.cpus();
            
            // Calculate average CPU usage across all cores
            let totalUsage = 0;
            
            for (const cpu of cpus) {
                const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
                const idle = cpu.times.idle;
                
                const usage = 100 - (idle / total) * 100;
                totalUsage += usage;
            }
            
            const averageUsage = totalUsage / cpus.length;
            resolve(averageUsage);
        } catch (error) {
            outputChannel?.appendLine(`Error getting CPU usage: ${error}`);
            resolve(0);
        }
    });
}

/**
 * Get the number of files in a directory (recursive)
 * @param directory The directory to count files in
 * @returns Promise resolving to the file count
 */
async function getFileCount(directory: string): Promise<number> {
    try {
        let count = 0;
        
        // Get exclusion patterns from settings
        const config = vscode.workspace.getConfiguration('files', vscode.Uri.file(directory));
        const excludePatterns = config.get<{ [key: string]: boolean }>('exclude', {});
        
        // Function to check if a path matches any exclude pattern
        const isExcluded = (filePath: string): boolean => {
            const relativePath = path.relative(directory, filePath);
            
            for (const pattern in excludePatterns) {
                if (excludePatterns[pattern]) {
                    const regexPattern = pattern
                        .replace(/\./g, '\\.')
                        .replace(/\*\*/g, '.*')
                        .replace(/\*/g, '[^/]*')
                        .replace(/\?/g, '[^/]');
                    
                    const regex = new RegExp(`^${regexPattern}$`, 'i');
                    
                    if (regex.test(relativePath)) {
                        return true;
                    }
                }
            }
            
            return false;
        };
        
        // Recursive function to count files
        const countFiles = async (dir: string): Promise<void> => {
            if (isExcluded(dir)) {
                return;
            }
            
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    await countFiles(fullPath);
                } else if (!isExcluded(fullPath)) {
                    count++;
                }
            }
        };
        
        await countFiles(directory);
        return count;
    } catch (error) {
        outputChannel?.appendLine(`Error counting files: ${error}`);
        return 0;
    }
}

/**
 * Optimize the workspace for better performance
 */
async function optimizeWorkspace(): Promise<void> {
    outputChannel?.appendLine('Optimizing workspace...');
    
    try {
        // Show progress indicator
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Optimizing workspace',
            cancellable: true
        }, async (progress, token) => {
            // Report initial progress
            progress.report({ increment: 0, message: 'Analyzing workspace...' });
            
            if (token.isCancellationRequested) {
                return;
            }
            
            // Clear cache
            progress.report({ increment: 20, message: 'Clearing cache...' });
            await clearCache();
            
            if (token.isCancellationRequested) {
                return;
            }
            
            // Optimize file watchers
            progress.report({ increment: 20, message: 'Optimizing file watchers...' });
            await optimizeFileWatchers();
            
            if (token.isCancellationRequested) {
                return;
            }
            
            // Optimize search exclude patterns
            progress.report({ increment: 20, message: 'Optimizing search exclude patterns...' });
            await optimizeSearchExcludes();
            
            if (token.isCancellationRequested) {
                return;
            }
            
            // Optimize editor settings
            progress.report({ increment: 20, message: 'Optimizing editor settings...' });
            await optimizeEditorSettings();
            
            if (token.isCancellationRequested) {
                return;
            }
            
            // Final progress
            progress.report({ increment: 20, message: 'Optimization complete' });
            
            // Refresh performance metrics
            await refreshPerformanceMetrics();
        });
        
        // Show success message
        vscode.window.showInformationMessage('Workspace optimization complete');
    } catch (error) {
        outputChannel?.appendLine(`Error optimizing workspace: ${error}`);
        vscode.window.showErrorMessage(`Error optimizing workspace: ${error}`);
    }
}

/**
 * Clear the extension cache
 */
async function clearCache(): Promise<void> {
    try {
        // Get cache directory
        const cacheDir = getCacheDirectory();
        
        // Check if cache directory exists
        if (await pathExists(cacheDir)) {
            // Clear cache files
            const entries = await fs.promises.readdir(cacheDir);
            
            for (const entry of entries) {
                const fullPath = path.join(cacheDir, entry);
                
                try {
                    const stats = await fs.promises.stat(fullPath);
                    
                    if (stats.isDirectory()) {
                        await deleteDirectory(fullPath);
                    } else {
                        await fs.promises.unlink(fullPath);
                    }
                } catch (error) {
                    outputChannel?.appendLine(`Error deleting cache entry ${entry}: ${error}`);
                }
            }
            
            outputChannel?.appendLine('Cache cleared');
        } else {
            // Create cache directory
            await fs.promises.mkdir(cacheDir, { recursive: true });
            outputChannel?.appendLine('Cache directory created');
        }
    } catch (error) {
        outputChannel?.appendLine(`Error clearing cache: ${error}`);
        throw error;
    }
}

/**
 * Optimize file watchers
 */
async function optimizeFileWatchers(): Promise<void> {
    try {
        // Get file watcher configuration
        const config = vscode.workspace.getConfiguration('vscode-xcode-integration');
        
        // Update file watcher exclude patterns
        const currentExcludes = config.get<string[]>('watchExclude', []);
        
        // Standard patterns to exclude
        const standardExcludes = [
            '**/node_modules/**',
            '**/build/**',
            '**/DerivedData/**',
            '**/.git/**',
            '**/Pods/**',
            '**/*.xcodeproj/xcuserdata/**',
            '**/*.xcworkspace/xcuserdata/**'
        ];
        
        // Merge and deduplicate
        const newExcludes = Array.from(new Set([...currentExcludes, ...standardExcludes]));
        
        // Update configuration
        await config.update('watchExclude', newExcludes, vscode.ConfigurationTarget.Workspace);
        
        // Enable throttling
        const performanceConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.performance');
        await performanceConfig.update('useThrottling', true, vscode.ConfigurationTarget.Workspace);
        
        // Set an appropriate debounce delay
        await config.update('debounceDelay', 1000, vscode.ConfigurationTarget.Workspace);
        
        outputChannel?.appendLine('File watchers optimized');
    } catch (error) {
        outputChannel?.appendLine(`Error optimizing file watchers: ${error}`);
        throw error;
    }
}

/**
 * Optimize search exclude patterns
 */
async function optimizeSearchExcludes(): Promise<void> {
    try {
        // Get search configuration
        const config = vscode.workspace.getConfiguration('search');
        
        // Get current exclude patterns
        const currentExcludes = config.get<{ [key: string]: boolean }>('exclude', {});
        
        // Standard patterns to exclude
        const standardExcludes: { [key: string]: boolean } = {
            '**/node_modules/**': true,
            '**/build/**': true,
            '**/DerivedData/**': true,
            '**/.git/**': true,
            '**/Pods/**': true,
            '**/*.xcodeproj/xcuserdata/**': true,
            '**/*.xcworkspace/xcuserdata/**': true,
            '**/*.pbxproj': true,
            '**/*.xcscheme': true
        };
        
        // Merge
        const newExcludes = { ...currentExcludes, ...standardExcludes };
        
        // Update configuration
        await config.update('exclude', newExcludes, vscode.ConfigurationTarget.Workspace);
        
        outputChannel?.appendLine('Search exclude patterns optimized');
    } catch (error) {
        outputChannel?.appendLine(`Error optimizing search exclude patterns: ${error}`);
        throw error;
    }
}

/**
 * Optimize editor settings
 */
async function optimizeEditorSettings(): Promise<void> {
    try {
        // Get editor configuration
        const config = vscode.workspace.getConfiguration('editor');
        
        // Optimization settings
        const optimizations: { [key: string]: any } = {
            // File watching optimizations
            'files.watcherExclude': {
                '**/node_modules/**': true,
                '**/build/**': true,
                '**/DerivedData/**': true,
                '**/.git/**': true,
                '**/Pods/**': true,
                '**/*.xcodeproj/xcuserdata/**': true,
                '**/*.xcworkspace/xcuserdata/**': true
            },
            
            // Editor optimizations
            'editor.minimap.enabled': false,
            'editor.renderWhitespace': 'none',
            'editor.renderControlCharacters': false,
            'editor.renderLineHighlight': 'line',
            'editor.scrollBeyondLastLine': false
        };
        
        // Apply optimizations
        for (const [key, value] of Object.entries(optimizations)) {
            const parts = key.split('.');
            const section = parts[0];
            const rest = parts.slice(1).join('.');
            
            const sectionConfig = vscode.workspace.getConfiguration(section);
            await sectionConfig.update(rest, value, vscode.ConfigurationTarget.Workspace);
        }
        
        outputChannel?.appendLine('Editor settings optimized');
    } catch (error) {
        outputChannel?.appendLine(`Error optimizing editor settings: ${error}`);
        throw error;
    }
}

/**
 * Show performance metrics
 */
function showPerformanceMetrics(): void {
    // Format metrics for display
    const formattedMetrics = `Performance Metrics:
- CPU Usage: ${currentMetrics.cpuUsage.toFixed(2)}%
- Memory Usage: ${currentMetrics.memoryUsage.toFixed(2)} MB
- File Count: ${currentMetrics.fileCount}
- Last Refresh: ${currentMetrics.lastRefresh.toLocaleString()}`;
    
    // Show the metrics
    vscode.window.showInformationMessage(formattedMetrics, 'Refresh', 'Optimize Now')
        .then(selection => {
            if (selection === 'Refresh') {
                refreshPerformanceMetrics();
                showPerformanceMetrics();
            } else if (selection === 'Optimize Now') {
                optimizeWorkspace();
            }
        });
    
    // Log to output channel
    outputChannel?.appendLine(formattedMetrics);
}

/**
 * Get the cache directory path
 * @returns Cache directory path
 */
function getCacheDirectory(): string {
    // Get workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    
    if (workspaceFolder) {
        return path.join(workspaceFolder, '.vscode-xcode-integration', 'cache');
    }
    
    // Fallback to global cache directory
    return path.join(os.tmpdir(), 'vscode-xcode-integration', 'cache');
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

/**
 * Delete a directory recursively
 * @param dirPath Directory to delete
 */
async function deleteDirectory(dirPath: string): Promise<void> {
    try {
        const entries = await fs.promises.readdir(dirPath);
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry);
            const stats = await fs.promises.stat(fullPath);
            
            if (stats.isDirectory()) {
                await deleteDirectory(fullPath);
            } else {
                await fs.promises.unlink(fullPath);
            }
        }
        
        await fs.promises.rmdir(dirPath);
    } catch (error) {
        outputChannel?.appendLine(`Error deleting directory ${dirPath}: ${error}`);
        throw error;
    }
}

/**
 * Clean up resources
 */
export function dispose(): void {
    stopMonitoring();
    isInitialized = false;
}
