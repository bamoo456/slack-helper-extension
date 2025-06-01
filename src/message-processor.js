/**
 * Message Processing Module
 * Handles message post-processing including Unknown User filtering and merging
 * Updated to use the implementation from content.js
 */
export class MessageProcessor {
  constructor() {
    // Slack system message patterns to filter out
    this.systemMessagePatterns = [
      /\d+\s+replies?/i,
      /reply…\s*also\s+send\s+to/i,
      /also\s+send\s+to/i,
      /\d+\s+people\s+will\s+be\s+notified/i,
      /started\s+a\s+thread/i,
      /joined\s+the\s+channel/i,
      /left\s+the\s+channel/i,
      /set\s+the\s+channel\s+topic/i,
      /pinned\s+a\s+message/i,
      /unpinned\s+a\s+message/i,
      /uploaded\s+a\s+file/i,
      /shared\s+a\s+file/i,
      /added\s+an\s+integration/i,
      /removed\s+an\s+integration/i,
      /changed\s+the\s+channel\s+name/i,
      /archived\s+this\s+channel/i,
      /unarchived\s+this\s+channel/i,
      /This\s+message\s+was\s+deleted/i,
      /Message\s+deleted/i,
      /has\s+joined\s+the\s+conversation/i,
      /has\s+left\s+the\s+conversation/i,
      /View\s+\d+\s+replies?/i,
      /Show\s+less/i,
      /Show\s+more/i,
      /Load\s+more\s+messages/i,
      /^\s*…\s*$/,
      /^\s*\.\.\.\s*$/,
      /^reply$/i,
      /^thread$/i,
      /^view\s+thread$/i,
      /^reply…$/i,
      /^reply\s+to\s+thread/i,
      /^message$/i,
      /^type\s+a\s+message/i,
      /^send\s+a\s+message/i,
      /^compose\s+message/i
    ];
  }

  /**
   * Process messages to filter system messages and merge continuations
   * @param {Array} rawMessages - Raw extracted messages
   * @returns {Array} Processed messages
   */
  processMessages(rawMessages) {
    console.log(`Processing ${rawMessages.length} raw messages...`);
    
    // Step 1: Filter out system messages
    const filteredMessages = this.filterSystemMessages(rawMessages);
    console.log(`After system message filtering: ${filteredMessages.length} messages`);
    
    // Step 2: Merge continuation messages
    const mergedMessages = this.mergeContinuationMessages(filteredMessages);
    console.log(`After merging continuations: ${mergedMessages.length} messages`);
    
    return mergedMessages;
  }

  /**
   * Filter out Slack system messages
   * @param {Array} messages 
   * @returns {Array}
   */
  filterSystemMessages(messages) {
    return messages.filter(message => {
      // Keep messages from known users
      if (message.user !== 'Unknown User') {
        return true;
      }

      // Check if Unknown User message is a system message
      const isSystemMessage = this.isSystemMessage(message.text);
      
      if (isSystemMessage) {
        console.log(`Filtering out system message: "${message.text.substring(0, 50)}..."`);
        return false;
      }

      return true;
    });
  }

  /**
   * Check if a message is a Slack system message
   * @param {string} text 
   * @returns {boolean}
   */
  isSystemMessage(text) {
    if (!text || text.trim().length === 0) {
      return true;
    }

    const cleanText = text.trim();
    
    // Check against known system message patterns
    for (const pattern of this.systemMessagePatterns) {
      if (pattern.test(cleanText)) {
        return true;
      }
    }

    // Additional heuristics for system messages
    // Very short messages that are likely UI elements
    if (cleanText.length < 5 && !/[a-zA-Z]/.test(cleanText)) {
      return true;
    }

    // Messages that are just numbers or symbols
    if (/^\s*[\d\s\.\-\+\(\)]+\s*$/.test(cleanText)) {
      return true;
    }

    // Messages that look like UI buttons or links
    if (/^(reply|thread|view|show|load|more|less)$/i.test(cleanText)) {
      return true;
    }

    return false;
  }

  /**
   * Merge Unknown User messages that are continuations of previous messages
   * @param {Array} messages 
   * @returns {Array}
   */
  mergeContinuationMessages(messages) {
    const processedMessages = [];
    
    for (let i = 0; i < messages.length; i++) {
      const currentMessage = messages[i];
      
      // If this is not an Unknown User message, add it normally
      if (currentMessage.user !== 'Unknown User') {
        processedMessages.push(currentMessage);
        continue;
      }

      // For Unknown User messages, always try to merge with the previous message
      if (processedMessages.length > 0) {
        // Find the most recent non-Unknown User message to merge with
        let targetIndex = processedMessages.length - 1;
        while (targetIndex >= 0 && 
               (processedMessages[targetIndex].user === 'Unknown User' || 
                processedMessages[targetIndex].user === 'Unknown User (Standalone)')) {
          targetIndex--;
        }
        
        if (targetIndex >= 0) {
          // Merge with the found message
          const targetMessage = processedMessages[targetIndex];
          const mergedText = this.mergeMessageTexts(targetMessage.text, currentMessage.text);
          
          console.log(`Merging Unknown User message with previous message from ${targetMessage.user}`);
          console.log(`Original: "${targetMessage.text.substring(0, 50)}..."`);
          console.log(`Continuation: "${currentMessage.text.substring(0, 50)}..."`);
          
          // Update the target message with merged content
          targetMessage.text = mergedText;
          
          // Update timestamp if the continuation has a more recent timestamp
          if (currentMessage.timestamp && 
              (!targetMessage.timestamp || 
               this.isMoreRecentTimestamp(currentMessage.timestamp, targetMessage.timestamp))) {
            targetMessage.timestamp = currentMessage.timestamp;
          }
        } else {
          // No previous non-Unknown User message found, skip this message
          console.log(`Skipping Unknown User message (no previous user message found): "${currentMessage.text.substring(0, 50)}..."`);
        }
      } else {
        // No previous messages at all, skip this Unknown User message
        console.log(`Skipping Unknown User message (first message): "${currentMessage.text.substring(0, 50)}..."`);
      }
    }
    
    return processedMessages;
  }

  /**
   * Merge two message texts intelligently
   * @param {string} previousText 
   * @param {string} continuationText 
   * @returns {string}
   */
  mergeMessageTexts(previousText, continuationText) {
    const prev = previousText.trim();
    const cont = continuationText.trim();
    
    // If previous text ends with punctuation, add a space
    if (/[.!?]\s*$/.test(prev)) {
      return `${prev} ${cont}`;
    }
    
    // If previous text ends with a line break or continuation character
    if (/[\n\r]\s*$/.test(prev) || /[-–—]\s*$/.test(prev)) {
      return `${prev}${cont}`;
    }
    
    // Default: add a space between texts
    return `${prev} ${cont}`;
  }

  /**
   * Check if timestamp1 is more recent than timestamp2
   * @param {string} timestamp1 
   * @param {string} timestamp2 
   * @returns {boolean}
   */
  isMoreRecentTimestamp(timestamp1, timestamp2) {
    // Simple string comparison for now
    // Could be enhanced with proper date parsing if needed
    return timestamp1 > timestamp2;
  }
} 