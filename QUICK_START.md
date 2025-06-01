# 🚀 NPM 快速開始指南

## 立即開始使用

### 1. 安裝依賴
```bash
npm install
```

### 2. 開發模式（推薦）
```bash
npm run dev
```
這會啟動 webpack 監聽模式，自動重新編譯變更的文件到 `dist/` 目錄。

### 3. 在 Chrome 中載入擴展
1. 開啟 Chrome 瀏覽器
2. 前往 `chrome://extensions/`
3. 啟用「開發者模式」
4. 點擊「載入未封裝項目」
5. 選擇專案的 `dist/` 目錄（不是根目錄）

## 📦 常用命令

```bash
# 開發
npm run dev              # 監聽模式，自動重新編譯
npm run build:dev        # 建置開發版本
npm run build            # 建置生產版本

# 代碼品質
npm run lint             # 檢查代碼
npm run lint:fix         # 自動修復問題
npm run format           # 格式化代碼

# 打包
npm run zip              # 建置並打包成 zip
npm run clean            # 清理建置文件
```

## 🔧 添加新套件

### 安裝套件
```bash
# 生產依賴
npm install package-name

# 開發依賴
npm install --save-dev package-name
```

### 在代碼中使用
```javascript
// 在任何 .js 文件中
import _ from 'lodash';
import axios from 'axios';

// 使用套件
const uniqueArray = _.uniq([1, 2, 2, 3]);
const response = await axios.get('https://api.example.com');
```

## 📁 重要目錄

- `src/` - **所有原始碼**（完整的 JavaScript 模組）
  - `background.js` - 背景腳本（模型同步管理）
  - `content-script.js` - 主要內容腳本
  - `content-inject.js` - 備用注入腳本
  - `popup.js` - 擴展彈窗腳本
  - `ui-components.js` - UI 組件庫
  - `dom-detector.js` - DOM 檢測器
  - `message-extractor.js` - 訊息提取器
  - `message-processor.js` - 訊息處理器
  - `scroll-collector.js` - 滾動收集器
  - `model-sync.js` - 模型同步工具
- `dist/` - 建置輸出（載入到 Chrome 的目錄）
- `node_modules/` - npm 套件

## ⚡ 熱重載

使用 `npm run dev` 時：
1. 修改任何 `.js` 文件
2. Webpack 自動重新編譯到 `dist/`
3. 在 Chrome 中重新載入擴展即可看到變更

## 🎯 下一步

1. 查看 `example-usage.js` 了解如何使用第三方套件
2. 閱讀 `NPM_SETUP.md` 了解詳細配置
3. 開始在現有代碼中整合 npm 套件

## 🆘 常見問題

**Q: 為什麼要使用 `dist/` 目錄？**
A: Webpack 會將所有依賴打包到 `dist/` 目錄，這樣 Chrome 擴展就能使用 npm 套件。

**Q: 如何在不使用 webpack 的情況下使用套件？**
A: 可以使用 CDN 連結在 `manifest.json` 中引入，但建議使用 webpack。

**Q: 擴展大小會變大嗎？**
A: 是的，但 webpack 會進行優化。生產建置會移除未使用的代碼。 