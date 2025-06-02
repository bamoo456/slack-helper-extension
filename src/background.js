// Slack Helper Background Script

// Import all Gemini-related utilities from gemini-utils.js
import {
  GEMINI_MODELS_CONFIG,
  BackgroundModelSyncManager,
  getGeminiModelDisplayName,
  generateGeminiUrl,
  getAvailableGeminiModels,
  syncAvailableModels,
  shouldSyncModels,
  waitForGeminiPageReady,
  checkGeminiPageReadiness,
  handleGeminiSummaryRequest,
  pasteMessagesDirectly,
  pasteMessagesIntoGemini,
  switchGeminiModelAndPasteMessages,
  extractAvailableModels,
  switchModelAndPasteMessages,
  getAvailableModels,
  getDefaultModels,
  isAutoModel
} from './gemini-utils.js';

// 創建背景同步管理器實例
const backgroundSyncManager = new BackgroundModelSyncManager();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
    console.log('收到手動同步請求');
    backgroundSyncManager.manualSync()
      .then(() => {
        console.log('手動同步成功完成');
        sendResponse({ 
          success: true, 
          message: '手動同步成功完成',
          timestamp: Date.now()
        });
      })
      .catch(error => {
        console.error('手動同步失敗:', error);
        sendResponse({ 
          success: false, 
          error: error.message || '手動同步失敗',
          timestamp: Date.now()
        });
      });
    return true; // 保持異步響應開啟
  } else if (request.action === 'getBackgroundSyncStatus') {
    // 獲取背景同步狀態
    const now = Date.now();
    let status, message;
    
    if (backgroundSyncManager.isSyncing) {
      status = 'syncing';
      message = '背景同步進行中...';
    } else if (backgroundSyncManager.lastSyncTime > 0) {
      const timeDiff = now - backgroundSyncManager.lastSyncTime;
      const minutes = Math.floor(timeDiff / (1000 * 60));
      const hours = Math.floor(minutes / 60);
      
      if (minutes < 5) {
        status = 'synced';
        message = '剛完成同步';
      } else if (minutes < 60) {
        status = 'synced';
        message = `${minutes} 分鐘前同步完成`;
      } else if (hours < 24) {
        status = 'synced';
        message = `${hours} 小時前同步完成`;
      } else {
        status = 'unknown';
        message = '需要重新同步';
      }
    } else {
      // 檢查 storage 中的最後更新時間
      chrome.storage.local.get(['modelsLastUpdated'], (result) => {
        const lastUpdated = result.modelsLastUpdated;
        if (lastUpdated) {
          const timeDiff = now - lastUpdated;
          const hours = Math.floor(timeDiff / (1000 * 60 * 60));
          
          if (hours < 1) {
            sendResponse({
              status: 'synced',
              message: '模型已同步 (< 1小時前)'
            });
          } else if (hours < 24) {
            sendResponse({
              status: 'synced',
              message: `模型已同步 (${hours}小時前)`
            });
          } else {
            sendResponse({
              status: 'unknown',
              message: '模型需要更新'
            });
          }
        } else {
          sendResponse({
            status: 'error',
            message: '尚未同步'
          });
        }
      });
      return true; // 保持異步響應開啟
    }
    
    sendResponse({ status, message });
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
      throw new Error('無法提取Slack訊息');
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
  
  // 初始化背景同步管理器
  backgroundSyncManager.initialize();
  
  if (details.reason === 'install') {
    console.log('首次安裝完成');
  } else if (details.reason === 'update') {
    console.log('擴充功能更新完成');
  }
});

// 監聽擴充功能啟動事件
chrome.runtime.onStartup.addListener(() => {
  console.log('Chrome 啟動，初始化背景模型同步');
  backgroundSyncManager.initialize();
}); 