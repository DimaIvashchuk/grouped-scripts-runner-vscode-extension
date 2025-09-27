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
		} catch (error) {
			console.error('Error parsing package.json:', error);
		}

		return null;
	}

	private getJsonContext(document: vscode.TextDocument, position: vscode.Position): string[] {
		const text = document.getText();
		const offset = document.offsetAt(position);
		
		const groupedScriptsMatch = text.match(/"groupedScripts"\s*:\s*\{/);
		if (!groupedScriptsMatch) {
			return [];
		}
		
		const groupedScriptsStart = groupedScriptsMatch.index! + groupedScriptsMatch[0].length;
		if (offset < groupedScriptsStart) {
			return [];
		}
		
		const relevantText = text.substring(groupedScriptsStart, offset);
		
		const context: string[] = [];
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
					const nextNonWhitespace = relevantText.substring(i + 1).match(/^\s*:/);
					if (nextNonWhitespace && currentKey) {
						const afterColon = relevantText.substring(i + 1 + nextNonWhitespace[0].length);
						const nextNonWhitespaceAfterColon = afterColon.match(/^\s*\{/);
						if (nextNonWhitespaceAfterColon) {
							context.push(currentKey);
						}
					}
					currentKey = '';
				} else {
					inString = true;
					currentKey = '';
				}
			} else if (inString) {
				currentKey += char;
			} else if (char === '{') {
				braceDepth++;
			} else if (char === '}') {
				braceDepth--;
				if (context.length > 0) {
					context.pop();
				}
			}
		}
		
		return context;
	}

	private findScriptPath(scripts: GroupedScripts, targetKey: string, jsonContext: string[]): { path: string; command: string } | null {
		let currentObj = scripts;
		const contextPath: string[] = [];
		
		for (const contextKey of jsonContext) {
			if (currentObj && typeof currentObj === 'object' && contextKey in currentObj) {
				contextPath.push(contextKey);
				const next = currentObj[contextKey];
				if (typeof next === 'object' && next !== null) {
					currentObj = next;
				} else {
					break;
				}
			} else {
				break;
			}
		}
		
		if (currentObj && typeof currentObj === 'object' && targetKey in currentObj) {
			const value = currentObj[targetKey];
			if (typeof value === 'string') {
				return {
					path: [...contextPath, targetKey].join(' → '),
					command: value
				};
			}
		}
		
		const allMatches: Array<{ path: string; command: string; fullPath: string[]; contextMatch: number }> = [];
		
		const findInObject = (obj: GroupedScripts, currentPath: string[] = []): void => {
			for (const [key, value] of Object.entries(obj)) {
				const newPath = [...currentPath, key];
				
				if (typeof value === 'string' && key === targetKey) {
					let contextMatch = 0;
					for (let i = 0; i < Math.min(jsonContext.length, currentPath.length); i++) {
						if (jsonContext[i] === currentPath[i]) {
							contextMatch++;
						} else {
							break;
						}
					}
					
					allMatches.push({
						path: newPath.join(' → '),
						command: value,
						fullPath: newPath,
						contextMatch
					});
				} else if (typeof value === 'object' && value !== null) {
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
		
		allMatches.sort((a, b) => {
			if (a.contextMatch !== b.contextMatch) {
				return b.contextMatch - a.contextMatch;
			}
			return b.fullPath.length - a.fullPath.length;
		});
		
		return { path: allMatches[0].path, command: allMatches[0].command };
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Pkg Script Groups extension is now active!');

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
