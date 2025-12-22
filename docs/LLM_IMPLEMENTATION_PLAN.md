# Midlight LLM Integration - Implementation Plan

## Overview

This document outlines the implementation plan for adding LLM functionality to Midlight, transforming it into an AI-native document editor as described in the PRD.

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API Routing | Proxy through backend | Enables usage tracking, rate limiting, account tiers, no user API key management |
| LLM Providers | OpenAI + Anthropic | Multiple providers for flexibility and redundancy |
| Authentication | Email/password + OAuth | Maximum flexibility for users |
| Token Strategy | JWT with refresh tokens | Stateless access tokens, revocable refresh tokens |

---

## Phase 1: Backend Authentication & User Management

**Goal:** Establish secure user authentication with subscription tracking

### 1.1 Database Schema Extensions

**File:** `midlight-site/server/db/schema.sql`

```sql
-- Users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,                    -- NULL for OAuth-only users
  display_name TEXT,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- OAuth accounts (supports multiple providers per user)
CREATE TABLE oauth_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,                -- 'google', 'github'
  provider_user_id TEXT NOT NULL,
  provider_data JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(provider, provider_user_id)
);

-- Subscriptions
CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',     -- 'free', 'premium'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'expired'
  renewal_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Usage tracking
CREATE TABLE llm_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,                -- 'openai', 'anthropic'
  model TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  month TEXT NOT NULL,                   -- '2025-12' for monthly rollup
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_usage_user_month ON llm_usage(user_id, month);

-- Sessions (for JWT refresh token invalidation)
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  refresh_token_hash TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

### 1.2 New Dependencies

```bash
cd midlight-site
npm install argon2 jsonwebtoken passport passport-google-oauth20 passport-github2 cookie-parser express-validator
```

### 1.3 New Backend Files

```
midlight-site/server/
├── middleware/
│   ├── auth.js              # JWT verification middleware
│   └── rateLimitAuth.js     # Tier-based rate limiting
├── services/
│   ├── authService.js       # User CRUD, password hashing with argon2
│   ├── tokenService.js      # JWT generation (access + refresh tokens)
│   └── oauthService.js      # Passport strategy configurations
├── routes/
│   ├── auth.js              # Authentication endpoints
│   └── user.js              # User profile/subscription endpoints
└── config/
    └── passport.js          # Google & GitHub OAuth strategies
```

### 1.4 Authentication Endpoints

**File:** `midlight-site/server/routes/auth.js`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Email/password registration |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/refresh` | Exchange refresh token for new access token |
| POST | `/api/auth/logout` | Invalidate refresh token |
| GET | `/api/auth/google` | Initiate Google OAuth |
| GET | `/api/auth/google/callback` | Google OAuth callback |
| GET | `/api/auth/github` | Initiate GitHub OAuth |
| GET | `/api/auth/github/callback` | GitHub OAuth callback |

### 1.5 User Endpoints

**File:** `midlight-site/server/routes/user.js`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/me` | Get current user profile |
| PATCH | `/api/user/me` | Update profile (name, avatar) |
| GET | `/api/user/subscription` | Get subscription details |
| GET | `/api/user/usage` | Get current month's LLM usage |
| DELETE | `/api/user/me` | Account deletion |

### 1.6 Token Strategy

```
Access Token:
- Short-lived (15 minutes)
- Stored in memory on Electron client
- Contains: { userId }
- Sent via Authorization header

Refresh Token:
- Long-lived (7 days)
- Stored as httpOnly cookie
- Hash stored in sessions table for revocation
- Silent refresh when access token expires
```

### 1.7 Environment Variables

Add to `midlight-site/.env`:
```
ACCESS_TOKEN_SECRET=<generate with: openssl rand -base64 64>
REFRESH_TOKEN_SECRET=<generate with: openssl rand -base64 64>

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:3001/api/auth/github/callback
```

---

## Phase 2: LLM Proxy Infrastructure

**Goal:** Multi-provider LLM proxy with quota management

### 2.1 New Dependencies

```bash
cd midlight-site
npm install openai @anthropic-ai/sdk
```

### 2.2 New Backend Files

```
midlight-site/server/services/llm/
├── index.js              # Unified LLM interface
├── openaiProvider.js     # OpenAI SDK wrapper
├── anthropicProvider.js  # Anthropic SDK wrapper
└── quotaManager.js       # Usage tracking + limit enforcement
```

### 2.3 LLM Endpoints

**File:** `midlight-site/server/routes/llm.js`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/llm/chat` | LLM completion (supports SSE streaming) |
| GET | `/api/llm/models` | Available models by subscription tier |
| GET | `/api/llm/quota` | Current usage and remaining quota |

