/**
 * Main Content Script for Slack Helper
 * Uses webpack to properly bundle all modules
 */

import { SlackDOMDetector } from './dom-detector.js';
import { MessageTextExtractor } from './message-extractor.js';
import { MessageProcessor } from './message-processor.js';
import { ThreadScrollCollector } from './scroll-collector.js';
import { SummaryButtonManager, ThreadAnalyzer, PreviewModalManager, PageObserver } from './ui-components.js';
import { MessageHelper } from './message-helper.js';
import { isGeminiPage } from './model-sync.js';
import { sleep } from './time-utils.js';


console.log('Slack Helper content script loaded (webpack bundled)');

/**
 * Main SlackThreadExtractor class that orchestrates all functionality
 */
class SlackThreadExtractor {
  constructor() {
    this.domDetector = new SlackDOMDetector();
    this.messageExtractor = new MessageTextExtractor();
    this.messageProcessor = new MessageProcessor();
    this.scrollCollector = new ThreadScrollCollector(
      this.domDetector,
      this.messageExtractor,
      null, // progressCallback
      this.messageProcessor
    );
    this.buttonManager = new SummaryButtonManager();
    this.threadAnalyzer = new ThreadAnalyzer();
    this.previewModal = new PreviewModalManager();
    this.inputEnhancer = new MessageHelper();
    this.pageObserver = new PageObserver(() => {
      // 使用 Promise 來處理異步調用，但不等待結果
      this.addSummaryButton().catch(error => {
        console.error('Error in PageObserver callback:', error);
      });
    });
    this.initialized = false;
    
    this.init();
  }

  async init() {
    try {
      console.log('Initializing SlackThreadExtractor...');
      
      // Initialize components
      await this.inputEnhancer.init();
      this.initialized = true;
      console.log('✅ SlackThreadExtractor initialized successfully');
      
      // 設置語言變更監聽器
      this.setupLanguageChangeListener();
      
      // Start observing for thread changes
      this.startObserving();
      
    } catch (error) {
      console.error('❌ Failed to initialize SlackThreadExtractor:', error);
      this.initialized = false;
    }
  }

