import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';

/**
 * Dashboard WebviewPanel
 */
let dashboardPanel: vscode.WebviewPanel | undefined;

/**
 * Interface definitions for component status
 */
interface ProjectStatus {
    name: string;
    type: string;
    exists: boolean;
    isWorkspace: boolean;
    path: string;
}

interface SyncStatus {
    enabled: boolean;
    lastSync: string;
    lastFile: string;
    watcherActive: boolean;
}

interface SecurityStatus {
    enabled: boolean;
    components: string[];
}

interface ErrorHandlingStatus {
    enabled: boolean;
    transactions: string;
    integrity: string;
}

interface PerformanceStatus {
    enabled: boolean;
    profile: string;
    watching: boolean;
    analyzed: boolean;
}

interface MultiProjectStatus {
    enabled: boolean;
    workspace: string;
    projects: string[];
}

interface VersionControlStatus {
    enabled: boolean;
    repository: string;
    status: string;
}

interface ComponentStatuses {
    project: ProjectStatus;
    sync: SyncStatus;
    security: SecurityStatus;
    errorHandling: ErrorHandlingStatus;
    performance: PerformanceStatus;
    multiProject: MultiProjectStatus;
    versionControl: VersionControlStatus;
}

/**
 * Creates and shows the Xcode Integration dashboard
 * @param context Extension context
 * @param outputChannel Output channel for logging
 */
export function showDashboard(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): void {
    // If we already have a panel, show it
    if (dashboardPanel) {
        dashboardPanel.reveal(vscode.ViewColumn.One);
        return;
    }

    // Create a new panel
    dashboardPanel = vscode.window.createWebviewPanel(
        'xcodeIntegrationDashboard',
        'Xcode Integration Dashboard',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: vscode.workspace.workspaceFolders 
                ? [vscode.Uri.file(context.extensionPath), ...vscode.workspace.workspaceFolders.map(folder => folder.uri)]
                : [vscode.Uri.file(context.extensionPath)]
        }
    );

    // Set initial HTML content
    updateDashboardContent(context, outputChannel);

    // Handle messages from the webview
    dashboardPanel.webview.onDidReceiveMessage(
        async message => {
            switch (message.command) {
                case 'runCommand':
                    vscode.commands.executeCommand(message.commandId);
                    return;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', message.query);
                    return;
                case 'getStatus':
                    updateDashboardContent(context, outputChannel);
                    return;
                case 'openUrl':
                    vscode.env.openExternal(vscode.Uri.parse(message.url));
                    return;
                case 'runScript':
                    runScript(message.script, message.args, outputChannel);
                    updateDashboardContent(context, outputChannel, 1000); // Update after slight delay
                    return;
            }
        },
        undefined,
        context.subscriptions
    );

    // Reset when the panel is closed
    dashboardPanel.onDidDispose(
        () => {
            dashboardPanel = undefined;
        },
        null,
        context.subscriptions
    );

    // Update content when dashboard is revealed
    dashboardPanel.onDidChangeViewState(
        e => {
            if (e.webviewPanel.visible) {
                updateDashboardContent(context, outputChannel);
            }
        },
        null,
        context.subscriptions
    );
}

/**
 * Update the dashboard content
 * @param context Extension context
 * @param outputChannel Output channel for logging
 * @param delay Optional delay before updating (ms)
 */
export function updateDashboardContent(
    context: vscode.ExtensionContext, 
    outputChannel: vscode.OutputChannel,
    delay: number = 0
): void {
    if (!dashboardPanel) {
        return;
    }

    if (delay > 0) {
        setTimeout(() => updateDashboardContentImmediate(context, outputChannel), delay);
    } else {
        updateDashboardContentImmediate(context, outputChannel);
    }
}

/**
 * Update the dashboard content immediately
 * @param context Extension context
 * @param outputChannel Output channel for logging
 */
function updateDashboardContentImmediate(
    context: vscode.ExtensionContext, 
    outputChannel: vscode.OutputChannel
): void {
    if (!dashboardPanel) {
        return;
    }

    // Get the status of all components
    const statuses = getComponentStatuses(outputChannel);

    // Generate the HTML content
    dashboardPanel.webview.html = generateDashboardHtml(context, dashboardPanel.webview, statuses);
}

/**
 * Get the status of all components
 * @param outputChannel Output channel for logging
 * @returns Component status information
 */