### 2.4 Model Tiers

| Tier | OpenAI | Anthropic | Google | Monthly Limit |
|------|--------|-----------|--------|---------------|
| Free | gpt-5-mini | — | gemini-3-flash | 100 queries |
| Premium | gpt-5.2 | claude-sonnet-4.5, claude-opus-4.5 | gemini-3-pro | Unlimited |

### 2.5 Unified LLM Interface

```javascript
// server/services/llm/index.js
class LLMService {
  async chat({ provider, model, messages, stream = false, userId }) {
    // 1. Check quota via quotaManager
    const quota = await quotaManager.checkQuota(userId);
    if (!quota.allowed) {
      throw new QuotaExceededError(quota);
    }

    // 2. Route to appropriate provider
    const providerService = provider === 'openai'
      ? openaiProvider
      : anthropicProvider;

    // 3. Make request
    const response = await providerService.chat({ model, messages, stream });

    // 4. Track usage
    await quotaManager.trackUsage(userId, provider, model, response.usage);

    return response;
  }
}
```

### 2.6 Streaming Response (SSE)

```javascript
// POST /api/llm/chat with stream: true
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

for await (const chunk of llmStream) {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}
res.write('data: [DONE]\n\n');
res.end();
```

### 2.7 Rate Limiting

```javascript
// Per-tier rate limits (requests per minute)
const limits = {
  free: 10,
  premium: 30
};
```

### 2.8 Environment Variables

Add to `midlight-site/.env`:
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Phase 3: Electron App Authentication

**Goal:** In-app login flow with token management

### 3.1 New Dependencies

```bash
cd ai-doc-app
npm install keytar
```

### 3.2 New Electron Files

```
ai-doc-app/electron/services/
├── authService.ts        # Login, signup, token refresh, OAuth flow
└── secureStorage.ts      # Keytar wrapper for secure token storage
```

### 3.3 Auth Service Implementation

**File:** `electron/services/authService.ts`

```typescript
import keytar from 'keytar';
import { net } from 'electron';

const SERVICE_NAME = 'midlight-app';
const API_BASE = process.env.API_URL || 'http://localhost:3001';

export class AuthService {
  private accessToken: string | null = null;

  async login(email: string, password: string): Promise<User> {
    const res = await this.fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    const { accessToken, user } = await res.json();
    this.accessToken = accessToken;
    return user;
  }

  async refreshAccessToken(): Promise<void> {
    const res = await this.fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    const { accessToken } = await res.json();
    this.accessToken = accessToken;
  }

  async ensureValidToken(): Promise<void> {
    if (!this.accessToken) return;

    const payload = JSON.parse(atob(this.accessToken.split('.')[1]));
    const expiresIn = payload.exp * 1000 - Date.now();

    if (expiresIn < 60000) { // Refresh if <1 min remaining
      await this.refreshAccessToken();
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }
}
```

### 3.4 OAuth Desktop Flow

1. Register custom protocol handler: `midlight://`
2. Open OAuth URL in BrowserWindow
3. Backend callback redirects to `midlight://auth/callback?accessToken=...`
4. Electron handles protocol, extracts token, updates UI

```typescript
// electron/main.ts
import { app, protocol } from 'electron';

app.setAsDefaultProtocolClient('midlight');

app.on('open-url', (event, url) => {
  if (url.startsWith('midlight://auth/callback')) {
    const params = new URL(url).searchParams;
    const accessToken = params.get('accessToken');
    // Store token, notify renderer
  }
});
```

### 3.5 IPC Additions

**File:** `electron/preload.ts`

