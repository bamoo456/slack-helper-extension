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
    
    // Load CSS styles
    this.loadStyles();
    
    // 工具列選擇器
    this.toolbarSelectors = [
      '.c-wysiwyg_container__formatting[data-qa="wysiwyg-container_formatting-enabled"]',
      '.c-wysiwyg_container__formatting',
      '.p-texty_sticky_formatting_bar',
      // Additional selectors for different Slack layouts
      '.c-composer__formatting',
      '.p-composer__formatting',
      '[data-qa="formatting_toolbar"]',
      '.c-texty_input__formatting',
      '.c-message_composer__formatting',
      // Button group selectors
      '.c-wysiwyg_container .c-button_kit__button_group',
      '.c-composer .c-button_kit__button_group',
      '.p-composer .c-button_kit__button_group',
      // Generic toolbar selectors
      '[role="toolbar"]',
      '.c-button_kit__button_group'
    ];
    
    this.observedInputs = new Set();
    this.toolbarButtonInstances = new Map();
    this.currentDropdown = null;
    this.initialized = false;
    
    // Bind event handlers to maintain correct 'this' context
    this.handleClickOutside = this.handleClickOutside.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * Load CSS styles for the input enhancer
   */
  loadStyles() {
    // Check if styles are already loaded
    if (document.querySelector('#slack-message-helper-styles')) {
      return;
    }

    const link = document.createElement('link');
    link.id = 'slack-message-helper-styles';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = chrome.runtime.getURL('src/message-helper.css');
    
    // Add load event listener to confirm CSS is loaded
    link.addEventListener('load', () => {
      console.log('✅ CSS styles successfully loaded:', link.href);
    });
    
    link.addEventListener('error', (e) => {
      console.error('❌ Failed to load CSS styles:', e);
    });
    
    document.head.appendChild(link);
    console.log('🔧 CSS link added to head:', link.href);
  }

  /**
   * Initialize the input enhancer
   */
  async init() {
    if (this.initialized) return;
    
    console.log('🔧 Initializing MessageHelper...');
    
    // Start observing for input elements
    this.startObserving();
    
    // Process existing inputs
    this.processExistingInputs();
    
    this.initialized = true;
    console.log('✅ MessageHelper initialized');
  }

  /**
   * Start observing for new input elements
   */
  startObserving() {
    // Create a MutationObserver to watch for new input elements
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

    // Start observing the document
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('🔍 Started observing for input elements');
  }

  /**
   * Process existing input elements on the page
   */
  processExistingInputs() {
    const inputs = this.findAllInputElements();
    console.log(`🔍 Found ${inputs.length} existing input elements`);
    
    inputs.forEach(input => {
      this.enhanceInput(input);
    });
  }

  /**
   * Process a newly added element
   * @param {Element} element - The newly added element
   */
  processNewElement(element) {
    // Check if the element itself is an input
    if (this.isInputElement(element)) {
      this.enhanceInput(element);
      return;
    }

    // Check if the element contains inputs
    const inputs = element.querySelectorAll(this.inputSelectors.join(', '));
    inputs.forEach(input => {
      this.enhanceInput(input);
    });
  }

  /**
   * Find all input elements on the page
   * @returns {Array<Element>} Array of input elements
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

    return this.removeDuplicates(inputs);
  }

  /**
   * Check if an element is an input element
   * @param {Element} element - The element to check
   * @returns {boolean} True if the element is an input element
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
   * @param {Element} element - The input element to check
   * @returns {boolean} True if the element is valid
   */
  isValidInputElement(element) {
    // Check if element is visible
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    // Check if it's a message input (not search or other inputs)
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
   * @param {Element} inputElement - The input element to enhance
   */
  enhanceInput(inputElement) {
    // Skip if already enhanced
    if (this.observedInputs.has(inputElement)) {
      return;
    }

    console.log('🔧 Enhancing input element:', inputElement);

    // Find the toolbar for the input
    const toolbar = this.findToolbarForInput(inputElement);
    if (toolbar) {
      console.log('✅ Found toolbar for input, adding button to toolbar');
      this.showRefineButtonInToolbar(inputElement, toolbar);
      this.observedInputs.add(inputElement);
    } else {
      console.log('❌ No suitable toolbar found for input');
    }
  }

  /**
   * Find the toolbar element for an input
   * @param {Element} inputElement - The input element
   * @returns {Element|null} The toolbar element
   */
  findToolbarForInput(inputElement) {
    console.log('🔍 Looking for toolbar for input:', inputElement);
    
    // Find the closest composer or message container
    const composer = inputElement.closest('[data-qa*="composer"]') || 
                    inputElement.closest('.c-composer') ||
                    inputElement.closest('.p-composer') ||
                    inputElement.closest('.c-texty_input_unstyled__container');
    
    console.log('📦 Found composer container:', composer);
    
    if (!composer) {
      console.log('❌ No composer container found');
      return null;
    }

    // Look for toolbar within the composer or its siblings
    for (const selector of this.toolbarSelectors) {
      console.log(`🔍 Trying selector: ${selector}`);
      
      // First try within the composer
      let toolbar = composer.querySelector(selector);
      console.log(`  Within composer: ${toolbar ? 'Found' : 'Not found'}`);
      if (toolbar && this.isToolbarVisible(toolbar)) {
        console.log('✅ Found visible toolbar within composer');
        return toolbar;
      }
      
      // Then try in parent container
      const parent = composer.parentElement;
      if (parent) {
        toolbar = parent.querySelector(selector);
        console.log(`  In parent: ${toolbar ? 'Found' : 'Not found'}`);
        if (toolbar && this.isToolbarVisible(toolbar)) {
          console.log('✅ Found visible toolbar in parent');
          return toolbar;
        }
      }
      
      // Try in next sibling
      let sibling = composer.nextElementSibling;
      while (sibling) {
        if (sibling.matches && sibling.matches(selector)) {
          console.log(`  In sibling: Found`);
          if (this.isToolbarVisible(sibling)) {
            console.log('✅ Found visible toolbar in sibling');
            return sibling;
          }
        }
        sibling = sibling.nextElementSibling;
      }
    }

    // Try a broader search in the document
    console.log('🔍 Trying broader document search...');
    for (const selector of this.toolbarSelectors) {
      const toolbars = document.querySelectorAll(selector);
      console.log(`Found ${toolbars.length} toolbars with selector: ${selector}`);
      for (const toolbar of toolbars) {
        if (this.isToolbarVisible(toolbar)) {
          console.log('✅ Found visible toolbar in document');
          return toolbar;
        }
      }
    }

    console.log('❌ No toolbar found');
    return null;
  }

  /**
   * Check if toolbar is visible and usable
   * @param {Element} toolbar - The toolbar element
   * @returns {boolean} True if toolbar is visible
   */
  isToolbarVisible(toolbar) {
    const rect = toolbar.getBoundingClientRect();
    const style = getComputedStyle(toolbar);
    const isVisible = rect.width > 0 && rect.height > 0 && 
                     style.display !== 'none' && 
                     style.visibility !== 'hidden' &&
                     style.opacity !== '0';
    
    console.log(`🔍 Toolbar visibility check:`, {
      element: toolbar,
      className: toolbar.className,
      rect: { width: rect.width, height: rect.height },
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      isVisible
    });
    
    return isVisible;
  }

  /**
   * Show the refine message button in toolbar (persistent)
   * @param {Element} inputElement - The input element
   * @param {Element} toolbar - The toolbar element
   */
  showRefineButtonInToolbar(inputElement, toolbar) {
    console.log('🔧 showRefineButtonInToolbar called', { toolbar, className: toolbar.className });
    
    // Check if button already exists
    if (this.toolbarButtonInstances.has(toolbar)) {
      const button = this.toolbarButtonInstances.get(toolbar);
      if (button && button.parentElement) {
        console.log('✅ Button already exists in toolbar, ensuring visibility');
        // Ensure button is visible by removing hidden class
        button.classList.remove('slack-helper-hidden');
        button.classList.add('slack-helper-visible');
        return;
      }
    }

    console.log('🔧 Creating new toolbar button');
    // Create the toolbar button
    const button = this.createToolbarRefineButton();
    
    // Find the best position to insert the button in toolbar
    const insertPosition = this.findToolbarInsertPosition(toolbar);
    console.log('🔧 Insert position found:', insertPosition);
    
    if (insertPosition) {
      insertPosition.appendChild(button);
      this.toolbarButtonInstances.set(toolbar, button);
      console.log('✅ Refine button added to toolbar (persistent)', {
        buttonVisible: button.style.display,
        buttonOpacity: button.style.opacity,
        buttonVisibility: button.style.visibility
      });
    } else {
      console.log('❌ No insert position found for toolbar button');
    }
  }

  /**
   * Create the refine message button for toolbar
   * @returns {Element} The button element
   */
  createToolbarRefineButton() {
    const button = document.createElement('button');
    button.className = 'c-button-unstyled c-icon_button c-icon_button--size_small slack-helper-refine-btn-toolbar';
    button.type = 'button';
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', 'Refine Message');
    button.setAttribute('data-qa', 'refine-message-composer-button');
    button.setAttribute('title', 'Refine Message');
    
    // Create SVG icon (using a sparkles/magic wand icon)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('data-dk', 'true');
    svg.setAttribute('data-qa', 'refine-message');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('class', '');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('d', 'M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2zM5.25 6a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75zm7.5 0a.75.75 0 0 1 .75-.75H15a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75zM10 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM7 10a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm-1.25 4a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75zm7.5 0a.75.75 0 0 1 .75-.75H15a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75zM10 15.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75z');
    path.setAttribute('clip-rule', 'evenodd');
    
    svg.appendChild(path);
    button.appendChild(svg);

    // Add click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleRefineClick(button);
    });

    return button;
  }

  /**
   * Find the best position to insert the button in toolbar
   * @param {Element} toolbar - The toolbar element
   * @returns {Element|null} The element to insert the button into
   */
  findToolbarInsertPosition(toolbar) {
    console.log('🔧 Finding insert position for toolbar:', toolbar.className);
    
    // Create a wrapper div to position the button at the rightmost side
    let rightWrapper = toolbar.querySelector('.slack-helper-right-wrapper');
    if (!rightWrapper) {
      rightWrapper = document.createElement('div');
      rightWrapper.className = 'slack-helper-right-wrapper';
      toolbar.appendChild(rightWrapper);
      console.log('✅ Created right wrapper for button positioning');
    }
    
    return rightWrapper;
  }

  /**
   * Handle refine button click
   * @param {Element} button - The clicked button
   */
  handleRefineClick(button) {
    console.log('🔧 Refine message button clicked');
    
    // Check if dropdown is already open
    if (this.currentDropdown) {
      console.log('🔒 Dropdown already open, hiding it');
      this.hideRefineDropdown();
    } else {
      console.log('📂 Opening dropdown');
      this.showRefineDropdown(button);
    }
  }

  /**
   * Show the refine dropdown menu
   * @param {Element} button - The button that was clicked
   */
  showRefineDropdown(button) {
    // Create dropdown container
    const dropdown = document.createElement('div');
    dropdown.className = 'slack-helper-refine-dropdown slack-helper-refine-dropdown-expanded';

    // Create custom prompt input area directly (no header)
    const inputContainer = document.createElement('div');
    inputContainer.className = 'slack-helper-custom-prompt-container';
    
    // Add inline styles as fallback
    Object.assign(inputContainer.style, {
      padding: '16px',
      pointerEvents: 'auto',
      position: 'relative',
      zIndex: '1001'
    });
    
    // Create textarea for custom prompt
    const textarea = document.createElement('textarea');
    textarea.className = 'slack-helper-custom-prompt-input';
    textarea.placeholder = 'Modify with a prompt... (Ctrl+Enter to apply)';
    textarea.rows = 3;
    textarea.setAttribute('tabindex', '0');
    textarea.setAttribute('spellcheck', 'true');
    textarea.setAttribute('autocomplete', 'off');
    
    // Add inline styles as fallback to ensure styling works
    Object.assign(textarea.style, {
      width: '100%',
      minHeight: '80px',
      padding: '12px 16px',
      border: '2px solid #e0e0e0',
      borderRadius: '12px',
      fontSize: '14px',
      fontFamily: 'Slack-Lato, appleLogo, sans-serif',
      resize: 'vertical',
      outline: 'none',
      transition: 'all 0.2s ease',
      boxSizing: 'border-box',
      backgroundColor: '#fafafa',
      lineHeight: '1.4',
      zIndex: '1001'
    });
    
    // Add comprehensive event handling to prevent Slack interference
    textarea.addEventListener('keydown', (e) => {
      // Handle ESC key to close dropdown
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.hideRefineDropdown();
        console.log('🔒 Dropdown closed by ESC key from textarea');
        return;
      }
      
      // Handle Ctrl+Enter to apply
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
      
      // For other keys, stop propagation to prevent Slack from intercepting
      e.stopPropagation();
    });
    
    textarea.addEventListener('keypress', (e) => {
      // Don't stop propagation for ESC key
      if (e.key !== 'Escape') {
        e.stopPropagation();
      }
    });
    
    textarea.addEventListener('keyup', (e) => {
      // Don't stop propagation for ESC key
      if (e.key !== 'Escape') {
        e.stopPropagation();
      }
    });
    
    textarea.addEventListener('input', (e) => {
      // Stop event propagation for input events
      e.stopPropagation();
    });
    
    textarea.addEventListener('focus', (e) => {
      console.log('🔧 Textarea focused');
      e.stopPropagation();
    });
    
    textarea.addEventListener('blur', (e) => {
      console.log('🔧 Textarea blurred');
      e.stopPropagation();
    });
    
    textarea.addEventListener('click', (e) => {
      console.log('🔧 Textarea clicked');
      e.stopPropagation();
      textarea.focus();
    });
    
    // Assemble the input container
    inputContainer.appendChild(textarea);
    
    dropdown.appendChild(inputContainer);
    
    // Focus on textarea after a short delay and ensure it's really focused
    setTimeout(() => {
      textarea.focus();
      textarea.click();
      console.log('🔧 Textarea focus attempted');
    }, 150);

    // Create menu items
    const menuItems = [
      {
        icon: '✏️',
        text: 'Rephrase'
      },
      {
        icon: '✨',
        text: 'Refine'
      },
      {
        icon: '🔧',
        text: 'Fix grammar'
      }
    ];

    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = 'slack-helper-dropdown-item';

      menuItem.innerHTML = `
        <span class="slack-helper-dropdown-icon">${item.icon}</span>
        <div class="slack-helper-dropdown-text">
          <div class="slack-helper-dropdown-title">
            ${item.text}
          </div>
        </div>
      `;

      // Add click handler
      menuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleRefineAction(item.text, button);
        this.hideRefineDropdown();
      });

      dropdown.appendChild(menuItem);
    });

    // Position dropdown relative to button
    const buttonRect = button.getBoundingClientRect();
    const buttonParent = button.parentElement;
    
    // Make sure parent has relative positioning
    if (getComputedStyle(buttonParent).position === 'static') {
      buttonParent.classList.add('slack-helper-relative');
    }

    buttonParent.appendChild(dropdown);

    // Store reference for cleanup
    this.currentDropdown = dropdown;

    // Add click outside listener to close dropdown
    setTimeout(() => {
      document.addEventListener('click', this.handleClickOutside);
      document.addEventListener('keydown', this.handleKeyDown);
    }, 0);

    console.log('✅ Refine dropdown shown');
  }

  /**
   * Handle custom prompt action
   * @param {string} customPrompt - The custom prompt text
   * @param {Element} button - The button that was clicked
   */
  handleCustomPrompt(customPrompt, button) {
    console.log('🔧 Custom prompt entered:', customPrompt);
    
    // Find the input element associated with this button
    const inputElement = this.findInputForButton(button);
    if (!inputElement) {
      console.log('❌ Could not find input element for button');
      return;
    }

    // Get current message content
    const currentText = inputElement.textContent || inputElement.value || '';
    
    if (!currentText.trim()) {
      alert('Please type a message first before applying custom prompt.');
      return;
    }

    // TODO: Implement actual AI processing with custom prompt
    // For now, show what would happen
    alert(`Custom Prompt: "${customPrompt}"\n\nOriginal: "${currentText}"\n\nThis feature will be implemented with AI integration.`);
  }

  /**
   * Hide the refine dropdown menu
   */
  hideRefineDropdown() {
    if (this.currentDropdown) {
      console.log('🔧 Hiding refine dropdown...');
      
      // Remove event listeners first
      document.removeEventListener('click', this.handleClickOutside);
      document.removeEventListener('keydown', this.handleKeyDown);
      console.log('🔧 Event listeners removed');
      
      // Remove expanded class before removing dropdown for smooth transition
      this.currentDropdown.classList.remove('slack-helper-refine-dropdown-expanded');
      
      // Small delay to allow transition to complete
      setTimeout(() => {
        if (this.currentDropdown) {
          this.currentDropdown.remove();
          this.currentDropdown = null;
          console.log('✅ Dropdown removed from DOM');
        }
      }, 100);
    }
  }

  /**
   * Handle click outside dropdown to close it
   * @param {Event} event - The click event
   */
  handleClickOutside(event) {
    if (this.currentDropdown && !this.currentDropdown.contains(event.target)) {
      // Check if the click was on a refine button
      const isRefineButton = event.target.closest('.slack-helper-refine-btn-toolbar');
      if (!isRefineButton) {
        this.hideRefineDropdown();
        console.log('🔒 Dropdown closed by click outside');
      }
    }
  }

  /**
   * Handle keyboard events for dropdown
   * @param {KeyboardEvent} event - The keyboard event
   */
  handleKeyDown(event) {
    if (this.currentDropdown && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.hideRefineDropdown();
      console.log('🔒 Dropdown closed by ESC key');
    }
  }

  /**
   * Handle refine action selection
   * @param {string} action - The selected action
   * @param {Element} button - The button that was clicked
   */
  handleRefineAction(action, button) {
    console.log('🔧 Refine action selected:', action);
    
    // Find the input element associated with this button
    const inputElement = this.findInputForButton(button);
    if (!inputElement) {
      console.log('❌ Could not find input element for button');
      return;
    }

    // Get current message content
    const currentText = inputElement.textContent || inputElement.value || '';
    
    if (!currentText.trim()) {
      alert('Please type a message first before refining it.');
      return;
    }

    // TODO: Implement actual AI refining logic
    // For now, show what would happen
    const actionMap = {
      'Rephrase': 'Rephrasing your message...',
      'Refine': 'Refining your message for better quality and clarity...',
      'Fix grammar': 'Fixing grammar and spelling...'
    };

    alert(`${actionMap[action] || 'Processing...'}\n\nOriginal: "${currentText}"\n\nThis feature will be implemented with AI integration.`);
  }

  /**
   * Find the input element associated with a button
   * @param {Element} button - The button element
   * @returns {Element|null} The associated input element
   */
  findInputForButton(button) {
    // Find the toolbar that contains this button
    const toolbar = button.closest('.c-wysiwyg_container__formatting') ||
                   button.closest('[role="toolbar"]') ||
                   button.closest('.slack-helper-right-wrapper')?.parentElement;
    
    if (!toolbar) {
      return null;
    }

    // Find the composer container
    const composer = toolbar.closest('[data-qa*="composer"]') ||
                     toolbar.closest('.c-composer') ||
                     toolbar.closest('.p-composer') ||
                     toolbar.parentElement;

    if (!composer) {
      return null;
    }

    // Find the input within the composer
    for (const selector of this.inputSelectors) {
      const input = composer.querySelector(selector);
      if (input) {
        return input;
      }
    }

    return null;
  }

  /**
   * Remove duplicate elements from an array
   * @param {Array<Element>} elements - Array of elements
   * @returns {Array<Element>} Array without duplicates
   */
  removeDuplicates(elements) {
    return [...new Set(elements)];
  }

  /**
   * Cleanup method
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    // Remove all toolbar button instances
    this.toolbarButtonInstances.forEach(button => {
      if (button.parentElement) {
        button.parentElement.removeChild(button);
      }
    });
    
    this.toolbarButtonInstances.clear();
    this.observedInputs.clear();
    this.initialized = false;
    
    console.log('🧹 MessageHelper destroyed');
  }
} 