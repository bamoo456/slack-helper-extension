/**
 * Simplified Content Script for Dynamic Injection
 * This is a fallback script that can be dynamically injected when the modular version fails
 */

console.log('Slack Helper injection script loaded');

// Simple thread detection for popup status check
function checkThreadAvailable() {
  try {
    // Basic thread container detection
    const threadSelectors = [
      '[data-qa="thread_view"]',
      '.p-thread_view',
      '[data-qa="thread-messages"]',
      '.c-virtual_list__scroll_container'
    ];
    
    let threadContainer = null;
    for (const selector of threadSelectors) {
      threadContainer = document.querySelector(selector);
      if (threadContainer) break;
    }
    
    if (!threadContainer) {
      return { hasThread: false };
    }
    
    // Basic message detection
    const messageSelectors = [
      '[data-qa="virtual-list-item"]',
      '.c-virtual_list__item',
      '[data-qa="message"]',
      '.c-message_kit__background'
    ];
    
    let messages = [];
    for (const selector of messageSelectors) {
      messages = threadContainer.querySelectorAll(selector);
      if (messages.length > 0) break;
    }
    
    console.log('Thread container found:', !!threadContainer);
    console.log('Messages found:', messages.length);
    
    return { 
      hasThread: threadContainer !== null && messages.length > 0 
    };
  } catch (error) {
    console.error('Error checking thread availability:', error);
    return { hasThread: false, error: error.message };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Injection script received message:', request);
  
  try {
    if (request.action === 'checkThreadAvailable') {
      const result = checkThreadAvailable();
      sendResponse(result);
    } else {
      sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error in injection script message handler:', error);
    sendResponse({ error: error.message });
  }
});

console.log('Injection script ready for communication'); 