# Slack 討論串圖片處理方案

## 需求背景

在 Slack 討論串摘要功能中，部分訊息可能包含圖片（如截圖、設計稿、圖表等）。若能將這些圖片一併提供給 Gemini 分析，將有助於產生更完整的摘要與洞察。

---

## 主要挑戰

1. **圖片來源多樣**：Slack 圖片可能來自多種 DOM 結構與屬性。
2. **CORS 與權限問題**：直接存取圖片資料可能受限於跨域政策。
3. **圖片載入狀態**：圖片可能 lazy load 或尚未載入。
4. **API 格式限制**：Gemini 只接受特定格式與大小的圖片。
5. **用戶體驗**：需避免流程複雜化，並保障隱私與效能。

---

## 推薦解決方案

### 1. 圖片 URL 收集

- 在訊息提取階段，額外收集所有 Slack 圖片的 URL、alt、title、尺寸等資訊。
- 只收集可直接在新分頁開啟的 `https://files.slack.com/files-tmb/` 或 `files-pri/` 圖片。

### 2. 背景分頁預載

- 利用 Chrome 擴展 API，將所有圖片 URL 於背景分頁預先開啟（`active: false`）。
- 可選擇釘選分頁，並於數分鐘後自動關閉，避免分頁堆積。

### 3. 訊息格式化與用戶提示

- 在摘要文字中標註圖片位置與描述（如 `[圖片1: 設計稿]`）。
- 在 UI/Modal 中顯示所有圖片清單，並提示用戶可於 Gemini 手動上傳圖片分析。

### 4. 權限與效能管理

- 僅在用戶同意下預載圖片分頁。
- 預載分頁自動清理，避免資源浪費。
- 不主動下載或儲存圖片檔案，僅提供 URL 參考。

---

## 實作步驟

### 步驟 1：訊息提取時收集圖片資訊

```js
handleImageElements(element) {
  const images = element.querySelectorAll('img[src*="files.slack.com"]');
  return Array.from(images).map((img, idx) => ({
    url: img.src,
    alt: img.alt || `圖片${idx + 1}`,
    title: img.title || '',
    width: img.naturalWidth,
    height: img.naturalHeight
  }));
}
```

### 步驟 2：背景分頁預載圖片

```js
async function preloadImagesInBackground(imageUrls) {
  for (const url of imageUrls) {
    await chrome.tabs.create({ url, active: false, pinned: true });
    // 可加上自動清理機制
  }
}
```

### 步驟 3：訊息格式化與 UI 提示

- 在摘要文字中插入 `[圖片1: alt文字]`
- 在預覽 Modal 顯示所有圖片清單與說明
- 提示用戶可於 Gemini 手動上傳圖片

### 步驟 4：權限與自動清理

- 擴展 `manifest.json` 權限：`"tabs"`, `"activeTab"`, `"scripting"`, `"storage"`
- 預載分頁於 5 分鐘後自動關閉

---

## 實際範例

### Slack 圖片訊息的 HTML 結構範例

