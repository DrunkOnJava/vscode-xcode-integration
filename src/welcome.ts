import * as vscode from 'vscode';
// @ts-ignore - Used in other files or for future use
// @ts-ignore - Used in other files or for future use
import * as path from 'path';
// @ts-ignore - Used in other files or for future use
// @ts-ignore - Used in other files or for future use
import * as fs from 'fs';
// @ts-ignore - Used in other files or for future use
// @ts-ignore - Used in other files or for future use
import * as cp from 'child_process';

/**
 * Welcome WebviewPanel
 */
let welcomePanel: vscode.WebviewPanel | undefined;

/**
 * Creates and shows the Welcome view
 * @param context Extension context
 * @param outputChannel Output channel for logging
 */
export function showWelcome(context: vscode.ExtensionContext, // @ts-ignore - Used in other files or for future use
// @ts-ignore - Used in other files or for future use
outputChannel: vscode.OutputChannel): void {
    // If we already have a panel, show it
    if (welcomePanel) {
        welcomePanel.reveal(vscode.ViewColumn.One);
        return;
    }

    // Create a new panel
    welcomePanel = vscode.window.createWebviewPanel(
        'xcodeIntegrationWelcome',
        'Welcome to VSCode-Xcode Integration',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: vscode.workspace.workspaceFolders 
                ? [vscode.Uri.file(context.extensionPath), ...vscode.workspace.workspaceFolders.map(folder => folder.uri)]
                : [vscode.Uri.file(context.extensionPath)]
        }
    );

    // Set HTML content
    welcomePanel.webview.html = getWelcomeHtml(context, welcomePanel.webview);

    // Handle messages from the webview
    welcomePanel.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'runCommand':
                    vscode.commands.executeCommand(message.commandId);
                    return;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', message.query);
                    return;
                case 'openUrl':
                    vscode.env.openExternal(vscode.Uri.parse(message.url));
                    return;
                case 'runSetupWizard':
                    vscode.commands.executeCommand('vscode-xcode-integration.showSetupWizard');
                    return;
                case 'openDashboard':
                    vscode.commands.executeCommand('vscode-xcode-integration.showDashboard');
                    return;
                case 'dismiss':
                    setWelcomeDismissed(context);
                    if (welcomePanel) {
                        welcomePanel.dispose();
                    }
                    return;
            }
        },
        undefined,
        context.subscriptions
    );

    // Reset when the panel is closed
    welcomePanel.onDidDispose(
        () => {
            welcomePanel = undefined;
        },
        null,
        context.subscriptions
    );
}

/**
 * Set the welcome view as dismissed
 * @param context Extension context
 */
function setWelcomeDismissed(context: vscode.ExtensionContext): void {
    context.globalState.update('vscode-xcode-integration.welcomeDismissed', true);
}

/**
 * Check if the welcome view has been dismissed
 * @param context Extension context
 * @returns True if welcome has been dismissed
 */
export function isWelcomeDismissed(context: vscode.ExtensionContext): boolean {
    return context.globalState.get('vscode-xcode-integration.welcomeDismissed', false);
}

/**
 * Generate the HTML for the welcome view
 * @param context Extension context
 * @param webview Webview to generate content for
 * @returns HTML content
 */
