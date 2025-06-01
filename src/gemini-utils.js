/**
 * Gemini Utilities - All Gemini-related configurations and functions
 */


/**
 * 中央模型配置 - 所有模型相關的配置都在這裡定義
 */
export const GEMINI_MODELS_CONFIG = {
  // 基礎模型（總是可用的）
  BASE_MODELS: [],
  
  // 模型顯示名稱映射（用於 Gemini UI 中的識別）
  MODEL_DISPLAY_MAP: {
    'gemini-2.5-flash': '2.5 Flash',
    'gemini-2.5-pro': '2.5 Pro'
  },
  
  // 預設選擇的模型
  DEFAULT_SELECTED_MODEL: 'auto'
};

/**
 * 背景模型同步管理器
 */
export class BackgroundModelSyncManager {
  constructor() {
    this.syncInterval = null;
    this.syncIntervalMs = 30 * 60 * 1000; // 30 分鐘同步一次
    this.isSyncing = false;
    this.lastSyncTime = 0;
    this.minSyncInterval = 10 * 60 * 1000; // 最小同步間隔 10 分鐘
  }

  /**
   * 初始化背景同步
   */
  initialize() {
    console.log('初始化背景模型同步管理器');
    
    // 立即檢查是否需要同步
    this.checkAndSync();
    
    // 設置定期同步
    this.startPeriodicSync();
    
    // 監聽擴充功能啟動事件
    this.setupEventListeners();
  }

