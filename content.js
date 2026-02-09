/**
 * Tangent – Threaded Chat for Claude
 * Branch off into side threads without leaving your main conversation
 */

(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  const CONFIG = {
    minSelectionLength: 10,
    panelWidth: 480,
    panelHeight: 600,
    panelMargin: 20
  };

  // ============================================
  // STATE
  // ============================================
  let selectedText = '';

  // Scroll origin state (captured at selection time)
  let selectionScrollTop = 0;
  let selectionRangeRect = null;

  // Multi-panel state
  let panelCounter = 0;
  const panels = new Map(); // panelId -> { element, minimized, contextSnippet }
  let minimizedTabBar = null;

  // ============================================
  // REPLY BUTTON HIJACK
  // ============================================
  function setupReplyButtonHijack() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;

          // Check if the added node IS the tooltip or CONTAINS it
          const tooltip = node.matches?.('[data-selection-tooltip="true"]')
            ? node
            : node.querySelector?.('[data-selection-tooltip="true"]');

          if (tooltip) {
            hijackReplyButton(tooltip);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function hijackReplyButton(tooltip) {
    const button = tooltip.querySelector('button');
    if (!button || button.dataset.tangentHijacked) return;

    // Don't hijack if any expanded panel exists
    for (const [, panelData] of panels) {
      if (!panelData.minimized) return;
    }

    // Get current selection
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text.length < CONFIG.minSelectionLength) return;

    // Capture selection state
    selectedText = text;
    if (selection.rangeCount > 0) {
      const scrollContainer = getScrollContainer();
      selectionScrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
      selectionRangeRect = selection.getRangeAt(0).getBoundingClientRect();
    }

    // Mark as hijacked
    button.dataset.tangentHijacked = 'true';

    // Replace button content with our branch icon + "Open Thread"
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="7" cy="4" r="2.5" fill="currentColor" stroke="none"/>
        <line x1="7" y1="6.5" x2="7" y2="17.5"/>
        <circle cx="7" cy="20" r="2.5" fill="currentColor" stroke="none"/>
        <path d="M7,12 C7,12 7,15 11,15 L17,15 L17,17.5"/>
        <circle cx="17" cy="20" r="2.5" fill="currentColor" stroke="none"/>
      </svg>
      Open Thread
    `;

    // Style the tooltip container with our amber theme
    const container = tooltip.querySelector('div');
    if (container) {
      container.style.cssText = `
        background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
        border: none;
      `;
    }

    // Override click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (selectedText) {
        showFloatingPanel(selectedText);
      }
    }, { capture: true });
  }

  // ============================================
  // MINIMIZED TAB BAR
  // ============================================
  function createMinimizedTabBar() {
    const tabBar = document.createElement('div');
    tabBar.id = 'claude-thread-tabbar';
    tabBar.className = 'thread-tabbar';
    document.body.appendChild(tabBar);
    return tabBar;
  }

  function getOrCreateTabBar() {
    if (!minimizedTabBar) {
      minimizedTabBar = createMinimizedTabBar();
    }
    return minimizedTabBar;
  }

  function createMinimizedTab(panelId, contextSnippet) {
    const tab = document.createElement('div');
    tab.className = 'thread-tab';
    tab.dataset.panelId = panelId;

    // Truncate context for display
    const displayText = contextSnippet.length > 30
      ? contextSnippet.substring(0, 30) + '...'
      : contextSnippet;

    tab.innerHTML = `
      <div class="thread-tab-content">
        <svg class="thread-branch-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="7" cy="4" r="2.5" fill="#d97706" stroke="none"/>
          <line x1="7" y1="6.5" x2="7" y2="17.5"/>
          <circle cx="7" cy="20" r="2.5" fill="#d97706" stroke="none"/>
          <path d="M7,12 C7,12 7,15 11,15 L17,15 L17,17.5"/>
          <circle cx="17" cy="20" r="2.5" fill="#d97706" stroke="none"/>
        </svg>
        <span class="thread-tab-text" title="${contextSnippet}">${displayText}</span>
      </div>
      <button class="thread-tab-close" title="Close thread">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    // Click tab to expand
    tab.querySelector('.thread-tab-content').addEventListener('click', () => {
      expandPanel(panelId);
    });

    // Close button
    tab.querySelector('.thread-tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closePanel(panelId);
    });

    return tab;
  }

  function updateTabBar() {
    const tabBar = getOrCreateTabBar();
    tabBar.innerHTML = '';

    for (const [panelId, panelData] of panels) {
      if (panelData.minimized) {
        const tab = createMinimizedTab(panelId, panelData.contextSnippet);
        tabBar.appendChild(tab);
      }
    }

    // Show/hide tabbar based on whether there are minimized tabs
    const hasMinimizedTabs = Array.from(panels.values()).some(p => p.minimized);
    tabBar.classList.toggle('visible', hasMinimizedTabs);
  }

  // ============================================
  // FLOATING PANEL WITH IFRAME
  // ============================================
  function createFloatingPanel(panelId, contextSnippet, fullContextText) {
    const panel = document.createElement('div');
    panel.className = 'claude-thread-panel';
    panel.dataset.panelId = panelId;

    panel.innerHTML = `
      <div class="thread-panel-header">
        <div class="thread-panel-title">
          <div class="thread-orbit-active">
            <div class="orbit-dot orbit-dot-1"></div>
            <div class="orbit-dot orbit-dot-2"></div>
          </div>
          <span>Thread ${panelId}</span>
        </div>
        <div class="thread-panel-actions">
          <button class="thread-panel-btn thread-copy-hint" title="Context copied to clipboard">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
            <span class="copy-hint-text">Paste context</span>
          </button>
          <button class="thread-panel-btn thread-panel-minimize" title="Minimize thread">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button class="thread-panel-btn thread-panel-close" title="Close thread">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="thread-panel-body">
        <iframe class="thread-iframe" src="about:blank"></iframe>
        <div class="thread-panel-loading">
          <div class="loading-spinner"></div>
          <span>Loading thread...</span>
        </div>
        <div class="thread-panel-error" style="display: none;">
          <p>Unable to load Claude in iframe.</p>
          <p>This may be due to security restrictions.</p>
          <button class="thread-open-tab">Open in new tab instead</button>
        </div>
      </div>
      <div class="thread-panel-resize-handle"></div>
    `;

    // Event listeners
    panel.querySelector('.thread-panel-close').addEventListener('click', () => closePanel(panelId));
    panel.querySelector('.thread-panel-minimize').addEventListener('click', () => minimizePanel(panelId));
    panel.querySelector('.thread-open-tab').addEventListener('click', () => {
      window.open('https://claude.ai/new', '_blank');
      closePanel(panelId);
    });

    // Copy button - re-copy context to clipboard
    panel.querySelector('.thread-copy-hint').addEventListener('click', () => {
      copyContextToClipboard(fullContextText, panel);
    });

    // Make panel draggable via header
    makeDraggable(panel, panel.querySelector('.thread-panel-header'));

    // Make panel resizable
    makeResizable(panel, panel.querySelector('.thread-panel-resize-handle'));

    document.body.appendChild(panel);
    return panel;
  }

  function showFloatingPanel(contextText) {
    // Create new panel
    panelCounter++;
    const panelId = panelCounter;
    const isBlank = !contextText;
    const contextSnippet = isBlank ? 'Blank thread' : contextText.substring(0, 100);

    const panel = createFloatingPanel(panelId, contextSnippet, contextText);

    // Store panel data (including scroll origin for sticky threads)
    panels.set(panelId, {
      element: panel,
      minimized: false,
      contextSnippet: contextSnippet,
      fullContext: contextText,
      originScrollTop: isBlank ? 0 : selectionScrollTop,
      originSelectedText: contextText
    });

    const iframe = panel.querySelector('.thread-iframe');
    const loading = panel.querySelector('.thread-panel-loading');
    const error = panel.querySelector('.thread-panel-error');

    // Reset state
    loading.style.display = 'flex';
    error.style.display = 'none';
    iframe.style.display = 'none';

    // Position panel on right side of viewport
    const viewportHeight = window.innerHeight;

    panel.style.width = `${CONFIG.panelWidth}px`;
    panel.style.height = `${CONFIG.panelHeight}px`;
    panel.style.right = `${CONFIG.panelMargin}px`;
    panel.style.top = `${Math.max(CONFIG.panelMargin, (viewportHeight - CONFIG.panelHeight) / 2)}px`;
    panel.style.left = 'auto';

    panel.classList.add('visible');

    // Clear selection (also dismisses Claude's tooltip)
    window.getSelection().removeAllRanges();

    // Copy context to clipboard (skip for blank threads)
    if (!isBlank) {
      copyContextToClipboard(contextText, panel);
    }

    // Load Claude in iframe
    iframe.onload = () => {
      loading.style.display = 'none';
      iframe.style.display = 'block';
    };

    iframe.onerror = () => {
      loading.style.display = 'none';
      error.style.display = 'flex';
    };

    // Store context in sessionStorage for the iframe to read (skip for blank threads)
    if (!isBlank) {
      const contextKey = `claude-thread-opener-context-${panelId}`;
      sessionStorage.setItem(contextKey, contextText);
    }

    // Set iframe src with incognito param and panel ID in hash
    iframe.src = `https://claude.ai/new?incognito=true#thread-opener-${panelId}`;

    // Fallback: if iframe doesn't load in 5 seconds, show error
    setTimeout(() => {
      if (loading.style.display !== 'none') {
        try {
          if (!iframe.contentDocument && loading.style.display !== 'none') {
            loading.style.display = 'none';
            error.style.display = 'flex';
          }
        } catch (e) {
          loading.style.display = 'none';
          iframe.style.display = 'block';
        }
      }
    }, 5000);

    return panelId;
  }

  function minimizePanel(panelId) {
    const panelData = panels.get(panelId);
    if (!panelData) return;

    panelData.minimized = true;
    panelData.element.classList.remove('visible');

    updateTabBar();
  }

  function expandPanel(panelId) {
    const panelData = panels.get(panelId);
    if (!panelData) return;

    panelData.minimized = false;
    panelData.element.classList.add('visible');

    updateTabBar();

    // Scroll to origin and highlight the selected text
    scrollToOriginAndHighlight(panelData);
  }

  function scrollToOriginAndHighlight(panelData) {
    const scrollContainer = getScrollContainer();
    if (!scrollContainer) return;

    // Smooth-scroll to the saved origin scroll position (offset a bit to center)
    const offset = scrollContainer.clientHeight / 3;
    const targetScroll = Math.max(0, panelData.originScrollTop - offset);
    scrollContainer.scrollTo({ top: targetScroll, behavior: 'smooth' });

    // After scroll settles, find and highlight the text
    setTimeout(() => {
      highlightTextInDOM(panelData.originSelectedText);
    }, 350);
  }

  function highlightTextInDOM(text) {
    if (!text) return;

    const highlights = [];
    const blockSelectors = 'p, li, pre, blockquote, h1, h2, h3, h4, h5, h6, div';

    // Split into paragraphs/lines, filter out short fragments (citation labels etc.)
    const lines = text.split(/\n+/).filter(line => line.trim().length > 30);

    // Single forward-moving walker prevents matching earlier paragraphs
    // that happen to share text (e.g. duplicate citation labels)
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    for (const line of lines) {
      const searchStr = line.trim().substring(0, 50);

      while (walker.nextNode()) {
        const node = walker.currentNode;
        // Skip nodes inside our extension's UI
        if (node.parentElement && node.parentElement.closest &&
            (node.parentElement.closest('.claude-thread-panel') ||
             node.parentElement.closest('#claude-thread-button') ||
             node.parentElement.closest('.thread-tabbar'))) {
          continue;
        }
        if (node.textContent.indexOf(searchStr) !== -1) {
          // Walk up to the nearest block-level parent
          const block = node.parentElement.closest(blockSelectors);
          if (block && !block.classList.contains('thread-highlight-flash')) {
            block.classList.add('thread-highlight-flash');
            highlights.push(block);
          }
          break;
        }
      }
    }

    if (highlights.length === 0) return;

    // Scroll the first highlighted block into view
    highlights[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Fade out and clean up
    setTimeout(() => {
      highlights.forEach(el => el.classList.add('fade-out'));
    }, 800);

    setTimeout(() => {
      highlights.forEach(el => {
        el.classList.remove('thread-highlight-flash', 'fade-out');
      });
    }, 2000);
  }

  function closePanel(panelId) {
    const panelData = panels.get(panelId);
    if (!panelData) return;

    // Clean up iframe
    const iframe = panelData.element.querySelector('.thread-iframe');
    iframe.src = 'about:blank';

    // Clean up sessionStorage (in case context wasn't consumed)
    const contextKey = `claude-thread-opener-context-${panelId}`;
    sessionStorage.removeItem(contextKey);

    // Remove from DOM
    panelData.element.remove();

    // Remove from state
    panels.delete(panelId);

    updateTabBar();
  }

  function closeAllPanels() {
    for (const [panelId] of panels) {
      closePanel(panelId);
    }
  }

  // ============================================
  // CLIPBOARD
  // ============================================
  function copyContextToClipboard(text, panel) {
    const template = `---
Context from my main thread:
"${text}"
---

`;

    navigator.clipboard.writeText(template).then(() => {
      // Flash the copy hint
      const hint = panel.querySelector('.thread-copy-hint');
      if (hint) {
        hint.classList.add('flash');
        setTimeout(() => hint.classList.remove('flash'), 1500);
      }
    }).catch(() => {
      // Silently ignore — clipboard API fails when document lacks focus (e.g. extension reload)
    });
  }

  // ============================================
  // DRAG & RESIZE
  // ============================================
  function makeDraggable(element, handle) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('.thread-panel-btn')) return; // Don't drag when clicking buttons
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = element.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      
      element.classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      element.style.left = `${initialX + dx}px`;
      element.style.top = `${initialY + dy}px`;
      element.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.classList.remove('dragging');
      }
    });
  }

  function makeResizable(element, handle) {
    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = element.offsetWidth;
      startHeight = element.offsetHeight;
      
      element.classList.add('resizing');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      const newWidth = Math.max(320, startWidth + (e.clientX - startX));
      const newHeight = Math.max(400, startHeight + (e.clientY - startY));
      
      element.style.width = `${newWidth}px`;
      element.style.height = `${newHeight}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        element.classList.remove('resizing');
      }
    });
  }

  // ============================================
  // SCROLL CONTAINER
  // ============================================
  function getScrollContainer() {
    // Try Claude's main scrollable element
    const scrollEl = document.querySelector('[class*="scroll"]');
    if (scrollEl && scrollEl.scrollHeight > scrollEl.clientHeight) {
      return scrollEl;
    }
    // Walk up from the current selection to find nearest scrollable ancestor
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      let node = selection.getRangeAt(0).commonAncestorContainer;
      while (node && node !== document.body) {
        if (node.nodeType === 1) {
          const style = window.getComputedStyle(node);
          const overflowY = style.overflowY;
          if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
            return node;
          }
        }
        node = node.parentNode;
      }
    }
    return document.scrollingElement || document.documentElement;
  }

  // ============================================
  // SELECTION HANDLING
  // ============================================
  // Note: Selection state is now primarily captured in hijackReplyButton()
  // when Claude's native tooltip appears. This handler serves as a backup
  // for keyboard shortcuts (Cmd+Shift+T) which don't trigger the tooltip.

  // ============================================
  // KEYBOARD SHORTCUT
  // ============================================
  function handleKeydown(e) {
    // Cmd/Ctrl + Shift + T to open thread
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 't') {
      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (text.length >= CONFIG.minSelectionLength) {
        e.preventDefault();
        selectedText = text;
        showFloatingPanel(selectedText);
      }
    }

    // Cmd+\ to open a blank thread
    if (e.key === '\\' && e.metaKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      showFloatingPanel('');
    }

    // Escape to minimize the most recently opened visible panel
    if (e.key === 'Escape') {
      // Find visible (non-minimized) panels and minimize the last one
      let lastVisiblePanelId = null;
      for (const [panelId, panelData] of panels) {
        if (!panelData.minimized) {
          lastVisiblePanelId = panelId;
        }
      }
      if (lastVisiblePanelId !== null) {
        minimizePanel(lastVisiblePanelId);
      }
    }
  }

  // ============================================
  // AUTO-PASTE CONTEXT (for iframe)
  // ============================================
  function autoPasteContext() {
    // Check if we're in a thread-opener iframe by looking at the URL hash
    const hash = window.location.hash;
    const match = hash.match(/^#thread-opener-(\d+)$/);

    if (!match) {
      console.log('Tangent: No context hash found, skipping auto-paste');
      return;
    }

    const panelId = match[1];
    const contextKey = `claude-thread-opener-context-${panelId}`;
    const contextText = sessionStorage.getItem(contextKey);

    if (!contextText) {
      console.log('Tangent: No context found in sessionStorage');
      return;
    }

    // Clear the stored context to prevent reuse
    sessionStorage.removeItem(contextKey);

    console.log('Tangent: Found context, will auto-paste');

    // Format the context
    const formattedContext = `---\nContext from my main thread:\n"${contextText}"\n---\n\n`;

    let hasInserted = false;
    let observer = null;
    const timeoutMs = 10000;

    function findAndFillInput() {
      if (hasInserted) return true;

      // Strategy 1: Find by data-testid (most reliable for Claude)
      let inputElement = document.querySelector('[data-testid="chat-input"]');

      // Strategy 2: Find TipTap/ProseMirror editor
      if (!inputElement) {
        inputElement = document.querySelector('.tiptap.ProseMirror[contenteditable="true"]');
      }

      // Strategy 3: Find any ProseMirror editor
      if (!inputElement) {
        inputElement = document.querySelector('.ProseMirror[contenteditable="true"]');
      }

      // Strategy 4: Find contenteditable with aria-label
      if (!inputElement) {
        inputElement = document.querySelector('[contenteditable="true"][aria-label*="prompt"]');
      }

      if (inputElement) {
        console.log('Tangent: Found input element', inputElement.className);

        try {
          // Focus the editor first
          inputElement.focus();

          // Clear existing content - for TipTap/ProseMirror, we need to clear the inner paragraph
          const existingParagraph = inputElement.querySelector('p');
          if (existingParagraph) {
            existingParagraph.innerHTML = '';
          } else {
            inputElement.innerHTML = '<p></p>';
          }

          // Get the paragraph to insert into
          const targetP = inputElement.querySelector('p') || inputElement;

          // Create a text node with our content
          const textNode = document.createTextNode(formattedContext);
          targetP.appendChild(textNode);

          // Remove empty classes if present
          targetP.classList.remove('is-empty', 'is-editor-empty');

          // Dispatch input event to notify TipTap/React of the change
          inputElement.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: formattedContext
          }));

          // Also try a generic input event
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));

          // Move cursor to end
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(targetP);
          range.collapse(false); // collapse to end
          selection.removeAllRanges();
          selection.addRange(range);

          hasInserted = true;
          if (observer) {
            observer.disconnect();
            observer = null;
          }

          console.log('Tangent: Auto-pasted context successfully');
          return true;

        } catch (err) {
          console.error('Tangent: Error inserting text', err);
        }
      }

      return false;
    }

    // Try immediately
    if (findAndFillInput()) {
      return;
    }

    // Use MutationObserver to wait for input to appear
    observer = new MutationObserver(() => {
      findAndFillInput();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Safety timeout
    setTimeout(() => {
      if (!hasInserted) {
        console.log('Tangent: Timeout waiting for input element');
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      }
    }, timeoutMs);

    console.log('Tangent: Watching for input element...');
  }

  // ============================================
  // TEMPORARY CHAT AUTO-ENABLE (for iframe)
  // ============================================
  function enableTemporaryChat() {
    console.log('Tangent: Setting up temporary chat auto-enable');

    let hasEnabled = false;
    let observer = null;
    const timeoutMs = 10000; // 10 second max wait

    function findAndClickIncognitoButton() {
      if (hasEnabled) return true;

      // Strategy 1: Find the fixed top-right container with the incognito button
      let toggleContainer = null;
      let toggleButton = null;

      const fixedContainers = document.querySelectorAll('div.fixed.right-3');
      for (const container of fixedContainers) {
        const stateWrapper = container.querySelector('[data-state]');
        if (stateWrapper) {
          toggleContainer = stateWrapper;
          toggleButton = stateWrapper.querySelector('button');
          break;
        }
      }

      // Strategy 2: Find any div with data-state containing a button with ghost icon
      if (!toggleButton) {
        const stateWrappers = document.querySelectorAll('[data-state]');
        for (const wrapper of stateWrappers) {
          const btn = wrapper.querySelector('button');
          if (btn) {
            const svg = btn.querySelector('svg');
            if (svg && svg.innerHTML.includes('look-around')) {
              toggleContainer = wrapper;
              toggleButton = btn;
              break;
            }
          }
        }
      }

      if (toggleButton && toggleContainer) {
        const currentState = toggleContainer.getAttribute('data-state');

        if (currentState === 'closed') {
          toggleButton.click();
          console.log('Tangent: Enabled temporary chat');
        } else {
          console.log('Tangent: Temporary chat already enabled (state:', currentState, ')');
        }

        hasEnabled = true;
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        return true;
      }

      return false;
    }

    // Try immediately in case DOM is already ready
    if (findAndClickIncognitoButton()) {
      return;
    }

    // Use MutationObserver to watch for the button to appear
    observer = new MutationObserver(() => {
      findAndClickIncognitoButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Safety timeout - stop observing after max wait time
    setTimeout(() => {
      if (!hasEnabled) {
        console.log('Tangent: Timeout waiting for incognito button');
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      }
    }, timeoutMs);

    console.log('Tangent: Watching for incognito button...');
  }

  // ============================================
  // ENTER TO SEND FIX (for iframe)
  // ============================================
  function fixEnterToSend() {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;

      // Only act when focus is inside the chat input
      const active = document.activeElement;
      if (!active || !active.closest('[contenteditable="true"], textarea')) return;

      // Find the send button
      const sendBtn =
        document.querySelector('button[aria-label="Send Message"]') ||
        document.querySelector('button[aria-label*="Send"]') ||
        document.querySelector('button[data-testid="send-button"]') ||
        document.querySelector('fieldset button[type="button"]:last-of-type');

      if (sendBtn && !sendBtn.disabled) {
        e.preventDefault();
        e.stopPropagation();
        sendBtn.click();
      }
    }, { capture: true });

    console.log('Tangent: Enter-to-send fix installed');
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  function init() {
    // If we're inside an iframe (the thread panel), handle iframe-specific features
    if (window.self !== window.top) {
      console.log('Tangent: Running inside iframe');

      // Incognito toggle: relying on ?incognito=true URL param instead
      // enableTemporaryChat();

      // Auto-paste the context from the parent page
      autoPasteContext();

      // Fix Enter key to send message (iframe may not bind Enter→submit properly)
      fixEnterToSend();

      return;
    }

    // Hijack Claude's native Reply button with our Open Thread button
    setupReplyButtonHijack();

    document.addEventListener('keydown', handleKeydown);

    console.log('Tangent initialized');
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
