/**
 * Thread Scroll Collector Module
 * Handles automatic scrolling and message collection for complete thread extraction
 */

export class ThreadScrollCollector {
  constructor(domDetector, textExtractor, progressCallback = null, messageProcessor = null, configManager = null) {
    this.domDetector = domDetector;
    this.textExtractor = textExtractor;
    this.messageProcessor = messageProcessor;
    this.progressCallback = progressCallback;
    this.configManager = configManager;
    
    // 預設值（如果沒有配置管理器）
    this.defaultScrollSettings = {
      scrollDelay: 400,
      maxScrollAttempts: 300,  // 增加最大滾動次數以支援長討論串
      noMaxNewMessagesCount: 12,  // 增加容忍度
      scrollStep: 600,
      minScrollAmount: 100
    };
    
    // 初始化滾動參數
    this.scrollSettings = { ...this.defaultScrollSettings };
    
    // 載入配置
    this.loadScrollSettings();
  }

  /**
   * 載入滾動設定
   */
  async loadScrollSettings() {
    if (this.configManager) {
      try {
        const settings = await this.configManager.getScrollSettings();
        this.scrollSettings = { ...this.defaultScrollSettings, ...settings };
        console.log('已載入滾動設定:', this.scrollSettings);
      } catch (error) {
        console.warn('載入滾動設定失敗，使用預設值:', error);
        this.scrollSettings = { ...this.defaultScrollSettings };
      }
    }
  }

  /**
   * 更新滾動設定
   * @param {Object} newSettings 新的滾動設定
   * @returns {Promise<boolean>} 是否成功更新
   */
  async updateScrollSettings(newSettings) {
    this.scrollSettings = { ...this.scrollSettings, ...newSettings };
    
    if (this.configManager) {
      return await this.configManager.updateScrollSettings(newSettings);
    }
    
    return true;
  }

  /**
   * 重置滾動設定為預設值
   * @returns {Promise<boolean>} 是否成功重置
   */
  async resetScrollSettings() {
    this.scrollSettings = { ...this.defaultScrollSettings };
    
    if (this.configManager) {
      return await this.configManager.resetScrollSettings();
    }
    
    return true;
  }

  /**
   * 獲取當前滾動設定
   * @returns {Object} 當前的滾動設定
   */
  getScrollSettings() {
    return { ...this.scrollSettings };
  }

