// ============================================
// SKOOL ENHANCER - BACKGROUND SERVICE WORKER
// ============================================

// ============================================
// INSTALLATION & UPDATE HANDLERS
// ============================================

chrome.runtime.onInstalled.addListener((details) => {
  console.log('🎓 Skool Enhancer installed/updated');
  
  if (details.reason === 'install') {
    // First time installation
    handleFirstInstall();
  } else if (details.reason === 'update') {
    // Extension updated
    handleUpdate(details.previousVersion);
  }
});

async function handleFirstInstall() {
  // Set default settings
  await chrome.storage.sync.set({
    darkMode: false,
    autoSave: true,
    showNotifications: true,
    draftSaveInterval: 5000,
    maxDrafts: 20,
    maxBookmarks: 100
  });
  
  // Initialize local storage
  await chrome.storage.local.set({
    bookmarks: [],
    drafts: [],
    stats: {
      installDate: new Date().toISOString(),
      draftsCreated: 0,
      bookmarksCreated: 0,
      draftsSaved: 0
    }
  });
  
  // Open welcome page (optional)
  // chrome.tabs.create({ url: 'https://yourwebsite.com/welcome' });
  
  console.log('✅ First install setup complete');
}

async function handleUpdate(previousVersion) {
  console.log(`📦 Updated from version ${previousVersion}`);
  
  // Migration logic if needed
  // Example: migrate data structure between versions
}

// ============================================
// MESSAGE HANDLERS
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(response => sendResponse(response))
    .catch(error => sendResponse({ error: error.message }));
  
  // Return true to indicate async response
  return true;
});

async function handleMessage(message, sender) {
  switch (message.type) {
    
    case 'GET_SETTINGS':
      return await getSettings();
    
    case 'SAVE_SETTINGS':
      return await saveSettings(message.settings);
    
    case 'ADD_BOOKMARK':
      return await addBookmark(message.bookmark);
    
    case 'REMOVE_BOOKMARK':
      return await removeBookmark(message.url);
    
    case 'GET_BOOKMARKS':
      return await getBookmarks();
    
    case 'SAVE_DRAFT':
      return await saveDraft(message.draft);
    
    case 'GET_DRAFTS':
      return await getDrafts();
    
    case 'DELETE_DRAFT':
      return await deleteDraft(message.index);
    
    case 'CLEAR_DRAFTS':
      return await clearDrafts();
    
    case 'GET_STATS':
      return await getStats();
    
    case 'UPDATE_STATS':
      return await updateStats(message.statKey, message.value);
    
    case 'EXPORT_DATA':
      return await exportAllData();
    
    case 'IMPORT_DATA':
      return await importData(message.data);
    
    default:
      console.warn('Unknown message type:', message.type);
      return { error: 'Unknown message type' };
  }
}

// ============================================
// SETTINGS FUNCTIONS
// ============================================

async function getSettings() {
  const defaults = {
    darkMode: false,
    autoSave: true,
    showNotifications: true,
    draftSaveInterval: 5000,
    maxDrafts: 20,
    maxBookmarks: 100
  };
  
  const settings = await chrome.storage.sync.get(defaults);
  return { success: true, settings };
}

async function saveSettings(newSettings) {
  await chrome.storage.sync.set(newSettings);
  
  // Notify all Skool tabs of settings change
  const tabs = await chrome.tabs.query({ url: '*://*.skool.com/*' });
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, {
      type: 'SETTINGS_UPDATED',
      settings: newSettings
    }).catch(() => {
      // Tab might not have content script loaded
    });
  });
  
  return { success: true };
}

// ============================================
// BOOKMARK FUNCTIONS
// ============================================

async function getBookmarks() {
  const { bookmarks = [] } = await chrome.storage.local.get('bookmarks');
  return { success: true, bookmarks };
}

async function addBookmark(bookmark) {
  const { bookmarks = [] } = await chrome.storage.local.get('bookmarks');
  const { maxBookmarks = 100 } = await chrome.storage.sync.get('maxBookmarks');
  
  // Check for duplicate
  const exists = bookmarks.some(b => b.url === bookmark.url);
  if (exists) {
    return { success: false, error: 'Bookmark already exists' };
  }
  
  // Add new bookmark at the beginning
  bookmarks.unshift({
    ...bookmark,
    id: generateId(),
    savedAt: new Date().toISOString()
  });
  
  // Trim to max bookmarks
  const trimmed = bookmarks.slice(0, maxBookmarks);
  
  await chrome.storage.local.set({ bookmarks: trimmed });
  await updateStats('bookmarksCreated', 1);
  
  return { success: true, bookmark: trimmed[0] };
}

async function removeBookmark(url) {
  const { bookmarks = [] } = await chrome.storage.local.get('bookmarks');
  
  const filtered = bookmarks.filter(b => b.url !== url);
  
  if (filtered.length === bookmarks.length) {
    return { success: false, error: 'Bookmark not found' };
  }
  
  await chrome.storage.local.set({ bookmarks: filtered });
  
  return { success: true };
}

// ============================================
// DRAFT FUNCTIONS
// ============================================

async function getDrafts() {
  const { drafts = [] } = await chrome.storage.local.get('drafts');
  return { success: true, drafts };
}

