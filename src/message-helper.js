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
    
    this.handleClickOutside = this.handleClickOutside.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    
    this.loadStyles();
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
   * Initialize the input enhancer
   */
  async init() {
    if (this.initialized) return;
    
    this.startObserving();
    this.processExistingInputs();
    this.initialized = true;
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
    button.setAttribute('aria-label', 'Refine Message');
    button.setAttribute('title', 'Refine Message');
    
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
      { icon: '✏️', text: 'Rephrase' },
      { icon: '✨', text: 'Refine' },
      { icon: '🔧', text: 'Fix grammar' }
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
    textarea.placeholder = 'Modify with a prompt... (Ctrl+Enter to apply)';
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

    const currentText = inputElement.textContent || inputElement.value || '';
    
    if (!currentText.trim()) {
      alert('Please type a message first before applying custom prompt.');
      return;
    }

    try {
      // Show loading state
      this.showLoadingState(button, 'Processing with custom prompt...');
      
      // Process text with LLM service
      const processedText = await llmService.processText(currentText, 'custom', customPrompt);
      
      // Hide loading state
      this.hideLoadingState(button);
      
      // Show result preview
      this.showResultPreview(inputElement, currentText, processedText, 'Custom Prompt', customPrompt);
      
    } catch (error) {
      console.error('Error processing custom prompt:', error);
      this.hideLoadingState(button);
      alert(`Error processing your request: ${error.message}`);
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

    const currentText = inputElement.textContent || inputElement.value || '';
    
    if (!currentText.trim()) {
      alert('Please type a message first before refining it.');
      return;
    }

    const actionMap = {
      'Rephrase': { action: 'rephrase', message: 'Rephrasing your message...' },
      'Refine': { action: 'refine', message: 'Refining your message for better quality and clarity...' },
      'Fix grammar': { action: 'fix_grammar', message: 'Fixing grammar and spelling...' }
    };

    const actionConfig = actionMap[action];
    if (!actionConfig) {
      alert('Unknown action selected.');
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
      alert(`Error processing your request: ${error.message}`);
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
      if (input) return input;
    }

    return null;
  }

  /**
   * Show loading state on button
   */
  showLoadingState(button, message = 'Processing...') {
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
    button.setAttribute('title', 'Refine Message');
  }

  /**
   * Update input text content
   */
  updateInputText(inputElement, newText) {
    if (!inputElement || !newText) return;

    // Handle different types of input elements
    if (inputElement.contentEditable === 'true') {
      // For contenteditable elements
      inputElement.textContent = newText;
      
      // Trigger input events to notify Slack
      const inputEvent = new Event('input', { bubbles: true });
      inputElement.dispatchEvent(inputEvent);
      
      // Move cursor to end
      this.moveCursorToEnd(inputElement);
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
      <div class="slack-helper-preview-label">Original:</div>
      <div class="slack-helper-preview-text slack-helper-preview-original">${this.escapeHtml(originalText)}</div>
    `;

    // Processed text section
    const processedSection = document.createElement('div');
    processedSection.className = 'slack-helper-preview-section';
    processedSection.innerHTML = `
      <div class="slack-helper-preview-label">Result:</div>
      <div class="slack-helper-preview-text slack-helper-preview-result">${this.escapeHtml(processedText)}</div>
    `;

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'slack-helper-preview-actions';
    actions.innerHTML = `
      <button class="slack-helper-preview-btn slack-helper-preview-btn-secondary" data-action="copy">
        📋 Copy
      </button>
      <button class="slack-helper-preview-btn slack-helper-preview-btn-primary" data-action="replace">
        ✅ Replace
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
        this.showPreviewFeedback('Copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy:', error);
        this.showPreviewFeedback('Failed to copy', true);
      }
    } else if (action === 'replace') {
      this.updateInputText(this.previewInputElement, this.previewProcessedText);
      this.showPreviewFeedback('Text replaced!');
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
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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