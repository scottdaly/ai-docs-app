# Versioning User Experience Strategy

This document describes the user-facing experience for saving and version history in Midlight. It focuses on how users interact with these features, not the technical implementation.

---

## Core Philosophy

### Two Simple Concepts

Midlight's approach to saving and versioning is built on just two concepts:

| Concept | What It Is | User Action |
|---------|------------|-------------|
| **Auto-save** | Continuous, invisible saving with undo history | None—it just works |
| **Versions** | Intentional snapshots at meaningful milestones | User clicks "Save Version" |

That's it. No checkpoints, bookmarks, drafts, or branches. Just automatic protection and intentional milestones.

### The Mental Model

Think of it like writing in a notebook:
- **Auto-save** = The ink is permanent the moment you write
- **Versions** = Taking a photo of a page before making big changes

---

## Auto-Save: Invisible Protection

### What Users See

**Nothing.** That's the point.

- No save button
- No "unsaved changes" indicator
- No "Are you sure?" dialogs when closing
- No anxiety about losing work

### What Actually Happens

1. **Continuous saving**: Changes saved within 1 second of pausing
2. **Undo history**: Can undo/redo within the session
3. **Crash recovery**: Unsaved work recovered after unexpected quit
4. **AI edit recovery**: Each AI edit creates an undo point

### The User's Mental Model

> "I just type. It's always saved. If I mess up, I can undo."

This is how Google Docs and Notion work. Users trust the app to handle saving.

### Undo as the Primary Recovery

For recent mistakes, **Undo (⌘Z)** is the answer:
- Works for manual edits
- Works for AI-generated changes
- Available throughout the editing session

**After AI edits a document:**
- The change appears in the editor
- User can immediately Undo if they don't like it
- No special UI needed—standard undo behavior

---

## Versions: Intentional Milestones

### What Is a Version?

A version is a snapshot you intentionally save at a meaningful moment—like a commit in GitHub, but simpler.

**When to save a version:**
- Before sending to someone
- After completing a major section
- Before making significant changes
- At any "I might want to come back to this" moment

### Creating a Version

**Entry point:** "Save Version" button in toolbar or menu (⌘S as optional shortcut)

```
┌──────────────────────────────────────────────┐
│  Save Version                                 │
├──────────────────────────────────────────────┤
│                                              │
│  Name this version:                          │
│  ┌────────────────────────────────────────┐  │
│  │ First draft complete                   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  A version captures your document at this    │
│  moment. You can return to it anytime.       │
│                                              │
│              [Cancel]  [Save Version]        │
└──────────────────────────────────────────────┘
```

### Viewing Versions

**Entry point:** History icon in toolbar or right sidebar

```
┌─────────────────────────────────────────┐
│  Version History                         │
├─────────────────────────────────────────┤
│                                         │
│  📌 Before client revisions             │
│     Today at 2:30 PM · 1,240 words      │
│     [View] [Restore] [Compare]          │
│                                         │
│  📌 First draft complete                │
│     Yesterday at 4:15 PM · 980 words    │
│     [View] [Restore] [Compare]          │
│                                         │
│  📌 Initial outline                     │
│     Dec 10 at 11:00 AM · 320 words      │
│     [View] [Restore] [Compare]          │
│                                         │
│  ─────────────────────────────────────  │
│  Versions are saved forever until you   │
│  delete them.                           │
└─────────────────────────────────────────┘
```

### Version Actions

| Action | What It Does |
|--------|--------------|
| **View** | Opens read-only preview of that version |
| **Restore** | Makes this version the current document |
| **Compare** | Shows differences between this and current |
| **Delete** | Removes this version permanently |

### Restoring a Version

When restoring, the current state is automatically saved first:

```
┌──────────────────────────────────────────────┐
│  Restore Version?                             │
├──────────────────────────────────────────────┤
│                                              │
│  Restore to "First draft complete"?          │
│                                              │
│  Your current document will be saved as a    │
│  new version called "Before restore" so you  │
│  can get back to it if needed.               │
│                                              │
│              [Cancel]  [Restore]             │
└──────────────────────────────────────────────┘
```

This means restoring is never destructive—you can always undo a restore.

---

## Comparing Versions

Users can compare any version with the current document:

```
┌───────────────────────────────────────────────────────────────────┐
│  Compare: "First draft" → Current                            [X]  │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  # My Document                                                    │
│                                                                   │
│  ~~This is the introduction that was too long and rambling.~~    │
│  ~~It went on for several paragraphs without getting to the~~    │
│  ~~point, which frustrated readers.~~                            │
│                                                                   │
│  ++A concise introduction that gets straight to the point.++     │
│                                                                   │
│  The rest of the document continues here...                       │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│  -89 words removed · +12 words added                              │
│                                                                   │
│                    [Restore "First draft"]  [Close]               │
└───────────────────────────────────────────────────────────────────┘
```

