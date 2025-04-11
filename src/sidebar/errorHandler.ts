import * as vscode from 'vscode';

/**
 * Error category for classifying errors
 */
export enum ErrorCategory {
    General = 'general',
    FileSystem = 'filesystem',
    Network = 'network',
    Build = 'build',
    Xcode = 'xcode',
    Configuration = 'configuration',
    Security = 'security',
    Transaction = 'transaction'
}

/**
 * Error severity level
 */
export enum ErrorSeverity {
    Info = 'info',
    Warning = 'warning',
    Error = 'error',
    Critical = 'critical'
}

/**
 * Error context information
 */
export interface ErrorContext {
    /**
     * Error category
     */
    category: ErrorCategory;
    
    /**
     * Error severity
     */
    severity?: ErrorSeverity;
    
    /**
     * Operation being performed when the error occurred
     */
    operation?: string;
    
    /**
     * Additional error details
     */
    details?: { [key: string]: string };
    
    /**
     * Whether to show a notification to the user
     */
    showNotification?: boolean;
}

/**
 * Singleton class for handling errors
 */
class ErrorHandler {
    /**
     * Output channel for logging errors
     */
    private outputChannel: vscode.OutputChannel | undefined;
    
    /**
     * Whether error handling is initialized
     */
    private initialized = false;
    
    /**
     * Initialize the error handler
     * @param outputChannel Output channel for logging
     */
    public initialize(outputChannel: vscode.OutputChannel): void {
        this.outputChannel = outputChannel;
        this.initialized = true;
        
        // Log initialization
        this.outputChannel.appendLine('Error handler initialized');
        
        // Set up global error handlers
        this.setupGlobalErrorHandlers();
    }
    
    /**
     * Set up global error handlers
     */
    private setupGlobalErrorHandlers(): void {
        // Handle uncaught exceptions in extension
        process.on('uncaughtException', (error) => {
            this.handleError(error, {
                category: ErrorCategory.General,
                severity: ErrorSeverity.Critical,
                operation: 'Uncaught exception',
                showNotification: true
            });
        });
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason) => {
            const error = reason instanceof Error ? reason : new Error(String(reason));
            this.handleError(error, {
                category: ErrorCategory.General,
                severity: ErrorSeverity.Critical,
                operation: 'Unhandled promise rejection',
                showNotification: true
            });
        });
    }
    
    /**
     * Handle an error
     * @param error The error to handle
     * @param context Additional error context
     */
    public handleError(error: Error, context: ErrorContext): void {
        // Ensure we're initialized
        if (!this.initialized || !this.outputChannel) {
            console.error('Error handler not initialized', error);
            return;
        }
        
        // Set default severity if not provided
        const severity = context.severity || ErrorSeverity.Error;
        
        // Format the error message
        const errorMessage = this.formatErrorMessage(error, context);
        
        // Log the error
        this.logError(errorMessage, severity);
        
        // Show a notification if requested
        if (context.showNotification) {
            this.showErrorNotification(error, context);
        }
    }
    
    /**
     * Format an error message
     * @param error The error to format
     * @param context Additional error context
     * @returns Formatted error message
     */
    private formatErrorMessage(error: Error, context: ErrorContext): string {
        // Build the error message
        const parts: string[] = [];
        
        // Add error category and severity
        parts.push(`[${context.category.toUpperCase()}][${context.severity || ErrorSeverity.Error}]`);
        
        // Add the operation if provided
        if (context.operation) {
            parts.push(`[${context.operation}]`);
        }
        
        // Add the error message
        parts.push(error.message);
        
        // Build the main message
        let message = parts.join(' ');
        
        // Add the stack trace
        if (error.stack) {
            message += '\n' + error.stack;
        }
        
        // Add additional details if provided
        if (context.details && Object.keys(context.details).length > 0) {
            message += '\nDetails:';
            for (const [key, value] of Object.entries(context.details)) {
                message += `\n  ${key}: ${value}`;
            }
        }
        
        return message;
    }
    
    /**
     * Log an error message
     * @param message The error message to log
     * @param severity The error severity
     */
    private logError(message: string, severity: ErrorSeverity): void {
        if (!this.outputChannel) {
            return;
        }
        
        // Add a timestamp to the message
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        
        // Log the message
        this.outputChannel.appendLine(logMessage);
        
        // Show the output channel for errors and critical errors
        if (severity === ErrorSeverity.Error || severity === ErrorSeverity.Critical) {
            this.outputChannel.show(true);
        }
    }
    
    /**
     * Show an error notification
     * @param error The error to show
     * @param context Additional error context
     */
    private showErrorNotification(error: Error, context: ErrorContext): void {
        // Format the error message
        let message = error.message;
        
        // Add the operation if provided
        if (context.operation) {
            message = `Error during ${context.operation}: ${message}`;
        }
        
        // Show the appropriate notification based on severity
        switch (context.severity) {
            case ErrorSeverity.Info:
                vscode.window.showInformationMessage(message);
                break;
                
            case ErrorSeverity.Warning:
                vscode.window.showWarningMessage(message);
                break;
                
            case ErrorSeverity.Critical:
                vscode.window.showErrorMessage(message, 'Show Details')
                    .then(selection => {
                        if (selection === 'Show Details') {
                            this.outputChannel?.show(true);
                        }
                    });
                break;
                
            case ErrorSeverity.Error:
            default:
                vscode.window.showErrorMessage(message);
                break;
        }
    }
}

// Export a singleton instance
export const errorHandler = new ErrorHandler();

/**
 * Initialize the error handler
 * @param outputChannel Output channel for logging
 */
export function initializeErrorHandler(outputChannel: vscode.OutputChannel): void {
    errorHandler.initialize(outputChannel);
}
