# Model Summary - Claude Thread Opener

This file tracks decisions, discussions, and context for future sessions.

---

## Session 1: 2026-02-05

### Project Overview
Chrome extension that lets users select text in Claude.ai conversations and open a floating side panel with a fresh Claude chat, preserving the main thread while exploring tangents.

### Current State
- Version: `2026-02-05.2` (commit `b3729ff`)
- Git repo with 2 commits, 2 tags
- Core files: `manifest.json`, `content.js`, `styles.css`, `model-summary.md`, icons, README, LICENSE

### Version History
| Tag | Description |
|-----|-------------|
| `2026-02-05.1` | Initial release - basic thread opener |
| `2026-02-05.2` | Multi-panel, minimize/expand, auto-paste context |

### Known Issues (Current)
1. **Incognito toggle fails ~10%** on later threads - localStorage race condition with Claude's React state
2. **Old draft text appears** in new threads - Claude's shared localStorage draft persistence
3. **Auto-paste may not work reliably** - works on 2nd/3rd try, needs retry logic

### Root Cause (Both Issues)
All iframes share same-origin localStorage. Claude stores drafts and preferences there. When we close a thread, localStorage persists. New threads read stale state.

### Attempted Solutions (Session 1)

#### URL Param `?incognito=true`
- **Result**: Does NOT work in iframe context
- Works fine in regular Chrome tab, but iframe ignores it
- Claude probably only reads this param on initial page load, not embedded iframes

#### Hybrid Verify+Retry for Incognito
- **Result**: Made things WORSE - caused page refresh and flicker wars
- Reverted to simple click-once approach

### What Works (Current Stable)
- Multi-panel: YES
- Minimize/expand: YES
- Incognito button click: ~90%
- Auto-paste: Partial (may need 2-3 tries)

### Session 2 Notes (2026-02-06)

**Attempted fix: Smart wait-then-paste**
- Idea: Check if input is empty (fast path) vs has old draft (slow path with delay)
- Result: Did NOT work
- The approach of detecting empty vs non-empty and delaying didn't help

**Key learnings:**
- `?incognito=true` URL param works in regular tabs but NOT in iframes
- Auto-paste code runs but doesn't reliably insert text
- The issue may be deeper - Claude's TipTap editor state management
- Current auto-paste: finds element, clears it, inserts text, dispatches events - but something's not sticking

