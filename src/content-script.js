/**
 * Main Content Script for Slack Helper
 * Uses webpack to properly bundle all modules
 */

import { SlackDOMDetector } from './dom-detector.js';
import { MessageTextExtractor } from './message-extractor.js';
import { MessageProcessor } from './message-processor.js';
import { ThreadScrollCollector } from './scroll-collector.js';
import { SummaryButtonManager, ThreadAnalyzer, PreviewModalManager, PageObserver } from './ui-components.js';
import { isGeminiPage } from './model-sync.js';


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
    this.pageObserver = new PageObserver(() => this.addSummaryButton());
    this.initialized = false;
    
    this.init();
  }

  async init() {
    try {
      console.log('Initializing SlackThreadExtractor...');
      
      // Initialize components
      this.initialized = true;
      console.log('✅ SlackThreadExtractor initialized successfully');
      
      // Start observing for thread changes
      this.startObserving();
      
    } catch (error) {
      console.error('❌ Failed to initialize SlackThreadExtractor:', error);
      this.initialized = false;
    }
  }

  startObserving() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.addSummaryButton());
    } else {
      this.addSummaryButton();
    }

    if (this.pageObserver) {
      this.pageObserver.startObserving();
    }
  }

  addSummaryButton() {
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

      const summaryButton = this.buttonManager.createSummaryButton(() => this.handleSummaryClick());
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
    
    this.buttonManager.updateButtonState(button, 'loading', '🔍 正在檢查討論串...');

    try {
      // Debug: Log current page state
      this.debugCurrentState();
      
      // 使用自動滾動收集完整的討論串訊息
      console.log('開始自動滾動收集完整討論串訊息...');
      this.buttonManager.updateButtonState(button, 'loading', '📜 正在收集所有訊息...');
      
      console.log('ThreadScrollCollector available, using it');
      const messages = await this.scrollCollector.collectCompleteThreadMessages();
      
      if (messages.length === 0) {
        throw new Error('未找到討論串訊息');
      }

      console.log(`成功收集到 ${messages.length} 條完整訊息`);
      this.buttonManager.updateButtonState(button, 'loading', '✅ 訊息收集完成');
      
      // 短暫延遲讓用戶看到收集完成的狀態
      await new Promise(resolve => setTimeout(resolve, 500));

      // Show preview modal
      this.buttonManager.updateButtonState(button, 'loading', '📋 顯示預覽...');
      
      const result = await this.previewModal.showThreadPreview(messages);
      
      if (!result || !result.confirmed) {
        console.log('User cancelled the operation');
        this.buttonManager.updateButtonState(button, 'default');
        return;
      }

      // 從模態框結果中獲取選擇的模型
      const selectedModel = result.selectedModel || 'auto';

      // Format messages for Gemini
      this.buttonManager.updateButtonState(button, 'opening', '🚀 正在開啟 Gemini...');

      const formattedMessages = await this.threadAnalyzer.formatMessagesForGemini(result.messages);
      
      console.log('Sending messages to background script');
      
      // Send to background script to open Gemini
      this.sendMessageToBackground(formattedMessages, selectedModel);

      this.buttonManager.updateButtonState(button, 'success');
      this.buttonManager.resetButtonAfterDelay(button);

    } catch (error) {
      console.error('Error:', error);
      this.buttonManager.updateButtonState(button, 'error');
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
    // Ensure the extension is initialized
    if (!slackThreadExtractor) {
      initializeExtractor();
      // Wait a bit for initialization
      await new Promise(resolve => setTimeout(resolve, 100));
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
    slackThreadExtractor.addSummaryButton();
    
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
    slackThreadExtractor.addSummaryButton();
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