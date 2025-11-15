# Phi3 Local Coder - Detailed File Documentation

This document provides an in-depth explanation of each file in the Phi3 Local Coder VS Code extension project. Each section breaks down the purpose, structure, functionality, and implementation details of individual files.

---

## Table of Contents

1. [extension.js](#extensionjs)
2. [client.js](#clientjs)
3. [prompts.js](#promptsjs)
4. [package.json](#packagejson)
5. [README.md](#readmemd)
6. [CHANGELOG.md](#changelogmd)
7. [LICENSE](#license)
8. [README_QUICKSTART.txt](#readme_quickstarttxt)

---

## extension.js

**Purpose**: This is the main entry point of the VS Code extension. It handles the extension lifecycle, registers commands, and provides the core functionality for interacting with the Phi3 AI model.

### Detailed Breakdown

#### 1. **Dependencies & Imports**
```javascript
const vscode = require('vscode');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
```

- **vscode**: The VS Code Extension API that provides access to the editor's functionality (commands, windows, workspace, progress notifications, etc.)
- **node-fetch**: HTTP client library used to make API calls to the local Phi3 service
- **fs**: Node.js File System module for reading and writing files
- **path**: Node.js Path module for handling and transforming file paths

#### 2. **Configuration Management**

##### `getConfig()` Function
```javascript
function getConfig() {
    const config = vscode.workspace.getConfiguration('qwen');
    return {
        url: config.get('serviceUrl') || 'http://127.0.0.1:8755',
        apiKey: config.get('apiKey') || '',
        apiMode: config.get('apiMode') || 'auto',
        maxTokens: config.get('maxTokens') || 1024
    };
}
```

**What it does**:
- Retrieves user-configurable settings from VS Code's settings.json
- Provides sensible defaults if settings are not configured
- Returns an object containing all configuration parameters

**Configuration Parameters**:
- `url`: The base URL of the locally hosted Phi3 service (default: http://127.0.0.1:8755)
- `apiKey`: Optional authentication token for securing API requests
- `apiMode`: Determines the API format - 'openai' for OpenAI-compatible endpoints, 'simple' for basic /generate endpoint, or 'auto' to try both
- `maxTokens`: Maximum number of tokens the model should generate (default: 1024)

#### 3. **API Communication Layer**

##### `callQwen()` Function (Core API Interface)
```javascript
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
```

**Detailed Flow**:

1. **Configuration Loading**: Fetches current settings
2. **Endpoint Selection**: Determines which API format to use
   - **OpenAI Mode**: Uses `/v1/chat/completions` with a structured message format including system and user roles
   - **Simple Mode**: Uses `/generate` with a basic prompt structure
   - **Auto Mode**: Tries OpenAI format first (implicit in this implementation)
3. **Request Construction**: Builds the HTTP request with appropriate headers and body
4. **Authentication**: Adds Bearer token if API key is configured
5. **Error Handling**: Throws descriptive errors if the request fails
6. **Response Normalization**: Extracts text from different response formats
   - OpenAI format: `data.choices[0].message.content`
   - Simple format: `data.output`
   - Fallback: Returns JSON string

**Why Two API Modes?**
- Different Phi3 hosting solutions may use different API formats
- OpenAI-compatible format is standard for many LLM servers (vLLM, FastChat, etc.)
- Simple format is useful for minimal custom implementations

#### 4. **Command Implementations**

##### Command 1: `generateFile()`

```javascript
async function generateFile() {
    const desc = await vscode.window.showInputBox({ 
        prompt: 'Describe the file you want to generate' 
    });
    if (!desc) return;

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Qwen is generating your file...',
        cancellable: false
    }, async () => {
        try {
            const content = await callQwen(`Create a complete file based on this description: ${desc}`);
            const uri = await vscode.window.showSaveDialog({ 
                saveLabel: 'Save Generated File' 
            });
            if (uri) fs.writeFileSync(uri.fsPath, content, 'utf8');
            vscode.window.showInformationMessage('File created!');
        } catch (err) {
            vscode.window.showErrorMessage(err.message);
        }
    });
}
```

**Purpose**: Generates a complete file from a natural language description

**Step-by-Step Process**:
1. **User Input**: Shows an input box where users describe the file they want
2. **Validation**: Returns early if user cancels (no description provided)
3. **Progress Indicator**: Shows a notification with "Phi3 is generating your file..." to indicate work is in progress
4. **AI Generation**: Calls Phi3 with a structured prompt requesting file creation
5. **Save Dialog**: Opens a file save dialog for the user to choose location and filename
6. **File Writing**: Writes the generated content to the selected location using UTF-8 encoding
7. **User Feedback**: Shows success or error message

**Use Cases**:
- Generate boilerplate code (e.g., "Create a React component for a login form")
- Create configuration files (e.g., "Create a webpack.config.js for a React app")
- Generate test files (e.g., "Create unit tests for a User class")
- Scaffold entire modules (e.g., "Create a REST API controller for user management")

##### Command 2: `explainSelection()`

```javascript
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
```

**Purpose**: Explains or debugs selected code in the editor

**Step-by-Step Process**:
1. **Editor Access**: Gets the currently active text editor
2. **Early Exit**: Returns if no editor is active
3. **Selection Extraction**: Gets the text content of the current selection
4. **Validation**: Checks if any code is selected, prompts user if not
5. **AI Analysis**: Sends selected code to Phi3 with explanation/debugging request
6. **Result Display**: Opens the explanation in a new editor tab (not preview mode)
7. **Error Handling**: Shows error message if the API call fails

**Use Cases**:
- Understand complex algorithms or logic
- Debug problematic code sections
- Get suggestions for code improvements
- Learn about unfamiliar APIs or patterns
- Identify potential bugs or security issues

##### Command 3: `analyzeWorkspace()`

```javascript
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
```

**Purpose**: Analyzes the workspace folder structure and provides architectural suggestions

**Step-by-Step Process**:
1. **Workspace Detection**: Gets the root path of the first workspace folder
2. **Validation**: Ensures a folder is open in VS Code
3. **Tree Generation**: 
   - Recursively reads directory structure up to 2 levels deep
   - Creates an indented tree representation
   - Limits depth to avoid overwhelming the model with too much data
4. **AI Analysis**: Sends folder structure to Phi3 for analysis
5. **Result Display**: Opens suggestions in a new editor tab

**Inner Function - `readTree()`**:
- **Parameters**:
  - `dir`: Directory path to read
  - `depth`: Current depth level (default: 0)
  - `maxDepth`: Maximum depth to traverse (default: 2)
- **Algorithm**:
  - Uses `fs.readdirSync()` to get directory contents
  - Indents items based on depth using repeated spaces
  - Recursively processes subdirectories
  - Stops at maxDepth to prevent excessive recursion

**Use Cases**:
- Get recommendations for project organization
- Identify missing configuration files
- Discover architectural improvements
- Find optimization opportunities
- Receive best practice suggestions

#### 5. **Extension Lifecycle**

##### `activate()` Function

```javascript
function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('qwen.generateFile', generateFile),
        vscode.commands.registerCommand('qwen.explainSelection', explainSelection),
        vscode.commands.registerCommand('qwen.analyzeWorkspace', analyzeWorkspace)
    );
    console.log('Qwen Local Coder is now active!');
}
```

**Purpose**: Called when the extension is activated (loaded by VS Code)

**Responsibilities**:
1. **Command Registration**: Registers all command implementations with VS Code
   - `qwen.generateFile` → `generateFile()`
   - `qwen.explainSelection` → `explainSelection()`
   - `qwen.analyzeWorkspace` → `analyzeWorkspace()`
2. **Subscription Management**: Adds commands to the context's disposables array for proper cleanup
3. **Logging**: Outputs activation confirmation to the console

**Activation Triggers** (defined in package.json):
- User invokes any of the registered commands
- Files with specific languages are opened (JavaScript, TypeScript, Python, Java)

##### `deactivate()` Function

```javascript
function deactivate() {}
```

**Purpose**: Called when the extension is deactivated (unloaded or disabled)

**Current Implementation**: Empty (no cleanup needed currently)

**When to Add Logic**:
- Closing database connections
- Clearing caches
- Cancelling background tasks
- Releasing resources

#### 6. **Module Exports**

```javascript
module.exports = { activate, deactivate };
```

Exports the required lifecycle functions for VS Code to call.

---

## client.js

**Purpose**: Provides a more sophisticated, modular API client layer with enhanced prompt engineering capabilities. This file offers a cleaner separation of concerns compared to extension.js and includes specialized prompt builders for different use cases.

### Detailed Breakdown

#### 1. **Dependencies**
```javascript
const fetch = require('node-fetch');
const vscode = require('vscode');
const prompts = require('./prompts');
```

- **fetch**: HTTP client for API communication
- **vscode**: VS Code API access
- **prompts**: Custom module containing system-level instructions

#### 2. **Configuration Management**

##### `getConfig()` Function
```javascript
function getConfig() {
  const cfg = vscode.workspace.getConfiguration('qwen');
  return {
    serviceUrl: cfg.get('serviceUrl') || 'http://127.0.0.1:8755',
    apiMode: cfg.get('apiMode') || 'auto',
    apiKey: cfg.get('apiKey') || '',
    maxTokens: cfg.get('maxTokens') || 1024
  };
}
```

**Differences from extension.js version**:
- More concise variable naming (`cfg` vs `config`)
- Same functionality with slightly different code style
- Consistent default values

#### 3. **Enhanced Model Communication**

##### `callModel()` Function

```javascript
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
```

**Key Improvements over extension.js**:

1. **Flexible Token Configuration**:
   - Accepts `opts` parameter for per-call customization
   - Supports both `max_tokens` and `maxTokens` naming conventions
   - Priority: call options > config settings > hardcoded default

2. **Graceful Fallback**:
   - Tries OpenAI format first in auto mode
   - Automatically falls back to simple format if OpenAI fails
   - Includes try-catch for resilient error handling

3. **URL Normalization**:
   - Uses `replace(/\/$/, '')` to remove trailing slashes
   - Prevents double-slash issues in URL construction

4. **Enhanced Response Handling**:
   - Checks Content-Type header
   - Handles both JSON and plain text responses
   - Wraps text responses in consistent object format

5. **Better Error Messages**:
   - Includes full response text in error messages
   - More descriptive error context for debugging

#### 4. **Response Parsing Utility**

##### `extractTextFromResponse()` Function

```javascript
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
```

**Purpose**: Normalizes different response formats into plain text

**Supported Response Formats**:
1. **OpenAI Chat Format**: `{choices: [{message: {content: "..."}}]}`
2. **OpenAI Completion Format**: `{choices: [{text: "..."}]}`
3. **Simple Text Format**: `{text: "..."}`
4. **Raw String**: Direct string responses
5. **Fallback**: JSON stringification or string conversion

**Why This Is Important**:
- Different Phi3 servers may return responses in different formats
- Provides a single interface for extracting text regardless of server implementation
- Gracefully handles unexpected response structures

#### 5. **Specialized Prompt Builders**

##### Prompt Builder 1: `buildInstructionPromptForGenerate()`

```javascript
function buildInstructionPromptForGenerate(desc, fname) {
  return `You are Qwen, a helpful coding assistant. The user asked: create a file named ${fname}. Follow best practices for the target language based on file name. Provide only the file content, do not include backticks or markdown.\n\nUser request:\n${desc}\n\nIf the language can use package.json or imports, assume the workspace has common tooling. Keep file size reasonable.`;
}
```

**Purpose**: Creates optimized prompts for file generation

**Prompt Engineering Elements**:
1. **Role Definition**: "You are Phi3, a helpful coding assistant"
2. **Context Injection**: Includes the target filename to inform language detection
3. **Format Instructions**: Explicitly requests raw file content (no markdown formatting)
4. **Best Practices Guidance**: Instructs model to follow language conventions
5. **Assumptions**: Tells model to assume standard tooling is available
6. **Size Constraint**: Requests reasonable file sizes

**Why Filename Matters**:
- `.js` → JavaScript conventions
- `.py` → Python standards (PEP 8)
- `.tsx` → React TypeScript patterns
- `.go` → Go formatting and idioms

##### Prompt Builder 2: `buildInstructionPromptForExplain()`

```javascript
function buildInstructionPromptForExplain(selection, task) {
  return `You are Qwen, a debugging assistant for developers. Task: ${task}. Here is the code:\n\n${selection}\n\nExplain what's happening, possible bugs, and provide suggested fixes or tests when appropriate. Provide concise code snippets if needed.`;
}
```

**Purpose**: Creates prompts for code explanation and debugging

**Prompt Engineering Elements**:
1. **Role Specialization**: "debugging assistant for developers"
2. **Task Specification**: Allows customizable explanation tasks
3. **Code Context**: Includes the actual code selection
4. **Multi-faceted Analysis**: Requests explanation, bug detection, and fixes
5. **Actionable Output**: Encourages code snippets and concrete suggestions

**Possible Task Values**:
- "Explain this code"
- "Debug this function"
- "Suggest improvements"
- "Identify security issues"
- "Add error handling"

##### Prompt Builder 3: `buildInstructionPromptForCompletion()`

```javascript
function buildInstructionPromptForCompletion(before, after, lang) {
  return `You are Qwen, an AI code completion assistant. Language: ${lang}. Here is the code before the cursor:\n\n${before}\n\nAnd after the cursor:\n\n${after}\n\nProvide a code completion snippet that fits here. Keep it brief (max 200 tokens). Respond with only the code snippet.`;
}
```

**Purpose**: Creates prompts for inline code completion

**Prompt Engineering Elements**:
1. **Role Definition**: "AI code completion assistant"
2. **Language Context**: Specifies programming language for syntax awareness
3. **Cursor Context**: Provides code before AND after cursor for better suggestions
4. **Length Constraint**: Limits output to 200 tokens for quick completions
5. **Format Instruction**: Requests only code (no explanations)

**Why Before AND After Context?**:
- Better understanding of function signature
- Can infer return types from usage below
- Maintains consistent indentation and style
- Avoids generating code that already exists

**Example Use Case**:
```javascript
// Before cursor:
function calculateTotal(items) {
  let sum = 0;
  [CURSOR]

// After cursor:
  return sum;
}

// Model can infer: need to iterate items and add to sum
```

##### Prompt Builder 4: `buildInstructionPromptForWorkspace()`

```javascript
function buildInstructionPromptForWorkspace(files, task) {
  const list = files.map(f => `- ${f.path}:\n\`\`\`\n${(f.snippet||'').slice(0,1000)}\n\`\`\``).join('\n\n');
  return `You are Qwen, an expert senior engineer reviewing a codebase. Task: ${task}. Here is a snapshot of workspace files (only small snippets):\n\n${list}\n\nProvide a prioritized list of suggested changes, new files, or refactors. For each suggestion include sample code or filenames to add.`;
}
```

**Purpose**: Creates prompts for workspace-level analysis

**Prompt Engineering Elements**:
1. **Expert Role**: "expert senior engineer reviewing a codebase"
2. **Task Flexibility**: Allows different types of workspace analysis
3. **Structured Context**: Formats files with paths and code snippets
4. **Snippet Limitation**: Only includes first 1000 characters per file
5. **Actionable Requests**: Asks for prioritized, concrete suggestions
6. **Implementation Details**: Requests sample code and filenames

**Snippet Processing**:
```javascript
const list = files.map(f => 
  `- ${f.path}:\n\`\`\`\n${(f.snippet||'').slice(0,1000)}\n\`\`\``
).join('\n\n');
```
- Maps each file to formatted markdown
- Includes path for context
- Wraps snippet in code blocks
- Limits each snippet to 1000 characters
- Joins with double newlines for readability

#### 6. **Workspace Analysis Utility**

##### `gatherWorkspaceSnapshot()` Function

```javascript
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
```

**Purpose**: Recursively gathers code snippets from workspace files

**Algorithm**:
1. **Initialization**: Creates empty files array
2. **Recursive Walking**: 
   - Reads directory entries using VS Code's file system API
   - Processes each entry (file or directory)
3. **File Processing**:
   - Reads file contents as bytes
   - Converts to UTF-8 string
   - Takes first 8KB only (memory and token optimization)
   - Stores path and snippet
4. **Error Handling**: Silently skips files that can't be read (permissions, binary files, etc.)
5. **Directory Recursion**: Recursively processes subdirectories

**Key Features**:
- **Asynchronous**: Uses async/await for efficient I/O
- **URI-based**: Works with VS Code's Uri API (supports remote workspaces)
- **Relative Paths**: Constructs relative paths for readability
- **Size Limiting**: 8KB limit prevents token overflow
- **Resilient**: Try-catch prevents single file failures from stopping the scan

**Memory Optimization**:
- 8KB per file is a sweet spot:
  - Enough context for analysis
  - Small enough to avoid token limits
  - Handles most small-to-medium files completely

#### 7. **Module Exports**

```javascript
module.exports = {
  callModel, extractTextFromResponse, buildInstructionPromptForGenerate,
  buildInstructionPromptForExplain, buildInstructionPromptForCompletion,
  gatherWorkspaceSnapshot, buildInstructionPromptForWorkspace
};
```

**Exported Functions**:
- `callModel` - Core API communication
- `extractTextFromResponse` - Response parsing
- `buildInstructionPromptForGenerate` - File generation prompts
- `buildInstructionPromptForExplain` - Explanation/debugging prompts
- `buildInstructionPromptForCompletion` - Code completion prompts
- `gatherWorkspaceSnapshot` - Workspace file gathering
- `buildInstructionPromptForWorkspace` - Workspace analysis prompts

**Usage Pattern**:
Other modules can import specific functions:
```javascript
const { callModel, buildInstructionPromptForGenerate } = require('./client');
```

---

## prompts.js

**Purpose**: Centralized repository for system-level prompts and instructions that define the AI assistant's behavior, personality, and capabilities.

### Detailed Breakdown

#### **System Prompt Definition**

```javascript
exports.systemPrompt = `You are Qwen, a helpful, concise, security-aware coding assistant. When asked, generate code that is correct, follows best practices, and explains changes. If asked to modify or inspect a workspace, suggest small, focused changes, and include filenames and short code snippets. Do not include large unrelated essays. When asked to produce a file, return only the file content with no surrounding markdown. Be conservative with external network actions and warn about risky operations.`;
```

**Prompt Engineering Analysis**:

1. **Identity Setting**:
   - "You are Phi3" - Establishes clear identity
   - Sets expectations for the model's role

2. **Key Attributes**:
   - **Helpful**: Prioritizes user assistance
   - **Concise**: Avoids verbose, unnecessary explanations
   - **Security-aware**: Considers security implications

3. **Code Quality Standards**:
   - "generate code that is correct" - Accuracy is paramount
   - "follows best practices" - Encourages industry standards
   - "explains changes" - Provides educational value

4. **Workspace Modification Guidelines**:
   - "suggest small, focused changes" - Promotes incremental improvements
   - "include filenames and short code snippets" - Actionable, concrete suggestions
   - "Do not include large unrelated essays" - Prevents information overload

5. **Output Format Rules**:
   - "return only the file content with no surrounding markdown" - Clean, copy-paste ready output
   - Prevents the common issue of models wrapping code in ```language``` blocks

6. **Security Consciousness**:
   - "Be conservative with external network actions" - Prevents unsafe API calls or data leaks
   - "warn about risky operations" - Educates users about potential dangers

**Why This Prompt Matters**:

This system prompt is sent with EVERY request to the model, serving as:
- **Behavioral Foundation**: Defines core personality and approach
- **Quality Control**: Sets standards for all generated content
- **Safety Net**: Embeds security awareness in every response
- **Consistency**: Ensures uniform behavior across all features

**Customization Opportunities**:

Teams can modify this prompt to:
- Enforce company coding standards
- Require specific documentation styles
- Add language-specific best practices
- Include security policies
- Set tone and formality level

**Example Customizations**:

For a Python-focused team:
```javascript
exports.systemPrompt = `You are Phi3, a Python expert following PEP 8 and type hinting standards...`;
```

For a security-critical application:
```javascript
exports.systemPrompt = `You are Phi3, a security-first coding assistant. Always include input validation, error handling, and never use eval() or exec()...`;
```

---

## package.json

**Purpose**: The manifest file that defines the VS Code extension's metadata, dependencies, configuration schema, and contribution points.

### Detailed Breakdown

#### 1. **Extension Metadata**

```json
{
  "name": "qwen-local-coder",
  "displayName": "Qwen Local Coder",
  "description": "A lightweight VS Code extension that uses a locally hosted Qwen2 (e.g., at http://127.0.0.1:8755) to generate, explain, and autocomplete code. Configure the service URL in settings.",
  "version": "0.1.0",
  "publisher": "your-name",
}
```

**Fields Explained**:

- **name**: Internal identifier (lowercase, no spaces) - used in command IDs and settings
- **displayName**: Human-readable name shown in VS Code marketplace and extensions panel
- **description**: Brief explanation of what the extension does - appears in search results
- **version**: Semantic versioning (MAJOR.MINOR.PATCH)
  - 0.1.0 indicates early development/beta stage
- **publisher**: Publisher account name (must be registered on VS Code marketplace)

#### 2. **Compatibility Requirements**

```json
"engines": {
  "vscode": "^1.60.0"
},
"categories": [
  "Other"
]
```

**engines.vscode**: Specifies minimum VS Code version
- `^1.60.0`: Compatible with VS Code 1.60.0 and above
- The caret (^) allows minor and patch updates
- Released September 2021 - reasonably modern baseline

**categories**: Marketplace categorization
- "Other" is generic - could be more specific:
  - "Programming Languages" for language support
  - "Machine Learning" for AI features
  - "Snippets" for code generation

#### 3. **Activation Events**

```json
"activationEvents": [
  "onCommand:qwen.generateFile",
  "onCommand:qwen.explainSelection",
  "onCommand:qwen.analyzeWorkspace",
  "onLanguage:javascript",
  "onLanguage:typescript",
  "onLanguage:python",
  "onLanguage:java"
]
```

**Purpose**: Defines when the extension should be loaded (lazy loading optimization)

**Activation Triggers**:

1. **Command-based**:
   - `onCommand:qwen.generateFile` - When user invokes file generation
   - `onCommand:qwen.explainSelection` - When user requests explanation
   - `onCommand:qwen.analyzeWorkspace` - When user analyzes workspace

2. **Language-based**:
   - `onLanguage:javascript` - When opening .js files
   - `onLanguage:typescript` - When opening .ts/.tsx files
   - `onLanguage:python` - When opening .py files
   - `onLanguage:java` - When opening .java files

**Performance Implications**:
- Extension isn't loaded until needed
- Language activation ensures AI features are available when coding
- Reduces VS Code startup time
- Minimizes memory footprint when not in use

**Alternative Activation Strategies**:
- `"*"` - Activate immediately (not recommended - impacts startup)
- `"onStartupFinished"` - Activate after VS Code fully loads
- `"onFileSystem:myscheme"` - Activate for custom file systems

#### 4. **Entry Point**

```json
"main": "./extension.js"
```

**Purpose**: Specifies the JavaScript file that exports `activate()` and `deactivate()` functions

**Why ./extension.js**:
- Relative to package.json location
- Standard Node.js module resolution
- Must export the required lifecycle functions

#### 5. **Configuration Schema**

```json
"contributes": {
  "configuration": {
    "type": "object",
    "title": "Qwen Local Coder",
    "properties": {
      "qwen.serviceUrl": {
        "type": "string",
        "default": "http://127.0.0.1:8755",
        "description": "Base URL for your locally running Qwen2 service (e.g., http://127.0.0.1:8755)."
      },
      "qwen.apiMode": {
        "type": "string",
        "default": "auto",
        "enum": ["auto", "openai", "simple"],
        "description": "API mode. 'openai' if your local service implements OpenAI-compatible chat/completions; 'simple' if it exposes a /generate endpoint; 'auto' will try openai then simple."
      },
      "qwen.apiKey": {
        "type": "string",
        "default": "",
        "description": "Optional API key if your local service requires one."
      },
      "qwen.maxTokens": {
        "type": "number",
        "default": 1024
      }
    }
  }
}
```

**Configuration Deep Dive**:

##### Setting 1: `qwen.serviceUrl`
- **Type**: String
- **Default**: `http://127.0.0.1:8755`
- **Purpose**: Connection endpoint for local Phi3 service
- **User Impact**: Must match the actual port where Phi3 is running
- **Validation**: Should be a valid URL (no built-in validation here)
- **Common Values**:
  - `http://localhost:8755`
  - `http://127.0.0.1:11434` (Ollama default)
  - `http://192.168.1.100:8000` (networked server)

##### Setting 2: `qwen.apiMode`
- **Type**: String (enumerated)
- **Default**: `auto`
- **Options**:
  - `"auto"`: Try OpenAI format, fallback to simple
  - `"openai"`: Force OpenAI-compatible format
  - `"simple"`: Force simple /generate endpoint
- **Purpose**: Adapts to different server implementations
- **User Impact**: Must match server's API format
- **When to use each**:
  - **auto**: Safest default, works with most setups
  - **openai**: For vLLM, FastChat, or OpenAI-compatible servers
  - **simple**: For minimal custom implementations

##### Setting 3: `qwen.apiKey`
- **Type**: String
- **Default**: Empty string (no auth)
- **Purpose**: Authentication token for secured endpoints
- **Security Considerations**:
  - Stored in plain text in settings.json
  - Should not be committed to version control
  - Consider using workspace settings for team projects
- **Format**: Usually `"Bearer sk-..."` or simple token
- **When needed**:
  - Production deployments
  - Shared Phi3 instances
  - Usage tracking/billing

##### Setting 4: `qwen.maxTokens`
- **Type**: Number
- **Default**: 1024
- **Purpose**: Limits model output length
- **Considerations**:
  - Higher values = longer responses, more time/cost
  - Lower values = faster responses, may truncate
- **Recommended values by use case**:
  - **Code completion**: 100-200 tokens
  - **Explanations**: 500-1000 tokens
  - **File generation**: 1024-2048 tokens
- **Cost implications**: More tokens = more compute/API cost

**How Settings Are Accessed**:
```javascript
const config = vscode.workspace.getConfiguration('qwen');
const url = config.get('serviceUrl');
```

**Settings UI**:
- Users can configure via `Ctrl+,` (Settings UI)
- Or directly edit `.vscode/settings.json`
- Supports workspace-specific overrides

#### 6. **Command Contributions**

```json
"commands": [
  {
    "command": "qwen.generateFile",
    "title": "Qwen: Generate File from Description"
  },
  {
    "command": "qwen.explainSelection",
    "title": "Qwen: Explain Selection / Debug"
  },
  {
    "command": "qwen.analyzeWorkspace",
    "title": "Qwen: Analyze Workspace and Suggest Changes"
  }
]
```

**Command Structure**:
- **command**: Unique identifier (used in `registerCommand()`)
- **title**: Display name in Command Palette (Ctrl+Shift+P)

**User Access Methods**:
1. **Command Palette**: Type the title
2. **Keybindings**: Can be bound to shortcuts
3. **Menus**: Can be added to context menus
4. **Buttons**: Can trigger from custom UI elements

**Command Naming Convention**:
- Format: `extensionName.actionName`
- Prevents conflicts with other extensions
- Enables scoped keybinding configuration

**Missing Contributions** (potential additions):
- Context menu items (right-click integration)
- Keybindings (default shortcuts)
- Editor actions (inline buttons)
- View containers (custom panels)

#### 7. **Dependencies**

```json
"dependencies": {
  "node-fetch": "^2.6.7"
}
```

**node-fetch v2.6.7**:
- **Purpose**: HTTP client for making API requests
- **Why not built-in fetch**: VS Code extension host uses older Node.js versions without native fetch
- **Version choice**: v2.x for CommonJS compatibility (v3.x is ESM-only)
- **Alternative**: Could use `axios`, `got`, or `request-light` (VS Code's internal HTTP client)

**Installation**:
- Installed via `npm install` in extension directory
- Bundled with extension when packaged
- No runtime dependencies (included in .vsix)

**Security Considerations**:
- Regularly update for security patches
- Check for vulnerabilities: `npm audit`
- Version pinning prevents unexpected breaking changes

---

## README.md

**Purpose**: Primary documentation file that explains the extension's purpose, features, setup, and usage for end users and developers.

### Detailed Breakdown

#### 1. **Project Overview**

```markdown
# Qwen Local Coder - VS Code Extension (scaffold)

What this is
------------
A lightweight VS Code extension that uses a locally hosted Qwen2 model 
(for example at `http://127.0.0.1:8755`) to provide:
- Generate a new file from a short description.
- Explain or debug selected code and open the assistant's reply in a new editor.
- Analyze workspace snippets and suggest improvements.
- Simple completion provider that asks the local model for suggestions.
```

**Key Messaging**:
- **Lightweight**: Emphasizes minimal overhead
- **Locally hosted**: Privacy-focused, no cloud dependency
- **Feature highlights**: Bullet-point format for quick scanning

**Target Audience**:
- Developers who want AI assistance without cloud services
- Privacy-conscious users
- Users with custom Phi3 deployments

#### 2. **Training Disclaimer**

```markdown
Important: this repository **does not** perform any model training. 
Instead it provides prompt templates (in `prompts.js`) and a system-level 
instruction you can use as the "system" message when calling your local model. 
If you want to fine-tune or train the model, follow your Qwen2 tooling — 
this extension shows how to craft prompts and integrate the model into VS Code.
```

**Why This Matters**:
- **Clarifies Scope**: Not a training framework
- **Sets Expectations**: It's an integration layer, not ML infrastructure
- **Guides Users**: Points to appropriate resources for training
- **Emphasizes Value**: Focus is on prompt engineering and VS Code integration

#### 3. **Configuration Instructions**

```markdown
Configuration
-------------
Open VS Code settings (Workspace or User) and set:
- `qwen.serviceUrl` — your local service base URL (default: `http://127.0.0.1:8755`)
- `qwen.apiMode` — `auto`, `openai`, or `simple`. Use `openai` if your local service supports OpenAI-compatible `/v1/chat/completions`. Use `simple` if it exposes a `/generate` endpoint that accepts `{prompt,max_tokens}`.
- `qwen.apiKey` — optional.
```

**User-Friendly Approach**:
- **Access method**: "Open VS Code settings"
- **Setting names**: Clearly listed with namespace
- **Defaults provided**: Users know baseline values
- **Context**: Explains when to use each option

**Improvement Opportunities**:
- Add screenshot of settings UI
- Include example settings.json snippet
- Provide troubleshooting tips

#### 4. **Installation Guide**

```markdown
How to install
--------------
1. Extract the zip into a folder.
2. In that folder run `npm install`.
3. Open the folder in VS Code (Run -> Start Debugging) to launch the extension host with the extension loaded.
4. Or to install locally, run `vsce package` (install `vsce`) and then install the generated .vsix.
```

**Installation Paths**:

##### **Path 1: Development Mode** (Steps 1-3)
- Extract → npm install → F5 debugging
- Best for: Extension developers, testing, customization
- Advantage: Live reload, debugging tools

##### **Path 2: Production Install** (Step 4)
- vsce package → Install .vsix
- Best for: End users, stable deployment
- Creates standalone .vsix file

**Missing Information**:
- How to install vsce: `npm install -g @vscode/vsce`
- How to install .vsix: Extensions panel → ⋯ menu → Install from VSIX
- Marketplace publication steps

#### 5. **Training/Configuration Guidance**

```markdown
Notes on "training" / configuring the LLM to help write & debug code
------------------------------------------------
- The `prompts.js` file contains a `systemPrompt` string that instructs the model to behave as a coding assistant. You can replace or extend this with more detailed guidance (style rules, preferred testing frameworks, company coding standards).
- For persistent behavior without fine-tuning, configure your model server to prepend the `systemPrompt` as the system message for chat/completions calls.
- If you want to actually fine-tune the model weights, prepare a dataset of instruction-response pairs (e.g., developer requests -> ideal code + explanation) and use your local Qwen training tools. This extension assumes you will continue to run the local Qwen service and does not attempt to manage training.
```

**Educational Value**:

1. **Prompt Engineering Path**:
   - Modify `systemPrompt` for behavior changes
   - No training required
   - Fast iteration
   - Reversible changes

2. **Server Configuration Path**:
   - Configure Phi3 server to use system prompt
   - Consistent behavior across clients
   - Centralized management

3. **Fine-Tuning Path**:
   - Create instruction-response dataset
   - Use external training tools
   - Permanent model changes
   - Requires ML expertise

**Best Practice Recommendations**:
- Start with prompt engineering
- Test extensively before fine-tuning
- Fine-tune only for persistent, high-value improvements

#### 6. **Security & Privacy**

```markdown
Security & privacy
------------------
- The extension reads small snippets (up to 8KB) from files when analyzing the workspace. Do not run it on proprietary code you cannot share with the model provider.
- If your local Qwen service is exposed to a network, protect it with proper access controls / API keys.
```

**Important Disclosures**:

1. **Data Collection**:
   - Reads up to 8KB per file
   - Sends to configured endpoint
   - No telemetry to external services

2. **Privacy Considerations**:
   - "Do not run it on proprietary code" - clear warning
   - Assumes local model = local data (not always true)

3. **Network Security**:
   - Warns about exposed services
   - Recommends API keys and access controls

**Missing Warnings**:
- Model training data retention policies
- Clipboard/paste security
- Secure storage of API keys
- HTTPS vs HTTP recommendations

#### 7. **Limitations & Roadmap**

```markdown
Limitations & next steps
------------------------
- This scaffold is intentionally simple: no language server, no remote sync, no streaming responses.
- You can extend it to add:
  - A dedicated language server for lower-latency completions.
  - Token streaming support for interactive completions.
  - Authentication and rate-limiting.
  - More sophisticated workspace indexing.
```

**Honest Assessment**:
- "intentionally simple" - manages expectations
- Lists missing features upfront
- Encourages contributions

**Extension Ideas**:
1. **Language Server**: Real-time, low-latency completions
2. **Streaming**: Progressive response rendering
3. **Auth/Rate-limiting**: Production-ready security
4. **Workspace Indexing**: Semantic code search

---

## CHANGELOG.md

**Purpose**: Tracks version history and changes over time.

### Content

```markdown
# 0.1.0
- Initial scaffold
```

**Current State**: Minimal, tracks only the initial version

**Best Practices for Future Updates**:

```markdown
# 0.2.0 (2024-11-15)
### Added
- Streaming response support
- Context menu integration

### Changed
- Improved error messages
- Updated dependencies

### Fixed
- Memory leak in workspace analysis
- Token limit handling

### Removed
- Deprecated simple API mode
```

**Semantic Versioning**:
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

---

## LICENSE

**Purpose**: Defines legal terms for using, modifying, and distributing the code.

### Content

```plaintext
MIT
```

**MIT License Implications**:
- **Permissive**: Very few restrictions
- **Commercial use**: Allowed
- **Modification**: Allowed
- **Distribution**: Allowed
- **Private use**: Allowed
- **Liability**: No warranty
- **Attribution**: Required

**Full License** (should be added):
```
MIT License

Copyright (c) [year] [fullname]

Permission is hereby granted, free of charge, to any person obtaining a copy...
```

---

## README_QUICKSTART.txt

**Purpose**: Minimal quick-start instructions for developers.

### Content

```plaintext
Open the folder in VS Code. Run `npm install`. Then press F5 to run the extension in a new Extension Host window.
```

**Target Audience**: Developers familiar with VS Code extension development

**Three Simple Steps**:
1. Open folder in VS Code
2. Run `npm install` (installs dependencies)
3. Press F5 (launches debug mode)

**Result**: Extension loads in new VS Code window for testing

**When to Use**:
- Quick testing
- Development workflow
- Debugging extension code

**Extension Host Window**:
- Separate VS Code instance
- Isolated from main installation
- Console output for debugging
- Hot reload support

---

## Summary

This comprehensive file documentation covers every aspect of each file in the Phi3 Local Coder extension:

- **extension.js**: Core extension logic, commands, and lifecycle
- **client.js**: Advanced API client with prompt engineering
- **prompts.js**: System-level behavior instructions
- **package.json**: Extension manifest and configuration
- **README.md**: User documentation and setup guide
- **CHANGELOG.md**: Version history tracking
- **LICENSE**: Legal terms (MIT)
- **README_QUICKSTART.txt**: Developer quick-start

Each file serves a specific purpose in creating a functional, maintainable, and user-friendly VS Code extension that integrates local Phi3 models for AI-assisted coding.
