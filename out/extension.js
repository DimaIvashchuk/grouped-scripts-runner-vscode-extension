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
            if (!packageJson.groupedScripts) {
                return null;
            }
            const range = document.getWordRangeAtPosition(position);
            if (!range) {
                return null;
            }
            const word = document.getText(range);
            const line = document.lineAt(position.line);
            const lineText = line.text;
            const scriptPath = this.findScriptPath(packageJson.groupedScripts, word, lineText);
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
    findScriptPath(scripts, targetKey, lineText) {
        const findInObject = (obj, currentPath = []) => {
            for (const [key, value] of Object.entries(obj)) {
                const newPath = [...currentPath, key];
                if (typeof value === 'string') {
                    if (key === targetKey && lineText.includes(`"${key}"`)) {
                        return {
                            path: newPath.join(' → '),
                            command: value
                        };
                    }
                }
                else if (typeof value === 'object' && value !== null) {
                    const result = findInObject(value, newPath);
                    if (result) {
                        return result;
                    }
                }
            }
            return null;
        };
        return findInObject(scripts);
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