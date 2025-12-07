<!-- @mid:p-9y7h6z -->
Here is a comprehensive Implementation Roadmap for **Midlight**.

<!-- @mid:p-2g3hpv -->
This roadmap is designed to move from a "Hello World" Electron app to a production-ready MVP that fulfills the specific promises of the PRD: a local-first, AI-native editor with "Cursor-like" capabilities.

---

<!-- @mid:h-qrvsbf -->
# Midlight: Implementation Roadmap

<!-- @mid:h-vzrru4 -->
## 0. Technical Architecture & Stack Selection

<!-- @mid:p-jvja2x -->
Before writing code, the foundation must be established to support high performance, local-first data, and rich text manipulation.

<!-- @mid:list-nzmvr5 -->
- **Core Framework:** **Electron** (Mature, rich ecosystem for local FS access) + **React** (UI) + **TypeScript**.
- **Editor Engine:** **Tiptap (based on Prosemirror)**.
- *Why:* Headless, block-based, highly customizable, excellent community support for AI integrations.
- **State Management:** **Zustand** (Lightweight) + **TanStack Query** (Async state).
- **Local Data/Search:** **Node.js** `fs` (Direct file access) + **Orama** or **FlexSearch** (In-memory full-text search for `@` mentions).
- **Styling:** **Tailwind CSS** + **Radix UI** (Accessible primitives) + **CSS Variables** (For the requested robust theming).
- **AI Orchestration:** **Vercel AI SDK** (Stream handling) + **LangChain** (Context window management).

---

<!-- @mid:h-h8aidd -->
## Phase 1: The Foundation (Local-First Editor)

<!-- @mid:p-n4e37y -->
**Goal:** A functional markdown-based writing app with a file system sidebar and a beautiful block-based editor. No AI yet.

<!-- @mid:h-dh980h -->
### 1.1 Project Skeleton & Window Management

<!-- @mid:list-xrrsjc -->
- \[ \] Initialize Electron + Vite + React + TypeScript repo.
- \[ \] Configure IPC (Inter-Process Communication) bridges for secure file system access.
- \[ \] Implement custom title bar (MacOS/Windows style) to control the "Clean/Simple" aesthetic.
- \[ \] **System Tray/Menu:** Basic Native menus (File, Edit, View).

<!-- @mid:h-i6f57z -->
### 1.2 File System Manager (The Sidebar)

<!-- @mid:list-v4ujid -->
- \[ \] **Directory Reading:** Implement recursive reading of a user-selected local folder.
- \[ \] **File Tree UI:** Render the folder structure with collapsible nodes.
- \[ \] **File Operations:**
- \[ \] Create File/Folder.
- \[ \] Delete (Move to Trash).
- \[ \] Rename.
- \[ \] Drag-and-drop (Move files between folders).
- \[ \] **File Watcher:** Integrate `chokidar` to listen for external file changes and update UI instantly.

<!-- @mid:h-4g7gty -->
### 1.3 The Block Editor (Tiptap Implementation)

<!-- @mid:list-0oz022 -->
- \[ \] **Base Configuration:** Set up Tiptap with Markdown serialization (loading `.md` files into the editor and saving them back as clean Markdown).
- \[ \] **Block Nodes:** Implement custom components for:
- \[ \] Heading 1-3, Paragraph, Blockquote.
- \[ \] Bullet/Numbered Lists.
- \[ \] Code Blocks.
- \[ \] Images (Local path handling).
- \[ \] **Slash Command Menu:** Type `/` to open a menu to insert blocks (mimic Notion).
- \[ \] **Persistence:** Debounced saving to the local file system (auto-save).

<!-- @mid:h-a8icq5 -->
### 1.4 Theming Engine

<!-- @mid:list-dvy60y -->
- \[x\] Create a Theme Provider using CSS variables.
- \[x\] Implement Dark/Light mode toggle.
- \[ \] **Robust Theme System:** Implement multiple theme choices (e.g., Light, Dark, Midnight, Sepia) with a dedicated Theme Picker UI.
- \[ \] Create a "User Config" file (`.midlight/config.json`) to persist theme preferences.

---

