# Versioning User Experience Strategy

This document describes the user-facing experience for saving, version history, and document recovery in Midlight. It focuses on how users interact with these features, not the technical implementation.

---

## Core Philosophy

### Invisible Safety Net

> **Users should never think about saving or versioning—it just works.**

Midlight protects users' work automatically. There's no "Save" button, no commit messages, no branches to manage. The system captures history silently, and users only interact with it when they need to recover something.

### Three Principles

1. **Auto-everything**: Saving and versioning happen without user action
2. **Non-destructive**: You can always go back; nothing is truly lost
3. **Simple language**: No technical jargon—"Checkpoints" not "commits"

---

## The Saving Experience

### What Users See

**Nothing.** That's the point.

- No save button in the UI
- No "unsaved changes" warnings
- No "Are you sure you want to close?" dialogs
- Document title never shows a dirty indicator (•)

### What Actually Happens

1. User types → changes saved within 1 second of pausing
2. User closes file → saved immediately
3. User quits app → saved immediately
4. App crashes → recovered on next launch

### Mental Model

Users should feel like they're editing a Google Doc:
- Changes are always saved
- Close the app anytime
- Come back and everything is there

---

## Checkpoints: Moments in Time

### What Is a Checkpoint?

A checkpoint is a saved snapshot of your document. Think of it as a photograph of your document at a specific moment.

**User-facing description:**
> "Midlight automatically saves checkpoints as you work. You can always go back to see how your document looked before."

### When Checkpoints Are Created

Users don't create checkpoints manually (though they can "bookmark" important ones). The system creates them:

| Trigger | User Perception |
|---------|-----------------|
| Every 5 minutes of editing | Invisible |
| After significant changes (~100 words) | Invisible |
| When closing a file | Invisible |
| When user clicks "Bookmark" | Explicit |

### Viewing Checkpoints

**Entry point:** History icon in toolbar or right sidebar

```
┌─────────────────────────────────────────┐
│  Document History                        │
├─────────────────────────────────────────┤
│                                         │
│  ★ Before client revisions              │  ← Bookmarked
│    Today at 2:30 PM · 1,240 words       │
│                                         │
│  ○ Auto-saved                           │  ← Automatic
│    Today at 1:15 PM · 1,180 words       │
│                                         │
│  ○ Auto-saved                           │
│    Today at 11:00 AM · 950 words        │
│                                         │
│  ─────── Yesterday ───────              │
│                                         │
│  ○ Auto-saved                           │
│    4:45 PM · 820 words                  │
│                                         │
└─────────────────────────────────────────┘
```

### Checkpoint Actions

| Action | What It Does | User Language |
|--------|--------------|---------------|
| Preview | Shows the document at that point | "See what it looked like" |
| Compare | Side-by-side with current version | "What changed?" |
| Restore | Makes this the current version | "Go back to this" |
| Bookmark | Names it and prevents auto-cleanup | "Remember this version" |

### Restoring a Checkpoint

**Critical UX principle:** Restoring is non-destructive.

When a user restores an old checkpoint:
1. Current version is saved as a new checkpoint first
2. Old version becomes the active document
3. User sees: "Restored. Your previous version was saved as a checkpoint."

This means users can never lose work by restoring—they can always "undo the restore."

---

## Bookmarks: Named Checkpoints

### Why Bookmarks?

Automatic checkpoints are great for "oops I made a mistake" recovery. But users also want to mark important moments:

- "Before I sent to client"
- "First draft complete"
- "After incorporating feedback"

### Creating a Bookmark

**Entry point:** Bookmark icon in toolbar

```
┌──────────────────────────────────────────────┐
│  Bookmark This Version                        │
├──────────────────────────────────────────────┤
│                                              │
│  Name this version:                          │
│  ┌────────────────────────────────────────┐  │
│  │ Before client revisions                │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  This helps you find this version later.     │
│                                              │
│              [Cancel]  [Save Bookmark]       │
└──────────────────────────────────────────────┘
```

### Bookmark Benefits

- Shown with a ★ star in history
- Never auto-deleted (regular checkpoints expire)
- Easier to find among many auto-saves

---

## Drafts: Safe Experimentation

### The Problem Drafts Solve

