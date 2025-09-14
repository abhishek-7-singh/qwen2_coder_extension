const vscode = require('vscode');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

function getConfig() {
    const config = vscode.workspace.getConfiguration('qwen');
    return {
        url: config.get('serviceUrl') || 'http://127.0.0.1:8755',
        apiKey: config.get('apiKey') || '',
        apiMode: config.get('apiMode') || 'auto',
        maxTokens: config.get('maxTokens') || 1024
    };
}

async function callQwen(prompt) {
    const { url, apiKey, apiMode, maxTokens } = getConfig();

    let body;
    let endpoint = url;

    if (apiMode === 'openai' || apiMode === 'auto') {
        endpoint = url + '/v1/chat/completions';
        body = {
            model: 'qwen2',
            max_tokens: maxTokens,
            messages: [
                { role: 'system', content: 'You are a helpful coding assistant.' },
                { role: 'user', content: prompt }
            ]
        };
    } else {
        endpoint = url + '/generate';
        body = { prompt, max_tokens: maxTokens };
    }

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Qwen error: ${res.status} ${res.statusText}`);

    const data = await res.json();

    // Try to normalize both response types
    if (data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
    }
    if (data.output) return data.output;
    return JSON.stringify(data);
}

// ========== COMMANDS ==========

async function generateFile() {
    const desc = await vscode.window.showInputBox({ prompt: 'Describe the file you want to generate' });
    if (!desc) return;

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Qwen is generating your file...',
        cancellable: false
    }, async () => {
        try {
            const content = await callQwen(`Create a complete file based on this description: ${desc}`);
            const uri = await vscode.window.showSaveDialog({ saveLabel: 'Save Generated File' });
            if (uri) fs.writeFileSync(uri.fsPath, content, 'utf8');
            vscode.window.showInformationMessage('File created!');
        } catch (err) {
            vscode.window.showErrorMessage(err.message);
        }
    });
}

async function explainSelection() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const sel = editor.document.getText(editor.selection);
    if (!sel) {
        vscode.window.showInformationMessage('Select some code first.');
        return;
    }
    try {
        const explanation = await callQwen(`Explain or debug this code:\n\n${sel}`);
        vscode.workspace.openTextDocument({ content: explanation }).then(doc => {
            vscode.window.showTextDocument(doc, { preview: false });
        });
    } catch (err) {
        vscode.window.showErrorMessage(err.message);
    }
}

async function analyzeWorkspace() {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
        vscode.window.showInformationMessage('Open a folder first.');
        return;
    }
    function readTree(dir, depth = 0, maxDepth = 2) {
        if (depth > maxDepth) return '';
        let tree = '';
        for (const item of fs.readdirSync(dir)) {
            const full = path.join(dir, item);
            const stat = fs.statSync(full);
            tree += `${'  '.repeat(depth)}- ${item}\n`;
            if (stat.isDirectory()) tree += readTree(full, depth + 1, maxDepth);
        }
        return tree;
    }
    const structure = readTree(root);

    try {
        const suggestions = await callQwen(
            `Analyze this workspace structure and suggest improvements:\n\n${structure}`
        );
        vscode.workspace.openTextDocument({ content: suggestions }).then(doc => {
            vscode.window.showTextDocument(doc, { preview: false });
        });
    } catch (err) {
        vscode.window.showErrorMessage(err.message);
    }
}

// ========== ENTRY POINT ==========

function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('qwen.generateFile', generateFile),
        vscode.commands.registerCommand('qwen.explainSelection', explainSelection),
        vscode.commands.registerCommand('qwen.analyzeWorkspace', analyzeWorkspace)
    );
    console.log('Qwen Local Coder is now active!');
}

function deactivate() {}

module.exports = { activate, deactivate };
