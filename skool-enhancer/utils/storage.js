// ============================================
// SKOOL ENHANCER - STORAGE UTILITIES
// ============================================

/**
 * Storage utility class for Skool Enhancer
 * Provides a clean API for interacting with Chrome storage
 */

const SkoolStorage = {
  
  // ============================================
  // SYNC STORAGE (Settings - synced across devices)
  // ============================================
  
  /**
   * Get a value from sync storage
   * @param {string|string[]|object} keys - Keys to retrieve
   * @returns {Promise<object>}
   */
  async getSync(keys) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.sync.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },
  
  /**
   * Set values in sync storage
   * @param {object} items - Key-value pairs to store
   * @returns {Promise<void>}
   */
  async setSync(items) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.sync.set(items, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },
  
  // ============================================
  // LOCAL STORAGE (Data - device specific)
  // ============================================
  
  /**
   * Get a value from local storage
   * @param {string|string[]|object} keys - Keys to retrieve
   * @returns {Promise<object>}
   */
  async getLocal(keys) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },
  
  /**
   * Set values in local storage
   * @param {object} items - Key-value pairs to store
   * @returns {Promise<void>}
   */
  async setLocal(items) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(items, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },
  
  /**
   * Remove items from local storage
   * @param {string|string[]} keys - Keys to remove
   * @returns {Promise<void>}
   */
  async removeLocal(keys) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.remove(keys, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },
  
  // ============================================
  // BOOKMARKS HELPERS
  // ============================================
  
  /**
   * Get all bookmarks
   * @returns {Promise<array>}
   */
  async getBookmarks() {
    const { bookmarks = [] } = await this.getLocal('bookmarks');
    return bookmarks;
  },
  
  /**
   * Add a bookmark
   * @param {object} bookmark - Bookmark object
   * @returns {Promise<boolean>} - Success status
   */
  async addBookmark(bookmark) {
    const bookmarks = await this.getBookmarks();
    
    // Check for duplicate
    if (bookmarks.some(b => b.url === bookmark.url)) {
      return false;
    }
    
    bookmarks.unshift({
      ...bookmark,
      id: this.generateId(),
      savedAt: new Date().toISOString()
    });
    
    await this.setLocal({ bookmarks });
    return true;
  },
  
  /**
   * Remove a bookmark by URL
   * @param {string} url - URL to remove
   * @returns {Promise<boolean>}
   */
  async removeBookmark(url) {
    const bookmarks = await this.getBookmarks();
    const filtered = bookmarks.filter(b => b.url !== url);
    
    if (filtered.length === bookmarks.length) {
      return false;
    }
    
    await this.setLocal({ bookmarks: filtered });
    return true;
  },
  
  /**
   * Check if URL is bookmarked
   * @param {string} url - URL to check
   * @returns {Promise<boolean>}
   */
  async isBookmarked(url) {
    const bookmarks = await this.getBookmarks();
    return bookmarks.some(b => b.url === url);
  },
  
  // ============================================
  // DRAFTS HELPERS
  // ============================================
  
  /**
   * Get all drafts
   * @returns {Promise<array>}
   */
  async getDrafts() {
    const { drafts = [] } = await this.getLocal('drafts');
    return drafts;
  },
  
  /**
   * Save a draft
   * @param {object} draft - Draft object with content, url, community
   * @returns {Promise<void>}
   */
  async saveDraft(draft) {
    const drafts = await this.getDrafts();
    const { maxDrafts = 20 } = await this.getSync({ maxDrafts: 20 });
    
    // Check for existing draft with same content
    const existingIndex = drafts.findIndex(d => d.content === draft.content);
    
    if (existingIndex !== -1) {
      // Update existing
      drafts[existingIndex] = {
        ...drafts[existingIndex],
        ...draft,
        savedAt: new Date().toISOString()
      };
    } else {
      // Add new
      drafts.unshift({
        ...draft,
        id: this.generateId(),
        savedAt: new Date().toISOString()
      });
    }
    
    // Trim to max
    const trimmed = drafts.slice(0, maxDrafts);
    await this.setLocal({ drafts: trimmed });
  },
  
  /**
   * Delete a draft by index
   * @param {number} index - Index to delete
   * @returns {Promise<boolean>}
   */
  async deleteDraft(index) {
    const drafts = await this.getDrafts();
    
    if (index < 0 || index >= drafts.length) {
      return false;
    }
    
    drafts.splice(index, 1);
    await this.setLocal({ drafts });
    return true;
  },
  
  /**
   * Clear all drafts
   * @returns {Promise<void>}
   */
  async clearDrafts() {
    await this.setLocal({ drafts: [] });
  },
  
  /**
   * Get drafts for specific community
   * @param {string} community - Community name
   * @returns {Promise<array>}
   */
  async getDraftsByCommunity(community) {
    const drafts = await this.getDrafts();
    return drafts.filter(d => d.community === community);
  },
  
  // ============================================
  // SETTINGS HELPERS
  // ============================================
  
  /**
   * Get all settings with defaults
   * @returns {Promise<object>}
   */
  async getSettings() {
    const defaults = {
      darkMode: false,
      autoSave: true,
      showNotifications: true,
      draftSaveInterval: 5000,
      maxDrafts: 20,
      maxBookmarks: 100
    };
    
    return await this.getSync(defaults);
  },
  
  /**
   * Update a single setting
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   * @returns {Promise<void>}
   */
  async updateSetting(key, value) {
    await this.setSync({ [key]: value });
  },
  
  /**
   * Reset settings to defaults
   * @returns {Promise<void>}
   */
  async resetSettings() {
    const defaults = {
      darkMode: false,
      autoSave: true,
      showNotifications: true,
      draftSaveInterval: 5000,
      maxDrafts: 20,
      maxBookmarks: 100
    };
    
    await this.setSync(defaults);
  },
  
  // ============================================
  // STATISTICS HELPERS
  // ============================================
  
  /**
   * Get usage statistics
   * @returns {Promise<object>}
   */
  async getStats() {
    const { stats = {} } = await this.getLocal('stats');
    return {
      installDate: stats.installDate || new Date().toISOString(),
      draftsCreated: stats.draftsCreated || 0,
      bookmarksCreated: stats.bookmarksCreated || 0,
      draftsSaved: stats.draftsSaved || 0,
      ...stats
    };
  },
  
  /**
   * Increment a stat counter
   * @param {string} key - Stat key
   * @param {number} amount - Amount to increment
   * @returns {Promise<void>}
   */
  async incrementStat(key, amount = 1) {
    const stats = await this.getStats();
    stats[key] = (stats[key] || 0) + amount;
    await this.setLocal({ stats });
  },
  
  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  /**
   * Generate a unique ID
   * @returns {string}
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },
  
  /**
   * Get storage usage info
   * @returns {Promise<object>}
   */
  async getStorageUsage() {
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        const maxBytes = chrome.storage.local.QUOTA_BYTES || 5242880; // 5MB default
        resolve({
          used: bytesInUse,
          total: maxBytes,
          percentage: ((bytesInUse / maxBytes) * 100).toFixed(2)
        });
      });
    });
  },
  
  /**
   * Export all data as JSON
   * @returns {Promise<object>}
   */
  async exportAll() {
    const [settings, localData] = await Promise.all([
      this.getSettings(),
      this.getLocal(null)
    ]);
    
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings,
      bookmarks: localData.bookmarks || [],
      drafts: localData.drafts || [],
      stats: localData.stats || {}
    };
  },
  
  /**
   * Import data from JSON
   * @param {object} data - Import data
   * @returns {Promise<boolean>}
   */
  async importAll(data) {
    try {
      if (data.settings) {
        await this.setSync(data.settings);
      }
      
      if (data.bookmarks) {
        await this.setLocal({ bookmarks: data.bookmarks });
      }
      
      if (data.drafts) {
        await this.setLocal({ drafts: data.drafts });
      }
      
      if (data.stats) {
        await this.setLocal({ stats: data.stats });
      }
      
      return true;
    } catch (error) {
      console.error('Import failed:', error);
      return false;
    }
  },
  
  /**
   * Clear all extension data
   * @returns {Promise<void>}
   */
  async clearAll() {
    await Promise.all([
      chrome.storage.sync.clear(),
      chrome.storage.local.clear()
    ]);
  }
};

// Make available globally in content script
if (typeof window !== 'undefined') {
  window.SkoolStorage = SkoolStorage;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SkoolStorage;
}
