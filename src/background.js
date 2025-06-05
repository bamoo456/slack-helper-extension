// Slack Helper Background Script

// Import all Gemini-related utilities from gemini-utils.js
import {
  triggerBackgroundModelSync,
  getBackgroundSyncState,
  syncAvailableModels,
  handleGeminiSummaryRequest,
  getAvailableModels,
} from './gemini-utils.js';

// 全局變量存儲當前翻譯
let currentTranslations = null;

// 載入翻譯文件
async function loadTranslations() {
  try {
    // 獲取用戶選擇的語言
    const result = await chrome.storage.local.get(['selectedLanguage']);
    const language = result.selectedLanguage || 'zh-TW';
    
    // 載入對應的翻譯文件
    const response = await fetch(chrome.runtime.getURL(`locales/${language}/translation.json`));
    const translations = await response.json();
    
    currentTranslations = translations;
    console.log(`Background script loaded translations for: ${language}`);
    return translations;
  } catch (error) {
    console.error('Failed to load translations in background script:', error);
    // 如果載入失敗，返回空對象，使用硬編碼的中文作為備用
    return {};
  }
}

// 獲取翻譯文字的輔助函數
function getTranslation(key, fallback, params = {}) {
  if (!currentTranslations) {
    return fallback;
  }
  
  const keys = key.split('.');
  let value = currentTranslations;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return fallback;
    }
  }
  
  // 如果有參數需要替換
  if (typeof value === 'string' && Object.keys(params).length > 0) {
    Object.keys(params).forEach(param => {
      value = value.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
    });
  }
  
  return value || fallback;
}

// 初始化翻譯
loadTranslations();

// 監聽語言變更
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.selectedLanguage) {
    console.log('Language changed, reloading translations...');
    loadTranslations();
    
    // 廣播語言變更消息給所有 content script
    broadcastLanguageChange(changes.selectedLanguage.newValue);
  }
});

/**
 * 廣播語言變更消息給所有活動的標籤頁
 */
async function broadcastLanguageChange(newLanguage) {
  try {
    // 獲取所有標籤頁
    const tabs = await chrome.tabs.query({});
    
    // 向每個標籤頁發送語言變更消息
    const promises = tabs.map(async (tab) => {
      try {
        // 只向 Slack 頁面發送消息
        if (tab.url && tab.url.includes('slack.com')) {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'languageChanged',
            newLanguage: newLanguage
          });
          console.log(`Language change notification sent to tab ${tab.id}`);
        }
      } catch (error) {
        // 忽略無法發送消息的標籤頁（可能沒有 content script）
        console.log(`Could not send language change to tab ${tab.id}:`, error.message);
      }
    });
    
    await Promise.allSettled(promises);
    console.log('Language change notifications sent to all applicable tabs');
  } catch (error) {
    console.error('Error broadcasting language change:', error);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.action === 'openGeminiWithMessages') {
    handleGeminiSummaryRequest(request.messages, sender.tab, request.selectedModel);
    sendResponse({ success: true });
  } else if (request.action === 'getSlackThreadMessages') {
    extractSlackThreadMessages(request.tabId)
      .then(messages => sendResponse({ messages }))
      .catch(error => sendResponse({ error: error.message }));
    return true; // 保持異步響應開啟
  } else if (request.action === 'syncGeminiModels') {
    // 處理模型同步請求
    let tabId = request.tabId;
    
    // 如果 tabId 是 'current'，使用發送者的 tab ID
    if (tabId === 'current' && sender.tab) {
      tabId = sender.tab.id;
    }
    
    if (tabId && typeof tabId === 'number') {
      syncAvailableModels(tabId)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ error: error.message }));
    } else {
      sendResponse({ error: 'Valid Tab ID is required for model sync' });
    }
    return true; // 保持異步響應開啟
  } else if (request.action === 'triggerBackgroundSync') {
    // 處理手動觸發背景同步請求
    console.log(getTranslation('background.syncRequestReceived', '收到手動同步請求'));
    
    triggerBackgroundModelSync()
      .then(() => {
        console.log(getTranslation('background.syncCompleted', '手動同步成功完成'));
        sendResponse({ 
          success: true, 
          message: getTranslation('background.syncCompletedMessage', '手動同步成功完成'),
          timestamp: Date.now()
        });
      })
      .catch(error => {
        console.error(getTranslation('background.syncFailed', '手動同步失敗') + ':', error);
        sendResponse({ 
          success: false, 
          error: error.message || getTranslation('background.syncFailed', '手動同步失敗'),
          timestamp: Date.now()
        });
      });
    return true; // 保持異步響應開啟
  } else if (request.action === 'getBackgroundSyncStatus') {
    // 獲取背景同步狀態
    const now = Date.now();
    let status, message;
    
    const syncState = getBackgroundSyncState();
    
    if (syncState.isSyncing) {
      status = 'syncing';
      message = getTranslation('background.syncInProgress', '背景同步進行中...');
      sendResponse({ status, message });
    } else if (syncState.lastSyncTime > 0) {
      const timeDiff = now - syncState.lastSyncTime;
      const minutes = Math.floor(timeDiff / (1000 * 60));
      const hours = Math.floor(minutes / 60);
      
      if (minutes < 5) {
        status = 'synced';
        message = getTranslation('background.syncJustCompleted', '剛完成同步');
      } else if (minutes < 60) {
        status = 'synced';
        message = getTranslation('background.syncMinutesAgo', '{{minutes}} 分鐘前同步完成', { minutes });
      } else if (hours < 24) {
        status = 'synced';
        message = getTranslation('background.syncHoursAgo', '{{hours}} 小時前同步完成', { hours });
      } else {
        status = 'unknown';
        message = getTranslation('background.syncNeedsUpdate', '需要重新同步');
      }
      sendResponse({ status, message });
    } else {
      // 檢查 storage 中的最後更新時間
      chrome.storage.local.get(['modelsLastUpdated'], (result) => {
        const lastUpdated = result.modelsLastUpdated;
        if (lastUpdated) {
          const timeDiff = now - lastUpdated;
          const hours = Math.floor(timeDiff / (1000 * 60 * 60));
          
          if (hours < 1) {
            status = 'synced';
            message = getTranslation('background.syncedRecently', '模型已同步 (< 1小時前)');
          } else if (hours < 24) {
            status = 'synced';
            message = getTranslation('background.syncedHoursAgo', '模型已同步 ({{hours}}小時前)', { hours });
          } else {
            status = 'unknown';
            message = getTranslation('background.syncNeedsRefresh', '模型需要更新');
          }
        } else {
          status = 'error';
          message = getTranslation('background.neverSynced', '尚未同步');
        }
        sendResponse({ status, message });
      });
      return true; // 保持異步響應開啟
    }
  } else if (request.action === 'getAvailableModels') {
    console.log('📥 Background: Received getAvailableModels request');
    
    // 處理獲取可用模型列表請求
    getAvailableModels()
      .then(models => {
        console.log('✅ Background: getAvailableModels resolved with', models.length, 'models');
        console.log('📋 Background: Models list:', models);
        sendResponse({ models });
      })
      .catch(error => {
        console.error('❌ Background: getAvailableModels failed:', error);
        sendResponse({ error: error.message });
      });
    return true; // 保持異步響應開啟
  }
});