  /**
   * 設置事件監聽器
   */
  setupEventListeners() {
    // 監聽 alarm 事件（用於定期同步）
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'modelSync') {
        console.log('定期模型同步觸發');
        this.checkAndSync();
      }
    });
  }

  /**
   * 開始定期同步
   */
  startPeriodicSync() {
    // 清除現有的 alarm
    chrome.alarms.clear('modelSync');
    
    // 創建新的 alarm，每 30 分鐘觸發一次
    chrome.alarms.create('modelSync', {
      delayInMinutes: 30,
      periodInMinutes: 30
    });
    
    console.log('背景定期同步已設置（每 30 分鐘）');
  }

  /**
   * 檢查並執行同步
   */
  async checkAndSync(forceSync = false) {
    const now = Date.now();
    
    // 檢查是否需要同步
    if (this.isSyncing) {
      console.log('同步正在進行中，跳過此次同步');
      return;
    }
    
    if (now - this.lastSyncTime < this.minSyncInterval) {
      console.log('距離上次同步時間太短，跳過此次同步');
      return;
    }

    // 檢查 storage 中的最後更新時間
    const shouldSync = await this.shouldPerformSync();
    if (!shouldSync && !forceSync) {
      console.log('模型列表仍然有效，跳過同步');
      return;
    }

    console.log('開始背景模型同步...');
    await this.performBackgroundSync();
  }

  /**
   * 檢查是否應該執行同步
   */
  async shouldPerformSync() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['modelsLastUpdated'], (result) => {
        const lastUpdated = result.modelsLastUpdated || 0;
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 小時
        
        // 如果超過 24 小時沒有更新，則需要同步
        resolve(now - lastUpdated > maxAge);
      });
    });
  }

  /**
   * 執行背景同步
   */
  async performBackgroundSync() {
    if (this.isSyncing) return;
    
    this.isSyncing = true;
    this.lastSyncTime = Date.now();

    let geminiTab = null;
    const syncTimeout = 60000; // 60 seconds timeout

    try {
      console.log('🔄 開始背景模型同步流程...');
      
      // 創建一個隱藏的 Gemini 頁面進行同步
      geminiTab = await chrome.tabs.create({
        url: 'https://gemini.google.com/app',
        active: false // 在背景開啟，不切換到該頁面
      });

      console.log(`背景開啟 Gemini 頁面進行同步，Tab ID: ${geminiTab.id}`);

      // 使用 Promise.race 來添加總體超時控制
      await Promise.race([
        this.performSyncWithTab(geminiTab.id),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('同步操作超時')), syncTimeout)
        )
      ]);

      console.log('✅ 背景同步流程成功完成');

    } catch (error) {
      console.error('❌ 背景同步失敗:', error);
      throw error;
    } finally {
      // 確保頁面被關閉
      if (geminiTab && geminiTab.id) {
        try {
          await chrome.tabs.remove(geminiTab.id);
          console.log('已關閉背景 Gemini 頁面');
        } catch (closeError) {
          console.warn('關閉頁面時發生錯誤:', closeError);
        }
      }
      this.isSyncing = false;
    }
  }

  /**
   * 執行同步操作（分離出來以便更好的錯誤處理）
   */
  async performSyncWithTab(tabId) {
    // 等待頁面載入完成
    console.log('📄 等待頁面載入完成...');
    await this.waitForTabLoad(tabId);
    
    // 使用 waitForGeminiPageReady 確保頁面完全準備就緒
    console.log('🔍 檢查頁面準備狀態...');
    await waitForGeminiPageReady(tabId);
    console.log('✅ 背景 Gemini 頁面已準備就緒');

    // 執行模型同步
    console.log('🔄 開始執行模型同步...');
    await this.syncModelsInTab(tabId);
    console.log('✅ 背景模型同步操作完成');
  }

  /**
   * 等待頁面載入完成
   */
  async waitForTabLoad(tabId) {
    const loadTimeout = 30000; // 30 seconds timeout
    
    return Promise.race([
      new Promise((resolve) => {
        const listener = (updatedTabId, changeInfo, _tab) => {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            console.log(`📄 Tab ${tabId} 載入完成，等待 3 秒確保穩定性...`);
            // 額外等待 3 秒確保頁面完全載入
            setTimeout(resolve, 3000);
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        
        // 檢查頁面是否已經載入完成
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            console.warn('無法獲取 tab 資訊:', chrome.runtime.lastError);
            return;
          }
          if (tab && tab.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            console.log(`📄 Tab ${tabId} 已經載入完成`);
            setTimeout(resolve, 1000);
          }
        });
      }),
      new Promise((_, reject) => 
        setTimeout(() => {
          reject(new Error(`頁面載入超時 (${loadTimeout/1000} 秒)`));
        }, loadTimeout)
      )
    ]);
  }

  /**
   * 在指定頁面中同步模型
   */
  async syncModelsInTab(tabId) {
    const syncTimeout = 30000; // 30 seconds timeout for individual sync operation
    
    try {
      console.log(`🔄 開始在 Tab ${tabId} 中同步模型...`);
      
      // 檢查 storage 中是否有最近的模型數據
      const currentTime = Date.now();
      const storageCheck = await new Promise((resolve) => {
        chrome.storage.local.get(['availableGeminiModels', 'modelsLastUpdated'], (result) => {
          const models = result.availableGeminiModels || [];
          const lastUpdated = result.modelsLastUpdated || 0;
          const timeDiff = currentTime - lastUpdated;
          
          resolve({
            hasModels: models.length > 0,
            isRecent: timeDiff < 5000, // 如果 5 秒內已更新，跳過重複同步
            models: models,
            lastUpdated: lastUpdated
          });
        });
      });
      
      if (storageCheck.hasModels && storageCheck.isRecent) {
        console.log('✅ 模型已在最近同步完成，跳過重複同步');
        console.log(`📋 使用現有的 ${storageCheck.models.length} 個模型`);
        return;
      }
      
      // 使用 Promise.race 來添加超時控制
      await Promise.race([
        syncAvailableModels(tabId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('模型同步操作超時')), syncTimeout)
        )
      ]);
      
      console.log('✅ 背景模型同步成功');
    } catch (error) {
      console.error('❌ 背景模型同步失敗:', error);
      throw error;
    }
  }

  /**
   * 手動觸發同步
   */
  async manualSync() {
    console.log('🔄 手動觸發背景同步開始');
    this.lastSyncTime = 0; // 重置時間限制
    
    try {
      await this.checkAndSync(true);
      console.log('✅ 手動背景同步成功完成');
    } catch (error) {
      console.error('❌ 手動背景同步失敗:', error);
      throw error;
    }
  }

  /**
   * 停止背景同步
   */
  stop() {
    chrome.alarms.clear('modelSync');
    this.isSyncing = false;
    console.log('背景模型同步已停止');
  }
}