  /**
   * 自動滾動並收集完整的Thread訊息
   * @returns {Promise<Array>} 完整的訊息列表
   */
  async collectCompleteThreadMessages() {
    console.log('開始收集完整Thread訊息...');
    
    const threadContainer = this.domDetector.findThreadContainer();
    if (!threadContainer) {
      throw new Error('未找到Thread容器');
    }

    try {
      // 找到滾動容器
      const scrollContainer = this.findScrollContainer(threadContainer);
      if (!scrollContainer) {
        console.warn('未找到滾動容器，使用當前可見訊息');
        return this.extractCurrentMessages(true);
      }

      console.log('找到滾動容器，開始自動滾動收集訊息');
      
      // 先滾動到頂部
      await this.scrollToTop(scrollContainer);
      
      // 設置超時機制（最多5分鐘）
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('滾動收集超時')), 5 * 60 * 1000);
      });
      
      // 逐步滾動並收集訊息
      const allMessages = await Promise.race([
        this.scrollAndCollectMessages(scrollContainer),
        timeoutPromise
      ]);
      
      // 如果自動滾動收集的訊息太少，回退到原方法
      if (allMessages.length === 0) {
        console.warn('自動滾動未收集到訊息，回退到原方法');
        return this.extractCurrentMessages(true);
      }
      
      console.log(`完成訊息收集，共收集到 ${allMessages.length} 條訊息`);
      return allMessages;
      
    } catch (error) {
      console.error('自動滾動收集訊息時發生錯誤:', error);
      console.log('回退到原方法收集當前可見訊息');
      return this.extractCurrentMessages(true);
    }
  }

  /**
   * 找到Thread的滾動容器
   * @param {Element} threadContainer 
   * @returns {Element|null}
   */
  findScrollContainer(threadContainer) {
    // 常見的Slack滾動容器選擇器，按優先級排序
    const scrollSelectors = [
      '.c-virtual_list__scroll_container[role="list"]', // 虛擬滾動列表
      '.c-virtual_list__scroll_container',
      '.c-scrollbar__hider',
      '[data-qa="slack_kit_scrollbar"]',
      '.c-virtual_list.c-scrollbar', // 虛擬滾動容器
      '.p-thread_view__messages',
      '.p-threads_flexpane__content'
    ];

    for (const selector of scrollSelectors) {
      const container = threadContainer.querySelector(selector);
      if (container && this.isScrollable(container)) {
        console.log(`找到滾動容器: ${selector}`, {
          scrollHeight: container.scrollHeight,
          clientHeight: container.clientHeight,
          scrollTop: container.scrollTop
        });
        return container;
      }
    }

    // 特別檢查虛擬滾動容器
    const virtualList = threadContainer.querySelector('.c-virtual_list');
    if (virtualList) {
      console.log('找到虛擬滾動容器，檢查其滾動能力');
      if (this.isScrollable(virtualList)) {
        console.log('虛擬滾動容器可滾動');
        return virtualList;
      }
      
      // 檢查虛擬滾動容器的父元素
      const parent = virtualList.parentElement;
      if (parent && this.isScrollable(parent)) {
        console.log('使用虛擬滾動容器的父元素作為滾動容器');
        return parent;
      }
    }

    // 如果沒找到特定容器，檢查threadContainer本身是否可滾動
    if (this.isScrollable(threadContainer)) {
      console.log('使用Thread容器本身作為滾動容器');
      return threadContainer;
    }

    console.log('未找到合適的滾動容器');
    return null;
  }

  /**
   * 檢查元素是否可滾動
   * @param {Element} element 
   * @returns {boolean}
   */
  isScrollable(element) {
    const style = window.getComputedStyle(element);
    const hasScrollableContent = element.scrollHeight > element.clientHeight;
    const hasScrollableStyle = style.overflowY === 'scroll' || 
                              style.overflowY === 'auto' || 
                              style.overflow === 'scroll' || 
                              style.overflow === 'auto';
    
    return hasScrollableContent && hasScrollableStyle;
  }

  /**
   * 滾動到頂部
   * @param {Element} scrollContainer 
   */
  async scrollToTop(scrollContainer) {
    console.log('滾動到頂部...');
    
    // 滾動到頂部
    scrollContainer.scrollTop = 0;
    
    // 等待滾動完成
    await this.waitForScrollComplete();
    
    // 等待虛擬列表更新
    await this.waitForVirtualListUpdate();
    
    console.log('已滾動到頂部');
  }

  /**
   * 滾動並收集訊息
   * @param {Element} scrollContainer 
   * @returns {Promise<Array>}
   */
  async scrollAndCollectMessages(scrollContainer) {
    return await this.standardScrollAndCollect(scrollContainer);
  }

  /**
   * 標準滾動收集方法
   * @param {Element} scrollContainer 
   * @returns {Promise<Array>}
   */
  async standardScrollAndCollect(scrollContainer) {
    const allMessages = new Map();
    let scrollAttempts = 0;
    let noNewMessagesCount = 0;
    let lastScrollTop = -1;
    let stuckScrollCount = 0;
    
    console.log(`開始標準滾動收集，初始滾動高度: ${scrollContainer.scrollHeight}px`);

    while (scrollAttempts < this.scrollSettings.maxScrollAttempts) {
      const currentScrollTop = scrollContainer.scrollTop;
      const currentScrollHeight = scrollContainer.scrollHeight;
      const currentTotalScrollHeight = currentScrollHeight - scrollContainer.clientHeight;
      
      // 提取當前可見的訊息
      const currentMessages = this.extractCurrentMessages();
      const previousSize = allMessages.size;
      
      // 添加新訊息到集合中
      currentMessages.forEach(message => {
        const messageId = this.generateMessageId(message);
        if (!allMessages.has(messageId)) {
          allMessages.set(messageId, message);
        }
      });

      const newMessagesAdded = allMessages.size - previousSize;
      const currentProgress = currentTotalScrollHeight > 0 ? Math.min(currentScrollTop / currentTotalScrollHeight, 1) : 0;
      const progressPercentage = Math.round(currentProgress * 100);
      
      console.log(`滾動第 ${scrollAttempts + 1} 次: 新增 ${newMessagesAdded} 條，總計 ${allMessages.size} 條，進度 ${progressPercentage}%，當前高度: ${currentScrollHeight}px`);
      this.showScrollProgress(progressPercentage, allMessages.size);

      // 檢查滾動是否卡住
      if (Math.abs(currentScrollTop - lastScrollTop) < 5) {
        stuckScrollCount++;
        console.log(`滾動位置變化很小，卡住計數: ${stuckScrollCount}`);
      } else {
        stuckScrollCount = 0;
      }
      lastScrollTop = currentScrollTop;

      // 檢查是否需要停止滾動
      if (newMessagesAdded === 0) {
        noNewMessagesCount++;
        console.log(`未發現新訊息，計數: ${noNewMessagesCount}/${this.scrollSettings.noMaxNewMessagesCount}`);
        
        // 對於長討論串，增加容忍度
        const maxNoNewMessages = allMessages.size > 50 ? 
          Math.max(this.scrollSettings.noMaxNewMessagesCount, 15) : 
          this.scrollSettings.noMaxNewMessagesCount;
          
        if (noNewMessagesCount >= maxNoNewMessages) {
          console.log('連續多次未發現新訊息，停止滾動');
          break;
        }
      } else {
        noNewMessagesCount = 0;
      }

      // 如果滾動卡住太久，嘗試更大的滾動步長
      if (stuckScrollCount >= 3) {
        console.log('檢測到滾動卡住，嘗試更大步長');
        scrollContainer.scrollTop = currentScrollTop + this.scrollSettings.scrollStep * 2;
        stuckScrollCount = 0;
      } else {
        // 計算下一次滾動的距離
        const scrollAmount = this.calculateScrollAmount(scrollContainer, currentScrollTop, currentTotalScrollHeight);
        scrollContainer.scrollTop = currentScrollTop + scrollAmount;
      }
      
      // 等待滾動完成和虛擬列表更新
      await this.waitForScrollComplete();
      await this.waitForVirtualListUpdate();
      
      // 更寬鬆的底部檢測 - 考慮虛擬滾動的動態性
      const isNearBottom = currentScrollTop >= currentTotalScrollHeight - 50;
      const hasReachedActualBottom = currentScrollTop + scrollContainer.clientHeight >= currentScrollHeight - 20;
      
      if (isNearBottom || hasReachedActualBottom) {
        console.log('接近或到達底部，進行最終檢查...');
        
        // 嘗試再滾動一點，確保真的到底了
        const beforeFinalScroll = scrollContainer.scrollTop;
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        await this.waitForScrollComplete();
        await this.waitForVirtualListUpdate();
        
        // 最終訊息收集
        const finalMessages = this.extractCurrentMessages();
        finalMessages.forEach(message => {
          const messageId = this.generateMessageId(message);
          if (!allMessages.has(messageId)) {
            allMessages.set(messageId, message);
          }
        });
        
        // 如果滾動位置沒有變化，說明真的到底了
        if (Math.abs(scrollContainer.scrollTop - beforeFinalScroll) < 10) {
          console.log('確認已到達底部，結束滾動');
          break;
        }
      }
      
      scrollAttempts++;
    }

    console.log(`滾動收集完成，總共進行了 ${scrollAttempts} 次滾動，收集到 ${allMessages.size} 條訊息`);
    return this.finalizeMessages(allMessages);
  }

  /**
   * 最終處理訊息列表
   * @param {Map} allMessages 
   * @returns {Array}
   */
  finalizeMessages(allMessages) {
    const messageArray = Array.from(allMessages.values());
    
    console.log(`原始訊息數量: ${messageArray.length}`);
    
    // 如果有訊息處理器，使用它來處理訊息
    if (this.messageProcessor) {
      const processedMessages = this.messageProcessor.processMessages(messageArray);
      console.log(`處理後訊息數量: ${processedMessages.length}`);
      return processedMessages;
    }
    
    return messageArray;
  }

  /**
   * 提取當前可見的訊息
   * @param {boolean} verbose 
   * @returns {Array}
   */
  extractCurrentMessages(verbose = false) {
    const messageElements = this.domDetector.findMessageElements(false);
    const rawMessages = [];

    if (verbose) {
      console.log(`找到 ${messageElements.length} 個訊息元素`);
    }

    messageElements.forEach((messageEl, index) => {
      try {
        // 檢查元素是否可見
        const rect = messageEl.getBoundingClientRect();
        const isVisible = rect.height > 0 && rect.width > 0;
        
        if (!isVisible) {
          return;
        }

        const message = this.textExtractor.extractSingleMessage(messageEl);
        if (message && message.text && message.text.trim().length > 0) {
          rawMessages.push(message);
        }
      } catch (error) {
        if (verbose) {
          console.log(`提取訊息 ${index + 1} 時發生錯誤:`, error);
        }
      }
    });

    if (verbose) {
      console.log(`成功提取 ${rawMessages.length} 條有效訊息`);
    }

    return rawMessages;
  }

  /**
   * 生成訊息的唯一ID
   * @param {Object} message 
   * @returns {string}
   */
  generateMessageId(message) {
    // 使用文本內容的前100個字符和用戶名來生成ID
    const textPreview = message.text.substring(0, 100).replace(/\s+/g, ' ').trim();
    const userPart = message.user || 'unknown';
    const timePart = message.timestamp || 'no-time';
    
    return `${userPart}:${timePart}:${textPreview}`;
  }

  /**
   * 等待滾動完成
   */
  async waitForScrollComplete() {
    await new Promise(resolve => setTimeout(resolve, this.scrollSettings.scrollDelay));
  }

  /**
   * 等待虛擬列表更新
   */
  async waitForVirtualListUpdate() {
    // 虛擬列表可能需要額外時間來渲染新內容
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  /**
   * 計算滾動距離
   * @param {Element} scrollContainer 
   * @param {number} _currentScrollTop 
   * @param {number} _totalScrollHeight 
   * @returns {number}
   */
  calculateScrollAmount(scrollContainer, _currentScrollTop, _totalScrollHeight) {
    // 基本滾動步長
    let scrollAmount = this.scrollSettings.scrollStep;
    
    // 根據容器高度調整滾動步長
    const containerHeight = scrollContainer.clientHeight;
    if (containerHeight > 800) {
      scrollAmount = Math.max(scrollAmount, containerHeight * 0.8);
    }
    
    return scrollAmount;
  }

  /**
   * 顯示滾動進度
   * @param {number} progressPercentage 
   * @param {number} messageCount 
   */
  showScrollProgress(progressPercentage, messageCount) {
    if (this.progressCallback) {
      this.progressCallback(progressPercentage, messageCount);
    }
  }
} 