**Visual language:**
- ~~Strikethrough with red~~ = Removed text
- ++Underline with green++ = Added text

---

## AI Edits and Undo

### How AI Edits Work with Undo

When the AI makes changes to a document:

1. AI applies the edit to the document
2. Edit appears as a single undoable action
3. User can immediately **Undo (⌘Z)** to revert
4. User can also chat "undo that" or "revert that change"

**No special version is created.** AI edits are just edits—undoable like any other.

### When to Save a Version Around AI Edits

If a user is about to ask the AI to make major changes:
- **Before:** Optionally save a version ("Before AI rewrite")
- **After:** If they like the result, optionally save a version

But this is the user's choice. The system doesn't automatically create versions for AI edits.

### Conversation-Based Recovery

In the chat interface, users can reference previous states:

> **User:** "Actually, go back to how the introduction was before"
> **AI:** Reverts the introduction to the previous state

The AI can use undo or re-edit to achieve this. No special versioning system needed.

---

## Crash Recovery

### What Users See After a Crash

If the app quits unexpectedly and there was unsaved work:

```
┌─────────────────────────────────────────────────────┐
│  Recover Changes?                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Midlight found unsaved changes from your last      │
│  session.                                           │
│                                                     │
│  📄 Project Proposal                                │
│     ~2 paragraphs since last auto-save              │
│                                                     │
│         [Discard]  [Recover]                        │
└─────────────────────────────────────────────────────┘
```

### How Recovery Works

1. System saves recovery data every few seconds
2. On clean exit, recovery data is deleted
3. On crash, recovery data persists
4. On next launch, offer to recover

---

## External File Changes

### When Files Change Outside Midlight

If someone edits a file in another app (VS Code, git, sync service):

**If no unsaved changes in Midlight:** Auto-reload silently

**If there are unsaved changes:**

```
┌─────────────────────────────────────────────────────┐
│  File Changed                                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  "Project Proposal" was modified outside of         │
│  Midlight.                                          │
│                                                     │
│  [Reload from Disk]  [Keep Mine]  [Compare]         │
└─────────────────────────────────────────────────────┘
```

---

## What's NOT in This System

To keep the model simple, we explicitly **don't** have:

| Concept | Why Not |
|---------|---------|
| Automatic checkpoints | Confusing—are they versions? Can I delete them? |
| Bookmarks | Redundant—versions are bookmarks |
| Drafts/branches | Too complex for most users |
| Auto-cleanup | Versions are permanent until deleted |
| Commit messages | "Name" is simpler |
| Version numbers | Timestamps + names are clearer |

---

## Information Hierarchy

### Always Visible
- Nothing about saving (it's automatic)

### On Demand (History Panel)
- List of saved versions with names and dates
- View, restore, compare, delete actions

### When Needed (Dialogs)
- Save Version prompt
- Restore confirmation
- Crash recovery
- External change conflict

### Never Visible
- Technical terms (commits, branches, HEAD)
- File system details (.midlight folder)
- Undo history persistence details

---

## Feature Discovery

### First Document

Tooltip after first edit:
> "Your work is automatically saved. Use ⌘Z to undo anytime."

### After Significant Editing

Subtle prompt:
> "Want to save this as a version? You can return to it later."

### Empty Version History

```
┌─────────────────────────────────────────┐
│  Version History                         │
├─────────────────────────────────────────┤
│                                         │
│  No versions saved yet.                 │
│                                         │
│  Save a version when you reach a        │
│  milestone—like completing a draft      │
│  or before making big changes.          │
│                                         │
│  [Save Version]                         │
│                                         │
└─────────────────────────────────────────┘
```

---

## Summary

| User Need | Solution |
|-----------|----------|
| "Did my work save?" | Auto-save (invisible, always on) |
| "I just made a mistake" | Undo (⌘Z) |
| "I want to save a milestone" | Save Version |
| "What did this look like before?" | View version |
| "I want to go back to an old version" | Restore version |
| "What changed since then?" | Compare version |
| "The AI messed something up" | Undo (⌘Z) or chat "undo that" |
| "The app crashed" | Crash recovery prompt |

**The goal:** Users feel their work is always safe, and creating intentional milestones is simple and familiar—like saving a commit, but without the complexity.

---

*Document created: 2025-12-12*
*Revised: 2025-12-13 - Simplified from Checkpoints/Bookmarks/Drafts to Auto-save/Versions*
