/**
 * Model Sync Module
 * Handles synchronization of selected model between extension and Gemini page
 */

/**
 * 模型同步管理器
 */
export class ModelSyncManager {
  constructor() {
    this.syncInterval = null;
    this.syncIntervalMs = 30 * 60 * 1000; // 30 分鐘同步一次
    this.isGeminiTab = false;
  }

  /**
   * 開始監控 Gemini 頁面並定期同步模型
   */
  startMonitoring() {
    // 監聽頁面變化
    this.checkCurrentPage();
    
    // 設置定期檢查
    setInterval(() => {
      this.checkCurrentPage();
    }, 5000); // 每 5 秒檢查一次當前頁面
  }

  /**
   * 檢查當前頁面是否為 Gemini
   */
  checkCurrentPage() {
    const isCurrentlyGemini = this.isGeminiPage();
    
    if (isCurrentlyGemini && !this.isGeminiTab) {
      // 剛進入 Gemini 頁面
      this.isGeminiTab = true;
      this.startPeriodicSync();
      console.log('檢測到 Gemini 頁面，開始模型同步');
    } else if (!isCurrentlyGemini && this.isGeminiTab) {
      // 離開 Gemini 頁面
      this.isGeminiTab = false;
      this.stopPeriodicSync();
      console.log('離開 Gemini 頁面，停止模型同步');
    }
  }

  /**
   * 檢查當前頁面是否為 Gemini
   * @returns {boolean}
   */
  isGeminiPage() {
    return window.location.hostname.includes('gemini.google.com');
  }

  /**
   * 開始定期同步
   */
  startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // 立即執行一次同步
    this.syncModels();

    // 設置定期同步
    this.syncInterval = setInterval(() => {
      this.syncModels();
    }, this.syncIntervalMs);
  }

  /**
   * 停止定期同步
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * 執行模型同步
   */
  async syncModels() {
    try {
      console.log('開始同步 Gemini 模型...');
      
      // 發送同步請求到 background script
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
          action: 'syncGeminiModels',
          tabId: 'current', // 讓 background script 自己處理 tab ID
          url: window.location.href
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('模型同步請求失敗:', chrome.runtime.lastError);
          } else if (response && response.success) {
            console.log('模型同步成功');
          } else {
            console.warn('模型同步失敗:', response?.error);
          }
        });
      }
    } catch (error) {
      console.error('模型同步過程中發生錯誤:', error);
    }
  }

  /**
   * 手動觸發模型同步
   */
  async manualSync() {
    console.log('手動觸發模型同步');
    await this.syncModels();
  }
}

/**
 * 全域模型同步管理器實例
 */
let modelSyncManager = null;

/**
 * 初始化模型同步
 */
export function initializeModelSync() {
  if (!modelSyncManager) {
    modelSyncManager = new ModelSyncManager();
    modelSyncManager.startMonitoring();
    console.log('模型同步管理器已初始化');
  }
  return modelSyncManager;
}

/**
 * 獲取模型同步管理器實例
 * @returns {ModelSyncManager}
 */
export function getModelSyncManager() {
  return modelSyncManager;
}

/**
 * 檢查是否為 Gemini 頁面
 */
export function isGeminiPage() {
  return window.location.hostname.includes('gemini.google.com');
} 