function getWelcomeHtml(context: vscode.ExtensionContext, webview: vscode.Webview): string {
    const extensionUri = context.extensionUri;
    const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
    const welcomeCss = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'welcome.css'));
    const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'xcode-icon.png'));

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${codiconsUri}" rel="stylesheet">
    <link href="${welcomeCss}" rel="stylesheet">
    <title>Welcome to VSCode-Xcode Integration</title>
    <style>
        :root {
            --container-padding: 20px;
            --section-padding: 24px;
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
            max-width: 1200px;
            margin: 0 auto;
        }
        
        h1, h2, h3 {
            color: var(--heading-color);
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
        }
        
        h1 {
            font-size: 2.5em;
            text-align: center;
            margin-top: 0;
        }
        
        h2 {
            font-size: 1.8em;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 8px;
        }

        h3 {
            font-size: 1.4em;
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
            padding: 10px 16px;
            background-color: var(--button-background);
            color: var(--button-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            cursor: pointer;
            outline: none;
            border-radius: 4px;
            margin-right: 12px;
            margin-bottom: 12px;
            display: inline-flex;
            align-items: center;
        }
        
        button:hover,
        .button:hover {
            background-color: var(--button-hover-background);
        }

        button.cta-button {
            font-size: 1.2em;
            padding: 12px 24px;
        }

        button i {
            margin-right: 8px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .logo {
            width: 100px;
            height: 100px;
            margin-bottom: 20px;
        }

        .subtitle {
            font-size: 1.2em;
            opacity: 0.9;
            margin-bottom: 30px;
            text-align: center;
        }
        
        .section {
            margin-bottom: 40px;
        }
        
        .features {
            display: flex;
            flex-wrap: wrap;
            margin: 0 -15px;
        }
        
        .feature {
            flex: 1 0 30%;
            min-width: 250px;
            margin: 15px;
            padding: 20px;
            background-color: var(--card-background);
            border-radius: 8px;
            border: 1px solid var(--border-color);
        }
        
        .feature-icon {
            font-size: 2em;
            margin-bottom: 15px;
        }
        
        .feature-title {
            font-size: 1.2em;
            font-weight: 600;
            margin-bottom: 10px;
        }
        
        .feature-description {
            margin-bottom: 15px;
        }
        
        .cta-container {
            text-align: center;
            margin: 40px 0;
        }
        
        .getting-started {
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: var(--section-padding);
            margin-bottom: 40px;
            background-color: var(--card-background);
        }
        
        .step {
            margin-bottom: 20px;
            display: flex;
        }
        
        .step-number {
            flex: 0 0 30px;
            font-size: 1.5em;
            font-weight: bold;
            color: var(--link-color);
        }
        
        .step-content {
            flex: 1;
        }
        
        .step-title {
            font-weight: 600;
            margin-bottom: 6px;
        }
        
        footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid var(--border-color);
            text-align: center;
            font-size: 0.9em;
            opacity: 0.8;
        }

        .actions {
            margin-top: 15px;
        }

        .dismiss-container {
            text-align: right;
            margin-top: 40px;
        }
    </style>
</head>
<body>
    <div class="header">
        <img src="${logoUri}" alt="VSCode-Xcode Integration Logo" class="logo">
        <h1>Welcome to VSCode-Xcode Integration</h1>
        <p class="subtitle">
            The bridge between Visual Studio Code and Xcode for seamless iOS and macOS development
        </p>
    </div>

    <div class="cta-container">
        <button class="cta-button" onclick="runSetupWizard()">
            <i class="codicon codicon-rocket"></i> Run Setup Wizard
        </button>
        <button class="cta-button" onclick="openDashboard()">
            <i class="codicon codicon-dashboard"></i> Open Dashboard
        </button>
    </div>

    <div class="section">
        <h2>Powerful Features</h2>
        <div class="features">
            <div class="feature">
                <div class="feature-icon"><i class="codicon codicon-sync"></i></div>
                <div class="feature-title">File Synchronization</div>
                <div class="feature-description">
                    Automatic syncing between VSCode edits and Xcode project, keeping both environments in perfect harmony.
                </div>
            </div>
            <div class="feature">
                <div class="feature-icon"><i class="codicon codicon-dashboard"></i></div>
                <div class="feature-title">Performance Optimization</div>
                <div class="feature-description">
                    Smart file watching, throttling and incremental updates for efficient development, even with large projects.
                </div>
            </div>
            <div class="feature">
                <div class="feature-icon"><i class="codicon codicon-shield"></i></div>
                <div class="feature-title">Security Enhancements</div>
                <div class="feature-description">
                    Sensitive data detection, path validation, and permission checking for safer development.
                </div>
            </div>
            <div class="feature">
                <div class="feature-icon"><i class="codicon codicon-bug"></i></div>
                <div class="feature-title">Error Recovery</div>
                <div class="feature-description">
                    Transaction-based file operations with rollback capabilities, integrity checking, and self-healing.
                </div>
            </div>
            <div class="feature">
                <div class="feature-icon"><i class="codicon codicon-source-control"></i></div>
                <div class="feature-title">Version Control</div>
                <div class="feature-description">
                    Specialized Git integration with merge tools for Xcode files and project state management.
                </div>
            </div>
            <div class="feature">
                <div class="feature-icon"><i class="codicon codicon-type-hierarchy-sub"></i></div>
                <div class="feature-title">Multi-Project Support</div>
                <div class="feature-description">
                    Handle complex workspaces with dependency graph visualization and cross-project references.
                </div>
            </div>
        </div>
    </div>

    <div class="getting-started">
        <h2>Getting Started</h2>
        <div class="step">
            <div class="step-number">1</div>
            <div class="step-content">
                <div class="step-title">Run the Setup Wizard</div>
                <div class="step-description">
                    The setup wizard will guide you through setting up the integration for your Xcode project, configuring
                    features to match your workflow and project size.
                </div>
                <div class="actions">
                    <button onclick="runSetupWizard()">
                        <i class="codicon codicon-rocket"></i> Launch Setup Wizard
                    </button>
                </div>
            </div>
        </div>
        <div class="step">
            <div class="step-number">2</div>
            <div class="step-content">
                <div class="step-title">Open Your Xcode Project in VSCode</div>
                <div class="step-description">
                    Open your Xcode project folder in VSCode. The extension will detect the Xcode project structure and set up
                    the workspace accordingly.
                </div>
                <div class="actions">
                    <button onclick="runCommand('workbench.action.files.openFolder')">
                        <i class="codicon codicon-folder-opened"></i> Open Folder
                    </button>
                </div>
            </div>
        </div>
        <div class="step">
            <div class="step-number">3</div>
            <div class="step-content">
                <div class="step-title">Start Editing and Building</div>
                <div class="step-description">
                    Begin editing your Swift files in VSCode. Changes will automatically sync with Xcode. Use the extension to
                    build, test, and manage your project directly from VSCode.
                </div>
                <div class="actions">
                    <button onclick="openDashboard()">
                        <i class="codicon codicon-dashboard"></i> Open Dashboard
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Learn More</h2>
        <p>
            Explore these resources to get the most out of VSCode-Xcode Integration:
        </p>
        <ul>
            <li><a href="#" onclick="openUrl('https://github.com/yourusername/vscode-xcode-integration/wiki/Getting-Started')">Documentation Wiki</a> - Comprehensive guide to all features</li>
            <li><a href="#" onclick="openUrl('https://github.com/yourusername/vscode-xcode-integration')">GitHub Repository</a> - Source code, issues, and contributions</li>
            <li><a href="#" onclick="openSettings('')">Extension Settings</a> - Configure the extension to match your workflow</li>
        </ul>
    </div>

    <div class="dismiss-container">
        <button onclick="dismiss()">Don't Show Again</button>
    </div>

    <footer>
        <p>VSCode-Xcode Integration • Version 0.2.0</p>
    </footer>

    <script>
        const vscode = acquireVsCodeApi();

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

        function openUrl(url) {
            vscode.postMessage({
                command: 'openUrl',
                url: url
            });
        }

        function runSetupWizard() {
            vscode.postMessage({
                command: 'runSetupWizard'
            });
        }

        function openDashboard() {
            vscode.postMessage({
                command: 'openDashboard'
            });
        }

        function dismiss() {
            vscode.postMessage({
                command: 'dismiss'
            });
        }
    </script>
</body>
</html>`;
}
