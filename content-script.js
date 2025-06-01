/******/ (function() { // webpackBootstrap
/******/ 	"use strict";

;// ./src/dom-detector.js
/**
 * Slack DOM Detection Module
 * Handles finding and identifying Slack thread elements in the DOM
 */

class SlackDOMDetector {
  constructor() {
    // Updated selectors based on actual Slack DOM structure
    this.threadSelectors = ['[data-qa="threads_flexpane"]',
    // Main thread panel container
    '.p-threads_flexpane',
    // Thread flexpane class
    '.p-thread_view',
    // Legacy thread view
    '.p-threads_view',
    // Legacy threads view
    '[data-qa="thread_view"]',
    // Legacy thread view data attribute
    '.p-flexpane--iap1' // Flexpane with specific modifier
    ];

    // Selectors for the main channel view (to avoid)
    this.channelSelectors = ['.p-message_pane', '.p-channel_sidebar', '.p-workspace__primary_view', '.c-virtual_list__scroll_container:not([data-qa="threads_flexpane"] *)', '.p-message_pane__foreground'];

    // More specific message selectors for threads based on actual DOM
    this.threadMessageSelectors = ['[data-qa="threads_flexpane"] [data-qa="virtual-list-item"]', '[data-qa="threads_flexpane"] .c-virtual_list__item', '[data-qa="threads_flexpane"] .c-message_kit__message', '.p-threads_flexpane [data-qa="virtual-list-item"]', '.p-threads_flexpane .c-virtual_list__item', '.p-threads_flexpane .c-message_kit__message', '.p-thread_view [data-qa="virtual-list-item"]', '.p-thread_view .c-message_kit__message', '.p-threads_view [data-qa="virtual-list-item"]', '.p-threads_view .c-message_kit__message'];

    // Fallback message selectors
    this.messageSelectors = ['[data-qa="virtual-list-item"]:has(.c-message_kit__message)', '.c-virtual_list__item:has(.c-message_kit__message)', '.c-message_kit__message', '.c-virtual_list__item', '.c-message', '[data-qa="message"]', '.c-message_kit__message_container', '.p-rich_text_section', '[data-qa="message_content"]', '[class*="message"]'];
  }

  /**
   * Find the main thread container element
   * @returns {Element|null} The thread container element
   */
  findThreadContainer() {
    // First try to find specific thread containers
    for (const selector of this.threadSelectors) {
      const element = document.querySelector(selector);
      if (element && this.isVisibleThreadContainer(element)) {
        console.log(`Found thread container with selector: ${selector}`);
        return element;
      }
    }
    console.log('No thread container found with any selector');
    return null;
  }

  /**
   * Check if an element is a visible thread container
   * @param {Element} element - The element to check
   * @returns {boolean} True if the element is a visible thread container
   */
  isVisibleThreadContainer(element) {
    // Check basic visibility (element exists and is in DOM)
    const rect = element.getBoundingClientRect();
    const isInViewport = rect.width > 0 && rect.height > 0;
    if (!isInViewport) {
      console.log('Thread container not in viewport:', rect);
      return false;
    }

    // Primary check: Look for thread-specific structural elements
    const hasThreadTitle = element.querySelector('.p-flexpane__title_container') || element.querySelector('[data-qa="thread_header"]') || element.querySelector('.p-thread_view__header');

    // Secondary check: Look for thread content structure
    const hasThreadContent = element.querySelector('.c-virtual_list__scroll_container[role="list"]') || element.querySelector('[data-qa="virtual-list-item"]') || element.querySelector('.c-virtual_list__item');

    // Tertiary check: Look for thread-specific classes or attributes
    const hasThreadIdentifiers = element.classList.contains('p-threads_flexpane') || element.classList.contains('p-thread_view') || element.hasAttribute('data-qa') && element.getAttribute('data-qa').includes('thread');

    // Check for flexpane body (specific to thread panels)
    const hasFlexpaneBody = element.querySelector('[data-qa="flexpane_body"]') || element.classList.contains('p-flexpane__body');

    // A valid thread container should have:
    // 1. Basic visibility AND
    // 2. Either thread title structure OR flexpane body OR (thread content AND thread identifiers)
    const isValidThread = isInViewport && (hasThreadTitle || hasFlexpaneBody || hasThreadContent && hasThreadIdentifiers);
    console.log('Thread container validation:', {
      isInViewport,
      hasThreadTitle,
      hasThreadContent,
      hasThreadIdentifiers,
      hasFlexpaneBody,
      isValidThread,
      elementClasses: element.className,
      dataQa: element.getAttribute('data-qa')
    });
    return isValidThread;
  }

  /**
   * Find all message elements within the thread
   * @param {boolean} verbose - Whether to log detailed information
   * @returns {Array<Element>} Array of message elements
   */
  findMessageElements(verbose = true) {
    const threadContainer = this.findThreadContainer();
    if (!threadContainer) {
      if (verbose) console.log('No thread container found, falling back to general message search');
      return this.findGeneralMessageElements(verbose);
    }

    // First try thread-specific selectors within the thread container
    let messageElements = [];
    let usedSelector = '';
    for (const selector of this.threadMessageSelectors) {
      try {
        messageElements = document.querySelectorAll(selector);
        if (messageElements.length > 0) {
          if (verbose) console.log(`Found ${messageElements.length} thread messages with selector: ${selector}`);
          usedSelector = selector;
          break;
        }
      } catch (error) {
        if (verbose) console.log(`Error with thread selector "${selector}":`, error);
      }
    }

    // If no thread-specific messages found, search within the thread container
    if (messageElements.length === 0) {
      if (verbose) console.log('No messages found with thread-specific selectors, searching within thread container...');
      messageElements = this.findMessagesInContainer(threadContainer, verbose);
      usedSelector = 'container-scoped';
    }

    // If still no messages found, try a more aggressive approach
    if (messageElements.length === 0) {
      if (verbose) console.log('No messages found with container search, trying aggressive fallback...');
      messageElements = this.findMessagesAggressiveFallback(threadContainer, verbose);
      usedSelector = 'aggressive-fallback';
    }

    // Filter out messages that are clearly from the main channel
    const filteredMessages = this.filterThreadMessages(messageElements, threadContainer, verbose);
    if (verbose) console.log(`Processing ${filteredMessages.length} thread message elements using selector: ${usedSelector}`);
    return filteredMessages;
  }

  /**
   * Find general message elements when thread container is not found
   * @param {boolean} verbose - Whether to log detailed information
   * @returns {Array<Element>} Array of message elements
   */
  findGeneralMessageElements(verbose = true) {
    let messageElements = [];
    let usedSelector = '';
    for (const selector of this.messageSelectors) {
      try {
        messageElements = document.querySelectorAll(selector);
        if (messageElements.length > 0) {
          if (verbose) console.log(`Found ${messageElements.length} messages with selector: ${selector}`);
          usedSelector = selector;
          break;
        }
      } catch (error) {
        if (verbose) console.log(`Error with selector "${selector}":`, error);
      }
    }
    if (messageElements.length === 0) {
      if (verbose) console.log('No messages found with any selector, trying fallback approach...');
      messageElements = this.findMessageElementsFallback(verbose);
      usedSelector = 'fallback';
    }
    if (verbose) console.log(`Processing ${messageElements.length} message elements using selector: ${usedSelector}`);
    return Array.from(messageElements);
  }

  /**
   * Find messages within a specific container
   * @param {Element} container - The container to search within
   * @param {boolean} verbose - Whether to log detailed information
   * @returns {Array<Element>} Array of message elements
   */
  findMessagesInContainer(container, verbose = true) {
    const messageSelectors = ['[data-qa="virtual-list-item"]', '.c-virtual_list__item', '.c-message_kit__message', '.c-message', '[data-qa="message"]', '[class*="message"]'];
    for (const selector of messageSelectors) {
      const messages = container.querySelectorAll(selector);
      if (messages.length > 0) {
        if (verbose) console.log(`Found ${messages.length} messages in container with selector: ${selector}`);
        return Array.from(messages);
      }
    }

    // Additional fallback: try to find any elements that might contain message content
    if (verbose) console.log('No messages found with standard selectors, trying fallback approaches...');

    // Try to find elements with message-like content
    const fallbackSelectors = ['[role="listitem"]', '[data-qa*="message"]', '[class*="message"]', '.p-rich_text_section', '[data-qa="message_content"]', '.c-message_kit__message_container', 'div[data-qa]',
    // Any div with data-qa attribute
    '.c-virtual_list__scroll_container > div',
    // Direct children of scroll container
    '[data-qa="flexpane_body"] > div > div' // Nested divs in flexpane body
    ];
    for (const selector of fallbackSelectors) {
      const elements = container.querySelectorAll(selector);
      if (elements.length > 0) {
        // Filter to only include elements that look like messages
        const messageElements = Array.from(elements).filter(el => {
          const text = el.textContent.trim();
          const hasReasonableLength = text.length > 10 && text.length < 10000;
          const hasMessageStructure = el.querySelector('.c-message_kit__message') || el.querySelector('[data-qa="message_content"]') || el.classList.contains('c-message') || el.hasAttribute('data-qa') && el.getAttribute('data-qa').includes('message');
          return hasReasonableLength || hasMessageStructure;
        });
        if (messageElements.length > 0) {
          if (verbose) console.log(`Found ${messageElements.length} messages in container with fallback selector: ${selector}`);
          return messageElements;
        }
      }
    }
    return [];
  }

  /**
   * Filter messages to only include thread messages
   * @param {Array<Element>} messageElements - Array of message elements
   * @param {Element} threadContainer - The thread container
   * @param {boolean} verbose - Whether to log detailed information
   * @returns {Array<Element>} Filtered array of thread message elements
   */
  filterThreadMessages(messageElements, threadContainer, verbose = true) {
    if (!threadContainer) {
      return Array.from(messageElements);
    }
    const filtered = Array.from(messageElements).filter(element => {
      // Check if the message is within the thread container
      const isInThread = threadContainer.contains(element);

      // Check if the message is positioned appropriately (more lenient check)
      const rect = element.getBoundingClientRect();
      const hasValidPosition = rect.width > 0 && rect.height > 0;

      // Avoid messages that are clearly in the main channel
      const isInMainChannel = this.isInMainChannel(element);

      // Filter out message input elements and other UI components
      const isMessageInput = this.isMessageInputElement(element);

      // Additional check: ensure it's a valid message element
      const isValidMessage = element.querySelector('.c-message_kit__message') || element.querySelector('.c-message__content') || element.querySelector('[data-qa="message_content"]') || element.classList.contains('c-message_kit__message') || element.classList.contains('c-virtual_list__item') || element.hasAttribute('data-qa') && element.getAttribute('data-qa').includes('message');
      const shouldInclude = isInThread && hasValidPosition && !isInMainChannel && !isMessageInput && isValidMessage;
      if (verbose && isMessageInput) {
        console.log('Filtering out message input element:', element);
      }
      return shouldInclude;
    });
    if (verbose) {
      console.log(`Filtered ${messageElements.length} messages down to ${filtered.length} thread messages`);
    }
    return filtered;
  }

  /**
   * Check if an element is a message input or other UI component that should be excluded
   * @param {Element} element - The element to check
   * @returns {boolean} True if the element should be excluded
   */
  isMessageInputElement(element) {
    // Check for message input elements
    if (element.hasAttribute('data-qa')) {
      const dataQa = element.getAttribute('data-qa');
      if (dataQa === 'message_input' || dataQa.includes('input') || dataQa.includes('composer')) {
        return true;
      }
    }

    // Check for input-related classes
    const inputClasses = ['c-texty_input', 'ql-container', 'ql-editor', 'ql-clipboard', 'ql-placeholder', 'c-composer', 'c-message_input', 'p-message_input', 'c-texty_input_unstyled'];
    for (const className of inputClasses) {
      if (element.classList.contains(className)) {
        return true;
      }
    }

    // Check if element contains input-related elements
    const hasInputElements = element.querySelector('[data-qa="message_input"]') || element.querySelector('.ql-editor') || element.querySelector('.c-texty_input') || element.querySelector('[contenteditable="true"]') || element.querySelector('textarea') || element.querySelector('input[type="text"]');
    if (hasInputElements) {
      return true;
    }

    // Check for thread input specifically
    if (element.hasAttribute('data-thread-ts') || element.hasAttribute('data-channel-id')) {
      return true;
    }

    // Check for placeholder text that indicates input elements
    const placeholderTexts = ['Reply…', 'Reply to thread', 'Message', 'Type a message'];
    const elementText = element.textContent.trim();
    for (const placeholder of placeholderTexts) {
      if (elementText === placeholder) {
        return true;
      }
    }

    // Check for aria-label that indicates input
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && (ariaLabel.includes('Reply') || ariaLabel.includes('Message') || ariaLabel.includes('input'))) {
      return true;
    }
    return false;
  }

  /**
   * Check if a message element is in the main channel
   * @param {Element} element - The message element to check
   * @returns {boolean} True if the element is in the main channel
   */
  isInMainChannel(element) {
    // Check if the element is within main channel containers
    for (const selector of this.channelSelectors) {
      const channelContainer = document.querySelector(selector);
      if (channelContainer && channelContainer.contains(element)) {
        // Additional check: make sure it's not within a thread container inside the channel
        const threadContainer = element.closest('[data-qa="threads_flexpane"], .p-threads_flexpane, .p-thread_view');
        if (!threadContainer) {
          return true;
        }
      }
    }

    // Check position-based heuristics
    const rect = element.getBoundingClientRect();
    const isInLeftArea = rect.left < window.innerWidth * 0.6; // Main channel is typically on the left
    const isInMainMessageArea = element.closest('.p-message_pane__foreground, .c-message_list');
    return isInLeftArea && isInMainMessageArea && !element.closest('[data-qa="threads_flexpane"], .p-threads_flexpane');
  }

  /**
   * Fallback method to find message elements
   * @param {boolean} verbose - Whether to log detailed information
   * @returns {Array<Element>} Array of message elements
   */
  findMessageElementsFallback(verbose = true) {
    if (verbose) console.log('Using fallback method to find messages...');
    const fallbackSelectors = ['[data-qa="message"]', '.c-message', '.c-message_list__item', '[class*="message"]', '.p-rich_text_section'];
    const messages = [];
    for (const selector of fallbackSelectors) {
      const elements = document.querySelectorAll(selector);
      if (verbose && elements.length > 0) {
        console.log(`Fallback selector ${selector} found ${elements.length} elements`);
      }
      messages.push(...Array.from(elements));
    }
    return this.removeDuplicates(messages);
  }

  /**
   * Find the thread header element
   * @param {Element} threadContainer - The thread container
   * @returns {Element|null} The thread header element
   */
  findThreadHeader(threadContainer) {
    if (!threadContainer) return null;

    // 首先嘗試找到包含 primary content 的 flexpane header
    const flexpaneHeader = document.querySelector('.p-flexpane_header');
    if (flexpaneHeader) {
      // 檢查是否包含 Thread 相關內容
      const primaryContent = flexpaneHeader.querySelector('.p-flexpane_header__primary_content');
      if (primaryContent) {
        const titleContainer = primaryContent.querySelector('.p-flexpane__title_container');
        if (titleContainer && titleContainer.textContent.includes('Thread')) {
          console.log('Found flexpane header with Thread title');
          return flexpaneHeader;
        }
      }
    }
    const headerSelectors = ['[data-qa="thread_header"]', '.p-thread_view__header', '.p-threads_flexpane__header', '.p-flexpane_header',
    // 添加通用的 flexpane header
    '.c-message_kit__thread_message--root', '.c-message_kit__message--first'];
    for (const selector of headerSelectors) {
      const header = threadContainer.querySelector(selector);
      if (header) {
        console.log(`Found thread header with selector: ${selector}`);
        return header;
      }
    }

    // 在整個頁面中尋找 flexpane header（可能在 thread container 外部）
    const pageFlexpaneHeader = document.querySelector('.p-flexpane_header');
    if (pageFlexpaneHeader) {
      console.log('Found page-level flexpane header');
      return pageFlexpaneHeader;
    }

    // Fallback: look for the first message in the thread
    const firstMessage = threadContainer.querySelector('.c-virtual_list__item:first-child, .c-message_kit__message:first-child');
    if (firstMessage) {
      console.log('Using first message as thread header');
      return firstMessage;
    }
    console.log('No thread header found');
    return null;
  }

  /**
   * Remove duplicate elements from an array
   * @param {Array<Element>} elements - Array of elements
   * @returns {Array<Element>} Array with duplicates removed
   */
  removeDuplicates(elements) {
    const seen = new Set();
    return elements.filter(element => {
      if (seen.has(element)) {
        return false;
      }
      seen.add(element);
      return true;
    });
  }

  /**
   * Aggressive fallback method to find message elements by examining DOM structure
   * @param {Element} container - The container to search within
   * @param {boolean} verbose - Whether to log detailed information
   * @returns {Array<Element>} Array of potential message elements
   */
  findMessagesAggressiveFallback(container, verbose = true) {
    if (verbose) console.log('🔍 Using aggressive fallback to find messages...');

    // Look for any elements that might contain message content
    const allDivs = container.querySelectorAll('div');
    const potentialMessages = [];
    for (const div of allDivs) {
      const text = div.textContent.trim();

      // Skip elements that are too short or too long
      if (text.length < 10 || text.length > 5000) continue;

      // Skip elements that are likely UI components
      if (this.isMessageInputElement(div)) continue;

      // Look for elements that have message-like characteristics
      const hasUserName = div.querySelector('[data-qa*="user"]') || div.querySelector('[class*="user"]') || div.querySelector('button[data-qa*="user"]');
      const hasTimestamp = div.querySelector('[data-qa*="timestamp"]') || div.querySelector('[class*="timestamp"]') || div.querySelector('time') || /\d{1,2}:\d{2}/.test(text); // Simple time pattern

      const hasMessageContent = div.querySelector('.p-rich_text_section') || div.querySelector('[data-qa="message_content"]') || text.length > 20; // Has substantial content

      const isNestedTooDeep = this.getElementDepth(div, container) > 10;

      // Score the element based on message-like characteristics
      let score = 0;
      if (hasUserName) score += 3;
      if (hasTimestamp) score += 2;
      if (hasMessageContent) score += 1;
      if (isNestedTooDeep) score -= 2;

      // Additional scoring based on structure
      if (div.children.length > 0 && div.children.length < 10) score += 1;
      if (div.getAttribute('data-qa')) score += 1;
      if (score >= 2) {
        potentialMessages.push({
          element: div,
          score: score,
          text: text.substring(0, 100) + '...'
        });
      }
    }

    // Sort by score and return the elements
    potentialMessages.sort((a, b) => b.score - a.score);
    if (verbose && potentialMessages.length > 0) {
      console.log(`🎯 Found ${potentialMessages.length} potential messages with aggressive fallback:`, potentialMessages.slice(0, 5).map(m => ({
        score: m.score,
        text: m.text
      })));
    }
    return potentialMessages.map(m => m.element);
  }

  /**
   * Get the depth of an element within a container
   * @param {Element} element - The element to check
   * @param {Element} container - The container element
   * @returns {number} The depth level
   */
  getElementDepth(element, container) {
    let depth = 0;
    let current = element;
    while (current && current !== container && current !== document.body) {
      depth++;
      current = current.parentElement;
    }
    return depth;
  }
}
;// ./src/message-extractor.js
/**
 * Message Text Extraction Module
 * Handles extracting and formatting text content from Slack message elements
 */

class MessageTextExtractor {
  constructor() {
    this.userNameSelectors = ['[data-qa="message_sender_name"]',
    // 最精確的選擇器，優先使用
    '.c-message__sender_link', '.c-message__sender', '.c-message_kit__sender', '.c-message_kit__sender_link', '[data-qa="message_sender"]', '.p-rich_text_block .c-link' // 最後使用，可能不夠精確
    ];
    this.timeSelectors = ['.c-timestamp', '[data-qa="message_timestamp"]', '.c-message__time'];
    this.contentSelectors = ['.c-message_kit__blocks', '.c-message__message_blocks', '.p-block_kit_renderer', '.c-message__body', '.p-rich_text_section', '[data-qa="message_text"]', '.c-message__text'];
    this.skipElements = ['SCRIPT', 'STYLE', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION'];
  }

  /**
   * Extract complete message information from a message element
   */
  extractSingleMessage(messageEl) {
    if (!messageEl) return null;

    // Skip message input elements and other UI components
    if (this.isMessageInputElement(messageEl)) {
      console.log('Skipping message input element during extraction');
      return null;
    }
    const userName = this.extractUserName(messageEl);
    const timestamp = this.extractTimestamp(messageEl);
    const text = this.extractCompleteMessageText(messageEl);
    return {
      user: userName,
      text: text,
      timestamp: timestamp
    };
  }

  /**
   * Check if an element is a message input or other UI component that should be excluded
   * @param {Element} element - The element to check
   * @returns {boolean} True if the element should be excluded
   */
  isMessageInputElement(element) {
    // Check for message input elements
    if (element.hasAttribute('data-qa')) {
      const dataQa = element.getAttribute('data-qa');
      if (dataQa === 'message_input' || dataQa.includes('input') || dataQa.includes('composer')) {
        return true;
      }
    }

    // Check for input-related classes
    const inputClasses = ['c-texty_input', 'ql-container', 'ql-editor', 'ql-clipboard', 'ql-placeholder', 'c-composer', 'c-message_input', 'p-message_input', 'c-texty_input_unstyled'];
    for (const className of inputClasses) {
      if (element.classList.contains(className)) {
        return true;
      }
    }

    // Check for thread separator elements
    if (element.classList.contains('p-thread_separator_row_generic')) {
      return true;
    }

    // Check if element contains input-related elements
    const hasInputElements = element.querySelector('[data-qa="message_input"]') || element.querySelector('.ql-editor') || element.querySelector('.c-texty_input') || element.querySelector('[contenteditable="true"]') || element.querySelector('textarea') || element.querySelector('input[type="text"]');
    if (hasInputElements) {
      return true;
    }

    // Check if element contains thread separator elements
    if (element.querySelector('.p-thread_separator_row_generic')) {
      return true;
    }

    // Check for thread input specifically
    if (element.hasAttribute('data-thread-ts') || element.hasAttribute('data-channel-id')) {
      return true;
    }

    // Check for placeholder text that indicates input elements
    const placeholderTexts = ['Reply…', 'Reply to thread', 'Message', 'Type a message'];
    const elementText = element.textContent.trim();
    for (const placeholder of placeholderTexts) {
      if (elementText === placeholder) {
        return true;
      }
    }

    // Check for aria-label that indicates input
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && (ariaLabel.includes('Reply') || ariaLabel.includes('Message') || ariaLabel.includes('input'))) {
      return true;
    }
    return false;
  }

  /**
   * Extract username from message element
   * @param {Element} messageEl - The message element
   * @returns {string} The username or 'Unknown User' if not found
   */
  extractUserName(messageEl) {
    const debugInfo = [];
    for (const selector of this.userNameSelectors) {
      const userEl = messageEl.querySelector(selector);
      if (userEl) {
        const rawUserName = userEl.textContent.trim();
        const cleanedUserName = this.cleanDuplicateUserName(rawUserName);
        debugInfo.push({
          selector: selector,
          raw: rawUserName,
          cleaned: cleanedUserName,
          valid: this.isValidUserName(cleanedUserName)
        });

        // 驗證用戶名是否有效
        if (this.isValidUserName(cleanedUserName)) {
          // 只在找到重複用戶名時記錄調試信息
          if (rawUserName !== cleanedUserName) {
            console.log('Username extraction debug:', debugInfo);
          }
          return cleanedUserName;
        }
      }
    }

    // 如果沒有找到有效用戶名，記錄調試信息
    if (debugInfo.length > 0) {
      console.log('No valid username found, debug info:', debugInfo);
    }
    return 'Unknown User';
  }

  /**
   * Check if a username is valid
   * @param {string} userName - The username to validate
   * @returns {boolean} True if the username is valid
   */
  isValidUserName(userName) {
    if (!userName || userName.length === 0) {
      return false;
    }

    // 過濾掉明顯不是用戶名的文本
    const invalidPatterns = [/^\s*$/,
    // 純空白
    /^[\d\s\.\-\+\(\)]+$/,
    // 純數字和符號
    /^(reply|thread|view|show|load|more|less)$/i,
    // UI 元素文本
    /^\d+\s+(replies?|people)/i,
    // "5 replies", "3 people" 等
    /^(also\s+send\s+to|reply…)/i,
    // Slack 系統文本
    /^[\.\,\!\?\:\;]+$/,
    // 純標點符號
    /^(am|pm|at|on|in|the|and|or|but|so|also)$/i // 常見介詞和連詞
    ];
    for (const pattern of invalidPatterns) {
      if (pattern.test(userName)) {
        return false;
      }
    }

    // 用戶名長度應該合理（1-50 字符）
    if (userName.length > 50) {
      return false;
    }
    return true;
  }

  /**
   * Clean duplicate username patterns
   * @param {string} userName - The username to clean
   * @returns {string} The cleaned username
   */
  cleanDuplicateUserName(userName) {
    if (!userName || userName.length === 0) {
      return userName;
    }

    // 移除多餘的空白字符和特殊字符
    userName = userName.replace(/\s+/g, ' ').trim();

    // 移除可能的 HTML 實體或特殊字符
    userName = userName.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');

    // 檢查是否有完全重複的用戶名（如 "John DoeJohn Doe"）
    const words = userName.split(' ');
    const halfLength = Math.floor(words.length / 2);

    // 如果字數是偶數且大於2，檢查前半部分是否與後半部分相同
    if (words.length >= 4 && words.length % 2 === 0) {
      const firstHalf = words.slice(0, halfLength).join(' ');
      const secondHalf = words.slice(halfLength).join(' ');
      if (firstHalf === secondHalf) {
        console.log(`Found duplicate username pattern: "${userName}" -> "${firstHalf}"`);
        return firstHalf;
      }
    }

    // 檢查是否有連續重複的單詞
    const cleanedWords = [];
    let lastWord = '';
    for (const word of words) {
      const cleanWord = word.trim();
      if (cleanWord && cleanWord !== lastWord) {
        cleanedWords.push(cleanWord);
        lastWord = cleanWord;
      }
    }

    // 檢查是否有重複的名字模式（如 "John John Doe" -> "John Doe"）
    if (cleanedWords.length >= 3) {
      // 如果第一個和第二個單詞相同，移除第二個
      if (cleanedWords[0] === cleanedWords[1]) {
        cleanedWords.splice(1, 1);
        console.log(`Removed duplicate first name: "${userName}" -> "${cleanedWords.join(' ')}"`);
      }
    }
    const cleanedUserName = cleanedWords.join(' ');

    // 如果清理後的用戶名與原始用戶名不同，記錄日誌
    if (cleanedUserName !== userName) {
      console.log(`Cleaned username: "${userName}" -> "${cleanedUserName}"`);
    }
    return cleanedUserName;
  }

  /**
   * Extract timestamp from message element
   * @param {Element} messageEl - The message element
   * @returns {string} The timestamp or empty string
   */
  extractTimestamp(messageEl) {
    for (const selector of this.timeSelectors) {
      const timeEl = messageEl.querySelector(selector);
      if (timeEl) {
        return timeEl.getAttribute('title') || timeEl.textContent.trim();
      }
    }
    return '';
  }

  /**
   * Extract complete message text with structure preservation
   * @param {Element} messageEl - The message element
   * @returns {string} The extracted text content
   */
  extractCompleteMessageText(messageEl) {
    let contentContainer = null;
    for (const selector of this.contentSelectors) {
      contentContainer = messageEl.querySelector(selector);
      if (contentContainer) {
        console.log(`Found message content with selector: ${selector}`);
        break;
      }
    }
    if (!contentContainer) {
      contentContainer = messageEl;
    }
    const rawText = this.extractTextWithStructure(contentContainer);
    return this.finalTextCleanup(rawText);
  }

  /**
   * Extract text with structure preservation
   * @param {Element} element - The element to extract text from
   * @returns {string} The extracted text with structure
   */
  extractTextWithStructure(element) {
    if (element.nodeType === Node.TEXT_NODE) {
      return element.textContent;
    }
    if (this.skipElements.includes(element.tagName)) {
      return '';
    }

    // Skip message input elements and UI components
    if (element.nodeType === Node.ELEMENT_NODE && this.isMessageInputElement(element)) {
      return '';
    }
    if (element.tagName === 'BR') {
      return '\n';
    }
    let text = this.handleSpecialElements(element);
    if (text !== null) {
      return text;
    }

    // Process child nodes
    text = '';
    for (const child of element.childNodes) {
      const childText = this.extractTextWithStructure(child);
      if (childText) {
        text += childText;
      }
    }
    return this.handleBlockElements(element, text);
  }

  /**
   * Handle special elements like tables and code blocks
   * @param {Element} element - The element to check
   * @returns {string|null} Special content or null if not special
   */
  handleSpecialElements(element) {
    // Handle CodeMirror tables (like CSV preview data)
    if (element.classList && element.classList.contains('CodeMirror-code')) {
      return this.handleCodeMirrorTable(element);
    }

    // Handle standard HTML tables
    if (element.tagName === 'TABLE') {
      return this.handleHtmlTable(element);
    }

    // Handle mentions
    if (element.classList && element.classList.contains('c-member_slug')) {
      const memberLabel = element.getAttribute('data-member-label');
      const memberUrl = element.getAttribute('href');
      if (memberLabel) {
        return memberUrl ? ` [${memberLabel}](${memberUrl}) ` : ` ${memberLabel} `;
      }
    }

    // Handle links
    if (element.tagName === 'A' && element.classList && element.classList.contains('c-link')) {
      return this.handleLinkElement(element);
    }

    // Handle formatting
    if (element.tagName === 'STRONG' || element.tagName === 'B') {
      const innerText = this.extractChildrenText(element);
      return `**${innerText}**`;
    }
    if (element.tagName === 'EM' || element.tagName === 'I') {
      const innerText = this.extractChildrenText(element);
      return `*${innerText}*`;
    }
    if (element.tagName === 'CODE') {
      const innerText = this.extractChildrenText(element);
      return `\`${innerText}\``;
    }
    return null;
  }

  /**
   * Handle link elements
   * @param {Element} element - The link element
   * @returns {string} The formatted link text
   */
  handleLinkElement(element) {
    const linkText = element.textContent.trim();
    const href = element.getAttribute('href');
    if (element.classList.contains('c-member_slug')) {
      const memberLabel = element.getAttribute('data-member-label');
      if (href && (memberLabel || linkText)) {
        return ` [${memberLabel || linkText}](${href}) `;
      }
      return ` ${memberLabel || linkText} `;
    }
    if (href && linkText) {
      return ` [${linkText}](${href}) `;
    } else if (href) {
      return ` [${href}](${href}) `;
    }
    return ` ${linkText} `;
  }

  /**
   * Handle block elements
   * @param {Element} element - The block element
   * @param {string} text - Current text
   * @returns {string} Updated text with block content
   */
  handleBlockElements(element, text) {
    if (!element.tagName) {
      return text;
    }
    const blockElements = ['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

    // Handle headers
    if (element.tagName.match(/^H[1-6]$/)) {
      const level = parseInt(element.tagName.charAt(1));
      const headerPrefix = '#'.repeat(level);
      const cleanText = this.cleanWhitespace(text);
      return `${headerPrefix} ${cleanText}\n\n`;
    }
    if (blockElements.includes(element.tagName)) {
      if (text && !text.endsWith('\n')) {
        text += '\n';
      }
    }

    // Handle list items
    if (element.tagName === 'LI') {
      return this.handleListItem(element, text);
    }

    // Handle list containers
    if (element.tagName === 'OL' || element.tagName === 'UL') {
      if (text && !text.endsWith('\n\n')) {
        text += '\n';
      }
    }
    return text;
  }

  /**
   * Handle list item elements
   * @param {Element} element - The list item element
   * @param {string} text - Current text
   * @returns {string} Updated text with list item
   */
  handleListItem(element, text) {
    const isOrdered = element.closest('ol') !== null;
    const listLevel = this.getListLevel(element);
    const indent = '  '.repeat(listLevel);
    const cleanText = this.cleanWhitespace(text);
    if (isOrdered) {
      const index = Array.from(element.parentNode.children).indexOf(element) + 1;
      return `${indent}${index}. ${cleanText}\n`;
    } else {
      return `${indent}- ${cleanText}\n`;
    }
  }

  /**
   * Extract text from child elements
   * @param {Element} element - The parent element
   * @returns {string} The extracted text
   */
  extractChildrenText(element) {
    let text = '';
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        text += this.extractChildrenText(child);
      }
    }
    return text.trim();
  }

  /**
   * Clean whitespace in text
   * @param {string} text - The text to clean
   * @returns {string} Cleaned text
   */
  cleanWhitespace(text) {
    return text.replace(/[ \t]+/g, ' ').replace(/[ ]*\n[ ]*/g, '\n').replace(/^\s+|\s+$/g, '').trim();
  }

  /**
   * Get the nesting level of a list item
   * @param {Element} listItem - The list item element
   * @returns {number} The nesting level
   */
  getListLevel(listItem) {
    let level = 0;
    let currentElement = listItem.parentNode;
    while (currentElement && currentElement !== document.body) {
      if (currentElement.tagName === 'OL' || currentElement.tagName === 'UL') {
        level++;
      }
      currentElement = currentElement.parentNode;
    }
    return Math.max(0, level - 1);
  }

  /**
   * Final text cleanup and formatting
   * @param {string} text - The text to clean
   * @returns {string} Final cleaned text
   */
  finalTextCleanup(text) {
    return text.replace(/[ \t]+/g, ' ').replace(/[ ]*\n[ ]*/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/\n\n(\d+\.)/g, '\n$1').replace(/\n\n(-)/g, '\n$1').replace(/\]\s*\(\s*/g, '](').replace(/\s*\)\s*/g, ') ').replace(/^\s+|\s+$/g, '').trim();
  }

  /**
   * Handle CodeMirror table structure
   * @param {Element} element 
   * @returns {string}
   */
  handleCodeMirrorTable(element) {
    const rows = element.querySelectorAll('.CodeMirror-line');
    if (rows.length === 0) return '';
    const tableData = [];
    rows.forEach((_rowIndex, row) => {
      const cells = row.querySelectorAll('.cm-variable, .cm-string, .cm-number, .cm-atom, .cm-keyword');
      if (cells.length > 0) {
        const rowData = Array.from(cells).map(cell => cell.textContent.trim()).filter(text => text);
        if (rowData.length > 0) {
          tableData.push(rowData);
        }
      }
    });
    if (tableData.length === 0) return '';

    // Format as markdown table
    let markdown = '';
    tableData.forEach((row, index) => {
      markdown += '| ' + row.join(' | ') + ' |\n';
      if (index === 0) {
        // Add header separator
        markdown += '| ' + row.map(() => '---').join(' | ') + ' |\n';
      }
    });
    return markdown;
  }

  /**
   * Handle standard HTML table structure
   * @param {Element} element - TABLE element
   * @returns {string} Markdown table
   */
  handleHtmlTable(element) {
    console.log('Processing HTML table...');
    const tableData = [];
    let hasHeader = false;

    // Check for thead or th elements to determine if there's a header
    const thead = element.querySelector('thead');
    const thElements = element.querySelectorAll('th');
    hasHeader = thead !== null || thElements.length > 0;

    // Extract header if exists
    if (hasHeader) {
      const headerRow = [];
      if (thead) {
        const headerCells = thead.querySelectorAll('th, td');
        headerCells.forEach(cell => {
          const cellText = this.extractCellText(cell);
          headerRow.push(cellText);
        });
      } else {
        // Use first row of th elements
        thElements.forEach(cell => {
          const cellText = this.extractCellText(cell);
          headerRow.push(cellText);
        });
      }
      if (headerRow.length > 0) {
        tableData.push(headerRow);
      }
    }

    // Extract body rows
    const tbody = element.querySelector('tbody') || element;
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
      // Skip header rows if we already processed them
      if (hasHeader && row.querySelector('th') && tableData.length > 0) {
        return;
      }
      const cells = row.querySelectorAll('td, th');
      const rowData = [];
      cells.forEach(cell => {
        const cellText = this.extractCellText(cell);
        rowData.push(cellText);
      });
      if (rowData.length > 0) {
        tableData.push(rowData);
      }
    });
    if (tableData.length === 0) {
      return '';
    }

    // Generate Markdown table
    let markdownTable = '\n\n';

    // Determine the maximum number of columns
    const maxCols = Math.max(...tableData.map(row => row.length));

    // Add first row (header or first data row)
    const firstRow = tableData[0];
    while (firstRow.length < maxCols) {
      firstRow.push('');
    }
    markdownTable += '| ' + firstRow.join(' | ') + ' |\n';

    // Add separator row
    markdownTable += '|' + ' --- |'.repeat(maxCols) + '\n';

    // Add remaining rows
    for (let i = 1; i < tableData.length; i++) {
      const dataRow = tableData[i];
      while (dataRow.length < maxCols) {
        dataRow.push('');
      }
      markdownTable += '| ' + dataRow.join(' | ') + ' |\n';
    }
    markdownTable += '\n';
    console.log(`Converted HTML table with ${tableData.length} rows and ${maxCols} columns`);
    return markdownTable;
  }

  /**
   * Extract text content from a table cell, handling nested elements
   * @param {Element} cell - TD or TH element
   * @returns {string} Clean cell text
   */
  extractCellText(cell) {
    let cellText = '';

    // Use the existing text extraction logic for the cell content
    for (const child of cell.childNodes) {
      const childText = this.extractTextWithStructure(child);
      if (childText) {
        cellText += childText;
      }
    }

    // Clean up the cell text
    cellText = cellText.replace(/\n+/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\|/g, '\\|') // Escape pipe characters
    .trim();
    return cellText;
  }
}
;// ./src/message-processor.js
/**
 * Message Processing Module
 * Handles message post-processing including Unknown User filtering and merging
 * Updated to use the implementation from content.js
 */