  /**
   * 設置語言變更監聽器
   */
  setupLanguageChangeListener() {
    // 監聽來自 background script 的語言變更通知
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'languageChanged') {
        console.log('Language changed, updating summary buttons...');
        this.handleLanguageChange();
        sendResponse({ success: true });
      }
    });
  }

  /**
   * 處理語言變更
   */
  async handleLanguageChange() {
    try {
      // 重新載入按鈕管理器的翻譯並更新按鈕
      await this.buttonManager.reloadTranslationsAndUpdateButtons();
      
      // 如果有預覽模態框管理器，也重新載入其翻譯
      if (this.previewModal) {
        await this.previewModal.initializeTranslations();
      }
      
      // 如果有線程分析器，也重新載入其翻譯
      if (this.threadAnalyzer) {
        await this.threadAnalyzer.initializeTranslations();
      }
      
      console.log('✅ Language change handled successfully');
    } catch (error) {
      console.error('❌ Error handling language change:', error);
    }
  }

  startObserving() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.addSummaryButton().catch(error => {
          console.error('Error in DOMContentLoaded callback:', error);
        });
      });
    } else {
      this.addSummaryButton().catch(error => {
        console.error('Error in immediate addSummaryButton call:', error);
      });
    }

    if (this.pageObserver) {
      this.pageObserver.startObserving();
    }
  }

  async addSummaryButton() {
    if (!this.initialized) {
      console.log('Extension not yet initialized, skipping button addition');
      return;
    }

    if (isGeminiPage()) {
      console.log('Detected Gemini page, skipping button addition');
      return;
    }
    
    try {
      console.log('🔍 Starting addSummaryButton process...');
      
      const threadContainer = this.domDetector.findThreadContainer();
      if (!threadContainer) {
        // 如果沒有 thread 容器，清理可能存在的舊按鈕
        this.buttonManager.removeExistingButtons();
        console.log('❌ No thread container found');
        return;
      }

      console.log('✅ Thread container found:', {
        className: threadContainer.className,
        id: threadContainer.id,
        tagName: threadContainer.tagName
      });

      // 檢查是否已經有按鈕存在（在當前 thread 容器中）
      if (this.buttonManager.buttonExists(threadContainer)) {
        console.log('Summary button already exists in this thread container');
        return;
      }

      // 只檢查是否有基本的訊息元素存在，不實際提取內容（靜默模式）
      console.log('🔍 Starting message element detection...');
      const messageElements = this.domDetector.findMessageElements(true); // Enable verbose logging
      
      // Additional debugging
      console.log('🔍 Debug: Thread container details:', {
        container: threadContainer,
        containerHTML: threadContainer.outerHTML.substring(0, 500) + '...',
        containerChildren: threadContainer.children.length,
        containerTextContent: threadContainer.textContent.substring(0, 200) + '...'
      });
      
      // Try different selectors manually for debugging
      console.log('🔍 Manual selector testing:');
      const testSelectors = [
        '[data-qa="virtual-list-item"]',
        '.c-virtual_list__item',
        '.c-message_kit__message',
        '.c-message',
        '[data-qa="message"]'
      ];
      
      for (const selector of testSelectors) {
        const globalElements = document.querySelectorAll(selector);
        const containerElements = threadContainer.querySelectorAll(selector);
        console.log(`  ${selector}: global=${globalElements.length}, in-container=${containerElements.length}`);
      }
      
      if (messageElements.length === 0) {
        console.log('❌ No message elements found, not adding button');
        return;
      }

      console.log(`✅ Found ${messageElements.length} message elements, proceeding with button addition`);

      const summaryButton = await this.buttonManager.createSummaryButton(() => this.handleSummaryClick());
      const threadHeader = this.domDetector.findThreadHeader(threadContainer);
      
      if (threadHeader) {
        console.log('✅ Thread header found:', {
          className: threadHeader.className,
          id: threadHeader.id
        });
        
        // 找到 primary content 區域，將按鈕插入到 Thread 標題旁邊
        const primaryContent = threadHeader.querySelector('.p-flexpane_header__primary_content');
        if (primaryContent) {
          // 將按鈕添加到 primary content 中，與 title container 並列
          primaryContent.appendChild(summaryButton);
          console.log('✅ Button added to primary content alongside title container');
        } else {
          // 備用：直接添加到 header
          threadHeader.appendChild(summaryButton);
          console.log('✅ Button added to thread header (fallback)');
        }
      } else {
        // 最後備用：添加到容器開始
        threadContainer.insertBefore(summaryButton, threadContainer.firstChild);
        console.log('✅ Button added to thread container start (final fallback)');
      }
      
      console.log('🎉 Summary button successfully added!');
      
    } catch (error) {
      console.error('❌ Error adding summary button:', error);
    }
  }

  async handleSummaryClick() {
    const button = document.querySelector('.slack-helper-btn');
    
    console.log('Summary button clicked');
    
    await this.buttonManager.updateButtonState(button, 'loading');

    try {
      // Debug: Log current page state
      this.debugCurrentState();
      
      // 使用自動滾動收集完整的討論串訊息
      console.log('開始自動滾動收集完整討論串訊息...');
      
      // 獲取翻譯文字
      const translations = await this.getTranslations();
      const collectingText = translations?.ui?.collectingMessages || '📜 正在收集所有訊息...';
      
      await this.buttonManager.updateButtonState(button, 'loading', collectingText);
      
      console.log('ThreadScrollCollector available, using it');
      const messages = await this.scrollCollector.collectCompleteThreadMessages();
      
      if (messages.length === 0) {
        const errorText = translations?.errors?.noThreadMessages || '未找到討論串訊息';
        throw new Error(errorText);
      }

      console.log(`成功收集到 ${messages.length} 條完整訊息`);
      const collectedText = translations?.ui?.messagesCollected || '✅ 訊息收集完成';
      await this.buttonManager.updateButtonState(button, 'loading', collectedText);
      
      // 短暫延遲讓用戶看到收集完成的狀態
      await sleep(500);

      // Show preview modal
      const showingPreviewText = translations?.ui?.showingPreview || '📋 顯示預覽...';
      await this.buttonManager.updateButtonState(button, 'loading', showingPreviewText);
      
      const result = await this.previewModal.showThreadPreview(messages);
      
      if (!result || !result.confirmed) {
        console.log('User cancelled the operation');
        await this.buttonManager.updateButtonState(button, 'default');
        return;
      }

      // 從模態框結果中獲取選擇的模型
      const selectedModel = result.selectedModel || 'auto';

      // Format messages for Gemini
      const openingGeminiText = translations?.ui?.openingGemini || '🚀 正在開啟 Gemini...';
      await this.buttonManager.updateButtonState(button, 'opening', openingGeminiText);

      const formattedMessages = await this.threadAnalyzer.formatMessagesForGemini(result.messages);
      
      console.log('Sending messages to background script');
      
      // Send to background script to open Gemini
      this.sendMessageToBackground(formattedMessages, selectedModel);

      await this.buttonManager.updateButtonState(button, 'success');
      this.buttonManager.resetButtonAfterDelay(button);

    } catch (error) {
      console.error('Error:', error);
      await this.buttonManager.updateButtonState(button, 'error');
      this.buttonManager.resetButtonAfterDelay(button);
    }
  }

  sendMessageToBackground(formattedMessages, selectedModel = 'auto') {
    try {
      chrome.runtime.sendMessage({
        action: 'openGeminiWithMessages',
        messages: formattedMessages,
        selectedModel: selectedModel
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Background script communication error:', chrome.runtime.lastError);
        } else {
          console.log('Background script response:', response);
        }
      });
    } catch (error) {
      console.error('Error sending message to background script:', error);
    }
  }

  /**
   * Find the thread container element
   * @returns {Element|null} The thread container element
   */
  findThreadContainer() {
    return this.domDetector.findThreadContainer();
  }

  /**
   * Extract all messages from the current thread
   * @returns {Array} Array of message objects
   */
  extractThreadMessages() {
    try {
      console.log('🔍 Starting thread message extraction...');
      
      // Find message elements
      const messageElements = this.domDetector.findMessageElements(true);
      console.log(`Found ${messageElements.length} message elements`);
      
      if (messageElements.length === 0) {
        console.log('No message elements found');
        return [];
      }

      // Extract message data
      const rawMessages = [];
      for (const messageEl of messageElements) {
        const messageData = this.messageExtractor.extractSingleMessage(messageEl);
        if (messageData && messageData.text && messageData.text.trim()) {
          rawMessages.push(messageData);
        }
      }

      console.log(`✅ Extracted ${rawMessages.length} raw messages`);
      
      // Process messages (filter system messages and merge continuations)
      const processedMessages = this.messageProcessor.processMessages(rawMessages);
      
      console.log(`✅ Final processed messages: ${processedMessages.length}`);
      return processedMessages;
      
    } catch (error) {
      console.error('❌ Error extracting thread messages:', error);
      return [];
    }
  }

  /**
   * Extract complete thread messages with scrolling
   * @returns {Array} Array of message objects
   */
  async extractCompleteThreadMessages() {
    try {
      console.log('🔍 Starting complete thread message extraction with scrolling...');
      
      const messages = await this.scrollCollector.collectCompleteThreadMessages();
      
      console.log(`✅ Complete extraction finished: ${messages.length} messages`);
      return messages;
      
    } catch (error) {
      console.error('❌ Error extracting complete thread messages:', error);
      // Fallback to regular extraction
      return this.extractThreadMessages();
    }
  }

  /**
   * Debug current state
   */
  debugCurrentState() {
    console.log('=== SlackThreadExtractor Debug Info ===');
    console.log('Initialized:', this.initialized);
    console.log('Thread container:', this.findThreadContainer());
    console.log('Message elements:', this.domDetector.findMessageElements(true));
    console.log('=====================================');
  }

  /**
   * 獲取當前語言的翻譯
   * @returns {Promise<Object>} 翻譯對象
   */
  async getTranslations() {
    try {
      const isChromeExtensionContext = this.isValidChromeExtensionContext();
      
      if (isChromeExtensionContext) {
        // 獲取當前選擇的語言
        const selectedLanguage = await this.getCurrentLanguage();
        
        // 載入對應語言的翻譯文件
        const response = await fetch(chrome.runtime.getURL(`locales/${selectedLanguage}/translation.json`));
        return await response.json();
      }
      
      return this.getFallbackTranslations();
    } catch (error) {
      console.warn('Failed to load translations:', error);
      return this.getFallbackTranslations();
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
   * 獲取備用翻譯（中文版本）
   * @returns {Object} 備用翻譯對象
   */
  getFallbackTranslations() {
    return {
      ui: {
        collectingMessages: '📜 正在收集所有訊息...',
        messagesCollected: '✅ 訊息收集完成',
        showingPreview: '📋 顯示預覽...',
        openingGemini: '🚀 正在開啟 Gemini...'
      },
      errors: {
        noThreadMessages: '未找到討論串訊息'
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
}

/**
 * 檢查是否為 Slack 頁面
 */
function isSlackPage() {
  return window.location.hostname.includes('slack.com');
}

// Initialize the main extractor
let slackThreadExtractor = null;

// Initialize when DOM is ready
function initializeExtractor() {
  if (!isSlackPage()) {
    console.log('Detected non-Slack page, skipping initialization');
    return;
  }
  if (!slackThreadExtractor) {
    slackThreadExtractor = new SlackThreadExtractor();
    
    // Make it globally available for debugging and popup communication
    window.slackThreadExtractor = slackThreadExtractor;
    window.slackThreadExtractorInitialized = true;
    
    console.log('✅ SlackThreadExtractor instance created and made globally available');
  }
}

// Initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtractor);
} else {
  initializeExtractor();
}

// Also try to initialize after a short delay to ensure Slack's dynamic content is loaded
setTimeout(() => {
  if (!slackThreadExtractor && isSlackPage()) {
    console.log('Retrying initialization after delay...');
    initializeExtractor();
  }
}, 2000);

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
  console.log('Content script received message:', request);
  
  try {
    // Handle LLM-related messages
    if (request.action === 'reloadLLMConfig') {
      try {
        // Import LLM service dynamically
        const { llmService } = await import(chrome.runtime.getURL('src/llm-service.js'));
        
        // Reload configuration from storage
        await llmService.loadConfiguration();
        sendResponse({ success: true });
      } catch (error) {
        console.error('Failed to reload LLM config:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true; // Keep async response open
    }
    
    // Ensure the extension is initialized for other actions
    if (!slackThreadExtractor) {
      initializeExtractor();
      // Wait a bit for initialization
      await sleep(100);
    }
    
    if (request.action === 'extractThreadMessages') {
      if (slackThreadExtractor && slackThreadExtractor.initialized) {
        const messages = slackThreadExtractor.extractThreadMessages();
        console.log('Extracted messages:', messages);
        sendResponse({ messages: messages });
      } else {
        sendResponse({ error: 'Extension not initialized' });
      }
    } else if (request.action === 'extractCompleteThreadMessages') {
      if (slackThreadExtractor && slackThreadExtractor.initialized) {
        const messages = await slackThreadExtractor.extractCompleteThreadMessages();
        console.log('Extracted complete messages:', messages);
        sendResponse({ messages: messages });
      } else {
        sendResponse({ error: 'Extension not initialized' });
      }
    } else if (request.action === 'checkThreadAvailable') {
      if (slackThreadExtractor && slackThreadExtractor.initialized) {
        const threadContainer = slackThreadExtractor.findThreadContainer();
        const messages = slackThreadExtractor.extractThreadMessages();
        
        console.log('Thread container found:', !!threadContainer);
        console.log('Messages found:', messages.length);
        console.log('Messages:', messages);
        
        sendResponse({ 
          hasThread: threadContainer !== null && messages.length > 0 
        });
      } else {
        sendResponse({ hasThread: false, error: 'Extension not initialized' });
      }
    }
  } catch (error) {
    console.error('Error in content script message handler:', error);
    sendResponse({ error: error.message });
  }
});

// Add global debug function for testing
window.debugSlackExtension = function() {
  if (slackThreadExtractor) {
    console.log('=== Slack Extension Debug Info ===');
    slackThreadExtractor.debugCurrentState();
    
    // Additional button-specific debugging
    console.log('=== Button Debug Info ===');
    const threadContainer = slackThreadExtractor.findThreadContainer();
    console.log('Thread container:', threadContainer);
    
    if (threadContainer) {
      const existingButton = threadContainer.querySelector('.slack-helper-btn');
      console.log('Existing button in container:', existingButton);
      
      const globalButton = document.querySelector('.slack-helper-btn');
      console.log('Global button search:', globalButton);
      
      const threadHeader = slackThreadExtractor.domDetector.findThreadHeader(threadContainer);
      console.log('Thread header:', threadHeader);
      
      if (threadHeader) {
        const primaryContent = threadHeader.querySelector('.p-flexpane_header__primary_content');
        console.log('Primary content area:', primaryContent);
      }
    }
    
    // Try to manually add button
    console.log('=== Manual Button Addition Test ===');
    slackThreadExtractor.addSummaryButton().catch(error => {
      console.error('Error in manual button addition:', error);
    });
    
    const messages = slackThreadExtractor.extractThreadMessages();
    console.log('Extracted messages:', messages);
    return messages;
  } else {
    console.log('Extension not initialized yet');
    return null;
  }
};

// Add manual button addition function
window.forceAddButton = function() {
  if (slackThreadExtractor) {
    console.log('🔧 Force adding summary button...');
    slackThreadExtractor.buttonManager.removeExistingButtons();
    slackThreadExtractor.addSummaryButton().catch(error => {
      console.error('Error in force add button:', error);
    });
  } else {
    console.log('Extension not initialized yet');
  }
};

// Add comprehensive debug function
window.debugMessageDetection = function() {
  if (!slackThreadExtractor) {
    console.log('❌ Extension not initialized yet');
    return;
  }
  
  console.log('🔍 === Comprehensive Message Detection Debug ===');
  
  // 1. Check thread container
  const threadContainer = slackThreadExtractor.domDetector.findThreadContainer();
  console.log('1. Thread Container:', threadContainer);
  
  if (!threadContainer) {
    console.log('❌ No thread container found - stopping debug');
    return;
  }
  
  // 2. Test all selector types
  console.log('2. Testing Thread-Specific Selectors:');
  const threadSelectors = [
    '[data-qa="threads_flexpane"] [data-qa="virtual-list-item"]',
    '[data-qa="threads_flexpane"] .c-virtual_list__item',
    '[data-qa="threads_flexpane"] .c-message_kit__message',
    '.p-threads_flexpane [data-qa="virtual-list-item"]',
    '.p-threads_flexpane .c-virtual_list__item',
    '.p-threads_flexpane .c-message_kit__message'
  ];
  
  threadSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`  ${selector}: ${elements.length} elements`);
  });
  
  // 3. Test container-scoped selectors
  console.log('3. Testing Container-Scoped Selectors:');
  const containerSelectors = [
    '[data-qa="virtual-list-item"]',
    '.c-virtual_list__item',
    '.c-message_kit__message',
    '.c-message',
    '[data-qa="message"]'
  ];
  
  containerSelectors.forEach(selector => {
    const elements = threadContainer.querySelectorAll(selector);
    console.log(`  ${selector}: ${elements.length} elements in container`);
    if (elements.length > 0) {
      console.log('    First element:', elements[0]);
    }
  });
  
  // 4. Test aggressive fallback
  console.log('4. Testing Aggressive Fallback:');
  const allDivs = threadContainer.querySelectorAll('div');
  console.log(`  Total divs in container: ${allDivs.length}`);
  
  let potentialMessages = 0;
  for (const div of allDivs) {
    const text = div.textContent.trim();
    if (text.length > 10 && text.length < 5000) {
      potentialMessages++;
    }
  }
  console.log(`  Divs with reasonable text length: ${potentialMessages}`);
  
  // 5. Test actual message detection
  console.log('5. Testing Actual Message Detection:');
  const messages = slackThreadExtractor.domDetector.findMessageElements(true);
  console.log(`  Final detected messages: ${messages.length}`);
  
  if (messages.length > 0) {
    console.log('  Sample messages:', messages.slice(0, 3).map(msg => ({
      element: msg,
      text: msg.textContent.substring(0, 100) + '...',
      classes: msg.className,
      dataQa: msg.getAttribute('data-qa')
    })));
  }
  
  // 6. Test message extraction
  if (messages.length > 0) {
    console.log('6. Testing Message Extraction:');
    const extractedMessages = slackThreadExtractor.extractThreadMessages();
    console.log(`  Extracted messages: ${extractedMessages.length}`);
    if (extractedMessages.length > 0) {
      console.log('  Sample extracted:', extractedMessages.slice(0, 2));
    }
  }
  
  console.log('🔍 === Debug Complete ===');
  return {
    threadContainer,
    messageElements: messages,
    extractedMessages: messages.length > 0 ? slackThreadExtractor.extractThreadMessages() : []
  };
}; 