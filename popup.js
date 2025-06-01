/******/ (function() { // webpackBootstrap
/******/ 	"use strict";
document.addEventListener('DOMContentLoaded', function () {
  const statusIcon = document.getElementById('statusIcon');
  const statusText = document.getElementById('statusText');
  const systemPromptInput = document.getElementById('systemPromptInput');
  const savePromptBtn = document.getElementById('savePromptBtn');
  const resetPromptBtn = document.getElementById('resetPromptBtn');
  const loadCurrentBtn = document.getElementById('loadCurrentBtn');
  const promptActionStatus = document.getElementById('promptActionStatus');
  const currentPromptDisplay = document.getElementById('currentPromptDisplay');
  const promptLength = document.getElementById('promptLength');
  const promptStatus = document.getElementById('promptStatus');

  // 滾動設定相關元素
  const saveScrollSettings = document.getElementById('saveScrollSettings');
  const resetScrollSettings = document.getElementById('resetScrollSettings');
  const loadScrollSettings = document.getElementById('loadScrollSettings');
  const scrollActionStatus = document.getElementById('scrollActionStatus');

  // 同步設定相關元素
  const manualSyncPopupBtn = document.getElementById('manualSyncPopupBtn');
  const checkSyncStatusBtn = document.getElementById('checkSyncStatusBtn');
  const refreshModelsBtn = document.getElementById('refreshModelsBtn');
  const syncStatusDisplay = document.getElementById('syncStatusDisplay');
  const syncStatusIcon = document.getElementById('syncStatusIcon');
  const syncStatusText = document.getElementById('syncStatusText');
  const modelsListDisplay = document.getElementById('modelsListDisplay');
  const modelsCount = document.getElementById('modelsCount');
  const modelsLastUpdate = document.getElementById('modelsLastUpdate');
  const syncActionStatus = document.getElementById('syncActionStatus');
  console.log('Popup loaded, starting Slack page check...');

  // 設置標籤頁功能
  setupTabSwitching();

  // 載入已保存的 AI 提示詞 並顯示預覽
  loadAndDisplayCurrentPrompt();

  // 載入滾動設定
  loadCurrentScrollSettings();

  // 設置 AI 提示詞 相關事件監聽器
  setupSystemPromptHandlers();

  // 設置滾動設定相關事件監聽器
  setupScrollSettingsHandlers();

  // 設置同步相關事件監聽器
  setupSyncHandlers();

  // 檢查當前活動頁面是否為Slack
  checkSlackPage();
  async function loadAndDisplayCurrentPrompt() {
    try {
      chrome.storage.local.get(['customSystemPrompt'], function (result) {
        const customPrompt = result.customSystemPrompt || '';

        // 更新預覽顯示
        updatePromptDisplay(customPrompt);

        // 如果有自定義 prompt，也載入到編輯區域
        if (customPrompt.trim()) {
          systemPromptInput.value = customPrompt;
        }
      });
    } catch (error) {
      console.error('載入 prompt 時發生錯誤:', error);
      showPromptActionStatus('❌ 載入失敗', 'error');
    }
  }
  function updatePromptDisplay(promptText) {
    const displayElement = currentPromptDisplay;
    const lengthElement = promptLength;
    const statusElement = promptStatus;

    // 清除之前的樣式類別
    displayElement.className = 'prompt-display';
    if (!promptText || promptText.trim() === '') {
      // 沒有自定義 prompt，顯示預設 prompt 內容
      const defaultPrompt = getDefaultSystemPrompt();
      const truncatedDefault = defaultPrompt.length > 300 ? defaultPrompt.substring(0, 300) + '\n\n... (預設內容已截斷)' : defaultPrompt;
      displayElement.textContent = truncatedDefault;
      displayElement.classList.add('default-prompt');
      lengthElement.textContent = `字數：${defaultPrompt.length}（預設）`;
      statusElement.textContent = '狀態：預設模式';
    } else {
      // 有自定義 prompt，顯示內容
      const truncatedText = promptText.length > 300 ? promptText.substring(0, 300) + '\n\n... (內容已截斷，完整內容請查看編輯區域)' : promptText;
      displayElement.textContent = truncatedText;
      displayElement.classList.add('custom-prompt');
      lengthElement.textContent = `字數：${promptText.length}`;
      statusElement.textContent = '狀態：自定義模式';
    }
  }
  function getDefaultSystemPrompt() {
    // 返回與 ThreadAnalyzer 中相同的預設 prompt
    return `請幫我總結以下 Slack 討論串的內容（以 Markdown 格式提供）：

**請注意：以下內容使用 Markdown 格式，包含可點擊的鏈接和用戶提及**

{MESSAGES}

請提供：
1. **討論的主要議題**
  - 如果有不同的議題，請分開列出，並標示相關的訊息。
2. **關鍵決策或結論**
  - 如果有不同的決策，請分開列出，並標示相關的訊息。
3. **需要後續行動的項目**
  - 如果有不同的需要後續行動的項目，請分開列出，並標示相關的負責人。
4. **其他重要事項**
  - 如果有其他重要事項，請分開列出，並標示相關的訊息。

*請在回應中保留 Markdown 格式，特別是鏈接和用戶提及*`;
  }
  function setupSystemPromptHandlers() {
    // 保存按鈕
    savePromptBtn.addEventListener('click', function () {
      const promptText = systemPromptInput.value.trim();
      chrome.storage.local.set({
        'customSystemPrompt': promptText
      }, function () {
        if (chrome.runtime.lastError) {
          showPromptActionStatus('❌ 保存失敗', 'error');
        } else {
          if (promptText) {
            showPromptActionStatus('✅ 自定義 prompt 已保存', 'success');
          } else {
            showPromptActionStatus('✅ 已清除自定義 prompt，將使用預設', 'success');
          }

          // 更新預覽顯示
          updatePromptDisplay(promptText);
        }
      });
    });

    // 重置按鈕
    resetPromptBtn.addEventListener('click', function () {
      systemPromptInput.value = '';
      chrome.storage.local.remove(['customSystemPrompt'], function () {
        if (chrome.runtime.lastError) {
          showPromptActionStatus('❌ 重置失敗', 'error');
        } else {
          showPromptActionStatus('🔄 已重置為預設 prompt', 'success');

          // 更新預覽顯示
          updatePromptDisplay('');
        }
      });
    });

    // 載入當前設定按鈕
    loadCurrentBtn.addEventListener('click', function () {
      chrome.storage.local.get(['customSystemPrompt'], function (result) {
        const customPrompt = result.customSystemPrompt || '';
        if (customPrompt.trim()) {
          systemPromptInput.value = customPrompt;
          showPromptActionStatus('📥 已載入當前保存的設定', 'info');
        } else {
          systemPromptInput.value = '';
          showPromptActionStatus('📥 當前使用預設設定（已清空編輯區域）', 'info');
        }
      });
    });

    // 監聽輸入區域變化，提供即時字數統計
    systemPromptInput.addEventListener('input', function () {
      const currentText = systemPromptInput.value;
      const charCount = currentText.length;

      // 更新字數顯示（但不更新預覽，只有保存後才更新預覽）
      if (charCount > 0) {
        promptLength.textContent = `字數：${charCount}（編輯中）`;
      } else {
        promptLength.textContent = '字數：0（編輯中）';
      }
    });
  }
  function showPromptActionStatus(message, type) {
    promptActionStatus.textContent = message;
    promptActionStatus.className = `prompt-status ${type}`;

    // 3秒後清除狀態訊息
    setTimeout(() => {
      promptActionStatus.textContent = '';
      promptActionStatus.className = 'prompt-status';
    }, 3000);
  }
  function checkSlackPage() {
    chrome.tabs.query({
      active: true,
      currentWindow: true
    }, function (tabs) {
      const currentTab = tabs[0];
      console.log('Current tab:', currentTab);
      if (!currentTab) {
        updateStatus('❌', '無法檢測當前頁面', 'error');
        return;
      }
      console.log('Current URL:', currentTab.url);
      if (currentTab.url && currentTab.url.includes('slack.com')) {
        updateStatus('✅', '在 Slack 頁面中 - 檢查討論串...', 'success');

        // 等待一下再檢查討論串，給content script時間載入
        setTimeout(() => {
          checkThreadAvailability(currentTab.id);
        }, 1000);
      } else {
        updateStatus('⚠️', '請開啟 Slack 網頁版', 'error');
      }
    });
  }
  function checkThreadAvailability(tabId) {
    console.log('Checking thread availability for tab:', tabId);

    // 檢查是否有討論串可用
    chrome.tabs.sendMessage(tabId, {
      action: 'checkThreadAvailable'
    }, function (response) {
      console.log('Response from content script:', response);
      console.log('Runtime error:', chrome.runtime.lastError);
      if (chrome.runtime.lastError) {
        console.error('Content script communication error:', chrome.runtime.lastError.message);

        // 嘗試注入備用腳本進行基本檢測
        updateStatus('🔄', '正在載入備用檢測腳本...', 'loading');
        chrome.scripting.executeScript({
          target: {
            tabId: tabId
          },
          files: ['content-inject.js']
        }, function (_results) {
          if (chrome.runtime.lastError) {
            console.error('Backup script injection failed:', chrome.runtime.lastError.message);
            updateStatus('❌', '請重新整理 Slack 頁面以載入完整功能', 'error');
          } else {
            console.log('Backup script injected successfully, retrying check...');
            updateStatus('⚡', '備用腳本已載入，正在檢查...', 'loading');

            // 重新檢查
            setTimeout(() => {
              checkThreadAvailability(tabId);
            }, 2000);
          }
        });
        return;
      }
      if (response && response.hasThread) {
        updateStatus('🎯', '找到討論串 - 點擊摘要按鈕開始', 'ready');
      } else if (response) {
        updateStatus('📄', '在 Slack 中 - 請開啟一個討論串', 'warning');
      } else {
        updateStatus('⚠️', '無法檢測討論串狀態', 'warning');
      }
    });
  }
  function updateStatus(icon, text, statusClass) {
    console.log('Status update:', icon, text, statusClass);
    statusIcon.textContent = icon;
    statusText.textContent = text;

    // 移除所有狀態類別
    const statusContainer = document.getElementById('slackStatus');
    statusContainer.className = 'status-indicator';

    // 添加新的狀態類別
    if (statusClass) {
      statusContainer.classList.add(statusClass);
    }
  }

  // 設置標籤頁切換功能
  function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');

        // 移除所有活動狀態
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        // 設置新的活動狀態
        button.classList.add('active');
        document.getElementById(`${targetTab}-tab`).classList.add('active');
      });
    });
  }

  // 載入滾動設定
  function loadCurrentScrollSettings() {
    chrome.storage.local.get(['slack_summary_config'], function (result) {
      const config = result.slack_summary_config || {};
      const scrollSettings = config.scrollSettings || getDefaultScrollSettings();

      // 更新界面
      updateScrollSettingsUI(scrollSettings);
    });
  }

  // 獲取預設滾動設定
  function getDefaultScrollSettings() {
    return {
      scrollDelay: 400,
      maxScrollAttempts: 300,
      noMaxNewMessagesCount: 12,
      scrollStep: 600,
      minScrollAmount: 100
    };
  }

  // 更新滾動設定界面
  function updateScrollSettingsUI(settings) {
    Object.keys(settings).forEach(key => {
      const input = document.getElementById(key);
      if (input) {
        input.value = settings[key];
      }
    });
  }

  // 設置滾動設定事件監聽器
  function setupScrollSettingsHandlers() {
    // 保存滾動設定
    saveScrollSettings.addEventListener('click', function () {
      const scrollSettings = collectScrollSettings();
      chrome.storage.local.get(['slack_summary_config'], function (result) {
        const config = result.slack_summary_config || {};
        config.scrollSettings = {
          ...config.scrollSettings,
          ...scrollSettings
        };
        chrome.storage.local.set({
          'slack_summary_config': config
        }, function () {
          if (chrome.runtime.lastError) {
            showScrollActionStatus('❌ 保存失敗', 'error');
          } else {
            showScrollActionStatus('✅ 滾動設定已保存', 'success');
          }
        });
      });
    });

    // 重置滾動設定
    resetScrollSettings.addEventListener('click', function () {
      if (confirm('確定要重置滾動設定為預設值嗎？')) {
        const defaultSettings = getDefaultScrollSettings();
        updateScrollSettingsUI(defaultSettings);
        chrome.storage.local.get(['slack_summary_config'], function (result) {
          const config = result.slack_summary_config || {};
          config.scrollSettings = defaultSettings;
          chrome.storage.local.set({
            'slack_summary_config': config
          }, function () {
            if (chrome.runtime.lastError) {
              showScrollActionStatus('❌ 重置失敗', 'error');
            } else {
              showScrollActionStatus('🔄 已重置為預設值', 'success');
            }
          });
        });
      }
    });

    // 載入當前滾動設定
    loadScrollSettings.addEventListener('click', function () {
      loadCurrentScrollSettings();
      showScrollActionStatus('📥 已載入當前設定', 'info');
    });
  }

  // 收集滾動設定
  function collectScrollSettings() {
    const settings = {};
    const settingIds = ['scrollDelay', 'maxScrollAttempts', 'noMaxNewMessagesCount', 'scrollStep', 'minScrollAmount'];
    settingIds.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        const value = parseInt(input.value);
        if (!isNaN(value)) {
          settings[id] = value;
        }
      }
    });
    return settings;
  }

  // 顯示滾動設定狀態
  function showScrollActionStatus(message, type) {
    scrollActionStatus.textContent = message;
    scrollActionStatus.className = `scroll-status ${type} show`;

    // 3秒後清除狀態訊息
    setTimeout(() => {
      scrollActionStatus.textContent = '';
      scrollActionStatus.className = 'scroll-status';
    }, 3000);
  }

  // ===================== 同步功能相關函數 =====================

  function setupSyncHandlers() {
    // 初始載入同步狀態和模型列表
    loadSyncStatus();
    loadModelsList();

    // 手動同步按鈕
    manualSyncPopupBtn.addEventListener('click', function () {
      triggerManualSync();
    });

    // 檢查狀態按鈕
    checkSyncStatusBtn.addEventListener('click', function () {
      loadSyncStatus();
    });

    // 重新載入模型列表按鈕
    refreshModelsBtn.addEventListener('click', function () {
      loadModelsList();
    });
  }
  function loadSyncStatus() {
    updateSyncStatus('⏳', '檢查同步狀態中...');
    chrome.runtime.sendMessage({
      action: 'getBackgroundSyncStatus'
    }, response => {
      if (chrome.runtime.lastError) {
        updateSyncStatus('❌', '無法連接到背景腳本');
        console.error('Error getting sync status:', chrome.runtime.lastError);
      } else if (response) {
        const statusIcons = {
          'synced': '✅',
          'syncing': '🔄',
          'error': '❌',
          'unknown': '❓'
        };
        const icon = statusIcons[response.status] || '❓';
        const message = response.message || '狀態未知';
        updateSyncStatus(icon, message);
        console.log('Sync status updated:', response);
      } else {
        updateSyncStatus('❓', '同步狀態未知');
      }
    });
  }
  function updateSyncStatus(icon, text) {
    syncStatusIcon.textContent = icon;
    syncStatusText.textContent = text;
  }
  function loadModelsList() {
    // 顯示載入狀態
    modelsListDisplay.innerHTML = '<div class="models-placeholder">載入模型列表中...</div>';
    modelsCount.textContent = '模型數量：載入中';
    modelsLastUpdate.textContent = '最後更新：載入中';
    chrome.runtime.sendMessage({
      action: 'getAvailableModels'
    }, response => {
      if (chrome.runtime.lastError) {
        console.error('Error getting models:', chrome.runtime.lastError);
        displayModelsError('無法載入模型列表');
        return;
      }
      if (response && response.models && Array.isArray(response.models)) {
        displayModelsList(response.models);
        updateModelsInfo(response.models);
      } else {
        console.warn('Invalid models response:', response);
        displayModelsError('模型資料格式無效');
      }
    });

    // 同時獲取最後更新時間
    chrome.storage.local.get(['modelsLastUpdated'], result => {
      const lastUpdated = result.modelsLastUpdated;
      if (lastUpdated) {
        const updateTime = new Date(lastUpdated);
        const now = new Date();
        const diffHours = Math.floor((now - updateTime) / (1000 * 60 * 60));
        if (diffHours < 1) {
          modelsLastUpdate.textContent = '最後更新：不到1小時前';
        } else if (diffHours < 24) {
          modelsLastUpdate.textContent = `最後更新：${diffHours}小時前`;
        } else {
          const diffDays = Math.floor(diffHours / 24);
          modelsLastUpdate.textContent = `最後更新：${diffDays}天前`;
        }
      } else {
        modelsLastUpdate.textContent = '最後更新：未知';
      }
    });
  }
  function displayModelsList(models) {
    if (!models || models.length === 0) {
      modelsListDisplay.innerHTML = '<div class="models-placeholder">尚無可用模型</div>';
      return;
    }
    const modelsHTML = models.map(model => {
      const isDefaultModel = model.value === 'auto';
      const badgeHTML = isDefaultModel ? '<span class="model-badge default">預設</span>' : '<span class="model-badge synced">同步</span>';
      return `
        <div class="model-item">
          <div class="model-info">
            <div class="model-name">${model.displayName || model.value}</div>
            <div class="model-description">${model.description || '無描述'}</div>
          </div>
          ${badgeHTML}
        </div>
      `;
    }).join('');
    modelsListDisplay.innerHTML = modelsHTML;
  }
  function displayModelsError(errorMessage) {
    modelsListDisplay.innerHTML = `<div class="models-placeholder" style="color: #dc3545;">${errorMessage}</div>`;
    modelsCount.textContent = '模型數量：載入失敗';
    modelsLastUpdate.textContent = '最後更新：載入失敗';
  }
  function updateModelsInfo(models) {
    const totalModels = models.length;
    const syncedModels = models.filter(model => model.value !== 'auto').length;
    if (syncedModels > 0) {
      modelsCount.textContent = `模型數量：${totalModels} (${syncedModels} 個已同步)`;
    } else {
      modelsCount.textContent = `模型數量：${totalModels} (僅預設模型)`;
    }
  }
  function triggerManualSync() {
    // 更新按鈕狀態
    const originalText = manualSyncPopupBtn.textContent;
    manualSyncPopupBtn.disabled = true;
    manualSyncPopupBtn.textContent = '🔄 同步中...';
    manualSyncPopupBtn.style.backgroundColor = '#007bff';

    // 更新同步狀態
    updateSyncStatus('🔄', '正在手動同步模型...');
    showSyncActionStatus('🔄 開始手動同步...', 'info');
    chrome.runtime.sendMessage({
      action: 'triggerBackgroundSync'
    }, response => {
      // 恢復按鈕狀態
      manualSyncPopupBtn.disabled = false;
      manualSyncPopupBtn.textContent = originalText;
      manualSyncPopupBtn.style.backgroundColor = '';
      if (chrome.runtime.lastError) {
        updateSyncStatus('❌', '手動同步失敗');
        showSyncActionStatus('❌ 手動同步失敗: ' + chrome.runtime.lastError.message, 'error');
        console.error('Manual sync failed:', chrome.runtime.lastError);
      } else if (response && response.success) {
        updateSyncStatus('✅', '手動同步成功完成');
        showSyncActionStatus('✅ 手動同步成功完成', 'success');

        // 3秒後重新載入模型列表和狀態
        setTimeout(() => {
          loadSyncStatus();
          loadModelsList();
        }, 3000);
      } else {
        updateSyncStatus('❌', '手動同步失敗');
        showSyncActionStatus('❌ 手動同步失敗: ' + ((response === null || response === void 0 ? void 0 : response.error) || '未知錯誤'), 'error');
        console.error('Manual sync failed:', response);
      }
    });
  }
  function showSyncActionStatus(message, type) {
    syncActionStatus.textContent = message;
    syncActionStatus.className = `sync-status ${type} show`;

    // 5秒後清除狀態訊息
    setTimeout(() => {
      syncActionStatus.textContent = '';
      syncActionStatus.className = 'sync-status';
    }, 5000);
  }

  // 減少檢查頻率，避免過度請求
  setInterval(checkSlackPage, 10000);
});
/******/ })()
;
//# sourceMappingURL=popup.js.map