class MessageProcessor {
  constructor() {
    // Slack system message patterns to filter out
    this.systemMessagePatterns = [/\d+\s+replies?/i, /reply…\s*also\s+send\s+to/i, /also\s+send\s+to/i, /\d+\s+people\s+will\s+be\s+notified/i, /started\s+a\s+thread/i, /joined\s+the\s+channel/i, /left\s+the\s+channel/i, /set\s+the\s+channel\s+topic/i, /pinned\s+a\s+message/i, /unpinned\s+a\s+message/i, /uploaded\s+a\s+file/i, /shared\s+a\s+file/i, /added\s+an\s+integration/i, /removed\s+an\s+integration/i, /changed\s+the\s+channel\s+name/i, /archived\s+this\s+channel/i, /unarchived\s+this\s+channel/i, /This\s+message\s+was\s+deleted/i, /Message\s+deleted/i, /has\s+joined\s+the\s+conversation/i, /has\s+left\s+the\s+conversation/i, /View\s+\d+\s+replies?/i, /Show\s+less/i, /Show\s+more/i, /Load\s+more\s+messages/i, /^\s*…\s*$/, /^\s*\.\.\.\s*$/, /^reply$/i, /^thread$/i, /^view\s+thread$/i, /^reply…$/i, /^reply\s+to\s+thread/i, /^message$/i, /^type\s+a\s+message/i, /^send\s+a\s+message/i, /^compose\s+message/i];
  }