```typescript
auth: {
  login: (email: string, password: string) =>
    ipcRenderer.invoke('auth:login', email, password),
  signup: (email: string, password: string, displayName: string) =>
    ipcRenderer.invoke('auth:signup', email, password, displayName),
  loginWithGoogle: () => ipcRenderer.invoke('auth:loginWithGoogle'),
  loginWithGithub: () => ipcRenderer.invoke('auth:loginWithGithub'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getUser: () => ipcRenderer.invoke('auth:getUser'),
  getSubscription: () => ipcRenderer.invoke('auth:getSubscription'),
  getUsage: () => ipcRenderer.invoke('auth:getUsage'),
}
```

### 3.6 Renderer Auth Store

**New file:** `src/store/useAuthStore.ts`

```typescript
interface AuthState {
  user: User | null;
  subscription: Subscription | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithGithub: () => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  fetchSubscription: () => Promise<void>;
}
```

### 3.7 New UI Components

```
src/components/
├── AuthModal.tsx         # Login/signup modal with tabs
├── LoginForm.tsx         # Email/password form
├── SignupForm.tsx        # Registration form
└── OAuthButtons.tsx      # Google/GitHub sign-in buttons
```

### 3.8 Settings Modal Updates

**File:** `src/components/SettingsModal.tsx`

Replace "AI Models" placeholder tab with:
- **Account tab:** Profile, subscription tier badge, usage meter, logout
- **AI Models tab:** Model preferences, default provider/model selection

---

## Phase 4: LLM Integration (Electron)

**Goal:** Connect editor to LLM proxy with streaming support

### 4.1 New Electron Files

**File:** `electron/services/llmService.ts`

```typescript
export class LLMService {
  async chat(options: ChatOptions): Promise<string> {
    await authService.ensureValidToken();
    const token = authService.getAccessToken();

    const res = await fetch(`${API_BASE}/api/llm/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(options)
    });

    if (options.stream) {
      return this.handleStream(res, options.onChunk);
    }

    const data = await res.json();
    return data.content;
  }

  private async handleStream(res: Response, onChunk: (text: string) => void): Promise<string> {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      // Parse SSE format
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return fullText;

          const parsed = JSON.parse(data);
          if (parsed.content) {
            fullText += parsed.content;
            onChunk(parsed.content);
          }
        }
      }
    }

    return fullText;
  }
}
```

### 4.2 IPC for Streaming

```typescript
// Use event-based streaming (avoid invoke timeout issues)
llm: {
  chatStream: (options: ChatOptions, channelId: string) => {
    ipcRenderer.send('llm:chatStream', options, channelId);
  },
  onStreamChunk: (channelId: string, callback: (text: string) => void) => {
    ipcRenderer.on(`llm:stream:${channelId}`, (_, text) => callback(text));
  },
  offStreamChunk: (channelId: string) => {
    ipcRenderer.removeAllListeners(`llm:stream:${channelId}`);
  }
}
```

### 4.3 AI State Store

**New file:** `src/store/useAIStore.ts`

```typescript
interface AIState {
  // Chat panel
  chatHistory: Message[];
  isStreaming: boolean;
  currentStreamText: string;

  // Inline editing
  inlineEditMode: boolean;
  inlinePrompt: string;
  inlineResult: string | null;

  // Settings
  selectedProvider: 'openai' | 'anthropic';
  selectedModel: string;
  temperature: number;

