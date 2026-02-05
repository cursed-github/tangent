/**
 * Claude Thread Opener
 * Opens follow-up threads in a floating window without leaving your main conversation
 */

(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  const CONFIG = {
    minSelectionLength: 10,
    buttonOffsetX: 10,
    buttonOffsetY: -40,
    panelWidth: 480,
    panelHeight: 600,
    panelMargin: 20,
    debounceMs: 150
  };

  // ============================================
  // STATE
  // ============================================
  let floatingButton = null;
  let floatingPanel = null;
  let selectedText = '';
  let debounceTimer = null;

  // ============================================
  // FLOATING BUTTON
  // ============================================
  function createFloatingButton() {
    const button = document.createElement('div');
    button.id = 'claude-thread-button';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        <line x1="12" y1="8" x2="12" y2="14"></line>
        <line x1="9" y1="11" x2="15" y2="11"></line>
      </svg>
      <span>Open Thread</span>
    `;
    button.addEventListener('click', handleButtonClick);
    document.body.appendChild(button);
    return button;
  }

  function showFloatingButton(x, y) {
    if (!floatingButton) {
      floatingButton = createFloatingButton();
    }

    // Calculate position with boundary checks
    const buttonRect = { width: 120, height: 36 };
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let posX = x + CONFIG.buttonOffsetX;
    let posY = y + CONFIG.buttonOffsetY;

    // Keep button within viewport
    if (posX + buttonRect.width > viewportWidth - 10) {
      posX = viewportWidth - buttonRect.width - 10;
    }
    if (posX < 10) posX = 10;
    if (posY < 10) posY = 10;
    if (posY + buttonRect.height > viewportHeight - 10) {
      posY = viewportHeight - buttonRect.height - 10;
    }

    floatingButton.style.left = `${posX}px`;
    floatingButton.style.top = `${posY}px`;
    floatingButton.classList.add('visible');
  }

  function hideFloatingButton() {
    if (floatingButton) {
      floatingButton.classList.remove('visible');
    }
  }

  // ============================================
  // FLOATING PANEL WITH IFRAME
  // ============================================
  function createFloatingPanel() {
    const panel = document.createElement('div');
    panel.id = 'claude-thread-panel';
    
    panel.innerHTML = `
      <div class="thread-panel-header">
        <div class="thread-panel-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>Thread</span>
        </div>
        <div class="thread-panel-actions">
          <button class="thread-panel-btn" id="thread-copy-hint" title="Context copied to clipboard">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
            <span class="copy-hint-text">Paste context</span>
          </button>
          <button class="thread-panel-btn thread-panel-close" id="thread-close" title="Close thread">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="thread-panel-body">
        <iframe id="thread-iframe" src="about:blank"></iframe>
        <div class="thread-panel-loading">
          <div class="loading-spinner"></div>
          <span>Loading thread...</span>
        </div>
        <div class="thread-panel-error" style="display: none;">
          <p>Unable to load Claude in iframe.</p>
          <p>This may be due to security restrictions.</p>
          <button id="thread-open-tab">Open in new tab instead</button>
        </div>
      </div>
      <div class="thread-panel-resize-handle"></div>
    `;

    // Event listeners
    panel.querySelector('#thread-close').addEventListener('click', closeFloatingPanel);
    panel.querySelector('#thread-open-tab').addEventListener('click', () => {
      window.open('https://claude.ai/new', '_blank');
      closeFloatingPanel();
    });

    // Make panel draggable via header
    makeDraggable(panel, panel.querySelector('.thread-panel-header'));
    
    // Make panel resizable
    makeResizable(panel, panel.querySelector('.thread-panel-resize-handle'));

    document.body.appendChild(panel);
    return panel;
  }

  function showFloatingPanel(contextText) {
    if (!floatingPanel) {
      floatingPanel = createFloatingPanel();
    }

    const iframe = floatingPanel.querySelector('#thread-iframe');
    const loading = floatingPanel.querySelector('.thread-panel-loading');
    const error = floatingPanel.querySelector('.thread-panel-error');
    
    // Reset state
    loading.style.display = 'flex';
    error.style.display = 'none';
    iframe.style.display = 'none';

    // Position panel on right side of viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    floatingPanel.style.width = `${CONFIG.panelWidth}px`;
    floatingPanel.style.height = `${CONFIG.panelHeight}px`;
    floatingPanel.style.right = `${CONFIG.panelMargin}px`;
    floatingPanel.style.top = `${Math.max(CONFIG.panelMargin, (viewportHeight - CONFIG.panelHeight) / 2)}px`;
    floatingPanel.style.left = 'auto';

    floatingPanel.classList.add('visible');

    // Copy context to clipboard
    copyContextToClipboard(contextText);

    // Load Claude in iframe
    iframe.onload = () => {
      loading.style.display = 'none';
      iframe.style.display = 'block';
    };

    iframe.onerror = () => {
      loading.style.display = 'none';
      error.style.display = 'flex';
    };

    // Set iframe src - try loading Claude
    iframe.src = 'https://claude.ai/new';

    // Fallback: if iframe doesn't load in 5 seconds, show error
    setTimeout(() => {
      if (loading.style.display !== 'none') {
        // Check if iframe loaded by trying to access it
        try {
          // If we can't access the iframe content and it's still loading, likely blocked
          if (!iframe.contentDocument && loading.style.display !== 'none') {
            loading.style.display = 'none';
            error.style.display = 'flex';
          }
        } catch (e) {
          // Cross-origin error means it loaded but we can't access it (which is fine)
          loading.style.display = 'none';
          iframe.style.display = 'block';
        }
      }
    }, 5000);
  }

  function closeFloatingPanel() {
    if (floatingPanel) {
      floatingPanel.classList.remove('visible');
      const iframe = floatingPanel.querySelector('#thread-iframe');
      iframe.src = 'about:blank';
    }
  }

  // ============================================
  // CLIPBOARD
  // ============================================
  function copyContextToClipboard(text) {
    const template = `---
Context from my main thread:
"${text}"
---

`;

    navigator.clipboard.writeText(template).then(() => {
      // Flash the copy hint
      const hint = floatingPanel.querySelector('#thread-copy-hint');
      hint.classList.add('flash');
      setTimeout(() => hint.classList.remove('flash'), 1500);
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
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
  // SELECTION HANDLING
  // ============================================
  function handleSelection(e) {
    clearTimeout(debounceTimer);
    
    debounceTimer = setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (text.length >= CONFIG.minSelectionLength) {
        selectedText = text;
        
        // Get position from mouse event or selection range
        let x = e.clientX;
        let y = e.clientY;
        
        // If we have a range, use its end position for better placement
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          x = rect.right;
          y = rect.top;
        }
        
        showFloatingButton(x, y);
      } else {
        hideFloatingButton();
        selectedText = '';
      }
    }, CONFIG.debounceMs);
  }

  function handleButtonClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (selectedText) {
      showFloatingPanel(selectedText);
      hideFloatingButton();
    }
  }

  function handleClickOutside(e) {
    // Hide button if clicking outside of it and not on a selection
    if (floatingButton && 
        !floatingButton.contains(e.target) && 
        !floatingPanel?.contains(e.target)) {
      const selection = window.getSelection();
      if (!selection.toString().trim()) {
        hideFloatingButton();
      }
    }
  }

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
    
    // Escape to close panel
    if (e.key === 'Escape' && floatingPanel?.classList.contains('visible')) {
      closeFloatingPanel();
    }
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  function init() {
    // Don't initialize if we're inside an iframe (the thread panel)
    if (window.self !== window.top) return;
    
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
    
    console.log('Claude Thread Opener initialized');
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