  /**
   * Process messages to filter system messages and merge continuations
   * @param {Array} rawMessages - Raw extracted messages
   * @returns {Array} Processed messages
   */
  processMessages(rawMessages) {
    console.log(`Processing ${rawMessages.length} raw messages...`);

    // Step 1: Filter out system messages
    const filteredMessages = this.filterSystemMessages(rawMessages);
    console.log(`After system message filtering: ${filteredMessages.length} messages`);

    // Step 2: Merge continuation messages
    const mergedMessages = this.mergeContinuationMessages(filteredMessages);
    console.log(`After merging continuations: ${mergedMessages.length} messages`);
    return mergedMessages;
  }

  /**
   * Filter out Slack system messages
   * @param {Array} messages 
   * @returns {Array}
   */
  filterSystemMessages(messages) {
    return messages.filter(message => {
      // Keep messages from known users
      if (message.user !== 'Unknown User') {
        return true;
      }

      // Check if Unknown User message is a system message
      const isSystemMessage = this.isSystemMessage(message.text);
      if (isSystemMessage) {
        console.log(`Filtering out system message: "${message.text.substring(0, 50)}..."`);
        return false;
      }
      return true;
    });
  }

  /**
   * Check if a message is a Slack system message
   * @param {string} text 
   * @returns {boolean}
   */
  isSystemMessage(text) {
    if (!text || text.trim().length === 0) {
      return true;
    }
    const cleanText = text.trim();

    // Check against known system message patterns
    for (const pattern of this.systemMessagePatterns) {
      if (pattern.test(cleanText)) {
        return true;
      }
    }

    // Additional heuristics for system messages
    // Very short messages that are likely UI elements
    if (cleanText.length < 5 && !/[a-zA-Z]/.test(cleanText)) {
      return true;
    }

    // Messages that are just numbers or symbols
    if (/^\s*[\d\s\.\-\+\(\)]+\s*$/.test(cleanText)) {
      return true;
    }

    // Messages that look like UI buttons or links
    if (/^(reply|thread|view|show|load|more|less)$/i.test(cleanText)) {
      return true;
    }
    return false;
  }

