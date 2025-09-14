# Qwen Local Coder - VS Code Extension (scaffold)

What this is
------------
A lightweight VS Code extension that uses a locally hosted Qwen2 model (for example at `http://127.0.0.1:8755`) to provide:
- Generate a new file from a short description.
- Explain or debug selected code and open the assistant's reply in a new editor.
- Analyze workspace snippets and suggest improvements.
- Simple completion provider that asks the local model for suggestions.

Important: this repository **does not** perform any model training. Instead it provides prompt templates (in `prompts.js`) and a system-level instruction you can use as the "system" message when calling your local model. If you want to fine-tune or train the model, follow your Qwen2 tooling — this extension shows how to craft prompts and integrate the model into VS Code.

Configuration
-------------
Open VS Code settings (Workspace or User) and set:
- `qwen.serviceUrl` — your local service base URL (default: `http://127.0.0.1:8755`)
- `qwen.apiMode` — `auto`, `openai`, or `simple`. Use `openai` if your local service supports OpenAI-compatible `/v1/chat/completions`. Use `simple` if it exposes a `/generate` endpoint that accepts `{prompt,max_tokens}`.
- `qwen.apiKey` — optional.

How to install
--------------
1. Extract the zip into a folder.
2. In that folder run `npm install`.
3. Open the folder in VS Code (Run -> Start Debugging) to launch the extension host with the extension loaded.
4. Or to install locally, run `vsce package` (install `vsce`) and then install the generated .vsix.

Notes on "training" / configuring the LLM to help write & debug code
------------------------------------------------
- The `prompts.js` file contains a `systemPrompt` string that instructs the model to behave as a coding assistant. You can replace or extend this with more detailed guidance (style rules, preferred testing frameworks, company coding standards).
- For persistent behavior without fine-tuning, configure your model server to prepend the `systemPrompt` as the system message for chat/completions calls.
- If you want to actually fine-tune the model weights, prepare a dataset of instruction-response pairs (e.g., developer requests -> ideal code + explanation) and use your local Qwen training tools. This extension assumes you will continue to run the local Qwen service and does not attempt to manage training.

Security & privacy
------------------
- The extension reads small snippets (up to 8KB) from files when analyzing the workspace. Do not run it on proprietary code you cannot share with the model provider.
- If your local Qwen service is exposed to a network, protect it with proper access controls / API keys.

Limitations & next steps
------------------------
- This scaffold is intentionally simple: no language server, no remote sync, no streaming responses.
- You can extend it to add:
  - A dedicated language server for lower-latency completions.
  - Token streaming support for interactive completions.
  - Authentication and rate-limiting.
  - More sophisticated workspace indexing.

Enjoy — and tell me what features you want next!