async function saveDraft(draft) {
  const { drafts = [] } = await chrome.storage.local.get('drafts');
  const { maxDrafts = 20 } = await chrome.storage.sync.get('maxDrafts');
  
  // Check if this draft already exists (by content)
  const existingIndex = drafts.findIndex(d => d.content === draft.content);
  
  if (existingIndex !== -1) {
    // Update existing draft timestamp
    drafts[existingIndex].savedAt = new Date().toISOString();
    drafts[existingIndex].url = draft.url;
  } else {
    // Add new draft
    drafts.unshift({
      ...draft,
      id: generateId(),
      savedAt: new Date().toISOString()
    });
  }
  
  // Trim to max drafts
  const trimmed = drafts.slice(0, maxDrafts);
  
  await chrome.storage.local.set({ drafts: trimmed });
  await updateStats('draftsSaved', 1);
  
  return { success: true };
}

async function deleteDraft(index) {
  const { drafts = [] } = await chrome.storage.local.get('drafts');
  
  if (index < 0 || index >= drafts.length) {
    return { success: false, error: 'Invalid draft index' };
  }
  
  drafts.splice(index, 1);
  await chrome.storage.local.set({ drafts });
  
  return { success: true };
}

async function clearDrafts() {
  await chrome.storage.local.set({ drafts: [] });
  return { success: true };
}

// ============================================
// STATISTICS FUNCTIONS
// ============================================

async function getStats() {
  const { stats = {} } = await chrome.storage.local.get('stats');
  return { success: true, stats };
}

async function updateStats(statKey, incrementBy = 1) {
  const { stats = {} } = await chrome.storage.local.get('stats');
  
  if (typeof stats[statKey] === 'number') {
    stats[statKey] += incrementBy;
  } else {
    stats[statKey] = incrementBy;
  }
  
  await chrome.storage.local.set({ stats });
  return { success: true, stats };
}

// ============================================
// EXPORT/IMPORT FUNCTIONS
// ============================================

async function exportAllData() {
  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get(null),
    chrome.storage.local.get(null)
  ]);
  
  const exportData = {
    version: chrome.runtime.getManifest().version,
    exportedAt: new Date().toISOString(),
    settings: syncData,
    data: localData
  };
  
  return { success: true, data: exportData };
}

async function importData(data) {
  try {
    if (!data.version || !data.settings || !data.data) {
      throw new Error('Invalid import data format');
    }
    
    await chrome.storage.sync.set(data.settings);
    await chrome.storage.local.set(data.data);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// CONTEXT MENU (Right-click menu)
// ============================================

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu for bookmarking
  chrome.contextMenus.create({
    id: 'skool-bookmark-selection',
    title: '🔖 Save to Skool Enhancer',
    contexts: ['selection'],
    documentUrlPatterns: ['*://*.skool.com/*']
  });
  
  chrome.contextMenus.create({
    id: 'skool-bookmark-page',
    title: '🔖 Bookmark this page',
    contexts: ['page'],
    documentUrlPatterns: ['*://*.skool.com/*']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'skool-bookmark-selection') {
    // Bookmark selected text
    const bookmark = {
      title: info.selectionText.substring(0, 100),
      url: tab.url,
      community: extractCommunityFromUrl(tab.url),
      type: 'selection'
    };
    
    await addBookmark(bookmark);
    
    // Notify content script to show confirmation
    chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_NOTIFICATION',
      message: 'Selection bookmarked!',
      notificationType: 'success'
    });
  }
  
  if (info.menuItemId === 'skool-bookmark-page') {
    // Bookmark entire page
    const bookmark = {
      title: tab.title,
      url: tab.url,
      community: extractCommunityFromUrl(tab.url),
      type: 'page'
    };
    
    await addBookmark(bookmark);
    
    chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_NOTIFICATION',
      message: 'Page bookmarked!',
      notificationType: 'success'
    });
  }
});

// ============================================
// ALARM FOR PERIODIC TASKS
// ============================================

chrome.alarms.create('cleanup', {
  periodInMinutes: 60 // Run every hour
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanup') {
    await cleanupOldData();
  }
});

async function cleanupOldData() {
  const { drafts = [] } = await chrome.storage.local.get('drafts');
  
  // Remove drafts older than 30 days
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  const filtered = drafts.filter(draft => {
    const draftDate = new Date(draft.savedAt).getTime();
    return draftDate > thirtyDaysAgo;
  });
  
  if (filtered.length !== drafts.length) {
    await chrome.storage.local.set({ drafts: filtered });
    console.log(`🧹 Cleaned up ${drafts.length - filtered.length} old drafts`);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function extractCommunityFromUrl(url) {
  try {
    const match = url.match(/skool\.com\/([^\/]+)/);
    return match ? match[1] : 'Unknown';
  } catch {
    return 'Unknown';
  }
}

// ============================================
// BADGE UPDATES
// ============================================

async function updateBadge() {
  const { drafts = [] } = await chrome.storage.local.get('drafts');
  
  if (drafts.length > 0) {
    chrome.action.setBadgeText({ text: drafts.length.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Listen for storage changes to update badge
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.drafts) {
    updateBadge();
  }
});

// Initial badge update
updateBadge();

console.log('🎓 Skool Enhancer background service worker started');
