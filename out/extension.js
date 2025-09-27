"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class GroupedScriptsHoverProvider {
    provideHover(document, position) {
        if (path.basename(document.fileName) !== 'package.json') {
            return null;
        }
        try {
            const packageJson = JSON.parse(document.getText());
            console.log(packageJson);
            if (!packageJson.groupedScripts) {
                return null;
            }
            const range = document.getWordRangeAtPosition(position);
            if (!range) {
                return null;
            }
            const word = document.getText(range);
            const jsonContext = this.getJsonContext(document, position);
            const scriptPath = this.findScriptPath(packageJson.groupedScripts, word, jsonContext);
            if (scriptPath) {
                const runButton = new vscode.MarkdownString();
                runButton.isTrusted = true;
                runButton.appendMarkdown(`**Grouped Script:** \`${scriptPath.path}\`\n\n`);
                runButton.appendMarkdown(`**Command:** \`${scriptPath.command}\`\n\n`);
                runButton.appendMarkdown(`[▶️ Run Script](command:grouped-scripts-runner.runScript?${encodeURIComponent(JSON.stringify({
                    command: scriptPath.command,
                    path: scriptPath.path,
                    workspaceFolder: vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
                }))})`);
                return new vscode.Hover(runButton, range);
            }
        }
        catch (error) {
            console.error('Error parsing package.json:', error);
        }
        return null;
    }
    getJsonContext(document, position) {
        const text = document.getText();
        const offset = document.offsetAt(position);
        // Find the groupedScripts section start
        const groupedScriptsMatch = text.match(/"groupedScripts"\s*:\s*\{/);
        if (!groupedScriptsMatch) {
            return [];
        }
        const groupedScriptsStart = groupedScriptsMatch.index + groupedScriptsMatch[0].length;
        if (offset < groupedScriptsStart) {
            return [];
        }
        // Extract the text from groupedScripts start to current position
        const relevantText = text.substring(groupedScriptsStart, offset);
        // Track the JSON path by counting braces and finding keys
        const context = [];
        let braceDepth = 0;
        let currentKey = '';
        let inString = false;
        let escapeNext = false;
        for (let i = 0; i < relevantText.length; i++) {
            const char = relevantText[i];
            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            if (char === '"') {
                if (inString) {
                    inString = false;
                    // Check if this is a key (followed by colon)
                    const nextNonWhitespace = relevantText.substring(i + 1).match(/^\s*:/);
                    if (nextNonWhitespace && currentKey) {
                        // This is a key, check if it starts a new object
                        const afterColon = relevantText.substring(i + 1 + nextNonWhitespace[0].length);
                        const nextNonWhitespaceAfterColon = afterColon.match(/^\s*\{/);
                        if (nextNonWhitespaceAfterColon) {
                            context.push(currentKey);
                        }
                    }
                    currentKey = '';
                }
                else {
                    inString = true;
                    currentKey = '';
                }
            }
            else if (inString) {
                currentKey += char;
            }
            else if (char === '{') {
                braceDepth++;
            }
            else if (char === '}') {
                braceDepth--;
                if (context.length > 0) {
                    context.pop();
                }
            }
        }
        return context;
    }
    findScriptPath(scripts, targetKey, jsonContext) {
        // Try to find the script in the exact context first
        let currentObj = scripts;
        const contextPath = [];
        // Navigate to the context
        for (const contextKey of jsonContext) {
            if (currentObj && typeof currentObj === 'object' && contextKey in currentObj) {
                contextPath.push(contextKey);
                const next = currentObj[contextKey];
                if (typeof next === 'object' && next !== null) {
                    currentObj = next;
                }
                else {
                    // Context leads to a string value, not an object
                    break;
                }
            }
            else {
                // Context path doesn't exist, fall back to broader search
                break;
            }
        }
        // Look for the target key in the current context
        if (currentObj && typeof currentObj === 'object' && targetKey in currentObj) {
            const value = currentObj[targetKey];
            if (typeof value === 'string') {
                return {
                    path: [...contextPath, targetKey].join(' → '),
                    command: value
                };
            }
        }
        // If not found in exact context, fall back to the original logic but prefer matches closer to the context
        const allMatches = [];
        const findInObject = (obj, currentPath = []) => {
            for (const [key, value] of Object.entries(obj)) {
                const newPath = [...currentPath, key];
                if (typeof value === 'string' && key === targetKey) {
                    // Calculate how well this path matches the context
                    let contextMatch = 0;
                    for (let i = 0; i < Math.min(jsonContext.length, currentPath.length); i++) {
                        if (jsonContext[i] === currentPath[i]) {
                            contextMatch++;
                        }
                        else {
                            break;
                        }
                    }
                    allMatches.push({
                        path: newPath.join(' → '),
                        command: value,
                        fullPath: newPath,
                        contextMatch
                    });
                }
                else if (typeof value === 'object' && value !== null) {
                    findInObject(value, newPath);
                }
            }
        };
        findInObject(scripts);
        if (allMatches.length === 0) {
            return null;
        }
        if (allMatches.length === 1) {
            return { path: allMatches[0].path, command: allMatches[0].command };
        }
        // Sort by context match (descending), then by depth (descending)
        allMatches.sort((a, b) => {
            if (a.contextMatch !== b.contextMatch) {
                return b.contextMatch - a.contextMatch;
            }
            return b.fullPath.length - a.fullPath.length;
        });
        return { path: allMatches[0].path, command: allMatches[0].command };
    }
}
function activate(context) {
    console.log('Grouped Scripts Runner extension is now active!');
    const hoverProvider = vscode.languages.registerHoverProvider({ language: 'json', pattern: '**/package.json' }, new GroupedScriptsHoverProvider());
    const runScriptCommand = vscode.commands.registerCommand('grouped-scripts-runner.runScript', async (args) => {
        if (!args || !args.command) {
            vscode.window.showErrorMessage('No script command provided');
            return;
        }
        const workspaceFolder = args.workspaceFolder || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }
        const terminalName = `Grouped Scripts: ${args.path}`;
        let terminal = vscode.window.terminals.find(t => t.name === terminalName);
        if (!terminal) {
            terminal = vscode.window.createTerminal({
                name: terminalName,
                cwd: workspaceFolder
            });
        }
        terminal.show();
        const fullCommand = `${args.command}`;
        terminal.sendText(fullCommand);
        vscode.window.showInformationMessage(`Running script "${args.path}" in terminal`);
    });
    context.subscriptions.push(hoverProvider, runScriptCommand);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map