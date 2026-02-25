# Tangent – Threaded Chat for Claude & ChatGPT

**Branch off into side threads without leaving your main conversation.**

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/dhacmfmpmgedcagknopapipcgcfcpaae?style=for-the-badge&logo=google-chrome&label=Chrome%20Web%20Store)](https://chromewebstore.google.com/detail/tangent-%E2%80%93-threaded-chat-f/dhacmfmpmgedcagknopapipcgcfcpaae)

[![Watch the demo](images/demo-thumbnail.jpg)](https://www.youtube.com/watch?v=1BIQE1X34EA)

## The Problem

You're deep into a conversation — Claude just gave you a dense, perfectly-worded breakdown of a complex topic. Or ChatGPT explained something that finally clicked. But now you have a follow-up question.

So you type it. You get a response. You scroll back up. Then another question. More scrolling. The thing you were studying is now buried under twelve messages of back-and-forth, and your flow state is gone.

**Your options today:**
1. Ask the follow-up in the same thread → pollutes your clean conversation
2. Open a new tab → lose context, friction, disjointed experience
3. Just don't ask → lost learning opportunity

## The Solution

Tangent fixes this — on both Claude and ChatGPT.

Select any text in your conversation and open a threaded side panel: a fresh, temporary chat that lives right next to your main conversation. Ask follow-up questions, dig deeper, explore rabbit holes. Your main conversation stays exactly where you left it.

**No scrolling. No context switching. No lost trains of thought.**

## How It Works

1. **Select text** in any Claude or ChatGPT conversation
2. **Click "Open Thread"** on the selection button that appears (or press `Cmd+\` for a blank thread)
3. **A floating panel opens** with a fresh, temporary chat session
4. **Your selected context** is automatically pasted into the new thread for easy reference
5. **Minimize threads to tabs**, expand them later — you'll be scrolled right back to where you branched off

## Features

### Works on both platforms
- **claude.ai** — hijacks Claude's native "Reply" selection button
- **chatgpt.com** — hijacks ChatGPT's native "Ask ChatGPT" selection button

### Built for deep learning sessions
- **Multiple simultaneous threads** — open different threads for different topics
- **Temporary by default** — each thread runs in temporary/incognito mode, no clutter in your sidebar
- **Minimize & restore** — minimize a thread, keep reading, restore it later with a single click
- **Visual scroll-back** — when you re-open a minimized thread, the original text highlights so you instantly reconnect with the context

### Keyboard shortcuts
| Shortcut | Action |
|----------|--------|
| `Cmd+\` | Open a blank thread |
| `Cmd+Shift+T` | Open a thread from current selection |
| `Escape` | Minimize the active thread |

### Lightweight & private
- Runs entirely locally in your browser
- No external network requests beyond loading claude.ai or chatgpt.com in the panel
- No data collection, no analytics, no tracking
- Uses your existing Claude or ChatGPT subscription — no API key needed
- Open source

## Installation

### From Chrome Web Store

[**Install Tangent from the Chrome Web Store**](https://chromewebstore.google.com/detail/tangent-%E2%80%93-threaded-chat-f/dhacmfmpmgedcagknopapipcgcfcpaae)

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the `claude-thread-opener` folder
6. Navigate to [claude.ai](https://claude.ai) or [chatgpt.com](https://chatgpt.com) and start using Tangent

## Why Tangent?

Claude and ChatGPT are incredible for learning complex topics — programming concepts, research papers, technical documentation. But the single-thread chat format forces a painful choice: keep reading or ask a question. Tangent removes that trade-off. Branch off, explore, come back. Your reading flow stays intact.

**Stop scrolling. Start branching.**

## File Structure

```
claude-thread-opener/
├── manifest.json      # Extension configuration (Manifest V3)
├── content.js         # Main logic: selection, button, panel, iframe
├── styles.css         # UI styling
├── rules.json         # declarativeNetRequest rules (strips iframe headers for ChatGPT)
├── icons/             # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── images/            # Screenshots
└── README.md
```

## Configuration

Key settings are at the top of `content.js`:

```javascript
const CONFIG = {
  minSelectionLength: 10,  // Minimum characters to trigger the Open Thread button
  panelWidth: 480,         // Default panel width in pixels
  panelHeight: 600,        // Default panel height in pixels
  panelMargin: 20          // Panel margin from viewport edge
};
```

## Known Limitations

- **Iframe dependency** — The panel loads Claude or ChatGPT in an iframe. Security header changes on either platform may break this (a fallback "open in new tab" button is provided).
- **Auto-paste** — Works in most cases, but may occasionally fail if the page is slow to load. Manual paste (`Cmd+V`) always works as a fallback.
- **Dark mode only** — Currently styled for dark themes.

## Contributing

Issues and PRs welcome. Potential improvements:

- [ ] Lazy unload minimized iframes (memory optimization)
- [ ] Thread history / persistence across sessions
- [ ] Gemini support
- [ ] Customizable keyboard shortcuts

## License

MIT License. See [LICENSE](LICENSE) for details.