> "I want to try rewriting the introduction, but I don't want to mess up what I have."

Users sometimes want to experiment without risk. Currently, they might:
- Copy-paste to a new document
- Manually save a backup
- Just not try the experiment

### What Is a Draft?

A draft is a separate version of your document where you can experiment freely. Your main document stays untouched until you decide to use the changes.

**User-facing description:**
> "Start a draft to try something new. If you like it, apply the changes. If not, just delete the draft—your original is safe."

### Creating a Draft

**Entry point:** "Start Draft" in document menu or history panel

```
┌──────────────────────────────────────────────┐
│  Start a Draft                                │
├──────────────────────────────────────────────┤
│                                              │
│  A draft lets you experiment without         │
│  changing your main document.                │
│                                              │
│  Name your draft:                            │
│  ┌────────────────────────────────────────┐  │
│  │ Try shorter introduction               │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Start from:                                 │
│  ● Current version                           │
│  ○ Before client revisions (2:30 PM)         │
│  ○ Choose another checkpoint...              │
│                                              │
│              [Cancel]  [Create Draft]        │
└──────────────────────────────────────────────┘
```

### Working in a Draft

When a draft is active:
- Editor shows draft indicator: `📝 Draft: Try shorter introduction`
- Edits are saved to the draft, not the main document
- User can switch between draft and main anytime

### Applying Draft Changes

When the user is happy with their draft:

```
┌──────────────────────────────────────────────┐
│  Apply Draft Changes                          │
├──────────────────────────────────────────────┤
│                                              │
│  Draft: "Try shorter introduction"           │
│                                              │
│  How would you like to apply these changes?  │
│                                              │
│  ● Replace main document with draft          │
│    Your current main document will be        │
│    saved as a checkpoint first.              │
│                                              │
│  ○ Compare side-by-side                      │
│    Review both versions and choose what      │
│    to keep from each.                        │
│                                              │
│              [Cancel]  [Apply Changes]       │
└──────────────────────────────────────────────┘
```

### Discarding a Draft

If the experiment didn't work out:

```
┌──────────────────────────────────────────────┐
│  Delete Draft?                                │
├──────────────────────────────────────────────┤
│                                              │
│  Are you sure you want to delete the draft   │
│  "Try shorter introduction"?                 │
│                                              │
│  Your main document will not be affected.    │
│                                              │
│              [Cancel]  [Delete Draft]        │
└──────────────────────────────────────────────┘
```

---

## Comparing Versions

### The Compare View

Users can compare any two versions side-by-side:

```
┌───────────────────────────────────────────────────────────────────┐
│  Compare Versions                                            [X]  │
├───────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐           ┌─────────────────┐               │
│  │ ▼ Yesterday 4PM │    vs     │ ▼ Today 2:30 PM │               │
│  └─────────────────┘           └─────────────────┘               │
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
│  Summary: -89 words removed · +12 words added                     │
│                                                                   │
│           [Restore Yesterday]  [Restore Today]  [Close]           │
└───────────────────────────────────────────────────────────────────┘
```

### Visual Language

| Change Type | Visual Treatment |
|-------------|------------------|
| Removed text | ~~Strikethrough~~ with red background |
| Added text | ++Underline++ with green background |
| Unchanged | Normal text |

---

## Crash Recovery

### What Users Experience

If the app crashes or quits unexpectedly:

**On next launch:**

```
┌─────────────────────────────────────────────────────┐
│  Recover Unsaved Changes?                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Midlight found unsaved changes from your last      │
│  session:                                           │
│                                                     │
│  📄 Project Proposal.md                             │
│     ~2 paragraphs of unsaved changes                │
│                                                     │
│  📄 Meeting Notes.md                                │
│     ~5 sentences of unsaved changes                 │
│                                                     │
│         [Discard All]  [Recover All]                │
│                                                     │
│  Or choose individually:                            │
│  [View Details]                                     │
└─────────────────────────────────────────────────────┘
```

### Recovery Is Automatic

The key insight: users shouldn't have to think about crash recovery. The system:
1. Saves a recovery file every few seconds while editing
2. Cleans it up on normal save
3. Only shows the dialog if there's actually something to recover

---

