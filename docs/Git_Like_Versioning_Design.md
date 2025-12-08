<!-- @mid:h-cggznx -->
# Git-Like Versioning for Regular People

<!-- @mid:p-fipfzg -->
A design document exploring how to bring the power of Git-style version control to Midlight users who have never heard of Git—and how this fits into a freemium business model.

---

<!-- @mid:h-zdpps9 -->
## Table of Contents

<!-- @mid:list-h50pas -->
1. The Vision
2. Translating Git Concepts for Humans
3. Technical Architecture
4. User Experience Design
5. Free vs. Paid: Feature Placement Strategy
6. Cloud Sync Integration
7. Implementation Roadmap
8. Competitive Analysis

---

<!-- @mid:h-lf077y -->
## 1. The Vision

<!-- @mid:h-pj57lt -->
### What Git Does Well

<!-- @mid:p-wcyntg -->
Git is the most powerful version control system ever created. It offers:

<!-- @mid:list-g140lv -->
- **Complete history**: Every change ever made is recoverable
- **Efficient storage**: Content-addressable storage deduplicates identical content
- **Branching**: Work on experiments without affecting the original
- **Merging**: Combine work from different branches intelligently
- **Distributed**: Works offline, syncs when connected

<!-- @mid:h-rjoqn5 -->
### Why Regular People Don't Use Git

<!-- @mid:list-p7je6c -->
- **Cryptic terminology**: "rebase," "HEAD," "detached state," "cherry-pick"
- **Command-line focused**: Most interactions require typing commands
- **Designed for code**: Assumes line-by-line text comparison
- **Error-prone**: Easy to lose work if you don't understand the model
- **Intimidating**: "I'll break something" fear

<!-- @mid:h-aktsig -->
### The Opportunity

<!-- @mid:bq-8852mn -->
> **Give users Git's superpowers through an interface so simple they don't know they're using version control.**

<!-- @mid:p-nvuw0q -->
Think of it like this:

<!-- @mid:list-w6fdl7 -->
- **Git** is a manual transmission—maximum control, steep learning curve
- **Midlight Versioning** is an automatic transmission—same engine, effortless to drive

---

<!-- @mid:h-4h5eme -->
## 2. Translating Git Concepts for Humans

<!-- @mid:h-8pakpe -->
### Terminology Mapping

<!-- @mid:p-ya3thp -->
*****************| Git Concept | Midlight Term | User Mental Model |
|-------------|---------------|-------------------|
| Commit | *********Checkpoint************* | "Save a moment in time" |
| Branch | *********Draft************* | "Try something without messing up the original" |
| Main/Master | *********Published************* | "The real version" |
| Merge | *********Apply Changes************* | "Use what I tried in the draft" |
| Revert | *********Restore************* | "Go back to how it was" |
| Diff | *********Compare************* | "What changed?" |
| Repository | *********Document History************* | "All the versions" |
| Clone | *********Copy with History************* | "Duplicate everything" |
| Stash | *********Set Aside************* | "Save for later" |
| HEAD | (hidden) | Users never see this |
| Hash | (hidden) | Users never see this |*****************

<!-- @mid:h-te8yp3 -->
### Core User-Facing Features

<!-- @mid:p-8gf9t5 -->
**#### 1. ****Automatic Checkpoints****************
Like Google Docs' "See version history"—no manual action required.**************

<!-- @mid:bq-wbve2k -->
> "Midlight automatically saves checkpoints as you work. You can always go back."

<!-- @mid:p-gx140q -->
**#### 2. ****Named Checkpoints**************** (Bookmarks)
Let users mark important moments.**************

<!-- @mid:bq-ne4khr -->
> "Click the bookmark icon to name this version. Call it 'Before big rewrite' or 'Sent to client.'"

<!-- @mid:p-e81j23 -->
**#### 3. ****Drafts**************** (Branches for Humans)
Try changes without risk.**************

<!-- @mid:bq-bkbg56 -->
> "Start a Draft to experiment. If you like it, apply the changes. If not, just delete the draft."

<!-- @mid:p-ompd2w -->
**#### 4. ****Compare View****************
Visual diff without technical jargon.**************

<!-- @mid:bq-pbwle2 -->
> "See exactly what changed between any two versions—additions in blue, deletions in red."

<!-- @mid:p-knyz65 -->
**#### 5. ****Restore****************
Go back in time, non-destructively.**************

<!-- @mid:bq-xugow8 -->
> "Restore any previous version. Don't worry—your current version becomes a checkpoint too."

---

