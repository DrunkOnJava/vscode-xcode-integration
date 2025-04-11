import * as vscode from 'vscode';
import { BuildManager, BuildConfiguration } from '../buildManager';
import { getErrorHandler, ErrorCategory } from '../errorHandler';

/**
 * Tree item for the build view
 */
export class BuildViewItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly config?: BuildConfiguration,
        public readonly children?: BuildViewItem[]
    ) {
        super(label, collapsibleState);
        
        // Set icon based on context value
        switch (contextValue) {
            case 'configuration':
                this.iconPath = new vscode.ThemeIcon('gear');
                break;
            case 'scheme':
                this.iconPath = new vscode.ThemeIcon('play');
                break;
            case 'buildSettings':
                this.iconPath = new vscode.ThemeIcon('settings');
                break;
            case 'add':
                this.iconPath = new vscode.ThemeIcon('add');
                break;
            case 'run':
                this.iconPath = new vscode.ThemeIcon('play');
                break;
            case 'edit':
                this.iconPath = new vscode.ThemeIcon('edit');
                break;
            case 'delete':
                this.iconPath = new vscode.ThemeIcon('trash');
                break;
            case 'category':
                this.iconPath = new vscode.ThemeIcon('folder');
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('circle-outline');
                break;
        }
        
        // For build configurations, set description and command
        if (contextValue === 'configuration' && config) {
            this.description = `${config.scheme} (${config.configuration})`;
            
            this.command = {
                command: 'vscode-xcode-integration.runBuild',
                title: 'Run Build',
                arguments: [config]
            };
        }
    }
}

/**
 * Tree data provider for the build view
 */