function getComponentStatuses(outputChannel: vscode.OutputChannel): ComponentStatuses {
    const status: ComponentStatuses = {
        project: {
            name: 'Unknown',
            type: 'unknown',
            exists: false,
            isWorkspace: false,
            path: ''
        },
        sync: {
            enabled: false,
            lastSync: 'Never',
            lastFile: 'None',
            watcherActive: false
        },
        security: {
            enabled: false,
            components: []
        },
        errorHandling: {
            enabled: false,
            transactions: 'Unknown',
            integrity: 'Unknown'
        },
        performance: {
            enabled: false,
            profile: 'Unknown',
            watching: false,
            analyzed: false
        },
        multiProject: {
            enabled: false,
            workspace: 'None',
            projects: []
        },
        versionControl: {
            enabled: false,
            repository: 'Unknown',
            status: 'Unknown'
        }
    };

    try {
        // Get workspace folder
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return status;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;

        // Check for Xcode project or workspace
        const findXcodeProj = cp.spawnSync('find', ['.', '-name', '*.xcodeproj', '-depth', '1', '-print', '-quit'], {
            cwd: workspaceFolder,
            encoding: 'utf8'
        });

        const findXcodeWorkspace = cp.spawnSync('find', ['.', '-name', '*.xcworkspace', '-depth', '1', '-print', '-quit'], {
            cwd: workspaceFolder,
            encoding: 'utf8'
        });

        // Update project status
        const xcodeProjectPath = findXcodeProj.stdout.trim();
        const xcodeWorkspacePath = findXcodeWorkspace.stdout.trim();

        if (xcodeProjectPath) {
            status.project.exists = true;
            status.project.type = 'project';
            status.project.path = xcodeProjectPath;
            status.project.name = path.basename(xcodeProjectPath, '.xcodeproj');
        } else if (xcodeWorkspacePath) {
            status.project.exists = true;
            status.project.type = 'workspace';
            status.project.isWorkspace = true;
            status.project.path = xcodeWorkspacePath;
            status.project.name = path.basename(xcodeWorkspacePath, '.xcworkspace');
        }

        // Check sync status
        const syncConfig = vscode.workspace.getConfiguration('vscode-xcode-integration');
        status.sync.enabled = syncConfig.get<boolean>('enableAutoSync', true);

        // Check security status
        const securityConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.security');
        const securityPath = path.join(workspaceFolder, 'scripts', 'security');
        status.security.enabled = securityConfig.get<boolean>('enableSecurityChecks', true) && fs.existsSync(securityPath);

        // Check error handling status
        const errorHandlingConfig = vscode.workspace.getConfiguration('vscode-xcode-integration.errorHandling');
        const errorHandlingPath = path.join(workspaceFolder, 'scripts', 'error_handling');
        status.errorHandling.enabled = errorHandlingConfig.get<boolean>('enableTransactions', true) && fs.existsSync(errorHandlingPath);

        // Check performance status
        const performancePath = path.join(workspaceFolder, 'scripts', 'performance');
        const performanceDisabledFlag = path.join(workspaceFolder, '.vscode-xcode-integration', 'performance_disabled');
        status.performance.enabled = fs.existsSync(performancePath) && !fs.existsSync(performanceDisabledFlag);

        if (status.performance.enabled) {
            // Get performance profile
            try {
                const performanceConfigScript = path.join(performancePath, 'performance_config.sh');
                if (fs.existsSync(performanceConfigScript)) {
                    const profileProcess = cp.spawnSync('bash', ['-c', `${performanceConfigScript} list | grep -A1 "Current Performance Settings" | tail -1 | cut -d '=' -f2`], {
                        cwd: workspaceFolder,
                        encoding: 'utf8'
                    });
                    if (profileProcess.status === 0 && profileProcess.stdout) {
                        status.performance.profile = profileProcess.stdout.trim();
                    }
                }

                // Check if watcher is running
                const watcherProcess = cp.spawnSync('pgrep', ['-f', 'selective_watcher.sh'], {
                    encoding: 'utf8'
                });
                status.performance.watching = watcherProcess.status === 0;

                // Check if project has been analyzed
                const cacheFile = path.join(workspaceFolder, '.vscode-xcode-integration', 'cache', 'dependencies.cache');
                status.performance.analyzed = fs.existsSync(cacheFile);
            } catch (err) {
                outputChannel.appendLine(`Error getting performance status: ${err}`);
            }
        }

        // Check multi-project status
        if (status.project.isWorkspace) {
            status.multiProject.enabled = true;
            status.multiProject.workspace = status.project.name;

            // Try to get projects in workspace
            try {
                const contentsFile = path.join(workspaceFolder, xcodeWorkspacePath, 'contents.xcworkspacedata');
                if (fs.existsSync(contentsFile)) {
                    const contents = fs.readFileSync(contentsFile, 'utf8');
                    const matches = contents.match(/location\s*=\s*"group:(.+?)"/g);
                    if (matches) {
                        status.multiProject.projects = matches.map((match) => {
                            const matchResult = match.match(/location\s*=\s*"group:(.+?)"/);
                            const projectPath = matchResult ? matchResult[1] : '';
                            return path.basename(projectPath, '.xcodeproj');
                        });
                    }
                }
            } catch (err) {
                outputChannel.appendLine(`Error parsing workspace contents: ${err}`);
            }
        }

        // Check version control status
        try {
            const gitDir = path.join(workspaceFolder, '.git');
            status.versionControl.enabled = fs.existsSync(gitDir);

            if (status.versionControl.enabled) {
                // Get repository name
                const gitConfigPath = path.join(gitDir, 'config');
                if (fs.existsSync(gitConfigPath)) {
                    const configContent = fs.readFileSync(gitConfigPath, 'utf8');
                    const urlMatch = configContent.match(/url\s*=\s*(?:https:\/\/github\.com\/|git@github\.com:)([^\/]+\/[^\.]+)(?:\.git)?/);
                    if (urlMatch && urlMatch[1]) {
                        status.versionControl.repository = urlMatch[1];
                    } else {
                        status.versionControl.repository = path.basename(workspaceFolder);
                    }
                }

                // Get status
                const gitStatusProcess = cp.spawnSync('git', ['status', '-s'], {
                    cwd: workspaceFolder,
                    encoding: 'utf8'
                });

                if (gitStatusProcess.status === 0) {
                    if (gitStatusProcess.stdout.trim() === '') {
                        status.versionControl.status = 'Clean';
                    } else {
                        const changedFiles = gitStatusProcess.stdout.trim().split('\n').length;
                        status.versionControl.status = `${changedFiles} files changed`;
                    }
                }
            }
        } catch (err) {
            outputChannel.appendLine(`Error getting git status: ${err}`);
        }

    } catch (err) {
        outputChannel.appendLine(`Error getting component statuses: ${err}`);
    }

    return status;
}

