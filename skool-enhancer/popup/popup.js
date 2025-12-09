// ============================================
// SKOOL ENHANCER - POPUP SCRIPT
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize
  await checkSkoolPage();
  await loadSettings();
  await loadBookmarks();
  await loadDrafts();
  setupEventListeners();
});

// ============================================
// CHECK IF ON SKOOL PAGE
// ============================================

async function checkSkoolPage() {
  const statusBar = document.getElementById('statusBar');
  const statusText = statusBar.querySelector('.status-text');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab.url && tab.url.includes('skool.com')) {
      statusBar.classList.remove('inactive');
      statusText.textContent = 'Active on Skool';
    } else {
      statusBar.classList.add('inactive');
      statusText.textContent = 'Open a Skool page to use';
    }
  } catch (error) {
    statusBar.classList.add('inactive');
    statusText.textContent = 'Unable to detect page';
  }
}

// ============================================
// SETTINGS MANAGEMENT
// ============================================

async function loadSettings() {
  const settings = await chrome.storage.sync.get({
    darkMode: false,
    autoSave: true
  });
  
  document.getElementById('darkModeToggle').checked = settings.darkMode;
  document.getElementById('autoSaveToggle').checked = settings.autoSave;
}

async function saveSetting(key, value) {
  await chrome.storage.sync.set({ [key]: value });
  
  // Notify content script of setting change
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.url && tab.url.includes('skool.com')) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'SETTING_CHANGED',
      setting: key,
      value: value
    });
  }
}

// ============================================
// BOOKMARKS MANAGEMENT
// ============================================

async function loadBookmarks() {
  const { bookmarks = [] } = await chrome.storage.local.get('bookmarks');
  renderBookmarks(bookmarks);
}

function renderBookmarks(bookmarks) {
  const container = document.getElementById('bookmarksContainer');
  
  if (bookmarks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span>📚</span>
        <p>No bookmarks yet</p>
        <small>Click the bookmark icon on any Skool post</small>
      </div>
    `;
    return;
  }
  
  container.innerHTML = bookmarks.map((bookmark, index) => `
    <div class="bookmark-item" data-index="${index}">
      <div class="item-content">
        <div class="item-title">${escapeHtml(bookmark.title)}</div>
        <div class="item-meta">${bookmark.community} • ${formatDate(bookmark.savedAt)}</div>
      </div>
      <div class="item-actions">
        <button class="item-btn open-bookmark" data-url="${bookmark.url}" title="Open">
          🔗
        </button>
        <button class="item-btn delete-bookmark" data-index="${index}" title="Delete">
          ❌
        </button>
      </div>
    </div>
  `).join('');
  
  // Add click handlers
  container.querySelectorAll('.open-bookmark').forEach(btn => {
    btn.addEventListener('click', () => {
      chrome.tabs.create({ url: btn.dataset.url });
    });
  });
  
  container.querySelectorAll('.delete-bookmark').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.index);
      await deleteBookmark(index);
    });
  });
}

async function deleteBookmark(index) {
  const { bookmarks = [] } = await chrome.storage.local.get('bookmarks');
  bookmarks.splice(index, 1);
  await chrome.storage.local.set({ bookmarks });
  renderBookmarks(bookmarks);
}

async function clearAllBookmarks() {
  if (confirm('Are you sure you want to delete all bookmarks?')) {
    await chrome.storage.local.set({ bookmarks: [] });
    renderBookmarks([]);
  }
}

async function exportBookmarks() {
  const { bookmarks = [] } = await chrome.storage.local.get('bookmarks');
  
  if (bookmarks.length === 0) {
    alert('No bookmarks to export!');
    return;
  }
  
  const exportData = {
    exported: new Date().toISOString(),
    count: bookmarks.length,
    bookmarks: bookmarks
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `skool-bookmarks-${Date.now()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
}

// ============================================
// DRAFTS MANAGEMENT
// ============================================

async function loadDrafts() {
  const { drafts = [] } = await chrome.storage.local.get('drafts');
  renderDrafts(drafts);
  updateDraftCount(drafts.length);
}

function renderDrafts(drafts) {
  const container = document.getElementById('draftsContainer');
  
  if (drafts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span>✏️</span>
        <p>No drafts saved</p>
        <small>Start typing in Skool to auto-save</small>
      </div>
    `;
    return;
  }
  
  container.innerHTML = drafts.map((draft, index) => `
    <div class="draft-item" data-index="${index}">
      <div class="item-content">
        <div class="item-title">${escapeHtml(truncate(draft.content, 50))}</div>
        <div class="item-meta">${draft.community} • ${formatDate(draft.savedAt)}</div>
      </div>
      <div class="item-actions">
        <button class="item-btn restore-draft" data-index="${index}" title="Restore">
          📋
        </button>
        <button class="item-btn delete-draft" data-index="${index}" title="Delete">
          ❌
        </button>
      </div>
    </div>
  `).join('');
  
  // Add click handlers
  container.querySelectorAll('.restore-draft').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.index);
      await restoreDraft(index);
    });
  });
  
  container.querySelectorAll('.delete-draft').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.index);
      await deleteDraft(index);
    });
  });
}

function updateDraftCount(count) {
  document.getElementById('draftCount').innerHTML = `
    <span>📝 ${count} draft${count !== 1 ? 's' : ''} saved</span>
  `;
}

async function restoreDraft(index) {
  const { drafts = [] } = await chrome.storage.local.get('drafts');
  const draft = drafts[index];
  
  if (!draft) return;
  
  // Copy to clipboard
  await navigator.clipboard.writeText(draft.content);
  alert('Draft copied to clipboard! Paste it in Skool.');
}

async function deleteDraft(index) {
  const { drafts = [] } = await chrome.storage.local.get('drafts');
  drafts.splice(index, 1);
  await chrome.storage.local.set({ drafts });
  renderDrafts(drafts);
  updateDraftCount(drafts.length);
}

async function clearAllDrafts() {
  if (confirm('Are you sure you want to delete all drafts?')) {
    await chrome.storage.local.set({ drafts: [] });
    renderDrafts([]);
    updateDraftCount(0);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Dark Mode Toggle
  document.getElementById('darkModeToggle').addEventListener('change', async (e) => {
    await saveSetting('darkMode', e.target.checked);
  });
  
  // Auto-Save Toggle
  document.getElementById('autoSaveToggle').addEventListener('change', async (e) => {
    await saveSetting('autoSave', e.target.checked);
  });
  
  // Bookmark Actions
  document.getElementById('exportBookmarks').addEventListener('click', exportBookmarks);
  document.getElementById('clearBookmarks').addEventListener('click', clearAllBookmarks);
  
  // Draft Actions
  document.getElementById('clearDrafts').addEventListener('click', clearAllDrafts);
  
  // Footer Links
  document.getElementById('rateLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ 
      url: 'https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID/reviews'
    });
  });
  
  document.getElementById('supportLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'mailto:support@yourwebsite.com' });
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncate(str, length) {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.bookmarks) {
      renderBookmarks(changes.bookmarks.newValue || []);
    }
    if (changes.drafts) {
      renderDrafts(changes.drafts.newValue || []);
      updateDraftCount((changes.drafts.newValue || []).length);
    }
  }
});