export class BuildViewProvider implements vscode.TreeDataProvider<BuildViewItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BuildViewItem | undefined | null | void> = 
        new vscode.EventEmitter<BuildViewItem | undefined | null | void>();
    
    readonly onDidChangeTreeData: vscode.Event<BuildViewItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;
    
    constructor(
        private buildManager: BuildManager,
        private outputChannel: vscode.OutputChannel
    ) {}
    
    /**
     * Refresh the tree view
     */
    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    
    /**
     * Get the tree item for an element
     * @param element Element to get tree item for
     * @returns Tree item
     */
    public getTreeItem(element: BuildViewItem): vscode.TreeItem {
        return element;
    }
    
    /**
     * Get children of an element
     * @param element Parent element or undefined for root
     * @returns Children of the element
     */
    public getChildren(element?: BuildViewItem): Thenable<BuildViewItem[]> {
        if (element) {
            // Return children if this element has any
            return Promise.resolve(element.children || []);
        } else {
            // Root level
            return this.getRootItems();
        }
    }
    
    /**
     * Get items for the root level
     * @returns Root level items
     */
    private async getRootItems(): Promise<BuildViewItem[]> {
        try {
            const configs = this.buildManager.getConfigurations();
            
            // Group configurations into categories
            const configsByType = new Map<string, BuildConfiguration[]>();
            
            // Split configurations by type (Debug, Release, etc.)
            for (const config of configs) {
                const type = config.configuration;
                if (!configsByType.has(type)) {
                    configsByType.set(type, []);
                }
                configsByType.get(type)!.push(config);
            }
            
            const rootItems: BuildViewItem[] = [];
            
            // Create category items
            for (const [type, typeConfigs] of configsByType.entries()) {
                // Create configuration items for this type
                const configItems = typeConfigs.map(config => 
                    new BuildViewItem(
                        config.name,
                        vscode.TreeItemCollapsibleState.None,
                        'configuration',
                        config
                    )
                );
                
                // Create category item
                const categoryItem = new BuildViewItem(
                    `${type} Configurations`,
                    vscode.TreeItemCollapsibleState.Expanded,
                    'category',
                    undefined,
                    configItems
                );
                
                rootItems.push(categoryItem);
            }
            
            // Add action items at the end
            const addConfig = new BuildViewItem(
                'Add Configuration...',
                vscode.TreeItemCollapsibleState.None,
                'add'
            );
            addConfig.command = {
                command: 'vscode-xcode-integration.addBuildConfig',
                title: 'Add Build Configuration'
            };
            
            rootItems.push(addConfig);
            
            return rootItems;
        } catch (error) {
            getErrorHandler().handleError(error as Error, {
                category: ErrorCategory.General,
                operation: 'Getting build configurations'
            });
            return [];
        }
    }
    
    /**
     * Register context menu commands for the build view
     * @param context Extension context
     */
    public registerCommands(context: vscode.ExtensionContext): void {
        // Register command to run a build configuration
        context.subscriptions.push(
            vscode.commands.registerCommand('vscode-xcode-integration.buildView.run', (item: BuildViewItem) => {
                if (item.config) {
                    this.buildManager.runBuild(item.config);
                }
            })
        );
        
        // Register command to edit a build configuration
        context.subscriptions.push(
            vscode.commands.registerCommand('vscode-xcode-integration.buildView.edit', async (item: BuildViewItem) => {
                if (!item.config) return;
                
                try {
                    // Show a quick pick to select what to edit
                    const choice = await vscode.window.showQuickPick(
                        ['Name', 'Scheme', 'Configuration', 'Destination', 'Additional Arguments'],
                        { placeHolder: 'Select property to edit' }
                    );
                    
                    if (!choice) return;
                    
                    // Create a copy of the configuration
                    const updatedConfig = { ...item.config };
                    
                    // Edit the selected property
                    switch (choice) {
                        case 'Name':
                            const name = await vscode.window.showInputBox({
                                prompt: 'Enter build configuration name',
                                value: updatedConfig.name
                            });
                            if (name) updatedConfig.name = name;
                            break;
                            
                        case 'Scheme':
                            const scheme = await vscode.window.showInputBox({
                                prompt: 'Enter scheme name',
                                value: updatedConfig.scheme
                            });
                            if (scheme) updatedConfig.scheme = scheme;
                            break;
                            
                        case 'Configuration':
                            const configuration = await vscode.window.showQuickPick(
                                ['Debug', 'Release', 'AdHoc', 'AppStore'],
                                { 
                                    placeHolder: 'Select configuration',
                                    activeItems: [updatedConfig.configuration]
                                }
                            );
                            if (configuration) updatedConfig.configuration = configuration;
                            break;
                            
                        case 'Destination':
                            const destination = await vscode.window.showInputBox({
                                prompt: 'Enter destination (platform=iOS Simulator,name=iPhone 15)',
                                value: updatedConfig.destination || ''
                            });
                            updatedConfig.destination = destination || undefined;
                            break;
                            
                        case 'Additional Arguments':
                            const args = await vscode.window.showInputBox({
                                prompt: 'Enter additional arguments (space-separated)',
                                value: updatedConfig.additionalArgs.join(' ')
                            });
                            if (args !== undefined) {
                                updatedConfig.additionalArgs = args.split(' ').filter(arg => arg.trim() !== '');
                            }
                            break;
                    }
                    
                    // Find the index of the config to update
                    const configs = this.buildManager.getConfigurations();
                    const index = configs.findIndex(c => c.name === item.config!.name);
                    
                    if (index >= 0) {
                        // Update the configuration
                        await this.buildManager.updateConfiguration(index, updatedConfig);
                        
                        // Refresh the view
                        this.refresh();
                    }
                } catch (error) {
                    getErrorHandler().handleError(error as Error, {
                        category: ErrorCategory.General,
                        operation: 'Editing build configuration'
                    });
                }
            })
        );
        
        // Register command to delete a build configuration
        context.subscriptions.push(
            vscode.commands.registerCommand('vscode-xcode-integration.buildView.delete', async (item: BuildViewItem) => {
                if (!item.config) return;
                
                // Confirm deletion
                const confirmed = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete the build configuration "${item.config.name}"?`,
                    'Yes', 'No'
                );
                
                if (confirmed !== 'Yes') return;
                
                try {
                    // Find the index of the config to delete
                    const configs = this.buildManager.getConfigurations();
                    const index = configs.findIndex(c => c.name === item.config!.name);
                    
                    if (index >= 0) {
                        // Delete the configuration
                        await this.buildManager.deleteConfiguration(index);
                        
                        // Refresh the view
                        this.refresh();
                    }
                } catch (error) {
                    getErrorHandler().handleError(error as Error, {
                        category: ErrorCategory.General,
                        operation: 'Deleting build configuration'
                    });
                }
            })
        );
    }
}