**What IS working (stable in 2026-02-05.2):**
- Multi-panel: YES
- Minimize/expand tabs: YES
- Incognito button click: ~90%
- Clipboard copy: YES (manual paste works)
- Auto-paste: WORKS on fresh threads, BREAKS only when previous thread was left unused (Claude's localStorage draft interferes)

**Root cause (confirmed):**
- When user doesn't engage with a thread (no chat), Claude saves draft to localStorage
- Next thread loads → Claude reads old draft from localStorage → overwrites our auto-paste
- Normal flow (user chats in each thread) = no issue, auto-paste works fine

### Next Session TODO
1. Try different approach: Use clipboard API + simulate Cmd+V keypress
2. Or: Use execCommand('insertText') instead of DOM manipulation
3. Investigate what events TipTap actually needs
4. Consider giving up on auto-paste, keep manual clipboard as fallback
5. Add configurable max threads limit

### Implemented This Session

#### Auto-Enable Temporary Chat in Thread Panel

**Request**: When opening a new thread, automatically enable Claude's "Temporary" chat toggle (top-right button).

**Implementation** (in `content.js`):
- Added `enableTemporaryChat()` function
- Content script detects when running inside iframe (`window.self !== window.top`)
- Instead of exiting early, it now calls `enableTemporaryChat()`
- Function searches for the temporary chat toggle using multiple strategies:
  - `aria-label` attributes containing "temporary"
  - `data-testid` attributes
  - Buttons with "temporary" in text content
  - Switches/checkboxes near "temporary" labels
- Retries up to 50 times (5 seconds) to handle React's async rendering
- Clicks toggle only if not already enabled
- Logs result to console for debugging

**Status**: Implemented and working.

**Note**: If Claude changes their UI, selectors may need updating. Current selectors look for `div.fixed.right-3` container with `[data-state]` wrapper.

---

#### Multi-Panel Support with Minimize/Expand

**Request**: Support multiple simultaneous threads, each minimizable, allowing user to scroll main chat and switch between threads.

**Implementation** (in `content.js` and `styles.css`):

State changes:
- Replaced single `floatingPanel` with `panels` Map (panelId -> {element, minimized, contextSnippet})
- Added `panelCounter` for unique panel IDs
- Added `minimizedTabBar` element

New functions:
- `createMinimizedTabBar()` - creates the vertical tab bar container
- `createMinimizedTab(panelId, contextSnippet)` - creates a single tab with text preview and close button
- `updateTabBar()` - refreshes tab bar to show all minimized panels
- `minimizePanel(panelId)` - hides panel, adds to tab bar
- `expandPanel(panelId)` - shows panel, removes from tab bar
- `closePanel(panelId)` - destroys panel and cleans up state

UI changes:
- Added minimize button (horizontal line icon) to panel header
- Minimize button has blue hover state
- Minimized tabs stack vertically on right side of screen
- Tabs show truncated context (first 30 chars)
- Click tab content to expand, X button to close
- Tabs slide left slightly on hover

Keyboard changes:
- Escape now minimizes the most recent visible panel (instead of closing)

**Status**: Implemented and working.

---

#### Incognito Toggle (MutationObserver - Stable)

**Implementation**: Simple MutationObserver approach
1. Watch for incognito button to appear in DOM
2. When found, click once if state is "closed"
3. 10 second timeout safety

**Known issue**: ~10% of later threads may not enable incognito due to race condition with Claude's React state. Hybrid verify+retry approach was attempted but caused worse issues (page refresh, flicker wars).

**Root cause theory**: Claude stores state in localStorage, shared across all iframes. When we click, Claude's state sync fights back. Proper fix would involve clearing/setting localStorage directly.

**Status**: Stable but imperfect. localStorage investigation deferred to future.

**Future improvement**: Investigate Claude's localStorage keys and pre-set incognito preference before iframe loads.

---

#### Auto-Paste Context into New Thread

**Request**: Automatically paste the selected context text into the new thread's input field.

**Implementation**:

Data passing (parent → iframe):
- Parent stores context in `sessionStorage` with key `claude-thread-opener-context-{panelId}`
- Iframe URL includes hash: `claude.ai/new#thread-opener-{panelId}`
- Iframe content script reads hash, retrieves context from sessionStorage
- Context is cleared from sessionStorage after reading (one-time use)

Finding Claude's input:
- Strategy 1: `.ProseMirror[contenteditable="true"]`
- Strategy 2: `[contenteditable="true"][data-placeholder]`
- Strategy 3: Any large contenteditable div (width > 200, height > 40)
- Strategy 4: Textarea fallback

Inserting text:
- Clear existing content
- Use `document.execCommand('insertText')` for React compatibility
- Dispatch `InputEvent` with `inputType: 'insertText'`
- Move cursor to end

Uses MutationObserver to wait for input element to appear.

**Status**: Implemented. Needs testing.

### Open Questions Discussed

#### 1. Auto-Paste into New Chat (Currently Manual)

**Problem**: Users must manually paste context into the new thread. Extension copies to clipboard but can't auto-paste.

**Why it fails**:
- Iframe runs in separate execution context
- Clipboard API requires user gesture for read/paste
- `document.execCommand('paste')` deprecated and blocked cross-frame
- Claude's input is React-controlled (contenteditable div), not simple textarea

**Potential solutions**:
- Inject a content script inside the iframe
- Use `postMessage` to communicate between parent and iframe scripts
- Iframe script directly manipulates Claude's input element
- May need to dispatch `InputEvent` to trigger React state updates
- Requires reverse-engineering Claude's input component

**Status**: Not implemented. Needs investigation of Claude's input element structure.

---

#### 2. Minimize Panel to Small Tab

**Request**: Option to minimize the floating window to a small button/tab that stays in the main chat.

**Proposed behavior**:
- Minimize button (alongside close button)
- Panel collapses to small pill/chip showing "Thread 1" or context preview
- Docks to right edge of viewport
- Click to expand back to full panel

**Status**: Not implemented. Straightforward UI change.

---

#### 3. Multiple Floating Threads

**Request**: Support multiple simultaneous threads, each minimizable, allowing user to scroll main chat and switch between threads.

**Proposed behavior**:
- Each "Open Thread" creates a new panel instance
- Multiple panels can exist simultaneously
- Minimized threads stack as tabs along viewport edge
- Click any tab to bring thread to focus/expand
- State management needed to track all panel instances

**Considerations**:
- Memory usage with multiple iframes
- UI for managing many threads (limit? scroll?)
- Z-index management for stacking

**Status**: Not implemented. Requires refactoring from single-panel to multi-panel architecture.

---

### Architecture Notes

Current `content.js` structure (to be refactored for multi-panel):
- Single panel instance
- `CONFIG` object at top with dimensions, offsets, debounce settings
- Selection listener shows floating button
- Button click creates panel with iframe to `claude.ai/new`

Future architecture considerations:
- Panel manager class to track instances
- Each panel needs unique ID
- Minimize state per panel
- Tab bar component for minimized panels

---

### Versioning Scheme
Format: `YYYY-MM-DD.X` where X increments for same-day releases.
- `2026-02-05.1` - Initial release

---

---

#### 4. Sticky Minimized Button Anchored to Text

**Request**: Minimized thread button should stay anchored to the original selected text, scrolling with content rather than fixed to viewport.

**Approach**:
- When thread opens, "mark" the text location in DOM
- Store anchor reference: element path, text offset, surrounding text for fuzzy matching
- Render indicator absolutely positioned relative to text container
- Scrolls naturally with content

**Challenges**:
- Text selection is ephemeral (disappears on click elsewhere)
- Claude may use virtualized rendering (elements destroyed/recreated on scroll)
- Need robust re-anchoring strategy

**Status**: Not implemented. Needs DOM investigation.

---

#### 5. Persistence Options

**Request**: What happens to threads on page refresh or reopen?

**Storage options**:

| Method | Behavior |
|--------|----------|
| Memory only | Lost on navigation (current) |
| `sessionStorage` | Tab session only, auto-clears on close |
| `localStorage` | Persists until manually cleared |
| `chrome.storage.local` | Extension-managed, can sync across devices |

**Proposed modes**:
1. **Temp/Incognito mode** (default): Use `sessionStorage`, threads gone when tab closes. Simple, no cleanup.
2. **Persistent mode** (opt-in): Use `chrome.storage.local`, restore threads on page load.

**Data to store**:
- Thread URL (the claude.ai/chat/xxx in iframe)
- Original selected text (for label + re-anchoring)
- Timestamp
- Anchor position info
- Minimized/expanded state

**Status**: Not implemented. Temp mode is simpler starting point.

---

#### 6. Highlight-as-Bookmark / Annotation Layer (Big Feature)

**Request**: Let users persistently highlight text in Claude conversations. Clicking a highlight opens the associated thread/chat, scrolled to relevant position.

**Vision**: Transform extension into a **Claude reading annotation layer** (similar to Hypothesis, Liner, Medium highlights).

**User flow**:
1. Select text → choose "Open Thread" OR "Save Highlight"
2. Highlights persist across sessions (stored in `chrome.storage`)
3. On page load, highlights rendered as colored overlays on original text
4. Click highlight → opens associated Claude chat, auto-scrolls to context

**Technical approach**:
- **Text-based anchoring**: Store surrounding text (prefix + suffix) rather than DOM path
- On page load, search for text matches and render overlays
- Store: conversation ID, highlight text, surrounding context, linked thread URL, scroll position

**Challenges**:
- Claude's DOM structure may change between sessions
- Conversation content is dynamic (new messages shift positions)
- Need fuzzy matching for anchor text
- Scroll position in linked thread may also shift

**Potential solutions**:
- Use text fingerprinting (hash of surrounding ~50 chars)
- Store message ID if accessible in DOM
- Accept some highlights may become "orphaned" and offer cleanup UI

**Status**: Not implemented. Significant feature expansion - could be Phase 2.

---

### Feature Tiers (Proposed Roadmap)

**Tier 1 - Core (Complete)**
- [x] Select text → floating button → side panel with new chat
- [x] Manual paste context
- [x] Auto-enable temporary chat in thread panel

**Tier 2 - Multi-Thread UX (In Progress)**
- [x] Multiple simultaneous panels
- [x] Minimize to tab
- [x] Tab bar for minimized threads
- [x] Auto-paste context into new thread
- [ ] Configurable max threads limit (prevent memory issues)
- [ ] Temp session storage (sessionStorage)

**Tier 3 - Persistence & Anchoring**
- [ ] Sticky indicators anchored to original text
- [ ] Persistent storage across sessions (chrome.storage)
- [ ] Restore threads on page load

**Tier 4 - Annotation Layer**
- [ ] Highlight-only option (no thread, just bookmark)
- [ ] Highlight overlays rendered on page
- [ ] Click highlight → open linked conversation
- [ ] Highlight management UI

---

### Architecture Notes

Current `content.js` structure (to be refactored for multi-panel):
- Single panel instance
- `CONFIG` object at top with dimensions, offsets, debounce settings
- Selection listener shows floating button
- Button click creates panel with iframe to `claude.ai/new`

Future architecture considerations:
- Panel manager class to track instances
- Each panel needs unique ID
- Minimize state per panel
- Tab bar component for minimized panels
- Storage abstraction layer (sessionStorage vs chrome.storage)
- Anchor/highlight renderer module

---

### Versioning Scheme
Format: `YYYY-MM-DD.X` where X increments for same-day releases.
- `2026-02-05.1` - Initial release

---

### Next Steps (Pending Implementation)
1. Investigate Claude's input element for auto-paste feasibility
2. Investigate Claude's DOM structure for anchoring feasibility
3. Design minimize/expand UI
4. Refactor to support multiple panels
5. Implement tab bar for minimized threads
6. Add sessionStorage for temp persistence
7. (Phase 2) Persistent highlights with chrome.storage
