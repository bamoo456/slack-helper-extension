/**
 * Slack DOM Detection Module
 * Handles finding and identifying Slack thread elements in the DOM
 */

export class SlackDOMDetector {
  constructor() {
    // Updated selectors based on actual Slack DOM structure
    this.threadSelectors = [
      '[data-qa="threads_flexpane"]',  // Main thread panel container
      '.p-threads_flexpane',           // Thread flexpane class
      '.p-thread_view',                // Legacy thread view
      '.p-threads_view',               // Legacy threads view
      '[data-qa="thread_view"]',       // Legacy thread view data attribute
      '.p-flexpane--iap1'              // Flexpane with specific modifier
    ];

    // Selectors for the main channel view (to avoid)
    this.channelSelectors = [
      '.p-message_pane',
      '.p-channel_sidebar',
      '.p-workspace__primary_view',
      '.c-virtual_list__scroll_container:not([data-qa="threads_flexpane"] *)',
      '.p-message_pane__foreground'
    ];

    // More specific message selectors for threads based on actual DOM
    this.threadMessageSelectors = [
      '[data-qa="threads_flexpane"] [data-qa="virtual-list-item"]',
      '[data-qa="threads_flexpane"] .c-virtual_list__item',
      '[data-qa="threads_flexpane"] .c-message_kit__message',
      '.p-threads_flexpane [data-qa="virtual-list-item"]',
      '.p-threads_flexpane .c-virtual_list__item',
      '.p-threads_flexpane .c-message_kit__message',
      '.p-thread_view [data-qa="virtual-list-item"]',
      '.p-thread_view .c-message_kit__message',
      '.p-threads_view [data-qa="virtual-list-item"]',
      '.p-threads_view .c-message_kit__message'
    ];

    // Fallback message selectors
    this.messageSelectors = [
      '[data-qa="virtual-list-item"]:has(.c-message_kit__message)',
      '.c-virtual_list__item:has(.c-message_kit__message)',
      '.c-message_kit__message',
      '.c-virtual_list__item',
      '.c-message',
      '[data-qa="message"]',
      '.c-message_kit__message_container',
      '.p-rich_text_section',
      '[data-qa="message_content"]',
      '[class*="message"]'
    ];
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
    const hasThreadTitle = element.querySelector('.p-flexpane__title_container') ||
                          element.querySelector('[data-qa="thread_header"]') ||
                          element.querySelector('.p-thread_view__header');
    
    // Secondary check: Look for thread content structure
    const hasThreadContent = element.querySelector('.c-virtual_list__scroll_container[role="list"]') ||
                             element.querySelector('[data-qa="virtual-list-item"]') ||
                             element.querySelector('.c-virtual_list__item');
    
    // Tertiary check: Look for thread-specific classes or attributes
    const hasThreadIdentifiers = element.classList.contains('p-threads_flexpane') ||
                                 element.classList.contains('p-thread_view') ||
                                 element.hasAttribute('data-qa') && element.getAttribute('data-qa').includes('thread');
    
    // Check for flexpane body (specific to thread panels)
    const hasFlexpaneBody = element.querySelector('[data-qa="flexpane_body"]') ||
                           element.classList.contains('p-flexpane__body');
    
    // A valid thread container should have:
    // 1. Basic visibility AND
    // 2. Either thread title structure OR flexpane body OR (thread content AND thread identifiers)
    const isValidThread = isInViewport && (
      hasThreadTitle || 
      hasFlexpaneBody ||
      (hasThreadContent && hasThreadIdentifiers)
    );
    
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
    const messageSelectors = [
      '[data-qa="virtual-list-item"]',
      '.c-virtual_list__item',
      '.c-message_kit__message',
      '.c-message',
      '[data-qa="message"]',
      '[class*="message"]'
    ];

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
    const fallbackSelectors = [
      '[role="listitem"]',
      '[data-qa*="message"]',
      '[class*="message"]',
      '.p-rich_text_section',
      '[data-qa="message_content"]',
      '.c-message_kit__message_container',
      'div[data-qa]', // Any div with data-qa attribute
      '.c-virtual_list__scroll_container > div', // Direct children of scroll container
      '[data-qa="flexpane_body"] > div > div' // Nested divs in flexpane body
    ];
    
    for (const selector of fallbackSelectors) {
      const elements = container.querySelectorAll(selector);
      if (elements.length > 0) {
        // Filter to only include elements that look like messages
        const messageElements = Array.from(elements).filter(el => {
          const text = el.textContent.trim();
          const hasReasonableLength = text.length > 10 && text.length < 10000;
          const hasMessageStructure = el.querySelector('.c-message_kit__message') ||
                                     el.querySelector('[data-qa="message_content"]') ||
                                     el.classList.contains('c-message') ||
                                     el.hasAttribute('data-qa') && el.getAttribute('data-qa').includes('message');
          
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
      const isValidMessage = element.querySelector('.c-message_kit__message') ||
                            element.querySelector('.c-message__content') ||
                            element.querySelector('[data-qa="message_content"]') ||
                            element.classList.contains('c-message_kit__message') ||
                            element.classList.contains('c-virtual_list__item') ||
                            element.hasAttribute('data-qa') && element.getAttribute('data-qa').includes('message');
      
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
    const inputClasses = [
      'c-texty_input',
      'ql-container',
      'ql-editor',
      'ql-clipboard',
      'ql-placeholder',
      'c-composer',
      'c-message_input',
      'p-message_input',
      'c-texty_input_unstyled'
    ];
    
    for (const className of inputClasses) {
      if (element.classList.contains(className)) {
        return true;
      }
    }
    
    // Check if element contains input-related elements
    const hasInputElements = element.querySelector('[data-qa="message_input"]') ||
                            element.querySelector('.ql-editor') ||
                            element.querySelector('.c-texty_input') ||
                            element.querySelector('[contenteditable="true"]') ||
                            element.querySelector('textarea') ||
                            element.querySelector('input[type="text"]');
    
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
    
    const fallbackSelectors = [
      '[data-qa="message"]',
      '.c-message',
      '.c-message_list__item',
      '[class*="message"]',
      '.p-rich_text_section'
    ];
    
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
    
    const headerSelectors = [
      '[data-qa="thread_header"]',
      '.p-thread_view__header',
      '.p-threads_flexpane__header',
      '.p-flexpane_header', // 添加通用的 flexpane header
      '.c-message_kit__thread_message--root',
      '.c-message_kit__message--first'
    ];
    
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
      const hasUserName = div.querySelector('[data-qa*="user"]') || 
                         div.querySelector('[class*="user"]') ||
                         div.querySelector('button[data-qa*="user"]');
      
      const hasTimestamp = div.querySelector('[data-qa*="timestamp"]') ||
                          div.querySelector('[class*="timestamp"]') ||
                          div.querySelector('time') ||
                          /\d{1,2}:\d{2}/.test(text); // Simple time pattern
      
      const hasMessageContent = div.querySelector('.p-rich_text_section') ||
                               div.querySelector('[data-qa="message_content"]') ||
                               text.length > 20; // Has substantial content
      
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
      console.log(`🎯 Found ${potentialMessages.length} potential messages with aggressive fallback:`, 
        potentialMessages.slice(0, 5).map(m => ({ score: m.score, text: m.text })));
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