/**
 * Generate HTML for the dashboard
 * @param context Extension context
 * @param webview Webview to generate content for
 * @param statuses Component status information
 * @returns HTML content
 */
function generateDashboardHtml(
    context: vscode.ExtensionContext, 
    webview: vscode.Webview,
    statuses: ComponentStatuses
): string {
    const extensionUri = context.extensionUri;
    const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
    const dashboardCss = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'dashboard.css'));
    const assetsDir = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media'));

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${codiconsUri}" rel="stylesheet">
    <link href="${dashboardCss}" rel="stylesheet">
    <title>VSCode-Xcode Integration Dashboard</title>
    <style>
        :root {
            --container-padding: 20px;
            --section-padding: 16px;
            --status-good-color: var(--vscode-terminal-ansiGreen);
            --status-warning-color: var(--vscode-terminal-ansiYellow);
            --status-error-color: var(--vscode-terminal-ansiRed);
            --border-color: var(--vscode-panel-border);
            --heading-color: var(--vscode-editor-foreground);
            --text-color: var(--vscode-foreground);
            --link-color: var(--vscode-textLink-foreground);
            --link-active-color: var(--vscode-textLink-activeForeground);
            --button-background: var(--vscode-button-background);
            --button-foreground: var(--vscode-button-foreground);
            --button-hover-background: var(--vscode-button-hoverBackground);
            --card-background: var(--vscode-sideBar-background);
        }
        
        body {
            padding: var(--container-padding);
            color: var(--text-color);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            line-height: 1.5;
        }
        
        h1, h2, h3 {
            color: var(--heading-color);
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
        }
        
        h1 {
            font-size: 2em;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 10px;
        }
        
        h2 {
            font-size: 1.5em;
        }

        h3 {
            font-size: 1.2em;
        }
        
        a {
            color: var(--link-color);
            text-decoration: none;
        }
        
        a:hover {
            color: var(--link-active-color);
            text-decoration: underline;
        }
        
        button,
        .button {
            display: inline-block;
            border: none;
            padding: 8px 12px;
            background-color: var(--button-background);
            color: var(--button-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            cursor: pointer;
            outline: none;
            border-radius: 2px;
            margin-right: 8px;
            margin-bottom: 8px;
            white-space: nowrap;
        }
        
        button:hover,
        .button:hover {
            background-color: var(--button-hover-background);
        }
        
        .row {
            display: flex;
            flex-wrap: wrap;
            margin: -10px;
        }
        
        .col {
            flex: 1;
            padding: 10px;
            min-width: 250px;
        }
        
        .card {
            background-color: var(--card-background);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: var(--section-padding);
            margin-bottom: 20px;
        }
        
        .card-header {
            display: flex;
            align-items: center;
            margin-bottom: 12px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 8px;
        }
        
        .card-header h3 {
            margin: 0;
            flex: 1;
        }
        
        .card-content {
            margin-bottom: 16px;
        }
        
        .card-actions {
            display: flex;
            flex-wrap: wrap;
        }
        
        .status-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 10px;
            font-size: 12px;
            margin-left: 10px;
        }
        
        .status-enabled {
            background-color: var(--status-good-color);
            color: #000;
        }
        
        .status-disabled {
            background-color: var(--status-error-color);
            color: #fff;
        }
        
        .status-partial {
            background-color: var(--status-warning-color);
            color: #000;
        }
        
        .status-icon {
            margin-right: 8px;
            font-size: 1.2em;
        }
        
        .info-row {
            display: flex;
            margin-bottom: 8px;
        }
        
        .info-label {
            flex: 0 0 120px;
            font-weight: bold;
        }
        
        .info-value {
            flex: 1;
        }

        .refresh-button {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 0;
            color: var(--link-color);
            display: flex;
            align-items: center;
        }

        .refresh-button:hover {
            color: var(--link-active-color);
        }

        .project-title {
            display: flex;
            align-items: center;
        }

        .project-icon {
            margin-right: 12px;
            height: 32px;
            width: 32px;
        }

        .component-icon {
            margin-right: 8px;
            width: 24px;
            height: 24px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid var(--border-color);
            color: var(--text-color);
            opacity: 0.8;
            font-size: 0.9em;
            text-align: center;
        }
    </style>
