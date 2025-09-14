const fetch = require('node-fetch');
const vscode = require('vscode');
const prompts = require('./prompts');

function getConfig() {
  const cfg = vscode.workspace.getConfiguration('qwen');
  return {
    serviceUrl: cfg.get('serviceUrl') || 'http://127.0.0.1:8755',
    apiMode: cfg.get('apiMode') || 'auto',
    apiKey: cfg.get('apiKey') || '',
    maxTokens: cfg.get('maxTokens') || 1024
  };
}

async function callModel(prompt, opts = {}) {
  const cfg = getConfig();
  const max_tokens = opts.max_tokens || opts.maxTokens || cfg.maxTokens || 1024;
  let body, url, headers = {'Content-Type':'application/json'};
  if(cfg.apiKey) headers['Authorization'] = 'Bearer ' + cfg.apiKey;
  // Try OpenAI-compatible chat completions if apiMode is openai or auto
  if(cfg.apiMode === 'openai' || cfg.apiMode === 'auto') {
    url = cfg.serviceUrl.replace(/\/$/, '') + '/v1/chat/completions';
    body = {
      model: 'qwen2-0.5b',
      messages: [
        {role: 'system', content: prompts.systemPrompt},
        {role: 'user', content: prompt}
      ],
      max_tokens
    };
    try {
      const res = await fetch(url, {method:'POST', headers, body: JSON.stringify(body)});
      if(res.ok) return await res.json();
      // otherwise fallthrough to simple mode
    } catch(e) {
      // console.warn('OpenAI-mode failed, trying simple mode', e);
    }
  }
  // Simple generate endpoint: POST /generate {prompt, max_tokens}
  url = cfg.serviceUrl.replace(/\/$/, '') + '/generate';
  body = {prompt, max_tokens};
  const res = await fetch(url, {method:'POST', headers, body: JSON.stringify(body)});
  if(!res.ok) {
    const txt = await res.text();
    throw new Error('Model call failed: ' + res.status + ' ' + txt);
  }
  // adapt response types
  const ct = res.headers.get('content-type') || '';
  if(ct.includes('application/json')) {
    return await res.json();
  } else {
    return {text: await res.text()};
  }
}

function extractTextFromResponse(resp) {
  // Try common shapes: OpenAI chat/completions, or simple {text}
  if(!resp) return '';
  if(resp.choices && resp.choices.length) {
    const c = resp.choices[0];
    if(c.message && c.message.content) return c.message.content;
    if(c.text) return c.text;
  }
  if(resp.text) return resp.text;
  if(typeof resp === 'string') return resp;
  try { return JSON.stringify(resp,null,2); } catch(e) { return String(resp); }
}

function buildInstructionPromptForGenerate(desc, fname) {
  return `You are Qwen, a helpful coding assistant. The user asked: create a file named ${fname}. Follow best practices for the target language based on file name. Provide only the file content, do not include backticks or markdown.\n\nUser request:\n${desc}\n\nIf the language can use package.json or imports, assume the workspace has common tooling. Keep file size reasonable.`;
}

function buildInstructionPromptForExplain(selection, task) {
  return `You are Qwen, a debugging assistant for developers. Task: ${task}. Here is the code:\n\n${selection}\n\nExplain what's happening, possible bugs, and provide suggested fixes or tests when appropriate. Provide concise code snippets if needed.`;
}

function buildInstructionPromptForCompletion(before, after, lang) {
  return `You are Qwen, an AI code completion assistant. Language: ${lang}. Here is the code before the cursor:\n\n${before}\n\nAnd after the cursor:\n\n${after}\n\nProvide a code completion snippet that fits here. Keep it brief (max 200 tokens). Respond with only the code snippet.`;
}

async function gatherWorkspaceSnapshot(wsUri) {
  const files = [];
  const folders = await vscode.workspace.fs.readDirectory(wsUri);
  async function walk(dirUri, relPath='') {
    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    for(const [name, type] of entries) {
      const child = vscode.Uri.joinPath(dirUri, name);
      const rpath = relPath ? relPath + '/' + name : name;
      if(type === vscode.FileType.File) {
        try {
          const bytes = await vscode.workspace.fs.readFile(child);
          const text = bytes.toString('utf8').slice(0, 8*1024); // first 8KB
          files.push({path: rpath, snippet: text});
        } catch(e) {}
      } else if(type === vscode.FileType.Directory) {
        await walk(child, rpath);
      }
    }
  }
  await walk(wsUri);
  return files;
}

function buildInstructionPromptForWorkspace(files, task) {
  const list = files.map(f => `- ${f.path}:\n\`\`\`\n${(f.snippet||'').slice(0,1000)}\n\`\`\``).join('\n\n');
  return `You are Qwen, an expert senior engineer reviewing a codebase. Task: ${task}. Here is a snapshot of workspace files (only small snippets):\n\n${list}\n\nProvide a prioritized list of suggested changes, new files, or refactors. For each suggestion include sample code or filenames to add.`;
}

module.exports = {
  callModel, extractTextFromResponse, buildInstructionPromptForGenerate,
  buildInstructionPromptForExplain, buildInstructionPromptForCompletion,
  gatherWorkspaceSnapshot, buildInstructionPromptForWorkspace
};
