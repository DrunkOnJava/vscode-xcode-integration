import * as vscode from 'vscode';
import { SidebarManager } from './SidebarManager';
import { ProjectDetector } from './ProjectDetector';
import { CommandManager } from './CommandManager';
import { DropHandler } from './DropHandler';
import { BuildManager } from './BuildManager';
import { FileWatcherManager } from './FileWatcherManager';
import { initializeErrorHandler } from './ErrorHandler';

/**
 * Initialize all sidebar components and returns them for use in the extension
 * @param context The extension context
 * @param outputChannel The output channel for logging
 * @returns An object containing all initialized sidebar components
 */
export function initializeSidebar(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
) {
    // Initialize the sidebar components
    const sidebarManager = new SidebarManager(context);
    const projectDetector = new ProjectDetector(outputChannel);
    const commandManager = new CommandManager(context);
    const buildManager = new BuildManager(context, outputChannel);
    const dropHandler = new DropHandler(projectDetector, outputChannel);
    const fileWatcherManager = new FileWatcherManager(outputChannel);
    
    // Register the drop handler
    dropHandler.registerDropProvider(context);
    
    // Initialize the project detector
    projectDetector.detectProjects(true)
        .then(projects => {
            if (projects.length > 0) {
                outputChannel.appendLine(`Detected ${projects.length} Xcode projects`);
                
                // Refresh project details for each project
                projects.forEach(async project => {
                    try {
                        const updatedProject = await projectDetector.refreshProjectDetails(project);
                        outputChannel.appendLine(`Project ${updatedProject.name} has ${updatedProject.targets?.length || 0} targets and ${updatedProject.schemes?.length || 0} schemes`);
                    } catch (err) {
                        outputChannel.appendLine(`Error refreshing project details for ${project.name}: ${err}`);
                    }
                });
            } else {
                outputChannel.appendLine('No Xcode projects detected in the workspace');
            }
        })
        .catch(err => {
            outputChannel.appendLine(`Error detecting projects: ${err}`);
        });
    
    // Return the initialized components
    return {
        sidebarManager,
        projectDetector,
        commandManager,
        buildManager,
        dropHandler,
        fileWatcherManager
    };
}

// Export all the sidebar components
export { 
    SidebarManager,
    ProjectDetector,
    CommandManager,
    DropHandler,
    BuildManager,
    FileWatcherManager,
    initializeErrorHandler
};
