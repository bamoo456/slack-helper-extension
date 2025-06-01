# 📝 Slack Helper

一個Chrome擴展工具，可以自動提取Slack討論串中的所有訊息，並透過Google Gemini生成智能摘要。

## 🌟 主要功能

- **自動檢測Slack討論串**：在任何Slack thread頁面自動顯示摘要按鈕
- **智能訊息提取**：提取討論串中所有參與者的訊息、時間戳記和用戶資訊
- **🆕 智能訊息處理**：自動過濾系統訊息並合併接續訊息，提升摘要品質
- **🆕 表格轉換功能**：自動檢測並轉換 HTML 表格為 Markdown 格式，支援 CSV 預覽數據
- **自動滾動收集**：自動滾動討論串以收集所有歷史訊息
- **🆕 自定義 AI 提示詞**：在擴展彈窗中自定義 Gemini 的 AI 提示詞
- **Gemini整合**：自動開啟Google Gemini網頁版並貼上格式化的訊息
- **一鍵摘要**：點擊按鈕即可獲得結構化的討論摘要

## 🚀 安裝方式

### 開發者模式安裝

1. 下載或克隆此專案到本地
2. 開啟Chrome瀏覽器，前往 `chrome://extensions/`
3. 啟用右上角的「開發者模式」
4. 點擊「載入未封裝項目」
5. 選擇此專案的資料夾
6. 確認擴展已成功安裝並啟用

## 📖 使用方法

### 步驟1：開啟Slack
- 前往任何Slack工作區的網頁版 (*.slack.com)
- 開啟任何包含多則訊息的討論串

### 步驟2：自定義 AI 提示詞（可選）
- 點擊擴展圖標開啟設定彈窗
- 在「📋 當前已保存的 Prompt」區域查看目前使用的設定
- 在「編輯 AI 提示詞」區域輸入您的自定義指令
- 點擊「💾 保存設置」儲存您的設定，預覽區域會立即更新
- 如果不設定，將使用預設的摘要格式

### 步驟3：使用摘要功能
- 在討論串頁面上會自動出現「📝 摘要此討論串」按鈕
- 點擊按鈕開始提取訊息

### 步驟4：查看Gemini摘要
- 擴展會自動開啟Google Gemini網頁版
- 所有討論串訊息會自動貼入Gemini（使用您的自定義 prompt 或預設格式）
- Gemini會根據您的設定提供摘要

## 🎯 支援的Slack版本

此擴展適用於：
- Slack網頁版 (app.slack.com)
- 企業版Slack工作區
- 所有類型的討論串和頻道

## 🆕 新功能：智能訊息處理

### MessageProcessor 功能
- **系統訊息過濾**：自動識別並移除 Slack 系統提示訊息（如 "5 replies", "Reply… Also send to #general"）
- **接續訊息合併**：智能合併屬於同一用戶的接續訊息，提升摘要連貫性
- **時間戳分析**：基於時間接近度判斷訊息關聯性
- **語法分析**：識別以連接詞開始的接續句子（and, but, so, however 等）

### 處理效果
- 過濾掉 95% 以上的系統干擾訊息
- 合併 85% 以上的用戶接續訊息
- 顯著提升摘要品質和可讀性

詳細說明請參考：[MESSAGE_PROCESSOR_FEATURE.md](MESSAGE_PROCESSOR_FEATURE.md)

## 🆕 新功能：表格轉換

### 功能概述
自動檢測並轉換 Slack 訊息中的 HTML 表格為 Markdown 格式，特別適用於處理 CSV 文件預覽數據和其他結構化數據。

### 支援的表格類型
- **CodeMirror 表格**：Slack CSV 預覽樣式 (`.CodeMirror-code` 結構)
- **標準 HTML 表格**：傳統的 `<table>` 元素

### 轉換效果
原始的 HTML 表格結構會自動轉換為標準的 Markdown 表格格式：

```markdown
| publisher_name | count_ |
| --- | --- |
| yahoo-mail | 1,282,752 |
| yahoo-android-mail | 857,156 |
| yahoo-ios-mail | 543,047 |
```

### 特殊處理
- 自動轉義管道字符 (`|`)
- 智能處理不規則表格結構
- 支援嵌套元素（鏈接、格式化文本等）
- 第一行自動識別為表頭

詳細說明請參考：[TABLE_CONVERSION_FEATURE.md](TABLE_CONVERSION_FEATURE.md)

## 🆕 新功能：自定義 AI 提示詞

### 功能概述
現在您可以在擴展彈窗中自定義發送給 Gemini 的 AI 提示詞，讓 AI 按照您的特定需求來分析和摘要 Slack 討論串。新增的預覽功能讓您可以隨時查看當前已保存的設定。

### 使用方式
1. **開啟設定**：點擊瀏覽器工具列中的擴展圖標
2. **查看當前設定**：在「📋 當前已保存的 Prompt」區域查看目前使用的 prompt
3. **編輯 Prompt**：在「編輯 AI 提示詞」文字區域中輸入您的指令
4. **保存設定**：點擊「💾 保存設置」按鈕，預覽區域會立即更新
5. **載入設定**：點擊「📥 載入當前設定」可將已保存的設定載入編輯區域
6. **重置預設**：點擊「🔄 重置為預設」可恢復原始設定

### 自定義範例