  /**
   * Merge Unknown User messages that are continuations of previous messages
   * @param {Array} messages 
   * @returns {Array}
   */
  mergeContinuationMessages(messages) {
    const processedMessages = [];
    for (let i = 0; i < messages.length; i++) {
      const currentMessage = messages[i];

      // If this is not an Unknown User message, add it normally
      if (currentMessage.user !== 'Unknown User') {
        processedMessages.push(currentMessage);
        continue;
      }

      // For Unknown User messages, always try to merge with the previous message
      if (processedMessages.length > 0) {
        // Find the most recent non-Unknown User message to merge with
        let targetIndex = processedMessages.length - 1;
        while (targetIndex >= 0 && (processedMessages[targetIndex].user === 'Unknown User' || processedMessages[targetIndex].user === 'Unknown User (Standalone)')) {
          targetIndex--;
        }
        if (targetIndex >= 0) {
          // Merge with the found message
          const targetMessage = processedMessages[targetIndex];
          const mergedText = this.mergeMessageTexts(targetMessage.text, currentMessage.text);
          console.log(`Merging Unknown User message with previous message from ${targetMessage.user}`);
          console.log(`Original: "${targetMessage.text.substring(0, 50)}..."`);
          console.log(`Continuation: "${currentMessage.text.substring(0, 50)}..."`);

          // Update the target message with merged content
          targetMessage.text = mergedText;

          // Update timestamp if the continuation has a more recent timestamp
          if (currentMessage.timestamp && (!targetMessage.timestamp || this.isMoreRecentTimestamp(currentMessage.timestamp, targetMessage.timestamp))) {
            targetMessage.timestamp = currentMessage.timestamp;
          }
        } else {
          // No previous non-Unknown User message found, skip this message
          console.log(`Skipping Unknown User message (no previous user message found): "${currentMessage.text.substring(0, 50)}..."`);
        }
      } else {
        // No previous messages at all, skip this Unknown User message
        console.log(`Skipping Unknown User message (first message): "${currentMessage.text.substring(0, 50)}..."`);
      }
    }
    return processedMessages;
  }

