/* global clients */
import { precacheAndRoute } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)

// ── Capacitor WKWebView에선 "탭 닫음"이 없어 SW가 영원히 옛 버전을 서빙하던 문제 해결.
//   1) install 단계에서 skipWaiting() — 새 SW가 곧장 active 상태로 전이
//   2) activate 단계에서 clients.claim() — 현재 열려있는 클라이언트(WebView)를 즉시 새 SW가 제어
//   3) 그 뒤 controlled 클라이언트들에게 navigate(url)을 호출해 강제 리로드 — 새 precache에서 신규 번들 로드
//   페이지 쪽 controllerchange 리스너가 없어도 SW가 직접 reload를 트리거하므로 옛 페이지에서도 한 번에 갱신됨.
self.addEventListener('install', () => {
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        await self.clients.claim()
        const all = await self.clients.matchAll({ type: 'window' })
        for (const client of all) {
            if ('navigate' in client) {
                try { await client.navigate(client.url) } catch { /* 일부 환경에서 throw 가능 — 무시 */ }
            }
        }
    })())
})

// ── Push 수신 ──────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
    if (!event.data) return

    let data
    try {
        data = event.data.json()
    } catch {
        data = { title: 'Plan Do!', body: event.data.text() }
    }

    event.waitUntil(
        self.registration.showNotification(data.title || 'Plan Do!', {
            body: data.body || '',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'plando-push',
            renotify: true,
            data: { url: data.url || '/' },
        })
    )
})

// ── 알림 클릭 → 해당 URL로 이동 ─────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const targetUrl = event.notification.data?.url || '/'
    event.waitUntil(
        clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if ('navigate' in client) {
                        return client.navigate(targetUrl).then((c) => c && c.focus())
                    }
                    if ('focus' in client) return client.focus()
                }
                if (clients.openWindow) {
                    return clients.openWindow(targetUrl)
                }
            })
    )
})
