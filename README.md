# 🚀 Slack Helper – AI Assistant for Slack

Slack Helper is an AI-powered Chrome extension that supercharges Slack threads and draft messages. It lets you summarise conversations, refine or rephrase your text with one click, and seamlessly works with Google Gemini, OpenAI, or any OpenAI-compatible model.



## 1. Install Dependencies

```bash
npm install
```

## 2. Development Mode (Recommended)

```bash
npm run dev
```
This starts Webpack in watch mode and automatically rebuilds files into the `dist/` directory when changes are made.

## 3. Load the Extension in Chrome

1. Open Chrome browser
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the project's `dist/` directory (not the root directory)

## 📦 Common Commands

```bash
# Development
npm run dev              # Watch mode, auto-rebuild
npm run build:dev        # Build development version
npm run build            # Build production version

# Code Quality
npm run lint             # Lint code
npm run lint:fix         # Auto-fix lint issues
npm run format           # Format code

# Packaging
npm run zip              # Build and package as zip
npm run clean            # Clean build files
```

## 🔧 Adding New Packages

### Install a Package
```bash
# Production dependency
npm install package-name

# Development dependency
npm install --save-dev package-name
```

### Usage in Code
```javascript
import _ from 'lodash';
import axios from 'axios';

const uniqueArray = _.uniq([1, 2, 2, 3]);
const response = await axios.get('https://api.example.com');
```

## 📁 Key Directories

- `src/` - All source code (JavaScript modules)
  - `background.js` - Background script (model sync management)
  - `content-script.js` - Main content script
  - `content-inject.js` - Fallback injection script
  - `popup.js` - Extension popup script
  - `ui-components.js` - UI component library
  - `dom-detector.js` - DOM detector
  - `message-extractor.js` - Message extractor
  - `message-processor.js` - Message processor
  - `scroll-collector.js` - Scroll collector
  - `model-sync.js` - Model sync utility
- `dist/` - Build output (load this in Chrome)
- `node_modules/` - npm packages

## ⚡ Hot Reload

When using `npm run dev`:
1. Edit any `.js` file
2. Webpack auto-rebuilds to `dist/`
3. Reload the extension in Chrome to see changes

## 🎯 Next Steps

1. See `example-usage.js` for third-party package usage
2. Read `NPM_SETUP.md` for detailed configuration
3. Start integrating npm packages into your code

## 🆘 FAQ

**Q: Why use the `dist/` directory?**
A: Webpack bundles all dependencies into `dist/` so Chrome can use npm packages.

**Q: Can I use packages without Webpack?**
A: You can use CDN links in `manifest.json`, but Webpack is recommended.

**Q: Will the extension size increase?**
A: Yes, but Webpack optimizes the build. Production builds remove unused code.
