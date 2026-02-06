# Model Summary - Claude Thread Opener

This file tracks decisions, discussions, and context for future sessions.

---

## Session 1: 2026-02-05

### Project Overview
Chrome extension that lets users select text in Claude.ai conversations and open a floating side panel with a fresh Claude chat, preserving the main thread while exploring tangents.

### Current State
- Version: `2026-02-06.v4` (latest)
- Git repo with 4 commits, 4 tags
- Core files: `manifest.json`, `content.js`, `styles.css`, `model-summary.md`, icons, README, LICENSE

### Version History
| Tag | Description |
|-----|-------------|
| `2026-02-05.1` | Initial release - basic thread opener |
| `2026-02-05.2` | Multi-panel, minimize/expand, auto-paste context |
| `2026-02-06.v3` | Sticky threads: auto-scroll + yellow highlight on expand |
| `2026-02-06.v4` | Fix incognito: use URL param, disable conflicting toggle function |

### Known Issues (Current)
1. ~~**Incognito toggle fails** on later threads~~ — **FIXED in v4** (was caused by `enableTemporaryChat()` racing with `?incognito=true` URL param)
2. **Auto-paste fails** on later threads — only when previous thread was left unused (no chat sent). Works fine when every thread is chatted in.

### Root Cause (Both Issues)
All iframes share same-origin localStorage. When a thread goes unused, Claude saves draft/state to localStorage. The next thread loads, reads that stale state, and it interferes with both:
- **Auto-paste**: Claude's draft restoration overwrites the injected text
- **Incognito toggle**: Claude's persisted preference/state fights the programmatic click

When each thread is used (chatted in), Claude clears/updates localStorage normally, so subsequent threads work fine.

### Attempted Solutions (Session 1)

#### URL Param `?incognito=true`
- **Session 1 result**: Appeared to not work in iframe context
- **Session 3 result**: WORKS — the actual problem was `enableTemporaryChat()` running alongside and toggling it back off. The two approaches were racing each other.
- **Fix**: Use `?incognito=true` in iframe src, comment out `enableTemporaryChat()`

#### Hybrid Verify+Retry for Incognito
- **Result**: Made things WORSE - caused page refresh and flicker wars
- Reverted to simple click-once approach

### What Works (Current Stable)
- Multi-panel: YES
- Minimize/expand: YES
- Incognito toggle: YES (via URL param, works reliably including unchatted threads)
- Sticky threads (scroll + highlight on expand): YES
- Auto-paste: YES (breaks only when previous thread left unused)
- Clipboard copy: YES (manual paste always works as fallback)

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
- Incognito toggle: YES (breaks only when previous thread left unused)
- Clipboard copy: YES (manual paste always works)
- Auto-paste: YES (breaks only when previous thread left unused)

**Root cause (confirmed — applies to BOTH incognito toggle and auto-paste):**
- When user doesn't engage with a thread (no chat), Claude saves draft/state to localStorage
- Next thread loads → Claude reads stale localStorage → overwrites auto-paste AND fights incognito toggle
- Normal flow (user chats in each thread) = no issue, both features work fine

### Session 3 Notes (2026-02-06)

#### Sticky Threads: Auto-scroll + Yellow Highlight on Expand

**Request**: When a user minimizes a thread and later clicks the tab to re-expand it, scroll back to the original selection and flash-highlight it yellow so the user reconnects with the context.

**Implementation** (in `content.js` and `styles.css`):

New state variables:
- `selectionScrollTop` — scroll container's scrollTop at selection time
- `selectionRangeRect` — bounding rect of the selection range

New functions:
- `getScrollContainer()` — finds Claude's main scrollable element by checking `[class*="scroll"]`, walking up from selection for scrollable ancestors, falling back to `document.scrollingElement`
- `scrollToOriginAndHighlight(panelData)` — smooth-scrolls to saved origin, then calls highlight after 350ms
- `highlightTextInDOM(text)` — splits text into lines, uses a forward-moving TreeWalker to find matching text nodes, applies highlight class to containing block elements (`<p>`, `<li>`, etc.)

Panel data changes:
- `originScrollTop` and `originSelectedText` stored per panel in `showFloatingPanel()`

`expandPanel()` updated to call `scrollToOriginAndHighlight()`.

CSS:
- `.thread-highlight-flash` — yellow background (`rgba(250, 204, 21, 0.4)`) with 1s ease-out transition
- `.thread-highlight-flash.fade-out` — transitions to transparent

**Iterations & bugs fixed:**
1. **Initial version**: Wrapped text nodes in `<span>` — only highlighted first 60 chars, broke on multi-paragraph selections
2. **Multi-paragraph fix**: Split text by newlines, highlighted each line separately — worked for plain text but failed on paragraphs with inline citation elements (`<a>`, `<span>`) that split text nodes
3. **Block-level highlighting**: Changed to apply class directly to parent `<p>` element instead of wrapping text nodes — handles inline elements naturally, consistent behavior for full/partial selections
4. **Duplicate citation bug**: Each line created a new TreeWalker from `document.body`, so citation labels ("National Weather Service") appearing in multiple paragraphs would match the wrong paragraph first. Fixed by using a single forward-moving TreeWalker + filtering out short lines (< 30 chars) that are likely citation labels

**Status**: Implemented and working.

**Design decision**: Highlighting the full parent `<p>` even for partial selections. Trade-off is slight over-highlighting, but it's consistent, robust against inline elements, and cleanup is trivial (classList.remove vs DOM restructuring).

---

#### Fix Incognito Toggle: URL Param Instead of Programmatic Click

**Problem**: Incognito toggle failed on unchatted threads. Session 1 blamed `?incognito=true` not working in iframes, but the real issue was `enableTemporaryChat()` racing against the URL param.

**Root cause**: Both approaches ran simultaneously. The URL param set incognito on, then `enableTemporaryChat()` detected `data-state="closed"` (before UI caught up) and clicked the toggle — turning it back off. The two were fighting each other, causing flicker on unchatted threads.

**Fix**:
- Changed iframe src from `claude.ai/new#thread-opener-{id}` to `claude.ai/new?incognito=true#thread-opener-{id}`
- Commented out `enableTemporaryChat()` call in `init()`
- `enableTemporaryChat()` function left in code but unused (can be removed later)

**Key learning**: The Session 1 conclusion that "URL param doesn't work in iframes" was wrong. It worked all along — the programmatic toggle was undoing it.

**Status**: Fixed and working reliably, including unchatted threads.

---

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

**Known issue**: Incognito toggle fails when the previous thread was left unused (no chat sent). Same localStorage root cause as auto-paste — Claude's persisted state fights the programmatic click. Works reliably when each thread is chatted in.

**Root cause**: Claude stores state in localStorage, shared across all iframes. When a thread goes unused, stale state persists and interferes with the next thread's toggle.

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
- [x] Scroll-to-origin + highlight on expand (sticky threads)
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