  /**
   * Merge two message texts intelligently
   * @param {string} previousText 
   * @param {string} continuationText 
   * @returns {string}
   */
  mergeMessageTexts(previousText, continuationText) {
    const prev = previousText.trim();
    const cont = continuationText.trim();

    // If previous text ends with punctuation, add a space
    if (/[.!?]\s*$/.test(prev)) {
      return `${prev} ${cont}`;
    }

    // If previous text ends with a line break or continuation character
    if (/[\n\r]\s*$/.test(prev) || /[-–—]\s*$/.test(prev)) {
      return `${prev}${cont}`;
    }

    // Default: add a space between texts
    return `${prev} ${cont}`;
  }

  /**
   * Check if timestamp1 is more recent than timestamp2
   * @param {string} timestamp1 
   * @param {string} timestamp2 
   * @returns {boolean}
   */
  isMoreRecentTimestamp(timestamp1, timestamp2) {
    // Simple string comparison for now
    // Could be enhanced with proper date parsing if needed
    return timestamp1 > timestamp2;
  }
}
;// ./src/scroll-collector.js
/**
 * Thread Scroll Collector Module
 * Handles automatic scrolling and message collection for complete thread extraction
 */

class ThreadScrollCollector {
  constructor(domDetector, textExtractor, progressCallback = null, messageProcessor = null, configManager = null) {
    this.domDetector = domDetector;
    this.textExtractor = textExtractor;
    this.messageProcessor = messageProcessor;
    this.progressCallback = progressCallback;
    this.configManager = configManager;

    // 預設值（如果沒有配置管理器）
    this.defaultScrollSettings = {
      scrollDelay: 400,
      maxScrollAttempts: 300,
      // 增加最大滾動次數以支援長討論串
      noMaxNewMessagesCount: 12,
      // 增加容忍度
      scrollStep: 600,
      minScrollAmount: 100
    };

    // 初始化滾動參數
    this.scrollSettings = {
      ...this.defaultScrollSettings
    };

    // 載入配置
    this.loadScrollSettings();
  }

