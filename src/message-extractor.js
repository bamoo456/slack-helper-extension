/**
 * Message Text Extraction Module
 * Handles extracting and formatting text content from Slack message elements
 */

export class MessageTextExtractor {
  constructor() {
    this.userNameSelectors = [
      '[data-qa="message_sender_name"]',  // 最精確的選擇器，優先使用
      '.c-message__sender_link',
      '.c-message__sender',
      '.c-message_kit__sender',
      '.c-message_kit__sender_link',
      '[data-qa="message_sender"]',
      '.p-rich_text_block .c-link'  // 最後使用，可能不夠精確
    ];
    
    this.timeSelectors = [
      '.c-timestamp',
      '[data-qa="message_timestamp"]',
      '.c-message__time'
    ];
    
    this.contentSelectors = [
      '.c-message_kit__blocks',
      '.c-message__message_blocks',
      '.p-block_kit_renderer',
      '.c-message__body',
      '.p-rich_text_section',
      '[data-qa="message_text"]',
      '.c-message__text'
    ];

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
    
    // Check for thread separator elements
    if (element.classList.contains('p-thread_separator_row_generic')) {
      return true;
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
    const invalidPatterns = [
      /^\s*$/,                    // 純空白
      /^[\d\s\.\-\+\(\)]+$/,     // 純數字和符號
      /^(reply|thread|view|show|load|more|less)$/i,  // UI 元素文本
      /^\d+\s+(replies?|people)/i,  // "5 replies", "3 people" 等
      /^(also\s+send\s+to|reply…)/i,  // Slack 系統文本
      /^[\.\,\!\?\:\;]+$/,       // 純標點符號
      /^(am|pm|at|on|in|the|and|or|but|so|also)$/i  // 常見介詞和連詞
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
    return text
      .replace(/[ \t]+/g, ' ')
      .replace(/[ ]*\n[ ]*/g, '\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();
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
    return text
      .replace(/[ \t]+/g, ' ')
      .replace(/[ ]*\n[ ]*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\n\n(\d+\.)/g, '\n$1')
      .replace(/\n\n(-)/g, '\n$1')
      .replace(/\]\s*\(\s*/g, '](')
      .replace(/\s*\)\s*/g, ') ')
      .replace(/^\s+|\s+$/g, '')
      .trim();
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
    cellText = cellText
      .replace(/\n+/g, ' ')  // Replace newlines with spaces
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/\|/g, '\\|') // Escape pipe characters
      .trim();
        
    return cellText;
  }
} 