<!-- @mid:h-sti4cn -->
## 3. Technical Architecture

<!-- @mid:h-bmaubz -->
### 3.1 Content-Addressable Storage

<!-- @mid:p-86q6qm -->
Store content by its hash, not by filename. Identical content is stored once.

<!-- @mid:code-79h82x -->
```
workspace/
├── .midlight/
│   ├── objects/                    # Content blobs (gzipped)
│   │   ├── a3/
│   │   │   └── b4c5d6e7f8...      # First 2 chars = directory
│   │   └── f1/
│   │       └── 2e3f4a5b6c...
│   ├── checkpoints/
│   │   └── document.md.json       # Checkpoint history
│   ├── drafts/
│   │   └── document.md/
│   │       └── experiment.json    # Draft metadata
│   └── config.json
├── document.md                     # Current "published" content
└── notes.md
```

<!-- @mid:h-jzyqhy -->
### 3.2 Object Storage Format

<!-- @mid:p-7lzisw -->
Each content blob is:

<!-- @mid:list-binkp1 -->
1. The raw file content
2. Gzip compressed
3. Named by SHA-256 hash (first 2 chars as directory for filesystem efficiency)

<!-- @mid:code-u544oj -->
```typescript
import { createHash } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import * as fs from 'fs';
import * as path from 'path';

class ObjectStore {
  constructor(private objectsDir: string) {}

  // Store content, return hash
  write(content: string): string {
    const hash = createHash('sha256').update(content).digest('hex');
    const compressed = gzipSync(Buffer.from(content, 'utf8'));

    const dir = path.join(this.objectsDir, hash.slice(0, 2));
    const file = path.join(dir, hash.slice(2));

    if (!fs.existsSync(file)) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, compressed);
    }

    return hash;
  }

  // Retrieve content by hash
  read(hash: string): string {
    const file = path.join(this.objectsDir, hash.slice(0, 2), hash.slice(2));
    const compressed = fs.readFileSync(file);
    return gunzipSync(compressed).toString('utf8');
  }

  // Check if content exists
  exists(hash: string): boolean {
    const file = path.join(this.objectsDir, hash.slice(0, 2), hash.slice(2));
    return fs.existsSync(file);
  }
}
```

<!-- @mid:h-4yi08x -->
### 3.3 Checkpoint Structure

<!-- @mid:code-jk8uii -->
```typescript
interface Checkpoint {
  hash: string;              // Content hash (pointer to object)
  timestamp: string;         // ISO 8601
  parent: string | null;     // Previous checkpoint hash (not content hash)
  type: 'auto' | 'manual';   // How it was created
  label?: string;            // User-provided name
  wordCount: number;         // Metadata
  charCount: number;
  trigger?: string;          // What caused the checkpoint
}

interface CheckpointHistory {
  filePath: string;
  currentHead: string;       // Latest checkpoint ID
  checkpoints: Checkpoint[];
}
```

<!-- @mid:p-zmyxf5 -->
**Example checkpoints/document.md.json:**

<!-- @mid:code-ihaua4 -->
```json
{
  "filePath": "document.md",
  "currentHead": "cp_003",
  "checkpoints": [
    {
      "id": "cp_001",
      "hash": "a3b4c5d6e7f8901234567890abcdef1234567890abcdef1234567890abcdef12",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "parent": null,
      "type": "auto",
      "wordCount": 150,
      "charCount": 892,
      "trigger": "file_opened"
    },
    {
      "id": "cp_002",
      "hash": "f12e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e",
      "timestamp": "2024-01-15T10:35:00.000Z",
      "parent": "cp_001",
      "type": "auto",
      "wordCount": 180,
      "charCount": 1056,
      "trigger": "interval_5min"
    },
    {
      "id": "cp_003",
      "hash": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "timestamp": "2024-01-15T11:00:00.000Z",
      "parent": "cp_002",
      "type": "manual",
      "label": "Before client feedback",
      "wordCount": 220,
      "charCount": 1298,
      "trigger": "user_bookmark"
    }
  ]
}
```

<!-- @mid:h-wq4xfm -->
### 3.4 Draft (Branch) Structure

<!-- @mid:code-yos03h -->
```typescript
interface Draft {
  id: string;
  name: string;              // User-friendly name
  sourceCheckpoint: string;  // Where the draft started
  currentHead: string;       // Latest checkpoint in draft
  checkpoints: Checkpoint[]; // Draft's own checkpoint history
  createdAt: string;
  status: 'active' | 'merged' | 'archived';
}
```

<!-- @mid:p-ytsrhv -->
**Example drafts/document.md/experiment.json:**