  // Actions
  sendChatMessage: (content: string) => Promise<void>;
  startInlineEdit: (selection: string, prompt: string) => Promise<void>;
  acceptInlineEdit: () => void;
  rejectInlineEdit: () => void;
}
```

---

## Phase 5: AI Chat Panel

**Goal:** Replace placeholder with functional chat UI

### 5.1 Component Structure

```
src/components/ai/
├── AIChatPanel.tsx       # Main container
├── MessageList.tsx       # Virtualized message history
├── MessageBubble.tsx     # Individual message with markdown
├── ChatInput.tsx         # Auto-resize textarea
├── TypingIndicator.tsx   # Streaming animation
└── ContextSelector.tsx   # @-mention file picker
```

### 5.2 Chat Panel Implementation

**File:** `src/components/ai/AIChatPanel.tsx`

```tsx
export function AIChatPanel() {
  const { chatHistory, isStreaming, sendChatMessage } = useAIStore();
  const { editorContent, activeFilePath } = useFileSystem();

  const sendWithContext = async (userInput: string) => {
    // Auto-inject current document as context
    const context = `Current document: ${activeFilePath}\n\n${getTextContent(editorContent)}`;
    await sendChatMessage(userInput, context);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <MessageList messages={chatHistory} isStreaming={isStreaming} />
      </div>
      <ChatInput onSend={sendWithContext} disabled={isStreaming} />
    </div>
  );
}
```

### 5.3 @-Mentions for File Context

- Detect `@` character in input
- Show dropdown with file list from workspace
- On selection, insert `@filename.md`
- On send, resolve references and fetch file content
- Include referenced files in system message

```typescript
async function resolveReferences(input: string): Promise<FileReference[]> {
  const mentions = input.match(/@[\w\-.]+/g) || [];
  const files: FileReference[] = [];

  for (const mention of mentions) {
    const filename = mention.slice(1);
    const content = await window.electronAPI.readFile(filename);
    files.push({ filename, content });
  }

  return files;
}
```

### 5.4 Chat Persistence

Store per-workspace in `.midlight/chat-history.json`:

```json
{
  "sessions": [
    {
      "id": "uuid",
      "timestamp": "2025-12-13T10:00:00Z",
      "messages": [
        { "id": "1", "role": "user", "content": "...", "timestamp": 1702... },
        { "id": "2", "role": "assistant", "content": "...", "timestamp": 1702... }
      ]
    }
  ]
}
```

---

## Phase 6: Inline AI Editing (Cmd+K)

**Goal:** Select text, prompt AI, review diff, accept/reject

### 6.1 Keyboard Shortcut

**File:** `src/components/Editor.tsx`

```typescript
const editor = useEditor({
  extensions: [...],
  editorProps: {
    handleKeyDown: (view, event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        handleInlineEditTrigger();
        return true;
      }
      return false;
    }
  }
});

function handleInlineEditTrigger() {
  const { from, to } = editor.state.selection;
  const selectedText = editor.state.doc.textBetween(from, to);

  if (!selectedText.trim()) {
    showToast('Select text first');
    return;
  }

  setShowInlinePrompt(true);
  setSelectionRange({ from, to });
}
```

### 6.2 New Components

```
src/components/ai/
├── InlineEditPrompt.tsx  # Floating input near selection
└── DiffView.tsx          # Side-by-side or inline diff display
```

### 6.3 Inline Prompt UI

**File:** `src/components/ai/InlineEditPrompt.tsx`

```tsx
export function InlineEditPrompt({
  position,
  onSubmit,
  onCancel
}: Props) {
  const [prompt, setPrompt] = useState('');

  return (
    <div
      className="absolute bg-white shadow-lg rounded-lg p-3 w-80"
      style={{ top: position.top - 60, left: position.left }}
    >
      <input
        autoFocus
        placeholder="What would you like to do with this text?"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(prompt);
          if (e.key === 'Escape') onCancel();
        }}
        className="w-full border rounded px-2 py-1"
      />
      <div className="text-xs text-gray-500 mt-1">
        Enter to submit, Esc to cancel
      </div>
    </div>
  );
}
```

### 6.4 LLM Prompt Template

```typescript
const systemPrompt = `You are an AI text editor. The user has selected text and wants to modify it.

Selected text:
"""
${selectedText}
"""

User instruction: ${userPrompt}

Respond ONLY with the modified text. Do not include explanations or markdown formatting unless specifically requested.`;
```

### 6.5 Diff View

**File:** `src/components/ai/DiffView.tsx`

Use `diff-match-patch` or `react-diff-viewer` library:

```tsx
import ReactDiffViewer from 'react-diff-viewer-continued';

export function DiffView({ original, modified, onAccept, onReject }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b font-medium">Review Changes</div>
        <div className="overflow-auto max-h-[60vh]">
          <ReactDiffViewer
            oldValue={original}
            newValue={modified}
            splitView={false}
            showDiffOnly={false}
          />
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onReject} className="px-4 py-2 border rounded">
            Reject
          </button>
          <button onClick={onAccept} className="px-4 py-2 bg-blue-500 text-white rounded">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 6.6 Content Replacement