async function extractSlackThreadMessages(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: extractMessagesFromSlack
    });

    if (results && results[0] && results[0].result) {
      return results[0].result;
    } else {
      throw new Error(getTranslation('background.extractSlackError', '無法提取Slack訊息'));
    }
  } catch (error) {
    console.error('Error extracting messages:', error);
    throw error;
  }
}

// 在Slack頁面中執行的函數
function extractMessagesFromSlack() {
  const messages = [];
  
  // 嘗試多種消息選擇器
  const messageSelectors = [
    '.c-virtual_list__item',
    '.p-thread_view__message',
    '.c-message',
    '[data-qa="message"]'
  ];

  let messageElements = [];
  for (const selector of messageSelectors) {
    messageElements = document.querySelectorAll(selector);
    if (messageElements.length > 0) break;
  }

  messageElements.forEach((messageEl) => {
    try {
      // 提取用戶名
      const userSelectors = [
        '.c-message__sender_link',
        '.c-message__sender',
        '[data-qa="message_sender_name"]'
      ];
      
      let userName = 'Unknown User';
      for (const selector of userSelectors) {
        const userEl = messageEl.querySelector(selector);
        if (userEl) {
          userName = userEl.textContent.trim();
          break;
        }
      }

      // 提取訊息文字
      const textSelectors = [
        '.c-message__body',
        '.p-rich_text_section',
        '[data-qa="message_text"]'
      ];

      let messageText = '';
      for (const selector of textSelectors) {
        const textEl = messageEl.querySelector(selector);
        if (textEl) {
          messageText = textEl.textContent.trim();
          break;
        }
      }

      // 提取時間
      const timeEl = messageEl.querySelector('.c-timestamp, [data-qa="message_timestamp"]');
      const timestamp = timeEl ? (timeEl.getAttribute('title') || timeEl.textContent.trim()) : '';

      if (messageText.trim()) {
        messages.push({
          user: userName,
          text: messageText,
          timestamp: timestamp
        });
      }
    } catch (error) {
      console.log('Error extracting individual message:', error);
    }
  });

  return messages;
}

// 監聽安裝事件
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Slack Helper installed');
  
  if (details.reason === 'install') {
    console.log(getTranslation('background.firstInstall', '首次安裝完成'));
  } else if (details.reason === 'update') {
    console.log(getTranslation('background.extensionUpdate', '擴充功能更新完成'));
  }
});

// 監聽擴充功能啟動事件
chrome.runtime.onStartup.addListener(() => {
  console.log(getTranslation('background.chromeStartup', 'Chrome 啟動，初始化背景模型同步'));
  // 啟動時不需要立即同步，等待用戶操作時再同步
}); 