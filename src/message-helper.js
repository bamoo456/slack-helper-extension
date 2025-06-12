/**
 * Slack Input Enhancer Module
 * Handles detection of Slack input areas and adds enhancement buttons
 */

import { llmService } from './llm-service.js';

export class MessageHelper {
  constructor() {
    this.inputSelectors = [
      '[data-qa="message_input"]',
      '.c-texty_input_unstyled',
      '.ql-editor[role="textbox"]',
      '.c-texty_input__container [contenteditable="true"]'
    ];
    
    this.toolbarSelectors = [
      '.c-wysiwyg_container__formatting',
      '.c-composer__formatting',
      '.p-composer__formatting',
      '[data-qa="formatting_toolbar"]',
      '[role="toolbar"]',
      '.c-button_kit__button_group'
    ];
    
    this.observedInputs = new Set();
    this.toolbarButtonInstances = new Map();
    this.currentDropdown = null;
    this.currentPreview = null;
    this.currentBackdrop = null;
    this.previewInputElement = null;
    this.previewProcessedText = null;
    this.initialized = false;
    this.translations = null;
    
    this.handleClickOutside = this.handleClickOutside.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    
    this.loadStyles();
    this.loadTranslations();
  }

  /**
   * Load CSS styles for the input enhancer
   */
  loadStyles() {
    if (document.querySelector('#slack-message-helper-styles')) {
      return;
    }

    const link = document.createElement('link');
    link.id = 'slack-message-helper-styles';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = chrome.runtime.getURL('src/message-helper.css');
    
    document.head.appendChild(link);
  }

