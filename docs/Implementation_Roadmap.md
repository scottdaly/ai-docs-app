<!-- @mid:p-5ckpk3 -->
**Here is a comprehensive Implementation Roadmap for ****Midlight****.**

<!-- @mid:p-dcw6l4 -->
This roadmap is designed to move from a "Hello World" Electron app to a production-ready MVP that fulfills the specific promises of the PRD: a local-first, AI-native editor with "Cursor-like" capabilities.

---

<!-- @mid:h-xoby7v -->
# Midlight: Implementation Roadmap

<!-- @mid:h-bgvevr -->
## 0. Technical Architecture & Stack Selection

<!-- @mid:p-0gvkf1 -->
Before writing code, the foundation must be established to support high performance, local-first data, and rich text manipulation.

<!-- @mid:list-m4jaa4 -->
- **Core Framework:** **Electron** (Mature, rich ecosystem for local FS access) + **React** (UI) + **TypeScript**.
- **Editor Engine:** **Tiptap (based on Prosemirror)**.
- *Why:* Headless, block-based, highly customizable, excellent community support for AI integrations.
- **State Management:** **Zustand** (Lightweight) + **TanStack Query** (Async state).
- **Local Data/Search:** **Node.js** `fs` (Direct file access) + **Orama** or **FlexSearch** (In-memory full-text search for `@` mentions).
- **Styling:** **Tailwind CSS** + **Radix UI** (Accessible primitives) + **CSS Variables** (For the requested robust theming).
- **AI Orchestration:** **Vercel AI SDK** (Stream handling) + **LangChain** (Context window management).

---

<!-- @mid:h-davrqv -->
## Phase 1: The Foundation (Local-First Editor)

<!-- @mid:p-ogjrly -->
**Goal:**** A functional markdown-based writing app with a file system sidebar and a beautiful block-based editor. No AI yet.**

<!-- @mid:h-vg4o3n -->
### 1.1 Project Skeleton & Window Management

<!-- @mid:list-0k7m8d -->
- \[ \] Initialize Electron + Vite + React + TypeScript repo.
- \[ \] Configure IPC (Inter-Process Communication) bridges for secure file system access.
- \[ \] Implement custom title bar (MacOS/Windows style) to control the "Clean/Simple" aesthetic.
- \[ \] **System Tray/Menu:** Basic Native menus (File, Edit, View).

<!-- @mid:h-8vwrzz -->
### 1.2 File System Manager (The Sidebar)

<!-- @mid:list-191por -->
- \[ \] **Directory Reading:** Implement recursive reading of a user-selected local folder.
- \[ \] **File Tree UI:** Render the folder structure with collapsible nodes.
- \[ \] **File Operations:**
- \[ \] Create File/Folder.
- \[ \] Delete (Move to Trash).
- \[ \] Rename.
- \[ \] Drag-and-drop (Move files between folders).
- \[ \] **File Watcher:** Integrate `chokidar` to listen for external file changes and update UI instantly.

<!-- @mid:h-kmbde5 -->
### 1.3 The Block Editor (Tiptap Implementation)

<!-- @mid:list-n65aqu -->
- \[ \] **Base Configuration:** Set up Tiptap with Markdown serialization (loading `.md` files into the editor and saving them back as clean Markdown).
- \[ \] **Block Nodes:** Implement custom components for:
- \[ \] Heading 1-3, Paragraph, Blockquote.
- \[ \] Bullet/Numbered Lists.
- \[ \] Code Blocks.
- \[ \] Images (Local path handling).
- \[ \] **Slash Command Menu:** Type `/` to open a menu to insert blocks (mimic Notion).
- \[ \] **Persistence:** Debounced saving to the local file system (auto-save).

<!-- @mid:h-78gtxq -->
### 1.4 Theming Engine

<!-- @mid:list-nljmn4 -->
- \[x\] Create a Theme Provider using CSS variables.
- \[x\] Implement Dark/Light mode toggle.
- \[ \] **Robust Theme System:** Implement multiple theme choices (e.g., Light, Dark, Midnight, Sepia) with a dedicated Theme Picker UI.
- \[ \] Create a "User Config" file (`.midlight/config.json`) to persist theme preferences.