<!-- @mid:code-5zwf0s -->
```json
{
  "id": "draft_001",
  "name": "Try shorter intro",
  "sourceCheckpoint": "cp_002",
  "currentHead": "dcp_002",
  "checkpoints": [
    {
      "id": "dcp_001",
      "hash": "aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666777788889999aaaa",
      "timestamp": "2024-01-15T11:30:00.000Z",
      "parent": "cp_002",
      "type": "auto",
      "wordCount": 150,
      "charCount": 890
    },
    {
      "id": "dcp_002",
      "hash": "bbbb2222cccc3333dddd4444eeee5555ffff6666777788889999aaaabbbb1111",
      "timestamp": "2024-01-15T11:45:00.000Z",
      "parent": "dcp_001",
      "type": "auto",
      "wordCount": 140,
      "charCount": 820
    }
  ],
  "createdAt": "2024-01-15T11:30:00.000Z",
  "status": "active"
}
```

<!-- @mid:h-2uo9u7 -->
### 3.5 Checkpoint Creation Logic

<!-- @mid:code-p0tev0 -->
```typescript
interface CheckpointConfig {
  intervalMs: number;           // Minimum time between auto checkpoints
  minChanges: number;           // Minimum character changes to trigger
  maxCheckpoints: number;       // Per file (for free tier)
  retentionDays: number;        // How long to keep (for free tier)
}

class CheckpointManager {
  private lastCheckpoint: { [filePath: string]: { time: number; hash: string } } = {};

  async maybeCreateCheckpoint(
    filePath: string,
    content: string,
    trigger: 'interval' | 'significant_change' | 'file_close' | 'user_bookmark'
  ): Promise<Checkpoint | null> {
    const config = this.getConfig();
    const now = Date.now();
    const last = this.lastCheckpoint[filePath];

    // Calculate content hash
    const hash = this.objectStore.write(content);

    // Skip if content unchanged
    if (last && last.hash === hash) {
      return null;
    }

    // Check interval (except for user bookmarks)
    if (trigger !== 'user_bookmark' && last) {
      if (now - last.time < config.intervalMs) {
        return null;
      }
    }

    // Check change significance (except for user bookmarks)
    if (trigger !== 'user_bookmark' && last) {
      const lastContent = this.objectStore.read(last.hash);
      const changeSize = Math.abs(content.length - lastContent.length);
      if (changeSize < config.minChanges) {
        return null;
      }
    }

    // Create checkpoint
    const checkpoint = await this.createCheckpoint(filePath, hash, trigger);

    // Enforce limits (free tier)
    await this.enforceRetention(filePath, config);

    this.lastCheckpoint[filePath] = { time: now, hash };
    return checkpoint;
  }
}
```

<!-- @mid:h-ac1ztu -->
### 3.6 Diff Generation

<!-- @mid:p-34fucd -->
Use a diff library to show changes between versions:

<!-- @mid:code-txhrwu -->
```typescript
import { diffWords, diffLines } from 'diff';

interface DiffSegment {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

function generateDiff(oldContent: string, newContent: string): DiffSegment[] {
  const changes = diffWords(oldContent, newContent);

  return changes.map(change => ({
    type: change.added ? 'added' : change.removed ? 'removed' : 'unchanged',
    value: change.value
  }));
}

// For UI rendering
function renderDiff(segments: DiffSegment[]): string {
  return segments.map(seg => {
    switch (seg.type) {
      case 'added':
        return `<span class="diff-added">${escapeHtml(seg.value)}</span>`;
      case 'removed':
        return `<span class="diff-removed">${escapeHtml(seg.value)}</span>`;
      default:
        return escapeHtml(seg.value);
    }
  }).join('');
}
```

<!-- @mid:h-pukv59 -->
### 3.7 Merging Drafts

<!-- @mid:p-j01c96 -->
When applying changes from a draft back to the main document:

<!-- @mid:code-91cqgs -->
```typescript
type MergeStrategy = 'replace' | 'smart_merge';

async function mergeDraft(
  filePath: string,
  draftId: string,
  strategy: MergeStrategy
): Promise<MergeResult> {

  const mainHistory = await this.getCheckpointHistory(filePath);
  const draft = await this.getDraft(filePath, draftId);

  const mainContent = this.objectStore.read(mainHistory.currentHead);
  const draftContent = this.objectStore.read(draft.currentHead);
  const commonAncestor = this.objectStore.read(draft.sourceCheckpoint);

  if (strategy === 'replace') {
    // Simple: draft content replaces main content
    await this.saveFile(filePath, draftContent);
    await this.createCheckpoint(filePath, 'draft_merged', `Merged draft: ${draft.name}`);
    draft.status = 'merged';
    return { success: true, conflicts: [] };
  }

  if (strategy === 'smart_merge') {
    // Three-way merge (like git)
    const merged = threeWayMerge(commonAncestor, mainContent, draftContent);

    if (merged.conflicts.length > 0) {
      return {
        success: false,
        conflicts: merged.conflicts,
        suggestedContent: merged.content
      };
    }

    await this.saveFile(filePath, merged.content);
    await this.createCheckpoint(filePath, 'draft_merged', `Merged draft: ${draft.name}`);
    draft.status = 'merged';
    return { success: true, conflicts: [] };
  }
}
```

<!-- @mid:p-b2afar -->
**Note on Three-Way Merge:**

<!-- @mid:p-brwmib -->
For rich text documents (not code), true three-way merge is complex. For MVP, offer two options:

<!-- @mid:list-5k9te1 -->
1. **Replace**: Draft content replaces main (user manually incorporates any main changes)
2. **Side-by-side**: Show both versions, let user pick sections

<!-- @mid:p-p6lxz0 -->
Advanced merge can come later if users need it.

---

<!-- @mid:h-hcygpe -->
## 4. User Experience Design

<!-- @mid:h-l7re32 -->
### 4.1 History Panel (Sidebar)

<!-- @mid:code-z43kzh -->
```
┌─────────────────────────────────────┐
│  📜 Document History                │
├─────────────────────────────────────┤
│                                     │
│  ★ Before client feedback           │  ← Bookmarked checkpoint
│    Today at 11:00 AM                │
│    220 words                        │
│    [Compare] [Restore]              │
│                                     │
│  ○ Auto-saved                       │  ← Regular checkpoint
│    Today at 10:35 AM                │
│    180 words                        │
│                                     │
│  ○ Auto-saved                       │
│    Today at 10:30 AM                │
│    150 words                        │
│                                     │
│  ─────────────────────              │
│                                     │
│  📝 Drafts                          │
│                                     │
│  ◇ Try shorter intro                │  ← Active draft
│    Started from 10:35 AM version    │
│    [Open] [Apply] [Delete]          │
│                                     │
└─────────────────────────────────────┘
```

<!-- @mid:h-1bc92t -->
### 4.2 Creating a Bookmark

<!-- @mid:code-l2vbxv -->
```
┌──────────────────────────────────────────────┐
│  🔖 Create Bookmark                          │
├──────────────────────────────────────────────┤
│                                              │
│  Name this version:                          │
│  ┌────────────────────────────────────────┐  │
│  │ Before client feedback                 │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  This helps you find this version later.     │
│                                              │
│              [Cancel]  [Save Bookmark]       │
└──────────────────────────────────────────────┘
```

<!-- @mid:h-c4f1vs -->
### 4.3 Creating a Draft

<!-- @mid:code-samdk1 -->
```
┌──────────────────────────────────────────────┐
│  📝 Start a Draft                            │
├──────────────────────────────────────────────┤
│                                              │
│  A draft lets you experiment without         │
│  changing your main document.                │
│                                              │
│  Name your draft:                            │
│  ┌────────────────────────────────────────┐  │
│  │ Try shorter intro                      │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Start from:                                 │
│  ○ Current version                           │
│  ○ Before client feedback (11:00 AM)         │
│  ○ Earlier version...                        │
│                                              │
│              [Cancel]  [Create Draft]        │
└──────────────────────────────────────────────┘
```

<!-- @mid:h-jy8wp3 -->
### 4.4 Compare View

<!-- @mid:code-cr5vsn -->
```
┌───────────────────────────────────────────────────────────────────┐
│  Compare Versions                                            [X]  │
├───────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐           ┌─────────────────┐               │
│  │ ▼ 10:35 AM      │    vs     │ ▼ 11:00 AM ★    │               │
│  └─────────────────┘           └─────────────────┘               │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  # My Document                                                    │
│                                                                   │
│  ~~This is the introduction that was too long and needed~~        │
│  ~~to be shortened because clients complained about it.~~         │
│                                                                   │
│  ++A shorter, punchier intro that gets to the point.++            │
│                                                                   │
│  The rest of the document remains unchanged...                    │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│  -52 words removed  •  +12 words added  •  Net: -40 words         │
│                                                                   │
│              [Restore 10:35 AM]  [Restore 11:00 AM]  [Close]      │
└───────────────────────────────────────────────────────────────────┘
```

