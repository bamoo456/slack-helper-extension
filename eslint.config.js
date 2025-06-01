import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        // Chrome Extension APIs
        chrome: 'readonly',
        browser: 'readonly',
        
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        navigator: 'readonly',
        
        // DOM APIs
        Node: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        MutationObserver: 'readonly',
        
        // Service Worker globals
        self: 'readonly',
        importScripts: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'no-useless-escape': 'off'
    },
    ignores: [
      'node_modules/**',
      'tmp/**',
      '*.min.js',
      'eslint.config.js',
      'webpack.config.js'
    ]
  },
  {
    files: ['src/*.js'],
    languageOptions: {
      sourceType: 'module'
    }
  }
]; 