---

<!-- @mid:h-96nqau -->
## Phase 2: The AI Core (The "Cursor" Translation)

<!-- @mid:p-u1b1m7 -->
**Goal:**** Integrate the LLM deep into the editor. This moves the app from "Obsidian clone" to "Midlight."**

<!-- @mid:h-6xkwy5 -->
### 2.1 AI Infrastructure

<!-- @mid:list-bcvrm6 -->
- \[ \] **API Handler:** Set up secure API calls to OpenAI/Anthropic.
- \[ \] **Token Management:** Implement basic token counting to manage context windows.
- \[ \] **Settings UI:** Allow users to input API keys (for testing) or authenticate via the Midlight backend (for production/subscriptions).

<!-- @mid:h-8mzrns -->
### 2.2 The "Context Engine" (Indexing)

<!-- @mid:list-0g6wcr -->
- \[ \] **Indexer:** On app startup, scan the user's vault and create a lightweight text index (using Orama/FlexSearch).
- \[ \] **Embeddings (Optional for MVP, Recommended):** Use `Transformers.js` (ONNX) to run local embeddings in the background for semantic search, ensuring data stays private.

<!-- @mid:h-gtdc57 -->
### 2.3 Inline AI Editing (Cmd+K)

<!-- @mid:list-gx1dux -->
- \[ \] **UI Overlay:** Create a floating input box appearing near the cursor when `Cmd+K` is pressed.
- \[ \] **Selection Handling:** Capture currently selected text (or current block) as context.
- \[ \] **Streaming Response:** Stream LLM output directly into the editor.
- \[ \] **The "Diff" View:**
- *Critical Feature:* Do not just overwrite text.
- Implement a "provisional" state where deletions are red/strikethrough and additions are green.
- Add "Accept" (Enter) and "Reject" (Esc) controls.

<!-- @mid:h-i605hk -->
### `2.4 The Chat Pane & ``.chat`` Files`

<!-- @mid:list-bbr1cq -->
- \[ \] **Dedicated Pane:** A collateral sidebar (right side) for chat.
- \[ \] **File Type:** Implement `.chat` file format (JSON structure holding messages).
- \[ \] **Persistence:** Chat history saved to disk.
- \[ \] **Context Awareness:**
- \[ \] System Prompt injection: "You are viewing the file \[Filename\]. Content: \[File Content\]."
- \[ \] Live updates: If the user types in the doc, the AI context updates.

<!-- @mid:h-3zyzt4 -->
### 2.5 Context Mentions (@-System)

<!-- @mid:list-hg8zkg -->
- \[ \] **Trigger:** Typing `@` in Chat or Cmd+K triggers a file search dropdown.
- \[ \] **Resolution:** When a user selects a file, read that file's content and inject it into the LLM prompt context window.

---

<!-- @mid:h-2ee363 -->
## Phase 3: AI Agents & Advanced File Ops

<!-- @mid:p-vqfku3 -->
**Goal:**** Allow the AI to control the application, not just generate text.**

<!-- @mid:h-5wor28 -->
### 3.1 Function Calling (Tools)

<!-- @mid:list-7ldb6v -->
- \[ \] Define LLM Tools:
- \[ \] `create_file(path, content)`
- \[ \] `edit_file(path, instructions)`
- \[ \] `read_file(path)`
- \[ \] `list_files(folder_path)`

<!-- @mid:h-g1mb0b -->
### 3.2 Agent Implementation

<!-- @mid:list-x99zff -->
- \[ \] **Prompt Engineering:** specific system prompts instructing the AI on how to use the File System tools.
- \[ \] **UI Feedback:** Show "Thinking..." states when the AI is performing file operations.
- \[ \] **Safety Checks:** "AI wants to create a file named 'Essay.md'. Allow?" (Prevent rogue overwrites).

---

<!-- @mid:h-vwjhcp -->
## Phase 4: Cloud & Monetization (The Business Model)

<!-- @mid:p-e1q98y -->
**Goal:**** Implement the Free/Premium tiers and Sync.**

<!-- @mid:h-gexrrx -->
### 4.1 Authentication & Backend

