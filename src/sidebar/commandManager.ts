import * as vscode from 'vscode';

/**
 * Interface representing a command definition
 */
export interface CommandDefinition {
    /**
     * Command ID
     */
    id: string;
    
    /**
     * Command title
     */
    title: string;
    
    /**
     * Command category
     */
    category?: string;
    
    /**
     * Command handler function
     */
    handler: (...args: any[]) => any;
    
    /**
     * When clause for command enablement
     */
    when?: string;
}

/**
 * Manages all commands for the extension
 */
export class CommandManager {
    /**
     * Map of registered commands
     */
    private commands: Map<string, CommandDefinition> = new Map();
    
    /**
     * Constructor
     * @param context Extension context
     */
    constructor(private context: vscode.ExtensionContext) {}
    
    /**
     * Register a command with VS Code
     * @param command The command to register
     */
    public registerCommand(command: CommandDefinition): void {
        // Register the command with VS Code
        const disposable = vscode.commands.registerCommand(command.id, command.handler);
        this.context.subscriptions.push(disposable);
        
        // Add to the command map
        this.commands.set(command.id, command);
    }
    
    /**
     * Register multiple commands at once
     * @param commands Array of commands to register
     */
    public registerCommands(commands: CommandDefinition[]): void {
        for (const command of commands) {
            this.registerCommand(command);
        }
    }
    
    /**
     * Execute a command by ID
     * @param commandId The ID of the command to execute
     * @param args Arguments to pass to the command
     * @returns Promise resolving to the command result
     */
    public executeCommand(commandId: string, ...args: any[]): Thenable<any> {
        return vscode.commands.executeCommand(commandId, ...args);
    }
    
    /**
     * Get a registered command by ID
     * @param commandId The ID of the command to get
     * @returns The command definition or undefined if not found
     */
    public getCommand(commandId: string): CommandDefinition | undefined {
        return this.commands.get(commandId);
    }
    
    /**
     * Get all registered commands
     * @returns Array of all registered commands
     */
    public getAllCommands(): CommandDefinition[] {
        return Array.from(this.commands.values());
    }
    
    /**
     * Get commands by category
     * @param category The category to filter by
     * @returns Array of commands in the specified category
     */
    public getCommandsByCategory(category: string): CommandDefinition[] {
        return Array.from(this.commands.values())
            .filter(command => command.category === category);
    }
}
