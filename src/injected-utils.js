/**
 * 注入到頁面中的工具函數
 * 這些函數會在頁面上下文中可用，供其他注入的腳本使用
 */

// 將工具函數掛載到 window 對象上，使其在頁面中全局可用
window.InjectedUtils = {
  /**
   * 創建一個延遲 Promise
   * @param {number} ms - 延遲毫秒數
   * @returns {Promise<void>}
   */
  sleep: function(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * 等待條件滿足
   * @param {Function} condition - 檢查條件的函數
   * @param {Object} options - 配置選項
   * @returns {Promise<void>}
   */
  waitForCondition: async function(condition, options = {}) {
    const {
      maxAttempts = 10,
      intervalMs = 500,
      operationName = '條件檢查'
    } = options;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`${operationName} 第 ${attempt}/${maxAttempts} 次檢查...`);
        
        if (await condition()) {
          console.log(`✅ ${operationName} 條件滿足，第 ${attempt} 次嘗試成功`);
          return;
        }
        
        if (attempt < maxAttempts) {
          console.log(`❌ ${operationName} 條件未滿足，等待 ${intervalMs}ms 後重試...`);
          await this.sleep(intervalMs);
        }
      } catch (error) {
        console.warn(`${operationName} 第 ${attempt} 次檢查時發生錯誤:`, error);
        
        if (attempt < maxAttempts) {
          await this.sleep(intervalMs);
        }
      }
    }
    
    throw new Error(`${operationName} 在 ${maxAttempts} 次嘗試後條件仍未滿足`);
  },

  /**
   * 創建一個超時 Promise
   * @param {number} ms - 超時毫秒數
   * @param {string} errorMessage - 超時錯誤訊息
   * @returns {Promise<never>}
   */
  createTimeoutPromise: function(ms, errorMessage = '操作超時') {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), ms)
    );
  },

  /**
   * 為 Promise 添加超時控制
   * @param {Promise} promise - 要執行的 Promise
   * @param {number} timeoutMs - 超時毫秒數
   * @param {string} errorMessage - 超時錯誤訊息
   * @returns {Promise}
   */
  withTimeout: function(promise, timeoutMs, errorMessage = '操作超時') {
    return Promise.race([
      promise,
      this.createTimeoutPromise(timeoutMs, errorMessage)
    ]);
  }
};

console.log('✅ InjectedUtils 已載入到頁面中'); 