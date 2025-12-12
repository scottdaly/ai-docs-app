Here is the Product Requirements Document formatted as a clean, structured Markdown file.

***

# Product Requirements Document: "Midlight"

## 1. Executive Summary
**Midlight** is a desktop-first, AI-native document application designed for a general audience. It combines the local-first, privacy-centric architecture of **Obsidian** with the user-friendly, block-based flexibility of **Notion**, all while integrating deep, contextual LLM capabilities inspired by **Cursor**.

The core premise is to move beyond "AI as a feature" (like a simple "summarize" button) and create an environment where the AI is a true collaborative partner, capable of understanding, editing, and creating documents alongside the user. It is effectively a **"Cursor for writing."**

## 2. Core Pillars & Philosophy

*   **AI-Native, Not AI-Assisted**
    The LLM is not a "plug-in." It is a core component of the editor, with deep context of the user's files, folders, and writing style.
*   **Local-First & Private**
    Users own their data. All files are stored locally by default. Cloud storage is an optional, end-to-end encrypted (E2EE) premium feature, not a requirement.
*   **Simple & Accessible**
    The UI/UX must be clean, intuitive, and familiar. We will prioritize a gentle learning curve for a general audience, using familiar metaphors like files and folders.
*   **Flexible & Composable**
    The app must handle more than just text. It will support different file types (Documents, AI Conversations, Boards) that can be organized and linked together.

## 3. Target User Personas

### The Student (High School/College)
*   **Needs:** Writing essays, summarizing research papers (PDFs), taking class notes, brainstorming ideas for projects.
*   **Wants:** An AI that can help structure an argument, find citations, check for tone, and explain complex concepts from their notes.

### The Professional (Marketer, Blogger, Analyst)
*   **Needs:** Drafting reports, writing blog posts, creating documentation, managing simple projects, and corresponding with clients.
*   **Wants:** An AI that can "remix" a document into a different format (e.g., "turn this report into a blog post"), adhere to a specific style guide, and automate repetitive writing tasks.

### The "Casual" Knowledge Worker (Hobbyist, Journaler)
*   **Needs:** A private, secure place to organize notes, journal, and manage personal projects.
*   **Wants:** A tool that feels personal and adaptable, with an AI that can help them brainstorm or organize their thoughts without feeling "corporate."

## 4. Functional Requirements

### 4.1 Core Application & File Management
*   **Platform:** Cross-platform desktop application (Windows, macOS, Linux).
*   **File Manager:**
    *   A simple, visible file-system-based "pane".
    *   Users see and interact with folders and files directly.
    *   Supports drag-and-drop for organization.
*   **Editor:**
    *   A block-based "What You See Is What You Get" (WYSIWYG) editor.
    *   Designed to be more accessible to a general audience than Markdown-first (Obsidian).
    *   Supports standard text formatting (headings, bold, lists), images, and embeds.
*   **File Types:**
    *   **Document (`.md`/proprietary):** The standard file for writing.
    *   **Conversation (`.chat`):** A saved, persistent AI chat log. This is a first-class file type that can be opened, referenced, and organized in the file manager.
    *   **Board (`.board`):** A "canvas" or mind-map style board for visual brainstorming. Users can add text blocks, images, and links. *(Note: Future Vision, not in MVP)*.

### 4.2 LLM-Native Features (The "Cursor" Translation)
*This is the core innovation. The AI must have "document context," not just prompt context.*

#### A. Inline AI Editing (The "Cmd+K")
*   User can select any block of text and open an AI prompt (e.g., `Ctrl+K` / `Cmd+K`).
*   **Example Prompts:** "Make this more formal," "Fix grammar and spelling," "Shorten this paragraph," "Translate to German," "Find a source for this claim."
*   **The Diff:** The AI will show a "diff" (like Cursor) of the proposed change, which the user can accept, reject, or modify.

#### B. Context-Aware AI Chat Pane
*   A persistent chat pane, similar to Cursor's side bar.
*   **Context:** The AI is automatically "aware" of the currently open file.
*   **Commands:** "Summarize this document," "What are the key action items?," "What arguments am I missing?"
*   **@-Mentions:** User can reference other files to bring them into context (e.g., *"Compare the argument in this file with @MyOtherDocument.md"*).

#### C. AI Agent & File Operations
*The AI must be able to CREATE and EDIT files.*
*   **File Creation:** User can ask the AI (via Chat or Command Palette) to create a new file.
    *   *Example:* "Create a new document in the 'Blog Posts' folder that outlines an article on 'The Future of Writing,' using the ideas from @Brainstorm.md."
*   **File Editing:** User can request edits to the current file.
    *   *Example:* "Go through this whole document and change the tone to be more persuasive."
*   **Cross-File Actions (Advanced):**
    *   *Example:* "Review the last three files in my 'Meetings' folder and create a 'Project Summary' document."

### 4.3 Storage & Sync Architecture

#### Default Mode (Local-First)
*   All files are stored on the user's local hard drive in a user-selected folder.
*   The app is fully functional offline (except for LLM features requiring an API).

#### Premium Mode (Cloud Sync)
*   A paid subscription feature.
*   Provides secure, **end-to-end encrypted (E2EE)** sync of the user's local folder to a cloud backend.
*   Used for backup, restore, and multi-device access.

## 5. Monetization & Tiers

### 5.1 Free Tier
*   **Includes:**
    *   The complete desktop application (editor, file manager, all file types).
    *   Full local-first storage.
*   **LLM Limits:**
    *   A "starter" amount of LLM queries/edits per month (e.g., 50–100).
    *   Uses a standard, good-quality model (e.g., GPT-4o, Gemini Pro).
    *   *Goal:* Allow users to experience the "magic" and build a dependency on the AI features.

### 5.2 Premium Tier (Subscription)
*   **High-Volume LLM Usage:** Unlimited or significantly higher-limit LLM queries/edits.
*   **Access to "Pro" Models:** Ability to select more powerful or specialized models (e.g., GPT-4-Turbo, Claude 3 Opus).
*   **Secure Cloud Sync:** The end-to-end encrypted cloud storage and sync feature.
*   **PDF/Web Page Ingestion:** Ability to "add" a PDF or URL to the context for the AI to read and analyze.

## 6. Non-Functional Requirements

*   **Accessibility:** As a "general audience" app, it must meet modern accessibility standards (WCAG compliance, full keyboard navigation, screen reader support).
*   **Performance:** Must be fast. Local-first architecture is a key enabler. App launch and file opening should be near-instant.
*   **Security:** E2EE for all premium cloud sync is non-negotiable to maintain the "privacy" promise.
*   **Theming:** Robust theming system for the app's appearance.

***

> **Scope Note:** While `.board` files (Visual Canvas) are part of the long-term vision described in Core Pillars, they are **excluded from the MVP** implementation. The MVP will focus on robust Text Documents (`.md`), Chat (`.chat`), and Folder structures.