<!-- @mid:h-l912ta -->
## Phase 2: The AI Core (The "Cursor" Translation)

<!-- @mid:p-6289d6 -->
**Goal:** Integrate the LLM deep into the editor. This moves the app from "Obsidian clone" to "Midlight."

<!-- @mid:h-0x965l -->
### 2.1 AI Infrastructure

<!-- @mid:list-nl9ip9 -->
- \[ \] **API Handler:** Set up secure API calls to OpenAI/Anthropic.
- \[ \] **Token Management:** Implement basic token counting to manage context windows.
- \[ \] **Settings UI:** Allow users to input API keys (for testing) or authenticate via the Midlight backend (for production/subscriptions).

<!-- @mid:h-uzso37 -->
### 2.2 The "Context Engine" (Indexing)

<!-- @mid:list-018aal -->
- \[ \] **Indexer:** On app startup, scan the user's vault and create a lightweight text index (using Orama/FlexSearch).
- \[ \] **Embeddings (Optional for MVP, Recommended):** Use `Transformers.js` (ONNX) to run local embeddings in the background for semantic search, ensuring data stays private.

<!-- @mid:h-s4ue4a -->
### 2.3 Inline AI Editing (Cmd+K)

<!-- @mid:list-1j2x2d -->
- \[ \] **UI Overlay:** Create a floating input box appearing near the cursor when `Cmd+K` is pressed.
- \[ \] **Selection Handling:** Capture currently selected text (or current block) as context.
- \[ \] **Streaming Response:** Stream LLM output directly into the editor.
- \[ \] **The "Diff" View:**
- *Critical Feature:* Do not just overwrite text.
- Implement a "provisional" state where deletions are red/strikethrough and additions are green.
- Add "Accept" (Enter) and "Reject" (Esc) controls.

<!-- @mid:h-q25o10 -->
### 2.4 The Chat Pane & `.chat` Files

<!-- @mid:list-q9z561 -->
- \[ \] **Dedicated Pane:** A collateral sidebar (right side) for chat.
- \[ \] **File Type:** Implement `.chat` file format (JSON structure holding messages).
- \[ \] **Persistence:** Chat history saved to disk.
- \[ \] **Context Awareness:**
- \[ \] System Prompt injection: "You are viewing the file \[Filename\]. Content: \[File Content\]."
- \[ \] Live updates: If the user types in the doc, the AI context updates.

<!-- @mid:h-xtb9kk -->
### 2.5 Context Mentions (@-System)

<!-- @mid:list-t4t56g -->
- \[ \] **Trigger:** Typing `@` in Chat or Cmd+K triggers a file search dropdown.
- \[ \] **Resolution:** When a user selects a file, read that file's content and inject it into the LLM prompt context window.

---

<!-- @mid:h-r6njbo -->
## Phase 3: AI Agents & Advanced File Ops

<!-- @mid:p-6jkxky -->
**Goal:** Allow the AI to control the application, not just generate text.

<!-- @mid:h-uwarip -->
### 3.1 Function Calling (Tools)

<!-- @mid:list-fembtn -->
- \[ \] Define LLM Tools:
- \[ \] `create_file(path, content)`
- \[ \] `edit_file(path, instructions)`
- \[ \] `read_file(path)`
- \[ \] `list_files(folder_path)`

<!-- @mid:h-00nlwf -->
### 3.2 Agent Implementation

<!-- @mid:list-lqy2uj -->
- \[ \] **Prompt Engineering:** specific system prompts instructing the AI on how to use the File System tools.
- \[ \] **UI Feedback:** Show "Thinking..." states when the AI is performing file operations.
- \[ \] **Safety Checks:** "AI wants to create a file named 'Essay.md'. Allow?" (Prevent rogue overwrites).

---

<!-- @mid:h-rooryl -->
## Phase 4: Cloud & Monetization (The Business Model)

<!-- @mid:p-jwqg8j -->
**Goal:** Implement the Free/Premium tiers and Sync.

<!-- @mid:h-pi7udr -->
### 4.1 Authentication & Backend

