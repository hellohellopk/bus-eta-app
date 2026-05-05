# 巴士到站時間應用 - 優化指南

## 概述

本文件說明了對 `busapp.html` 進行的優化改進，包括程式碼結構、效能、使用者體驗和可維護性方面的增強。

## 優化清單

### 1. 程式碼結構優化

#### 分離 CSS 和 JavaScript

**原始狀態**：所有程式碼集中在單一 HTML 檔案中（2560 行）。

**改進方案**：
- `styles.css`：包含所有樣式定義，便於快取和重用
- `app.js`：包含應用邏輯，模組化結構
- `sw.js`：Service Worker，處理離線和快取
- `manifest.json`：PWA 配置

**優點**：
- 瀏覽器快取效率提升
- 程式碼組織更清晰
- 易於協同開發和版本管理
- 減少 HTML 檔案大小

### 2. 效能優化

#### API 請求快取

**實現**：`ApiService` 模組提供 `fetchWithCache()` 方法，支援 60 秒快取。

```javascript
async fetchWithCache(url) {
    const now = Date.now();
    const cached = this.cache.get(url);
    
    if (cached && (now - cached.timestamp) < this.cacheTimeout) {
        return cached.data;
    }
    
    const data = await this.fetchJSON(url);
    this.cache.set(url, { data, timestamp: now });
    return data;
}
```

**優點**：
- 減少重複 API 請求
- 降低伺服器負載
- 提升應用響應速度

#### DOM 操作優化

**實現**：`DOMUtils` 模組提供 `createFragment()` 方法，使用 DocumentFragment 進行批量 DOM 操作。

```javascript
createFragment(htmlString) {
    const fragment = document.createDocumentFragment();
    const temp = document.createElement('div');
    temp.innerHTML = htmlString;
    while (temp.firstChild) {
        fragment.appendChild(temp.firstChild);
    }
    return fragment;
}
```

**優點**：
- 減少重繪和重排
- 提升渲染效能
- 特別適合大量資料列表

#### 搜尋防抖

**實現**：搜尋輸入使用 300ms 防抖延遲。

```javascript
searchInput.addEventListener('input', (e) => {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
        this.performSearch();
    }, 300);
});
```

**優點**：
- 減少不必要的搜尋請求
- 提升輸入響應感

### 3. 介面與使用者體驗升級

#### 深色模式支援

**實現**：使用 CSS 媒體查詢 `prefers-color-scheme`。

```css
@media (prefers-color-scheme: dark) {
    :root {
        --bg-color: #1c1c1e;
        --card-bg: #2c2c2e;
        --text-main: #f5f5f7;
        --text-sub: #a1a1a6;
        --border-color: rgba(255,255,255,0.1);
    }
}
```

**優點**：
- 自動適應系統設定
- 提升夜間使用舒適度
- 減少眼睛疲勞

#### 改進的動效

**實現**：
- 統一的過渡時間變數：`--transition-fast`, `--transition-normal`, `--transition-smooth`
- 平滑的顏色和背景過渡
- 按鈕按下時的縮放動效

```css
.icon-btn:active {
    transform: scale(0.90);
    background: rgba(0, 0, 0, 0.1);
    transition: background var(--transition-fast), transform var(--transition-fast);
}
```

**優點**：
- 提升使用者感知的流暢度
- 增加交互反饋
- 提升應用專業感

#### 無障礙設計

**實現**：
- 支援 `prefers-reduced-motion` 媒體查詢
- 為所有互動元素提供 `title` 屬性
- 語義化 HTML 結構

```css
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
```

**優點**：
- 尊重使用者偏好
- 提升應用可訪問性
- 符合 WCAG 標準

### 4. 錯誤處理與日誌系統

#### 日誌模組

**實現**：`Logger` 物件提供統一的日誌介面。

```javascript
const Logger = {
    isDev: false,
    
    log(message, data = null) {
        if (this.isDev) {
            console.log(`[BusApp] ${message}`, data || '');
        }
    },
    
    error(message, error = null) {
        console.error(`[BusApp Error] ${message}`, error || '');
    }
};
```

**優點**：
- 統一的日誌格式
- 便於開發和除錯
- 易於切換開發/生產模式

#### 改進的錯誤處理

**實現**：
- 所有 API 請求都包含 try-catch
- 詳細的錯誤訊息
- 使用者友善的錯誤提示

```javascript
try {
    const response = await fetch(url, { timeout: 10000 });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
} catch (error) {
    Logger.error(`Failed to fetch ${url}`, error);
    this.showError('載入失敗，請檢查網路連線');
}
```