  /**
   * 載入滾動設定
   */
  async loadScrollSettings() {
    if (this.configManager) {
      try {
        const settings = await this.configManager.getScrollSettings();
        this.scrollSettings = {
          ...this.defaultScrollSettings,
          ...settings
        };
        console.log('已載入滾動設定:', this.scrollSettings);
      } catch (error) {
        console.warn('載入滾動設定失敗，使用預設值:', error);
        this.scrollSettings = {
          ...this.defaultScrollSettings
        };
      }
    }
  }

  /**
   * 更新滾動設定
   * @param {Object} newSettings 新的滾動設定
   * @returns {Promise<boolean>} 是否成功更新
   */
  async updateScrollSettings(newSettings) {
    this.scrollSettings = {
      ...this.scrollSettings,
      ...newSettings
    };
    if (this.configManager) {
      return await this.configManager.updateScrollSettings(newSettings);
    }
    return true;
  }

  /**
   * 重置滾動設定為預設值
   * @returns {Promise<boolean>} 是否成功重置
   */
  async resetScrollSettings() {
    this.scrollSettings = {
      ...this.defaultScrollSettings
    };
    if (this.configManager) {
      return await this.configManager.resetScrollSettings();
    }
    return true;
  }

  /**
   * 獲取當前滾動設定
   * @returns {Object} 當前的滾動設定
   */
  getScrollSettings() {
    return {
      ...this.scrollSettings
    };
  }