/**
 * 模型名稱映射 - 將我們的內部模型名稱映射到 Gemini UI 中顯示的文字
 * @param {string} selectedModel - 選擇的模型名稱
 * @returns {string} - Gemini UI 中對應的模型顯示文字
 */
export function getGeminiModelDisplayName(selectedModel) {
  return GEMINI_MODELS_CONFIG.MODEL_DISPLAY_MAP[selectedModel] || '2.5 Pro';
}

/**
 * 生成基本的 Gemini URL（不再依賴 URL 參數）
 * @returns {string} - Gemini 基本 URL
 */
export function generateGeminiUrl() {
  return 'https://gemini.google.com/app';
}

/**
 * 從 Gemini 頁面獲取可用模型列表
 * @param {number} tabId - Gemini 頁面的 tab ID
 * @returns {Promise<Array>} - 從頁面提取的模型列表
 */
export async function getAvailableGeminiModels(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: extractAvailableModels
    });

    if (results && results[0] && results[0].result) {
      return results[0].result;
    } else {
      console.warn('無法獲取 Gemini 模型列表，返回空陣列');
      return [];
    }
  } catch (error) {
    console.error('Error getting available models:', error);
    return [];
  }
}

/**
 * 同步並儲存可用模型列表
 * @param {number} tabId - Gemini 頁面的 tab ID
 */
export async function syncAvailableModels(tabId) {
  try {
    const extractedModels = await getAvailableGeminiModels(tabId);
    
    // 建立完整的模型列表
    let completeModelsList = [];
    
    if (extractedModels.length > 0) {
      console.log('成功提取到', extractedModels.length, '個模型:', extractedModels);
      
      // 使用提取到的模型
      completeModelsList = [...extractedModels];
      
      // 智能合併：只添加不存在的基礎模型
      const existingModelValues = new Set(extractedModels.map(model => model.value));
      const uniqueBaseModels = GEMINI_MODELS_CONFIG.BASE_MODELS.filter(baseModel => {
        const exists = existingModelValues.has(baseModel.value);
        if (exists) {
          console.log(`🔄 跳過重複的基礎模型: ${baseModel.value}`);
        }
        return !exists;
      });
      
      if (uniqueBaseModels.length > 0) {
        console.log('添加不重複的基礎模型:', uniqueBaseModels);
        completeModelsList.unshift(...uniqueBaseModels); // 基礎模型放在前面
      }
    } else {
      console.log('未提取到模型，僅使用基礎模型（auto）');
      // 只有在沒有提取到模型時才使用基礎模型
      completeModelsList = [...GEMINI_MODELS_CONFIG.BASE_MODELS];
    }
    
    // 儲存到 chrome storage
    await chrome.storage.local.set({
      'availableGeminiModels': completeModelsList,
      'modelsLastUpdated': Date.now()
    });
    
    console.log('Available Gemini models synced:', completeModelsList);
  } catch (error) {
    console.error('Error syncing available models:', error);
  }
}

/**
 * 檢查是否需要同步模型列表
 * @returns {Promise<boolean>} - 是否需要同步
 */
export async function shouldSyncModels() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['modelsLastUpdated'], (result) => {
      const lastUpdated = result.modelsLastUpdated || 0;
      const now = Date.now();
      const maxAge = 6 * 60 * 60 * 1000; // 6 小時，比背景同步更頻繁一些
      
      // 如果超過 6 小時沒有更新，則需要同步
      resolve(now - lastUpdated > maxAge);
    });
  });
}

/**
 * 智能等待 Gemini 頁面準備就緒
 * @param {number} tabId - Gemini 頁面的 tab ID
 * @returns {Promise<void>} - 當頁面準備就緒時解析
 */
