/**
 * Service Worker - 巴士到站時間應用
 * 
 * 功能：
 * - 應用程式快取
 * - 離線支援
 * - 背景同步
 */

const CACHE_NAME = 'busapp-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index_optimized.html',
    '/styles.css',
    '/app.js',
    'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js'
];

// ============================================
// 安裝事件
// ============================================

self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[Service Worker] Caching assets');
            return cache.addAll(ASSETS_TO_CACHE).catch(error => {
                console.warn('[Service Worker] Some assets failed to cache', error);
                // 不要因為某些資源失敗而中止安裝
                return Promise.resolve();
            });
        })
    );
    
    self.skipWaiting();
});

// ============================================
// 激活事件
// ============================================

self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    self.clients.claim();
});

// ============================================
// 請求攔截
// ============================================

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // 只處理 GET 請求
    if (request.method !== 'GET') {
        return;
    }
    
    // API 請求：網路優先，失敗則使用快取
    if (url.hostname.includes('data.etabus.gov.hk') || 
        url.hostname.includes('rt.data.gov.hk')) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // 靜態資源：快取優先，失敗則使用網路
    if (request.destination === 'style' || 
        request.destination === 'script' || 
        request.destination === 'image') {
        event.respondWith(cacheFirst(request));
        return;
    }
    
    // 其他請求：快取優先
    event.respondWith(cacheFirst(request));
});

// ============================================
// 快取策略
// ============================================

/**
 * 網路優先策略
 */
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        
        // 快取成功的響應
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.log('[Service Worker] Network request failed, using cache', error);
        
        // 嘗試從快取中獲取
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        
        // 返回離線頁面或錯誤響應
        return new Response('離線模式：無法載入此資源', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'text/plain; charset=utf-8'
            })
        });
    }
}

/**
 * 快取優先策略
 */
async function cacheFirst(request) {
    try {
        // 先嘗試從快取中獲取
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        
        // 快取中沒有，則從網路獲取
        const response = await fetch(request);
        
        // 快取新的響應
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.log('[Service Worker] Cache first failed', error);
        
        // 返回離線頁面或錯誤響應
        return new Response('離線模式：無法載入此資源', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'text/plain; charset=utf-8'
            })
        });
    }
}

// ============================================
// 背景同步
// ============================================

self.addEventListener('sync', event => {
    if (event.tag === 'sync-routes') {
        event.waitUntil(syncRoutes());
    }
});

async function syncRoutes() {
    try {
        console.log('[Service Worker] Syncing routes...');
        // 實現背景同步邏輯
    } catch (error) {
        console.error('[Service Worker] Sync failed', error);
        throw error;
    }
}

// ============================================
// 推送通知
// ============================================

self.addEventListener('push', event => {
    if (!event.data) {
        return;
    }
    
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: data.tag || 'busapp-notification',
        requireInteraction: false
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// 處理通知點擊
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            // 如果已有視窗打開，則聚焦該視窗
            for (let i = 0; i < clientList.length; i++) {
                if (clientList[i].url === '/' && 'focus' in clientList[i]) {
                    return clientList[i].focus();
                }
            }
            // 否則打開新視窗
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