  /**
   * 自動滾動並收集完整的Thread訊息
   * @returns {Promise<Array>} 完整的訊息列表
   */
  async collectCompleteThreadMessages() {
    console.log('開始收集完整Thread訊息...');
    const threadContainer = this.domDetector.findThreadContainer();
    if (!threadContainer) {
      throw new Error('未找到Thread容器');
    }
    try {
      // 找到滾動容器
      const scrollContainer = this.findScrollContainer(threadContainer);
      if (!scrollContainer) {
        console.warn('未找到滾動容器，使用當前可見訊息');
        return this.extractCurrentMessages(true);
      }
      console.log('找到滾動容器，開始自動滾動收集訊息');

      // 先滾動到頂部
      await this.scrollToTop(scrollContainer);

      // 設置超時機制（最多5分鐘）
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('滾動收集超時')), 5 * 60 * 1000);
      });

      // 逐步滾動並收集訊息
      const allMessages = await Promise.race([this.scrollAndCollectMessages(scrollContainer), timeoutPromise]);

      // 如果自動滾動收集的訊息太少，回退到原方法
      if (allMessages.length === 0) {
        console.warn('自動滾動未收集到訊息，回退到原方法');
        return this.extractCurrentMessages(true);
      }
      console.log(`完成訊息收集，共收集到 ${allMessages.length} 條訊息`);
      return allMessages;
    } catch (error) {
      console.error('自動滾動收集訊息時發生錯誤:', error);
      console.log('回退到原方法收集當前可見訊息');
      return this.extractCurrentMessages(true);
    }
  }

  /**
   * 找到Thread的滾動容器
   * @param {Element} threadContainer 
   * @returns {Element|null}
   */
  findScrollContainer(threadContainer) {
    // 常見的Slack滾動容器選擇器，按優先級排序
    const scrollSelectors = ['.c-virtual_list__scroll_container[role="list"]',
    // 虛擬滾動列表
    '.c-virtual_list__scroll_container', '.c-scrollbar__hider', '[data-qa="slack_kit_scrollbar"]', '.c-virtual_list.c-scrollbar',
    // 虛擬滾動容器
    '.p-thread_view__messages', '.p-threads_flexpane__content'];
    for (const selector of scrollSelectors) {
      const container = threadContainer.querySelector(selector);
      if (container && this.isScrollable(container)) {
        console.log(`找到滾動容器: ${selector}`, {
          scrollHeight: container.scrollHeight,
          clientHeight: container.clientHeight,
          scrollTop: container.scrollTop
        });
        return container;
      }
    }

    // 特別檢查虛擬滾動容器
    const virtualList = threadContainer.querySelector('.c-virtual_list');
    if (virtualList) {
      console.log('找到虛擬滾動容器，檢查其滾動能力');
      if (this.isScrollable(virtualList)) {
        console.log('虛擬滾動容器可滾動');
        return virtualList;
      }

      // 檢查虛擬滾動容器的父元素
      const parent = virtualList.parentElement;
      if (parent && this.isScrollable(parent)) {
        console.log('使用虛擬滾動容器的父元素作為滾動容器');
        return parent;
      }
    }

    // 如果沒找到特定容器，檢查threadContainer本身是否可滾動
    if (this.isScrollable(threadContainer)) {
      console.log('使用Thread容器本身作為滾動容器');
      return threadContainer;
    }
    console.log('未找到合適的滾動容器');
    return null;
  }

  /**
   * 檢查元素是否可滾動
   * @param {Element} element 
   * @returns {boolean}
   */
  isScrollable(element) {
    const style = window.getComputedStyle(element);
    const hasScrollableContent = element.scrollHeight > element.clientHeight;
    const hasScrollableStyle = style.overflowY === 'scroll' || style.overflowY === 'auto' || style.overflow === 'scroll' || style.overflow === 'auto';
    return hasScrollableContent && hasScrollableStyle;
  }

  /**
   * 滾動到頂部
   * @param {Element} scrollContainer 
   */
  async scrollToTop(scrollContainer) {
    console.log('滾動到頂部...');

    // 滾動到頂部
    scrollContainer.scrollTop = 0;

    // 等待滾動完成
    await this.waitForScrollComplete();

    // 等待虛擬列表更新
    await this.waitForVirtualListUpdate();
    console.log('已滾動到頂部');
  }

  /**
   * 滾動並收集訊息
   * @param {Element} scrollContainer 
   * @returns {Promise<Array>}
   */
  async scrollAndCollectMessages(scrollContainer) {
    return await this.standardScrollAndCollect(scrollContainer);
  }

  /**
   * 標準滾動收集方法
   * @param {Element} scrollContainer 
   * @returns {Promise<Array>}
   */
  async standardScrollAndCollect(scrollContainer) {
    const allMessages = new Map();
    let scrollAttempts = 0;
    let noNewMessagesCount = 0;
    let lastScrollTop = -1;
    let stuckScrollCount = 0;
    console.log(`開始標準滾動收集，初始滾動高度: ${scrollContainer.scrollHeight}px`);
    while (scrollAttempts < this.scrollSettings.maxScrollAttempts) {
      const currentScrollTop = scrollContainer.scrollTop;
      const currentScrollHeight = scrollContainer.scrollHeight;
      const currentTotalScrollHeight = currentScrollHeight - scrollContainer.clientHeight;

      // 提取當前可見的訊息
      const currentMessages = this.extractCurrentMessages();
      const previousSize = allMessages.size;

      // 添加新訊息到集合中
      currentMessages.forEach(message => {
        const messageId = this.generateMessageId(message);
        if (!allMessages.has(messageId)) {
          allMessages.set(messageId, message);
        }
      });
      const newMessagesAdded = allMessages.size - previousSize;
      const currentProgress = currentTotalScrollHeight > 0 ? Math.min(currentScrollTop / currentTotalScrollHeight, 1) : 0;
      const progressPercentage = Math.round(currentProgress * 100);
      console.log(`滾動第 ${scrollAttempts + 1} 次: 新增 ${newMessagesAdded} 條，總計 ${allMessages.size} 條，進度 ${progressPercentage}%，當前高度: ${currentScrollHeight}px`);
      this.showScrollProgress(progressPercentage, allMessages.size);

      // 檢查滾動是否卡住
      if (Math.abs(currentScrollTop - lastScrollTop) < 5) {
        stuckScrollCount++;
        console.log(`滾動位置變化很小，卡住計數: ${stuckScrollCount}`);
      } else {
        stuckScrollCount = 0;
      }
      lastScrollTop = currentScrollTop;

      // 檢查是否需要停止滾動
      if (newMessagesAdded === 0) {
        noNewMessagesCount++;
        console.log(`未發現新訊息，計數: ${noNewMessagesCount}/${this.scrollSettings.noMaxNewMessagesCount}`);

        // 對於長討論串，增加容忍度
        const maxNoNewMessages = allMessages.size > 50 ? Math.max(this.scrollSettings.noMaxNewMessagesCount, 15) : this.scrollSettings.noMaxNewMessagesCount;
        if (noNewMessagesCount >= maxNoNewMessages) {
          console.log('連續多次未發現新訊息，停止滾動');
          break;
        }
      } else {
        noNewMessagesCount = 0;
      }

      // 如果滾動卡住太久，嘗試更大的滾動步長
      if (stuckScrollCount >= 3) {
        console.log('檢測到滾動卡住，嘗試更大步長');
        scrollContainer.scrollTop = currentScrollTop + this.scrollSettings.scrollStep * 2;
        stuckScrollCount = 0;
      } else {
        // 計算下一次滾動的距離
        const scrollAmount = this.calculateScrollAmount(scrollContainer, currentScrollTop, currentTotalScrollHeight);
        scrollContainer.scrollTop = currentScrollTop + scrollAmount;
      }

      // 等待滾動完成和虛擬列表更新
      await this.waitForScrollComplete();
      await this.waitForVirtualListUpdate();

      // 更寬鬆的底部檢測 - 考慮虛擬滾動的動態性
      const isNearBottom = currentScrollTop >= currentTotalScrollHeight - 50;
      const hasReachedActualBottom = currentScrollTop + scrollContainer.clientHeight >= currentScrollHeight - 20;
      if (isNearBottom || hasReachedActualBottom) {
        console.log('接近或到達底部，進行最終檢查...');

        // 嘗試再滾動一點，確保真的到底了
        const beforeFinalScroll = scrollContainer.scrollTop;
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        await this.waitForScrollComplete();
        await this.waitForVirtualListUpdate();

        // 最終訊息收集
        const finalMessages = this.extractCurrentMessages();
        finalMessages.forEach(message => {
          const messageId = this.generateMessageId(message);
          if (!allMessages.has(messageId)) {
            allMessages.set(messageId, message);
          }
        });

        // 如果滾動位置沒有變化，說明真的到底了
        if (Math.abs(scrollContainer.scrollTop - beforeFinalScroll) < 10) {
          console.log('確認已到達底部，結束滾動');
          break;
        }
      }
      scrollAttempts++;
    }
    console.log(`滾動收集完成，總共進行了 ${scrollAttempts} 次滾動，收集到 ${allMessages.size} 條訊息`);
    return this.finalizeMessages(allMessages);
  }

  /**
   * 最終處理訊息列表
   * @param {Map} allMessages 
   * @returns {Array}
   */
  finalizeMessages(allMessages) {
    const messageArray = Array.from(allMessages.values());
    console.log(`原始訊息數量: ${messageArray.length}`);

    // 如果有訊息處理器，使用它來處理訊息
    if (this.messageProcessor) {
      const processedMessages = this.messageProcessor.processMessages(messageArray);
      console.log(`處理後訊息數量: ${processedMessages.length}`);
      return processedMessages;
    }
    return messageArray;
  }

  /**
   * 提取當前可見的訊息
   * @param {boolean} verbose 
   * @returns {Array}
   */
  extractCurrentMessages(verbose = false) {
    const messageElements = this.domDetector.findMessageElements(false);
    const rawMessages = [];
    if (verbose) {
      console.log(`找到 ${messageElements.length} 個訊息元素`);
    }
    messageElements.forEach((messageEl, index) => {
      try {
        // 檢查元素是否可見
        const rect = messageEl.getBoundingClientRect();
        const isVisible = rect.height > 0 && rect.width > 0;
        if (!isVisible) {
          return;
        }
        const message = this.textExtractor.extractSingleMessage(messageEl);
        if (message && message.text && message.text.trim().length > 0) {
          rawMessages.push(message);
        }
      } catch (error) {
        if (verbose) {
          console.log(`提取訊息 ${index + 1} 時發生錯誤:`, error);
        }
      }
    });
    if (verbose) {
      console.log(`成功提取 ${rawMessages.length} 條有效訊息`);
    }
    return rawMessages;
  }

  /**
   * 生成訊息的唯一ID
   * @param {Object} message 
   * @returns {string}
   */
  generateMessageId(message) {
    // 使用文本內容的前100個字符和用戶名來生成ID
    const textPreview = message.text.substring(0, 100).replace(/\s+/g, ' ').trim();
    const userPart = message.user || 'unknown';
    const timePart = message.timestamp || 'no-time';
    return `${userPart}:${timePart}:${textPreview}`;
  }

  /**
   * 等待滾動完成
   */
  async waitForScrollComplete() {
    await new Promise(resolve => setTimeout(resolve, this.scrollSettings.scrollDelay));
  }

  /**
   * 等待虛擬列表更新
   */
  async waitForVirtualListUpdate() {
    // 虛擬列表可能需要額外時間來渲染新內容
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  /**
   * 計算滾動距離
   * @param {Element} scrollContainer 
   * @param {number} _currentScrollTop 
   * @param {number} _totalScrollHeight 
   * @returns {number}
   */
  calculateScrollAmount(scrollContainer, _currentScrollTop, _totalScrollHeight) {
    // 基本滾動步長
    let scrollAmount = this.scrollSettings.scrollStep;

    // 根據容器高度調整滾動步長
    const containerHeight = scrollContainer.clientHeight;
    if (containerHeight > 800) {
      scrollAmount = Math.max(scrollAmount, containerHeight * 0.8);
    }
    return scrollAmount;
  }

  /**
   * 顯示滾動進度
   * @param {number} progressPercentage 
   * @param {number} messageCount 
   */
  showScrollProgress(progressPercentage, messageCount) {
    if (this.progressCallback) {
      this.progressCallback(progressPercentage, messageCount);
    }
  }
}
;// ./src/ui-components.js
/**
 * UI Components Module
 * Handles creation and management of UI elements like buttons and modals
 */

/**
 * Summary Button Manager
 * Handles creation and management of the summary button
 */