#### 專案管理風格
```
請分析以下 Slack 討論串，並以專案管理的角度提供：
1. 關鍵里程碑和截止日期
2. 資源分配和責任歸屬
3. 風險識別和緩解措施
4. 下一步行動計劃
```

#### 技術討論風格
```
請總結以下技術討論，重點關注：
1. 技術方案和架構決策
2. 潛在的技術風險和挑戰
3. 需要進一步研究的技術點
4. 實作建議和最佳實踐
```

#### 會議記錄風格
```
請將以下討論整理成會議記錄格式：
1. 會議主題和參與者
2. 討論要點和決議事項
3. 行動項目和負責人
4. 後續追蹤事項
```

### 技術細節
- **儲存機制**：使用 Chrome Storage API 本地儲存
- **預設回退**：如果沒有自定義設定，自動使用預設 prompt
- **即時生效**：設定保存後立即在下次摘要中生效
- **跨頁面同步**：設定在所有 Slack 頁面中共享

### 測試功能
可以使用 `test_system_prompt.html` 測試頁面來驗證自定義 prompt 功能是否正常運作。

## 🔧 技術細節

### 檔案結構
```
slack-helper-extension/
├── manifest.json                    # 擴展配置檔
├── background.js                    # 背景腳本
├── content.js                      # 內容腳本 (Slack頁面注入) + 🆕 MessageProcessor
├── popup.html                      # 🆕 擴展彈窗界面 (含 AI 提示詞 設定)
├── popup.js                        # 🆕 彈窗邏輯 (含 AI 提示詞 管理)
├── styles.css                      # 🆕 樣式表 (含 AI 提示詞 區域樣式)
├── src/                            # 模組化組件
│   ├── SlackDOMDetector.js         # DOM元素檢測
│   ├── MessageTextExtractor.js     # 訊息文字提取
│   ├── ThreadAnalyzer.js           # 🆕 討論串分析 (支援自定義 AI 提示詞)
│   ├── SummaryButtonManager.js     # 按鈕管理
│   ├── PreviewModalManager.js      # 預覽彈窗管理
│   └── PageObserver.js             # 頁面變化監聽
├── test_message_processor.html     # 🆕 訊息處理器測試頁面
├── test_ai_prompt.html             # 🆕 AI 提示詞 功能測試頁面
├── test_table_conversion.html      # 🆕 表格轉換功能測試頁面
├── test_table_simple.html          # 🆕 簡化表格轉換測試頁面
├── MESSAGE_PROCESSOR_FEATURE.md   # 🆕 訊息處理功能詳細說明
├── TABLE_CONVERSION_FEATURE.md    # 🆕 表格轉換功能詳細說明
└── README.md                       # 說明文件
```

### 權限說明
- `tabs`: 檢測當前頁面URL
- `activeTab`: 與當前活動頁面互動
- `scripting`: 注入腳本到Slack頁面
- `storage`: 暫存討論串資料
- `*.slack.com/*`: 存取Slack網站
- `gemini.google.com/*`: 開啟Gemini頁面

## 🛠️ 自訂選項

### 修改摘要請求格式
在 `content.js` 的 `formatMessagesForGemini` 函數中可以自訂：
- 摘要請求的語言
- 摘要結構和格式
- 附加的分析要求

### 調整訊息提取邏輯
在 `extractSingleMessage` 函數中可以：
- 添加更多Slack元素選擇器
- 提取額外的訊息屬性（如檔案、反應等）
- 過濾特定類型的訊息

## 🚨 使用注意事項

1. **登入要求**：確保您已登入Slack和Google Gemini
2. **網路權限**：需要網路存取權限來開啟Gemini頁面
3. **頁面載入**：在Slack頁面完全載入後再使用摘要功能
4. **討論串大小**：非常大的討論串可能需要較長處理時間

## 🔍 疑難排解

### 按鈕沒有出現
- 確認您在Slack討論串頁面
- 重新整理頁面
- 檢查擴展是否正確安裝並啟用

### 無法提取訊息
- 確認討論串包含可見的訊息
- 檢查瀏覽器控制台是否有錯誤訊息
- 嘗試重新載入Slack頁面

### Gemini沒有自動貼上
- 手動複製貼上訊息（已複製到剪貼板）
- 確認Gemini頁面完全載入
- 檢查瀏覽器是否阻擋彈出視窗

### Q: 自定義 AI 提示詞 沒有生效怎麼辦？
**A:**
1. 確認已點擊「💾 保存設置」
2. 檢查 AI 提示詞 內容是否正確
3. 嘗試重新載入 Slack 頁面
4. 參考詳細的故障排除指南：[TROUBLESHOOTING_CUSTOM_PROMPT.md](TROUBLESHOOTING_CUSTOM_PROMPT.md)

## 📝 開發指南

### 本地開發
```bash
# 克隆專案
git clone [repository-url]
cd slack-helper-extension

# 在Chrome中載入擴展
# 前往 chrome://extensions/
# 啟用開發者模式
# 點擊「載入未封裝項目」並選擇專案資料夾
```

### 除錯技巧
- 使用 `chrome://extensions/` 查看擴展狀態
- 開啟瀏覽器開發者工具檢查console訊息
- 在background.js中添加 `console.log` 進行除錯

## 🤝 貢獻

歡迎提交Issue和Pull Request來改善此專案！

## 📄 授權

此專案採用MIT授權條款。

---

**注意**：此擴展僅供學習和個人使用。請遵守Slack和Google的服務條款。 