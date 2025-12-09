// ============================================
// SKOOL ENHANCER - CONTENT SCRIPT
// ============================================

(function() {
  'use strict';
  
  // Prevent multiple injections
  if (window.skoolEnhancerLoaded) return;
  window.skoolEnhancerLoaded = true;
  
  console.log('🎓 Skool Enhancer loaded');
  
  // ============================================
  // CONFIGURATION
  // ============================================
  
  const CONFIG = {
    DRAFT_SAVE_INTERVAL: 5000,  // Save every 5 seconds
    DRAFT_MAX_COUNT: 20,        // Maximum drafts to keep
    SELECTORS: {
      // These selectors may need updating based on Skool's actual DOM
      postInput: '[data-testid="post-input"], .post-composer textarea, [contenteditable="true"]',
      commentInput: '[data-testid="comment-input"], .comment-input textarea',
      posts: '[data-testid="post"], .post-card, article',
      postTitle: '.post-title, h2, h3',
      postAuthor: '.post-author, .author-name',
      communityName: '.community-name, [data-testid="community-name"]'
    }
  };
  
  // ============================================
  // STATE
  // ============================================
  
  let settings = {
    darkMode: false,
    autoSave: true
  };
  
  let draftSaveTimer = null;
  let lastSavedContent = '';
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  async function initialize() {
    // Load settings
    await loadSettings();
    
    // Apply dark mode if enabled
    if (settings.darkMode) {
      enableDarkMode();
    }
    
    // Setup features
    setupAutoSave();
    setupBookmarkButtons();
    observeDOMChanges();
    
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener(handleMessage);
  }
  
  async function loadSettings() {
    const stored = await chrome.storage.sync.get({
      darkMode: false,
      autoSave: true
    });
    settings = stored;
  }
  
  // ============================================
  // MESSAGE HANDLER
  // ============================================
  
  function handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'SETTING_CHANGED':
        settings[message.setting] = message.value;
        
        if (message.setting === 'darkMode') {
          if (message.value) {
            enableDarkMode();
          } else {
            disableDarkMode();
          }
        }
        break;
      
      case 'SHOW_NOTIFICATION':
        showNotification(message.message, message.notificationType);
        break;
    }
    sendResponse({ success: true });
  }
  
  // ============================================
  // DARK MODE
  // ============================================
  
  function enableDarkMode() {
    document.documentElement.classList.add('skool-enhancer-dark');
    injectDarkModeStyles();
  }
  
  function disableDarkMode() {
    document.documentElement.classList.remove('skool-enhancer-dark');
  }
  
  function injectDarkModeStyles() {
    if (document.getElementById('skool-enhancer-dark-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'skool-enhancer-dark-styles';
    style.textContent = `
      .skool-enhancer-dark {
        filter: invert(0.9) hue-rotate(180deg);
      }
      
      .skool-enhancer-dark img,
      .skool-enhancer-dark video,
      .skool-enhancer-dark iframe,
      .skool-enhancer-dark [style*="background-image"] {
        filter: invert(1) hue-rotate(180deg);
      }
      
      .skool-enhancer-dark .skool-enhancer-bookmark-btn {
        filter: invert(1) hue-rotate(180deg);
      }
    `;
    document.head.appendChild(style);
  }
  
  // ============================================
  // AUTO-SAVE DRAFTS
  // ============================================
  
  function setupAutoSave() {
    // Watch for input events
    document.addEventListener('input', handleInputChange, true);
    document.addEventListener('keyup', handleInputChange, true);
  }
  
  function handleInputChange(event) {
    if (!settings.autoSave) return;
    
    const target = event.target;
    
    // Check if it's a text input we care about
    if (!isTextInput(target)) return;
    
    const content = getInputContent(target);
    
    // Don't save empty or unchanged content
    if (!content.trim() || content === lastSavedContent) return;
    
    // Debounce the save
    clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      saveDraft(content);
    }, CONFIG.DRAFT_SAVE_INTERVAL);
  }
  
  function isTextInput(element) {
    // Check if element is a text input area
    if (element.tagName === 'TEXTAREA') return true;
    if (element.tagName === 'INPUT' && element.type === 'text') return true;
    if (element.contentEditable === 'true') return true;
    if (element.matches && element.matches(CONFIG.SELECTORS.postInput)) return true;
    if (element.matches && element.matches(CONFIG.SELECTORS.commentInput)) return true;
    return false;
  }
  
  function getInputContent(element) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return element.value;
    }
    return element.textContent || element.innerText || '';
  }
  
  async function saveDraft(content) {
    const communityName = getCommunityName();
    
    const draft = {
      content: content,
      community: communityName,
      url: window.location.href,
      savedAt: new Date().toISOString()
    };
    
    // Get existing drafts
    const { drafts = [] } = await chrome.storage.local.get('drafts');
    
    // Check for duplicate content
    const duplicateIndex = drafts.findIndex(d => d.content === content);
    if (duplicateIndex !== -1) {
      // Update timestamp of existing draft
      drafts[duplicateIndex].savedAt = draft.savedAt;
    } else {
      // Add new draft
      drafts.unshift(draft);
    }
    
    // Keep only recent drafts
    const trimmedDrafts = drafts.slice(0, CONFIG.DRAFT_MAX_COUNT);
    
    await chrome.storage.local.set({ drafts: trimmedDrafts });
    lastSavedContent = content;
    
    // Show save indicator
    showSaveIndicator();
    
    console.log('📝 Draft auto-saved');
  }
  
  function showSaveIndicator() {
    // Remove existing indicator
    const existing = document.getElementById('skool-enhancer-save-indicator');
    if (existing) existing.remove();
    
    // Create indicator
    const indicator = document.createElement('div');
    indicator.id = 'skool-enhancer-save-indicator';
    indicator.innerHTML = '💾 Draft saved';
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999999;
      animation: skoolFadeIn 0.3s ease;
    `;
    
    document.body.appendChild(indicator);
    
    // Remove after 2 seconds
    setTimeout(() => {
      indicator.style.animation = 'skoolFadeOut 0.3s ease';
      setTimeout(() => indicator.remove(), 300);
    }, 2000);
  }
  
  // ============================================
  // BOOKMARK FEATURE
  // ============================================
  
  function setupBookmarkButtons() {
    // Initial setup
    addBookmarkButtonsToPosts();
  }
  
  function addBookmarkButtonsToPosts() {
    const posts = document.querySelectorAll(CONFIG.SELECTORS.posts);
    
    posts.forEach(post => {
      if (post.dataset.skoolEnhancerProcessed) return;
      post.dataset.skoolEnhancerProcessed = 'true';
      
      addBookmarkButton(post);
    });
  }
  
  function addBookmarkButton(postElement) {
    // Find a suitable place to add the button
    const actionBar = postElement.querySelector('.post-actions, .action-bar, footer');
    
    if (!actionBar) {
      // Create our own action container if none exists
      const container = document.createElement('div');
      container.className = 'skool-enhancer-actions';
      container.style.cssText = `
        display: flex;
        justify-content: flex-end;
        padding: 8px;
        border-top: 1px solid #eee;
      `;
      postElement.appendChild(container);
    }
    
    const targetContainer = postElement.querySelector('.skool-enhancer-actions, .post-actions, footer') || postElement;
    
    // Create bookmark button
    const bookmarkBtn = document.createElement('button');
    bookmarkBtn.className = 'skool-enhancer-bookmark-btn';
    bookmarkBtn.innerHTML = '🔖';
    bookmarkBtn.title = 'Bookmark this post';
    bookmarkBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s;
      opacity: 0.6;
    `;
    
    bookmarkBtn.addEventListener('mouseenter', () => {
      bookmarkBtn.style.opacity = '1';
      bookmarkBtn.style.transform = 'scale(1.1)';
    });
    
    bookmarkBtn.addEventListener('mouseleave', () => {
      bookmarkBtn.style.opacity = '0.6';
      bookmarkBtn.style.transform = 'scale(1)';
    });
    
    bookmarkBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await bookmarkPost(postElement, bookmarkBtn);
    });
    
    targetContainer.appendChild(bookmarkBtn);
  }
  
  async function bookmarkPost(postElement, button) {
    const title = getPostTitle(postElement);
    const author = getPostAuthor(postElement);
    const url = getPostUrl(postElement);
    const community = getCommunityName();
    
    const bookmark = {
      title: title || 'Untitled Post',
      author: author || 'Unknown',
      url: url,
      community: community,
      savedAt: new Date().toISOString()
    };
    
    // Get existing bookmarks
    const { bookmarks = [] } = await chrome.storage.local.get('bookmarks');
    
    // Check for duplicate
    const isDuplicate = bookmarks.some(b => b.url === bookmark.url);
    
    if (isDuplicate) {
      showNotification('Already bookmarked!', 'warning');
      return;
    }
    
    // Add new bookmark
    bookmarks.unshift(bookmark);
    await chrome.storage.local.set({ bookmarks });
    
    // Update button appearance
    button.innerHTML = '✅';
    button.style.opacity = '1';
    
    showNotification('Post bookmarked!', 'success');
    
    console.log('🔖 Post bookmarked:', bookmark);
  }
  
  function getPostTitle(postElement) {
    const titleEl = postElement.querySelector(CONFIG.SELECTORS.postTitle);
    if (titleEl) return titleEl.textContent.trim();
    
    // Fallback: first significant text
    const text = postElement.textContent.trim();
    return text.substring(0, 100);
  }
  
  function getPostAuthor(postElement) {
    const authorEl = postElement.querySelector(CONFIG.SELECTORS.postAuthor);
    return authorEl ? authorEl.textContent.trim() : null;
  }
  
  function getPostUrl(postElement) {
    // Look for link to individual post
    const link = postElement.querySelector('a[href*="/post/"], a[href*="/posts/"]');
    if (link) return link.href;
    
    // Fallback to current URL
    return window.location.href;
  }
  
  function getCommunityName() {
    // Try to find community name in page
    const communityEl = document.querySelector(CONFIG.SELECTORS.communityName);
    if (communityEl) return communityEl.textContent.trim();
    
    // Extract from URL
    const match = window.location.pathname.match(/\/c\/([^\/]+)/);
    if (match) return match[1];
    
    return 'Unknown Community';
  }
  
  // ============================================
  // DOM OBSERVER
  // ============================================
  
  function observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldCheckPosts = false;
      
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          shouldCheckPosts = true;
        }
      });
      
      if (shouldCheckPosts) {
        // Debounce
        clearTimeout(window.skoolEnhancerObserverTimer);
        window.skoolEnhancerObserverTimer = setTimeout(() => {
          addBookmarkButtonsToPosts();
        }, 500);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // ============================================
  // NOTIFICATION HELPER
  // ============================================
  
  function showNotification(message, type = 'info') {
    // Remove existing
    const existing = document.getElementById('skool-enhancer-notification');
    if (existing) existing.remove();
    
    const colors = {
      success: '#4CAF50',
      warning: '#FF9800',
      error: '#F44336',
      info: '#2196F3'
    };
    
    const notification = document.createElement('div');
    notification.id = 'skool-enhancer-notification';
    notification.innerHTML = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999999;
      animation: skoolFadeIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'skoolFadeOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 2500);
  }
  
  // ============================================
  // INJECT ANIMATION STYLES
  // ============================================
  
  function injectAnimationStyles() {
    if (document.getElementById('skool-enhancer-animations')) return;
    
    const style = document.createElement('style');
    style.id = 'skool-enhancer-animations';
    style.textContent = `
      @keyframes skoolFadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes skoolFadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // ============================================
  // START
  // ============================================
  
  injectAnimationStyles();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
})();