```html
<div class="c-file_gallery c-file_gallery__single_image c-file_gallery--mouse_mode" style="width: 919px;">
    <div class="c-aspect_box__outer p-message_gallery_image_file c-file_gallery_image_file" style="width: 360px;">
        <div class="c-aspect_box__inner" style="padding-top: 17.7778%;">
            <div class="c-aspect_box__content"><a data-qa="message_file_image_thumbnail" data-file-id="F08UA1WNERY"
                    rel="noopener noreferrer" class="c-link p-file_image_thumbnail__wrapper"
                    href="https://files.slack.com/files-pri/T0255EC3D-F08UA1WNERY/image.png">
                    <div class="p-file_image_thumbnail__tiny_thumb_wrapper" style=""><img
                            src="https://files.slack.com/files-tmb/T0255EC3D-F08UA1WNERY-d7e162a12a/image_720.png"
                            alt="image.png" class="p-file_image_thumbnail__image" data-qa="file_image_thumbnail_img">
                    </div>
                </a>
                <div class="c-file__actions c-message_actions__container c-message_actions__group c-file__actions--image"
                    aria-label="More actions" data-qa="file_actions" role="presentation"><a target="_blank"
                        class="c-link c-button-unstyled c-icon_button c-icon_button--size_small c-message_actions__button c-icon_button--default"
                        data-qa="download_action" aria-label="Download image.png" data-sk="tooltip_parent"
                        href="https://files.slack.com/files-pri/T0255EC3D-F08UA1WNERY/download/image.png?origin_team=T0255EC3D"
                        rel="noopener noreferrer"><svg data-g2s="true" data-qa="download" aria-hidden="true"
                            viewBox="0 0 20 20" class="">
                            <path fill="currentColor" fill-rule="evenodd"
                                d="M11.75 4a3.75 3.75 0 0 0-3.512 2.432.75.75 0 0 1-.941.447 2.5 2.5 0 0 0-2.937 3.664.75.75 0 0 1-.384 1.093A2.251 2.251 0 0 0 4.75 16h9.5a3.25 3.25 0 0 0 1.44-6.164.75.75 0 0 1-.379-.908A3.75 3.75 0 0 0 11.75 4M7.108 5.296a5.25 5.25 0 0 1 9.786 3.508A4.75 4.75 0 0 1 14.25 17.5h-9.5a3.75 3.75 0 0 1-2.02-6.91 4 4 0 0 1 4.378-5.294M10.25 7.5a.75.75 0 0 1 .75.75v3.69l1.22-1.22a.75.75 0 1 1 1.06 1.06l-2.5 2.5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 1 1 1.06-1.06l1.22 1.22V8.25a.75.75 0 0 1 .75-.75"
                                clip-rule="evenodd"></path>
                        </svg></a><button
                        class="c-button-unstyled c-icon_button c-icon_button--size_small c-message_actions__button c-icon_button--default"
                        data-qa="share_file" aria-label="Share image.png" data-sk="tooltip_parent" type="button"><svg
                            data-g2s="true" data-qa="share-message" aria-hidden="true" viewBox="0 0 20 20" class="">
                            <path fill="currentColor" fill-rule="evenodd"
                                d="M10.457 2.56a.75.75 0 0 1 .814.15l7 6.75a.75.75 0 0 1 0 1.08l-7 6.75A.75.75 0 0 1 10 16.75V13.5H6c-1.352 0-2.05.389-2.43.832-.4.465-.57 1.133-.57 1.918a.75.75 0 0 1-1.5 0V14c0-2.594.582-4.54 2-5.809C4.898 6.941 6.944 6.5 9.5 6.5h.5V3.25c0-.3.18-.573.457-.69M3.052 12.79C3.777 12.278 4.753 12 6 12h4.75a.75.75 0 0 1 .75.75v2.235L16.67 10 11.5 5.015V7.25a.75.75 0 0 1-.75.75H9.5c-2.444 0-4.023.434-5 1.309-.784.702-1.29 1.788-1.448 3.481"
                                clip-rule="evenodd"></path>
                        </svg></button><button
                        class="c-button-unstyled c-icon_button c-icon_button--size_small c-message_actions__button c-icon_button--default"
                        data-qa="more_file_actions" aria-label="More actions" aria-haspopup="menu"
                        data-sk="tooltip_parent" type="button"><svg data-g2s="true" data-qa="ellipsis-vertical-filled"
                            aria-hidden="true" viewBox="0 0 20 20" class="">
                            <path fill="currentColor" fill-rule="evenodd"
                                d="M10 5.5A1.75 1.75 0 1 1 10 2a1.75 1.75 0 0 1 0 3.5m0 6.25a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5m-1.75 4.5a1.75 1.75 0 1 0 3.5 0 1.75 1.75 0 0 0-3.5 0"
                                clip-rule="evenodd"></path>
                        </svg></button></div>
            </div>
        </div>
    </div>
</div>
```

---

## 優勢

- **無 CORS 問題**：直接開啟 Slack 圖片 URL
- **用戶體驗佳**：用戶可自由選擇是否分析圖片
- **效能友好**：自動清理分頁，避免資源浪費
- **安全合規**：不主動下載或儲存圖片，尊重用戶隱私

---

## 待辦與延伸

- [ ] 圖片預覽 UI 優化
- [ ] 支援多種圖片格式與異常處理
- [ ] 用戶自訂是否自動預載圖片
- [ ] Gemini API 圖片自動上傳（如未來 API 支援）

---