<!-- @mid:list-24rf1q -->
- \[ \] **Auth:** Integrate Supabase or Firebase Auth.
- \[ \] **User Profile:** Track usage (token counts) for the free tier limits.

<!-- @mid:h-8fduyu -->
### 4.2 E2EE Cloud Sync (Premium)

<!-- @mid:list-x8z3md -->
- \[ \] **Encryption Engine:** Implement `Libsodium` or `WebCrypto` API.
- \[ \] Generate a local master key (never sent to server).
- \[ \] Encrypt files before upload.
- \[ \] **Sync Logic:**
- \[ \] Compare local file modification time vs. server.
- \[ \] Conflict resolution strategy (e.g., "Keep both" or "Last write wins").
- \[ \] **Paywall UI:** Lock the Sync feature behind a check for active subscription status.

<!-- @mid:h-8xh1vz -->
### 4.3 Subscription Integration

<!-- @mid:list-6g6adh -->
- \[ \] Integrate **Stripe** checkout.
- \[ \] Implement a "Upgrade to Pro" modal explaining features (Models, Sync, Unlimited usage).
- \[ \] Add Model Selector for Pro users (Dropdown to switch between GPT-4o / Claude 3.5 Sonnet).

---

<!-- @mid:h-mdyjlr -->
## Phase 5: Polish & Pre-Launch

<!-- @mid:p-hen3xq -->
**Goal:** Ensure the app feels professional, fast, and accessible.

<!-- @mid:h-hl1l9b -->
### 5.1 Accessibility (a11y)

<!-- @mid:list-ho525s -->
- \[ \] Ensure full keyboard navigation (Tab indexing).
- \[ \] Screen reader testing (Aria labels on all icon buttons).
- \[ \] Contrast check for themes.

<!-- @mid:h-efq6do -->
### 5.2 Performance Tuning

<!-- @mid:list-mjqrp0 -->
- \[ \] **Virtualization:** If a folder has 1,000 files, use list virtualization in the sidebar.
- \[ \] **Lazy Loading:** Lazy load Editor components.
- \[ \] **Startup Time:** Minimize main process overhead.

<!-- @mid:h-j1ppz9 -->
### 5.3 Distribution

<!-- @mid:list-6ddlp2 -->
- \[ \] **Auto-Updater:** Configure `electron-updater`.
- \[ \] **Code Signing:** Apple Developer ID / Windows Cert signing.
- \[ \] **Installers:** Build `.dmg`, `.exe`, `.AppImage` using `electron-builder`.

---

<!-- @mid:h-mtem2u -->
## MVP Scope Checklist (What is IN vs. OUT)

<!-- @mid:h-pp5lyz -->
### IN (Must Have)

<!-- @mid:list-39kq9l -->
- \[x\] Local File System (Read/Write).
- \[x\] Markdown Editor (WYSIWYG).
- \[x\] Dark/Light Theme.
- \[x\] Inline AI (Cmd+K) with Diff view.
- \[x\] Chat Pane with `@` file referencing.
- \[x\] AI ability to create new files.
- \[x\] Free Tier limits logic.

<!-- @mid:h-9mtg4r -->
### OUT (Post-MVP/Future)

<!-- @mid:list-lf6ken -->
- \[ \] Boards/Canvas mode (Explicitly deferred).
- \[ \] Mobile App.
- \[ \] Real-time collaboration (Multiplayer).
- \[ \] Plugin system.
- \[ \] PDF Parsing (Premium feature, deferred to v1.1).

---

<!-- @mid:h-6gj1z0 -->
## Risk Assessment

<!-- @mid:p-4sx5vr -->
RiskMitigation Strategy**LLM Hallucination**High reliance on "Context Awareness." Ensure the prompt includes the *exact* file content, not a summary, whenever possible.**Token Costs**Strict limits on Free tier. Use caching for context that hasn't changed. Use cheaper models (GPT-4o-mini) for simple tasks.**Sync Conflicts**For MVP, lean on "Last Write Wins" or create conflict files (`File (Conflict).md`) rather than complex merging logic.**Privacy Trust**Open source the encryption module or undergo a security audit. Ensure the "Local Only" mode never makes network requests (except for AI).