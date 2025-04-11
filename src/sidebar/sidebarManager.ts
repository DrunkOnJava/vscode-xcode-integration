import * as vscode from 'vscode';

/**
 * Interface representing a tab in the sidebar
 */
export interface SidebarTab {
    /**
     * Unique identifier for the tab
     */
    id: string;
    
    /**
     * Display label for the tab
     */
    label: string;
    
    /**
     * Icon to use for the tab (codicon name)
     */
    icon: string;
    
    /**
     * Order of the tab (lower numbers appear first)
     */
    order: number;
    
    /**
     * View ID in the package.json
     */
    viewId: string;
    
    /**
     * Context value to set when this tab is active
     */
    contextValue: string;
}

/**
 * Manages the sidebar tabs and their state
 */
export class SidebarManager {
    /**
     * Map of registered tabs
     */
    private tabs: Map<string, SidebarTab> = new Map();
    
    /**
     * Current active tab
     */
    private activeTab: string | undefined;
    
    /**
     * Constructor
     * @param context Extension context
     */
    constructor(private context: vscode.ExtensionContext) {
        // Register the default tabs
        this.registerDefaultTabs();
        
        // Register commands
        this.registerCommands();
        
        // Load the active tab from storage
        this.loadActiveTab();
    }
    
    /**
     * Register default sidebar tabs
     */
    private registerDefaultTabs(): void {
        // Register the Projects tab
        this.registerTab({
            id: 'projects',
            label: 'Projects',
            icon: 'project',
            order: 10,
            viewId: 'xcode-projects',
            contextValue: 'xcode.view.projects'
        });
        
        // Register the Build tab
        this.registerTab({
            id: 'build',
            label: 'Build',
            icon: 'play',
            order: 20,
            viewId: 'xcode-build',
            contextValue: 'xcode.view.build'
        });
        
        // Register the Files tab
        this.registerTab({
            id: 'files',
            label: 'Files',
            icon: 'file-code',
            order: 30,
            viewId: 'xcode-files',
            contextValue: 'xcode.view.files'
        });
        
        // Register the Settings tab
        this.registerTab({
            id: 'settings',
            label: 'Settings',
            icon: 'gear',
            order: 40,
            viewId: 'xcode-settings',
            contextValue: 'xcode.view.settings'
        });
        
        // Register the Utilities tab
        this.registerTab({
            id: 'utilities',
            label: 'Utilities',
            icon: 'tools',
            order: 50,
            viewId: 'xcode-utilities',
            contextValue: 'xcode.view.utilities'
        });
    }
    
    /**
     * Register commands for tab switching
     */
    private registerCommands(): void {
        // Register the command to switch tabs
        this.context.subscriptions.push(
            vscode.commands.registerCommand('vscode-xcode-integration.switchTab', (tabId: string) => {
                this.activateTab(tabId);
            })
        );
    }
    
    /**
     * Register a new tab in the sidebar
     * @param tab The tab to register
     */
    public registerTab(tab: SidebarTab): void {
        this.tabs.set(tab.id, tab);
    }
    
    /**
     * Activate a specific tab
     * @param tabId The ID of the tab to activate
     */
    public activateTab(tabId: string): void {
        const tab = this.tabs.get(tabId);
        if (!tab) {
            return;
        }
        
        // Set the active tab
        this.activeTab = tabId;
        
        // Save the active tab to storage
        this.saveActiveTab();
        
        // Update the context value
        vscode.commands.executeCommand('setContext', 'xcode-integration.activeTab', tabId);
        vscode.commands.executeCommand('setContext', 'xcode-integration.activeTabContext', tab.contextValue);
        
        // Focus the view
        vscode.commands.executeCommand('xcode-integration.focus', tab.viewId);
    }
    
    /**
     * Get all registered tabs
     * @returns Array of registered tabs sorted by order
     */
    public getTabs(): SidebarTab[] {
        return Array.from(this.tabs.values()).sort((a, b) => a.order - b.order);
    }
    
    /**
     * Get the active tab
     * @returns The active tab or undefined if no tab is active
     */
    public getActiveTab(): SidebarTab | undefined {
        if (!this.activeTab) {
            return undefined;
        }
        
        return this.tabs.get(this.activeTab);
    }
    
    /**
     * Save the active tab to storage
     */
    private saveActiveTab(): void {
        if (this.activeTab) {
            this.context.globalState.update('xcode-integration.activeTab', this.activeTab);
        }
    }
    
    /**
     * Load the active tab from storage
     */
    private loadActiveTab(): void {
        const storedTab = this.context.globalState.get<string>('xcode-integration.activeTab');
        if (storedTab && this.tabs.has(storedTab)) {
            this.activateTab(storedTab);
        } else if (this.tabs.size > 0) {
            // Activate the first tab if none is active
            this.activateTab(Array.from(this.tabs.keys())[0]);
        }
    }
}
