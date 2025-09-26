import * as vscode from 'vscode';
import * as path from 'path';

interface GroupedScripts {
	[key: string]: string | GroupedScripts;
}

class GroupedScriptsHoverProvider implements vscode.HoverProvider {
	provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
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
		} catch (error) {
			console.error('Error parsing package.json:', error);
		}

		return null;
	}

	private findScriptPath(scripts: GroupedScripts, targetKey: string, lineText: string): { path: string; command: string } | null {
		const findInObject = (obj: GroupedScripts, currentPath: string[] = []): { path: string; command: string } | null => {
			for (const [key, value] of Object.entries(obj)) {
				const newPath = [...currentPath, key];
				
				if (typeof value === 'string') {
					if (key === targetKey && lineText.includes(`"${key}"`)) {
						return {
							path: newPath.join(' → '),
							command: value
						};
					}
				} else if (typeof value === 'object' && value !== null) {
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

export function activate(context: vscode.ExtensionContext) {
	console.log('Grouped Scripts Runner extension is now active!');

	const hoverProvider = vscode.languages.registerHoverProvider(
		{ language: 'json', pattern: '**/package.json' },
		new GroupedScriptsHoverProvider()
	);

	const runScriptCommand = vscode.commands.registerCommand(
		'grouped-scripts-runner.runScript',
		async (args: { command: string; path: string; workspaceFolder?: string }) => {
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
		}
	);

	context.subscriptions.push(hoverProvider, runScriptCommand);
}

export function deactivate() {}
