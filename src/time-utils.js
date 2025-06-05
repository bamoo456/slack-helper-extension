/**
 * Time Utilities - 時間相關的工具函數
 * 統一管理 setTimeout, Promise.race 超時控制等時間相關操作
 */

/**
 * 創建一個延遲 Promise
 * @param {number} ms - 延遲毫秒數
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 創建一個超時 Promise（用於 Promise.race）
 * @param {number} ms - 超時毫秒數
 * @param {string} errorMessage - 超時錯誤訊息
 * @returns {Promise<never>}
 */
export function createTimeoutPromise(ms, errorMessage = '操作超時') {
  return new Promise((_, reject) => 
    setTimeout(() => reject(new Error(errorMessage)), ms)
  );
}

/**
 * 為 Promise 添加超時控制
 * @param {Promise} promise - 要執行的 Promise
 * @param {number} timeoutMs - 超時毫秒數
 * @param {string} errorMessage - 超時錯誤訊息
 * @returns {Promise} - 帶超時控制的 Promise
 */
export function withTimeout(promise, timeoutMs, errorMessage = '操作超時') {
  return Promise.race([
    promise,
    createTimeoutPromise(timeoutMs, errorMessage)
  ]);
}

/**
 * 重試機制 - 在失敗時重試指定次數
 * @param {Function} fn - 要執行的異步函數
 * @param {number} maxAttempts - 最大嘗試次數
 * @param {number} delayMs - 重試間隔毫秒數
 * @param {string} operationName - 操作名稱（用於日誌）
 * @returns {Promise} - 執行結果
 */
export async function retry(fn, maxAttempts = 3, delayMs = 1000, operationName = '操作') {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`${operationName} 嘗試 ${attempt}/${maxAttempts}`);
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`${operationName} 第 ${attempt} 次嘗試失敗:`, error.message);
      
      if (attempt < maxAttempts) {
        console.log(`等待 ${delayMs}ms 後重試...`);
        await sleep(delayMs);
      }
    }
  }
  
  throw new Error(`${operationName} 在 ${maxAttempts} 次嘗試後仍然失敗: ${lastError.message}`);
}

/**
 * 防抖函數 - 在指定時間內只執行最後一次調用
 * @param {Function} fn - 要防抖的函數
 * @param {number} delayMs - 防抖延遲毫秒數
 * @returns {Function} - 防抖後的函數
 */
export function debounce(fn, delayMs) {
  let timeoutId;
  
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delayMs);
  };
}

/**
 * 節流函數 - 在指定時間內最多執行一次
 * @param {Function} fn - 要節流的函數
 * @param {number} intervalMs - 節流間隔毫秒數
 * @returns {Function} - 節流後的函數
 */
export function throttle(fn, intervalMs) {
  let lastCallTime = 0;
  let timeoutId;
  
  return function(...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    
    if (timeSinceLastCall >= intervalMs) {
      lastCallTime = now;
      fn.apply(this, args);
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        fn.apply(this, args);
      }, intervalMs - timeSinceLastCall);
    }
  };
}

/**
 * 等待條件滿足 - 輪詢檢查條件直到滿足或超時
 * @param {Function} condition - 檢查條件的函數，返回 boolean
 * @param {Object} options - 配置選項
 * @param {number} options.maxAttempts - 最大嘗試次數，默認 10
 * @param {number} options.intervalMs - 檢查間隔毫秒數，默認 500
 * @param {string} options.operationName - 操作名稱，默認 '條件檢查'
 * @returns {Promise<void>} - 條件滿足時解析
 */
export async function waitForCondition(condition, options = {}) {
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
        await sleep(intervalMs);
      }
    } catch (error) {
      console.warn(`${operationName} 第 ${attempt} 次檢查時發生錯誤:`, error);
      
      if (attempt < maxAttempts) {
        await sleep(intervalMs);
      }
    }
  }
  
  throw new Error(`${operationName} 在 ${maxAttempts} 次嘗試後條件仍未滿足`);
}

/**
 * 延遲執行函數 - 在指定時間後執行函數
 * @param {Function} fn - 要執行的函數
 * @param {number} delayMs - 延遲毫秒數
 * @returns {Promise} - 執行結果
 */
export async function delayedExecution(fn, delayMs) {
  await sleep(delayMs);
  return await fn();
}

/**
 * 創建一個可取消的延遲
 * @param {number} ms - 延遲毫秒數
 * @returns {Object} - 包含 promise 和 cancel 方法的對象
 */
export function createCancellableDelay(ms) {
  let timeoutId;
  let cancelled = false;
  
  const promise = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      if (!cancelled) {
        resolve();
      }
    }, ms);
  });
  
  const cancel = () => {
    cancelled = true;
    clearTimeout(timeoutId);
  };
  
  return { promise, cancel };
}

/**
 * 批量執行帶延遲的操作
 * @param {Array} items - 要處理的項目數組
 * @param {Function} processor - 處理函數
 * @param {number} delayMs - 每次操作間的延遲毫秒數
 * @param {number} batchSize - 批次大小，默認 1
 * @returns {Promise<Array>} - 處理結果數組
 */
export async function batchProcessWithDelay(items, processor, delayMs, batchSize = 1) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
    
    // 如果不是最後一批，添加延遲
    if (i + batchSize < items.length) {
      await sleep(delayMs);
    }
  }
  
  return results;
}

/**
 * 常用的時間常數
 */
export const TIME_CONSTANTS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000
};

/**
 * 格式化時間差
 * @param {number} ms - 毫秒數
 * @returns {string} - 格式化的時間字符串
 */
export function formatTimeDiff(ms) {
  if (ms < TIME_CONSTANTS.MINUTE) {
    return `${Math.round(ms / TIME_CONSTANTS.SECOND)} 秒`;
  } else if (ms < TIME_CONSTANTS.HOUR) {
    return `${Math.round(ms / TIME_CONSTANTS.MINUTE)} 分鐘`;
  } else if (ms < TIME_CONSTANTS.DAY) {
    return `${Math.round(ms / TIME_CONSTANTS.HOUR)} 小時`;
  } else {
    return `${Math.round(ms / TIME_CONSTANTS.DAY)} 天`;
  }
} 