/**
 * LLM Service Module
 * Provides a unified interface for different LLM providers
 */

/**
 * Base LLM Provider interface
 */
class BaseLLMProvider {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Process text with the LLM
   * @param {string} text - Input text to process
   * @param {string} action - Action type (rephrase, refine, fix_grammar, custom)
   * @param {string} customPrompt - Custom prompt for custom action
   * @returns {Promise<string>} - Processed text
   */
  async processText(text, action, customPrompt = '') {
    throw new Error('processText method must be implemented by subclass');
  }

  /**
   * Check if the provider is available/configured
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error('isAvailable method must be implemented by subclass');
  }
}

/**
 * Mock LLM Provider for testing
 */
class MockLLMProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super(config);
    this.delay = config.delay || 1000; // Simulate API delay
  }

  async processText(text, action, customPrompt = '') {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, this.delay));

    const actionMap = {
      'rephrase': this.mockRephrase(text),
      'refine': this.mockRefine(text),
      'fix_grammar': this.mockFixGrammar(text),
      'custom': this.mockCustom(text, customPrompt)
    };

    return actionMap[action] || text;
  }

  async isAvailable() {
    return true;
  }

  mockRephrase(text) {
    // Simple mock rephrasing
    const variations = [
      `Here's another way to say it: ${text}`,
      `Let me rephrase that: ${text}`,
      `In other words: ${text}`
    ];
    return variations[Math.floor(Math.random() * variations.length)];
  }

  mockRefine(text) {
    // Mock refinement
    return `✨ Refined version: ${text}\n\n(This is a mock refinement - the actual implementation will use AI to improve clarity, tone, and structure)`;
  }

  mockFixGrammar(text) {
    // Mock grammar fixing
    return `📝 Grammar-corrected: ${text}\n\n(This is a mock correction - the actual implementation will fix grammar, spelling, and punctuation)`;
  }

  mockCustom(text, customPrompt) {
    return `🎯 Applied "${customPrompt}" to: ${text}\n\n(This is a mock result - the actual implementation will apply your custom prompt using AI)`;
  }
}

/**
 * OpenAI LLM Provider
 */
class OpenAIProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gpt-3.5-turbo';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  async processText(text, action, customPrompt = '') {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const prompt = this.buildPrompt(text, action, customPrompt);
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that helps improve text messages for Slack communication. Always return only the improved text without additional explanations unless specifically asked.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content?.trim() || text;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  async isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Test the API connection
   * @returns {Promise<boolean>} - True if connection is successful
   */
  async testConnection() {
    if (!this.apiKey) {
      throw new Error('API key is required');
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`API test failed: ${response.status} ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('OpenAI API test error:', error);
      throw error;
    }
  }

  buildPrompt(text, action, customPrompt) {
    const actionPrompts = {
      'rephrase': `Please rephrase the following message to make it sound different while keeping the same meaning:\n\n"${text}"`,
      'refine': `Please refine and improve the following message for better clarity, professionalism, and impact:\n\n"${text}"`,
      'fix_grammar': `Please fix any grammar, spelling, or punctuation errors in the following message:\n\n"${text}"`,
      'custom': `${customPrompt}\n\nApply this instruction to the following message:\n\n"${text}"`
    };

    return actionPrompts[action] || `Please improve the following message:\n\n"${text}"`;
  }
}

/**
 * OpenAI Compatible LLM Provider
 */
class OpenAICompatibleProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = config.baseUrl || '';
    this.model = config.model || 'gpt-3.5-turbo';
    this.customHeaders = config.customHeaders || {};
    this.customParams = config.customParams || {};
  }

  async processText(text, action, customPrompt = '') {
    if (!this.baseUrl) {
      throw new Error('Base URL is required');
    }

    const prompt = this.buildPrompt(text, action, customPrompt);
    
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...this.customHeaders
      };

      const body = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that helps improve text messages for Slack communication. Always return only the improved text without additional explanations unless specifically asked.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
        ...this.customParams
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content?.trim() || text;
    } catch (error) {
      console.error('OpenAI Compatible API error:', error);
      throw error;
    }
  }

  async isAvailable() {
    return !!this.baseUrl && !!this.model;
  }

  /**
   * Test the API connection
   * @returns {Promise<boolean>} - True if connection is successful
   */
  async testConnection() {
    if (!this.baseUrl) {
      throw new Error('Base URL is required');
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...this.customHeaders
      };

      // Try to get models list or make a simple completion request
      let testUrl = `${this.baseUrl}/models`;
      let testMethod = 'GET';
      let testBody = null;

      // If models endpoint fails, try a simple completion
      try {
        const modelsResponse = await fetch(testUrl, {
          method: testMethod,
          headers: headers
        });

        if (modelsResponse.ok) {
          return true;
        }
      } catch (modelsError) {
        console.log('Models endpoint not available, trying completion test...');
      }

      // Fallback to completion test
      testUrl = `${this.baseUrl}/chat/completions`;
      testMethod = 'POST';
      testBody = JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: 'Test'
          }
        ],
        max_tokens: 1,
        ...this.customParams
      });

      const response = await fetch(testUrl, {
        method: testMethod,
        headers: headers,
        body: testBody
      });

      if (!response.ok) {
        throw new Error(`API test failed: ${response.status} ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('OpenAI Compatible API test error:', error);
      throw error;
    }
  }

  buildPrompt(text, action, customPrompt) {
    const actionPrompts = {
      'rephrase': `Please rephrase the following message to make it sound different while keeping the same meaning:\n\n"${text}"`,
      'refine': `Please refine and improve the following message for better clarity, professionalism, and impact:\n\n"${text}"`,
      'fix_grammar': `Please fix any grammar, spelling, or punctuation errors in the following message:\n\n"${text}"`,
      'custom': `${customPrompt}\n\nApply this instruction to the following message:\n\n"${text}"`
    };

    return actionPrompts[action] || `Please improve the following message:\n\n"${text}"`;
  }
}

