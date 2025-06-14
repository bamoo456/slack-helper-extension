/**
 * UI Components Module
 * Handles creation and management of UI elements like buttons and modals
 */

// Removed unused imports: sleep, debounce

/**
 * Summary Button Manager
 * Handles creation and management of the summary button
 */
export class SummaryButtonManager {
  constructor() {
    this.buttonClass = 'slack-helper-btn';
    this.buttonStyles = {
      background: '#4A154B',
      color: 'white',
      border: 'none',
      padding: '6px 12px',
      borderRadius: '4px',
      fontSize: '13px',
      fontWeight: '500',
      cursor: 'pointer',
      marginLeft: '12px',
      transition: 'background-color 0.2s',
      zIndex: '1000',
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      height: '28px',
      flexShrink: '0' // 防止按鈕被壓縮
    };
    // 初始化翻譯
    this.translations = null;
    this.initializeTranslations();
  }

  /**
   * 初始化翻譯系統
   */
  async initializeTranslations() {
    try {
      this.translations = await this.loadCurrentTranslations();
    } catch (error) {
      console.warn('Failed to load translations for SummaryButtonManager:', error);
      this.translations = this.getFallbackTranslations();
    }
  }

  /**
   * 載入當前語言的翻譯
   * @returns {Promise<Object>} 翻譯對象
   */
  async loadCurrentTranslations() {
    const isChromeExtensionContext = this.isValidChromeExtensionContext();
    
    if (isChromeExtensionContext) {
      // 獲取當前選擇的語言
      const selectedLanguage = await this.getCurrentLanguage();
      
      // 載入對應語言的翻譯文件
      const response = await fetch(chrome.runtime.getURL(`locales/${selectedLanguage}/translation.json`));
      return await response.json();
    }
    
    return this.getFallbackTranslations();
  }