<!-- @mid:h-36uaf2 -->
### 4.5 Applying a Draft

<!-- @mid:code-pl5pa1 -->
```
┌──────────────────────────────────────────────┐
│  📝 Apply Draft Changes                      │
├──────────────────────────────────────────────┤
│                                              │
│  Draft: "Try shorter intro"                  │
│                                              │
│  Your main document has changed since you    │
│  started this draft.                         │
│                                              │
│  How would you like to proceed?              │
│                                              │
│  ○ Replace with draft                        │
│    Use the draft version, discard main       │
│    changes since the draft started           │
│                                              │
│  ○ Compare side-by-side                      │
│    Review both versions and choose           │
│    what to keep                              │
│                                              │
│              [Cancel]  [Continue]            │
└──────────────────────────────────────────────┘
```

<!-- @mid:h-vbs50b -->
### 4.6 Restore Confirmation

<!-- @mid:code-ozmqzk -->
```
┌──────────────────────────────────────────────┐
│  🔄 Restore Previous Version                 │
├──────────────────────────────────────────────┤
│                                              │
│  Restore to: "Before client feedback"        │
│  (Today at 11:00 AM • 220 words)             │
│                                              │
│  ✓ Your current version will be saved as     │
│    a checkpoint before restoring.            │
│                                              │
│  You can always restore your current         │
│  version from the history.                   │
│                                              │
│              [Cancel]  [Restore]             │
└──────────────────────────────────────────────┘
```

---

<!-- @mid:h-mwvo3z -->
## 5. Free vs. Paid: Feature Placement Strategy

<!-- @mid:h-ivdvsl -->
### Market Research Summary

<!-- @mid:p-773jjt -->
*****************| App | Free Tier History | Paid Tier History | Price |
|-----|-------------------|-------------------|-------|
| *********Notion************* | 7 days | 30/90/∞ days | $8-15/user/mo |
| *********Obsidian Sync************* | Local only | 1-12 months | $4-8/mo |
| *********Dropbox************* | 30 days | 180-365 days | $12-20/mo |
| *********Figma************* | 30 days | Unlimited | $15/editor/mo |
| *********Google Docs****** | Unlimited | Unlimited | Free |**********

<!-- @mid:h-po8kdy -->
### Strategic Considerations

<!-- @mid:p-dsb5un -->
**Why Version History Should Be Partially Free:**

<!-- @mid:list-fdakb5 -->
1. **Safety is table stakes**: Users expect undo/recovery. Not offering it feels broken.
2. **Builds trust**: Users trust apps that protect their work.
3. **Low cost**: Local storage is cheap—this isn't a cloud resource drain.
4. **Differentiation**: Many note apps don't have this. It's a selling point.

<!-- @mid:p-k2nzn6 -->
**Why Some Features Should Be Paid:**

<!-- @mid:list-zumtdm -->
1. **Extended retention** requires more storage (especially with cloud sync).
2. **Drafts/branching** is a power feature—casual users don't need it.
3. **Cloud sync of history** is a real infrastructure cost.
4. **Unlimited history** is premium positioning.

<!-- @mid:h-bskr1j -->
### Recommended Tier Structure

<!-- @mid:h-a0cqx7 -->
#### Free Tier: "Midlight"

<!-- @mid:p-7kh6ba -->
| Feature | Limit | Rationale |
|---------|-------|-----------|
| Auto checkpoints | ✓ | Core safety—everyone needs this |
| Checkpoint retention | 7 days | Matches Notion free; enough for "oops" recovery |
| Max checkpoints/file | 50 | Prevents unbounded growth |
| Named bookmarks | 3 per file | Let users try the feature |
| Compare versions | ✓ | Core feature for history to be useful |
| Restore versions | ✓ | Core feature |
| Drafts | 1 active | Let users try branching |
| Storage | Local only | No cloud costs |

<!-- @mid:h-e6z3x9 -->
#### Paid Tier: "Midlight Pro" (~$8-10/month)

<!-- @mid:p-kdd1j0 -->
*****************| Feature | Limit | Rationale |
|---------|-------|-----------|
| Auto checkpoints | ✓ | Same as free |
| Checkpoint retention | 1 year | Power users need longer history |
| Max checkpoints/file | Unlimited | No artificial limits |
| Named bookmarks | Unlimited | Power feature |
| Compare versions | ✓ | Same as free |
| Restore versions | ✓ | Same as free |
| Drafts | Unlimited | Full branching power |
| Cloud sync of history | ✓ | *********Key paid feature************* |
| History across devices | ✓ | Requires sync |
| Version export | ✓ | Export any version as standalone file |
| AI: "What changed?" | ✓ | AI summarizes changes between versions |
| AI: "Restore section" | ✓ | AI helps merge specific parts |*****************

