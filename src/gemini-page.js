/**
 * Gemini Page Functions - 在 Gemini 頁面中執行的函數
 * 這些函數會被注入到 Gemini 頁面中執行
 */

/**
 * 在 Gemini 頁面中貼上訊息
 * @param {string} messages - 要貼上的訊息
 */
export function pasteMessagesIntoGemini(messages) {
  function findTextArea() {
    // 嘗試多種可能的文字輸入區域選擇器
    const selectors = [
      'div[contenteditable="true"]',
      'textarea',
      '[data-testid="chat-input"]',
      '.ql-editor',
      '[role="textbox"]',
      '.chat-input',
      'input[type="text"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) { // 確保元素可見
        return element;
      }
    }
    return null;
  }

  function waitForTextArea(maxAttempts = 10, attempt = 0) {
    const textArea = findTextArea();
    
    if (textArea) {
      // 聚焦到文字區域
      textArea.focus();
      
      // 根據元素類型設置文字
      if (textArea.tagName === 'TEXTAREA' || textArea.tagName === 'INPUT') {
        textArea.value = messages;
        textArea.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (textArea.contentEditable === 'true') {
        textArea.textContent = messages;
        textArea.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // 模擬用戶操作以觸發相關事件
      setTimeout(() => {
        textArea.dispatchEvent(new Event('change', { bubbles: true }));
        textArea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }, 500);

      console.log('Messages pasted into Gemini successfully');
      return true;
    } else if (attempt < maxAttempts) {
      console.log(`Attempt ${attempt + 1}: Text area not found, retrying...`);
      setTimeout(() => waitForTextArea(maxAttempts, attempt + 1), 1000);
    } else {
      console.error('Could not find text input area in Gemini');
      // 作為備選方案，複製到剪貼板
      if (navigator.clipboard) {
        navigator.clipboard.writeText(messages).then(() => {
          alert('無法自動貼上訊息，已複製到剪貼板。請手動貼上 (Ctrl+V)');
        });
      }
    }
  }

  // 等待頁面完全載入
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForTextArea());
  } else {
    waitForTextArea();
  }
}

/**
 * 在Gemini頁面中執行的模型檢測函數
 * 注意：這個函數會在頁面中執行，需要先注入 InjectedUtils
 */
export function extractAvailableModels() {
  console.log('開始檢測 Gemini 可用模型...');
  
  // 檢查 InjectedUtils 是否可用
  if (typeof window.InjectedUtils === 'undefined') {
    console.error('InjectedUtils 未找到，無法執行模型檢測');
    return Promise.resolve([]);
  }
  
  const { sleep } = window.InjectedUtils;
  
  // 首先嘗試點擊模型切換按鈕來打開選單
  const modeSwitcherSelectors = [
    'bard-mode-switcher button',
    '[data-test-id="bard-mode-menu-button"]',
    '.logo-pill-btn',
    'button[class*="logo-pill"]',
    'button[class*="mode-switch"]'
  ];
  
  let modeSwitcherButton = null;
  for (const selector of modeSwitcherSelectors) {
    modeSwitcherButton = document.querySelector(selector);
    if (modeSwitcherButton) {
      console.log(`找到模型切換按鈕: ${selector}`);
      break;
    }
  }
  
  if (!modeSwitcherButton) {
    return Promise.resolve([]); // Return empty array if no models detected
  }
  
  // 點擊按鈕打開選單
  modeSwitcherButton.click();
  
  // 等待選單出現並檢測模型
  return sleep(1500).then(() => {
    const menuSelectors = [
      'mat-menu',
      '[role="menu"]',
      '.mat-mdc-menu-panel',
      '.mdc-menu-surface'
    ];
    
    let menu = null;
    for (const selector of menuSelectors) {
      menu = document.querySelector(selector);
      if (menu && menu.offsetParent !== null) {
        console.log(`找到模型選單: ${selector}`);
        break;
      }
    }
    
    if (!menu) {
      return [];
    }
    
    // 提取所有模型選項
    const menuItems = menu.querySelectorAll('button, [role="menuitem"], mat-option, .mat-mdc-menu-item');
    const models = [];
    
    menuItems.forEach((item, index) => {
      const itemText = item.textContent.trim();
      console.log(`檢測到模型選項 ${index + 1}: ${itemText}`);
      
      if (itemText && itemText.length > 0) {
        // 嘗試解析模型名稱
        let value = '';
        let displayName = itemText;
        
        // 根據文字內容推斷模型類型
        if (itemText.toLowerCase().includes('flash') || itemText.includes('2.5') && itemText.toLowerCase().includes('flash')) {
          value = 'gemini-2.5-flash';
          if (!displayName.includes('⚡')) {
            displayName = `⚡ ${displayName}`;
          }
        } else if (itemText.toLowerCase().includes('pro') || itemText.includes('2.5') && itemText.toLowerCase().includes('pro')) {
          value = 'gemini-2.5-pro';
          if (!displayName.includes('🧠')) {
            displayName = `🧠 ${displayName}`;
          }
        } else {
          // 對於未知模型，使用文字內容作為 value
          value = itemText.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          displayName = itemText;
        }
        
        models.push({
          value: value,
          displayName: displayName,
          originalText: itemText
        });
      }
    });
    
    console.log(`檢測到 ${models.length} 個模型:`, models);
    
    // 延遲關閉選單，確保有足夠時間讓後續操作使用
    return sleep(500).then(() => {
      try {
        // 關閉選單（點擊其他地方）
        document.body.click();
        console.log('模型選單已關閉');
      } catch (error) {
        console.log('關閉選單時發生錯誤，但不影響功能:', error);
      }
      
      return models.length > 0 ? models : []; // Return empty array if no models detected
    });
  });
}