```typescript
function acceptInlineEdit() {
  editor.chain()
    .focus()
    .deleteRange({ from: selectionRange.from, to: selectionRange.to })
    .insertContentAt(selectionRange.from, inlineResult)
    .run();

  // Create checkpoint for undo
  window.electronAPI.workspaceCreateBookmark({
    message: `AI edit: "${inlinePrompt}"`
  });
}
```

---

## Phase 7: AI Agent File Operations

**Goal:** Allow AI to create/edit files via chat

### 7.1 Function Calling Tools

```typescript
const tools = [
  {
    name: 'create_file',
    description: 'Create a new file in the workspace',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Name of the file' },
        content: { type: 'string', description: 'File content' }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'edit_file',
    description: 'Edit an existing file',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string' },
        content: { type: 'string', description: 'New file content' }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'read_file',
    description: 'Read contents of a file',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string' }
      },
      required: ['filename']
    }
  }
];
```

### 7.2 Agent Service

**File:** `electron/services/aiAgentService.ts`

```typescript
export class AIAgentService {
  async executeTool(toolName: string, args: Record<string, unknown>) {
    // Validate filename (no path traversal)
    if (args.filename) {
      this.validateFilename(args.filename as string);
    }

    switch (toolName) {
      case 'create_file':
        return this.createFile(args.filename as string, args.content as string);
      case 'edit_file':
        return this.editFile(args.filename as string, args.content as string);
      case 'read_file':
        return this.readFile(args.filename as string);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private validateFilename(filename: string) {
    if (filename.includes('..') || filename.startsWith('/')) {
      throw new Error('Invalid filename: path traversal not allowed');
    }
  }
}
```

### 7.3 User Approval UI

Show tool calls in chat as approval requests:

```tsx
{message.type === 'tool_call' && (
  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
    <div className="flex items-center gap-2">
      <WrenchIcon className="w-4 h-4" />
      <span className="font-medium">AI wants to: {message.toolName}</span>
    </div>
    <pre className="text-sm bg-white rounded p-2 mt-2">
      {JSON.stringify(message.args, null, 2)}
    </pre>
    <div className="flex gap-2 mt-2">
      <button
        onClick={() => approveTool(message.id)}
        className="px-3 py-1 bg-green-500 text-white rounded text-sm"
      >
        Allow
      </button>
      <button
        onClick={() => rejectTool(message.id)}
        className="px-3 py-1 bg-red-500 text-white rounded text-sm"
      >
        Deny
      </button>
    </div>
  </div>
)}
```

---

## Phase 8: Polish & Optimization

### 8.1 Error Handling

```typescript
try {
  await sendChatMessage(input);
} catch (error) {
  if (error.code === 'QUOTA_EXCEEDED') {
    showToast('Monthly quota exceeded. Upgrade to Premium for unlimited access.');
  } else if (error.code === 'NETWORK_ERROR') {
    showToast('Network error. Please check your connection.');
  } else if (error.code === 'AUTH_EXPIRED') {
    // Trigger re-login
    showAuthModal();
  } else {
    showToast('Something went wrong. Please try again.');
  }
}
```

### 8.2 Loading States

- Streaming typing indicator in chat
- Inline edit loading spinner
- Skeleton screens for initial load
- Progress indicators for long operations

### 8.3 Performance

- Virtualize chat history with `react-window`
- Debounce @-mention search (300ms)
- Batch IPC streaming chunks (every 100ms)

### 8.4 Accessibility

- Full keyboard navigation
- ARIA labels on interactive elements
- Focus management in modals
- Screen reader announcements for streaming

### 8.5 Testing

- Backend: Auth flows, LLM proxy, quota enforcement
- Electron: IPC communication, token refresh
- Renderer: Component rendering, store actions
- E2E: Full user journeys

---

## Phase 9: Deployment

### 9.1 Backend Deployment

**Recommended platforms:** Railway, Render, Fly.io

