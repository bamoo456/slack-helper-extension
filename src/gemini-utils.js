/**
 * Gemini Utilities - All Gemini-related configurations and functions
 */

import { 
  sleep, 
  withTimeout, 
  waitForCondition
} from './time-utils.js';

import { 
  extractAvailableModels,
  switchModelAndPasteMessages,
  pasteMessagesIntoGemini
} from './gemini-page.js';

/**
 * 中央模型配置 - 所有模型相關的配置都在這裡定義
 */
export const GEMINI_MODELS_CONFIG = {
  // 模型顯示名稱映射（用於 Gemini UI 中的識別）
  MODEL_DISPLAY_MAP: {
    'gemini-2.5-flash': '2.5 Flash',
    'gemini-2.5-pro': '2.5 Pro'
  },
  
  // 預設選擇的模型
  DEFAULT_SELECTED_MODEL: 'auto'
};

/**
 * 背景同步狀態管理
 */
let backgroundSyncState = {
  isSyncing: false,
  lastSyncTime: 0,
  minSyncInterval: 10 * 1000 // 最小同步間隔 10 秒
};

/**
 * 執行背景模型同步
 * @returns {Promise<void>}
 */
export async function performBackgroundModelSync() {
  const now = Date.now();
  
  // 檢查是否需要同步
  if (backgroundSyncState.isSyncing) {
    console.log('同步正在進行中，跳過此次同步');
    return;
  }

  backgroundSyncState.isSyncing = true;
  backgroundSyncState.lastSyncTime = now;

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

    // 使用 withTimeout 來添加總體超時控制
    await withTimeout(
      performSyncWithTab(geminiTab.id),
      syncTimeout,
      '同步操作超時'
    );

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
    backgroundSyncState.isSyncing = false;
  }
}

/**
 * 執行同步操作（分離出來以便更好的錯誤處理）
 * @param {number} tabId - 頁面 ID
 * @returns {Promise<void>}
 */
async function performSyncWithTab(tabId) {
  // 等待頁面載入完成
  console.log('📄 等待頁面載入完成...');
  await waitForTabLoad(tabId);
  
  // 使用 waitForGeminiPageReady 確保頁面完全準備就緒
  console.log('🔍 檢查頁面準備狀態...');
  await waitForGeminiPageReady(tabId);
  console.log('✅ 背景 Gemini 頁面已準備就緒');

  // 執行模型同步
  console.log('🔄 開始執行模型同步...');
  await syncModelsInTab(tabId);
  console.log('✅ 背景模型同步操作完成');
}

/**
 * 等待頁面載入完成
 * @param {number} tabId - 頁面 ID
 * @returns {Promise<void>}
 */
async function waitForTabLoad(tabId) {
  const loadTimeout = 30000; // 30 seconds timeout
  
  const loadPromise = new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo, _tab) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        console.log(`📄 Tab ${tabId} 載入完成，等待 3 秒確保穩定性...`);
        // 額外等待 3 秒確保頁面完全載入
        sleep(3000).then(resolve);
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
        sleep(1000).then(resolve);
      }
    });
  });
  
  return withTimeout(
    loadPromise,
    loadTimeout,
    `頁面載入超時 (${loadTimeout/1000} 秒)`
  );
}

/**
 * 在指定頁面中同步模型
 * @param {number} tabId - 頁面 ID
 * @returns {Promise<void>}
 */
async function syncModelsInTab(tabId) {
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
    
    // 使用 withTimeout 來添加超時控制
    await withTimeout(
      syncAvailableModels(tabId),
      syncTimeout,
      '模型同步操作超時'
    );
    
    console.log('✅ 背景模型同步成功');
  } catch (error) {
    console.error('❌ 背景模型同步失敗:', error);
    throw error;
  }
}

/**
 * 獲取背景同步狀態
 * @returns {Object} 同步狀態信息
 */
export function getBackgroundSyncState() {
  return {
    isSyncing: backgroundSyncState.isSyncing,
    lastSyncTime: backgroundSyncState.lastSyncTime
  };
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
    // 首先注入工具函數到頁面中
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/injected-utils.js']
    });
    
    console.log('✅ 工具函數已注入到頁面中');
    
    // 然後執行模型檢測函數
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
    } else {
      completeModelsList = [];
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
 * 智能等待 Gemini 頁面準備就緒
 * @param {number} tabId - Gemini 頁面的 tab ID
 * @returns {Promise<void>} - 當頁面準備就緒時解析
 */
export async function waitForGeminiPageReady(tabId) {
  const checkPageReadiness = async () => {
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: checkGeminiPageReadiness
      });
      
      if (result && result[0] && result[0].result && result[0].result.isReady) {
        console.log(`✅ Gemini page ready`);
        return true;
      }
      
      console.log(`❌ Gemini page not ready yet. Reason:`, result[0]?.result?.reason);
      return false;
    } catch (error) {
      console.warn(`Error checking page readiness:`, error);
      return false;
    }
  };

  await waitForCondition(checkPageReadiness, {
    maxAttempts: 8,
    intervalMs: 500,
    operationName: 'Gemini 頁面準備檢查'
  });
  
  // 短暫延遲確保穩定性
  await sleep(200);
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
            
            // 非自動模式，直接切換模型並貼上訊息
            console.log('非自動模式，直接切換模型並貼上訊息...');
            await switchGeminiModelAndPasteMessages(geminiTab.id, selectedModel, messages);
          })
          .catch((error) => {
            console.error('❌ 等待 Gemini 頁面準備就緒失敗:', error);
            // 如果等待失敗，仍然嘗試執行操作（作為備用方案）
            console.log('使用備用方案繼續執行...');
            sleep(2000).then(async () => {
              if (isAutoModel(selectedModel)) {
                await pasteMessagesDirectly(geminiTab.id, messages);
              } else {
                await switchGeminiModelAndPasteMessages(geminiTab.id, selectedModel, messages);
              }
            });
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
 * 切換 Gemini 模型並貼上訊息
 * @param {number} tabId - Gemini 頁面的 tab ID
 * @param {string} selectedModel - 選擇的模型
 * @param {string} messages - 要貼上的訊息
 */
export async function switchGeminiModelAndPasteMessages(tabId, selectedModel, messages) {
  try {
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
      
      console.log('📊 Gemini Utils: Storage analysis:', {
        syncedModelsCount: syncedModels.length,
        lastUpdated: new Date(lastUpdated).toISOString(),
        hasStoredModels: syncedModels.length > 0
      });
      
      // 如果有儲存的模型，直接使用它們（不檢查時間）
      if (syncedModels.length > 0) {
        console.log('✅ Gemini Utils: Using synced models:', syncedModels.length, '個模型');
        console.log('📋 Gemini Utils: Synced models:', syncedModels);
        resolve(syncedModels);
      } else {
        console.log('🔄 Gemini Utils: No synced models available, returning empty array');
        resolve([]);
      }
    });
  });
}

/**
 * 檢查模型是否為自動模式
 * @param {string} modelValue - 模型值
 * @returns {boolean} - 是否為自動模式
 */
export function isAutoModel(modelValue) {
  return modelValue === 'auto';
} 