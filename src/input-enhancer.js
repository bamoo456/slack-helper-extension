/**
 * Slack Input Enhancer Module
 * Handles detection of Slack input areas and adds enhancement buttons
 */

export class SlackInputEnhancer {
  constructor() {
    this.inputSelectors = [
      '[data-qa="message_input"]',
      '.c-texty_input_unstyled',
      '.ql-editor[role="textbox"]',
      '.c-texty_input__container [contenteditable="true"]'
    ];
    
    this.containerSelectors = [
      '.c-texty_input_unstyled__container',
      '.c-texty_input__container',
      '.ql-container'
    ];
    
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
    this.buttonInstances = new Map();
    this.toolbarButtonInstances = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the input enhancer
   */
  async init() {
    if (this.initialized) return;
    
    console.log('🔧 Initializing SlackInputEnhancer...');
    
    // Start observing for input elements
    this.startObserving();
    
    // Process existing inputs
    this.processExistingInputs();
    
    this.initialized = true;
    console.log('✅ SlackInputEnhancer initialized');
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

    // Find the toolbar for the input (preferred location)
    const toolbar = this.findToolbarForInput(inputElement);
    if (toolbar) {
      console.log('✅ Found toolbar for input, adding button to toolbar');
      this.addInputEventListeners(inputElement, null, toolbar);
      this.observedInputs.add(inputElement);
      return;
    }

    // Fallback: Find the container for the input
    const container = this.findInputContainer(inputElement);
    if (!container) {
      console.log('❌ No suitable container found for input');
      return;
    }

    // Add focus/blur event listeners to show/hide button
    this.addInputEventListeners(inputElement, container, null);
    
    // Mark as observed
    this.observedInputs.add(inputElement);
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
   * Find the container element for an input
   * @param {Element} inputElement - The input element
   * @returns {Element|null} The container element
   */
  findInputContainer(inputElement) {
    // Try to find the container using known selectors
    for (const selector of this.containerSelectors) {
      const container = inputElement.closest(selector);
      if (container) {
        return container;
      }
    }

    // Fallback: use the parent element
    return inputElement.parentElement;
  }

  /**
   * Add event listeners to an input element
   * @param {Element} inputElement - The input element
   * @param {Element} container - The container element (fallback)
   * @param {Element} toolbar - The toolbar element (preferred)
   */
  addInputEventListeners(inputElement, container, toolbar) {
    // Show button immediately for toolbar (persistent), on focus for container
    if (toolbar) {
      // For toolbar: show button immediately and keep it visible
      this.showRefineButtonInToolbar(inputElement, toolbar);
    } else {
      // For container: show/hide on focus/blur (original behavior)
      const showButton = () => {
        this.showRefineButton(inputElement, container);
      };

      const hideButton = () => {
        setTimeout(() => {
          if (document.activeElement !== inputElement && 
              !this.isRefineButtonFocused(container)) {
            this.hideRefineButton(container);
          }
        }, 150);
      };

      // Add event listeners for container mode
      inputElement.addEventListener('focus', showButton);
      inputElement.addEventListener('blur', hideButton);
      inputElement.addEventListener('input', showButton);
    }

    console.log('✅ Added event listeners to input element');
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
        // Ensure button is visible
        button.style.setProperty('display', 'inline-flex', 'important');
        button.style.setProperty('opacity', '1', 'important');
        button.style.setProperty('visibility', 'visible', 'important');
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
   * Show the refine message button
   * @param {Element} inputElement - The input element
   * @param {Element} container - The container element
   */
  showRefineButton(inputElement, container) {
    // Check if button already exists
    if (this.buttonInstances.has(container)) {
      const button = this.buttonInstances.get(container);
      if (button && button.parentElement) {
        button.style.display = 'block';
        return;
      }
    }

    // Create the button
    const button = this.createRefineButton();
    
    // Find the best position to insert the button
    const insertPosition = this.findButtonInsertPosition(container);
    if (insertPosition) {
      insertPosition.appendChild(button);
      this.buttonInstances.set(container, button);
      console.log('✅ Refine button shown');
    }
  }

  /**
   * Hide the refine message button
   * @param {Element} container - The container element
   */
  hideRefineButton(container) {
    const button = this.buttonInstances.get(container);
    if (button) {
      button.style.display = 'none';
      console.log('🔒 Refine button hidden');
    }
  }

  /**
   * Check if the refine button is currently focused
   * @param {Element} container - The container element
   * @returns {boolean} True if the button is focused
   */
  isRefineButtonFocused(container) {
    const button = this.buttonInstances.get(container);
    return button && (document.activeElement === button || button.contains(document.activeElement));
  }

  /**
   * Check if any toolbar refine button is currently focused
   * @returns {boolean} True if any toolbar button is focused
   */
  isAnyToolbarButtonFocused() {
    for (const button of this.toolbarButtonInstances.values()) {
      if (button && (document.activeElement === button || button.contains(document.activeElement))) {
        return true;
      }
    }
    return false;
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
    
    // Add styles to match Slack toolbar buttons with enhanced visibility
    Object.assign(button.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '28px',
      height: '28px',
      margin: '0 4px',
      backgroundColor: '#007a5a', // Green background to make it more visible
      border: '1px solid #007a5a',
      borderRadius: '4px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      color: 'white', // White icon for contrast
      opacity: '1',
      visibility: 'visible',
      flexShrink: '0', // Prevent shrinking
      position: 'relative',
      zIndex: '10'
    });
    
    // Force visibility with important styles
    button.style.setProperty('display', 'inline-flex', 'important');
    button.style.setProperty('opacity', '1', 'important');
    button.style.setProperty('visibility', 'visible', 'important');
    button.style.setProperty('background-color', '#007a5a', 'important');
    button.style.setProperty('color', 'white', 'important');

    // Add hover effects to match Slack style
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#005a3f';
      button.style.borderColor = '#005a3f';
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#007a5a';
      button.style.borderColor = '#007a5a';
      button.style.transform = 'scale(1)';
    });

    // Add click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleRefineClick(button);
    });

    return button;
  }

  /**
   * Create the refine message button
   * @returns {Element} The button element
   */
  createRefineButton() {
    const button = document.createElement('button');
    button.className = 'slack-helper-refine-btn';
    button.textContent = '✨ Refine Message';
    button.type = 'button';
    
    // Add styles
    Object.assign(button.style, {
      position: 'absolute',
      top: '8px',
      right: '8px',
      zIndex: '1000',
      padding: '4px 8px',
      fontSize: '12px',
      backgroundColor: '#007a5a',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontFamily: 'Slack-Lato, appleLogo, sans-serif',
      fontWeight: '600',
      transition: 'all 0.2s ease',
      display: 'block'
    });

    // Add hover effects
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#005a3f';
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#007a5a';
      button.style.transform = 'scale(1)';
    });

    // Add click handler (placeholder for now)
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
      rightWrapper.style.cssText = `
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 4px;
      `;
      toolbar.appendChild(rightWrapper);
      console.log('✅ Created right wrapper for button positioning');
    }
    
    return rightWrapper;
  }

  /**
   * Find the best position to insert the button
   * @param {Element} container - The container element
   * @returns {Element|null} The element to insert the button into
   */
  findButtonInsertPosition(container) {
    // Make sure the container has relative positioning for absolute button positioning
    const computedStyle = window.getComputedStyle(container);
    if (computedStyle.position === 'static') {
      container.style.position = 'relative';
    }

    return container;
  }

  /**
   * Handle refine button click
   * @param {Element} button - The clicked button
   */
  handleRefineClick(button) {
    console.log('🔧 Refine message button clicked');
    
    // Add visual feedback
    button.style.backgroundColor = '#004d3d';
    setTimeout(() => {
      button.style.backgroundColor = '#007a5a';
    }, 200);

    // TODO: Implement refine message logic
    // For now, just show an alert
    alert('Refine message functionality will be implemented here!');
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
    
    // Remove all button instances
    this.buttonInstances.forEach(button => {
      if (button.parentElement) {
        button.parentElement.removeChild(button);
      }
    });
    
    this.toolbarButtonInstances.forEach(button => {
      if (button.parentElement) {
        button.parentElement.removeChild(button);
      }
    });
    
    this.buttonInstances.clear();
    this.toolbarButtonInstances.clear();
    this.observedInputs.clear();
    this.initialized = false;
    
    console.log('🧹 SlackInputEnhancer destroyed');
  }
} 