# Claude Thread Opener

**Open follow-up threads in a floating window without leaving your main Claude conversation.**

A Chrome extension that solves the "tangent problem" in AI conversations: when you want to explore a follow-up question but don't want to derail your main thread or pollute it with nested explorations.

## The Problem

When learning or working with Claude, you often encounter moments where:
- You want to dive deeper into something Claude mentioned
- You have a tangential question that doesn't belong in the main thread
- You want to preserve your clean, focused conversation for future reference

Currently, your options are:
1. Ask the follow-up in the same thread (pollutes the conversation)
2. Open a new tab and lose context (friction + disjointed experience)
3. Just... don't ask (lost learning opportunity)

## The Solution

Select any text in your Claude conversation → Click the floating "Open Thread" button → A panel slides in with a fresh Claude chat, context already copied to your clipboard.

Explore the tangent. Close the panel. Your main thread remains pristine.

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `claude-thread-opener` folder

### From Chrome Web Store

*(Coming soon)*

## Usage

1. **Navigate to [claude.ai](https://claude.ai)**
2. **Select any text** in your conversation (minimum 10 characters)
3. **Click the floating button** that appears near your selection
   - Or use keyboard shortcut: `Cmd/Ctrl + Shift + T`
4. **A panel opens** on the right side with a fresh Claude chat
5. **Paste** (`Cmd/Ctrl + V`) to include the context, then type your follow-up question
6. **Close the panel** when done (click X or press `Escape`)

### Features

- **Floating panel**: Stays in-page, draggable, resizable
- **Context copying**: Selected text is automatically formatted and copied to clipboard
- **Keyboard shortcut**: `Cmd/Ctrl + Shift + T` for power users
- **Clean exit**: `Escape` to close, or click the X button
- **Your session**: Uses your existing Claude subscription (no API key needed)

## Technical Notes

### How It Works

The extension injects a content script into claude.ai that:
1. Listens for text selection events
2. Shows a floating button near the selection
3. On click, creates a floating panel with an iframe pointing to `claude.ai/new`
4. Copies formatted context to clipboard

### Limitations

- **Same-origin iframe**: The panel loads Claude in an iframe. If Anthropic changes their security headers (`X-Frame-Options`), this may break. A fallback "open in new tab" option is provided.
- **Session isolation**: The iframe shares your login session, but conversations in the panel are separate threads.
- **Clipboard bridge**: We can't programmatically paste into the iframe due to browser security, so users must paste manually.

### Why Not Use the API?

This extension uses your existing Claude subscription rather than the API because:
1. No additional cost
2. No API key management
3. Same experience you're used to
4. Works for users without API access

## File Structure

```
claude-thread-opener/
├── manifest.json      # Extension configuration
├── content.js         # Main logic: selection, button, panel
├── styles.css         # UI styling
├── icons/             # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Development

### Making Changes

1. Edit files in the extension directory
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Reload any claude.ai tabs

### Customization

Key configuration is at the top of `content.js`:

```javascript
const CONFIG = {
  minSelectionLength: 10,    // Minimum characters to trigger button
  buttonOffsetX: 10,         // Button position offset from selection
  buttonOffsetY: -40,
  panelWidth: 480,           // Default panel dimensions
  panelHeight: 600,
  panelMargin: 20,           // Panel margin from viewport edge
  debounceMs: 150            // Selection debounce time
};
```

## Privacy

This extension:
- ✅ Runs entirely locally in your browser
- ✅ Makes no external network requests (except loading claude.ai in the iframe)
- ✅ Stores no data
- ✅ Has no analytics or tracking
- ✅ Is open source

## License

MIT License. See [LICENSE](LICENSE) for details.

## Contributing

Issues and PRs welcome. This is a proof-of-concept that could be expanded with:
- [ ] Dedicated "threads" conversation that accumulates all tangent chats
- [ ] History of opened threads
- [ ] Firefox support
- [ ] Customizable keyboard shortcuts
- [ ] Light mode support

---

Built as a proof-of-concept for improving AI conversation UX.
