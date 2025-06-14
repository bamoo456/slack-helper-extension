/**
 * Slack Input Enhancer Module
 * Handles detection of Slack input areas and adds enhancement buttons
 */

import { llmService } from './llm-service.js';
import { SlackMessageFormatter } from './slack-message-formatter.js';

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
    
    // Add processing overlay state
    this.currentProcessingOverlay = null;
    this.currentProcessingBackdrop = null;
    this.processingStartTime = null;
    
    // Add map to keep track of keyboard shortcut listeners per input element
    this.shortcutListeners = new WeakMap();
    
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
        customPromptPlaceholder: 'Help me write... (Ctrl+Enter to apply)',
        customPromptHint: '💡 Add {MESSAGE} to your prompt to include the current message content',
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
        const tooltipText = `${this.t('refineMessage', 'Refine Message')} (Ctrl+W)`;
        button.setAttribute('data-tooltip', tooltipText);
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

    // Update custom prompt hint
    const hintText = this.currentDropdown.querySelector('.slack-helper-custom-prompt-hint');
    if (hintText) {
      hintText.textContent = this.t('customPromptHint', '💡 Add {MESSAGE} to your prompt to include the current message content');
    }

    // Update custom prompt placeholder
    const textarea = this.currentDropdown.querySelector('.slack-helper-custom-prompt-input');
    if (textarea) {
      textarea.placeholder = this.t('customPromptPlaceholder', 'Help me write... (Ctrl+Enter to apply)');
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

    // Update action buttons (no need to update section labels since we removed them)
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

      // Attach keyboard shortcut (⌥+W on macOS, Ctrl+W on Windows)
      const refineButton = this.toolbarButtonInstances.get(toolbar);
      if (refineButton) {
        this.addShortcutListener(inputElement, refineButton);
      }

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
    
    // Add tooltip with shortcut hint
    const tooltipText = `${this.t('refineMessage', 'Refine Message')} (Ctrl+W)`;
    button.setAttribute('data-tooltip', tooltipText);
    
    // Ensure tooltip CSS is injected
    this.ensureTooltipStyles();
    
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

    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.handleRefineClick(button);
    });

    return button;
  }

  /**
   * Ensure tooltip CSS is injected once
   */
  ensureTooltipStyles() {
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
  async handleRefineClick(button) {
    if (this.currentDropdown) {
      this.hideRefineDropdown();
    } else {
      await this.showRefineDropdown(button);
    }
  }

  /**
   * Show the refine dropdown menu
   */
  async showRefineDropdown(button) {
    const dropdown = document.createElement('div');
    dropdown.className = 'slack-helper-refine-dropdown slack-helper-refine-dropdown-expanded';

    // Create model selector header
    const modelHeader = await this.createModelSelector(button);
    dropdown.appendChild(modelHeader);

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

    // Use body as parent for more reliable positioning
    document.body.appendChild(dropdown);
    this.currentDropdown = dropdown;

    // Position dropdown immediately using fixed positioning
    this.positionDropdownFixed(dropdown, button);

    // Add event listeners
    setTimeout(() => {
      document.addEventListener('click', this.handleClickOutside);
      document.addEventListener('keydown', this.handleKeyDown);
    }, 0);
  }

  /**
   * Position dropdown using fixed positioning relative to button
   */
  positionDropdownFixed(dropdown, button) {
    // Get button position
    const buttonRect = button.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Set initial fixed positioning
    dropdown.style.position = 'fixed';
    dropdown.style.zIndex = '10000';
    
    // Force render to get dropdown dimensions
    dropdown.style.visibility = 'hidden';
    dropdown.style.display = 'block';
    
    // Wait for next frame to get accurate measurements
    requestAnimationFrame(() => {
      const dropdownRect = dropdown.getBoundingClientRect();
      const dropdownHeight = dropdownRect.height;
      const dropdownWidth = dropdownRect.width;
      
      // Calculate position
      const padding = 10;
      let top, left;
      
      // Determine vertical position
      const spaceBelow = viewportHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      
      if (spaceBelow >= dropdownHeight + padding || spaceBelow > spaceAbove) {
        // Position below button
        top = buttonRect.bottom + 4;
      } else {
        // Position above button
        top = buttonRect.top - dropdownHeight - 4;
      }
      
      // Determine horizontal position
      const spaceRight = viewportWidth - buttonRect.right;
      
      if (spaceRight >= dropdownWidth + padding) {
        // Align with right edge of button
        left = buttonRect.right - dropdownWidth;
      } else {
        // Align with left edge of button
        left = buttonRect.left;
      }
      
      // Ensure dropdown stays within viewport
      top = Math.max(padding, Math.min(top, viewportHeight - dropdownHeight - padding));
      left = Math.max(padding, Math.min(left, viewportWidth - dropdownWidth - padding));
      
      // Apply final position
      dropdown.style.top = `${top}px`;
      dropdown.style.left = `${left}px`;
      dropdown.style.visibility = 'visible';
      
      console.log('Dropdown positioned:', {
        button: { top: buttonRect.top, left: buttonRect.left, bottom: buttonRect.bottom, right: buttonRect.right },
        dropdown: { width: dropdownWidth, height: dropdownHeight, top, left },
        viewport: { width: viewportWidth, height: viewportHeight }
      });
    });
  }

  /**
   * Create model selector header
   */
  async createModelSelector(button) {
    const modelContainer = document.createElement('div');
    modelContainer.className = 'slack-helper-model-selector';
    
    // Get current global default model
    const currentModel = await this.getCurrentGlobalDefaultModel();
    const availableModels = await this.getAvailableModels();
    
    // Create model display/selector
    const modelSelector = document.createElement('div');
    modelSelector.className = 'slack-helper-model-dropdown';
    
    const modelButton = document.createElement('button');
    modelButton.className = 'slack-helper-model-button';
    modelButton.type = 'button';
    
    // Create model icon and text
    const modelIcon = document.createElement('span');
    modelIcon.className = 'slack-helper-model-icon';
    modelIcon.textContent = currentModel.icon || '❓';
    
    const modelText = document.createElement('span');
    modelText.className = 'slack-helper-model-text';
    modelText.textContent = currentModel.displayName || this.t('noModelSelected', 'No model selected');
    
    const dropdownIcon = document.createElement('span');
    dropdownIcon.className = 'slack-helper-dropdown-arrow';
    dropdownIcon.innerHTML = '▼';
    
    modelButton.appendChild(modelIcon);
    modelButton.appendChild(modelText);
    modelButton.appendChild(dropdownIcon);
    
    // Create dropdown options (initially hidden)
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'slack-helper-model-options';
    optionsContainer.style.display = 'none';
    
    // Add available models to dropdown
    availableModels.forEach(model => {
      const option = document.createElement('div');
      option.className = 'slack-helper-model-option';
      if (model.value === currentModel.value) {
        option.classList.add('selected');
      }
      
      const optionIcon = document.createElement('span');
      optionIcon.className = 'slack-helper-model-option-icon';
      optionIcon.textContent = model.icon;
      
      const optionText = document.createElement('span');
      optionText.className = 'slack-helper-model-option-text';
      optionText.textContent = model.displayName;
      
      option.appendChild(optionIcon);
      option.appendChild(optionText);
      
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectModel(model, modelText, optionsContainer);
      });
      
      optionsContainer.appendChild(option);
    });
    
    // Toggle dropdown on button click
    modelButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = optionsContainer.style.display !== 'none';
      optionsContainer.style.display = isVisible ? 'none' : 'block';
      modelButton.classList.toggle('open', !isVisible);
    });
    
    modelSelector.appendChild(modelButton);
    modelSelector.appendChild(optionsContainer);
    modelContainer.appendChild(modelSelector);
    
    return modelContainer;
  }

  /**
   * Get current global default model
   */
  async getCurrentGlobalDefaultModel() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['globalDefaultModel', 'providerModels'], (result) => {
        const globalDefault = result.globalDefaultModel;
        const providerModels = result.providerModels || {};
        
        if (globalDefault && globalDefault.includes(':')) {
          const [provider, modelName] = globalDefault.split(':');
          const providerName = provider === 'openai' ? 'OpenAI' : 'OpenAI Compatible';
          resolve({
            value: globalDefault,
            displayName: modelName,
            provider: provider,
            providerName: providerName,
            icon: provider === 'openai' ? '🤖' : '🔧'
          });
        } else {
          resolve({
            value: '',
            displayName: this.t('noModelSelected', 'No model selected'),
            provider: '',
            providerName: '',
            icon: '❓'
          });
        }
      });
    });
  }

  /**
   * Get available models for selection
   */
  async getAvailableModels() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['providerModels'], (result) => {
        const providerModels = result.providerModels || {};
        const models = [];
        
        // Add models from all providers
        Object.keys(providerModels).forEach(provider => {
          const providerName = provider === 'openai' ? 'OpenAI' : 'OpenAI Compatible';
          const icon = provider === 'openai' ? '🤖' : '🔧';
          
          providerModels[provider].forEach(model => {
            models.push({
              value: `${provider}:${model.name}`,
              displayName: model.name,
              provider: provider,
              providerName: providerName,
              icon: icon
            });
          });
        });
        
        resolve(models);
      });
    });
  }

  /**
   * Select a model and update the display
   */
  selectModel(model, modelTextElement, optionsContainer) {
    // Update display text
    modelTextElement.textContent = model.displayName;
    
    // Update icon
    const modelIcon = modelTextElement.parentElement.querySelector('.slack-helper-model-icon');
    if (modelIcon) {
      modelIcon.textContent = model.icon;
    }
    
    // Update selected state
    optionsContainer.querySelectorAll('.slack-helper-model-option').forEach(option => {
      option.classList.remove('selected');
    });
    
    const selectedOption = Array.from(optionsContainer.querySelectorAll('.slack-helper-model-option'))
      .find(option => option.querySelector('.slack-helper-model-option-text').textContent === model.displayName);
    
    if (selectedOption) {
      selectedOption.classList.add('selected');
    }
    
    // Save to storage
    chrome.storage.local.set({ globalDefaultModel: model.value }, () => {
      console.log('Global default model updated:', model.displayName);
    });
    
    // Hide dropdown
    optionsContainer.style.display = 'none';
    optionsContainer.parentElement.querySelector('.slack-helper-model-button').classList.remove('open');
  }

  /**
   * Create prompt input container
   */
  createPromptInput(button) {
    const inputContainer = document.createElement('div');
    inputContainer.className = 'slack-helper-custom-prompt-container';
    
    const textarea = document.createElement('textarea');
    textarea.className = 'slack-helper-custom-prompt-input';
    textarea.placeholder = this.t('customPromptPlaceholder', 'Help me write... (Ctrl+Enter to apply)');
    textarea.rows = 3;
    
    // Add event handlers
    this.addTextareaEventHandlers(textarea, button);
    
    // Create hint text
    const hintText = document.createElement('div');
    hintText.className = 'slack-helper-custom-prompt-hint';
    hintText.textContent = this.t('customPromptHint', '💡 Add {MESSAGE} to your prompt to include the current message content');
    
    inputContainer.appendChild(textarea);
    inputContainer.appendChild(hintText);
    
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
    
    // Check if prompt contains {MESSAGE} placeholder
    if (customPrompt.includes('{MESSAGE}')) {
      // Replace {MESSAGE} with the current text (empty string if no text)
      const processedPrompt = customPrompt.replace(/{MESSAGE}/g, currentText);
      
      try {
        // Show full-screen processing overlay
        this.showProcessingOverlay(
          this.t('processingCustomPrompt', 'Processing with custom prompt...'),
          this.t('customPrompt', 'Custom Prompt')
        );
        
        // Also show button loading state as backup
        this.showLoadingState(button, this.t('processingCustomPrompt', 'Processing with custom prompt...'));
        
        // For {MESSAGE} prompts, we send the processed prompt directly as a standalone request
        // We use a dummy text since the LLM service expects some text, but the real content is in the prompt
        const processedText = await llmService.processText(' ', 'custom', processedPrompt);
        
        // Hide processing overlay and loading state
        this.hideProcessingOverlay();
        this.hideLoadingState(button);
        
        // Show result preview
        this.showResultPreview(inputElement, currentText, processedText, this.t('customPrompt', 'Custom Prompt'));
        
      } catch (error) {
        console.error('Error processing custom prompt:', error);
        this.hideProcessingOverlay();
        this.hideLoadingState(button);
        alert(`${this.t('errorProcessingRequest', 'Error processing your request')}: ${error.message}`);
      }
    } else {
      // If no {MESSAGE} placeholder, use traditional approach with current text or empty string
      try {
        // Show full-screen processing overlay
        this.showProcessingOverlay(
          this.t('processingCustomPrompt', 'Processing with custom prompt...'),
          this.t('customPrompt', 'Custom Prompt')
        );
        
        // Also show button loading state as backup
        this.showLoadingState(button, this.t('processingCustomPrompt', 'Processing with custom prompt...'));
        
        // Use current text (or empty string) with custom prompt as instruction
        const processedText = await llmService.processText(currentText || ' ', 'custom', customPrompt);
        
        // Hide processing overlay and loading state
        this.hideProcessingOverlay();
        this.hideLoadingState(button);
        
        // Show result preview
        this.showResultPreview(inputElement, currentText, processedText, this.t('customPrompt', 'Custom Prompt'));
        
      } catch (error) {
        console.error('Error processing custom prompt:', error);
        this.hideProcessingOverlay();
        this.hideLoadingState(button);
        alert(`${this.t('errorProcessingRequest', 'Error processing your request')}: ${error.message}`);
      }
    }
  }

  /**
   * Hide the refine dropdown menu
   */
  hideRefineDropdown() {
    if (!this.currentDropdown) return;
    
    document.removeEventListener('click', this.handleClickOutside);
    document.removeEventListener('keydown', this.handleKeyDown);
    
    // Always close immediately for better responsiveness
    this.currentDropdown.remove();
    this.currentDropdown = null;
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
      // Show full-screen processing overlay
      this.showProcessingOverlay(
        actionConfig.message,
        action
      );
      
      // Also show button loading state as backup
      this.showLoadingState(button, actionConfig.message);
      
      // Process text with LLM service (use empty string if no current text)
      const processedText = await llmService.processText(currentText || ' ', actionConfig.action);
      
      // Hide processing overlay and loading state
      this.hideProcessingOverlay();
      this.hideLoadingState(button);
      
      // Show result preview
      this.showResultPreview(inputElement, currentText, processedText, action);
      
    } catch (error) {
      console.error('Error processing refine action:', error);
      this.hideProcessingOverlay();
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
    return SlackMessageFormatter.extractTextFromInput(inputElement);
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
   * Show full-screen processing overlay
   */
  showProcessingOverlay(message, actionType = '') {
    // Hide any existing overlay first
    this.hideProcessingOverlay();
    
    // Record start time for progress indication
    this.processingStartTime = Date.now();
    
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'slack-helper-processing-backdrop';
    
    // Create processing container
    const overlay = document.createElement('div');
    overlay.className = 'slack-helper-processing-overlay';
    
    // Create header with action type
    const header = document.createElement('div');
    header.className = 'slack-helper-processing-header';
    
    const icon = document.createElement('div');
    icon.className = 'slack-helper-processing-icon';
    icon.innerHTML = '✨';
    
    const title = document.createElement('div');
    title.className = 'slack-helper-processing-title';
    title.textContent = actionType || this.t('processing', 'Processing...');
    
    header.appendChild(icon);
    header.appendChild(title);
    
    // Create main content area
    const content = document.createElement('div');
    content.className = 'slack-helper-processing-content';
    
    // Create animated loading spinner
    const spinnerContainer = document.createElement('div');
    spinnerContainer.className = 'slack-helper-processing-spinner-container';
    
    const spinner = document.createElement('div');
    spinner.className = 'slack-helper-processing-spinner';
    
    spinnerContainer.appendChild(spinner);
    
    // Create status message
    const statusMessage = document.createElement('div');
    statusMessage.className = 'slack-helper-processing-message';
    statusMessage.textContent = message;
    
    // Create elapsed time indicator
    const timeIndicator = document.createElement('div');
    timeIndicator.className = 'slack-helper-processing-time';
    timeIndicator.textContent = '0s';
    
    // Assemble content
    content.appendChild(spinnerContainer);
    content.appendChild(statusMessage);
    content.appendChild(timeIndicator);
    
    // Assemble overlay
    overlay.appendChild(header);
    overlay.appendChild(content);
    
    // Add to DOM
    document.body.appendChild(backdrop);
    backdrop.appendChild(overlay);
    
    // Store references
    this.currentProcessingOverlay = overlay;
    this.currentProcessingBackdrop = backdrop;
    
    // Start time updates
    this.startProcessingAnimation(timeIndicator);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  /**
   * Start processing time updates
   */
  startProcessingAnimation(timeIndicator) {
    if (!this.processingStartTime) return;
    
    const updateTime = () => {
      if (!this.currentProcessingOverlay || !this.processingStartTime) return;
      
      const elapsed = Date.now() - this.processingStartTime;
      const seconds = Math.floor(elapsed / 1000);
      
      // Update time indicator
      timeIndicator.textContent = `${seconds}s`;
      
      // Continue animation
      if (this.currentProcessingOverlay) {
        requestAnimationFrame(updateTime);
      }
    };
    
    requestAnimationFrame(updateTime);
  }

  /**
   * Hide processing overlay
   */
  hideProcessingOverlay() {
    if (!this.currentProcessingOverlay) return;

    // Keep local reference to backdrop before clearing
    const backdrop = this.currentProcessingBackdrop;

    // Restore body scroll
    document.body.style.overflow = '';

    // Fade out and remove backdrop
    if (backdrop) {
      backdrop.style.opacity = '0';
      setTimeout(() => {
        if (backdrop.parentElement) {
          backdrop.remove();
        }
      }, 200);
    }

    // Clear references
    this.currentProcessingOverlay = null;
    this.currentProcessingBackdrop = null;
    this.processingStartTime = null;
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
        <span>${actionType}</span>
      </div>
      <button class="slack-helper-preview-close" title="Close">×</button>
    `;

    // Create content sections
    const content = document.createElement('div');
    content.className = 'slack-helper-preview-content';
    
    // Create Slack-styled message preview
    const processedSection = document.createElement('div');
    processedSection.className = 'slack-helper-preview-section';
    
    // Create Slack message container with native styling
    const slackMessageContainer = this.createSlackStyledMessage(processedText);
    processedSection.appendChild(slackMessageContainer);

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

    // Assemble preview (only include processed section)
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
      // Use SlackMessageFormatter to properly update the input with formatted content
      const success = SlackMessageFormatter.updateSlackInput(this.previewInputElement, this.previewProcessedText);
      
      if (success) {
        this.showPreviewFeedback(this.t('textReplaced', 'Text replaced!'));
      } else {
        // Fallback to the original method if the new formatter fails
        this.updateInputText(this.previewInputElement, this.previewProcessedText);
        this.showPreviewFeedback(this.t('textReplaced', 'Text replaced!'));
      }
      setTimeout(() => this.hideResultPreview(), 300);
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
   * 將 markdown 轉換為單一 ql-code-block 的 HTML（只用於預覽）
   */
  convertMarkdownToSingleCodeBlockHtml(markdownText) {
    if (!markdownText) return '';
    let html = markdownText;
    // 將多行 code block 轉成單一 ql-code-block
    html = html.replace(/```[^\n]*\n([\s\S]*?)\n```/g, (match, code) => {
      const safeCode = SlackMessageFormatter._escapeHtml(code);
      return `<div class="ql-code-block">${safeCode.replace(/\n/g, '<br>')}</div>`;
    });
    // 將連續 quote 合併成單一 blockquote
    html = html.replace(/(^> .*(?:\n> .*)*)/gm, (match) => {
      // 移除每行開頭的 '> '，用 <br> 連接
      const lines = match.split('\n').map(line => SlackMessageFormatter._escapeHtml(line.replace(/^> /, '')));
      return `<blockquote>${lines.join('<br>')}</blockquote>`;
    });
    // 其他 markdown 處理
    html = html.replace(/`([^`]+)`/g, (match, code) => {
      return `<code>${SlackMessageFormatter._escapeHtml(code)}</code>`;
    });
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      return `<a href="${SlackMessageFormatter._escapeHtml(url)}" rel="noopener noreferrer" target="_blank">${SlackMessageFormatter._escapeHtml(text)}</a>`;
    });
    // 段落處理
    const lines = html.split('\n');
    const paragraphs = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') {
        paragraphs.push('<p><br></p>');
      } else if (line.startsWith('<div class="ql-code-block">')) {
        paragraphs.push(line);
      } else if (line.startsWith('<blockquote>')) {
        paragraphs.push(line);
      } else {
        paragraphs.push(`<p>${line}</p>`);
      }
    }
    return paragraphs.join('');
  }

  // 修改 createSlackStyledMessage 預覽時使用單一 code block 處理
  createSlackStyledMessage(processedText) {
    const messageContainer = document.createElement('div');
    messageContainer.className = 'slack-helper-slack-message-container';
    const messageContent = document.createElement('div');
    messageContent.className = 'slack-helper-slack-message-content';
    messageContent.setAttribute('dir', 'auto');
    messageContent.setAttribute('role', 'textbox');
    messageContent.setAttribute('spellcheck', 'true');
    // 預覽時用單一 code block 處理
    const slackHtml = this.convertMarkdownToSingleCodeBlockHtml(processedText);
    messageContent.innerHTML = slackHtml;
    this.postProcessSlackContent(messageContent);
    messageContainer.appendChild(messageContent);
    return messageContainer;
  }

  /**
   * Post-process Slack content to ensure proper structure
   */
  postProcessSlackContent(contentElement) {
    // Ensure ts-mention elements have proper attributes
    const mentions = contentElement.querySelectorAll('ts-mention');
    mentions.forEach(mention => {
      mention.setAttribute('spellcheck', 'false');
      mention.setAttribute('dir', 'ltr');
      if (!mention.classList.contains('c-member_slug')) {
        mention.classList.add('c-member_slug', 'c-member_slug--link', 'ts_tip_texty');
      }
    });

    // Ensure links have proper attributes
    const links = contentElement.querySelectorAll('a');
    links.forEach(link => {
      if (!link.hasAttribute('rel')) {
        link.setAttribute('rel', 'noopener noreferrer');
      }
      if (!link.hasAttribute('target')) {
        link.setAttribute('target', '_blank');
      }
    });
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

      .slack-helper-preview-text {
        padding: 12px;
        border-radius: 6px;
        font-size: 14px;
        line-height: 1.4;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .slack-helper-preview-result {
        background: #e8f5e8;
        border: 1px solid #c3e6cb;
        color: #155724;
      }

      /* Slack-styled message container */
      .slack-helper-slack-message-container {
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 16px;
        font-family: Slack-Lato, Slack-Fractions, appleLogo, sans-serif;
        font-size: 15px;
        line-height: 1.46668;
        color: #1d1c1d;
        max-width: 100%;
        overflow-wrap: break-word;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        /* Mimic Slack's ql-editor styling */
        direction: auto;
      }

      .slack-helper-slack-message-content {
        /* Reset any inherited styles */
        margin: 0;
        padding: 0;
        /* Mimic ql-editor attributes */
        direction: auto;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }

      /* Slack paragraph styling */
      .slack-helper-slack-message-content p {
        margin: 0 0 8px 0;
        padding: 0;
        line-height: 1.46668;
        font-size: 15px;
        color: #1d1c1d;
      }

      .slack-helper-slack-message-content p:last-child {
        margin-bottom: 0;
      }

      /* Empty paragraph with just <br> */
      .slack-helper-slack-message-content p:has(br:only-child) {
        margin: 8px 0;
        height: 1.46668em;
        min-height: 1.46668em;
      }

      /* Handle empty paragraphs more specifically */
      .slack-helper-slack-message-content p br:only-child {
        display: block;
        content: "";
        margin-top: 0;
      }

      /* Slack code block styling */
      .slack-helper-slack-message-content .ql-code-block {
        background: #f8f8f8;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        padding: 8px 12px;
        margin: 4px 0;
        font-family: Monaco, Menlo, Consolas, "Courier New", monospace;
        font-size: 12px;
        line-height: 1.50001;
        color: #1d1c1d;
        white-space: pre;
        overflow-x: auto;
        display: block;
        width: 100%;
        box-sizing: border-box;
      }

      /* Multiple consecutive code blocks should appear as one block */
      .slack-helper-slack-message-content .ql-code-block + .ql-code-block {
        margin-top: 0;
        border-top: none;
        border-top-left-radius: 0;
        border-top-right-radius: 0;
      }

      .slack-helper-slack-message-content .ql-code-block:has(+ .ql-code-block) {
        margin-bottom: 0;
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
      }

      /* Slack inline code styling */
      .slack-helper-slack-message-content code {
        background: #f8f8f8;
        border: 1px solid #e0e0e0;
        border-radius: 3px;
        padding: 2px 4px;
        font-family: Monaco, Menlo, Consolas, "Courier New", monospace;
        font-size: 12px;
        color: #e01e5a;
        font-weight: 500;
      }

      /* Slack blockquote styling */
      .slack-helper-slack-message-content blockquote {
        margin: 4px 0;
        padding: 0 0 0 12px;
        border-left: 4px solid #e0e0e0;
        color: #616061;
        font-style: italic;
        display: block;
        font-size: 15px;
        line-height: 1.46668;
        background: none;
      }

      /* Slack link styling */
      .slack-helper-slack-message-content a {
        color: #1264a3;
        text-decoration: none;
      }

      .slack-helper-slack-message-content a:hover {
        text-decoration: underline;
      }

      /* Slack mention styling */
      .slack-helper-slack-message-content ts-mention {
        background: #e8f5e8;
        color: #1264a3;
        padding: 2px 4px;
        border-radius: 3px;
        font-weight: 500;
        text-decoration: none;
        cursor: pointer;
        display: inline;
        direction: ltr;
      }

      .slack-helper-slack-message-content ts-mention:hover {
        background: #d4edda;
      }

      /* Handle c-member_slug classes that might be on ts-mention */
      .slack-helper-slack-message-content ts-mention.c-member_slug {
        background: #e8f5e8;
        color: #1264a3;
      }

      .slack-helper-slack-message-content ts-mention.c-member_slug--link {
        cursor: pointer;
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
    
    // Clean up processing overlay
    this.hideProcessingOverlay();
    
    this.toolbarButtonInstances.forEach(button => {
      if (button.parentElement) {
        button.parentElement.removeChild(button);
      }
    });
    
    this.toolbarButtonInstances.clear();
    this.observedInputs.clear();
    this.initialized = false;
  }

  /**
   * Add keyboard shortcut listener to open the refine dropdown.
   *  - macOS: Option (Alt) + W
   *  - Windows/Linux: Ctrl + W
   */
  addShortcutListener(inputElement, refineButton) {
    // Avoid attaching multiple listeners to the same element
    if (this.shortcutListeners.has(inputElement)) return;

    const handler = async (e) => {
      // Detect Ctrl+W (without Alt/Meta)
      const isCtrlW = e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'w' || e.key === 'W');

      if (isCtrlW) {
        e.preventDefault();
        e.stopPropagation();
        await this.handleRefineClick(refineButton);
      }
    };

    inputElement.addEventListener('keydown', handler);
    this.shortcutListeners.set(inputElement, handler);
  }
} 