// @ts-check

// Script run within the webview itself.
(function() {
    // Get a reference to the VS Code API from the HTML
    const vscode = acquireVsCodeApi();

    // State
    let documentText = '';
    let conflicts = [];
    let sections = [];

    // UI elements we need to access
    const analyzeButton = document.getElementById('analyze-conflicts');
    const resolveAllButton = document.getElementById('resolve-all');
    const conflictCountElement = document.getElementById('conflict-count');
    const conflictsList = document.getElementById('conflicts-list');
    const sectionList = document.querySelector('.section-list');
    const editorWrapper = document.getElementById('editor-wrapper');

    // CodeMirror setup - we create this after the page loads
    /** @type {CodeMirror.EditorFromTextArea} */
    let editor;

    // Set up core editor with CodeMirror when the page is fully loaded
    document.addEventListener('DOMContentLoaded', () => {
        // Create CodeMirror editor (assuming CodeMirror is already loaded via webview)
        editor = CodeMirror(editorWrapper, {
            lineNumbers: true,
            mode: 'javascript', // Mode for pbxproj files (JavaScript-like)
            theme: 'monokai',   // Dark theme matching VS Code
            lineWrapping: false,
            gutters: ['CodeMirror-linenumbers', 'conflicts'],
            extraKeys: {
                'Ctrl-S': saveDocument,
                'Cmd-S': saveDocument
            }
        });
    });

    // Save the document back to VS Code
    function saveDocument() {
        const content = editor.getValue();
        vscode.postMessage({
            command: 'save',
            text: content
        });
    }

    // Update editor content with new text
    function updateContent(text) {
        documentText = text;
        if (editor) {
            editor.setValue(text);
            editor.refresh();
            highlightConflicts();
        }
    }

    // Process conflict data
    function setConflicts(conflictData) {
        conflicts = conflictData.conflicts || [];
        sections = conflictData.sections || [];

        // Update UI elements
        if (conflictCountElement) {
            conflictCountElement.textContent = conflicts.length.toString();
        }

        renderSections();
        renderConflicts();
        highlightConflicts();
    }

    // Render the list of sections in the sidebar
    function renderSections() {
        if (!sectionList) return;

        sectionList.innerHTML = '';
        
        sections.forEach(section => {
            const sectionElement = document.createElement('div');
            sectionElement.className = 'section-item';
            
            if (section.hasConflicts) {
                sectionElement.classList.add('has-conflicts');
            }
            
            sectionElement.textContent = section.name;
            sectionElement.addEventListener('click', () => {
                scrollToLine(section.startLine);
            });
            
            sectionList.appendChild(sectionElement);
        });
    }

    // Render the list of conflicts
    function renderConflicts() {
        if (!conflictsList) return;

        conflictsList.innerHTML = '';
        
        conflicts.forEach((conflict, index) => {
            const conflictElement = document.createElement('div');
            conflictElement.className = 'conflict-item';
            
            const header = document.createElement('div');
            header.className = 'conflict-header';
            header.textContent = `Conflict #${index + 1} in ${conflict.section} (Line ${conflict.startLine})`;
            conflictElement.appendChild(header);
            
            const actions = document.createElement('div');
            actions.className = 'conflict-actions';
            
            const useOursButton = document.createElement('button');
            useOursButton.textContent = 'Use Ours';
            useOursButton.addEventListener('click', () => resolveConflict(conflict, 'ours'));
            actions.appendChild(useOursButton);
            
            const useTheirsButton = document.createElement('button');
            useTheirsButton.textContent = 'Use Theirs';
            useTheirsButton.addEventListener('click', () => resolveConflict(conflict, 'theirs'));
            actions.appendChild(useTheirsButton);
            
            const useBothButton = document.createElement('button');
            useBothButton.textContent = 'Use Both';
            useBothButton.addEventListener('click', () => resolveConflict(conflict, 'both'));
            actions.appendChild(useBothButton);
            
            conflictElement.appendChild(actions);
            
            // Preview sections for ours and theirs
            const preview = document.createElement('div');
            preview.className = 'conflict-preview';
            
            const ourPreview = document.createElement('div');
            ourPreview.className = 'preview-section ours';
            ourPreview.innerHTML = `<h4>Ours</h4><pre>${escapeHtml(conflict.ours.slice(0, 200) + (conflict.ours.length > 200 ? '...' : ''))}</pre>`;
            preview.appendChild(ourPreview);
            
            const theirPreview = document.createElement('div');
            theirPreview.className = 'preview-section theirs';
            theirPreview.innerHTML = `<h4>Theirs</h4><pre>${escapeHtml(conflict.theirs.slice(0, 200) + (conflict.theirs.length > 200 ? '...' : ''))}</pre>`;
            preview.appendChild(theirPreview);
            
            conflictElement.appendChild(preview);
            
            conflictsList.appendChild(conflictElement);
        });
    }

    // Highlight conflicts in the editor
    function highlightConflicts() {
        if (!editor) return;

        // Clear existing markers
        editor.clearGutter('conflicts');
        
        // Add markers for conflicts
        conflicts.forEach(conflict => {
            // Mark the conflict start, middle, and end
            for (let i = conflict.startLine - 1; i <= conflict.endLine - 1; i++) {
                // Add conflict marker in the gutter
                editor.setGutterMarker(i, 'conflicts', makeConflictMarker(i - conflict.startLine + 1));
                
                // Add appropriate background class
                if (i === conflict.startLine - 1) {
                    editor.addLineClass(i, 'background', 'conflict-start');
                } else if (i === conflict.middleLine - 1) {
                    editor.addLineClass(i, 'background', 'conflict-middle');
                } else if (i === conflict.endLine - 1) {
                    editor.addLineClass(i, 'background', 'conflict-end');
                }
            }
        });
    }

    // Create a marker for the gutter
    function makeConflictMarker(number) {
        const marker = document.createElement('div');
        marker.className = 'conflict-marker';
        marker.innerHTML = '!';
        marker.title = `Conflict #${number}`;
        return marker;
    }

    // Scroll to a specific line in the editor
    function scrollToLine(line) {
        if (!editor) return;
        
        // Adjust line number (CodeMirror is 0-based)
        const lineIndex = line - 1;
        
        // Scroll to line
        editor.scrollIntoView({line: lineIndex, ch: 0}, 100);
        
        // Set cursor and focus
        editor.setCursor({line: lineIndex, ch: 0});
        editor.focus();
    }

    // Resolve a specific conflict
    function resolveConflict(conflict, resolution) {
        if (!editor) return;
        
        // Get the current document state
        const doc = editor.getDoc();
        
        // Determine the replacement text based on resolution
        let replacement = '';
        
        if (resolution === 'ours') {
            replacement = conflict.ours;
        } else if (resolution === 'theirs') {
            replacement = conflict.theirs;
        } else if (resolution === 'both') {
            replacement = conflict.ours + '\n' + conflict.theirs;
        }
        
        // Replace the conflict with the resolved content
        doc.replaceRange(
            replacement,
            {line: conflict.startLine - 1, ch: 0},
            {line: conflict.endLine, ch: 0}
        );
        
        // Save the document after resolving the conflict
        saveDocument();
        
        // Request fresh conflict analysis
        vscode.postMessage({
            command: 'analyzeConflicts'
        });
    }

    // Resolve all conflicts with "ours" strategy
    function resolveAllConflicts() {
        conflicts.forEach(conflict => {
            resolveConflict(conflict, 'ours');
        });
    }

    // Escape HTML to prevent XSS
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Event listeners for UI elements
    document.addEventListener('DOMContentLoaded', () => {
        if (analyzeButton) {
            analyzeButton.addEventListener('click', () => {
                vscode.postMessage({
                    command: 'analyzeConflicts'
                });
            });
        }
        
        if (resolveAllButton) {
            resolveAllButton.addEventListener('click', resolveAllConflicts);
        }
    });

    // Handle messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'update':
                updateContent(message.text);
                break;
                
            case 'setConflicts':
                setConflicts(message.conflicts);
                break;
        }
    });

    // Initial request to get content and analyze conflicts
    vscode.postMessage({
        command: 'analyzeConflicts'
    });
})();