/**
 * Main LLM Service class
 */
export class LLMService {
  constructor() {
    this.providers = new Map();
    this.currentProvider = null;
    this.config = {};
    
    this.initializeProviders();
  }

  /**
   * Initialize available providers
   */
  initializeProviders() {
    // Register Mock provider (always available for testing)
    this.providers.set('mock', new MockLLMProvider({ delay: 800 }));
    
    // Register OpenAI provider
    this.providers.set('openai', new OpenAIProvider());
    
    // Register OpenAI Compatible provider
    this.providers.set('openai-compatible', new OpenAICompatibleProvider());
    
    // Set default provider to mock for testing
    this.currentProvider = 'mock';
  }

  /**
   * Set the current LLM provider
   * @param {string} providerName - Name of the provider to use
   * @param {Object} config - Configuration for the provider
   */
  async setProvider(providerName, config = {}) {
    if (!this.providers.has(providerName)) {
      throw new Error(`Provider ${providerName} is not registered`);
    }

    // Update provider configuration
    if (providerName === 'openai') {
      this.providers.set('openai', new OpenAIProvider(config));
    } else if (providerName === 'openai-compatible') {
      this.providers.set('openai-compatible', new OpenAICompatibleProvider(config));
    }

    const provider = this.providers.get(providerName);
    const isAvailable = await provider.isAvailable();
    
    if (!isAvailable) {
      throw new Error(`Provider ${providerName} is not available or not properly configured`);
    }

    this.currentProvider = providerName;
    this.config = config;
    
    // Save configuration to storage
    await this.saveConfiguration();
  }

  /**
   * Get current provider
   * @returns {BaseLLMProvider|null}
   */
  getCurrentProvider() {
    if (!this.currentProvider) return null;
    return this.providers.get(this.currentProvider);
  }

  /**
   * Process text using the current provider
   * @param {string} text - Input text
   * @param {string} action - Action type
   * @param {string} customPrompt - Custom prompt for custom actions
   * @returns {Promise<string>} - Processed text
   */
  async processText(text, action, customPrompt = '') {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No LLM provider is configured');
    }

    if (!text || !text.trim()) {
      throw new Error('Input text is required');
    }

    try {
      return await provider.processText(text, action, customPrompt);
    } catch (error) {
      console.error('LLM processing error:', error);
      throw error;
    }
  }



  /**
   * Load configuration from storage
   */
  async loadConfiguration() {
    try {
      // Load from the new storage format used by popup.js
      const result = await chrome.storage.local.get(['llmSettings']);
      const settings = result.llmSettings;
      
      if (settings && settings.provider && settings.config) {
        await this.setProvider(settings.provider, settings.config);
      } else {
        // Fallback to old format for backward compatibility
        const oldResult = await chrome.storage.local.get(['llmServiceConfig']);
        const oldConfig = oldResult.llmServiceConfig || {};
        
        if (oldConfig.provider && oldConfig.providerConfig) {
          await this.setProvider(oldConfig.provider, oldConfig.providerConfig);
        }
      }
    } catch (error) {
      console.error('Error loading LLM configuration:', error);
    }
  }

  /**
   * Save configuration to storage
   */
  async saveConfiguration() {
    try {
      // Save in the new format used by popup.js
      await chrome.storage.local.set({
        llmSettings: {
          provider: this.currentProvider,
          config: this.config
        }
      });
    } catch (error) {
      console.error('Error saving LLM configuration:', error);
    }
  }

  /**
   * Test the current provider connection
   * @returns {Promise<boolean>} - True if connection is successful
   */
  async testConnection() {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No LLM provider is configured');
    }

    if (typeof provider.testConnection === 'function') {
      return await provider.testConnection();
    } else {
      // Fallback to isAvailable check
      return await provider.isAvailable();
    }
  }

  /**
   * Get current provider status
   * @returns {Object} - Status information
   */
  async getStatus() {
    const provider = this.getCurrentProvider();
    if (!provider) {
      return {
        provider: null,
        available: false,
        error: 'No provider configured'
      };
    }

    try {
      const available = await provider.isAvailable();
      return {
        provider: this.currentProvider,
        available,
        error: available ? null : 'Provider not available'
      };
    } catch (error) {
      return {
        provider: this.currentProvider,
        available: false,
        error: error.message
      };
    }
  }
}

// Create and export a singleton instance
export const llmService = new LLMService();

// Initialize configuration on module load
llmService.loadConfiguration().catch(console.error); 