  /**
   * Load translations for the message helper
   */
  async loadTranslations() {
    try {
      // Get saved language preference
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['selectedLanguage'], resolve);
      });
      
      const language = result.selectedLanguage || 'zh-TW';
      const translationUrl = chrome.runtime.getURL(`locales/${language}/translation.json`);
      
      const response = await fetch(translationUrl);
      const translations = await response.json();
      
      this.translations = translations.messageHelper || {};
      console.log('Message helper translations loaded:', language);
    } catch (error) {
      console.error('Failed to load message helper translations:', error);
      // Fallback to default translations
      this.translations = {
        refineMessage: 'Refine Message',
        customPromptPlaceholder: 'Modify with a prompt... (Ctrl+Enter to apply)',
        rephrase: 'Rephrase',
        refine: 'Refine',
        fixGrammar: 'Fix grammar',
        pleaseTypeMessage: 'Please type a message first before applying custom prompt.',
        pleaseTypeMessageBeforeRefining: 'Please type a message first before refining it.',
        errorProcessingRequest: 'Error processing your request',
        rephrasing: 'Rephrasing your message...',
        refining: 'Refining your message for better quality and clarity...',
        fixingGrammar: 'Fixing grammar and spelling...',
        processingCustomPrompt: 'Processing with custom prompt...',
        processing: 'Processing...',
        customPrompt: 'Custom Prompt',
        original: 'Original:',
        result: 'Result:',
        copy: '📋 Copy',
        replace: '✅ Replace',
        copiedToClipboard: 'Copied to clipboard!',
        failedToCopy: 'Failed to copy',
        textReplaced: 'Text replaced!',
        unknownAction: 'Unknown action selected.'
      };
    }
  }

  /**
   * Get translation text with fallback
   */
  t(key, fallback = '') {
    return this.translations?.[key] || fallback || key;
  }

  /**
   * Initialize the input enhancer
   */
  async init() {
    if (this.initialized) return;
    
    this.startObserving();
    this.processExistingInputs();
    this.setupLanguageChangeListener();
    
    // Initialize LLM service
    await this.initializeLLMService();
    
    this.initialized = true;
  }

  /**
   * Initialize LLM service
   */
  async initializeLLMService() {
    try {
      // Load LLM configuration
      await llmService.loadConfiguration();
      console.log('LLM service initialized for message helper');
    } catch (error) {
      console.error('Failed to initialize LLM service:', error);
    }
  }

  /**
   * Setup language change listener
   */
  setupLanguageChangeListener() {
    // Listen for language changes in Chrome storage
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.selectedLanguage) {
        console.log('Language changed, reloading translations...');
        this.loadTranslations().then(() => {
          this.updateExistingUIElements();
        });
      }
      
      // Listen for LLM settings changes
      if (namespace === 'local' && changes.llmSettings) {
        console.log('LLM settings changed, reloading configuration...');
        this.initializeLLMService();
      }
    });
  }

  /**
   * Update existing UI elements with new translations
   */
  updateExistingUIElements() {
    // Update all existing toolbar buttons
    this.toolbarButtonInstances.forEach((button, toolbar) => {
      if (button && button.parentElement) {
        button.setAttribute('aria-label', this.t('refineMessage', 'Refine Message'));
        button.setAttribute('title', this.t('refineMessage', 'Refine Message'));
      }
    });

    // Update current dropdown if it exists
    if (this.currentDropdown) {
      this.updateDropdownTexts();
    }

    // Update current preview if it exists
    if (this.currentPreview) {
      this.updatePreviewTexts();
    }
  }

  /**
   * Update dropdown texts with new translations
   */
  updateDropdownTexts() {
    if (!this.currentDropdown) return;

    // Update custom prompt placeholder
    const textarea = this.currentDropdown.querySelector('.slack-helper-custom-prompt-input');
    if (textarea) {
      textarea.placeholder = this.t('customPromptPlaceholder', 'Modify with a prompt... (Ctrl+Enter to apply)');
    }

    // Update menu items
    const menuItems = this.currentDropdown.querySelectorAll('.slack-helper-dropdown-item');
    const menuTexts = [
      this.t('rephrase', 'Rephrase'),
      this.t('refine', 'Refine'),
      this.t('fixGrammar', 'Fix grammar')
    ];

    menuItems.forEach((item, index) => {
      const titleElement = item.querySelector('.slack-helper-dropdown-title');
      if (titleElement && menuTexts[index]) {
        titleElement.textContent = menuTexts[index];
      }
    });
  }

  /**
   * Update preview texts with new translations
   */
  updatePreviewTexts() {
    if (!this.currentPreview) return;

    // Update section labels
    const originalLabel = this.currentPreview.querySelector('.slack-helper-preview-section:first-of-type .slack-helper-preview-label');
    if (originalLabel) {
      originalLabel.textContent = this.t('original', 'Original:');
    }

    const resultLabel = this.currentPreview.querySelector('.slack-helper-preview-section:last-of-type .slack-helper-preview-label');
    if (resultLabel) {
      resultLabel.textContent = this.t('result', 'Result:');
    }

    // Update action buttons
    const copyBtn = this.currentPreview.querySelector('[data-action="copy"]');
    if (copyBtn) {
      copyBtn.textContent = this.t('copy', '📋 Copy');
    }

    const replaceBtn = this.currentPreview.querySelector('[data-action="replace"]');
    if (replaceBtn) {
      replaceBtn.textContent = this.t('replace', '✅ Replace');
    }
  }

  /**
   * Start observing for new input elements
   */
  startObserving() {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.processNewElement(node);
            }
          });
        }
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Process existing input elements on the page
   */
  processExistingInputs() {
    const inputs = this.findAllInputElements();
    inputs.forEach(input => this.enhanceInput(input));
  }

  /**
   * Process a newly added element
   */
  processNewElement(element) {
    if (this.isInputElement(element)) {
      this.enhanceInput(element);
      return;
    }

    const inputs = element.querySelectorAll(this.inputSelectors.join(', '));
    inputs.forEach(input => this.enhanceInput(input));
  }

  /**
   * Find all input elements on the page
   */
  findAllInputElements() {
    const inputs = [];
    
    this.inputSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (this.isValidInputElement(element)) {
          inputs.push(element);
        }
      });
    });

    return [...new Set(inputs)];
  }

  /**
   * Check if an element is an input element
   */
  isInputElement(element) {
    return this.inputSelectors.some(selector => {
      try {
        return element.matches(selector);
      } catch (e) {
        return false;
      }
    });
  }

  /**
   * Check if an input element is valid for enhancement
   */
  isValidInputElement(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    const isMessageInput = element.hasAttribute('data-qa') && 
                          element.getAttribute('data-qa').includes('message_input');
    
    const hasMessageContext = element.hasAttribute('data-channel-id') ||
                             element.hasAttribute('data-view-context') ||
                             element.closest('[data-qa*="message"]');

    const isContentEditable = element.contentEditable === 'true' ||
                              element.hasAttribute('contenteditable');

    return (isMessageInput || hasMessageContext) && isContentEditable;
  }

  /**
   * Enhance an input element with the refine message button
   */
  enhanceInput(inputElement) {
    if (this.observedInputs.has(inputElement)) {
      return;
    }

    const toolbar = this.findToolbarForInput(inputElement);
    if (toolbar) {
      this.showRefineButtonInToolbar(toolbar);
      this.observedInputs.add(inputElement);
    }
  }

  /**
   * Find the toolbar element for an input
   */
  findToolbarForInput(inputElement) {
    const composer = inputElement.closest('[data-qa*="composer"]') || 
                    inputElement.closest('.c-composer') ||
                    inputElement.closest('.p-composer') ||
                    inputElement.closest('.c-texty_input_unstyled__container');
    
    if (!composer) return null;

    // Look for toolbar within the composer
    for (const selector of this.toolbarSelectors) {
      const toolbar = composer.querySelector(selector) || 
                     composer.parentElement?.querySelector(selector);
      
      if (toolbar && this.isToolbarVisible(toolbar)) {
        return toolbar;
      }
    }

    return null;
  }

  /**
   * Check if toolbar is visible and usable
   */
  isToolbarVisible(toolbar) {
    const rect = toolbar.getBoundingClientRect();
    const style = getComputedStyle(toolbar);
    
    return rect.width > 0 && rect.height > 0 && 
           style.display !== 'none' && 
           style.visibility !== 'hidden' &&
           style.opacity !== '0';
  }

  /**
   * Show the refine message button in toolbar
   */
  showRefineButtonInToolbar(toolbar) {
    // Check if button already exists
    if (this.toolbarButtonInstances.has(toolbar)) {
      const button = this.toolbarButtonInstances.get(toolbar);
      if (button?.parentElement) {
        button.classList.remove('slack-helper-hidden');
        button.classList.add('slack-helper-visible');
        return;
      }
    }

    const button = this.createToolbarRefineButton();
    const insertPosition = this.findToolbarInsertPosition(toolbar);
    
    if (insertPosition) {
      insertPosition.appendChild(button);
      this.toolbarButtonInstances.set(toolbar, button);
    }
  }

  /**
   * Create the refine message button for toolbar
   */
  createToolbarRefineButton() {
    const button = document.createElement('button');
    button.className = 'c-button-unstyled c-icon_button c-icon_button--size_small slack-helper-refine-btn-toolbar';
    button.type = 'button';
    button.setAttribute('aria-label', this.t('refineMessage', 'Refine Message'));
    button.setAttribute('title', this.t('refineMessage', 'Refine Message'));
    
    // Create SVG icon
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('aria-hidden', 'true');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('d', 'M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2zM5.25 6a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75zm7.5 0a.75.75 0 0 1 .75-.75H15a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75zM10 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM7 10a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm-1.25 4a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75zm7.5 0a.75.75 0 0 1 .75-.75H15a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75zM10 15.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75z');
    path.setAttribute('clip-rule', 'evenodd');
    
    svg.appendChild(path);
    button.appendChild(svg);

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleRefineClick(button);
    });

    return button;
  }

  /**
   * Find the best position to insert the button in toolbar
   */
  findToolbarInsertPosition(toolbar) {
    let rightWrapper = toolbar.querySelector('.slack-helper-right-wrapper');
    if (!rightWrapper) {
      rightWrapper = document.createElement('div');
      rightWrapper.className = 'slack-helper-right-wrapper';
      toolbar.appendChild(rightWrapper);
    }
    
    return rightWrapper;
  }

  /**
   * Handle refine button click
   */
  handleRefineClick(button) {
    if (this.currentDropdown) {
      this.hideRefineDropdown();
    } else {
      this.showRefineDropdown(button);
    }
  }

  /**
   * Show the refine dropdown menu
   */
  showRefineDropdown(button) {
    const dropdown = document.createElement('div');
    dropdown.className = 'slack-helper-refine-dropdown slack-helper-refine-dropdown-expanded';

    // Create custom prompt input
    const inputContainer = this.createPromptInput(button);
    dropdown.appendChild(inputContainer);

    // Create menu items
    const menuItems = [
      { icon: '✏️', text: this.t('rephrase', 'Rephrase') },
      { icon: '✨', text: this.t('refine', 'Refine') },
      { icon: '🔧', text: this.t('fixGrammar', 'Fix grammar') }
    ];

    menuItems.forEach(item => {
      const menuItem = this.createMenuItem(item, button);
      dropdown.appendChild(menuItem);
    });

    // Position and show dropdown
    const buttonParent = button.parentElement;
    if (getComputedStyle(buttonParent).position === 'static') {
      buttonParent.classList.add('slack-helper-relative');
    }

    buttonParent.appendChild(dropdown);
    this.currentDropdown = dropdown;

    // Add event listeners
    setTimeout(() => {
      document.addEventListener('click', this.handleClickOutside);
      document.addEventListener('keydown', this.handleKeyDown);
    }, 0);
  }

  /**
   * Create prompt input container
   */
  createPromptInput(button) {
    const inputContainer = document.createElement('div');
    inputContainer.className = 'slack-helper-custom-prompt-container';
    
    const textarea = document.createElement('textarea');
    textarea.className = 'slack-helper-custom-prompt-input';
    textarea.placeholder = this.t('customPromptPlaceholder', 'Modify with a prompt... (Ctrl+Enter to apply)');
    textarea.rows = 3;
    
    // Add event handlers
    this.addTextareaEventHandlers(textarea, button);
    
    inputContainer.appendChild(textarea);
    
    // Focus textarea
    setTimeout(() => textarea.focus(), 150);
    
    return inputContainer;
  }

  /**
   * Add event handlers to textarea
   */
  addTextareaEventHandlers(textarea, button) {
    const stopPropagation = (e) => e.stopPropagation();
    
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.hideRefineDropdown();
        return;
      }
      
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        const customPrompt = textarea.value.trim();
        if (customPrompt) {
          this.handleCustomPrompt(customPrompt, button).then(() => {
          this.hideRefineDropdown();
          }).catch((error) => {
            console.error('Error handling custom prompt:', error);
            this.hideRefineDropdown();
          });
        } else {
          textarea.focus();
        }
        return;
      }
      
      stopPropagation(e);
    });
    
    // Handle focus and blur events
    textarea.addEventListener('focus', stopPropagation);
    textarea.addEventListener('blur', stopPropagation);
    
    ['keypress', 'keyup', 'input', 'click'].forEach(eventType => {
      textarea.addEventListener(eventType, stopPropagation);
    });
  }

  /**
   * Create menu item
   */
  createMenuItem(item, button) {
    const menuItem = document.createElement('div');
    menuItem.className = 'slack-helper-dropdown-item';

    menuItem.innerHTML = `
      <span class="slack-helper-dropdown-icon">${item.icon}</span>
      <div class="slack-helper-dropdown-text">
        <div class="slack-helper-dropdown-title">${item.text}</div>
      </div>
    `;

    menuItem.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleRefineAction(item.text, button);
      this.hideRefineDropdown();
    });

    return menuItem;
  }

  /**
   * Handle custom prompt action
   */
  async handleCustomPrompt(customPrompt, button) {
    const inputElement = this.findInputForButton(button);
    if (!inputElement) return;

    const currentText = this.extractTextFromInput(inputElement);
    
    if (!currentText.trim()) {
      alert(this.t('pleaseTypeMessage', 'Please type a message first before applying custom prompt.'));
      return;
    }

    try {
      // Show loading state
      this.showLoadingState(button, this.t('processingCustomPrompt', 'Processing with custom prompt...'));
      
      // Process text with LLM service
      const processedText = await llmService.processText(currentText, 'custom', customPrompt);
      
      // Hide loading state
      this.hideLoadingState(button);
      
      // Show result preview
      this.showResultPreview(inputElement, currentText, processedText, this.t('customPrompt', 'Custom Prompt'), customPrompt);
      
    } catch (error) {
      console.error('Error processing custom prompt:', error);
      this.hideLoadingState(button);
      alert(`${this.t('errorProcessingRequest', 'Error processing your request')}: ${error.message}`);
    }
  }

  /**
   * Hide the refine dropdown menu
   */
  hideRefineDropdown() {
    if (!this.currentDropdown) return;
    
    document.removeEventListener('click', this.handleClickOutside);
    document.removeEventListener('keydown', this.handleKeyDown);
    
    this.currentDropdown.classList.remove('slack-helper-refine-dropdown-expanded');
    
    setTimeout(() => {
      if (this.currentDropdown) {
        this.currentDropdown.remove();
        this.currentDropdown = null;
      }
    }, 100);
  }

  /**
   * Handle click outside dropdown to close it
   */
  handleClickOutside(event) {
    if (this.currentDropdown && !this.currentDropdown.contains(event.target)) {
      const isRefineButton = event.target.closest('.slack-helper-refine-btn-toolbar');
      
      // Only close if refine button clicked again (toggle behavior)
      if (isRefineButton) {
        this.hideRefineDropdown();
      }
      // All other outside clicks are ignored
    }
  }

  /**
   * Handle keyboard events for dropdown
   */
  handleKeyDown(event) {
    if (this.currentDropdown && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.hideRefineDropdown();
    }
  }

  /**
   * Handle refine action selection
   */
  async handleRefineAction(action, button) {
    const inputElement = this.findInputForButton(button);
    if (!inputElement) return;

    const currentText = this.extractTextFromInput(inputElement);
    
    if (!currentText.trim()) {
      alert(this.t('pleaseTypeMessageBeforeRefining', 'Please type a message first before refining it.'));
      return;
    }

    const actionMap = {
      [this.t('rephrase', 'Rephrase')]: { action: 'rephrase', message: this.t('rephrasing', 'Rephrasing your message...') },
      [this.t('refine', 'Refine')]: { action: 'refine', message: this.t('refining', 'Refining your message for better quality and clarity...') },
      [this.t('fixGrammar', 'Fix grammar')]: { action: 'fix_grammar', message: this.t('fixingGrammar', 'Fixing grammar and spelling...') }
    };

    const actionConfig = actionMap[action];
    if (!actionConfig) {
      alert(this.t('unknownAction', 'Unknown action selected.'));
      return;
    }

    try {
      // Show loading state
      this.showLoadingState(button, actionConfig.message);
      
      // Process text with LLM service
      const processedText = await llmService.processText(currentText, actionConfig.action);
      
      // Hide loading state
      this.hideLoadingState(button);
      
      // Show result preview
      this.showResultPreview(inputElement, currentText, processedText, action);
      
    } catch (error) {
      console.error('Error processing refine action:', error);
      this.hideLoadingState(button);
      alert(`${this.t('errorProcessingRequest', 'Error processing your request')}: ${error.message}`);
    }
  }

  /**
   * Find the input element associated with a button
   */
  findInputForButton(button) {
    const toolbar = button.closest('.c-wysiwyg_container__formatting') ||
                   button.closest('[role="toolbar"]') ||
                   button.closest('.slack-helper-right-wrapper')?.parentElement;
    
    if (!toolbar) return null;

    const composer = toolbar.closest('[data-qa*="composer"]') ||
                     toolbar.closest('.c-composer') ||
                     toolbar.closest('.p-composer') ||
                     toolbar.parentElement;

    if (!composer) return null;

    for (const selector of this.inputSelectors) {
      const input = composer.querySelector(selector);
      if (input) {
        // If we found a Quill container, try to find the actual editor
        if (input.classList.contains('ql-container') || input.classList.contains('c-texty_input_unstyled')) {
          const quillEditor = input.querySelector('.ql-editor');
          if (quillEditor) {
            return quillEditor; // Return the actual editor element
          }
        }
        return input;
      }
    }

    return null;
  }

  /**
   * Extract text from input element while preserving formatting
   */
  extractTextFromInput(inputElement) {
    if (!inputElement) return '';

    // For regular input/textarea elements
    if (inputElement.tagName === 'TEXTAREA' || inputElement.tagName === 'INPUT') {
      const value = inputElement.value || '';
      return value;
    }

    // For contenteditable elements (like Slack's rich text editor)
    if (inputElement.contentEditable === 'true') {
      const extractedText = this.extractFormattedText(inputElement);
      console.log('Message Helper: Extracted text with formatting:', extractedText);
      return extractedText;
    }

    // Fallback to textContent
    const fallbackText = inputElement.textContent || '';
    return fallbackText;
  }

  /**
   * Extract formatted text from contenteditable element
   * Preserves line breaks and emojis
   */
  extractFormattedText(element) {
    // For Slack's Quill editor, we need to handle the specific structure
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
            // Process paragraph content
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
              const childContent = processNode(child);
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
              isFirstParagraph = false;
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
            
          case 'br':
            // Skip standalone <br> in paragraphs - they're handled by paragraph logic
            return '';
            
          case 'img':
            // Handle emoji images - prioritize data-stringify-text
            const stringifyText = node.getAttribute('data-stringify-text');
            const dataTitle = node.getAttribute('data-title');
            const alt = node.getAttribute('alt');
            const title = node.getAttribute('title');
            const dataEmoji = node.getAttribute('data-emoji');
            const ariaLabel = node.getAttribute('aria-label');
            
            return stringifyText || dataTitle || dataEmoji || alt || title || ariaLabel || '';
            
          case 'span':
            // Check if it's an emoji span
            const emojiData = node.getAttribute('data-emoji');
            if (emojiData) {
              return emojiData;
            }
            
            // Check for emoji class or other indicators
            const className = node.className || '';
            if (className.includes('emoji') || className.includes('emoticon')) {
              const spanStringify = node.getAttribute('data-stringify-text');
              const spanText = spanStringify || node.textContent || node.getAttribute('title') || node.getAttribute('aria-label') || '';
              return spanText;
            }
            
            // Regular span, process children
            let spanContent = '';
            for (const child of node.childNodes) {
              spanContent += processNode(child);
            }
            return spanContent;
            
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
      text += processNode(child);
    }
    
    // Clean up the text - be more conservative with line break removal
    text = text
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ consecutive line breaks with 2
      .replace(/^\n+/, '') // Remove leading line breaks
      .replace(/\n+$/, ''); // Remove trailing line breaks
    
    console.log('Message Helper: Extracted formatted text:', JSON.stringify(text));
    
    // If we didn't get good results, fall back to simpler method
    if (!text || text.length < 3) {
      return this.simpleTextExtraction(element);
    }
    
    return text;
  }

  /**
   * Simple text extraction fallback
   */
  simpleTextExtraction(element) {
    // Use innerText if available (preserves line breaks better than textContent)
    if (element.innerText !== undefined) {
      return element.innerText;
    }
    
    // Fallback to textContent
    return element.textContent || '';
  }

  /**
   * Show loading state on button
   */
  showLoadingState(button, message = null) {
    if (!message) {
      message = this.t('processing', 'Processing...');
    }
    // Store original content
    if (!button.dataset.originalContent) {
      button.dataset.originalContent = button.innerHTML;
    }
    
    // Show loading spinner
    button.innerHTML = `
      <svg viewBox="0 0 20 20" aria-hidden="true" style="animation: spin 1s linear infinite;">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/>
        <path d="M10 2 A8 8 0 0 1 18 10" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
    `;
    
    button.disabled = true;
    button.setAttribute('title', message);
    
    // Add loading styles
    if (!document.querySelector('#slack-helper-loading-styles')) {
      const style = document.createElement('style');
      style.id = 'slack-helper-loading-styles';
      style.textContent = `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Hide loading state on button
   */
  hideLoadingState(button) {
    if (button.dataset.originalContent) {
      button.innerHTML = button.dataset.originalContent;
      delete button.dataset.originalContent;
    }
    
    button.disabled = false;
    button.setAttribute('title', this.t('refineMessage', 'Refine Message'));
  }

  /**
   * Update input text content
   */
  updateInputText(inputElement, newText) {
    if (!inputElement || !newText) return;

    // Handle different types of input elements
    if (inputElement.contentEditable === 'true') {
      // Check if this is already a Quill editor (.ql-editor)
      if (inputElement.classList.contains('ql-editor')) {
        // This is the actual Quill editor element
        this.updateQuillEditor(inputElement, newText);
      } else {
        // Check if this contains a Quill editor (Slack's message input container)
        const quillEditor = inputElement.querySelector('.ql-editor');
        if (quillEditor) {
          // Handle Quill editor specifically
          this.updateQuillEditor(quillEditor, newText);
        } else {
          // For regular contenteditable elements
          inputElement.textContent = newText;
          
          // Trigger input events to notify Slack
          const inputEvent = new Event('input', { bubbles: true });
          inputElement.dispatchEvent(inputEvent);
          
          // Move cursor to end
          this.moveCursorToEnd(inputElement);
        }
      }
    } else if (inputElement.tagName === 'TEXTAREA' || inputElement.tagName === 'INPUT') {
      // For regular input/textarea elements
      inputElement.value = newText;
      
      // Trigger change events
      const changeEvent = new Event('change', { bubbles: true });
      const inputEvent = new Event('input', { bubbles: true });
      inputElement.dispatchEvent(inputEvent);
      inputElement.dispatchEvent(changeEvent);
      
      // Move cursor to end
      inputElement.selectionStart = inputElement.selectionEnd = newText.length;
    }

    // Focus the input element
    inputElement.focus();
  }

  /**
   * Update Quill editor content (used by Slack)
   */
  updateQuillEditor(quillEditor, newText) {
    try {
      // Remove the ql-blank class if it exists
      quillEditor.classList.remove('ql-blank');
      
      // Clear existing content
      quillEditor.innerHTML = '';
      
      // Split text by lines and create appropriate elements
      const lines = newText.split('\n');
      
      // Create paragraph elements for each line
      lines.forEach((line, index) => {
        if (line.trim()) {
          // Create a paragraph for non-empty lines
          const paragraph = document.createElement('p');
          paragraph.textContent = line;
          quillEditor.appendChild(paragraph);
        } else {
          // Create empty paragraph for empty lines
          const emptyP = document.createElement('p');
          emptyP.appendChild(document.createElement('br'));
          quillEditor.appendChild(emptyP);
        }
      });
      
      // If no content was added, add an empty paragraph
      if (!quillEditor.hasChildNodes()) {
        const emptyP = document.createElement('p');
        emptyP.appendChild(document.createElement('br'));
        quillEditor.appendChild(emptyP);
      }
      
      // Trigger input events to notify Slack
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      const changeEvent = new Event('change', { bubbles: true, cancelable: true });
      
      quillEditor.dispatchEvent(inputEvent);
      quillEditor.dispatchEvent(changeEvent);
      
      // Also trigger on the parent container
      const container = quillEditor.closest('[data-qa="message_input"]');
      if (container) {
        container.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      // Move cursor to end
      this.moveCursorToEnd(quillEditor);
      
      // Focus the editor
      quillEditor.focus();
      
      console.log('Updated Quill editor with formatted text:', newText);
    } catch (error) {
      console.error('Error updating Quill editor:', error);
      // Fallback to simple text content update
      quillEditor.textContent = newText;
      quillEditor.focus();
    }
  }

  /**
   * Insert formatted text into an element, handling emojis
   */
  insertFormattedText(element, text) {
    // Simple approach: just set text content
    // Slack will handle emoji rendering automatically
    element.textContent = text;
  }

  /**
   * Move cursor to end of contenteditable element
   */
  moveCursorToEnd(element) {
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
   * Show result preview with Replace/Copy options
   */
  showResultPreview(inputElement, originalText, processedText, actionType, customPrompt = '') {
    // Remove any existing preview
    this.hideResultPreview();

    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'slack-helper-preview-backdrop';
    
    // Create preview container
    const preview = document.createElement('div');
    preview.className = 'slack-helper-result-preview';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'slack-helper-preview-header';
    header.innerHTML = `
      <div class="slack-helper-preview-title">
        <span class="slack-helper-preview-icon">✨</span>
        <span>${actionType}${customPrompt ? `: ${customPrompt}` : ''}</span>
      </div>
      <button class="slack-helper-preview-close" title="Close">×</button>
    `;

    // Create content sections
    const content = document.createElement('div');
    content.className = 'slack-helper-preview-content';
    
    // Original text section
    const originalSection = document.createElement('div');
    originalSection.className = 'slack-helper-preview-section';
    originalSection.innerHTML = `
      <div class="slack-helper-preview-label">${this.t('original', 'Original:')}</div>
      <div class="slack-helper-preview-text slack-helper-preview-original">${this.escapeHtml(originalText)}</div>
    `;

    // Processed text section
    const processedSection = document.createElement('div');
    processedSection.className = 'slack-helper-preview-section';
    processedSection.innerHTML = `
      <div class="slack-helper-preview-label">${this.t('result', 'Result:')}</div>
      <div class="slack-helper-preview-text slack-helper-preview-result">${this.escapeHtml(processedText)}</div>
    `;

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'slack-helper-preview-actions';
    actions.innerHTML = `
      <button class="slack-helper-preview-btn slack-helper-preview-btn-secondary" data-action="copy">
        ${this.t('copy', '📋 Copy')}
      </button>
      <button class="slack-helper-preview-btn slack-helper-preview-btn-primary" data-action="replace">
        ${this.t('replace', '✅ Replace')}
      </button>
    `;

    // Assemble preview
    content.appendChild(originalSection);
    content.appendChild(processedSection);
    preview.appendChild(header);
    preview.appendChild(content);
    preview.appendChild(actions);

    // Position backdrop and preview in center of screen
    document.body.appendChild(backdrop);
    backdrop.appendChild(preview);

    // Store reference
    this.currentPreview = preview;
    this.currentBackdrop = backdrop;
    this.previewInputElement = inputElement;
    this.previewProcessedText = processedText;

    // Add event listeners
    this.addPreviewEventListeners(preview, backdrop);

    // Add preview styles if not already added
    this.loadPreviewStyles();
  }

  /**
   * Add event listeners to preview
   */
  addPreviewEventListeners(preview, backdrop) {
    // Close button
    const closeBtn = preview.querySelector('.slack-helper-preview-close');
    closeBtn.addEventListener('click', () => this.hideResultPreview());

    // Action buttons
    const copyBtn = preview.querySelector('[data-action="copy"]');
    const replaceBtn = preview.querySelector('[data-action="replace"]');

    copyBtn.addEventListener('click', () => this.handlePreviewAction('copy'));
    replaceBtn.addEventListener('click', () => this.handlePreviewAction('replace'));

    // Click backdrop to close
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.hideResultPreview();
      }
    });

    // Keyboard events
    setTimeout(() => {
      document.addEventListener('keydown', this.handlePreviewKeyDown.bind(this));
    }, 0);
  }

  /**
   * Handle preview action (copy/replace)
   */
  async handlePreviewAction(action) {
    if (action === 'copy') {
      try {
        await navigator.clipboard.writeText(this.previewProcessedText);
        this.showPreviewFeedback(this.t('copiedToClipboard', 'Copied to clipboard!'));
      } catch (error) {
        console.error('Failed to copy:', error);
        this.showPreviewFeedback(this.t('failedToCopy', 'Failed to copy'), true);
      }
    } else if (action === 'replace') {
      this.updateInputText(this.previewInputElement, this.previewProcessedText);
      this.showPreviewFeedback(this.t('textReplaced', 'Text replaced!'));
      setTimeout(() => this.hideResultPreview(), 1000);
    }
  }

  /**
   * Show feedback message in preview
   */
  showPreviewFeedback(message, isError = false) {
    const preview = this.currentPreview;
    if (!preview) return;

    const feedback = document.createElement('div');
    feedback.className = `slack-helper-preview-feedback ${isError ? 'error' : 'success'}`;
    feedback.textContent = message;

    preview.appendChild(feedback);

    setTimeout(() => {
      if (feedback.parentElement) {
        feedback.remove();
      }
    }, 2000);
  }

  /**
   * Handle keyboard events for preview
   */
  handlePreviewKeyDown(event) {
    if (this.currentPreview && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.hideResultPreview();
    }
  }

  /**
   * Hide result preview
   */
  hideResultPreview() {
    if (!this.currentPreview) return;

    document.removeEventListener('keydown', this.handlePreviewKeyDown);

    if (this.currentBackdrop) {
      this.currentBackdrop.remove();
      this.currentBackdrop = null;
    }
    
    this.currentPreview = null;
    this.previewInputElement = null;
    this.previewProcessedText = null;
  }

  /**
   * Escape HTML for safe display while preserving line breaks
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    // Replace line breaks with <br> tags for proper display
    return div.innerHTML.replace(/\n/g, '<br>');
  }

  /**
   * Load preview styles
   */
  loadPreviewStyles() {
    if (document.querySelector('#slack-helper-preview-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'slack-helper-preview-styles';
    style.textContent = `
      .slack-helper-preview-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
      }

      .slack-helper-result-preview {
        background: white;
        border: 1px solid #ddd;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        max-width: 700px;
        width: 100%;
        max-height: 80vh;
        overflow: auto;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        animation: slack-helper-preview-appear 0.2s ease-out;
      }

      @keyframes slack-helper-preview-appear {
        from {
          opacity: 0;
          transform: scale(0.9);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      .slack-helper-preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #eee;
        background: #f8f9fa;
        border-radius: 8px 8px 0 0;
      }

      .slack-helper-preview-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        color: #333;
        font-size: 14px;
      }

      .slack-helper-preview-icon {
        font-size: 16px;
      }

      .slack-helper-preview-close {
        background: none;
        border: none;
        font-size: 18px;
        color: #666;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        line-height: 1;
      }

      .slack-helper-preview-close:hover {
        background: #e8e8e8;
        color: #333;
      }

      .slack-helper-preview-content {
        padding: 16px;
      }

      .slack-helper-preview-section {
        margin-bottom: 16px;
      }

      .slack-helper-preview-section:last-child {
        margin-bottom: 0;
      }

      .slack-helper-preview-label {
        font-size: 12px;
        font-weight: 600;
        color: #666;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .slack-helper-preview-text {
        padding: 12px;
        border-radius: 6px;
        font-size: 14px;
        line-height: 1.4;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .slack-helper-preview-original {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        color: #666;
      }

      .slack-helper-preview-result {
        background: #e8f5e8;
        border: 1px solid #c3e6cb;
        color: #155724;
      }

      .slack-helper-preview-actions {
        display: flex;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid #eee;
        background: #f8f9fa;
        border-radius: 0 0 8px 8px;
        justify-content: flex-end;
      }

      .slack-helper-preview-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .slack-helper-preview-btn-secondary {
        background: #f8f9fa;
        color: #495057;
        border: 1px solid #dee2e6;
      }

      .slack-helper-preview-btn-secondary:hover {
        background: #e9ecef;
        border-color: #adb5bd;
      }

      .slack-helper-preview-btn-primary {
        background: #007a5a;
        color: white;
      }

      .slack-helper-preview-btn-primary:hover {
        background: #005a3a;
      }

      .slack-helper-preview-feedback {
        position: absolute;
        bottom: 16px;
        right: 16px;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        z-index: 1001;
      }

      .slack-helper-preview-feedback.success {
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
      }

      .slack-helper-preview-feedback.error {
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
      }

      .slack-helper-relative {
        position: relative !important;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Cleanup method
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    // Clean up preview
    this.hideResultPreview();
    
    // Clean up dropdown
    this.hideRefineDropdown();
    
    this.toolbarButtonInstances.forEach(button => {
      if (button.parentElement) {
        button.parentElement.removeChild(button);
      }
    });
    
    this.toolbarButtonInstances.clear();
    this.observedInputs.clear();
    this.initialized = false;
  }
} 