## External Changes

### The Problem

If a user edits a file outside Midlight (in VS Code, via git, through sync services), Midlight needs to handle it gracefully.

### What Users See

When returning to Midlight after an external change:

```
┌─────────────────────────────────────────────────────┐
│  File Changed                                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  "Project Proposal.md" was modified outside of      │
│  Midlight.                                          │
│                                                     │
│  What would you like to do?                         │
│                                                     │
│  [Reload from Disk]                                 │
│    Use the version saved by the other app           │
│                                                     │
│  [Keep My Version]                                  │
│    Keep what's in Midlight, ignore external changes │
│                                                     │
│  [Compare]                                          │
│    See both versions before deciding                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Smart Defaults

- If user hasn't made changes in Midlight: auto-reload silently
- If user has unsaved changes: always prompt

---

## Information Hierarchy

### What Users Need to Know

**Always visible:**
- Nothing about saving (it's automatic)

**On demand (History panel):**
- Recent checkpoints with timestamps
- Bookmarked versions
- Active drafts

**When needed (Dialogs):**
- Recovery after crash
- External change conflicts
- Draft application choices

### What Users Never See

- Technical terms (commits, branches, HEAD, hash)
- File system details (.midlight folder)
- Save progress indicators
- Version numbers or IDs

---

## Edge Cases & Error States

### "I Can't Find My Old Version"

**Cause:** Auto-checkpoints older than retention period were cleaned up.

**Prevention:**
- Prompt users to bookmark important versions
- Show "Checkpoint expires in X days" for old versions

**Recovery:**
- Clear message: "Checkpoints older than 30 days are automatically removed. Bookmark important versions to keep them forever."

### "I Accidentally Restored the Wrong Version"

**Solution:** Restoring always creates a checkpoint of current state first.

**Message after restore:**
> "Restored to [version name]. Your previous version was saved—you can restore it from the history."

### "My Draft and Main Document Diverged"

When user's main document changed significantly while working on a draft:

```
┌──────────────────────────────────────────────┐
│  Your Main Document Has Changed               │
├──────────────────────────────────────────────┤
│                                              │
│  Since you started this draft, your main     │
│  document has been edited.                   │
│                                              │
│  You can:                                    │
│                                              │
│  ● Replace main with draft                   │
│    Discard changes made to main since draft  │
│    was created                               │
│                                              │
│  ○ Compare all three versions                │
│    See original, current main, and draft     │
│    side by side                              │
│                                              │
│              [Cancel]  [Continue]            │
└──────────────────────────────────────────────┘
```

---

## Feature Discovery

### How Users Learn About Versioning

**Onboarding tooltip (first document):**
> "Your work is automatically saved and versioned. Click the History icon anytime to see previous versions."

**Empty history state:**
> "As you edit, Midlight saves checkpoints automatically. They'll appear here so you can always go back."

**After significant edit session:**
> "Tip: Bookmark this version if it's a milestone you might want to return to."

### Progressive Disclosure

| User Need | Feature Introduced |
|-----------|-------------------|
| "Did my work save?" | Auto-save reassurance |
| "I made a mistake" | Checkpoint restore |
| "I want to mark this version" | Bookmarks |
| "I want to try something risky" | Drafts |
| "What did I change?" | Compare view |

---

## Success Metrics

### User Confidence
- Users close the app without worrying about saving
- Users feel safe making big changes

### Feature Adoption
- % of users who view history at least once
- % of users who restore a checkpoint
- % of users who create a bookmark
- % of users who use drafts

### Recovery Effectiveness
- % of crash recovery offers accepted
- Time from crash to recovered state
- User satisfaction after recovery

---

## Summary

| Concept | User Language | User Action |
|---------|---------------|-------------|
| Saving | (invisible) | None needed |
| Version history | "Document History" | View in sidebar/panel |
| Snapshot | "Checkpoint" | Created automatically |
| Named snapshot | "Bookmark" | Click bookmark icon |
| Branch | "Draft" | Start from menu |
| Restore | "Go back to this" | Click restore button |
| Diff | "Compare" | Select two versions |

The goal is for users to feel their work is always safe, without ever having to think about version control.

---

*Document created: 2025-12-12*
