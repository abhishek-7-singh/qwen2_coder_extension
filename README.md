# Phi3 Local Coder – VS Code Extension
## Author: Abhishek Singh | Vellore Institute of Technology
Phi3 Local Coder is a privacy-first Visual Studio Code extension that connects your editor to a locally hosted Phi3 language model. It gives you Copilot-style assistance without sending source code to external services.

## Key Features
- **File generation** – describe the file you need and Phi3 writes it for you.
- **Inline explanations** – select code and receive debugging tips, bug hunts, or refactoring advice in seconds.
- **Workspace analysis** – scan the project tree and get prioritized improvement ideas.
- **Flexible API support** – works with OpenAI-compatible `/v1/chat/completions` endpoints or simple `/generate` endpoints.

> ℹ️ The extension integrates with an already running Phi3 service. It does not fine-tune or host models for you.

## Quick Start

### Prerequisites
- Node.js 16+
- VS Code 1.60 or newer
- A locally reachable Phi3 endpoint (for example `http://127.0.0.1:8755`)

### Installation (Development)
1. Clone or download this repository.
2. Run `npm install` inside the project folder.
3. Press `F5` in VS Code to launch a new Extension Development Host.
4. Use the command palette (`Ctrl+Shift+P`) to run the Phi3 commands.

### Installation (Local .vsix)
1. Install `vsce` if you do not have it yet: `npm install -g @vscode/vsce`.
2. Execute `vsce package` to generate a `.vsix` bundle.
3. In VS Code open the Extensions view → `…` menu → **Install from VSIX…** and select the generated file.

## Configuration

All settings live under the `qwen` namespace (legacy naming retained for compatibility).

| Setting | Default | Purpose |
|---------|---------|---------|
| `qwen.serviceUrl` | `http://127.0.0.1:8755` | Base URL of your Phi3 HTTP service. |
| `qwen.apiMode` | `auto` | `auto` tries OpenAI format first, then falls back to `/generate`. Use `openai` or `simple` to force a specific protocol. |
| `qwen.apiKey` | `""` | Optional bearer token if your Phi3 endpoint requires authentication. |
| `qwen.maxTokens` | `1024` | Upper bound on generated tokens for each request. |

Update these through **Settings → Extensions → Phi3 Local Coder** or by editing `.vscode/settings.json`.

## Commands

| Command Palette Name | Description |
|----------------------|-------------|
| `Phi3: Generate File from Description` | Prompts for a natural-language description, calls Phi3, and lets you save the generated file. |
| `Phi3: Explain Selection / Debug` | Sends the current selection to Phi3 and opens a rendered explanation in a new tab. |
| `Phi3: Analyze Workspace and Suggest Changes` | Builds a lightweight tree of the workspace and asks Phi3 for architectural suggestions. |

All commands live under the `qwen.*` identifier family for backward compatibility with earlier builds.

## How It Works
1. The extension gathers context (description, selection, or workspace tree).
2. It builds a Phi3-friendly prompt using the templates in `client.js` and `prompts.js`.
3. Requests are sent via `node-fetch` to your configured endpoint.
4. Responses are normalized and displayed in VS Code.

See `DOCUMENTATION_PROJECT.md` for a deep architectural walkthrough and `DOCUMENTATION_FILES.md` for per-file commentary.

## Security & Privacy
- Code snippets (up to 8 KB per file) are only sent to the Phi3 endpoint you configure. Keep the service local or ensure TLS and access control when remote.
- Store API keys in workspace settings only for trusted projects; consider environment variables or VS Code Secret Storage for extra protection.
- Generated code is not automatically executed—review it before running.

## Limitations
- No streaming responses yet (requests resolve once the model finishes).
- No language server integration; completions are on-demand.
- Relies on the `qwen.*` configuration prefix until the next major release.

## Roadmap Ideas
1. Streaming token support for faster feedback.
2. Inline completions powered by Phi3.
3. Secure secret storage for API keys.
4. Richer workspace indexing and dependency analysis.

## Contributing
Pull requests and issues are welcome. Please open a discussion before large changes. Run `npm install` and use the extension host (`F5`) for development.

## License

Released under the MIT License. See `LICENSE` for details.

---

Questions or ideas? Open an issue—feedback helps steer the next features.
