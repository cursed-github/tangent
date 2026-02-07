# Model Summary - Tangent (formerly Claude Thread Opener)

This file tracks decisions, discussions, and context for future sessions.

---

## Session 1: 2026-02-05

### Project Overview
Chrome extension that lets users select text in Claude.ai conversations and open a floating side panel with a fresh Claude chat, preserving the main thread while exploring tangents.

### Current State
- Name: **Tangent – Threaded Chat for Claude**
- Version: `2026-02-07.v6` (latest)
- Git repo with 7 commits, 7 tags
- Core files: `manifest.json`, `content.js`, `styles.css`, `model-summary.md`, icons, README, LICENSE

### Version History
| Tag | Description |
|-----|-------------|
| `2026-02-05.1` | Initial release - basic thread opener |
| `2026-02-05.2` | Multi-panel, minimize/expand, auto-paste context |
| `2026-02-06.v3` | Sticky threads: auto-scroll + yellow highlight on expand |
| `2026-02-06.v4` | Fix incognito: use URL param, disable conflicting toggle function |
| `2026-02-06.v5` | Branch fork icon, orbiting dots, enter-to-send fix |
| `2026-02-07.v6` | Rebrand to Tangent, Cmd+\ blank thread, polished icons |

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
- Enter-to-send in iframe: YES
- Cmd+\ blank thread shortcut: YES
- Text deselection on thread open: YES

### Session 2 Notes (2026-02-06)

**Attempted fix: Smart wait-then-paste**
- Idea: Check if input is empty (fast path) vs has old draft (slow path with delay)
- Result: Did NOT work
- The approach of detecting empty vs non-empty and delaying didn't help

**Key learnings:**
- `?incognito=true` URL param works in regular tabs but NOT in iframes (WRONG — corrected in Session 3)
- Auto-paste code runs but doesn't reliably insert text
- The issue may be deeper - Claude's TipTap editor state management

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

---

#### Fix Incognito Toggle: URL Param Instead of Programmatic Click

**Problem**: Incognito toggle failed on unchatted threads. Session 1 blamed `?incognito=true` not working in iframes, but the real issue was `enableTemporaryChat()` racing against the URL param.

**Root cause**: Both approaches ran simultaneously. The URL param set incognito on, then `enableTemporaryChat()` detected `data-state="closed"` (before UI caught up) and clicked the toggle — turning it back off.

**Fix**:
- Changed iframe src to `claude.ai/new?incognito=true#thread-opener-{id}`
- Commented out `enableTemporaryChat()` call in `init()`

**Key learning**: The Session 1 conclusion that "URL param doesn't work in iframes" was wrong. It worked all along — the programmatic toggle was undoing it.

**Status**: Fixed and working reliably.

---

### Session 4 Notes (2026-02-07)

#### Visual Identity: Mascot → Abstract Icons → Branch Fork

**Journey through panel header/tab icons:**
1. **Dog at desk** — anthropomorphic dog studying at laptop. Too small at 20px, looked like a blob.
2. **Walking cat** — VSCode Pets-style cat with leg animations. Legs were stiff sticks, looked like a mouse.
3. **Cat licking paws** — stationary cat. Still unrecognizable at small size.
4. **Orbiting amber dots** — two glowing dots orbiting each other. Clean at any size. Adopted for **active panel header**.
5. **Branch fork icon** — git-style branch (vertical line, 3 dots, one branch). Adopted for **floating button** and **minimized tabs**.

**Key insight**: At 20px, recognizable animal shapes are nearly impossible with SVG primitives. Abstract/geometric icons scale much better.

#### Icon Design (Final)

**Active panel header**: Two orbiting amber dots (`7px`, `#d97706` with glow shadow, 3s ease-in-out animation)

**Floating button + Minimized tabs**: Git-branch fork icon
- Vertical line with dot at top and bottom
- Branch from midpoint going right then down to third dot
- `r="2.5"` dots, `stroke-width="2"` for readability at small size
- Floating button: `currentColor` (white on amber)
- Minimized tab: `#d97706` amber with CSS `drop-shadow` glow

**Extension icon**: Same branch fork on `#1a1a1a` dark background, generated as 16/48/128px PNGs

#### Enter-to-Send Fix (Iframe)

**Problem**: Pressing Enter in iframe thread created a newline instead of sending the message.

**Fix**: Added `fixEnterToSend()` — capture-phase keydown listener that intercepts Enter (without modifiers), finds the send button via multiple selectors, and clicks it.

**Selectors tried in order:**
1. `button[aria-label="Send Message"]`
2. `button[aria-label*="Send"]`
3. `button[data-testid="send-button"]`
4. `fieldset button[type="button"]:last-of-type`

**Status**: Working.

#### Cmd+\ Blank Thread Shortcut