**Checklist:**
- [ ] Production environment variables
- [ ] SQLite database with WAL mode
- [ ] Automated daily backups
- [ ] SSL certificate
- [ ] CORS configured for Electron app

### 9.2 OAuth App Setup

**Google:**
1. Create project at console.cloud.google.com
2. Enable OAuth consent screen
3. Create OAuth 2.0 credentials
4. Add authorized redirect URI

**GitHub:**
1. Create OAuth app at github.com/settings/developers
2. Set authorization callback URL
3. Note client ID and secret

### 9.3 Monitoring

- **Sentry:** Error tracking for backend + Electron
- **Structured logging:** Winston with JSON format
- **Metrics:** LLM requests, response times, error rates

### 9.4 Electron Updates

- Use `electron-updater` for auto-updates
- Host releases on GitHub Releases
- Code signing for macOS/Windows

---

## File Summary

### Backend (midlight-site)

| File | Purpose |
|------|---------|
| `server/db/schema.sql` | Add users, oauth_accounts, subscriptions, llm_usage, sessions tables |
| `server/middleware/auth.js` | JWT verification middleware |
| `server/services/authService.js` | User CRUD, password hashing |
| `server/services/tokenService.js` | JWT generation and validation |
| `server/services/llm/index.js` | Unified LLM interface |
| `server/services/llm/openaiProvider.js` | OpenAI SDK wrapper |
| `server/services/llm/anthropicProvider.js` | Anthropic SDK wrapper |
| `server/services/llm/quotaManager.js` | Usage tracking and limits |
| `server/routes/auth.js` | Authentication endpoints |
| `server/routes/user.js` | User profile endpoints |
| `server/routes/llm.js` | LLM proxy endpoints |
| `server/config/passport.js` | OAuth strategies |

### Electron (ai-doc-app)

| File | Purpose |
|------|---------|
| `electron/services/authService.ts` | Auth flow, token management |
| `electron/services/llmService.ts` | LLM API client with streaming |
| `electron/services/aiAgentService.ts` | Tool execution for file ops |
| `electron/main.ts` | Add auth and LLM IPC handlers |
| `electron/preload.ts` | Add auth and llm API surface |

### Renderer (ai-doc-app)

| File | Purpose |
|------|---------|
| `src/store/useAuthStore.ts` | Auth state management |
| `src/store/useAIStore.ts` | AI/chat state management |
| `src/components/AuthModal.tsx` | Login/signup modal |
| `src/components/ai/AIChatPanel.tsx` | Chat panel (replace placeholder) |
| `src/components/ai/MessageList.tsx` | Virtualized message list |
| `src/components/ai/MessageBubble.tsx` | Message rendering |
| `src/components/ai/ChatInput.tsx` | Input with @-mentions |
| `src/components/ai/InlineEditPrompt.tsx` | Cmd+K prompt popup |
| `src/components/ai/DiffView.tsx` | Diff display modal |
| `src/components/Editor.tsx` | Add Cmd+K handler |
| `src/components/SettingsModal.tsx` | Add Account tab |

---

## Implementation Order

```
Phase 1: Backend Auth (foundation)
    ↓
Phase 2: LLM Proxy ──────┐
    ↓                    │
Phase 3: Electron Auth ──┤
    ↓                    │
Phase 4: LLM Integration ←┘
    ↓
Phase 5: Chat Panel ───┐
    ↓                  │ (parallel)
Phase 6: Inline Edit ──┘
    ↓
Phase 7: AI Agents
    ↓
Phase 8: Polish
    ↓
Phase 9: Deploy
```

---

## Success Criteria

### MVP (End of Phase 6)
- [ ] Users can sign up with email or OAuth
- [ ] Free tier enforces 100 queries/month limit
- [ ] Chat panel functional with document context
- [ ] Cmd+K inline editing with diff view
- [ ] Both OpenAI and Anthropic providers working

### Full Launch (End of Phase 9)
- [ ] Premium tier with unlimited access
- [ ] AI file operations with user approval
- [ ] Auto-update working on all platforms
- [ ] <2s average LLM response latency
- [ ] >99% backend uptime
- [ ] >80% test coverage
