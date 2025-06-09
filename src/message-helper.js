/**
 * Slack Input Enhancer Module
 * Handles detection of Slack input areas and adds enhancement buttons
 */

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
          this.handleCustomPrompt(customPrompt, button);
          this.hideRefineDropdown();
        } else {
          textarea.focus();
        }
        return;
      }
      
      stopPropagation(e);
    });
    
    ['keypress', 'keyup', 'input', 'focus', 'blur', 'click'].forEach(eventType => {
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
  handleCustomPrompt(customPrompt, button) {
    const inputElement = this.findInputForButton(button);
    if (!inputElement) return;

    const currentText = inputElement.textContent || inputElement.value || '';
    
    if (!currentText.trim()) {
      alert('Please type a message first before applying custom prompt.');
      return;
    }

    // TODO: Implement actual AI processing with custom prompt
    alert(`Custom Prompt: "${customPrompt}"\n\nOriginal: "${currentText}"\n\nThis feature will be implemented with AI integration.`);
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
      if (!isRefineButton) {
        this.hideRefineDropdown();
      }
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
  handleRefineAction(action, button) {
    const inputElement = this.findInputForButton(button);
    if (!inputElement) return;

    const currentText = inputElement.textContent || inputElement.value || '';
    
    if (!currentText.trim()) {
      alert('Please type a message first before refining it.');
      return;
    }

    const actionMap = {
      'Rephrase': 'Rephrasing your message...',
      'Refine': 'Refining your message for better quality and clarity...',
      'Fix grammar': 'Fixing grammar and spelling...'
    };

    // TODO: Implement actual AI refining logic
    alert(`${actionMap[action] || 'Processing...'}\n\nOriginal: "${currentText}"\n\nThis feature will be implemented with AI integration.`);
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
   * Cleanup method
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
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