export async function waitForGeminiPageReady(tabId) {
  const maxAttempts = 8; // 減少到 8 次嘗試 (約 4-8 秒)
  const checkInterval = 500; // 減少到每 0.5 秒檢查一次
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Checking Gemini page readiness... Attempt ${attempt}/${maxAttempts}`);
      
      const result = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: checkGeminiPageReadiness
      });
      
      if (result && result[0] && result[0].result && result[0].result.isReady) {
        console.log(`✅ Gemini page ready after ${attempt} attempts`);
        
        // 短暫延遲確保穩定性
        await new Promise(resolve => setTimeout(resolve, 200));
        return;
      }
      
      console.log(`❌ Gemini page not ready yet (attempt ${attempt}). Reason:`, result[0]?.result?.reason);
      
      // 等待下次檢查
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
      
    } catch (error) {
      console.warn(`Error checking page readiness (attempt ${attempt}):`, error);
      
      // 如果是最後一次嘗試，拋出錯誤
      if (attempt === maxAttempts) {
        throw new Error(`Failed to detect page readiness after ${maxAttempts} attempts`);
      }
      
      // 等待下次檢查
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
  
  throw new Error(`Gemini page not ready after ${maxAttempts} attempts`);
}

/**
 * 檢查 Gemini 頁面是否準備就緒（在頁面中執行）
 * @returns {Object} - 包含 isReady 和 reason 的對象
 */
export function checkGeminiPageReadiness() {
  // 檢查基本 DOM 結構
  if (document.readyState !== 'complete') {
    return { isReady: false, reason: 'Document not loaded' };
  }
  
  // 檢查輸入區域是否存在（這是我們最終需要的）
  const inputArea = document.querySelector('div[contenteditable="true"]') ||
                   document.querySelector('textarea') ||
                   document.querySelector('[data-testid="chat-input"]') ||
                   document.querySelector('.ql-editor') ||
                   document.querySelector('[role="textbox"]');
  
  if (!inputArea) {
    return { isReady: false, reason: 'Input area not found' };
  }
  
  // 檢查輸入區域是否可見且可交互
  const inputStyle = window.getComputedStyle(inputArea);
  if (inputStyle.display === 'none' || inputStyle.visibility === 'hidden') {
    return { isReady: false, reason: 'Input area not visible' };
  }
  
  // 更精確地檢查主要聊天介面的載入狀態，忽略側邊欄載入指示器
  // 檢查是否有主要內容載入指示器（排除側邊欄的 Gems 和 conversation history）
  const mainContentLoading = document.querySelector('.chat-container .loading, .chat-window .spinner, .input-area .loading');
  if (mainContentLoading && window.getComputedStyle(mainContentLoading).display !== 'none') {
    return { isReady: false, reason: 'Main chat interface still loading' };
  }
  
  // 檢查是否有禁用的輸入區域
  if (inputArea.hasAttribute('disabled') || inputArea.getAttribute('aria-disabled') === 'true') {
    return { isReady: false, reason: 'Input area is disabled' };
  }
  
  // 確保 Gemini 應用已載入（檢查特定的 Gemini 元素）
  const geminiApp = document.querySelector('chat-app#app-root') || 
                   document.querySelector('bard-sidenav-container') ||
                   document.querySelector('[data-test-id="bard-mode-switcher"]');
  
  if (!geminiApp) {
    return { isReady: false, reason: 'Gemini app components not loaded' };
  }
  
  // 基本檢查通過，頁面應該已準備就緒
  return { 
    isReady: true, 
    reason: 'Page ready - input area found, visible, and main interface loaded'
  };
}

/**
 * 處理 Gemini 摘要請求
 * @param {string} messages - 要傳送的訊息
 * @param {Object} sourceTab - 來源頁面的 tab 物件
 * @param {string} selectedModel - 選擇的模型
 */
export async function handleGeminiSummaryRequest(messages, sourceTab, selectedModel = GEMINI_MODELS_CONFIG.DEFAULT_SELECTED_MODEL) {
  try {
    // 儲存訊息到chrome storage
    await chrome.storage.local.set({
      'slackMessages': messages,
      'sourceTabId': sourceTab.id,
      'selectedModel': selectedModel
    });

    // 使用基本的 Gemini URL
    const geminiUrl = generateGeminiUrl();
    console.log(`Opening Gemini with model: ${selectedModel}, URL: ${geminiUrl}`);

    // 開啟Gemini網頁
    const geminiTab = await chrome.tabs.create({
      url: geminiUrl,
      active: true
    });

    // 等待Gemini頁面載入完成，然後同步模型列表並切換模型
    chrome.tabs.onUpdated.addListener(function geminiLoadListener(tabId, changeInfo, _tab) {
      if (tabId === geminiTab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(geminiLoadListener);
        
        // 使用 waitForGeminiPageReady 確保頁面完全準備就緒
        waitForGeminiPageReady(geminiTab.id)
          .then(async () => {
            console.log('✅ Gemini 頁面已準備就緒，開始處理模型和訊息...');
            
            // 如果是自動模式，直接貼上訊息，不切換模型
            if (isAutoModel(selectedModel)) {
              console.log('🔄 使用自動模式，跳過模型切換，直接貼上訊息...');
              await pasteMessagesDirectly(geminiTab.id, messages);
              return;
            }
            
            // 非自動模式，檢查是否需要同步模型列表
            const shouldSync = await shouldSyncModels();
            
            if (shouldSync) {
              console.log('需要同步模型列表...');
              try {
                // await syncAvailableModels(geminiTab.id);
                console.log('模型同步完成，切換模型並貼上訊息...');
                await switchGeminiModelAndPasteMessages(geminiTab.id, selectedModel, messages);
              } catch (error) {
                console.error('模型同步失敗，直接切換模型:', error);
                await switchGeminiModelAndPasteMessages(geminiTab.id, selectedModel, messages);
              }
            } else {
              console.log('模型列表仍然有效，直接切換模型...');
              await switchGeminiModelAndPasteMessages(geminiTab.id, selectedModel, messages);
            }
          })
          .catch((error) => {
            console.error('❌ 等待 Gemini 頁面準備就緒失敗:', error);
            // 如果等待失敗，仍然嘗試執行操作（作為備用方案）
            console.log('使用備用方案繼續執行...');
            setTimeout(async () => {
              if (isAutoModel(selectedModel)) {
                await pasteMessagesDirectly(geminiTab.id, messages);
              } else {
                await switchGeminiModelAndPasteMessages(geminiTab.id, selectedModel, messages);
              }
            }, 2000);
          });
      }
    });

  } catch (error) {
    console.error('Error handling Gemini request:', error);
  }
}

/**
 * 直接貼上訊息到 Gemini（不切換模型，用於自動模式）
 * @param {number} tabId - Gemini 頁面的 tab ID
 * @param {string} messages - 要貼上的訊息
 */
export async function pasteMessagesDirectly(tabId, messages) {
  try {
    console.log('🔄 自動模式：直接貼上訊息到 Gemini...');
    
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: pasteMessagesIntoGemini,
      args: [messages]
    });
  } catch (error) {
    console.error('Error pasting messages directly:', error);
  }
}

/**
 * 在Gemini頁面中執行的訊息貼上函數（獨立版本，用於自動模式）
 * @param {string} messages - 要貼上的訊息
 */
export function pasteMessagesIntoGemini(messages) {
  function findTextArea() {
    // 嘗試多種可能的文字輸入區域選擇器
    const selectors = [
      'div[contenteditable="true"]',
      'textarea',
      '[data-testid="chat-input"]',
      '.ql-editor',
      '[role="textbox"]',
      '.chat-input',
      'input[type="text"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) { // 確保元素可見
        return element;
      }
    }
    return null;
  }

  function waitForTextArea(maxAttempts = 10, attempt = 0) {
    const textArea = findTextArea();
    
    if (textArea) {
      // 聚焦到文字區域
      textArea.focus();
      
      // 根據元素類型設置文字
      if (textArea.tagName === 'TEXTAREA' || textArea.tagName === 'INPUT') {
        textArea.value = messages;
        textArea.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (textArea.contentEditable === 'true') {
        textArea.textContent = messages;
        textArea.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // 模擬用戶操作以觸發相關事件
      setTimeout(() => {
        textArea.dispatchEvent(new Event('change', { bubbles: true }));
        textArea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }, 500);

      console.log('Messages pasted into Gemini successfully');
      return true;
    } else if (attempt < maxAttempts) {
      console.log(`Attempt ${attempt + 1}: Text area not found, retrying...`);
      setTimeout(() => waitForTextArea(maxAttempts, attempt + 1), 1000);
    } else {
      console.error('Could not find text input area in Gemini');
      // 作為備選方案，複製到剪貼板
      if (navigator.clipboard) {
        navigator.clipboard.writeText(messages).then(() => {
          alert('無法自動貼上訊息，已複製到剪貼板。請手動貼上 (Ctrl+V)');
        });
      }
    }
  }

  // 等待頁面完全載入
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForTextArea());
  } else {
    waitForTextArea();
  }
}

/**
 * 切換 Gemini 模型並貼上訊息
 * @param {number} tabId - Gemini 頁面的 tab ID
 * @param {string} selectedModel - 選擇的模型
 * @param {string} messages - 要貼上的訊息
 */
export async function switchGeminiModelAndPasteMessages(tabId, selectedModel, messages) {
  try {
    // 確保頁面完全準備就緒
    await waitForGeminiPageReady(tabId);
    console.log('✅ 頁面已準備就緒，開始切換模型並貼上訊息...');
    
    const modelDisplayName = getGeminiModelDisplayName(selectedModel);
    
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: switchModelAndPasteMessages,
      args: [modelDisplayName, messages]
    });
  } catch (error) {
    console.error('Error switching model and pasting messages:', error);
    // 如果頁面準備檢查失敗，仍然嘗試執行操作（作為備用方案）
    try {
      console.log('使用備用方案直接執行模型切換...');
      const modelDisplayName = getGeminiModelDisplayName(selectedModel);
      
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: switchModelAndPasteMessages,
        args: [modelDisplayName, messages]
      });
    } catch (fallbackError) {
      console.error('備用方案也失敗:', fallbackError);
    }
  }
}

/**
 * 在Gemini頁面中執行的模型檢測函數
 */
export function extractAvailableModels() {
  console.log('開始檢測 Gemini 可用模型...');
  
  // 首先嘗試點擊模型切換按鈕來打開選單
  const modeSwitcherSelectors = [
    'bard-mode-switcher button',
    '[data-test-id="bard-mode-menu-button"]',
    '.logo-pill-btn',
    'button[class*="logo-pill"]',
    'button[class*="mode-switch"]'
  ];
  
  let modeSwitcherButton = null;
  for (const selector of modeSwitcherSelectors) {
    modeSwitcherButton = document.querySelector(selector);
    if (modeSwitcherButton) {
      console.log(`找到模型切換按鈕: ${selector}`);
      break;
    }
  }
  
  if (!modeSwitcherButton) {
    console.log('未找到模型切換按鈕，返回預設模型列表...');    
    return []; // Return empty array as BASE_MODELS is empty
  }
  
  // 點擊按鈕打開選單
  modeSwitcherButton.click();
  
  // 等待選單出現並檢測模型
  return new Promise((resolve) => {
    setTimeout(() => {
      const menuSelectors = [
        'mat-menu',
        '[role="menu"]',
        '.mat-mdc-menu-panel',
        '.mdc-menu-surface'
      ];
      
      let menu = null;
      for (const selector of menuSelectors) {
        menu = document.querySelector(selector);
        if (menu && menu.offsetParent !== null) {
          console.log(`找到模型選單: ${selector}`);
          break;
        }
      }
      
      if (!menu) {
        console.log('未找到模型選單，返回預設模型列表');
        resolve(getDefaultModels());
        return;
      }
      
      // 提取所有模型選項
      const menuItems = menu.querySelectorAll('button, [role="menuitem"], mat-option, .mat-mdc-menu-item');
      const models = [];
      
      menuItems.forEach((item, index) => {
        const itemText = item.textContent.trim();
        console.log(`檢測到模型選項 ${index + 1}: ${itemText}`);
        
        if (itemText && itemText.length > 0) {
          // 嘗試解析模型名稱和描述
          let value = '';
          let displayName = itemText;
          let description = '';
          
          // 根據文字內容推斷模型類型
          if (itemText.toLowerCase().includes('flash') || itemText.includes('2.5') && itemText.toLowerCase().includes('flash')) {
            value = 'gemini-2.5-flash';
            description = '⚡ 快速回應，適合一般摘要需求';
            if (!displayName.includes('⚡')) {
              displayName = `⚡ ${displayName}`;
            }
          } else if (itemText.toLowerCase().includes('pro') || itemText.includes('2.5') && itemText.toLowerCase().includes('pro')) {
            value = 'gemini-2.5-pro';
            description = '🧠 進階分析能力，適合複雜討論和深度摘要';
            if (!displayName.includes('🧠')) {
              displayName = `🧠 ${displayName}`;
            }
          } else {
            // 對於未知模型，使用文字內容作為 value
            value = itemText.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            description = itemText;
          }
          
          models.push({
            value: value,
            displayName: displayName,
            description: description,
            originalText: itemText
          });
        }
      });
      
      console.log(`檢測到 ${models.length} 個模型:`, models);
      
      // 延遲關閉選單，確保有足夠時間讓後續操作使用
      setTimeout(() => {
        try {
          // 關閉選單（點擊其他地方）
          document.body.click();
          console.log('模型選單已關閉');
        } catch (error) {
          console.log('關閉選單時發生錯誤，但不影響功能:', error);
        }
      }, 500);
      
      resolve(models.length > 0 ? models : []); // Return empty array as BASE_MODELS is empty
    }, 1500); // 等待選單完全載入
  });
}

/**
 * 在Gemini頁面中執行的模型切換和訊息貼上函數
 * @param {string} targetModelDisplayName - 目標模型顯示名稱
 * @param {string} messages - 要貼上的訊息
 */
export function switchModelAndPasteMessages(targetModelDisplayName, messages) {
  console.log(`Attempting to switch to model: ${targetModelDisplayName}`);
  
  // Inline pasteMessagesIntoGemini function to avoid reference errors
  function pasteMessagesIntoGemini(messages) {
    function findTextArea() {
      // 嘗試多種可能的文字輸入區域選擇器
      const selectors = [
        'div[contenteditable="true"]',
        'textarea',
        '[data-testid="chat-input"]',
        '.ql-editor',
        '[role="textbox"]',
        '.chat-input',
        'input[type="text"]'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) { // 確保元素可見
          return element;
        }
      }
      return null;
    }

    function waitForTextArea(maxAttempts = 10, attempt = 0) {
      const textArea = findTextArea();
      
      if (textArea) {
        // 聚焦到文字區域
        textArea.focus();
        
        // 根據元素類型設置文字
        if (textArea.tagName === 'TEXTAREA' || textArea.tagName === 'INPUT') {
          textArea.value = messages;
          textArea.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (textArea.contentEditable === 'true') {
          textArea.textContent = messages;
          textArea.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // 模擬用戶操作以觸發相關事件
        setTimeout(() => {
          textArea.dispatchEvent(new Event('change', { bubbles: true }));
          textArea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }, 500);

        console.log('Messages pasted into Gemini successfully');
        return true;
      } else if (attempt < maxAttempts) {
        console.log(`Attempt ${attempt + 1}: Text area not found, retrying...`);
        setTimeout(() => waitForTextArea(maxAttempts, attempt + 1), 1000);
      } else {
        console.error('Could not find text input area in Gemini');
        // 作為備選方案，複製到剪貼板
        if (navigator.clipboard) {
          navigator.clipboard.writeText(messages).then(() => {
            alert('無法自動貼上訊息，已複製到剪貼板。請手動貼上 (Ctrl+V)');
          });
        }
      }
    }

    // 等待頁面完全載入
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => waitForTextArea());
    } else {
      waitForTextArea();
    }
  }
  
  function findAndClickModelSwitcher() {
    // 尋找模型切換按鈕
    const modeSwitcherSelectors = [
      'bard-mode-switcher button',
      '[data-test-id="bard-mode-menu-button"]',
      '.logo-pill-btn',
      'button[class*="logo-pill"]',
      'button[class*="mode-switch"]'
    ];
    
    let modeSwitcherButton = null;
    for (const selector of modeSwitcherSelectors) {
      modeSwitcherButton = document.querySelector(selector);
      if (modeSwitcherButton) {
        console.log(`Found mode switcher with selector: ${selector}`);
        break;
      }
    }
    
    if (modeSwitcherButton) {
      // 點擊模型切換按鈕
      modeSwitcherButton.click();
      console.log('Clicked mode switcher button');
      
      // 等待下拉選單出現
      setTimeout(() => {
        findAndSelectModel(targetModelDisplayName);
      }, 1000);
      
      return true;
    } else {
      console.log('Mode switcher button not found');
      return false;
    }
  }
  
  function findAndSelectModel(modelDisplayName) {
    // 尋找模型選項
    const menuSelectors = [
      'mat-menu',
      '[role="menu"]',
      '.mat-mdc-menu-panel',
      '.mdc-menu-surface'
    ];
    
    let menu = null;
    for (const selector of menuSelectors) {
      menu = document.querySelector(selector);
      if (menu && menu.offsetParent !== null) { // 確保選單可見
        console.log(`Found menu with selector: ${selector}`);
        break;
      }
    }
    
    if (menu) {
      // 在選單中尋找目標模型
      const menuItems = menu.querySelectorAll('button, [role="menuitem"], mat-option, .mat-mdc-menu-item');
      
      for (const item of menuItems) {
        const itemText = item.textContent.trim();
        console.log(`Checking menu item: ${itemText}`);
        
        // 檢查是否包含目標模型名稱
        if (itemText.includes(modelDisplayName) || 
            itemText.includes(modelDisplayName.replace('.', '')) ||
            itemText.toLowerCase().includes(modelDisplayName.toLowerCase())) {
          
          console.log(`Found matching model option: ${itemText}`);
          item.click();
          
          // 等待模型切換完成後再貼上訊息
          setTimeout(() => {
            pasteMessagesIntoGemini(messages);
          }, 2000);
          
          return true;
        }
      }
      
      console.log(`Model "${modelDisplayName}" not found in menu options`);
      // 如果找不到指定模型，直接貼上訊息
      setTimeout(() => {
        pasteMessagesIntoGemini(messages);
      }, 1000);
      
    } else {
      console.log('Model selection menu not found');
      // 如果找不到選單，直接貼上訊息
      setTimeout(() => {
        pasteMessagesIntoGemini(messages);
      }, 1000);
    }
  }
  
  // 開始執行模型切換
  if (!findAndClickModelSwitcher()) {
    // 如果找不到模型切換器，直接貼上訊息
    console.log('Falling back to direct message pasting');
    setTimeout(() => {
      pasteMessagesIntoGemini(messages);
    }, 1000);
  }
}

/**
 * 獲取可用模型列表（包含同步的模型）
 * @returns {Promise<Array>} - 完整的模型列表
 */
export async function getAvailableModels() {
  console.log('🔍 Gemini Utils: getAvailableModels function called');
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['availableGeminiModels', 'modelsLastUpdated'], (result) => {
      console.log('📦 Gemini Utils: Storage result:', result);
      
      const syncedModels = result.availableGeminiModels || [];
      const lastUpdated = result.modelsLastUpdated || 0;
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 小時
      
      console.log('📊 Gemini Utils: Storage analysis:', {
        syncedModelsCount: syncedModels.length,
        lastUpdated: new Date(lastUpdated).toISOString(),
        hoursAgo: Math.floor((now - lastUpdated) / (1000 * 60 * 60)),
        isValid: syncedModels.length > 0 && (now - lastUpdated) < maxAge
      });
      
      // 如果有有效的同步模型，使用它們
      if (syncedModels.length > 0 && (now - lastUpdated) < maxAge) {
        console.log('✅ Gemini Utils: Using synced models:', syncedModels.length, '個模型');
        console.log('📋 Gemini Utils: Synced models:', syncedModels);
        resolve(syncedModels);
      } else {
        console.log('🔄 Gemini Utils: Using default models (base)');
        
        const defaultModels = [
          ...GEMINI_MODELS_CONFIG.BASE_MODELS
        ];
        
        console.log('📋 Gemini Utils: Default models:', defaultModels);
        resolve(defaultModels);
      }
    });
  });
}

/**
 * 獲取預設模型列表（同步版本，用於不支援 async 的地方）
 * @returns {Array} - 預設模型列表
 */
export function getDefaultModels() {
  // 返回基礎模型
  return [...GEMINI_MODELS_CONFIG.BASE_MODELS];
}

/**
 * 檢查模型是否為自動模式
 * @param {string} modelValue - 模型值
 * @returns {boolean} - 是否為自動模式
 */
export function isAutoModel(modelValue) {
  return modelValue === 'auto';
} 