  /**
   * 獲取當前選擇的語言
   * @returns {Promise<string>} 語言代碼
   */
  async getCurrentLanguage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['selectedLanguage'], (result) => {
        if (chrome.runtime.lastError) {
          console.warn('Error getting current language:', chrome.runtime.lastError);
          resolve('zh-TW'); // 預設語言
        } else {
          resolve(result.selectedLanguage || 'zh-TW');
        }
      });
    });
  }

  /**
   * 獲取備用翻譯（中文版本）
   * @returns {Object} 備用翻譯對象
   */
  getFallbackTranslations() {
    return {
      ui: {
        summaryButton: '📝 摘要此討論串',
        loading: '⏳ 正在分析討論串...',
        opening: '🚀 正在開啟 Gemini...',
        success: '✅ 已開啟 Gemini',
        error: '❌ 錯誤'
      }
    };
  }

  /**
   * 檢查 Chrome 擴展環境是否有效
   * @returns {boolean} 是否為有效的 Chrome 擴展環境
   */
  isValidChromeExtensionContext() {
    try {
      return typeof chrome !== 'undefined' && 
             chrome.storage && 
             chrome.storage.local && 
             chrome.runtime && 
             chrome.runtime.id;
    } catch (error) {
      return false;
    }
  }

  async createSummaryButton(clickHandler) {
    // 確保翻譯已載入
    if (!this.translations) {
      await this.initializeTranslations();
    }
    
    const button = document.createElement('button');
    button.className = this.buttonClass;
    button.innerHTML = this.translations?.ui?.summaryButton || '📝 摘要此討論串';
    const tooltipText = `${this.translations?.ui?.summaryButton || '📝 摘要此討論串'} (Ctrl+T)`;
    button.setAttribute('data-tooltip', tooltipText); // 用於立即顯示的自訂 tooltip
    
    // 確保 tooltip CSS 已插入
    this.ensureTooltipStyles();

    Object.assign(button.style, this.buttonStyles);
    this.addButtonEventListeners(button, clickHandler);
    return button;
  }

  addButtonEventListeners(button, clickHandler) {
    // Store original tooltip for restoration
    const originalTooltip = button.getAttribute('data-tooltip');
    
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#611f69';
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#4A154B';
      // Ensure tooltip preserved after hover
      if (!button.getAttribute('data-tooltip')) {
        button.setAttribute('data-tooltip', originalTooltip);
      }
    });
    button.addEventListener('click', clickHandler);
  }

  /**
   * Ensure tooltip CSS is injected once
   */
  ensureTooltipStyles() {
    // Use the shared tooltip styles from message-helper.js
    // Check if styles already exist, if not, inject them
    if (document.getElementById('slack-helper-tooltip-styles')) return;

    const style = document.createElement('style');
    style.id = 'slack-helper-tooltip-styles';
    style.textContent = `
      [data-tooltip] {
        position: relative;
      }
      [data-tooltip]::after {
        content: attr(data-tooltip);
        position: absolute;
        top: 110%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.75);
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        white-space: nowrap;
        font-size: 12px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.1s ease-in-out;
        z-index: 10000;
      }
      [data-tooltip]:hover::after {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  }

  async updateButtonState(button, state, text) {
    // 確保翻譯已載入
    if (!this.translations) {
      await this.initializeTranslations();
    }

    const states = {
      loading: { 
        text: this.translations?.ui?.loading || '⏳ 正在分析討論串...', 
        disabled: true 
      },
      opening: { 
        text: this.translations?.ui?.opening || '🚀 正在開啟 Gemini...', 
        disabled: true 
      },
      success: { 
        text: this.translations?.ui?.success || '✅ 已開啟 Gemini', 
        disabled: true 
      },
      error: { 
        text: this.translations?.ui?.error || '❌ 錯誤', 
        disabled: true 
      },
      default: { 
        text: this.translations?.ui?.summaryButton || '📝 摘要此討論串', 
        disabled: false 
      }
    };

    const stateConfig = states[state] || states.default;
    button.innerHTML = text || stateConfig.text;
    button.disabled = stateConfig.disabled;
  }

  resetButtonAfterDelay(button, delay = 2000) {
    setTimeout(async () => {
      await this.updateButtonState(button, 'default');
    }, delay);
  }

  buttonExists(container) {
    // 檢查指定容器或整個頁面是否已經有按鈕
    const searchScope = container || document;
    const existingButton = searchScope.querySelector(`.${this.buttonClass}`);
    
    if (existingButton) {
      const location = container ? '指定容器' : '頁面';
      console.log(`摘要按鈕已存在於${location}中`, {
        container: container ? container.className : 'document',
        buttonElement: existingButton
      });
      return true;
    }
    
    console.log(`未在${container ? '指定容器' : '頁面'}中找到摘要按鈕`);
    return false;
  }

  removeExistingButtons() {
    const existingButtons = document.querySelectorAll(`.${this.buttonClass}`);
    existingButtons.forEach(button => {
      console.log('移除現有的摘要按鈕');
      button.remove();
    });
    return existingButtons.length;
  }

  /**
   * 重新載入翻譯並更新現有按鈕
   */
  async reloadTranslationsAndUpdateButtons() {
    try {
      // 重新載入翻譯
      this.translations = await this.loadCurrentTranslations();
      
      // 更新所有現有的摘要按鈕
      const existingButtons = document.querySelectorAll(`.${this.buttonClass}`);
      existingButtons.forEach(button => {
        // 只更新處於預設狀態的按鈕（不是載入中或其他狀態）
        if (!button.disabled) {
          button.innerHTML = this.translations?.ui?.summaryButton || '📝 摘要此討論串';
          const tooltipText = `${this.translations?.ui?.summaryButton || '📝 摘要此討論串'} (Ctrl+T)`;
          button.setAttribute('data-tooltip', tooltipText);
        }
      });
      
      console.log(`Updated ${existingButtons.length} summary buttons with new language`);
    } catch (error) {
      console.error('Failed to reload translations and update buttons:', error);
    }
  }
}

/**
 * Thread Analyzer
 * Handles analysis and formatting of thread messages
 */
export class ThreadAnalyzer {
  constructor() {
    this.translations = null;
    this.initializeTranslations();
  }

  async initializeTranslations() {
    try {
      this.translations = await this.loadCurrentTranslations();
    } catch (error) {
      console.warn('Failed to load translations for ThreadAnalyzer:', error);
      this.translations = this.getFallbackTranslations();
    }
  }

  async loadCurrentTranslations() {
    const isChromeExtensionContext = this.isValidChromeExtensionContext();
    
    if (isChromeExtensionContext) {
      const selectedLanguage = await this.getCurrentLanguage();
      const response = await fetch(chrome.runtime.getURL(`locales/${selectedLanguage}/translation.json`));
      return await response.json();
    }
    
    return this.getFallbackTranslations();
  }

  getFallbackTranslations() {
    return {
      ui: {
        unknownTime: '未知時間',
        lengthShort: '簡短討論',
        lengthMedium: '中等長度',
        lengthLong: '長篇討論'
      }
    };
  }

  /**
   * 獲取當前語言的預設系統提示詞
   * @returns {Promise<string>} 預設系統提示詞
   */
  async getDefaultSystemPrompt() {
    try {
      const isChromeExtensionContext = this.isValidChromeExtensionContext();
      
      if (isChromeExtensionContext) {
        // 獲取當前選擇的語言
        const selectedLanguage = await this.getCurrentLanguage();
        
        // 載入對應語言的翻譯文件
        const translations = await this.loadTranslations(selectedLanguage);
        
        if (translations && translations.prompt && translations.prompt.defaultSystemPrompt) {
          console.log('✅ Using i18n default system prompt for language:', selectedLanguage);
          return translations.prompt.defaultSystemPrompt;
        }
      }
      
      // 如果無法獲取翻譯，使用中文備用版本
      console.log('⚠️ Using fallback default system prompt');
      return this.getFallbackDefaultPrompt();
      
    } catch (error) {
      console.warn('❌ Error getting default system prompt:', error);
      return this.getFallbackDefaultPrompt();
    }
  }

  /**
   * 獲取當前選擇的語言
   * @returns {Promise<string>} 語言代碼
   */
  async getCurrentLanguage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['selectedLanguage'], (result) => {
        if (chrome.runtime.lastError) {
          console.warn('Error getting current language:', chrome.runtime.lastError);
          resolve('zh-TW'); // 預設語言
        } else {
          resolve(result.selectedLanguage || 'zh-TW');
        }
      });
    });
  }

  /**
   * 載入指定語言的翻譯文件
   * @param {string} language - 語言代碼
   * @returns {Promise<Object>} 翻譯對象
   */
  async loadTranslations(language) {
    try {
      const response = await fetch(chrome.runtime.getURL(`locales/${language}/translation.json`));
      return await response.json();
    } catch (error) {
      console.warn('Error loading translations for language:', language, error);
      return null;
    }
  }

  /**
   * 獲取備用的預設系統提示詞（中文版本）
   * @returns {string} 備用提示詞
   */
  getFallbackDefaultPrompt() {
    return `請幫我總結以下 Slack 討論串的內容（以 Markdown 格式提供）：

**注意：以下內容使用 Markdown 格式，包含可點擊的鏈接和用戶提及**

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

  async analyzeThread(messages) {
    // 確保翻譯已載入
    if (!this.translations) {
      await this.initializeTranslations();
    }
    
    const participants = [...new Set(messages.map(msg => msg.user).filter(Boolean))];
    const messageCount = messages.length;
    const timeRange = this.calculateTimeRange(messages);
    const estimatedLength = this.estimateLength(messages);
    
    return {
      participants,
      messageCount,
      timeRange,
      estimatedLength
    };
  }

  calculateTimeRange(messages) {
    const timestamps = messages.map(msg => msg.timestamp).filter(Boolean);
    return timestamps.length > 1 ? 
      `${timestamps[0]} - ${timestamps[timestamps.length - 1]}` : 
      timestamps[0] || this.translations?.ui?.unknownTime || '未知時間';
  }

  estimateLength(messages) {
    const totalChars = messages.reduce((sum, msg) => sum + (msg.text || '').length, 0);
    return totalChars > 2000 ? this.translations?.ui?.lengthLong || '長篇討論' : totalChars > 500 ? this.translations?.ui?.lengthMedium || '中等長度' : this.translations?.ui?.lengthShort || '簡短討論';
  }

  generatePreviewText(messages) {
    const preview = messages.map((msg, index) => {
      const text = (msg.text || '').substring(0, 200); // 增加顯示字數到200字
      const truncated = msg.text && msg.text.length > 200 ? '...' : '';
      const timestamp = msg.timestamp ? ` (${msg.timestamp})` : '';
      return `<div style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; border-left: 3px solid #4A154B;">
        <div style="font-weight: bold; color: #4A154B; margin-bottom: 4px;">
          ${index + 1}. ${msg.user}${timestamp}
        </div>
        <div style="color: #333; line-height: 1.4;">
          ${text}${truncated}
        </div>
      </div>`;
    }).join('');

    return preview;
  }

  async formatMessagesForGemini(messages) {
    console.log('🔄 ThreadAnalyzer.formatMessagesForGemini called with', messages.length, 'messages');
    
    try {
      // Get custom system prompt from storage
      const customPrompt = await this.getCustomSystemPrompt();
      console.log('📝 Custom prompt retrieved:', customPrompt ? `Yes (${customPrompt.length} chars)` : 'No');
      
      // Get default system prompt (now async)
      const defaultSystemPrompt = await this.getDefaultSystemPrompt();
      
      // Format messages with numbering like the original
      const messageText = messages.map((msg, index) => {
        return `${index + 1}. **${msg.user}** (${msg.timestamp}):\n${msg.text}\n`;
      }).join('\n');
      
      console.log('📊 Formatted message stats:', {
        messageCount: messages.length,
        totalLength: messageText.length,
        promptLength: customPrompt ? customPrompt.length : defaultSystemPrompt.length
      });
      
      if (customPrompt && customPrompt.trim()) {
        console.log('Using custom system prompt');
        const result = customPrompt.includes('{MESSAGES}') ? 
          customPrompt.replace('{MESSAGES}', messageText) : 
          customPrompt + '\n\n' + messageText;
        console.log('📤 Final formatted message length:', result.length);
        return result;
      } else {
        console.log('Using default system prompt');
        const result = defaultSystemPrompt.replace('{MESSAGES}', messageText);
        console.log('📤 Final formatted message length:', result.length);
        return result;
      }
      
    } catch (error) {
      console.error('❌ Error formatting messages:', error);
      console.log('⚠️ Using fallback formatting');
      
      // Fallback to simple formatting
      const messageText = messages.map((msg, index) => {
        return `${index + 1}. **${msg.user}** (${msg.timestamp}):\n${msg.text}\n`;
      }).join('\n');
      
      const fallbackPrompt = this.getFallbackDefaultPrompt();
      const result = fallbackPrompt.replace('{MESSAGES}', messageText);
      console.log('📤 Final formatted message length:', result.length);
      return result;
    }
  }

  async getCustomSystemPrompt() {
    console.log('🔍 ThreadAnalyzer.getCustomSystemPrompt called');
    
    return new Promise((resolve) => {
      try {
        const isChromeExtensionContext = this.isValidChromeExtensionContext();
        
        if (isChromeExtensionContext) {
          console.log('✅ Chrome extension context available');
          
          chrome.storage.local.get(['customSystemPrompt'], function(result) {
            if (chrome.runtime.lastError) {
              console.warn('❌ Chrome storage error:', chrome.runtime.lastError);
              resolve('');
            } else {
              const customPrompt = result.customSystemPrompt || '';
              console.log('📦 Storage result:', result);
              console.log('📝 Custom prompt found:', customPrompt ? `Yes (${customPrompt.length} chars)` : 'No');
              resolve(customPrompt);
            }
          });
        } else {
          console.warn('❌ Chrome extension context not available, using default prompt');
          resolve('');
        }
      } catch (error) {
        console.warn('❌ Error accessing chrome storage:', error);
        resolve('');
      }
    });
  }

  /**
   * 檢查 Chrome 擴展環境是否有效
   * @returns {boolean} 是否為有效的 Chrome 擴展環境
   */
  isValidChromeExtensionContext() {
    try {
      // 檢查基本的 chrome 物件
      if (typeof chrome === 'undefined') {
        return false;
      }
      
      // 檢查 chrome.storage 是否可用
      if (!chrome.storage || !chrome.storage.local) {
        return false;
      }
      
      // 檢查 chrome.runtime 是否可用
      if (!chrome.runtime) {
        return false;
      }
      
      // 檢查擴展 ID 是否存在且有效
      if (!chrome.runtime.id) {
        return false;
      }
      
      // 嘗試檢查 runtime 是否仍然連接
      if (chrome.runtime.lastError) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.warn('Error checking Chrome extension context:', error);
      return false;
    }
  }
}