**Shortcut chosen**: `Cmd+\` — backslash = split/fork metaphor, used in VS Code for split editor, not taken by Chrome or Claude.

**Implementation**: Keydown handler in `handleKeydown()` checks for `metaKey + '\'`, calls `showFloatingPanel('')` with empty context.

**Blank thread behavior**:
- No clipboard copy
- No sessionStorage context storage
- Minimized tab shows "Blank thread" label
- `originScrollTop` set to 0 (no scroll-to-origin on expand)

#### Text Deselection on Thread Open

Added `window.getSelection().removeAllRanges()` in `showFloatingPanel()` so text selection clears and the floating "Open Thread" button disappears when a thread opens.

#### Clipboard Error Silencing

`navigator.clipboard.writeText()` throws `DOMException` when document lacks focus (e.g. during extension reload). Changed `.catch()` to silently ignore instead of `console.error`.

#### Rebrand to Tangent

**Name**: Tangent – Threaded Chat for Claude
**Rationale**: Platform-agnostic name that describes the UX metaphor (branching off on a tangent). Can expand to "Threaded Chat for AI" when adding ChatGPT/Gemini support.

**Updated in**: `manifest.json` (name + description), `content.js` (file header + console logs), `styles.css` (file header)

**Future multi-platform plan**: Core architecture (floating panel, iframe, minimize/expand, shortcuts) is platform-agnostic. Per-platform adapters needed for: URL patterns, DOM selectors, incognito/temp chat mechanism, `manifest.json` content script matches.

#### Resource Management Discussion

Each iframe is a full Claude tab (~100-200MB RAM). On close:
1. `iframe.src = 'about:blank'` — tears down the page, closes WebSockets
2. `.remove()` — detaches from DOM for GC
3. `panels.delete()` — clears JS reference
4. `sessionStorage.removeItem()` — cleans up context data

**Not yet implemented**: Max concurrent panel limit, lazy unload of minimized iframes.

---

### Next Session TODO
1. Add configurable max threads limit
2. Consider lazy unloading minimized iframes (set to `about:blank` on minimize, reload on expand)
3. Try different auto-paste approach: Use clipboard API + simulate Cmd+V keypress
4. Or: Use execCommand('insertText') instead of DOM manipulation
5. Clean up dead code (`enableTemporaryChat()` still in file but commented out)
6. Multi-platform adapter architecture for ChatGPT/Gemini

---

### Feature Tiers (Proposed Roadmap)

**Tier 1 - Core (Complete)**
- [x] Select text → floating button → side panel with new chat
- [x] Manual paste context
- [x] Auto-enable temporary chat in thread panel
- [x] Enter-to-send in iframe
- [x] Cmd+\ blank thread shortcut

**Tier 2 - Multi-Thread UX (Complete)**
- [x] Multiple simultaneous panels
- [x] Minimize to tab
- [x] Tab bar for minimized threads
- [x] Auto-paste context into new thread
- [x] Scroll-to-origin + highlight on expand (sticky threads)
- [x] Text deselection on thread open
- [ ] Configurable max threads limit (prevent memory issues)
- [ ] Lazy unload minimized iframes

**Tier 3 - Visual Identity (Complete)**
- [x] Orbiting amber dots for active panel header
- [x] Branch fork icon for button + minimized tabs (glowing orange)
- [x] Extension icons (16/48/128px)
- [x] Rebrand to Tangent

**Tier 4 - Multi-Platform**
- [ ] Adapter architecture for platform-specific code
- [ ] ChatGPT support
- [ ] Gemini support

**Tier 5 - Persistence & Anchoring**
- [ ] Persistent storage across sessions (chrome.storage)
- [ ] Restore threads on page load

**Tier 6 - Annotation Layer**
- [ ] Highlight-only option (no thread, just bookmark)
- [ ] Highlight overlays rendered on page
- [ ] Click highlight → open linked conversation
- [ ] Highlight management UI

---

### Architecture Notes

Current `content.js` structure:
- `CONFIG` object at top with dimensions, offsets, debounce settings
- `panels` Map tracking all panel instances (panelId → {element, minimized, contextSnippet, fullContext, originScrollTop, originSelectedText})
- Selection listener shows floating button
- Button click / Cmd+\ creates panel with iframe to `claude.ai/new?incognito=true`
- Iframe content script handles auto-paste, enter-to-send
- `enableTemporaryChat()` exists but commented out (URL param handles incognito)

Data flow (parent → iframe):
- `sessionStorage` with key `claude-thread-opener-context-{panelId}`
- URL hash: `claude.ai/new?incognito=true#thread-opener-{panelId}`
- Iframe reads hash → retrieves context → clears sessionStorage

---

### Versioning Scheme
Format: `YYYY-MM-DD.vX` where X increments for same-day releases.