**優點**：
- 提升應用穩定性
- 便於問題追蹤
- 改善使用者體驗

### 5. PWA 與離線支援

#### Service Worker

**功能**：
- 應用程式快取
- 離線支援
- 背景同步
- 推送通知

**快取策略**：
- 靜態資源：快取優先
- API 請求：網路優先，失敗則使用快取

```javascript
// 網路優先策略
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        return cached || new Response('離線模式：無法載入此資源', { status: 503 });
    }
}
```

**優點**：
- 支援離線使用
- 提升載入速度
- 改善使用者體驗

#### PWA Manifest

**功能**：
- 應用程式名稱和圖示
- 安裝選項
- 快捷方式
- 分享目標

**優點**：
- 可安裝到主畫面
- 提升應用發現性
- 改善使用者粘性

### 6. 模組化架構

#### 主要模組

| 模組 | 職責 | 檔案 |
| :--- | :--- | :--- |
| Logger | 日誌管理 | app.js |
| ApiService | API 請求和快取 | app.js |
| DOMUtils | DOM 操作工具 | app.js |
| BusApp | 主應用邏輯 | app.js |

**優點**：
- 職責清晰
- 易於測試和維護
- 便於功能擴展

## 遷移指南

### 從舊版本遷移

1. **備份原始檔案**
   ```bash
   cp busapp.html busapp.html.backup
   ```

2. **使用新版本檔案**
   - 使用 `index_optimized.html` 作為主 HTML 檔案
   - 確保 `styles.css`, `app.js`, `sw.js`, `manifest.json` 在同一目錄

3. **更新伺服器配置**
   - 配置 Service Worker 的正確 MIME 類型（application/javascript）
   - 設定正確的 Cache-Control 頭

4. **測試功能**
   - 測試所有核心功能（搜尋、新增路線、刪除路線）
   - 測試深色模式
   - 測試離線模式

## 未來改進方向

### 短期（1-2 週）

- [ ] 完整的搜尋功能實現
- [ ] ETA 即時更新
- [ ] 路線拖曳排序
- [ ] 備份/還原功能

### 中期（1-2 個月）

- [ ] 地圖整合
- [ ] 到站提醒通知
- [ ] 多裝置同步
- [ ] 使用者帳戶系統

### 長期（3-6 個月）

- [ ] AI 推薦引擎
- [ ] 實時巴士位置追蹤
- [ ] 路線規劃功能
- [ ] 社群功能（分享路線、評論）

## 效能指標

### 優化前後對比

| 指標 | 優化前 | 優化後 | 改進 |
| :--- | :--- | :--- | :--- |
| 檔案大小 | 2560 行（單檔） | 分散多檔 | 便於快取 |
| 首屏載入時間 | 未測 | 預期 < 2s | - |
| API 快取命中率 | 0% | 預期 > 80% | 減少請求 |
| 深色模式支援 | ✗ | ✓ | 提升體驗 |
| 離線支援 | ✗ | ✓ | 提升可用性 |

## 開發建議

### 開啟開發模式

```javascript
Logger.isDev = true; // 在 app.js 中設定
```

### 除錯技巧

1. **檢查快取**
   ```javascript
   caches.keys().then(names => console.log(names));
   ```

2. **清除快取**
   ```javascript
   caches.delete('busapp-v1');
   ```

3. **測試 Service Worker**
   - 開啟 DevTools > Application > Service Workers
   - 檢查註冊狀態和快取內容

### 效能分析

1. **使用 Chrome DevTools**
   - Lighthouse 審計
   - Performance 分析
   - Network 監控

2. **監控關鍵指標**
   - 首屏載入時間 (FCP)
   - 最大內容繪製 (LCP)
   - 累積佈局偏移 (CLS)

## 常見問題

### Q: 如何更新應用版本？

A: 修改 `sw.js` 中的 `CACHE_NAME`，例如從 `busapp-v1` 改為 `busapp-v2`。Service Worker 會自動清除舊快取。

### Q: 深色模式不工作？

A: 確保作業系統或瀏覽器已啟用深色模式。在 Chrome 中，可在 DevTools > Rendering > Emulate CSS media feature prefers-color-scheme 中測試。

### Q: 離線模式如何工作？

A: Service Worker 會快取所有靜態資源和最近的 API 響應。在離線狀態下，應用會使用快取資料。

## 參考資源

- [MDN - Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MDN - Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Google - Web Fundamentals](https://developers.google.com/web/fundamentals)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

## 支援與回饋

如有任何問題或建議，請提交 Issue 或 Pull Request。

---

**最後更新**：2026 年 5 月 5 日
**版本**：1.0.0 (Optimized)