<!-- @mid:list-oedqp9 -->
- \[ \] **Auth:** Integrate Supabase or Firebase Auth.
- \[ \] **User Profile:** Track usage (token counts) for the free tier limits.

<!-- @mid:h-d5hj7o -->
### 4.2 E2EE Cloud Sync (Premium)

<!-- @mid:list-4kzlqc -->
- \[ \] **Encryption Engine:** Implement `Libsodium` or `WebCrypto` API.
- \[ \] Generate a local master key (never sent to server).
- \[ \] Encrypt files before upload.
- \[ \] **Sync Logic:**
- \[ \] Compare local file modification time vs. server.
- \[ \] Conflict resolution strategy (e.g., "Keep both" or "Last write wins").
- \[ \] **Paywall UI:** Lock the Sync feature behind a check for active subscription status.

<!-- @mid:h-bt22jz -->
### 4.3 Subscription Integration

<!-- @mid:list-ton971 -->
- \[ \] Integrate **Stripe** checkout.
- \[ \] Implement a "Upgrade to Pro" modal explaining features (Models, Sync, Unlimited usage).
- \[ \] Add Model Selector for Pro users (Dropdown to switch between GPT-4o / Claude 3.5 Sonnet).

---

<!-- @mid:h-93b3zi -->
## Phase 5: Polish & Pre-Launch

<!-- @mid:p-0ozdfp -->
**Goal:**** Ensure the app feels professional, fast, and accessible.**

<!-- @mid:h-20icg3 -->
### 5.1 Accessibility (a11y)

<!-- @mid:list-2d36e9 -->
- \[ \] Ensure full keyboard navigation (Tab indexing).
- \[ \] Screen reader testing (Aria labels on all icon buttons).
- \[ \] Contrast check for themes.

<!-- @mid:h-2ocpup -->
### 5.2 Performance Tuning

<!-- @mid:list-cudbxg -->
- \[ \] **Virtualization:** If a folder has 1,000 files, use list virtualization in the sidebar.
- \[ \] **Lazy Loading:** Lazy load Editor components.
- \[ \] **Startup Time:** Minimize main process overhead.

<!-- @mid:h-i32muk -->
### 5.3 Distribution

<!-- @mid:list-41k7br -->
- \[ \] **Auto-Updater:** Configure `electron-updater`.
- \[ \] **Code Signing:** Apple Developer ID / Windows Cert signing.
- \[ \] **Installers:** Build `.dmg`, `.exe`, `.AppImage` using `electron-builder`.

---

<!-- @mid:h-iuy195 -->
## MVP Scope Checklist (What is IN vs. OUT)

<!-- @mid:h-gsvscy -->
### IN (Must Have)

<!-- @mid:list-eq03n1 -->
- \[x\] Local File System (Read/Write).
- \[x\] Markdown Editor (WYSIWYG).
- \[x\] Dark/Light Theme.
- \[x\] Inline AI (Cmd+K) with Diff view.
- \[x\] Chat Pane with `@` file referencing.
- \[x\] AI ability to create new files.
- \[x\] Free Tier limits logic.

<!-- @mid:h-ugi8r1 -->
### OUT (Post-MVP/Future)

<!-- @mid:list-r1f1cy -->
- \[ \] Boards/Canvas mode (Explicitly deferred).
- \[ \] Mobile App.
- \[ \] Real-time collaboration (Multiplayer).
- \[ \] Plugin system.
- \[ \] PDF Parsing (Premium feature, deferred to v1.1).

---

<!-- @mid:h-slq355 -->
## Risk Assessment

<!-- @mid:p-kn8443 -->
***`RiskMitigation Strategy`******`LLM Hallucination`******`High reliance on "Context Awareness." Ensure the prompt includes the `******`exact`******` file content, not a summary, whenever possible.`******`Token Costs`******`Strict limits on Free tier. Use caching for context that hasn't changed. Use cheaper models (GPT-4o-mini) for simple tasks.`******`Sync Conflicts`******`For MVP, lean on "Last Write Wins" or create conflict files (`******`File (Conflict).md`******`) rather than complex merging logic.`******`Privacy Trust`******`Open source the encryption module or undergo a security audit. Ensure the "Local Only" mode never makes network requests (except for AI).`***