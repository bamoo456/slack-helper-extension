/**
 * Slack Message Formatter
 * Handles conversion of Slack's rich text HTML to Markdown format
 */

export class SlackMessageFormatter {
  /**
   * Extract text from input element while preserving formatting
   */
  static extractTextFromInput(inputElement) {
    if (!inputElement) return '';

    // For regular input/textarea elements
    if (inputElement.tagName === 'TEXTAREA' || inputElement.tagName === 'INPUT') {
      const value = inputElement.value || '';
      return value;
    }

    // For contenteditable elements (like Slack's rich text editor)
    if (inputElement.contentEditable === 'true') {
      const extractedText = this.extractFormattedText(inputElement);
      console.log('Slack Message Formatter: Extracted text with formatting:', extractedText);
      return extractedText;
    }

    // Fallback to textContent
    const fallbackText = inputElement.textContent || '';
    return fallbackText;
  }

  /**
   * Extract formatted text from contenteditable element and convert to Markdown
   * Preserves line breaks, emojis, mentions, code blocks, and links
   */
  static extractFormattedText(element) {
    // For Slack's Quill editor, we need to handle the specific structure and convert to Markdown
    const html = element.innerHTML;
    
    // Create a temporary element to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    let text = '';
    let isFirstParagraph = true;
    
    // Process each child node (mainly <p> tags in Slack)
    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        
        switch (tagName) {
          case 'p':
            return this._processParagraph(node, isFirstParagraph);
            
          case 'br':
            // Skip standalone <br> in paragraphs - they're handled by paragraph logic
            return '';
            
          case 'ts-mention':
            return this._processMention(node);
            
          case 'code':
            return this._processInlineCode(node);
            
          case 'a':
            return this._processLink(node);
            
          case 'div':
            return this._processDiv(node);
            
          case 'img':
            return this._processImage(node);
            
          case 'span':
            return this._processSpan(node);
            
          default:
            // For other elements, process children
            let defaultContent = '';
            for (const child of node.childNodes) {
              defaultContent += processNode(child);
            }
            return defaultContent;
        }
      }
      return '';
    };
    
    // Process all child nodes
    for (const child of tempDiv.childNodes) {
      const childResult = processNode(child);
      text += childResult;
      
      // Update isFirstParagraph flag after processing first paragraph
      if (child.nodeType === Node.ELEMENT_NODE && 
          child.tagName.toLowerCase() === 'p' && 
          isFirstParagraph) {
        isFirstParagraph = false;
      }
    }
    
    // Clean up the text - be more conservative with line break removal
    text = text
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ consecutive line breaks with 2
      .replace(/^\n+/, '') // Remove leading line breaks
      .replace(/\n+$/, ''); // Remove trailing line breaks
    
    console.log('Slack Message Formatter: Extracted formatted text with Markdown:', JSON.stringify(text));
    
    // If we didn't get good results, fall back to simpler method
    if (!text || text.length < 3) {
      return this._simpleTextExtraction(element);
    }
    
    return text;
  }

  /**
   * Process paragraph elements
   */
  static _processParagraph(node, isFirstParagraph) {
    let paragraphContent = '';
    let hasRealContent = false;
    let isEmptyParagraph = false;
    
    // Check if this paragraph only contains <br> (empty paragraph)
    if (node.childNodes.length === 1 && 
        node.childNodes[0].nodeType === Node.ELEMENT_NODE && 
        node.childNodes[0].tagName.toLowerCase() === 'br') {
      isEmptyParagraph = true;
    }
    
    for (const child of node.childNodes) {
      const childContent = this._processNode(child);
      paragraphContent += childContent;
      
      // Check if this paragraph has real content (not just <br>)
      if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
        hasRealContent = true;
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() !== 'br') {
        hasRealContent = true;
      }
    }
    
    // Handle different paragraph types:
    if (isFirstParagraph) {
      // First paragraph - no leading line break
      return paragraphContent;
    } else if (isEmptyParagraph) {
      // Empty paragraph (only <br>) - represents a blank line
      return '\n';
    } else if (hasRealContent || paragraphContent.trim()) {
      // Paragraph with content - add line break before it
      return '\n' + paragraphContent;
    } else {
      // Empty paragraph without <br> - just add line break
      return '\n';
    }
  }

  /**
   * Process mention elements
   */
  static _processMention(node) {
    // Handle Slack mentions - convert to @username format
    const mentionLabel = node.getAttribute('data-label');
    if (mentionLabel) {
      return mentionLabel; // This already includes the @ symbol
    }
    // Fallback to text content
    return node.textContent || '';
  }

  /**
   * Process inline code elements
   */
  static _processInlineCode(node) {
    // Handle inline code - convert to markdown backticks
    const codeContent = node.textContent || '';
    return '`' + codeContent + '`';
  }

  /**
   * Process link elements
   */
  static _processLink(node) {
    // Handle hyperlinks - convert to markdown link format
    const linkText = node.textContent || '';
    const linkHref = node.getAttribute('href') || '';
    if (linkHref && linkText) {
      return `[${linkText}](${linkHref})`;
    }
    // If no href or text, just return the text content
    return linkText;
  }

  /**
   * Process div elements
   */
  static _processDiv(node) {
    // Handle code blocks
    const className = node.className || '';
    if (className.includes('ql-code-block')) {
      const codeBlockContent = node.textContent || '';
      // Add proper line breaks for code blocks
      return '\n```\n' + codeBlockContent + '\n```\n';
    }
    
    // Regular div, process children
    let divContent = '';
    for (const child of node.childNodes) {
      divContent += this._processNode(child);
    }
    return divContent;
  }

  /**
   * Process image elements (mainly emojis)
   */
  static _processImage(node) {
    // Handle emoji images - prioritize data-stringify-text
    const stringifyText = node.getAttribute('data-stringify-text');
    const dataTitle = node.getAttribute('data-title');
    const alt = node.getAttribute('alt');
    const title = node.getAttribute('title');
    const dataEmoji = node.getAttribute('data-emoji');
    const ariaLabel = node.getAttribute('aria-label');
    
    return stringifyText || dataTitle || dataEmoji || alt || title || ariaLabel || '';
  }

  /**
   * Process span elements (mainly emojis)
   */
  static _processSpan(node) {
    // Check if it's an emoji span
    const emojiData = node.getAttribute('data-emoji');
    if (emojiData) {
      return emojiData;
    }
    
    // Check for emoji class or other indicators
    const spanClassName = node.className || '';
    if (spanClassName.includes('emoji') || spanClassName.includes('emoticon')) {
      const spanStringify = node.getAttribute('data-stringify-text');
      const spanText = spanStringify || node.textContent || node.getAttribute('title') || node.getAttribute('aria-label') || '';
      return spanText;
    }
    
    // Regular span, process children
    let spanContent = '';
    for (const child of node.childNodes) {
      spanContent += this._processNode(child);
    }
    return spanContent;
  }

  /**
   * Process a single node recursively
   */
  static _processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      
      switch (tagName) {
        case 'ts-mention':
          return this._processMention(node);
        case 'code':
          return this._processInlineCode(node);
        case 'a':
          return this._processLink(node);
        case 'div':
          return this._processDiv(node);
        case 'img':
          return this._processImage(node);
        case 'span':
          return this._processSpan(node);
        case 'br':
          return '';
        default:
          // For other elements, process children
          let defaultContent = '';
          for (const child of node.childNodes) {
            defaultContent += this._processNode(child);
          }
          return defaultContent;
      }
    }
    return '';
  }

  /**
   * Convert Markdown text back to Slack HTML format
   * This is used when replacing text in the input after LLM processing
   */
  static convertMarkdownToSlackHtml(markdownText) {
    if (!markdownText) return '';
    
    let html = markdownText;
    
    // Convert code blocks first (to avoid conflicts with inline code)
    html = html.replace(/```\n?([\s\S]*?)\n?```/g, (match, code) => {
      return `<div class="ql-code-block">${this._escapeHtml(code.trim())}</div>`;
    });
    
    // Convert inline code
    html = html.replace(/`([^`]+)`/g, (match, code) => {
      return `<code>${this._escapeHtml(code)}</code>`;
    });
    
    // Convert links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      return `<a href="${this._escapeHtml(url)}" rel="noopener noreferrer" target="_blank">${this._escapeHtml(text)}</a>`;
    });
    
    // Convert mentions (keep as-is since they're already in @username format)
    // Mentions don't need conversion as they'll be handled by Slack's mention system
    
    // Split by lines and wrap in paragraphs
    const lines = html.split('\n');
    const paragraphs = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line === '') {
        // Empty line - create empty paragraph with <br>
        paragraphs.push('<p><br></p>');
      } else if (line.startsWith('<div class="ql-code-block">')) {
        // Code block - add as-is (already processed above)
        paragraphs.push(line);
      } else {
        // Regular content - wrap in paragraph
        paragraphs.push(`<p>${line}</p>`);
      }
    }
    
    return paragraphs.join('');
  }
  
  /**
   * Update Slack input element with formatted HTML content
   */
  static updateSlackInput(inputElement, markdownText) {
    if (!inputElement || !markdownText) return false;
    
    try {
      // Convert markdown to Slack HTML format
      const slackHtml = this.convertMarkdownToSlackHtml(markdownText);
      
      // Handle different types of input elements
      if (inputElement.contentEditable === 'true') {
        // For contenteditable elements (Slack's rich text editor)
        this._updateContentEditableElement(inputElement, slackHtml);
        return true;
      } else if (inputElement.tagName === 'TEXTAREA' || inputElement.tagName === 'INPUT') {
        // For regular input/textarea elements - just use plain text
        inputElement.value = markdownText;
        
        // Trigger events
        const inputEvent = new Event('input', { bubbles: true });
        const changeEvent = new Event('change', { bubbles: true });
        inputElement.dispatchEvent(inputEvent);
        inputElement.dispatchEvent(changeEvent);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating Slack input:', error);
      return false;
    }
  }
  
  /**
   * Update contenteditable element with HTML content
   */
  static _updateContentEditableElement(element, htmlContent) {
    // Remove the ql-blank class if it exists
    element.classList.remove('ql-blank');
    
    // Set the HTML content
    element.innerHTML = htmlContent;
    
    // If no content was added, add an empty paragraph
    if (!element.hasChildNodes()) {
      const emptyP = document.createElement('p');
      emptyP.appendChild(document.createElement('br'));
      element.appendChild(emptyP);
    }
    
    // Trigger input events to notify Slack
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
    
    element.dispatchEvent(inputEvent);
    element.dispatchEvent(changeEvent);
    
    // Also trigger on the parent container if it's a message input
    const container = element.closest('[data-qa="message_input"]');
    if (container) {
      container.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Move cursor to end
    this._moveCursorToEnd(element);
    
    // Focus the element
    element.focus();
    
    console.log('Updated Slack input with formatted HTML:', htmlContent);
  }
  
  /**
   * Move cursor to end of contenteditable element
   */
  static _moveCursorToEnd(element) {
    try {
      const range = document.createRange();
      const selection = window.getSelection();
      
      range.selectNodeContents(element);
      range.collapse(false);
      
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (error) {
      console.warn('Could not move cursor to end:', error);
    }
  }
  
  /**
   * Escape HTML characters
   */
  static _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Simple text extraction fallback
   */
  static _simpleTextExtraction(element) {
    // Use innerText if available (preserves line breaks better than textContent)
    if (element.innerText !== undefined) {
      return element.innerText;
    }
    
    // Fallback to textContent
    return element.textContent || '';
  }
} 