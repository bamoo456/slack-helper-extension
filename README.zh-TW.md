# 🚀 Slack Helper Extension 快速開始指南

歡迎使用 Slack Helper Chrome 擴充功能！本指南將協助你快速安裝、開發與使用本專案。

## 1. 安裝依賴

```bash
npm install
```

## 2. 開發模式（推薦）

```bash
npm run dev
```
這會啟動 Webpack 監聽模式，檔案變更時自動重新編譯到 `dist/` 目錄。

## 3. 在 Chrome 載入擴充功能

1. 開啟 Chrome 瀏覽器
2. 前往 `chrome://extensions/`
3. 啟用「開發者模式」
4. 點擊「載入未封裝項目」
5. 選擇專案的 `dist/` 目錄（不是根目錄）

## 📦 常用指令

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

## 🔧 新增套件

### 安裝套件
```bash
# 生產依賴
npm install package-name

# 開發依賴
npm install --save-dev package-name
```

### 在代碼中使用
```javascript
import _ from 'lodash';
import axios from 'axios';

const uniqueArray = _.uniq([1, 2, 2, 3]);
const response = await axios.get('https://api.example.com');
```

## 📁 重要目錄

- `src/` - 所有原始碼（JavaScript 模組）
  - `background.js` - 背景腳本（模型同步管理）
  - `content-script.js` - 主要內容腳本
  - `content-inject.js` - 備用注入腳本
  - `popup.js` - 擴充彈窗腳本
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
3. 在 Chrome 中重新載入擴充功能即可看到變更

## 🎯 下一步

1. 查看 `example-usage.js` 了解如何使用第三方套件
2. 閱讀 `NPM_SETUP.md` 了解詳細配置
3. 開始在現有代碼中整合 npm 套件

## 🆘 常見問題

**Q: 為什麼要使用 `dist/` 目錄？**
A: Webpack 會將所有依賴打包到 `dist/` 目錄，這樣 Chrome 擴充功能才能使用 npm 套件。

**Q: 可以不用 Webpack 嗎？**
A: 可以用 CDN 連結在 `manifest.json` 引入，但建議使用 Webpack。

**Q: 擴充功能會變大嗎？**
A: 會，但 Webpack 會優化，生產建置會移除未使用的代碼。