<!-- @mid:h-t4kuzf -->
### Feature Unlock Flow

<!-- @mid:p-f0viur -->
When a free user hits a limit:

<!-- @mid:code-kpcbbw -->
```
┌──────────────────────────────────────────────┐
│  📝 Upgrade to Create More Drafts            │
├──────────────────────────────────────────────┤
│                                              │
│  You've used your 1 free draft.              │
│                                              │
│  With Midlight Pro, you can:                 │
│  • Create unlimited drafts                   │
│  • Keep history for 1 year (vs 7 days)       │
│  • Sync history across all your devices      │
│  • Use AI to compare and merge versions      │
│                                              │
│  $8/month or $80/year (save 17%)             │
│                                              │
│      [Maybe Later]  [Upgrade to Pro]         │
└──────────────────────────────────────────────┘
```

<!-- @mid:h-h6eiu9 -->
### Why This Split Works

<!-- @mid:p-4ovn7m -->
**Free tier value:**

<!-- @mid:list-jyrqtc -->
- Enough history for "I just made a mistake" recovery
- Enough to demonstrate the value of versioning
- Drafts let users experience branching once
- Local-only = zero marginal cost to you

<!-- @mid:p-okckvo -->
**Paid tier value:**

<!-- @mid:list-g4zzxe -->
- Extended history for professionals who reference old work
- Cloud sync is genuinely useful and costly to provide
- AI integration adds clear value
- Unlimited drafts for complex workflows

<!-- @mid:p-dw3hyd -->
**Psychological pricing:**

<!-- @mid:list-y6vqe3 -->
- 7 days is enough to save users from most mistakes
- But professionals *feel* the limit when referencing last month's version
- "What if I need it later?" anxiety drives upgrades
- AI features are compelling upsells for knowledge workers

---

<!-- @mid:h-3ddfub -->
## 6. Cloud Sync Integration

<!-- @mid:p-wtcgop -->
When the paid tier syncs history to the cloud:

<!-- @mid:h-j7duwq -->
### 6.1 Sync Architecture

<!-- @mid:code-wsnji3 -->
```
┌─────────────────┐         ┌─────────────────┐
│   Device A      │         │   Device B      │
│                 │         │                 │
│  .midlight/     │         │  .midlight/     │
│  ├── objects/   │◄───────►│  ├── objects/   │
│  ├── checkpts/  │  Cloud  │  ├── checkpts/  │
│  └── drafts/    │  Sync   │  └── drafts/    │
└─────────────────┘         └─────────────────┘
         │                           │
         ▼                           ▼
    ┌─────────────────────────────────────┐
    │         Midlight Cloud              │
    │                                     │
    │  • E2EE encrypted blobs             │
    │  • Content-addressable (deduped)    │
    │  • Checkpoint metadata              │
    │  • User authentication              │
    └─────────────────────────────────────┘
```

<!-- @mid:h-2lwgcj -->
### 6.2 Content-Addressable Sync Benefits

<!-- @mid:p-bcx49h -->
Because objects are stored by hash:

<!-- @mid:list-weyzbo -->
1. **Deduplication**: Identical content synced once, even across files
2. **Efficient sync**: Only new objects need to upload
3. **Integrity**: Hash verifies content wasn't corrupted
4. **Resumable**: Can resume interrupted syncs

<!-- @mid:h-2ony0z -->
### 6.3 Sync Conflict Handling

<!-- @mid:p-f4g5cx -->
**Scenario****: User edits document.md on both Device A and Device B offline.**

<!-- @mid:p-y4bzlh -->
**Solution****: Both versions become checkpoints. User sees:**

<!-- @mid:code-5oalk7 -->
```
┌──────────────────────────────────────────────┐
│  ⚠️ Sync Conflict                            │
├──────────────────────────────────────────────┤
│                                              │
│  "document.md" was edited on two devices     │
│  while offline.                              │
│                                              │
│  Device A (MacBook):                         │
│  "Added conclusion paragraph"                │
│  Last edited 2 hours ago                     │
│                                              │
│  Device B (iPad):                            │
│  "Fixed typos in intro"                      │
│  Last edited 30 minutes ago                  │
│                                              │
│  [Keep MacBook]  [Keep iPad]  [Compare]      │
└──────────────────────────────────────────────┘
```