/**
 * 在Gemini頁面中執行的模型切換和訊息貼上函數
 * @param {string} targetModelDisplayName - 目標模型顯示名稱
 * @param {string} messages - 要貼上的訊息
 */
export function switchModelAndPasteMessages(targetModelDisplayName, messages) {
  console.log(`Attempting to switch to model: ${targetModelDisplayName}`);
  
  /**
   * Local copy of pasteMessagesIntoGemini
   * 這段程式碼必須與 switchModelAndPasteMessages 一起被注入到 Gemini 頁面，
   * 因此放在函式內部以確保作用域完整，避免 ReferenceError。
   * @param {string} msgs - 要貼上的訊息
   */
  function pasteMessagesIntoGemini(msgs) {
    function findTextArea() {
      const selectors = [
        'div[contenteditable="true"]',
        'textarea',
        '[data-testid="chat-input"]',
        '.ql-editor',
        '[role="textbox"]',
        '.chat-input',
        'input[type="text"]'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) {
          return element;
        }
      }
      return null;
    }

    function waitForTextArea(maxAttempts = 10, attempt = 0) {
      const textArea = findTextArea();

      if (textArea) {
        textArea.focus();

        if (textArea.tagName === 'TEXTAREA' || textArea.tagName === 'INPUT') {
          textArea.value = msgs;
          textArea.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (textArea.contentEditable === 'true') {
          textArea.textContent = msgs;
          textArea.dispatchEvent(new Event('input', { bubbles: true }));
        }

        setTimeout(() => {
          textArea.dispatchEvent(new Event('change', { bubbles: true }));
          textArea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }, 500);

        console.log('Messages pasted into Gemini successfully (local)');
        return true;
      }

      if (attempt < maxAttempts) {
        console.log(`Attempt ${attempt + 1}: Text area not found, retrying...`);
        setTimeout(() => waitForTextArea(maxAttempts, attempt + 1), 1000);
      } else {
        console.error('Could not find text input area in Gemini');
        if (navigator.clipboard) {
          navigator.clipboard.writeText(msgs).then(() => {
            alert('無法自動貼上訊息，已複製到剪貼簿。請手動貼上 (Ctrl+V)');
          });
        }
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => waitForTextArea());
    } else {
      waitForTextArea();
    }
  }

  function findAndClickModelSwitcher() {
    // 尋找模型切換按鈕
    const modeSwitcherSelectors = [
      'bard-mode-switcher button',
      '[data-test-id="bard-mode-menu-button"]',
      '.logo-pill-btn',
      'button[class*="logo-pill"]',
      'button[class*="mode-switch"]'
    ];
    
    let modeSwitcherButton = null;
    for (const selector of modeSwitcherSelectors) {
      modeSwitcherButton = document.querySelector(selector);
      if (modeSwitcherButton) {
        console.log(`Found mode switcher with selector: ${selector}`);
        break;
      }
    }
    
    if (modeSwitcherButton) {
      // 點擊模型切換按鈕
      modeSwitcherButton.click();
      console.log('Clicked mode switcher button');
      
      // 等待下拉選單出現
      setTimeout(() => {
        findAndSelectModel(targetModelDisplayName);
      }, 1000);
      
      return true;
    } else {
      console.log('Mode switcher button not found');
      return false;
    }
  }
  
  function findAndSelectModel(modelDisplayName) {
    // 尋找模型選項
    const menuSelectors = [
      'mat-menu',
      '[role="menu"]',
      '.mat-mdc-menu-panel',
      '.mdc-menu-surface'
    ];
    
    let menu = null;
    for (const selector of menuSelectors) {
      menu = document.querySelector(selector);
      if (menu && menu.offsetParent !== null) { // 確保選單可見
        console.log(`Found menu with selector: ${selector}`);
        break;
      }
    }
    
    if (menu) {
      // 在選單中尋找目標模型
      const menuItems = menu.querySelectorAll('button, [role="menuitem"], mat-option, .mat-mdc-menu-item');
      
      for (const item of menuItems) {
        const itemText = item.textContent.trim();
        console.log(`Checking menu item: ${itemText}`);
        
        // 檢查是否包含目標模型名稱
        if (itemText.includes(modelDisplayName) || 
            itemText.includes(modelDisplayName.replace('.', '')) ||
            itemText.toLowerCase().includes(modelDisplayName.toLowerCase())) {
          
          console.log(`Found matching model option: ${itemText}`);
          item.click();
          
          // 等待模型切換完成後再貼上訊息
          setTimeout(() => {
            pasteMessagesIntoGemini(messages);
          }, 2000);
          
          return true;
        }
      }
      
      console.log(`Model "${modelDisplayName}" not found in menu options`);
      // 如果找不到指定模型，直接貼上訊息
      setTimeout(() => {
        pasteMessagesIntoGemini(messages);
      }, 1000);
      
    } else {
      console.log('Model selection menu not found');
      // 如果找不到選單，直接貼上訊息
      setTimeout(() => {
        pasteMessagesIntoGemini(messages);
      }, 1000);
    }
  }
  
  // 開始執行模型切換
  if (!findAndClickModelSwitcher()) {
    // 如果找不到模型切換器，直接貼上訊息
    console.log('Falling back to direct message pasting');
    setTimeout(() => {
      pasteMessagesIntoGemini(messages);
    }, 1000);
  }
} 