</head>
<body>
    <header>
        <div class="project-title">
            <img src="${assetsDir}/xcode-icon.png" class="project-icon" alt="Xcode Icon">
            <h1>
                ${statuses.project.exists 
                    ? `${statuses.project.name} Xcode ${statuses.project.isWorkspace ? 'Workspace' : 'Project'}`
                    : 'VSCode-Xcode Integration'}
                <button class="refresh-button" title="Refresh Dashboard" onclick="refreshDashboard()">
                    <i class="codicon codicon-refresh"></i>
                </button>
            </h1>
        </div>
    </header>

    <div class="row">
        <div class="col">
            <!-- Project Info Card -->
            <div class="card">
                <div class="card-header">
                    <span class="component-icon">
                        <i class="codicon codicon-file-directory"></i>
                    </span>
                    <h3>Project Information</h3>
                    <span class="status-badge ${statuses.project.exists ? 'status-enabled' : 'status-disabled'}">
                        ${statuses.project.exists ? 'Found' : 'Not Found'}
                    </span>
                </div>
                <div class="card-content">
                    ${statuses.project.exists ? `
                        <div class="info-row">
                            <div class="info-label">Name:</div>
                            <div class="info-value">${statuses.project.name}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Type:</div>
                            <div class="info-value">${statuses.project.isWorkspace ? 'Workspace' : 'Project'}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Path:</div>
                            <div class="info-value">${statuses.project.path}</div>
                        </div>
                    ` : `
                        <p>No Xcode project or workspace found in the current workspace.</p>
                    `}
                </div>
                <div class="card-actions">
                    <button onclick="runCommand('workbench.action.files.openFolder')">
                        <i class="codicon codicon-folder-opened"></i> Open Folder
                    </button>
                    ${statuses.project.exists ? `
                        <button onclick="runScript('open', ['${statuses.project.path}'])">
                            <i class="codicon codicon-go-to-file"></i> Open in Xcode
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- File Sync Card -->
            <div class="card">
                <div class="card-header">
                    <span class="component-icon">
                        <i class="codicon codicon-sync"></i>
                    </span>
                    <h3>File Synchronization</h3>
                    <span class="status-badge ${statuses.sync.enabled ? 'status-enabled' : 'status-disabled'}">
                        ${statuses.sync.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
                <div class="card-content">
                    <div class="info-row">
                        <div class="info-label">Auto Sync:</div>
                        <div class="info-value">${statuses.sync.enabled ? 'Enabled' : 'Disabled'}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Last File:</div>
                        <div class="info-value">${statuses.sync.lastFile}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Last Sync:</div>
                        <div class="info-value">${statuses.sync.lastSync}</div>
                    </div>
                </div>
                <div class="card-actions">
                    <button onclick="runCommand('vscode-xcode-integration.syncFile')">
                        <i class="codicon codicon-sync"></i> Sync Current File
                    </button>
                    <button onclick="runCommand('vscode-xcode-integration.syncProject')">
                        <i class="codicon codicon-repo-sync"></i> Sync Project
                    </button>
                    <button onclick="openSettings('vscode-xcode-integration.enableAutoSync')">
                        <i class="codicon codicon-gear"></i> Sync Settings
                    </button>
                </div>
            </div>

            <!-- Build Tools Card -->
            <div class="card">
                <div class="card-header">
                    <span class="component-icon">
                        <i class="codicon codicon-tools"></i>
                    </span>
                    <h3>Build & Test</h3>
                </div>
                <div class="card-content">
                    <p>Run Xcode build tools directly from VSCode.</p>
                </div>
                <div class="card-actions">
                    <button onclick="runCommand('vscode-xcode-integration.buildProject')">
                        <i class="codicon codicon-play"></i> Build
                    </button>
                    <button onclick="runCommand('vscode-xcode-integration.runTests')">
                        <i class="codicon codicon-beaker"></i> Run Tests
                    </button>
                    <button onclick="runCommand('vscode-xcode-integration.updateDependencies')">
                        <i class="codicon codicon-package"></i> Update Dependencies
                    </button>
                </div>
            </div>
        </div>

        <div class="col">
            <!-- Performance Optimization Card -->
            <div class="card">
                <div class="card-header">
                    <span class="component-icon">
                        <i class="codicon codicon-dashboard"></i>
                    </span>
                    <h3>Performance Optimization</h3>
                    <span class="status-badge ${statuses.performance.enabled ? 'status-enabled' : 'status-disabled'}">
                        ${statuses.performance.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
                <div class="card-content">
                    <div class="info-row">
                        <div class="info-label">Profile:</div>
                        <div class="info-value">${statuses.performance.profile}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">File Watching:</div>
                        <div class="info-value">
                            ${statuses.performance.watching ? 'Active' : 'Inactive'}
                            ${statuses.performance.watching ? '<i class="codicon codicon-pass status-good"></i>' : ''}
                        </div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Project Analysis:</div>
                        <div class="info-value">
                            ${statuses.performance.analyzed ? 'Completed' : 'Not Performed'}
                            ${statuses.performance.analyzed ? '<i class="codicon codicon-pass status-good"></i>' : ''}
                        </div>
                    </div>
                </div>
                <div class="card-actions">
                    <button onclick="runCommand('vscode-xcode-integration.${statuses.performance.watching ? 'showPerformanceStatus' : 'startSelectiveWatcher'}')">
                        <i class="codicon codicon-${statuses.performance.watching ? 'output' : 'eye'}"></i> 
                        ${statuses.performance.watching ? 'View Status' : 'Start Watching'}
                    </button>
                    <button onclick="runCommand('vscode-xcode-integration.${statuses.performance.analyzed ? 'showPerformanceStatus' : 'analyzeProject'}')">
                        <i class="codicon codicon-${statuses.performance.analyzed ? 'graph' : 'search'}"></i> 
                        ${statuses.performance.analyzed ? 'View Analysis' : 'Analyze Project'}
                    </button>
                    <button onclick="runCommand('vscode-xcode-integration.configurePerformance')">
                        <i class="codicon codicon-gear"></i> Configure
                    </button>
                </div>
            </div>

            <!-- Security Card -->
            <div class="card">
                <div class="card-header">
                    <span class="component-icon">
                        <i class="codicon codicon-shield"></i>
                    </span>
                    <h3>Security</h3>
                    <span class="status-badge ${statuses.security.enabled ? 'status-enabled' : 'status-disabled'}">
                        ${statuses.security.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
                <div class="card-content">
                    <p>Protect your project with security features:</p>
                    <ul>
                        <li>Sensitive data detection</li>
                        <li>Path validation</li>
                        <li>Permission checks</li>
                    </ul>
                </div>
                <div class="card-actions">
                    <button onclick="runCommand('vscode-xcode-integration.scanForSensitiveData')">
                        <i class="codicon codicon-search"></i> Scan for Sensitive Data
                    </button>
                    <button onclick="runCommand('vscode-xcode-integration.validateProjectPaths')">
                        <i class="codicon codicon-check-all"></i> Validate Paths
                    </button>
                    <button onclick="runCommand('vscode-xcode-integration.showSecurityStatus')">
                        <i class="codicon codicon-info"></i> Security Status
                    </button>
                </div>
            </div>

            <!-- Error Handling Card -->
            <div class="card">
                <div class="card-header">
                    <span class="component-icon">
                        <i class="codicon codicon-bug"></i>
                    </span>
                    <h3>Error Handling & Recovery</h3>
                    <span class="status-badge ${statuses.errorHandling.enabled ? 'status-enabled' : 'status-disabled'}">
                        ${statuses.errorHandling.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
                <div class="card-content">
                    <p>Advanced error management with:</p>
                    <ul>
                        <li>Transaction-based operations</li>
                        <li>Automatic rollback on failure</li>
                        <li>Project integrity checking</li>
                        <li>Self-healing mechanisms</li>
                    </ul>
                </div>
                <div class="card-actions">
                    <button onclick="runCommand('vscode-xcode-integration.checkProjectIntegrity')">
                        <i class="codicon codicon-checklist"></i> Check Integrity
                    </button>
                    <button onclick="runCommand('vscode-xcode-integration.repairProject')">
                        <i class="codicon codicon-tools"></i> Repair Project
                    </button>
                    <button onclick="runCommand('vscode-xcode-integration.viewTransactionLog')">
                        <i class="codicon codicon-output"></i> View Logs
                    </button>
                </div>
            </div>
        </div>

        <div class="col">
            <!-- Multi-Project Support Card -->
            <div class="card">
                <div class="card-header">
                    <span class="component-icon">
                        <i class="codicon codicon-type-hierarchy-sub"></i>
                    </span>
                    <h3>Multi-Project Support</h3>
                    <span class="status-badge ${statuses.multiProject.enabled ? 'status-enabled' : 'status-disabled'}">
                        ${statuses.multiProject.enabled ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div class="card-content">
                    ${statuses.multiProject.enabled ? `
                        <div class="info-row">
                            <div class="info-label">Workspace:</div>
                            <div class="info-value">${statuses.multiProject.workspace}</div>
                        </div>
                        ${statuses.multiProject.projects.length > 0 ? `
                            <div class="info-row">
                                <div class="info-label">Projects:</div>
                                <div class="info-value">
                                    <ul>
                                        ${statuses.multiProject.projects.map((project: string) => `<li>${project}</li>`).join('')}
                                    </ul>
                                </div>
                            </div>
                        ` : ''}
                    ` : `
                        <p>${statuses.project.exists ? 'This appears to be a single project, not a workspace.' : 'No workspace detected.'}</p>
                    `}
                </div>
                <div class="card-actions">
                    <button onclick="runCommand('vscode-xcode-integration.detectWorkspace')">
                        <i class="codicon codicon-search"></i> Detect Workspace
                    </button>
                    ${statuses.multiProject.enabled ? `
                        <button onclick="runCommand('vscode-xcode-integration.selectWorkspaceScheme')">
                            <i class="codicon codicon-list-selection"></i> Select Scheme
                        </button>
                        <button onclick="runCommand('vscode-xcode-integration.buildDependencyGraph')">
                            <i class="codicon codicon-references"></i> Dependency Graph
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Version Control Card -->
            <div class="card">
                <div class="card-header">
                    <span class="component-icon">
                        <i class="codicon codicon-source-control"></i>
                    </span>
                    <h3>Version Control</h3>
                    <span class="status-badge ${statuses.versionControl.enabled ? 'status-enabled' : 'status-disabled'}">
                        ${statuses.versionControl.enabled ? 'Git Repository' : 'No Repository'}
                    </span>
                </div>
                <div class="card-content">
                    ${statuses.versionControl.enabled ? `
                        <div class="info-row">
                            <div class="info-label">Repository:</div>
                            <div class="info-value">${statuses.versionControl.repository}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Status:</div>
                            <div class="info-value">${statuses.versionControl.status}</div>
                        </div>
                        <p>Advanced Git integration for Xcode projects:</p>
                        <ul>
                            <li>Custom merge tools for Xcode files</li>
                            <li>Project state saving & restoration</li>
                            <li>Visual conflict resolution</li>
                        </ul>
                    ` : `
                        <p>No Git repository detected. Initialize a repository to access version control features.</p>
                    `}
                </div>
                <div class="card-actions">
                    ${statuses.versionControl.enabled ? `
                        <button onclick="runCommand('vscode-xcode-integration.setupGitHooks')">
                            <i class="codicon codicon-plug"></i> Setup Git Hooks
                        </button>
                        <button onclick="runCommand('vscode-xcode-integration.saveProjectState')">
                            <i class="codicon codicon-save"></i> Save State
                        </button>
                        <button onclick="runCommand('vscode-xcode-integration.showGitStatus')">
                            <i class="codicon codicon-info"></i> View Status
                        </button>
                    ` : `
                        <button onclick="runCommand('git.init')">
                            <i class="codicon codicon-source-control"></i> Initialize Repository
                        </button>
                    `}
                </div>
            </div>

            <!-- Help & Support Card -->
            <div class="card">
                <div class="card-header">
                    <span class="component-icon">
                        <i class="codicon codicon-question"></i>
                    </span>
                    <h3>Help & Support</h3>
                </div>
                <div class="card-content">
                    <p>Resources for getting the most out of VSCode-Xcode Integration:</p>
                    <ul>
                        <li><a href="#" onclick="runCommand('vscode-xcode-integration.showSetupWizard')">Run Setup Wizard</a></li>
                        <li><a href="#" onclick="runCommand('vscode-xcode-integration.showWelcome')">Getting Started Guide</a></li>
                        <li><a href="#" onclick="openUrl('https://github.com/yourusername/vscode-xcode-integration')">Documentation & GitHub Repository</a></li>
                    </ul>
                </div>
                <div class="card-actions">
                    <button onclick="runCommand('vscode-xcode-integration.showSetupWizard')">
                        <i class="codicon codicon-rocket"></i> Setup Wizard
                    </button>
                    <button onclick="openSettings('')">
                        <i class="codicon codicon-settings-gear"></i> Extension Settings
                    </button>
                </div>
            </div>
        </div>
    </div>

    <footer>
        <p>VSCode-Xcode Integration Dashboard • Version 0.2.0</p>
    </footer>

    <script>
        const vscode = acquireVsCodeApi();

        // Handle messages sent from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'update':
                    // Handle update message
                    break;
            }
        });

        function runCommand(commandId) {
            vscode.postMessage({
                command: 'runCommand',
                commandId: commandId
            });
        }

        function openSettings(query) {
            vscode.postMessage({
                command: 'openSettings',
                query: query
            });
        }

        function refreshDashboard() {
            vscode.postMessage({
                command: 'getStatus'
            });
        }

        function openUrl(url) {
            vscode.postMessage({
                command: 'openUrl',
                url: url
            });
        }

        function runScript(script, args) {
            vscode.postMessage({
                command: 'runScript',
                script: script,
                args: args
            });
        }

        // Refresh dashboard every 30 seconds
        setInterval(refreshDashboard, 30000);
    </script>
</body>
</html>`;
}

/**
 * Run a system script
 * @param script Script to run (e.g., 'open')
 * @param args Arguments for the script
 * @param outputChannel Output channel for logging
 */
function runScript(script: string, args: string[], outputChannel: vscode.OutputChannel): void {
    try {
        cp.spawn(script, args, {
            detached: true,
            stdio: 'ignore'
        }).unref();
    } catch (err) {
        outputChannel.appendLine(`Error running script ${script}: ${err}`);
    }
}