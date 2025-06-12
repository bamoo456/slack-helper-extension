/**
 * Popup Script for Slack Helper Extension
 */

// Removed unused imports: sleep, debounce

// 全局變量存儲當前翻譯
let currentTranslations = null;

document.addEventListener('DOMContentLoaded', function() {
  const statusIcon = document.getElementById('statusIcon');
  const statusText = document.getElementById('statusText');
  const systemPromptInput = document.getElementById('systemPromptInput');
  const savePromptBtn = document.getElementById('savePromptBtn');
  const resetPromptBtn = document.getElementById('resetPromptBtn');

  const promptActionStatus = document.getElementById('promptActionStatus');
  const currentPromptDisplay = document.getElementById('currentPromptDisplay');
  const promptLength = document.getElementById('promptLength');
  const promptStatus = document.getElementById('promptStatus');

  // 滾動設定相關元素
  const saveScrollSettings = document.getElementById('saveScrollSettings');
  const resetScrollSettings = document.getElementById('resetScrollSettings');

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

  // 語言切換相關元素
  const languageSelect = document.getElementById('languageSelect');

  console.log('Popup loaded, starting Slack page check...');
  
  // 設置標籤頁功能 (優先執行，確保基本功能可用)
  setupTabSwitching();
  
  // 初始化語言設定
  initializeLanguage();
  
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
  
  // 設置語言切換事件監聽器
  setupLanguageHandlers();
  
  // 設置 LLM 設定相關事件監聽器
  setupLLMSettingsHandlers();
  
  // 檢查當前活動頁面是否為Slack
  checkSlackPage();

  // 初始化語言設定
  async function initializeLanguage() {
    try {
      // 檢查是否在 Chrome Extension 環境中
      if (typeof chrome !== 'undefined' && chrome.storage) {
      // 載入保存的語言設定
      chrome.storage.local.get(['selectedLanguage'], function(result) {
        const savedLanguage = result.selectedLanguage || 'zh-TW';
          if (languageSelect) {
        languageSelect.value = savedLanguage;
          }
        
        // 應用語言設定
        applyLanguage(savedLanguage);
      });
      } else {
        console.warn('Chrome Extension API not available, using default language');
        // 使用預設語言
        applyLanguage('zh-TW');
      }
    } catch (error) {
      console.error('初始化語言設定時發生錯誤:', error);
      // 使用預設語言
      applyLanguage('zh-TW');
    }
  }

  // 設置語言切換事件監聽器
  function setupLanguageHandlers() {
    languageSelect.addEventListener('change', function() {
      const selectedLanguage = languageSelect.value;
      
      // 保存語言設定
      chrome.storage.local.set({
        'selectedLanguage': selectedLanguage
      }, function() {
        if (chrome.runtime.lastError) {
          console.error('保存語言設定失敗:', chrome.runtime.lastError);
        } else {
          // 應用新的語言設定
          applyLanguage(selectedLanguage);
        }
      });
    });
  }

  // 應用語言設定
  async function applyLanguage(language) {
    try {
      let translationUrl;
      
      // 檢查是否在 Chrome Extension 環境中
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        translationUrl = chrome.runtime.getURL(`locales/${language}/translation.json`);
      } else {
        // 在普通網頁環境中使用相對路徑
        translationUrl = `locales/${language}/translation.json`;
      }
      
      // 載入對應的翻譯文件
      const response = await fetch(translationUrl);
      const translations = await response.json();
      
      // 存儲當前翻譯
      currentTranslations = translations;
      
      // 更新頁面文字
      updatePageTexts(translations);
      
      console.log(`已切換到語言: ${language}`);
    } catch (error) {
      console.error('載入翻譯文件失敗:', error);
      // 如果載入失敗，嘗試載入預設語言
      if (language !== 'zh-TW') {
        applyLanguage('zh-TW');
      } else {
        // 如果連預設語言都載入失敗，使用內建的預設翻譯
        console.warn('Using fallback translations');
        currentTranslations = {
          title: 'Slack Thread Summary Tool',
          description: '在 Slack 討論串中使用「📝 摘要此討論串」按鈕來自動提取訊息並在 Gemini 中生成摘要。',
          tabs: {
            prompt: '📝 AI 提示詞',
            scroll: '⚙️ 滾動設定',
            sync: '🔄 模型同步',
            llm: '🤖 LLM API 設定'
          }
        };
        updatePageTexts(currentTranslations);
      }
    }
  }

  // 更新頁面文字
  function updatePageTexts(translations) {
    // 更新標題
    const titleElement = document.querySelector('h1');
    if (titleElement) {
      titleElement.textContent = translations.title;
    }

    // 更新描述
    const descriptionElement = document.querySelector('.description p');
    if (descriptionElement) {
      descriptionElement.textContent = translations.description;
    }

    // 更新語言選項
    updateLanguageOptions(translations);

    // 更新標籤頁
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach((button, index) => {
      const tabKey = button.getAttribute('data-tab');
      if (translations.tabs && translations.tabs[tabKey]) {
        button.textContent = translations.tabs[tabKey];
      }
    });

    // 更新 AI 提示詞區域
    updatePromptSectionTexts(translations);

    // 更新滾動設定區域
    updateScrollSectionTexts(translations);

    // 更新同步設定區域
    updateSyncSectionTexts(translations);

    // 更新 LLM 設定區域
    updateLLMSectionTexts(translations);

    // 更新使用說明
    updateUsageGuideTexts(translations);

    // 更新狀態和提示
    updateStatusTexts(translations);

    // 更新模態框文字
    updateModalTexts(translations);

    // 重新載入當前的 prompt 顯示（使用新語言）
    chrome.storage.local.get(['customSystemPrompt'], function(result) {
      const customPrompt = result.customSystemPrompt || '';
      updatePromptDisplay(customPrompt);
    });

    // 重新載入同步狀態和模型列表（使用新語言）
    loadSyncStatus();
    loadModelsList();
  }

  // 更新語言選項文字
  function updateLanguageOptions(translations) {
    const languageOptions = document.querySelectorAll('#languageSelect option');
    languageOptions.forEach(option => {
      const value = option.value;
      if (value === 'zh-TW') {
        option.textContent = '繁體中文';
      } else if (value === 'en') {
        option.textContent = 'English';
      }
    });
  }

  // 更新模態框文字
  function updateModalTexts(translations) {
    const modalSection = translations.modal;
    if (!modalSection) return;

    // 更新同步模態框
    const syncingTitle = document.querySelector('.modal-header h2');
    if (syncingTitle) syncingTitle.textContent = modalSection.syncingTitle;

    const syncMessage = document.getElementById('syncMessage');
    if (syncMessage) syncMessage.textContent = modalSection.syncMessage;

    const cancelSyncBtn = document.getElementById('cancelSyncBtn');
    if (cancelSyncBtn) cancelSyncBtn.textContent = modalSection.cancelSync;

    // 更新步驟文字
    const steps = [
      { id: 'step1', key: 'step1' },
      { id: 'step2', key: 'step2' },
      { id: 'step3', key: 'step3' },
      { id: 'step4', key: 'step4' }
    ];

    steps.forEach(step => {
      const stepElement = document.querySelector(`#${step.id} .step-text`);
      if (stepElement && modalSection[step.key]) {
        stepElement.textContent = modalSection[step.key];
      }
    });

    // 更新警告文字
    const syncWarnings = document.querySelectorAll('.sync-warning p');
    if (syncWarnings[0] && modalSection.warning1) {
      syncWarnings[0].textContent = modalSection.warning1;
    }
    if (syncWarnings[1] && modalSection.warning2) {
      syncWarnings[1].textContent = modalSection.warning2;
    }

    // 更新計時器文字（如果存在）
    const syncTimer = document.getElementById('syncTimer');
    if (syncTimer && modalSection.syncTimer) {
      const currentTime = syncTimer.textContent.match(/\d+/);
      if (currentTime) {
        syncTimer.textContent = modalSection.syncTimer.replace('{{time}}', currentTime[0]);
      }
    }
  }

  // 更新 AI 提示詞區域文字
  function updatePromptSectionTexts(translations) {
    const promptSection = translations.prompt;
    if (!promptSection) return;

    // 更新標題和提示
    const promptTitle = document.querySelector('#prompt-tab h3');
    if (promptTitle) promptTitle.textContent = promptSection.title;

    const promptHint = document.querySelector('.prompt-hint');
    if (promptHint) promptHint.innerHTML = promptSection.hint;

    const currentPromptTitle = document.querySelector('.current-prompt-preview h4');
    if (currentPromptTitle) currentPromptTitle.textContent = promptSection.currentPrompt;

    // 更新按鈕
    if (savePromptBtn) savePromptBtn.textContent = promptSection.save;
    if (resetPromptBtn) resetPromptBtn.textContent = promptSection.reset;
    

    // 更新標籤和佔位符
    const promptLabel = document.querySelector('label[for="systemPromptInput"]');
    if (promptLabel) promptLabel.textContent = promptSection.editLabel;

    if (systemPromptInput) {
      systemPromptInput.placeholder = promptSection.placeholder;
    }

    // 更新 prompt 顯示區域的預設文字
    const promptPlaceholder = document.querySelector('.prompt-placeholder');
    if (promptPlaceholder) {
      promptPlaceholder.textContent = promptSection.loading || '載入中...';
    }
  }

  // 更新滾動設定區域文字
  function updateScrollSectionTexts(translations) {
    const scrollSection = translations.scroll;
    if (!scrollSection) return;

    const scrollTitle = document.querySelector('#scroll-tab h3');
    if (scrollTitle) scrollTitle.textContent = scrollSection.title;

    const scrollHint = document.querySelector('#scroll-tab .settings-hint');
    if (scrollHint) scrollHint.textContent = scrollSection.hint;

    // 更新設定組標題
    const settingsGroups = document.querySelectorAll('#scroll-tab .settings-group h4');
    if (settingsGroups[0]) settingsGroups[0].textContent = scrollSection.basicSettings;
    if (settingsGroups[1]) settingsGroups[1].textContent = scrollSection.advancedSettings;

    // 更新標籤和描述
    const labels = {
      'scrollDelay': scrollSection.scrollDelay,
      'scrollStep': scrollSection.scrollStep,
      'minScrollAmount': scrollSection.minScrollAmount,
      'maxScrollAttempts': scrollSection.maxScrollAttempts,
      'noMaxNewMessagesCount': scrollSection.noMaxNewMessagesCount
    };

    Object.keys(labels).forEach(id => {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) label.textContent = labels[id];
    });

    // 更新描述文字
    const descriptions = {
      'scrollDelay': scrollSection.scrollDelayDesc,
      'scrollStep': scrollSection.scrollStepDesc,
      'minScrollAmount': scrollSection.minScrollAmountDesc,
      'maxScrollAttempts': scrollSection.maxScrollAttemptsDesc,
      'noMaxNewMessagesCount': scrollSection.noMaxNewMessagesCountDesc
    };

    Object.keys(descriptions).forEach(id => {
      const settingRow = document.querySelector(`#${id}`).closest('.setting-row');
      const smallElement = settingRow?.querySelector('small');
      if (smallElement && descriptions[id]) {
        smallElement.textContent = descriptions[id];
      }
    });

    // 更新按鈕
    const saveScrollBtn = document.getElementById('saveScrollSettings');
    const resetScrollBtn = document.getElementById('resetScrollSettings');
    if (saveScrollBtn) saveScrollBtn.textContent = scrollSection.save;
    if (resetScrollBtn) resetScrollBtn.textContent = scrollSection.reset;
  }

  // 更新同步設定區域文字
  function updateSyncSectionTexts(translations) {
    const syncSection = translations.sync;
    if (!syncSection) return;

    const syncTitle = document.querySelector('#sync-tab h3');
    if (syncTitle) syncTitle.textContent = syncSection.title;

    const syncHint = document.querySelector('#sync-tab .settings-hint');
    if (syncHint) syncHint.textContent = syncSection.hint;

    // 更新設定組標題
    const settingsGroups = document.querySelectorAll('#sync-tab .settings-group h4');
    if (settingsGroups[0]) settingsGroups[0].textContent = syncSection.syncStatus;
    if (settingsGroups[1]) settingsGroups[1].textContent = syncSection.availableModels;
    if (settingsGroups[2]) settingsGroups[2].textContent = syncSection.syncExplanation;

    // 更新按鈕
    if (manualSyncPopupBtn) manualSyncPopupBtn.textContent = syncSection.manualSync;
    if (checkSyncStatusBtn) checkSyncStatusBtn.textContent = syncSection.checkStatus;
    if (refreshModelsBtn) refreshModelsBtn.textContent = syncSection.refreshModels;

    // 更新同步說明區域的文字
    const syncIntervalInfos = document.querySelectorAll('#sync-tab .sync-interval-info');
    if (syncIntervalInfos[0]) {
      const span = syncIntervalInfos[0].querySelector('span');
      const small = syncIntervalInfos[0].querySelector('small');
      if (span) span.textContent = syncSection.manualSyncMode;
      if (small) small.textContent = syncSection.manualSyncModeDesc;
    }
    if (syncIntervalInfos[1]) {
      const span = syncIntervalInfos[1].querySelector('span');
      const small = syncIntervalInfos[1].querySelector('small');
      if (span) span.textContent = syncSection.syncProcess;
      if (small) small.textContent = syncSection.syncProcessDesc;
    }

    // 更新模型列表區域的預設文字
    const modelsPlaceholder = document.querySelector('.models-placeholder');
    if (modelsPlaceholder && modelsPlaceholder.textContent.includes('載入')) {
      modelsPlaceholder.textContent = syncSection.loadingModels;
    }
  }

  // 更新使用說明文字
  function updateUsageGuideTexts(translations) {
    const usageSection = translations.usage;
    if (!usageSection) return;

    const usageTitle = document.querySelector('.usage-guide h3');
    if (usageTitle) usageTitle.textContent = usageSection.title;

    const usageSteps = document.querySelectorAll('.usage-guide li');
    const stepKeys = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'];
    
    usageSteps.forEach((step, index) => {
      if (usageSection[stepKeys[index]]) {
        step.textContent = usageSection[stepKeys[index]];
      }
    });
  }

  // 更新狀態和提示文字
  function updateStatusTexts(translations) {
    const statusSection = translations.status;
    if (!statusSection) return;

    // 更新提示文字
    const footerTip = document.querySelector('.footer p');
    if (footerTip) footerTip.textContent = statusSection.tip;
  }

  // 更新 LLM 設定區域文字
  function updateLLMSectionTexts(translations) {
    const llmSection = translations.llm;
    if (!llmSection) return;

    // 更新標題和提示
    const llmTitle = document.querySelector('#llm-tab h3');
    if (llmTitle) llmTitle.textContent = llmSection.title;

    const llmHint = document.querySelector('#llm-tab .settings-hint');
    if (llmHint) llmHint.textContent = llmSection.hint;

    // 更新設定組標題
    const settingsGroups = document.querySelectorAll('#llm-tab .settings-group h4');
    if (settingsGroups[0]) settingsGroups[0].textContent = llmSection.apiProvider;
    if (settingsGroups[1]) settingsGroups[1].textContent = llmSection.openaiConfig;
    if (settingsGroups[2]) settingsGroups[2].textContent = llmSection.compatibleConfig;
    if (settingsGroups[3]) settingsGroups[3].textContent = llmSection.userModelsTitle;

    // 更新提供商選擇
    const providerLabel = document.querySelector('label[for="llmProviderSelect"]');
    if (providerLabel) providerLabel.textContent = llmSection.selectProvider;

    const providerSelect = document.getElementById('llmProviderSelect');
    if (providerSelect) {
      const options = providerSelect.querySelectorAll('option');
      if (options[0]) options[0].textContent = llmSection.selectProviderPlaceholder;
      if (options[1]) options[1].textContent = llmSection.openaiSettings;
      if (options[2]) options[2].textContent = llmSection.openaiCompatibleSettings;
    }

    // 更新標籤文字
    const labelMappings = [
      { selector: 'label[for="openaiApiKey"]', text: llmSection.openaiApiKey },
      { selector: 'label[for="compatibleBaseUrl"]', text: llmSection.compatibleBaseUrl },
      { selector: 'label[for="compatibleModel"]', text: llmSection.compatibleModel },
      { selector: 'label[for="compatibleHeaders"]', text: llmSection.compatibleHeaders },
      { selector: 'label[for="compatibleParams"]', text: llmSection.compatibleParams },
      { selector: 'label[for="globalDefaultModelSelect"]', text: llmSection.globalDefaultModelLabel || '全局預設模型' }
    ];

    labelMappings.forEach(mapping => {
      const label = document.querySelector(mapping.selector);
      if (label && mapping.text) {
        label.textContent = mapping.text;
      }
    });

    // 更新輸入欄位佔位符
    const placeholderMappings = [
      { id: 'openaiApiKey', placeholder: llmSection.openaiApiKeyPlaceholder },
      { id: 'compatibleBaseUrl', placeholder: llmSection.compatibleBaseUrlPlaceholder },
      { id: 'compatibleModel', placeholder: llmSection.compatibleModelPlaceholder },
      { id: 'compatibleHeaders', placeholder: llmSection.compatibleHeadersPlaceholder },
      { id: 'compatibleParams', placeholder: llmSection.compatibleParamsPlaceholder },
      { id: 'newOpenaiModelName', placeholder: llmSection.openaiModelPlaceholder || '輸入 OpenAI 模型名稱（例如：gpt-4, gpt-3.5-turbo）' },
      { id: 'newCompatibleModelName', placeholder: llmSection.compatibleModelPlaceholder || '輸入 Compatible 模型名稱（例如：claude-3-sonnet, llama-2）' }
    ];

    placeholderMappings.forEach(mapping => {
      const element = document.getElementById(mapping.id);
      if (element && mapping.placeholder) {
        element.placeholder = mapping.placeholder;
      }
    });

    // 更新模型管理相關文字
    const userModelsHint = document.querySelector('#user-models-section .settings-hint');
    if (userModelsHint) userModelsHint.textContent = llmSection.userModelsHint;

    // 更新 OpenAI 模型管理區域
    const openaiModelsTitle = document.querySelector('#openai-models-section h5');
    if (openaiModelsTitle) openaiModelsTitle.textContent = llmSection.openaiModelsTitle || '🤖 OpenAI 模型';

    const addOpenaiModelBtn = document.getElementById('addOpenaiModelBtn');
    if (addOpenaiModelBtn) addOpenaiModelBtn.textContent = llmSection.addModelBtn;

    const openaiAddModelDesc = document.querySelector('#openai-models-section .add-model-form small');
    if (openaiAddModelDesc) openaiAddModelDesc.textContent = llmSection.openaiAddModelDesc || '輸入要支援的 OpenAI 模型名稱';

    const openaiCurrentModelsTitle = document.querySelector('#openai-models-section h6');
    if (openaiCurrentModelsTitle) openaiCurrentModelsTitle.textContent = llmSection.openaiCurrentModelsTitle || '📝 當前 OpenAI 模型：';

    // 更新 OpenAI Compatible 模型管理區域
    const compatibleModelsTitle = document.querySelector('#compatible-models-section h5');
    if (compatibleModelsTitle) compatibleModelsTitle.textContent = llmSection.compatibleModelsTitle || '🔧 OpenAI Compatible 模型';

    const addCompatibleModelBtn = document.getElementById('addCompatibleModelBtn');
    if (addCompatibleModelBtn) addCompatibleModelBtn.textContent = llmSection.addModelBtn;

    const compatibleAddModelDesc = document.querySelector('#compatible-models-section .add-model-form small');
    if (compatibleAddModelDesc) compatibleAddModelDesc.textContent = llmSection.compatibleAddModelDesc || '輸入要支援的 OpenAI Compatible 模型名稱';

    const compatibleCurrentModelsTitle = document.querySelector('#compatible-models-section h6');
    if (compatibleCurrentModelsTitle) compatibleCurrentModelsTitle.textContent = llmSection.compatibleCurrentModelsTitle || '📝 當前 Compatible 模型：';

    // 更新全局預設模型選擇
    const globalDefaultModelSelectPlaceholder = document.querySelector('#globalDefaultModelSelect option[value=""]');
    if (globalDefaultModelSelectPlaceholder) globalDefaultModelSelectPlaceholder.textContent = llmSection.globalDefaultModelSelectPlaceholder || '選擇全局預設模型...';

    // 更新按鈕
    const saveLLMSettings = document.getElementById('saveLLMSettings');
    if (saveLLMSettings) saveLLMSettings.textContent = llmSection.save;

    const resetLLMSettings = document.getElementById('resetLLMSettings');
    if (resetLLMSettings) resetLLMSettings.textContent = llmSection.reset;

    // 更新所有描述文字 - 使用更精確的方法
    const descriptionMappings = [
      { selector: 'label[for="llmProviderSelect"]', text: llmSection.selectProviderDesc },
      { selector: 'label[for="openaiApiKey"]', text: llmSection.openaiApiKeyDesc },
      { selector: 'label[for="compatibleBaseUrl"]', text: llmSection.compatibleBaseUrlDesc },
      { selector: 'label[for="compatibleModel"]', text: llmSection.compatibleModelDesc },
      { selector: 'label[for="compatibleHeaders"]', text: llmSection.compatibleHeadersDesc },
      { selector: 'label[for="compatibleParams"]', text: llmSection.compatibleParamsDesc },
      { selector: 'label[for="globalDefaultModelSelect"]', text: llmSection.globalDefaultModelSelectDesc || '選擇訊息增強功能的全局預設模型（跨所有提供商）' }
    ];

    descriptionMappings.forEach(mapping => {
      const label = document.querySelector(mapping.selector);
      if (label) {
        const settingRow = label.closest('.setting-row');
        if (settingRow) {
          const small = settingRow.querySelector('small');
          if (small && mapping.text) {
            small.textContent = mapping.text;
          }
        }
      }
    });

    // 更新現有的模型列表項目中的按鈕文字
    updateExistingModelListTexts(llmSection);
  }

  function updateExistingModelListTexts(llmSection) {
    // 更新模型列表中的按鈕文字
    const setDefaultBtns = document.querySelectorAll('.btn-set-default');
    setDefaultBtns.forEach(btn => {
      btn.textContent = llmSection.setDefaultBtn || '設為預設';
    });

    const removeBtns = document.querySelectorAll('.btn-remove-model');
    removeBtns.forEach(btn => {
      btn.textContent = llmSection.removeBtn || '移除';
    });

    const defaultBadges = document.querySelectorAll('.model-default-badge');
    defaultBadges.forEach(badge => {
      badge.textContent = llmSection.defaultBadge || '預設';
    });

    // 更新 OpenAI 模型信息文字
    const openaiModelsCountInfo = document.getElementById('openaiModelsCountInfo');
    if (openaiModelsCountInfo && llmSection.modelCount) {
      const currentCount = openaiModelsCountInfo.textContent.match(/\d+/);
      if (currentCount) {
        openaiModelsCountInfo.textContent = `${llmSection.modelCount}：${currentCount[0]}`;
      }
    }

    const openaiDefaultModelInfo = document.getElementById('openaiDefaultModelInfo');
    if (openaiDefaultModelInfo && llmSection.defaultModel) {
      const currentModel = openaiDefaultModelInfo.textContent.split('：')[1] || llmSection.notSet;
      openaiDefaultModelInfo.textContent = `${llmSection.defaultModel}：${currentModel}`;
    }

    // 更新 OpenAI Compatible 模型信息文字
    const compatibleModelsCountInfo = document.getElementById('compatibleModelsCountInfo');
    if (compatibleModelsCountInfo && llmSection.modelCount) {
      const currentCount = compatibleModelsCountInfo.textContent.match(/\d+/);
      if (currentCount) {
        compatibleModelsCountInfo.textContent = `${llmSection.modelCount}：${currentCount[0]}`;
      }
    }

    const compatibleDefaultModelInfo = document.getElementById('compatibleDefaultModelInfo');
    if (compatibleDefaultModelInfo && llmSection.defaultModel) {
      const currentModel = compatibleDefaultModelInfo.textContent.split('：')[1] || llmSection.notSet;
      compatibleDefaultModelInfo.textContent = `${llmSection.defaultModel}：${currentModel}`;
    }

    // 更新 "添加於" 文字
    const addedOnTexts = document.querySelectorAll('.model-item-meta span:first-child');
    addedOnTexts.forEach(span => {
      const text = span.textContent;
      if (text.includes('添加於') || text.includes('Added on')) {
        const date = text.split(/添加於|Added on/)[1];
        span.textContent = (llmSection.addedOn || '添加於') + date;
      }
    });
  }

  async function loadAndDisplayCurrentPrompt() {
    try {
      chrome.storage.local.get(['customSystemPrompt'], function(result) {
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
    
    // 獲取當前翻譯，如果沒有則使用預設文字
    const translations = currentTranslations?.prompt || {};
    
    if (!promptText || promptText.trim() === '') {
      // 沒有自定義 prompt，顯示預設 prompt 內容
      const defaultPrompt = getDefaultSystemPrompt();
      const truncatedDefault = defaultPrompt.length > 300 ? 
        defaultPrompt.substring(0, 300) + '\n\n' + (translations.defaultContentTruncated || '... (預設內容已截斷)') : 
        defaultPrompt;
      
      displayElement.textContent = truncatedDefault;
      displayElement.classList.add('default-prompt');
      
      const wordCountText = translations.wordCountDefault ? 
        translations.wordCountDefault.replace('{{count}}', defaultPrompt.length) :
        `字數：${defaultPrompt.length}（預設）`;
      lengthElement.textContent = wordCountText;
      
      statusElement.textContent = translations.statusDefault || '狀態：預設模式';
    } else {
      // 有自定義 prompt，顯示內容
      const truncatedText = promptText.length > 300 ? 
        promptText.substring(0, 300) + '\n\n' + (translations.contentTruncated || '... (內容已截斷，完整內容請查看編輯區域)') : 
        promptText;
      
      displayElement.textContent = truncatedText;
      displayElement.classList.add('custom-prompt');
      
      const wordCountText = translations.wordCountCustom ? 
        translations.wordCountCustom.replace('{{count}}', promptText.length) :
        `字數：${promptText.length}`;
      lengthElement.textContent = wordCountText;
      
      statusElement.textContent = translations.statusCustom || '狀態：自定義模式';
    }
  }

  function getDefaultSystemPrompt() {
    // 如果有翻譯，使用翻譯的預設 prompt，否則使用中文版本
    if (currentTranslations?.prompt?.defaultSystemPrompt) {
      return currentTranslations.prompt.defaultSystemPrompt;
    }
    
    // 返回與 ThreadAnalyzer 中相同的預設 prompt（中文版本）
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
    savePromptBtn.addEventListener('click', function() {
      const promptText = systemPromptInput.value.trim();
      
      chrome.storage.local.set({
        'customSystemPrompt': promptText
      }, function() {
        const translations = currentTranslations?.prompt || {};
        
        if (chrome.runtime.lastError) {
          showPromptActionStatus(translations.saveFailed || '❌ 保存失敗', 'error');
        } else {
          if (promptText) {
            showPromptActionStatus(translations.saveCustomSuccess || '✅ 自定義 prompt 已保存', 'success');
          } else {
            showPromptActionStatus(translations.clearCustomSuccess || '✅ 已清除自定義 prompt，將使用預設', 'success');
          }
          
          // 更新預覽顯示
          updatePromptDisplay(promptText);
        }
      });
    });

    // 重置按鈕
    resetPromptBtn.addEventListener('click', function() {
      systemPromptInput.value = '';
      chrome.storage.local.remove(['customSystemPrompt'], function() {
        const translations = currentTranslations?.prompt || {};
        
        if (chrome.runtime.lastError) {
          showPromptActionStatus(translations.resetFailed || '❌ 重置失敗', 'error');
        } else {
          showPromptActionStatus(translations.resetToDefaultSuccess || '🔄 已重置為預設 prompt', 'success');
          
          // 更新預覽顯示
          updatePromptDisplay('');
        }
      });
    });



    // 監聽輸入區域變化，提供即時字數統計
    systemPromptInput.addEventListener('input', function() {
      const currentText = systemPromptInput.value;
      const charCount = currentText.length;
      const translations = currentTranslations?.prompt || {};
      
      // 更新字數顯示（但不更新預覽，只有保存後才更新預覽）
      if (charCount > 0) {
        const wordCountText = translations.wordCountEditing ? 
          translations.wordCountEditing.replace('{{count}}', charCount) :
          `字數：${charCount}（編輯中）`;
        promptLength.textContent = wordCountText;
      } else {
        promptLength.textContent = translations.wordCountEditingZero || '字數：0（編輯中）';
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
    const translations = currentTranslations?.status || {};
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const currentTab = tabs[0];
      console.log('Current tab:', currentTab);
      
      if (!currentTab) {
        const errorText = translations.cannotDetectPage || '無法檢測當前頁面';
        updateStatus('❌', errorText, 'error');
        return;
      }
      
      console.log('Current URL:', currentTab.url);
      
      if (currentTab.url && currentTab.url.includes('slack.com')) {
        const checkingText = translations.onSlackCheckingThread || '在 Slack 頁面中 - 檢查討論串...';
        updateStatus('✅', checkingText, 'success');
        
        // 等待一下再檢查討論串，給content script時間載入
        setTimeout(() => {
          checkThreadAvailability(currentTab.id);
        }, 1000);
        
      } else {
        const pleaseOpenText = translations.pleaseOpenSlack || '請開啟 Slack 網頁版';
        updateStatus('⚠️', pleaseOpenText, 'error');
      }
    });
  }

  function checkThreadAvailability(tabId) {
    const translations = currentTranslations?.status || {};
    
    console.log('Checking thread availability for tab:', tabId);
    
    // 檢查是否有討論串可用
    chrome.tabs.sendMessage(tabId, { action: 'checkThreadAvailable' }, function(response) {
      console.log('Response from content script:', response);
      console.log('Runtime error:', chrome.runtime.lastError);
      
      if (chrome.runtime.lastError) {
        console.error('Content script communication error:', chrome.runtime.lastError.message);
        
        // 嘗試注入備用腳本進行基本檢測
        const loadingBackupText = translations.loadingBackupScript || '正在載入備用檢測腳本...';
        updateStatus('🔄', loadingBackupText, 'loading');
        
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content-inject.js']
        }, function(_results) {
          if (chrome.runtime.lastError) {
            console.error('Backup script injection failed:', chrome.runtime.lastError.message);
            const refreshText = translations.pleaseRefreshSlack || '請重新整理 Slack 頁面以載入完整功能';
            updateStatus('❌', refreshText, 'error');
          } else {
            console.log('Backup script injected successfully, retrying check...');
            const backupLoadedText = translations.backupScriptLoaded || '備用腳本已載入，正在檢查...';
            updateStatus('⚡', backupLoadedText, 'loading');
            
            // 重新檢查
            setTimeout(() => {
              checkThreadAvailability(tabId);
            }, 2000);
          }
        });
        return;
      }
      
      if (response && response.hasThread) {
        const threadFoundText = translations.threadFound || '找到討論串 - 點擊摘要按鈕開始';
        updateStatus('🎯', threadFoundText, 'ready');
      } else if (response) {
        const inSlackOpenThreadText = translations.inSlackOpenThread || '在 Slack 中 - 請開啟一個討論串';
        updateStatus('📄', inSlackOpenThreadText, 'warning');
      } else {
        const cannotDetectThreadText = translations.cannotDetectThread || '無法檢測討論串狀態';
        updateStatus('⚠️', cannotDetectThreadText, 'warning');
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
    chrome.storage.local.get(['slack_summary_config'], function(result) {
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
    saveScrollSettings.addEventListener('click', function() {
      const scrollSettings = collectScrollSettings();
      
      chrome.storage.local.get(['slack_summary_config'], function(result) {
        const config = result.slack_summary_config || {};
        config.scrollSettings = { ...config.scrollSettings, ...scrollSettings };
        
        chrome.storage.local.set({ 'slack_summary_config': config }, function() {
          const translations = currentTranslations?.scroll || {};
          
          if (chrome.runtime.lastError) {
            const errorMessage = translations.saveFailed || '❌ 保存失敗';
            showScrollActionStatus(errorMessage, 'error');
          } else {
            const successMessage = translations.saved || '✅ 滾動設定已保存';
            showScrollActionStatus(successMessage, 'success');
          }
        });
      });
    });

    // 重置滾動設定
    resetScrollSettings.addEventListener('click', function() {
      const translations = currentTranslations?.scroll || {};
      const confirmMessage = translations.confirmReset || '確定要重置滾動設定為預設值嗎？';
      
      if (confirm(confirmMessage)) {
        const defaultSettings = getDefaultScrollSettings();
        updateScrollSettingsUI(defaultSettings);
        
        chrome.storage.local.get(['slack_summary_config'], function(result) {
          const config = result.slack_summary_config || {};
          config.scrollSettings = defaultSettings;
          
          chrome.storage.local.set({ 'slack_summary_config': config }, function() {
            if (chrome.runtime.lastError) {
              const errorMessage = translations.resetFailed || '❌ 重置失敗';
              showScrollActionStatus(errorMessage, 'error');
            } else {
              const successMessage = translations.resetSuccess || '🔄 已重置為預設值';
              showScrollActionStatus(successMessage, 'success');
            }
          });
        });
      }
    });


  }

  // 收集滾動設定
  function collectScrollSettings() {
    const settings = {};
    const settingIds = [
      'scrollDelay', 'maxScrollAttempts', 
      'noMaxNewMessagesCount', 'scrollStep', 
      'minScrollAmount'
    ];
    
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
    manualSyncPopupBtn.addEventListener('click', function() {
      triggerManualSync();
    });

    // 檢查狀態按鈕
    checkSyncStatusBtn.addEventListener('click', function() {
      loadSyncStatus();
    });

    // 重新載入模型列表按鈕
    refreshModelsBtn.addEventListener('click', function() {
      loadModelsList();
    });
  }

  function loadSyncStatus() {
    // 獲取當前翻譯
    const translations = currentTranslations?.sync || {};
    
    const checkingText = translations.checking || '檢查同步狀態中...';
    updateSyncStatus('⏳', checkingText);
    
    chrome.runtime.sendMessage({ action: 'getBackgroundSyncStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        const errorText = translations.cannotConnectBackground || '無法連接到背景腳本';
        updateSyncStatus('❌', errorText);
        console.error('Error getting sync status:', chrome.runtime.lastError);
      } else if (response) {
        const statusIcons = {
          'synced': '✅',
          'syncing': '🔄',
          'error': '❌',
          'unknown': '❓'
        };
        
        const icon = statusIcons[response.status] || '❓';
        const message = response.message || translations.statusUnknown || '狀態未知';
        
        updateSyncStatus(icon, message);
        console.log('Sync status updated:', response);
      } else {
        const unknownText = translations.syncStatusUnknown || '同步狀態未知';
        updateSyncStatus('❓', unknownText);
      }
    });
  }

  function updateSyncStatus(icon, text) {
    syncStatusIcon.textContent = icon;
    syncStatusText.textContent = text;
  }

  function loadModelsList() {
    // 獲取當前翻譯
    const translations = currentTranslations?.sync || {};
    
    // 顯示載入狀態
    const loadingText = translations.loadingModels || '載入模型列表中...';
    modelsListDisplay.innerHTML = `<div class="models-placeholder">${loadingText}</div>`;
    
    const loadingCountText = translations.modelsCountLoading || '載入中';
    const loadingUpdateText = translations.lastUpdateLoading || '載入中';
    modelsCount.textContent = `${translations.modelsCount || '模型數量：'}${loadingCountText}`;
    modelsLastUpdate.textContent = `${translations.lastUpdate || '最後更新：'}${loadingUpdateText}`;

    chrome.runtime.sendMessage({ action: 'getAvailableModels' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting models:', chrome.runtime.lastError);
        const errorText = translations.cannotLoadModels || '無法載入模型列表';
        displayModelsError(errorText);
        return;
      }

      if (response && response.models && Array.isArray(response.models)) {
        displayModelsList(response.models);
        updateModelsInfo(response.models);
      } else {
        console.warn('Invalid models response:', response);
        const invalidDataText = translations.invalidModelData || '模型資料格式無效';
        displayModelsError(invalidDataText);
      }
    });

    // 同時獲取最後更新時間
    chrome.storage.local.get(['modelsLastUpdated'], (result) => {
      const lastUpdated = result.modelsLastUpdated;
      if (lastUpdated) {
        const updateTime = new Date(lastUpdated);
        const now = new Date();
        const diffHours = Math.floor((now - updateTime) / (1000 * 60 * 60));
        
        if (diffHours < 1) {
          const lessThanHourText = translations.lastUpdateLessThanHour || '不到1小時前';
          modelsLastUpdate.textContent = `${translations.lastUpdate || '最後更新：'}${lessThanHourText}`;
        } else if (diffHours < 24) {
          const hoursText = translations.lastUpdateHours ? 
            translations.lastUpdateHours.replace('{{hours}}', diffHours) :
            `${diffHours}小時前`;
          modelsLastUpdate.textContent = `${translations.lastUpdate || '最後更新：'}${hoursText}`;
        } else {
          const diffDays = Math.floor(diffHours / 24);
          const daysText = translations.lastUpdateDays ? 
            translations.lastUpdateDays.replace('{{days}}', diffDays) :
            `${diffDays}天前`;
          modelsLastUpdate.textContent = `${translations.lastUpdate || '最後更新：'}${daysText}`;
        }
      } else {
        const unknownText = translations.lastUpdateUnknown || '未知';
        modelsLastUpdate.textContent = `${translations.lastUpdate || '最後更新：'}${unknownText}`;
      }
    });
  }

  function displayModelsList(models) {
    const translations = currentTranslations?.sync || {};
    
    if (!models || models.length === 0) {
      const noModelsText = translations.noAvailableModels || '尚無可用模型';
      modelsListDisplay.innerHTML = `<div class="models-placeholder">${noModelsText}</div>`;
      return;
    }

    const modelsHTML = models.map(model => {
      const isDefaultModel = model.value === 'auto';
      const defaultBadge = translations.modelBadgeDefault || '預設';
      const syncedBadge = translations.modelBadgeSynced || '同步';
      const badgeHTML = isDefaultModel ? 
        `<span class="model-badge default">${defaultBadge}</span>` : 
        `<span class="model-badge synced">${syncedBadge}</span>`;
      
      return `
        <div class="model-item">
          <div class="model-info">
            <div class="model-name">${model.displayName || model.value}</div>
          </div>
          ${badgeHTML}
        </div>
      `;
    }).join('');

    modelsListDisplay.innerHTML = modelsHTML;
  }

  function displayModelsError(errorMessage) {
    const translations = currentTranslations?.sync || {};
    
    modelsListDisplay.innerHTML = `<div class="models-placeholder" style="color: #dc3545;">${errorMessage}</div>`;
    
    const failedText = translations.modelsCountFailed || '載入失敗';
    const updateFailedText = translations.lastUpdateFailed || '載入失敗';
    modelsCount.textContent = `${translations.modelsCount || '模型數量：'}${failedText}`;
    modelsLastUpdate.textContent = `${translations.lastUpdate || '最後更新：'}${updateFailedText}`;
  }

  function updateModelsInfo(models) {
    const translations = currentTranslations?.sync || {};
    const totalModels = models.length;
    const syncedModels = models.filter(model => model.value !== 'auto').length;
    
    if (syncedModels > 0) {
      const countWithSyncedText = translations.modelsCountWithSynced ? 
        translations.modelsCountWithSynced.replace('{{total}}', totalModels).replace('{{synced}}', syncedModels) :
        `${totalModels} (${syncedModels} 個已同步)`;
      modelsCount.textContent = `${translations.modelsCount || '模型數量：'}${countWithSyncedText}`;
    } else {
      const defaultOnlyText = translations.modelsCountDefaultOnly ? 
        translations.modelsCountDefaultOnly.replace('{{total}}', totalModels) :
        `${totalModels} (僅預設模型)`;
      modelsCount.textContent = `${translations.modelsCount || '模型數量：'}${defaultOnlyText}`;
    }
  }

  function triggerManualSync() {
    // Show the syncing modal
    showSyncingModal();
    
    // Start the sync process
    chrome.runtime.sendMessage({ action: 'triggerBackgroundSync' }, (response) => {
      // 獲取當前翻譯
      const translations = currentTranslations?.sync || {};
      
      if (chrome.runtime.lastError) {
        const errorMessage = translations.manualSyncFailedWithError ? 
          translations.manualSyncFailedWithError.replace('{{error}}', chrome.runtime.lastError.message) :
          '手動同步失敗: ' + chrome.runtime.lastError.message;
        showSyncingError(errorMessage);
        console.error('Manual sync failed:', chrome.runtime.lastError);
      } else if (response && response.success) {
        showSyncingSuccess();
        
        // 3秒後重新載入模型列表和狀態，然後關閉模態框
        setTimeout(() => {
          loadSyncStatus();
          loadModelsList();
          hideSyncingModal();
        }, 3000);
      } else {
        const unknownError = translations.unknownError || '未知錯誤';
        const errorMessage = translations.manualSyncFailedWithError ? 
          translations.manualSyncFailedWithError.replace('{{error}}', response?.error || unknownError) :
          '手動同步失敗: ' + (response?.error || unknownError);
        showSyncingError(errorMessage);
        console.error('Manual sync failed:', response);
      }
    });
  }

  // ===================== 同步模態框相關函數 =====================

  let syncTimer = null;
  let syncStartTime = 0;

  function showSyncingModal() {
    const modal = document.getElementById('syncingModal');
    const modalContainer = modal.querySelector('.modal-container');
    
    // 重置模態框狀態
    modalContainer.className = 'modal-container';
    resetSyncSteps();
    
    // 顯示模態框
    modal.classList.remove('hidden');
    
    // 開始同步流程
    syncStartTime = Date.now();
    startSyncTimer();
    simulateSyncProgress();
  }

  function hideSyncingModal() {
    const modal = document.getElementById('syncingModal');
    modal.classList.add('hidden');
    
    // 停止計時器
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
  }

  function startSyncTimer() {
    const timerElement = document.getElementById('syncTimer');
    
    syncTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - syncStartTime) / 1000);
      // 獲取當前翻譯
      const translations = currentTranslations?.modal || {};
      const timerText = translations.syncTimer ? 
        translations.syncTimer.replace('{{time}}', elapsed) : 
        `已用時間: ${elapsed} 秒`;
      timerElement.textContent = timerText;
    }, 1000);
  }

  function resetSyncSteps() {
    const steps = document.querySelectorAll('.step');
    steps.forEach(step => {
      step.className = 'step';
      const icon = step.querySelector('.step-icon');
      if (icon) {
        icon.textContent = '⏳';
      }
    });
  }

  function simulateSyncProgress() {
    // 獲取當前翻譯，如果沒有則使用預設文字
    const translations = currentTranslations?.modal || {};
    
    const steps = [
      { id: 'step1', delay: 500, message: translations.step1 || '正在開啟 Gemini 頁面...' },
      { id: 'step2', delay: 2000, message: translations.step2 || '頁面載入中，請稍候...' },
      { id: 'step3', delay: 4000, message: translations.step3 || '正在檢測並提取可用模型...' },
      { id: 'step4', delay: 6000, message: translations.step4 || '正在保存模型列表到本地存儲...' }
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        updateSyncStep(step.id, 'active');
        updateSyncMessage(step.message);
        
        // 標記前一個步驟為完成
        if (index > 0) {
          updateSyncStep(steps[index - 1].id, 'completed');
        }
      }, step.delay);
    });

    // 在最後一步後等待實際同步完成
    setTimeout(() => {
      const finalMessage = translations.syncMessage || '同步即將完成，正在等待後端處理...';
      updateSyncMessage(finalMessage);
    }, 7000);
  }

  function updateSyncStep(stepId, status) {
    const step = document.getElementById(stepId);
    if (step) {
      step.className = `step ${status}`;
      
      const icon = step.querySelector('.step-icon');
      if (icon) {
        if (status === 'active') {
          icon.textContent = '🔄';
        } else if (status === 'completed') {
          icon.textContent = '✅';
        } else if (status === 'error') {
          icon.textContent = '❌';
        }
      }
    }
  }

  function updateSyncMessage(message) {
    const messageElement = document.getElementById('syncMessage');
    if (messageElement) {
      messageElement.textContent = message;
    }
  }

  function showSyncingSuccess() {
    const modalContainer = document.querySelector('.modal-container');
    const steps = document.querySelectorAll('.step');
    
    // 更新模態框為成功狀態
    modalContainer.classList.add('success');
    
    // 標記所有步驟為完成
    steps.forEach(step => {
      updateSyncStep(step.id, 'completed');
    });
    
    // 獲取當前翻譯
    const translations = currentTranslations?.sync || {};
    
    // 更新標題和訊息
    const title = modalContainer.querySelector('h2');
    if (title) {
      title.textContent = translations.syncSuccessful || '同步成功完成！';
    }
    
    const successMessage = translations.syncCompletedMessage || '✅ 模型同步成功！正在更新本地模型列表...';
    updateSyncMessage(successMessage);
    
    // 停止計時器並顯示最終時間
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
      const elapsed = Math.floor((Date.now() - syncStartTime) / 1000);
      const timerText = translations.totalTime ? 
        translations.totalTime.replace('{{time}}', elapsed) : 
        `總用時: ${elapsed} 秒`;
      document.getElementById('syncTimer').textContent = timerText;
    }
  }

  function showSyncingError(errorMessage) {
    const modalContainer = document.querySelector('.modal-container');
    
    // 更新模態框為錯誤狀態
    modalContainer.classList.add('error');
    
    // 找到當前活動步驟並標記為錯誤
    const activeStep = document.querySelector('.step.active');
    if (activeStep) {
      updateSyncStep(activeStep.id, 'error');
    }
    
    // 獲取當前翻譯
    const translations = currentTranslations?.sync || {};
    
    // 更新標題和訊息
    const title = modalContainer.querySelector('h2');
    if (title) {
      title.textContent = translations.syncFailed || '同步失敗';
    }
    
    updateSyncMessage(`❌ ${errorMessage}`);
    
    // 停止計時器
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
    
    // 啟用取消按鈕變為關閉按鈕
    const cancelBtn = document.getElementById('cancelSyncBtn');
    if (cancelBtn) {
      cancelBtn.disabled = false;
      const closeText = translations.closeButton || '❌ 關閉';
      cancelBtn.textContent = closeText;
      cancelBtn.onclick = hideSyncingModal;
    }
    
    // 5秒後自動關閉
    setTimeout(() => {
      hideSyncingModal();
    }, 5000);
  }

  // 設置取消按鈕事件
  document.getElementById('cancelSyncBtn').addEventListener('click', function() {
    hideSyncingModal();
  });

  function showSyncActionStatus(message, type) {
    syncActionStatus.textContent = message;
    syncActionStatus.className = `sync-status ${type} show`;
    
    // 5秒後清除狀態訊息
    setTimeout(() => {
      syncActionStatus.textContent = '';
      syncActionStatus.className = 'sync-status';
    }, 5000);
  }

  // LLM 設定相關函數
  function setupLLMSettingsHandlers() {
    const llmProviderSelect = document.getElementById('llmProviderSelect');
    const openaiConfig = document.getElementById('openai-config');
    const openaiCompatibleConfig = document.getElementById('openai-compatible-config');
    const userModelsSection = document.getElementById('user-models-section');
    const openaiModelsSection = document.getElementById('openai-models-section');
    const compatibleModelsSection = document.getElementById('compatible-models-section');
    const llmActions = document.getElementById('llm-actions');
    const saveLLMSettings = document.getElementById('saveLLMSettings');
    const resetLLMSettings = document.getElementById('resetLLMSettings');

    // OpenAI 模型管理相關元素
    const newOpenaiModelName = document.getElementById('newOpenaiModelName');
    const addOpenaiModelBtn = document.getElementById('addOpenaiModelBtn');
    const openaiModelsList = document.getElementById('openaiModelsList');
    const openaiModelsCountInfo = document.getElementById('openaiModelsCountInfo');
    const openaiDefaultModelInfo = document.getElementById('openaiDefaultModelInfo');

    // OpenAI Compatible 模型管理相關元素
    const newCompatibleModelName = document.getElementById('newCompatibleModelName');
    const addCompatibleModelBtn = document.getElementById('addCompatibleModelBtn');
    const compatibleModelsList = document.getElementById('compatibleModelsList');
    const compatibleModelsCountInfo = document.getElementById('compatibleModelsCountInfo');
    const compatibleDefaultModelInfo = document.getElementById('compatibleDefaultModelInfo');

    // 全局預設模型選擇
    const globalDefaultModelSelect = document.getElementById('globalDefaultModelSelect');

    // 提供商選擇變更事件
    if (llmProviderSelect) {
      llmProviderSelect.addEventListener('change', function() {
        const selectedProvider = this.value;
        
        // 隱藏所有配置區域
        if (openaiConfig) openaiConfig.style.display = 'none';
        if (openaiCompatibleConfig) openaiCompatibleConfig.style.display = 'none';
        if (userModelsSection) userModelsSection.style.display = 'none';
        if (openaiModelsSection) openaiModelsSection.style.display = 'none';
        if (compatibleModelsSection) compatibleModelsSection.style.display = 'none';
        if (llmActions) llmActions.style.display = 'none';
        
        // 根據選擇顯示對應的配置區域
        if (selectedProvider === 'openai') {
          if (openaiConfig) openaiConfig.style.display = 'block';
          if (userModelsSection) userModelsSection.style.display = 'block';
          if (openaiModelsSection) openaiModelsSection.style.display = 'block';
          if (llmActions) llmActions.style.display = 'block';
          loadProviderModels('openai');
        } else if (selectedProvider === 'openai-compatible') {
          if (openaiCompatibleConfig) openaiCompatibleConfig.style.display = 'block';
          if (userModelsSection) userModelsSection.style.display = 'block';
          if (compatibleModelsSection) compatibleModelsSection.style.display = 'block';
          if (llmActions) llmActions.style.display = 'block';
          loadProviderModels('openai-compatible');
        }
        
        // 載入全局預設模型選項
        loadGlobalDefaultModelOptions();
      });
    }

    // OpenAI 模型管理事件
    if (addOpenaiModelBtn) {
      addOpenaiModelBtn.addEventListener('click', function() {
        addNewModel('openai');
      });
    }

    if (newOpenaiModelName) {
      newOpenaiModelName.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          addNewModel('openai');
        }
      });
    }

    // OpenAI Compatible 模型管理事件
    if (addCompatibleModelBtn) {
      addCompatibleModelBtn.addEventListener('click', function() {
        addNewModel('openai-compatible');
      });
    }

    if (newCompatibleModelName) {
      newCompatibleModelName.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          addNewModel('openai-compatible');
        }
      });
    }

    // 全局預設模型選擇事件
    if (globalDefaultModelSelect) {
      globalDefaultModelSelect.addEventListener('change', function() {
        handleGlobalDefaultModelChange();
      });
    }

    // 保存設定按鈕
    if (saveLLMSettings) {
      saveLLMSettings.addEventListener('click', function() {
        saveLLMSettingsHandler();
      });
    }

    // 重置設定按鈕
    if (resetLLMSettings) {
      resetLLMSettings.addEventListener('click', function() {
        resetLLMSettingsHandler();
      });
    }

    // 初始載入設定
    loadLLMSettingsHandler();

    // 模型管理相關函數
    function addNewModel(provider) {
      const inputElement = provider === 'openai' ? newOpenaiModelName : newCompatibleModelName;
      const modelName = inputElement?.value?.trim();
      
      if (!modelName) {
        const translations = currentTranslations?.llm || {};
        showLLMActionStatus(translations.modelNameRequired || '請輸入模型名稱', 'error');
        return;
      }

      // 檢查模型是否已存在
      chrome.storage.local.get(['providerModels'], function(result) {
        const providerModels = result.providerModels || {};
        const currentProviderModels = providerModels[provider] || [];
        
        if (currentProviderModels.some(model => model.name === modelName)) {
          const translations = currentTranslations?.llm || {};
          showLLMActionStatus(translations.modelAlreadyExists || '模型已存在', 'error');
          return;
        }

        // 添加新模型
        const newModel = {
          name: modelName,
          provider: provider,
          addedAt: new Date().toISOString(),
          isDefault: currentProviderModels.length === 0 // 該提供商的第一個模型設為預設
        };

        currentProviderModels.push(newModel);
        providerModels[provider] = currentProviderModels;

        // 保存到 storage
        chrome.storage.local.set({ providerModels: providerModels }, function() {
          if (chrome.runtime.lastError) {
            const translations = currentTranslations?.llm || {};
            showLLMActionStatus(translations.addModelFailed || '添加模型失敗', 'error');
          } else {
            const translations = currentTranslations?.llm || {};
            const providerName = provider === 'openai' ? 'OpenAI' : 'OpenAI Compatible';
            showLLMActionStatus(translations.modelAdded || `✅ ${providerName} 模型 "${modelName}" 已添加`, 'success');
            inputElement.value = '';
            loadProviderModels(provider);
            loadGlobalDefaultModelOptions();
          }
        });
      });
    }

    function loadProviderModels(provider) {
      chrome.storage.local.get(['providerModels'], function(result) {
        const providerModels = result.providerModels || {};
        const models = providerModels[provider] || [];
        displayProviderModels(provider, models);
        updateProviderModelsInfo(provider, models);
      });
    }

    function displayProviderModels(provider, models) {
      const listElement = provider === 'openai' ? openaiModelsList : compatibleModelsList;
      if (!listElement) return;

      const translations = currentTranslations?.llm || {};

      if (models.length === 0) {
        const providerName = provider === 'openai' ? 'OpenAI' : 'OpenAI Compatible';
        listElement.innerHTML = `<div class="models-placeholder">${translations.noModelsAdded || `尚未添加任何 ${providerName} 模型`}</div>`;
        return;
      }

      const modelsHtml = models.map(model => {
        const isDefault = model.isDefault;
        const addedDate = new Date(model.addedAt).toLocaleDateString();
        
        return `
          <div class="model-list-item ${isDefault ? 'default-model' : ''}" data-model-name="${model.name}" data-provider="${provider}">
            <div class="model-item-info">
              <div class="model-item-name">${model.name}</div>
              <div class="model-item-meta">
                <span>${translations.addedOn || '添加於'}: ${addedDate}</span>
                ${isDefault ? `<span class="model-default-badge">${translations.defaultBadge || '預設'}</span>` : ''}
              </div>
            </div>
            <div class="model-item-actions">
              ${!isDefault ? `<button class="btn-set-default" data-model-name="${model.name}" data-provider="${provider}">${translations.setDefaultBtn || '設為預設'}</button>` : ''}
              <button class="btn-remove-model" data-model-name="${model.name}" data-provider="${provider}">${translations.removeBtn || '移除'}</button>
            </div>
          </div>
        `;
      }).join('');

      listElement.innerHTML = modelsHtml;

      // 添加事件監聽器
      listElement.querySelectorAll('.btn-set-default').forEach(btn => {
        btn.addEventListener('click', function() {
          const modelName = this.getAttribute('data-model-name');
          const modelProvider = this.getAttribute('data-provider');
          setProviderDefaultModel(modelProvider, modelName);
        });
      });

      listElement.querySelectorAll('.btn-remove-model').forEach(btn => {
        btn.addEventListener('click', function() {
          const modelName = this.getAttribute('data-model-name');
          const modelProvider = this.getAttribute('data-provider');
          removeProviderModel(modelProvider, modelName);
        });
      });
    }

    function setProviderDefaultModel(provider, modelName) {
      chrome.storage.local.get(['providerModels'], function(result) {
        const providerModels = result.providerModels || {};
        const models = providerModels[provider] || [];
        
        // 清除該提供商所有預設標記
        models.forEach(model => {
          model.isDefault = false;
        });
        
        // 設置新的預設模型
        const targetModel = models.find(model => model.name === modelName);
        if (targetModel) {
          targetModel.isDefault = true;
        }

        providerModels[provider] = models;

        chrome.storage.local.set({ providerModels: providerModels }, function() {
          if (chrome.runtime.lastError) {
            const translations = currentTranslations?.llm || {};
            showLLMActionStatus(translations.setDefaultFailed || '設置預設模型失敗', 'error');
          } else {
            const translations = currentTranslations?.llm || {};
            const providerName = provider === 'openai' ? 'OpenAI' : 'OpenAI Compatible';
            showLLMActionStatus(translations.defaultModelSet || `✅ ${providerName} 預設模型已設為 "${modelName}"`, 'success');
            loadProviderModels(provider);
            loadGlobalDefaultModelOptions();
          }
        });
      });
    }

    function removeProviderModel(provider, modelName) {
      const translations = currentTranslations?.llm || {};
      const providerName = provider === 'openai' ? 'OpenAI' : 'OpenAI Compatible';
      
      if (confirm(translations.confirmRemoveModel || `確定要移除 ${providerName} 模型 "${modelName}" 嗎？`)) {
        chrome.storage.local.get(['providerModels'], function(result) {
          const providerModels = result.providerModels || {};
          const models = providerModels[provider] || [];
          
          const modelIndex = models.findIndex(model => model.name === modelName);
          if (modelIndex > -1) {
            const removedModel = models[modelIndex];
            models.splice(modelIndex, 1);
            
            // 如果移除的是預設模型，設置第一個模型為預設
            if (removedModel.isDefault && models.length > 0) {
              models[0].isDefault = true;
            }
            
            providerModels[provider] = models;

            chrome.storage.local.set({ providerModels: providerModels }, function() {
              if (chrome.runtime.lastError) {
                const translations = currentTranslations?.llm || {};
                showLLMActionStatus(translations.removeModelFailed || '移除模型失敗', 'error');
              } else {
                const translations = currentTranslations?.llm || {};
                showLLMActionStatus(translations.modelRemoved || `✅ ${providerName} 模型 "${modelName}" 已移除`, 'success');
                loadProviderModels(provider);
                loadGlobalDefaultModelOptions();
              }
            });
          }
        });
      }
    }

    function updateProviderModelsInfo(provider, models) {
      const countElement = provider === 'openai' ? openaiModelsCountInfo : compatibleModelsCountInfo;
      const defaultElement = provider === 'openai' ? openaiDefaultModelInfo : compatibleDefaultModelInfo;
      
      if (countElement) {
        const translations = currentTranslations?.llm || {};
        countElement.textContent = `${translations.modelCount || '模型數量'}：${models.length}`;
      }
      
      if (defaultElement) {
        const defaultModel = models.find(model => model.isDefault);
        const translations = currentTranslations?.llm || {};
        defaultElement.textContent = `${translations.defaultModel || '預設模型'}：${defaultModel ? defaultModel.name : translations.notSet || '未設定'}`;
      }
    }

    function loadGlobalDefaultModelOptions() {
      if (!globalDefaultModelSelect) return;

      chrome.storage.local.get(['providerModels', 'globalDefaultModel'], function(result) {
        const providerModels = result.providerModels || {};
        const globalDefaultModel = result.globalDefaultModel || '';
        
        // 清空選項
        globalDefaultModelSelect.innerHTML = '<option value="">選擇全局預設模型...</option>';
        
        // 添加所有提供商的模型
        Object.keys(providerModels).forEach(provider => {
          const models = providerModels[provider] || [];
          const providerName = provider === 'openai' ? 'OpenAI' : 'OpenAI Compatible';
          
          if (models.length > 0) {
            // 添加提供商分組標題
            const optgroup = document.createElement('optgroup');
            optgroup.label = providerName;
            
            models.forEach(model => {
              const option = document.createElement('option');
              option.value = `${provider}:${model.name}`;
              option.textContent = model.name;
              if (globalDefaultModel === `${provider}:${model.name}`) {
                option.selected = true;
              }
              optgroup.appendChild(option);
            });
            
            globalDefaultModelSelect.appendChild(optgroup);
          }
        });
      });
    }

    function handleGlobalDefaultModelChange() {
      const selectedValue = globalDefaultModelSelect.value;
      
      chrome.storage.local.set({ globalDefaultModel: selectedValue }, function() {
        if (chrome.runtime.lastError) {
          const translations = currentTranslations?.llm || {};
          showLLMActionStatus(translations.setGlobalDefaultFailed || '設置全局預設模型失敗', 'error');
        } else {
          const translations = currentTranslations?.llm || {};
          if (selectedValue) {
            const [provider, modelName] = selectedValue.split(':');
            const providerName = provider === 'openai' ? 'OpenAI' : 'OpenAI Compatible';
            showLLMActionStatus(translations.globalDefaultSet || `✅ 全局預設模型已設為 ${providerName} 的 "${modelName}"`, 'success');
          } else {
            showLLMActionStatus(translations.globalDefaultCleared || '✅ 全局預設模型已清除', 'success');
          }
        }
      });
    }
  }

  function saveLLMSettingsHandler() {
    const llmProviderSelect = document.getElementById('llmProviderSelect');
    const selectedProvider = llmProviderSelect?.value;
    const translations = currentTranslations?.llm || {};
    
    if (!selectedProvider) {
      showLLMActionStatus(translations.selectProviderFirst || '請先選擇 LLM 提供商', 'error');
      return;
    }
    
    let settings = {
      provider: selectedProvider
    };
    
    if (selectedProvider === 'openai') {
      const apiKey = document.getElementById('openaiApiKey')?.value;
      
      if (!apiKey) {
        showLLMActionStatus(translations.apiKeyRequired || '請輸入 OpenAI API Key', 'error');
        return;
      }
      
      settings.config = {
        apiKey: apiKey
      };
    } else if (selectedProvider === 'openai-compatible') {
      const baseUrl = document.getElementById('compatibleBaseUrl')?.value;
      const model = document.getElementById('compatibleModel')?.value;
      const headers = document.getElementById('compatibleHeaders')?.value;
      const params = document.getElementById('compatibleParams')?.value;
      
      if (!baseUrl || !model) {
        showLLMActionStatus(translations.fillRequiredFields || '請填寫所有必要欄位', 'error');
        return;
      }
      
      settings.config = {
        baseUrl: baseUrl,
        model: model
      };
      
      // 解析自定義 headers 和 params
      if (headers) {
        try {
          settings.config.customHeaders = JSON.parse(headers);
        } catch (e) {
          showLLMActionStatus(translations.invalidHeadersFormat || '自定義 Headers 格式錯誤，請使用有效的 JSON 格式', 'error');
          return;
        }
      }
      
      if (params) {
        try {
          settings.config.customParams = JSON.parse(params);
        } catch (e) {
          showLLMActionStatus(translations.invalidParamsFormat || '自定義參數格式錯誤，請使用有效的 JSON 格式', 'error');
          return;
        }
      }
    }
    
    // 保存設定到 Chrome storage
    chrome.storage.local.set({
      'llmSettings': settings
    }, async function() {
      if (chrome.runtime.lastError) {
        showLLMActionStatus((translations.saveFailed || '保存設定失敗') + ': ' + chrome.runtime.lastError.message, 'error');
      } else {
        showLLMActionStatus(translations.saved || '✅ LLM 設定已保存', 'success');
        
        // 通知 content script 重新載入 LLM 配置
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          chrome.tabs.sendMessage(tab.id, {
            action: 'reloadLLMConfig'
          });
        } catch (error) {
          console.log('Could not notify content script about config change:', error);
        }
      }
    });
  }

  function resetLLMSettingsHandler() {
    // 重置所有輸入欄位
    const llmProviderSelect = document.getElementById('llmProviderSelect');
    const openaiApiKey = document.getElementById('openaiApiKey');
    const compatibleBaseUrl = document.getElementById('compatibleBaseUrl');
    const compatibleModel = document.getElementById('compatibleModel');
    const compatibleHeaders = document.getElementById('compatibleHeaders');
    const compatibleParams = document.getElementById('compatibleParams');
    
    if (llmProviderSelect) llmProviderSelect.value = '';
    if (openaiApiKey) openaiApiKey.value = '';
    if (compatibleBaseUrl) compatibleBaseUrl.value = '';
    if (compatibleModel) compatibleModel.value = '';
    if (compatibleHeaders) compatibleHeaders.value = '';
    if (compatibleParams) compatibleParams.value = '';
    
    // 隱藏所有配置區域
    const openaiConfig = document.getElementById('openai-config');
    const openaiCompatibleConfig = document.getElementById('openai-compatible-config');
    const userModelsSection = document.getElementById('user-models-section');
    const llmTestSection = document.getElementById('llm-test-section');
    const llmActions = document.getElementById('llm-actions');
    
    if (openaiConfig) openaiConfig.style.display = 'none';
    if (openaiCompatibleConfig) openaiCompatibleConfig.style.display = 'none';
    if (userModelsSection) userModelsSection.style.display = 'none';
    if (llmTestSection) llmTestSection.style.display = 'none';
    if (llmActions) llmActions.style.display = 'none';
    
    // 清除保存的設定（包括用戶模型）
    chrome.storage.local.remove(['llmSettings', 'providerModels', 'globalDefaultModel'], function() {
      const translations = currentTranslations?.llm || {};
      showLLMActionStatus(translations.resetSuccess || '🔄 LLM 設定已重置', 'info');
    });
  }

  function loadLLMSettingsHandler() {
    chrome.storage.local.get(['llmSettings'], function(result) {
      const settings = result.llmSettings;
      
      if (!settings) {
        return; // 沒有設定時不顯示訊息
      }
      
      const llmProviderSelect = document.getElementById('llmProviderSelect');
      if (llmProviderSelect) {
        llmProviderSelect.value = settings.provider || '';
        
        // 觸發 change 事件以顯示對應的配置區域
        llmProviderSelect.dispatchEvent(new Event('change'));
      }
      
      if (settings.provider === 'openai' && settings.config) {
        const openaiApiKey = document.getElementById('openaiApiKey');
        
        if (openaiApiKey) openaiApiKey.value = settings.config.apiKey || '';
      } else if (settings.provider === 'openai-compatible' && settings.config) {
        const compatibleBaseUrl = document.getElementById('compatibleBaseUrl');
        const compatibleModel = document.getElementById('compatibleModel');
        const compatibleHeaders = document.getElementById('compatibleHeaders');
        const compatibleParams = document.getElementById('compatibleParams');
        
        if (compatibleBaseUrl) compatibleBaseUrl.value = settings.config.baseUrl || '';
        if (compatibleModel) compatibleModel.value = settings.config.model || '';
        if (compatibleHeaders && settings.config.customHeaders) {
          compatibleHeaders.value = JSON.stringify(settings.config.customHeaders, null, 2);
        }
        if (compatibleParams && settings.config.customParams) {
          compatibleParams.value = JSON.stringify(settings.config.customParams, null, 2);
        }
      }
    });
  }

  function showLLMActionStatus(message, type) {
    const llmActionStatus = document.getElementById('llmActionStatus');
    if (!llmActionStatus) return;
    
    llmActionStatus.textContent = message;
    llmActionStatus.className = `llm-status ${type} show`;
    
    setTimeout(() => {
      llmActionStatus.classList.remove('show');
    }, 3000);
  }

  // 減少檢查頻率，避免過度請求
  setInterval(checkSlackPage, 10000);
});