class SummaryButtonManager {
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
      loading: {
        text: '⏳ 正在分析討論串...',
        disabled: true
      },
      opening: {
        text: '🚀 正在開啟 Gemini...',
        disabled: true
      },
      success: {
        text: '✅ 已開啟 Gemini',
        disabled: true
      },
      error: {
        text: '❌ 錯誤',
        disabled: true
      },
      default: {
        text: '📝 摘要此討論串',
        disabled: false
      }
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
class ThreadAnalyzer {
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
    return timestamps.length > 1 ? `${timestamps[0]} - ${timestamps[timestamps.length - 1]}` : timestamps[0] || '未知時間';
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
        const result = customPrompt.includes('{MESSAGES}') ? customPrompt.replace('{MESSAGES}', messageText) : customPrompt + '\n\n' + messageText;
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
    return new Promise(resolve => {
      try {
        const isChromeExtensionContext = this.isValidChromeExtensionContext();
        if (isChromeExtensionContext) {
          console.log('✅ Chrome extension context available');
          chrome.storage.local.get(['customSystemPrompt'], function (result) {
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
class PreviewModalManager {
  constructor() {
    this.modalClass = 'slack-helper-modal';
    this.modalContentClass = 'slack-helper-modal-content';
  }
  async showThreadPreview(messages) {
    return new Promise(resolve => {
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
    return new Promise(resolve => {
      try {
        console.log('🔍 PreviewModalManager.getAvailableModels called');

        // 檢查 Chrome 擴展環境
        const isChromeExtensionContext = this.isValidChromeExtensionContext();
        console.log('✅ Chrome extension context valid:', isChromeExtensionContext);
        if (isChromeExtensionContext) {
          console.log('📤 Sending message to background script: getAvailableModels');

          // 向背景腳本請求可用模型列表
          chrome.runtime.sendMessage({
            action: 'getAvailableModels'
          }, response => {
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
    return [{
      value: 'auto',
      displayName: '🔄 自動 (使用 Gemini 頁面預設模型)',
      description: '🔄 不切換模型，使用 Gemini 頁面當前的預設模型'
    }];
  }

  /**
   * 生成模型選擇的 HTML
   * @param {Array} availableModels 可用模型列表
   * @returns {string} 模型選擇的 HTML
   */
  generateModelSelectHTML(availableModels) {
    const options = availableModels.map(model => `<option value="${model.value}">${model.displayName}</option>`).join('');

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
            ${threadInfo.participants.map(participant => `<span style="background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;">
                👤 ${participant}
              </span>`).join('')}
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
      resolve({
        confirmed: true,
        selectedModel,
        messages
      });
    });

    // 取消按鈕
    cancelBtn.addEventListener('click', () => {
      this.closeModal(modal);
      resolve({
        confirmed: false
      });
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
    const escHandler = e => {
      if (e.key === 'Escape') {
        this.closeModal(modal);
        resolve({
          confirmed: false
        });
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
      chrome.storage.local.get(['selectedGeminiModel'], result => {
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
      chrome.storage.local.set({
        selectedGeminiModel: modelValue
      }, () => {
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
class PageObserver {
  constructor(callback) {
    this.callback = callback;
    this.observer = null;
    this.lastUrl = window.location.href;
  }
  startObserving() {
    let debounceTimer = null;
    let lastCallTime = 0;

    // 監聽 DOM 變化
    this.observer = new MutationObserver(mutations => {
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
            return target.closest('.p-threads_flexpane') || target.closest('.p-thread_view') || target.querySelector('.p-threads_flexpane') || target.querySelector('.p-thread_view');
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
;// ./src/model-sync.js
/**
 * Model Sync Module
 * Handles synchronization of selected model between extension and Gemini page
 */

/**
 * 模型同步管理器
 */
class ModelSyncManager {
  constructor() {
    this.syncInterval = null;
    this.syncIntervalMs = 30 * 60 * 1000; // 30 分鐘同步一次
    this.isGeminiTab = false;
  }

  /**
   * 開始監控 Gemini 頁面並定期同步模型
   */
  startMonitoring() {
    // 監聽頁面變化
    this.checkCurrentPage();

    // 設置定期檢查
    setInterval(() => {
      this.checkCurrentPage();
    }, 5000); // 每 5 秒檢查一次當前頁面
  }

  /**
   * 檢查當前頁面是否為 Gemini
   */
  checkCurrentPage() {
    const isCurrentlyGemini = this.isGeminiPage();
    if (isCurrentlyGemini && !this.isGeminiTab) {
      // 剛進入 Gemini 頁面
      this.isGeminiTab = true;
      this.startPeriodicSync();
      console.log('檢測到 Gemini 頁面，開始模型同步');
    } else if (!isCurrentlyGemini && this.isGeminiTab) {
      // 離開 Gemini 頁面
      this.isGeminiTab = false;
      this.stopPeriodicSync();
      console.log('離開 Gemini 頁面，停止模型同步');
    }
  }

  /**
   * 檢查當前頁面是否為 Gemini
   * @returns {boolean}
   */
  isGeminiPage() {
    return window.location.hostname.includes('gemini.google.com');
  }

  /**
   * 開始定期同步
   */
  startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // 立即執行一次同步
    this.syncModels();

    // 設置定期同步
    this.syncInterval = setInterval(() => {
      this.syncModels();
    }, this.syncIntervalMs);
  }

  /**
   * 停止定期同步
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * 執行模型同步
   */
  async syncModels() {
    try {
      console.log('開始同步 Gemini 模型...');

      // 發送同步請求到 background script
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
          action: 'syncGeminiModels',
          tabId: 'current',
          // 讓 background script 自己處理 tab ID
          url: window.location.href
        }, response => {
          if (chrome.runtime.lastError) {
            console.warn('模型同步請求失敗:', chrome.runtime.lastError);
          } else if (response && response.success) {
            console.log('模型同步成功');
          } else {
            console.warn('模型同步失敗:', response === null || response === void 0 ? void 0 : response.error);
          }
        });
      }
    } catch (error) {
      console.error('模型同步過程中發生錯誤:', error);
    }
  }

  /**
   * 手動觸發模型同步
   */
  async manualSync() {
    console.log('手動觸發模型同步');
    await this.syncModels();
  }
}

/**
 * 全域模型同步管理器實例
 */
let modelSyncManager = null;

/**
 * 初始化模型同步
 */
function initializeModelSync() {
  if (!modelSyncManager) {
    modelSyncManager = new ModelSyncManager();
    modelSyncManager.startMonitoring();
    console.log('模型同步管理器已初始化');
  }
  return modelSyncManager;
}

/**
 * 獲取模型同步管理器實例
 * @returns {ModelSyncManager}
 */
function getModelSyncManager() {
  return modelSyncManager;
}

/**
 * 檢查是否為 Gemini 頁面
 */
function isGeminiPage() {
  return window.location.hostname.includes('gemini.google.com');
}
;// ./src/content-script.js
/**
 * Main Content Script for Slack Helper
 * Uses webpack to properly bundle all modules
 */







console.log('Slack Helper content script loaded (webpack bundled)');

/**
 * Main SlackThreadExtractor class that orchestrates all functionality
 */
class SlackThreadExtractor {
  constructor() {
    this.domDetector = new SlackDOMDetector();
    this.messageExtractor = new MessageTextExtractor();
    this.messageProcessor = new MessageProcessor();
    this.scrollCollector = new ThreadScrollCollector(this.domDetector, this.messageExtractor, null,
    // progressCallback
    this.messageProcessor);
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
      const testSelectors = ['[data-qa="virtual-list-item"]', '.c-virtual_list__item', '.c-message_kit__message', '.c-message', '[data-qa="message"]'];
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
      }, response => {
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

// Check if this is a Gemini page and initialize model sync if needed
if (isGeminiPage()) {
  console.log('Detected Gemini page, initializing model sync...');
  try {
    initializeModelSync();
    console.log('✅ Model sync initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize model sync:', error);
  }
}

// Initialize the main extractor
let slackThreadExtractor = null;

// Initialize when DOM is ready
function initializeExtractor() {
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
  if (!slackThreadExtractor) {
    console.log('Retrying initialization after delay...');
    initializeExtractor();
  }
}, 2000);

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
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
        sendResponse({
          messages: messages
        });
      } else {
        sendResponse({
          error: 'Extension not initialized'
        });
      }
    } else if (request.action === 'extractCompleteThreadMessages') {
      if (slackThreadExtractor && slackThreadExtractor.initialized) {
        const messages = await slackThreadExtractor.extractCompleteThreadMessages();
        console.log('Extracted complete messages:', messages);
        sendResponse({
          messages: messages
        });
      } else {
        sendResponse({
          error: 'Extension not initialized'
        });
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
        sendResponse({
          hasThread: false,
          error: 'Extension not initialized'
        });
      }
    }
  } catch (error) {
    console.error('Error in content script message handler:', error);
    sendResponse({
      error: error.message
    });
  }
});

// Add global debug function for testing
window.debugSlackExtension = function () {
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
window.forceAddButton = function () {
  if (slackThreadExtractor) {
    console.log('🔧 Force adding summary button...');
    slackThreadExtractor.buttonManager.removeExistingButtons();
    slackThreadExtractor.addSummaryButton();
  } else {
    console.log('Extension not initialized yet');
  }
};

// Add comprehensive debug function
window.debugMessageDetection = function () {
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
  const threadSelectors = ['[data-qa="threads_flexpane"] [data-qa="virtual-list-item"]', '[data-qa="threads_flexpane"] .c-virtual_list__item', '[data-qa="threads_flexpane"] .c-message_kit__message', '.p-threads_flexpane [data-qa="virtual-list-item"]', '.p-threads_flexpane .c-virtual_list__item', '.p-threads_flexpane .c-message_kit__message'];
  threadSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`  ${selector}: ${elements.length} elements`);
  });

  // 3. Test container-scoped selectors
  console.log('3. Testing Container-Scoped Selectors:');
  const containerSelectors = ['[data-qa="virtual-list-item"]', '.c-virtual_list__item', '.c-message_kit__message', '.c-message', '[data-qa="message"]'];
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
/******/ })()
;
//# sourceMappingURL=content-script.js.map