<!-- @mid:p-z4knag -->
Both versions are preserved in history regardless of which is chosen.

<!-- @mid:h-fu7ite -->
### 6.4 E2EE for History

<!-- @mid:p-enhzu5 -->
Version history should be end-to-end encrypted:

<!-- @mid:list-n86e0g -->
- User's encryption key derived from password
- Objects encrypted before upload
- Server cannot read content or history
- Matches PRD promise of local-first privacy

---

<!-- @mid:h-g8hpbe -->
## 7. Implementation Roadmap

<!-- @mid:h-w42f3f -->
### Phase 1: Local Foundation (Weeks 1-3)

<!-- @mid:p-cfzs7g -->
**Goal****: Basic checkpoint system, no cloud**

<!-- @mid:list-ewoj8z -->
1. **Object store implementation**
 - Content-addressable storage
 - SHA-256 hashing
 - Gzip compression

<!-- @mid:list-ht2ojb -->
1. **Checkpoint system**
 - Auto-checkpoint on interval (5 min)
 - Auto-checkpoint on significant change
 - Checkpoint on file close

<!-- @mid:list-kuff0t -->
1. **Basic history UI**
 - List checkpoints in sidebar
 - Preview checkpoint content
 - Restore checkpoint (with safety save)

<!-- @mid:list-5z0n1q -->
1. **Free tier limits**
 - 7-day retention
 - 50 checkpoints per file

<!-- @mid:h-eou9dz -->
### Phase 2: Bookmarks & Compare (Weeks 4-5)

<!-- @mid:p-rtlps0 -->
**Goal****: Named checkpoints and visual diff**

<!-- @mid:list-q8koq9 -->
1. **Bookmark feature**
 - Name checkpoints
 - Star/favorite checkpoints
 - Bookmarked checkpoints exempt from auto-cleanup

<!-- @mid:list-p26ewe -->
1. **Compare view**
 - Side-by-side or inline diff
 - Word-level highlighting
 - Change statistics

<!-- @mid:list-dc66ci -->
1. **Settings**
 - Configure checkpoint interval
 - Configure retention
 - Storage usage display

<!-- @mid:h-ubluvn -->
### Phase 3: Drafts/Branching (Weeks 6-8)

<!-- @mid:p-dqhysz -->
**Goal****: Non-destructive experimentation**

<!-- @mid:list-xr79qz -->
1. **Draft creation**
 - Create draft from any checkpoint
 - Name draft
 - Switch between main and draft

<!-- @mid:list-pff14c -->
1. **Draft management**
 - List active drafts
 - Archive/delete drafts
 - Draft-specific checkpoint history

<!-- @mid:list-yjlrjt -->
1. **Apply changes (merge)**
- Replace strategy
- Side-by-side comparison
- Conflict UI (if main changed)

<!-- @mid:list-xovcto -->
1. **Free tier limits**
- 1 active draft

<!-- @mid:h-tsip38 -->
### Phase 4: Cloud Sync (Weeks 9-12)

<!-- @mid:p-4492qa -->
**Goal****: History syncs across devices (paid)**

<!-- @mid:list-ndd9qf -->
1. **Cloud infrastructure**
- Object storage backend (S3/R2)
- User authentication
- E2EE implementation

<!-- @mid:list-b8ldzx -->
1. **Sync logic**
- Upload new objects
- Download missing objects
- Sync checkpoint metadata
- Conflict resolution

<!-- @mid:list-56wecv -->
1. **Paid tier unlocks**
- 1-year retention
- Unlimited checkpoints
- Unlimited drafts
- Cloud sync

<!-- @mid:h-qw5ur8 -->
### Phase 5: AI Integration (Weeks 13-16)

<!-- @mid:p-k0wis5 -->
**Goal****: AI-powered version features (paid)**

<!-- @mid:list-yi03to -->
1. **"What changed?" summary**
- AI describes changes between versions
- Natural language diff

<!-- @mid:list-kuxo1t -->
1. **"Restore section"**
- Select text, ask AI to find in history
- AI suggests which version had the content

<!-- @mid:list-pd0k5b -->
1. **Smart merge assistance**
- AI helps resolve conflicts
- Suggests how to combine versions

---

<!-- @mid:h-v87swb -->
## 8. Competitive Analysis

<!-- @mid:h-eqj9wf -->
### How Competitors Handle Versioning

<!-- @mid:h-6wjn7n -->
#### Notion

<!-- @mid:list-n28x6x -->
- **Free**: 7 days page history
- **Paid**: 30/90/unlimited days
- **UX**: Simple "Page history" sidebar
- **Branching**: No (databases have different version model)
- **Insight**: Notion proves 7-day free tier converts to paid

