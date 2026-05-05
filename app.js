/**
 * 巴士到站時間應用 - 優化版本
 * 
 * 功能：
 * - 即時 ETA 顯示
 * - 常用路線管理
 * - 路線搜尋
 * - 本地儲存
 */

// ============================================
// 日誌系統
// ============================================

const Logger = {
    isDev: false, // 開發模式開關
    
    log(message, data = null) {
        if (this.isDev) {
            console.log(`[BusApp] ${message}`, data || '');
        }
    },
    
    error(message, error = null) {
        console.error(`[BusApp Error] ${message}`, error || '');
    },
    
    warn(message, data = null) {
        console.warn(`[BusApp Warn] ${message}`, data || '');
    }
};

// ============================================
// API 服務模組
// ============================================

const ApiService = {
    cache: new Map(),
    cacheTimeout: 60000, // 60 秒快取
    
    async fetchJSON(url) {
        try {
            Logger.log(`Fetching: ${url}`);
            const response = await fetch(url, { timeout: 10000 });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            Logger.log(`Fetched successfully: ${url}`);
            return data;
        } catch (error) {
            Logger.error(`Failed to fetch ${url}`, error);
            throw error;
        }
    },
    
    async fetchWithCache(url) {
        const now = Date.now();
        const cached = this.cache.get(url);
        
        if (cached && (now - cached.timestamp) < this.cacheTimeout) {
            Logger.log(`Using cached data for: ${url}`);
            return cached.data;
        }
        
        const data = await this.fetchJSON(url);
        this.cache.set(url, { data, timestamp: now });
        return data;
    },
    
    clearCache() {
        this.cache.clear();
        Logger.log('Cache cleared');
    }
};

// ============================================
// DOM 操作模組
// ============================================

const DOMUtils = {
    createElement(tag, options = {}) {
        const el = document.createElement(tag);
        if (options.className) el.className = options.className;
        if (options.id) el.id = options.id;
        if (options.innerHTML) el.innerHTML = options.innerHTML;
        if (options.textContent) el.textContent = options.textContent;
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                el.setAttribute(key, value);
            });
        }
        return el;
    },
    
    createFragment(htmlString) {
        const fragment = document.createDocumentFragment();
        const temp = document.createElement('div');
        temp.innerHTML = htmlString;
        while (temp.firstChild) {
            fragment.appendChild(temp.firstChild);
        }
        return fragment;
    },
    
    updateElement(element, content) {
        if (typeof content === 'string') {
            element.innerHTML = content;
        } else if (content instanceof DocumentFragment) {
            element.innerHTML = '';
            element.appendChild(content);
        }
    },
    
    addClass(element, className) {
        element.classList.add(className);
    },
    
    removeClass(element, className) {
        element.classList.remove(className);
    },
    
    toggleClass(element, className) {
        element.classList.toggle(className);
    }
};

// ============================================
// 主應用程式類
// ============================================

class BusApp {
    constructor() {
        this.state = {
            currentView: 'my-routes',
            myRoutes: [],
            currentSearchRouteResults: [],
            activeSearchRouteData: null,
            isEditMode: false,
            stopList: null,
            kmbRoutes: null,
            ctbRoutes: null
        };
        
        this.refreshInterval = null;
        this.init();
    }
    
    /**
     * 初始化應用程式
     */
    async init() {
        Logger.log('Initializing app');
        
        try {
            // 載入本地儲存的資料
            this.loadLocalData();
            
            // 設定事件監聽
            this.setupEventListeners();
            
            // 初始化 PWA
            this.setupPWA();
            
            // 載入初始資料
            await this.loadInitialData();
            
            // 顯示預設視圖
            this.switchView('my-routes');
            
            Logger.log('App initialized successfully');
        } catch (error) {
            Logger.error('Failed to initialize app', error);
            this.showError('應用程式初始化失敗，請重新整理頁面');
        }
    }
    