/**
 * Preview Modal Manager
 * Handles the preview modal for thread messages before sending to Gemini
 */
export class PreviewModalManager {
  constructor() {
    this.modalClass = 'slack-helper-modal';
    this.modalContentClass = 'slack-helper-modal-content';
    this.translations = null;
    this.initializeTranslations();
  }

  async initializeTranslations() {
    try {
      this.translations = await this.loadCurrentTranslations();
    } catch (error) {
      console.warn('Failed to load translations for PreviewModalManager:', error);
      this.translations = this.getFallbackTranslations();
    }
  }

  async loadCurrentTranslations() {
    const isChromeExtensionContext = this.isValidChromeExtensionContext();
    
    if (isChromeExtensionContext) {
      const selectedLanguage = await this.getCurrentLanguage();
      const response = await fetch(chrome.runtime.getURL(`locales/${selectedLanguage}/translation.json`));
      return await response.json();
    }
    
    return this.getFallbackTranslations();
  }

  async getCurrentLanguage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['selectedLanguage'], (result) => {
        if (chrome.runtime.lastError) {
          console.warn('Error getting current language:', chrome.runtime.lastError);
          resolve('zh-TW');
        } else {
          resolve(result.selectedLanguage || 'zh-TW');
        }
      });
    });
  }

  getFallbackTranslations() {
    return {
      ui: {
        previewTitle: '📝 討論串摘要預覽',
        participants: '👥 參與者:',
        participantsCount: '{{count}} 人',
        messageCount: '💬 訊息數:',
        messagesCount: '{{count}} 條',
        estimatedLength: '預估長度: {{length}}',
        timeRange: '⏰ 時間範圍:',
        selectModel: '🤖 選擇 Gemini 模型：',
        syncTip: '💡 更多同步選項請查看擴展設定',
        participantsList: '👥 參與者列表：',
        threadPreview: '📄 討論串預覽：',
        copyToClipboard: '📋 複製到剪貼簿',
        copied: '✅ 已複製',
        cancel: '❌ 取消',
        confirm: '✅ 確認摘要'
      }
    };
  }

  async showThreadPreview(messages) {
    // 確保翻譯已載入
    if (!this.translations) {
      await this.initializeTranslations();
    }
    
    return new Promise((resolve) => {
      this.createPreviewModal(messages, resolve);
    });
  }

  async createPreviewModal(messages, resolve) {
    // 確保翻譯已載入
    if (!this.translations) {
      await this.initializeTranslations();
    }
    
    const analyzer = new ThreadAnalyzer();
    const threadInfo = await analyzer.analyzeThread(messages);
    
    const modal = document.createElement('div');
    modal.className = this.modalClass;
    this.applyModalStyles(modal);
    
    const modalContent = document.createElement('div');
    modalContent.className = this.modalContentClass;
    this.applyModalContentStyles(modalContent);
    
    // 獲取可用模型列表
    const availableModels = await this.getAvailableModels();
    
    modalContent.innerHTML = this.generateModalHTML(threadInfo, messages, analyzer, availableModels);
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // 添加事件監聽器
    this.addModalEventListeners(modal, modalContent, resolve, messages, availableModels);
    
    // 顯示動畫
    setTimeout(() => {
      modal.style.opacity = '1';
      modalContent.style.transform = 'translateY(0)';
    }, 10);
  }

  /**
   * 獲取可用的 Gemini 模型列表
   * @returns {Promise<Array>} 可用模型列表
   */
  async getAvailableModels() {
    return new Promise((resolve) => {
      try {
        console.log('🔍 PreviewModalManager.getAvailableModels called');
        
        // 檢查 Chrome 擴展環境
        const isChromeExtensionContext = this.isValidChromeExtensionContext();
        console.log('✅ Chrome extension context valid:', isChromeExtensionContext);
        
        if (isChromeExtensionContext) {
          console.log('📤 Sending message to background script: getAvailableModels');
          
          // 向背景腳本請求可用模型列表
          chrome.runtime.sendMessage({ action: 'getAvailableModels' }, (response) => {
            console.log('📥 Response from background script:', response);
            
            if (chrome.runtime.lastError) {
              console.warn('❌ Chrome runtime error:', chrome.runtime.lastError);
              console.log('🔄 Using fallback models due to runtime error');
              resolve(this.getFallbackModels());
            } else if (response && response.models && Array.isArray(response.models)) {
              console.log('✅ Got models from background script:', response.models.length, '個模型');
              console.log('📋 Models list:', response.models);
              
              // 確保 auto 模型總是存在
              const modelsWithAuto = this.ensureAutoModelExists(response.models);
              resolve(modelsWithAuto);
            } else {
              console.warn('⚠️ Background script returned invalid response:', response);
              console.log('🔄 Using fallback models due to invalid response');
              resolve(this.getFallbackModels());
            }
          });
        } else {
          console.warn('❌ Chrome extension context not available, using fallback models');
          resolve(this.getFallbackModels());
        }
      } catch (error) {
        console.warn('❌ Error in getAvailableModels:', error);
        console.log('🔄 Using fallback models due to error');
        resolve(this.getFallbackModels());
      }
    });
  }

  /**
   * 確保模型列表中包含 auto 模型
   * @param {Array} models 原始模型列表
   * @returns {Array} 包含 auto 模型的列表
   */
  ensureAutoModelExists(models) {
    // 檢查是否已經有 auto 模型
    const hasAutoModel = models.some(model => model.value === 'auto');
    
    if (hasAutoModel) {
      console.log('✅ Auto model already exists in the list');
      return models;
    }
    
    // 如果沒有 auto 模型，添加它
    console.log('➕ Adding auto model to the list');
    const autoModelText = this.translations?.ui?.autoModel || '🔄 自動 (使用 Gemini 頁面預設模型)';
    const autoModel = {
      value: 'auto',
      displayName: autoModelText
    };
    
    // 將 auto 模型放在列表的第一位
    return [autoModel, ...models];
  }

  /**
   * 獲取備用模型列表
   * @returns {Array} 備用模型列表
   */
  getFallbackModels() {
    const autoModelText = this.translations?.ui?.autoModel || '🔄 自動 (使用 Gemini 頁面預設模型)';
    return [
      {
        value: 'auto',
        displayName: autoModelText
      }
    ];
  }

  /**
   * 生成模型選擇的 HTML
   * @param {Array} availableModels 可用模型列表
   * @returns {string} 模型選擇的 HTML
   */
  generateModelSelectHTML(availableModels) {
    const options = availableModels.map(model => 
      `<option value="${model.value}">${model.displayName}</option>`
    ).join('');

    return `
      <select id="geminiModelSelect" style="
        width: 100%;
        padding: 12px 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-radius: 6px;
        font-size: 14px;
        background: rgba(255,255,255,0.9);
        margin-bottom: 12px;
        font-weight: 500;
        color: #333;
      ">
        ${options}
      </select>
    `;
  }

  applyModalStyles(modal) {
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
  }
  
  applyModalContentStyles(modalContent) {
    modalContent.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      transform: translateY(20px);
      transition: transform 0.3s ease;
    `;
  }

  generateModalHTML(threadInfo, messages, analyzer, availableModels) {
    return `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; margin: -24px -24px 20px -24px; border-radius: 12px 12px 0 0;">
        <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">${this.translations?.ui?.previewTitle || '📝 討論串摘要預覽'}</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; font-size: 14px;">
          <div>
            <strong>${this.translations?.ui?.participants || '👥 參與者:'}</strong> ${this.translations?.ui?.participantsCount ? this.translations.ui.participantsCount.replace('{{count}}', threadInfo.participants.length) : threadInfo.participants.length + ' 人'}<br>
            <small style="opacity: 0.9;">${threadInfo.participants.slice(0, 3).join(', ')}${threadInfo.participants.length > 3 ? '...' : ''}</small>
          </div>
          <div>
            <strong>${this.translations?.ui?.messageCount || '💬 訊息數:'}</strong> ${this.translations?.ui?.messagesCount ? this.translations.ui.messagesCount.replace('{{count}}', threadInfo.messageCount) : threadInfo.messageCount + ' 條'}<br>
            <small style="opacity: 0.9;">${this.translations?.ui?.estimatedLength ? this.translations.ui.estimatedLength.replace('{{length}}', threadInfo.estimatedLength) : '預估長度: ' + threadInfo.estimatedLength}</small>
          </div>
          <div>
            <strong>${this.translations?.ui?.timeRange || '⏰ 時間範圍:'}</strong><br>
            <small style="opacity: 0.9;">${threadInfo.timeRange}</small>
          </div>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; color: #4A154B; font-size: 16px;">
            ${this.translations?.ui?.selectModel || '🤖 選擇 Gemini 模型：'}
          </h3>
          <div style="display: flex; gap: 8px; align-items: center;">
            <div style="font-size: 12px; color: #666; padding: 4px 8px; background: #f8f9fa; border-radius: 4px;">
              ${this.translations?.ui?.syncTip || '💡 更多同步選項請查看擴展設定'}
            </div>
          </div>
        </div>
        <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);">
          ${this.generateModelSelectHTML(availableModels)}
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 12px 0; color: #4A154B; font-size: 16px;">
          ${this.translations?.ui?.participantsList || '👥 參與者列表：'}
        </h3>
        <div style="background: linear-gradient(135deg, #17a2b8, #138496); color: white; padding: 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(23, 162, 184, 0.3);">
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${threadInfo.participants.map(participant => 
              `<span style="background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;">
                👤 ${participant}
              </span>`
            ).join('')}
          </div>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; color: #4A154B; font-size: 16px;">
            ${this.translations?.ui?.threadPreview || '📄 討論串預覽：'}
          </h3>
          <button id="copyToClipboard" style="
            background: #28a745;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            transition: background-color 0.2s;
          ">
            ${this.translations?.ui?.copyToClipboard || '📋 複製到剪貼簿'}
          </button>
        </div>
        <div style="background: linear-gradient(135deg, #6f42c1, #8e44ad); padding: 16px; border-radius: 8px; max-height: 400px; overflow-y: auto; font-size: 13px; line-height: 1.4; box-shadow: 0 4px 12px rgba(111, 66, 193, 0.3);">
          ${analyzer.generatePreviewText(messages)}
        </div>
      </div>

      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="cancelSummary" style="
          background: #6c757d;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        ">
          ${this.translations?.ui?.cancel || '❌ 取消'}
        </button>
        <button id="confirmSummary" style="
          background: #4A154B;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        ">
          ${this.translations?.ui?.confirm || '✅ 確認摘要'}
        </button>
      </div>
    `;
  }

  addModalEventListeners(modal, modalContent, resolve, messages, availableModels) {
    const confirmBtn = modalContent.querySelector('#confirmSummary');
    const cancelBtn = modalContent.querySelector('#cancelSummary');
    const copyBtn = modalContent.querySelector('#copyToClipboard');
    const modelSelect = modalContent.querySelector('#geminiModelSelect');

    // 載入已選擇的模型
    this.loadSelectedModel(modelSelect, availableModels);

    // 按鈕懸停效果
    this.addButtonHoverEffects(cancelBtn, '#5a6268', '#6c757d');
    this.addButtonHoverEffects(confirmBtn, '#611f69', '#4A154B');
    this.addButtonHoverEffects(copyBtn, '#218838', '#28a745');

    // 模型選擇變更事件
    modelSelect.addEventListener('change', () => {
      // 儲存選擇的模型
      this.saveSelectedModel(modelSelect.value);
    });

    // 確認按鈕
    confirmBtn.addEventListener('click', () => {
      const selectedModel = modelSelect.value;
      this.closeModal(modal);
      resolve({ confirmed: true, selectedModel, messages });
    });

    // 取消按鈕
    cancelBtn.addEventListener('click', () => {
      this.closeModal(modal);
      resolve({ confirmed: false });
    });

    // 複製到剪貼簿按鈕
    copyBtn.addEventListener('click', () => {
      const formattedText = this.formatMessagesForClipboard(messages);
      navigator.clipboard.writeText(formattedText).then(() => {
        copyBtn.innerHTML = this.translations?.ui?.copied || '✅ 已複製';
        setTimeout(() => {
          copyBtn.innerHTML = this.translations?.ui?.copyToClipboard || '📋 複製到剪貼簿';
        }, 2000);
      });
    });

    // ESC 鍵關閉
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeModal(modal);
        resolve({ confirmed: false });
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  formatMessagesForClipboard(messages) {
    return messages.map(msg => {
      const timestamp = msg.timestamp ? `[${msg.timestamp}] ` : '';
      const user = msg.user || 'Unknown User';
      const text = msg.text || '';
      return `${timestamp}${user}: ${text}`;
    }).join('\n\n');
  }

  addButtonHoverEffects(button, hoverColor, normalColor) {
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = hoverColor;
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = normalColor;
    });
  }

  loadSelectedModel(modelSelect, availableModels) {
    const isChromeExtensionContext = this.isValidChromeExtensionContext();
    
    if (isChromeExtensionContext) {
      chrome.storage.local.get(['selectedGeminiModel'], (result) => {
        if (chrome.runtime.lastError) {
          console.warn('Error loading selected model:', chrome.runtime.lastError);
          return;
        }
        
        const savedModel = result.selectedGeminiModel;
        if (savedModel) {
          // 檢查儲存的模型是否在可用模型列表中
          const modelExists = availableModels.some(model => model.value === savedModel);
          if (modelExists) {
            modelSelect.value = savedModel;
          } else {
            console.warn('儲存的模型不在可用列表中:', savedModel);
            // 使用第一個可用模型作為預設值
            if (availableModels.length > 0) {
              modelSelect.value = availableModels[0].value;
              this.saveSelectedModel(availableModels[0].value);
            }
          }
        } else {
          // 沒有儲存的模型，使用第一個可用模型
          if (availableModels.length > 0) {
            modelSelect.value = availableModels[0].value;
            this.saveSelectedModel(availableModels[0].value);
          }
        }
      });
    } else {
      console.warn('Chrome extension context not available, using first available model');
      if (availableModels.length > 0) {
        modelSelect.value = availableModels[0].value;
      }
    }
  }

  /**
   * 保存選擇的模型到儲存
   * @param {string} modelValue - 模型值
   */
  saveSelectedModel(modelValue) {
    const isChromeExtensionContext = this.isValidChromeExtensionContext();
    
    if (isChromeExtensionContext) {
      chrome.storage.local.set({ selectedGeminiModel: modelValue }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Error saving selected model:', chrome.runtime.lastError);
        }
      });
    }
  }

  closeModal(modal) {
    modal.style.opacity = '0';
    modal.querySelector(`.${this.modalContentClass}`).style.transform = 'translateY(20px)';
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 300);
  }

  /**
   * 檢查 Chrome 擴展環境是否有效
   * @returns {boolean} 是否為有效的 Chrome 擴展環境
   */
  isValidChromeExtensionContext() {
    try {
      // 檢查基本的 chrome 物件
      if (typeof chrome === 'undefined') {
        return false;
      }
      
      // 檢查 chrome.storage 是否可用
      if (!chrome.storage || !chrome.storage.local) {
        return false;
      }
      
      // 檢查 chrome.runtime 是否可用
      if (!chrome.runtime) {
        return false;
      }
      
      // 檢查擴展 ID 是否存在且有效
      if (!chrome.runtime.id) {
        return false;
      }
      
      // 嘗試檢查 runtime 是否仍然連接
      if (chrome.runtime.lastError) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.warn('Error checking Chrome extension context:', error);
      return false;
    }
  }
}

/**
 * Page Observer
 * Observes page changes to detect when threads are opened/closed
 */
export class PageObserver {
  constructor(callback) {
    this.callback = callback;
    this.observer = null;
    this.lastUrl = window.location.href;
  }

  startObserving() {
    let debounceTimer = null;
    let lastCallTime = 0;
    
    // 監聽 DOM 變化
    this.observer = new MutationObserver((mutations) => {
      const now = Date.now();
      
      // 限制最小調用間隔為 1 秒
      if (now - lastCallTime < 1000) {
        return;
      }
      
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      debounceTimer = setTimeout(() => {
        // 檢查是否有相關的 DOM 變化
        const hasRelevantChanges = mutations.some(mutation => {
          if (mutation.type === 'childList') {
            // 只關心 thread 相關的變化
            const target = mutation.target;
            return target.closest('.p-threads_flexpane') || 
                   target.closest('.p-thread_view') ||
                   target.querySelector('.p-threads_flexpane') ||
                   target.querySelector('.p-thread_view');
          }
          return false;
        });
        
        // 檢查 URL 是否變化
        const currentUrl = window.location.href;
        const urlChanged = currentUrl !== this.lastUrl;
        if (urlChanged) {
          this.lastUrl = currentUrl;
        }
        
        if (hasRelevantChanges || urlChanged) {
          lastCallTime = now;
          this.callback();
        }
      }, 800);
    });

    // 開始觀察
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 監聽 popstate 事件（瀏覽器前進/後退）
    window.addEventListener('popstate', () => {
      setTimeout(() => {
        this.callback();
      }, 500);
    });
  }

  stopObserving() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
} 