<!-- @mid:h-np7czy -->
#### Obsidian

<!-- @mid:list-wbpvfd -->
- **Free**: Local-only, plugin-based (Git, File Recovery)
- **Paid Sync**: 1-12 months history
- **UX**: Plugin-dependent, varies
- **Branching**: Via Git plugin (technical users)
- **Insight**: Power users use Git; casual users need simpler option

<!-- @mid:h-d18cax -->
#### Figma

<!-- @mid:list-mjjwhm -->
- **Free**: 30 days history
- **Paid**: Unlimited history, branching
- **UX**: Excellent—timeline scrubber, named versions, branches
- **Branching**: Full branching with merge and review
- **Insight**: Best-in-class UX for non-technical branching

<!-- @mid:h-cvp0xd -->
#### Dropbox Paper

<!-- @mid:list-v9bfqk -->
- **Free**: 30 days
- **Paid**: Extended via Dropbox plan
- **UX**: Simple "Version history" modal
- **Branching**: No
- **Insight**: Minimal feature, not a differentiator

<!-- @mid:h-jk7x6u -->
#### Google Docs

<!-- @mid:list-y2b92e -->
- **Free**: Unlimited (but Google owns your data)
- **UX**: "Version history" with named versions
- **Branching**: "Make a copy" (manual, loses connection)
- **Insight**: Unlimited free history is possible—Google monetizes data

<!-- @mid:h-x9t7zq -->
### Midlight's Differentiation

<!-- @mid:p-pj88lh -->
***| Factor | Notion | Obsidian | Figma | ******Midlight******************** |
|--------|--------|----------|-------|--------------|
| Local-first | ❌ | ✓ | ❌ | ✓ |
| Free history | 7 days | Local | 30 days | *********7 days************* |
| Paid history | 90 days | 12 mo | ∞ | *********1 year************* |
| Branching | ❌ | Git plugin | ✓ | *********✓ (simplified)************* |
| AI integration | ✓ (separate) | Plugins | ❌ | *********✓ (native)************* |
| Offline-first | ❌ | ✓ | ❌ | *********✓************* |
| E2EE | ❌ | N/A | ❌ | *********✓****** |**********

<!-- @mid:p-gnydt3 -->
**Midlight's unique position:**

<!-- @mid:list-xd8y4v -->
- **Local-first** like Obsidian, but with **Figma-quality UX**
- **Branching** without Git complexity
- **AI-native** version features (unique differentiator)
- **Privacy-first** with E2EE sync

---

<!-- @mid:h-05inzj -->
## Summary & Recommendations

<!-- @mid:h-hzeog6 -->
### Key Decisions

<!-- @mid:list-njkevs -->
1. **Use content-addressable storage**: Efficient, deduplicated, future-proof for sync
2. **Call it "Checkpoints" and "Drafts"**: Friendly terminology
3. **Free tier: 7 days, 1 draft**: Enough to be useful, drives upgrades
4. **Paid tier: 1 year, unlimited drafts, cloud sync**: Clear value proposition
5. **AI features in paid tier**: Unique differentiator, high perceived value

<!-- @mid:h-4w07gu -->
### Critical Success Factors

<!-- @mid:list-xg080f -->
1. **UX must be invisible**: Users shouldn't think about versioning—it just works
2. **Recovery must be non-destructive**: Restoring creates a new checkpoint
3. **Drafts must be simple**: Not "branches"—just "try something without messing up"
4. **Free tier must be useful**: If it feels crippled, users won't convert—they'll leave

<!-- @mid:h-0vdxa4 -->
### Risks & Mitigations

<!-- @mid:p-8b3bwc -->
| Risk | Mitigation |
|------|------------|
| Storage bloat | Content-addressable deduplication; retention limits |
| Slow history UI | Lazy load checkpoints; virtualized list |
| Merge conflicts confuse users | Simple "replace" option; AI assist in paid tier |
| Users don't discover feature | Onboarding tooltip; "Your work is protected" messaging |
| Cloud sync costs | E2EE shifts compute to client; object dedup reduces storage |

---

<!-- @mid:h-3bb819 -->
## References

<!-- @mid:list-vmzpgf -->
- Dropbox Version History
- Notion Pricing
- Figma Version History
- Figma Branching Guide
- Obsidian Sync
- Content-Addressable Storage (Wikipedia)

---

<!-- @mid:p-spg69n -->
*Document created: 2025-12-05********
*****Status: Design complete, ready for implementation decisions****