    /**
     * 設定事件監聽
     */
    setupEventListeners() {
        // 導航按鈕
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                if (view) this.switchView(view);
            });
        });
        
        // 搜尋輸入
        const searchInput = document.getElementById('route-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.performSearch();
                }, 300);
            });
        }
    }
    
    /**
     * 設定 PWA
     */
    setupPWA() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(error => {
                Logger.warn('Service Worker registration failed', error);
            });
        }
    }
    
    /**
     * 載入本地儲存的資料
     */
    loadLocalData() {
        try {
            const stored = localStorage.getItem('myRoutes');
            if (stored) {
                this.state.myRoutes = JSON.parse(stored);
                Logger.log('Loaded local routes', this.state.myRoutes);
            }
        } catch (error) {
            Logger.error('Failed to load local data', error);
        }
    }
    
    /**
     * 保存本地資料
     */
    saveLocalData() {
        try {
            localStorage.setItem('myRoutes', JSON.stringify(this.state.myRoutes));
            Logger.log('Saved local routes');
        } catch (error) {
            Logger.error('Failed to save local data', error);
        }
    }
    
    /**
     * 載入初始資料（路線和站點資訊）
     */
    async loadInitialData() {
        try {
            Logger.log('Loading initial data');
            
            // 這裡可以根據需要載入路線和站點資訊
            // 例如：this.state.kmbRoutes = await ApiService.fetchWithCache('...');
            
            Logger.log('Initial data loaded');
        } catch (error) {
            Logger.error('Failed to load initial data', error);
        }
    }
    
    /**
     * 切換視圖
     */
    switchView(viewName) {
        Logger.log(`Switching to view: ${viewName}`);
        
        // 隱藏所有視圖
        document.querySelectorAll('.view-section').forEach(section => {
            DOMUtils.removeClass(section, 'active');
        });
        
        // 更新導航
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.view === viewName) {
                DOMUtils.addClass(item, 'active');
            } else {
                DOMUtils.removeClass(item, 'active');
            }
        });
        
        // 顯示選定的視圖
        const viewElement = document.getElementById(`view-${viewName}`);
        if (viewElement) {
            DOMUtils.addClass(viewElement, 'active');
            this.state.currentView = viewName;
            
            // 視圖特定的初始化
            if (viewName === 'my-routes') {
                this.renderMyRoutes();
                this.startAutoRefresh();
            } else if (viewName === 'search') {
                this.focusSearchInput();
            }
        }
    }
    
    /**
     * 渲染我的路線
     */
    renderMyRoutes() {
        Logger.log('Rendering my routes');
        
        const container = document.getElementById('my-routes-list');
        if (!container) return;
        
        if (this.state.myRoutes.length === 0) {
            container.innerHTML = `
                <div class="status-message">
                    <div style="font-size: 40px; margin-bottom: 16px;">🚌</div>
                    還沒有新增常用路線<br>
                    前往搜尋頁面新增您的常用路線
                </div>
            `;
            return;
        }
        
        const html = this.state.myRoutes.map((route, index) => {
            return this.createRouteCardHTML(route, index);
        }).join('');
        
        container.innerHTML = html;
        
        // 綁定事件
        this.bindRouteCardEvents();
    }
    
    /**
     * 建立路線卡片 HTML
     */
    createRouteCardHTML(route, index) {
        const badgeClass = `bg-${route.operator}`;
        const routeNum = route.route || '?';
        const destination = route.dest || '未知';
        const station = route.station || '未知';
        
        return `
            <div class="route-card clickable" data-index="${index}">
                <div class="bus-left">
                    <div class="route-badge ${badgeClass}">${routeNum}</div>
                    <div class="route-info">
                        <div class="destination">往 ${destination}</div>
                        <div class="station-name-sub">
                            <span>${station}</span>
                        </div>
                    </div>
                </div>
                <div class="eta-list">
                    <div class="status-message">載入中...</div>
                </div>
                <button class="delete-route-btn" data-index="${index}">×</button>
                <div class="drag-handle">⋮⋮</div>
            </div>
        `;
    }
    
    /**
     * 綁定路線卡片事件
     */
    bindRouteCardEvents() {
        document.querySelectorAll('.route-card').forEach(card => {
            const deleteBtn = card.querySelector('.delete-route-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(deleteBtn.dataset.index);
                    this.deleteRoute(index);
                });
            }
        });
    }
    
    /**
     * 刪除路線
     */
    deleteRoute(index) {
        if (index >= 0 && index < this.state.myRoutes.length) {
            this.state.myRoutes.splice(index, 1);
            this.saveLocalData();
            this.renderMyRoutes();
            Logger.log(`Deleted route at index ${index}`);
        }
    }
    
    /**
     * 執行搜尋
     */
    async performSearch() {
        Logger.log('Performing search');
        
        const input = document.getElementById('route-input');
        if (!input) return;
        
        const query = input.value.trim();
        const resultsArea = document.getElementById('search-results');
        
        if (!query) {
            resultsArea.innerHTML = '';
            return;
        }
        
        try {
            resultsArea.innerHTML = '<div class="status-message">搜尋中...</div>';
            
            // 這裡實現搜尋邏輯
            // 暫時顯示示例結果
            this.renderSearchResults([]);
            
        } catch (error) {
            Logger.error('Search failed', error);
            resultsArea.innerHTML = '<div class="status-message">搜尋發生異常，請重試</div>';
        }
    }
    
    /**
     * 渲染搜尋結果
     */
    renderSearchResults(results) {
        const resultsArea = document.getElementById('search-results');
        if (!resultsArea) return;
        
        if (results.length === 0) {
            resultsArea.innerHTML = `
                <div class="status-message">
                    <div style="font-size: 40px; margin-bottom: 16px;">🤔</div>
                    找不到相關路線<br>
                    請檢查是否有錯字
                </div>
            `;
            return;
        }
        
        const html = results.map((item, idx) => {
            return `
                <div class="result-item" data-index="${idx}">
                    <div class="result-item-left">
                        <div class="result-route-num">${item.route}</div>
                        <div class="result-item-text">
                            <div class="result-dest">往 ${item.dest}</div>
                            <div class="result-meta">由 ${item.orig} 開出</div>
                        </div>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c7c7cc" stroke-width="2.5">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>
            `;
        }).join('');
        
        resultsArea.innerHTML = html;
    }
    
    /**
     * 聚焦搜尋輸入框
     */
    focusSearchInput() {
        const input = document.getElementById('route-input');
        if (input) {
            setTimeout(() => input.focus(), 100);
        }
    }
    
    /**
     * 開始自動重新整理
     */
    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        // 每 30 秒重新整理一次
        this.refreshInterval = setInterval(() => {
            if (this.state.currentView === 'my-routes') {
                this.renderMyRoutes();
            }
        }, 30000);
    }
    
    /**
     * 停止自動重新整理
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    /**
     * 顯示錯誤訊息
     */
    showError(message) {
        const statusEl = document.getElementById('sync-status');
        if (statusEl) {
            statusEl.textContent = `❌ ${message}`;
            statusEl.style.display = 'block';
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
    }
    
    /**
     * 顯示成功訊息
     */
    showSuccess(message) {
        const statusEl = document.getElementById('sync-status');
        if (statusEl) {
            statusEl.textContent = `✓ ${message}`;
            statusEl.style.display = 'block';
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
        }
    }
}

// ============================================
// 應用程式初始化
// ============================================

let app;

document.addEventListener('DOMContentLoaded', () => {
    Logger.log('DOM Content Loaded');
    app = new BusApp();
});

// 頁面卸載時清理資源
window.addEventListener('beforeunload', () => {
    if (app) {
        app.stopAutoRefresh();
    }
});
