/**
 * UI Components Module
 * Handles creation and management of UI elements like buttons and modals
 */

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
  }

  createSummaryButton(clickHandler) {
    const button = document.createElement('button');
    button.className = this.buttonClass;
    button.innerHTML = '📝 摘要此討論串';
    
    Object.assign(button.style, this.buttonStyles);
    this.addButtonEventListeners(button, clickHandler);
    return button;
  }

  addButtonEventListeners(button, clickHandler) {
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#611f69';
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#4A154B';
    });
    button.addEventListener('click', clickHandler);
  }

  updateButtonState(button, state, text) {
    const states = {
      loading: { text: '⏳ 正在分析討論串...', disabled: true },
      opening: { text: '🚀 正在開啟 Gemini...', disabled: true },
      success: { text: '✅ 已開啟 Gemini', disabled: true },
      error: { text: '❌ 錯誤', disabled: true },
      default: { text: '📝 摘要此討論串', disabled: false }
    };

    const stateConfig = states[state] || states.default;
    button.innerHTML = text || stateConfig.text;
    button.disabled = stateConfig.disabled;
  }

  resetButtonAfterDelay(button, delay = 2000) {
    setTimeout(() => {
      this.updateButtonState(button, 'default');
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
}

/**
 * Thread Analyzer
 * Handles analysis and formatting of thread messages
 */
export class ThreadAnalyzer {
  constructor() {
    this.defaultSystemPrompt = `請幫我總結以下 Slack 討論串的內容（以 Markdown 格式提供）：

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

  analyzeThread(messages) {
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
      timestamps[0] || '未知時間';
  }

  estimateLength(messages) {
    const totalChars = messages.reduce((sum, msg) => sum + (msg.text || '').length, 0);
    return totalChars > 2000 ? '長篇討論' : totalChars > 500 ? '中等長度' : '簡短討論';
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
      
      // Format messages with numbering like the original
      const messageText = messages.map((msg, index) => {
        return `${index + 1}. **${msg.user}** (${msg.timestamp}):\n${msg.text}\n`;
      }).join('\n');
      
      console.log('📊 Formatted message stats:', {
        messageCount: messages.length,
        totalLength: messageText.length,
        promptLength: customPrompt ? customPrompt.length : this.defaultSystemPrompt.length
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
        const result = this.defaultSystemPrompt.replace('{MESSAGES}', messageText);
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
      
      const result = this.defaultSystemPrompt.replace('{MESSAGES}', messageText);
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
  }

  async showThreadPreview(messages) {
    return new Promise((resolve) => {
      this.createPreviewModal(messages, resolve);
    });
  }

  async createPreviewModal(messages, resolve) {
    const analyzer = new ThreadAnalyzer();
    const threadInfo = analyzer.analyzeThread(messages);
    
    const modal = document.createElement('div');
    modal.className = this.modalClass;
    this.applyModalStyles(modal);

    const modalContent = document.createElement('div');
    modalContent.className = this.modalContentClass;
    this.applyModalContentStyles(modalContent);

    // 獲取可用模型列表並生成 HTML
    let availableModels = await this.getAvailableModels();
    console.log('🔍 PreviewModalManager.createPreviewModal: Available models:', availableModels);
    availableModels = [...this.getFallbackModels(), ...availableModels];
    modalContent.innerHTML = this.generateModalHTML(threadInfo, messages, analyzer, availableModels);
    modal.appendChild(modalContent);

    this.addModalEventListeners(modal, modalContent, resolve, messages, availableModels);
    
    // 添加到頁面並顯示動畫
    document.body.appendChild(modal);
    setTimeout(() => {
      modal.style.opacity = '1';
      modal.querySelector(`.${this.modalContentClass}`).style.transform = 'translateY(0)';
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
            } else if (response && response.models) {
              console.log('✅ Got models from background script:', response.models.length, '個模型');
              console.log('📋 Models list:', response.models);
              resolve(response.models);
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
   * 獲取備用模型列表
   * @returns {Array} 備用模型列表
   */
  getFallbackModels() {
    return [
      {
        value: 'auto',
        displayName: '🔄 自動 (使用 Gemini 頁面預設模型)',
        description: '🔄 不切換模型，使用 Gemini 頁面當前的預設模型'
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

    // 獲取第一個模型的描述作為預設描述
    const defaultDescription = availableModels.length > 0 ? availableModels[0].description : '🔄 不切換模型，使用 Gemini 頁面當前的預設模型';

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
      <div id="modelDescription" style="font-size: 13px; color: rgba(255,255,255,0.9); font-weight: 500; background: rgba(255,255,255,0.1); padding: 8px; border-radius: 4px;">
        ${defaultDescription}
      </div>
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
        <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">📝 討論串摘要預覽</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; font-size: 14px;">
          <div>
            <strong>👥 參與者:</strong> ${threadInfo.participants.length} 人<br>
            <small style="opacity: 0.9;">${threadInfo.participants.slice(0, 3).join(', ')}${threadInfo.participants.length > 3 ? '...' : ''}</small>
          </div>
          <div>
            <strong>💬 訊息數:</strong> ${threadInfo.messageCount} 條<br>
            <small style="opacity: 0.9;">預估長度: ${threadInfo.estimatedLength}</small>
          </div>
          <div>
            <strong>⏰ 時間範圍:</strong><br>
            <small style="opacity: 0.9;">${threadInfo.timeRange}</small>
          </div>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; color: #4A154B; font-size: 16px;">
            🤖 選擇 Gemini 模型：
          </h3>
          <div style="display: flex; gap: 8px; align-items: center;">
            <div style="font-size: 12px; color: #666; padding: 4px 8px; background: #f8f9fa; border-radius: 4px;">
              💡 更多同步選項請查看擴展設定
            </div>
          </div>
        </div>
        <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);">
          ${this.generateModelSelectHTML(availableModels)}
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 12px 0; color: #4A154B; font-size: 16px;">
          👥 參與者列表：
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
            📄 討論串預覽：
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
            📋 複製到剪貼簿
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
          ❌ 取消
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
          ✅ 確認摘要
        </button>
      </div>
    `;
  }

  addModalEventListeners(modal, modalContent, resolve, messages, availableModels) {
    const confirmBtn = modalContent.querySelector('#confirmSummary');
    const cancelBtn = modalContent.querySelector('#cancelSummary');
    const copyBtn = modalContent.querySelector('#copyToClipboard');
    const modelSelect = modalContent.querySelector('#geminiModelSelect');
    const modelDescription = modalContent.querySelector('#modelDescription');

    // 載入已選擇的模型
    this.loadSelectedModel(modelSelect, availableModels);

    // 按鈕懸停效果
    this.addButtonHoverEffects(cancelBtn, '#5a6268', '#6c757d');
    this.addButtonHoverEffects(confirmBtn, '#611f69', '#4A154B');
    this.addButtonHoverEffects(copyBtn, '#218838', '#28a745');

    // 模型選擇變更事件
    modelSelect.addEventListener('change', () => {
      // 從可用模型列表中找到對應的描述
      const selectedModelInfo = availableModels.find(model => model.value === modelSelect.value);
      if (selectedModelInfo && selectedModelInfo.description) {
        modelDescription.textContent = selectedModelInfo.description;
      } else {
        // 如果找不到，使用預設描述
        const defaultDescriptions = {
          'auto': '🔄 不切換模型，使用 Gemini 頁面當前的預設模型',
          'gemini-2.5-flash': '⚡ 快速回應，適合一般摘要需求',
          'gemini-2.5-pro': '🧠 進階分析能力，適合複雜討論和深度摘要'
        };
        modelDescription.textContent = defaultDescriptions[modelSelect.value] || defaultDescriptions['auto'];
      }
      
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
        copyBtn.innerHTML = '✅ 已複製';
        setTimeout(() => {
          copyBtn.innerHTML = '📋 複製到剪貼簿';
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
            
            // 更新模型描述
            const selectedModel = availableModels.find(model => model.value === savedModel);
            const modelDescription = document.querySelector('#modelDescription');
            if (selectedModel && modelDescription) {
              modelDescription.textContent = selectedModel.description;
            }
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