import { useState, useEffect } from 'react'
import axiosInstance from '../../../shared/api/axiosInstance.js'
import { isIOS, isNative } from '../../../shared/utils/platformUtils.js'
import { registerApnsToken, unregisterApnsToken } from '../api/notificationsApi.js'

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

function getNotificationPermission() {
    try {
        return typeof Notification !== 'undefined' ? Notification.permission : 'default'
    } catch {
        return 'default'
    }
}

function isWebPushSupported() {
    try {
        return (
            typeof window !== 'undefined' &&
            'serviceWorker' in navigator &&
            'PushManager' in window &&
            typeof Notification !== 'undefined'
        )
    } catch {
        return false
    }
}

function buildSubscribeErrorMessage(e) {
    const code = e?.code
    if (code === 'APNS_TIMEOUT') {
        return [
            '푸시 알림 등록에 실패했어요.',
            '',
            '아래 항목을 차례로 시도해주세요:',
            '1. 아이폰 재시작',
            '2. Wi-Fi → 셀룰러로 전환 후 재시도 (일부 Wi-Fi가 푸시 포트를 차단함)',
            '3. 비행기 모드 ON/OFF',
            '4. 그래도 안 되면 앱 삭제 후 재설치',
        ].join('\n')
    }
    if (code === 'APNS_REGISTRATION_ERROR') {
        return `푸시 알림 등록에 실패했어요.\n사유: ${e?.message || 'unknown'}\n\n잠시 후 다시 시도해주세요.`
    }
    return `푸시 알림 등록에 실패했어요.\n${e?.message || ''}`
}

// unsubscribe 시 사용 + UI 토글 상태 persist용 토큰 캐시.
// 메모리 변수 + localStorage (앱 재시작 시 토글 상태 복원).
const APNS_TOKEN_LS_KEY = "plando.apnsToken"
function getCachedToken() {
    try { return localStorage.getItem(APNS_TOKEN_LS_KEY) } catch { return null }
}
function setCachedToken(token) {
    try {
        if (token) localStorage.setItem(APNS_TOKEN_LS_KEY, token)
        else localStorage.removeItem(APNS_TOKEN_LS_KEY)
    } catch {}
}
let cachedApnsToken = getCachedToken()

async function loadCapacitorPush() {
    return await import('@capacitor/push-notifications')
}

/** register() 호출 전 listener를 미리 attach해서 token 발급을 받는다. cleanup 보장.
 *  타임아웃이 너무 길면 사용자가 멈춘 줄 알기 때문에 30초로 제한. APNs 토큰은 정상 환경에선 보통 1~3초 내 발급됨. */
async function registerAndGetToken(timeoutMs = 30000) {
    const { PushNotifications } = await loadCapacitorPush()

    let regHandle, errHandle, timer, resolveFn, rejectFn
    const tokenPromise = new Promise((resolve, reject) => {
        resolveFn = resolve
        rejectFn = reject
    })

    const cleanup = () => {
        try { regHandle?.remove?.() } catch (_) {}
        try { errHandle?.remove?.() } catch (_) {}
        if (timer) clearTimeout(timer)
    }

    regHandle = await PushNotifications.addListener('registration', (token) => {
        cleanup()
        resolveFn(token?.value || '')
    })
    errHandle = await PushNotifications.addListener('registrationError', (err) => {
        cleanup()
        const reason = err?.error || 'unknown'
        const e = new Error(`APNs registration failed: ${reason}`)
        e.code = 'APNS_REGISTRATION_ERROR'
        rejectFn(e)
    })

    timer = setTimeout(() => {
        cleanup()
        const e = new Error('APNS_TIMEOUT')
        e.code = 'APNS_TIMEOUT'
        rejectFn(e)
    }, timeoutMs)

    await PushNotifications.register()
    return await tokenPromise
}

export function usePushSubscription() {
    const [subscribed, setSubscribed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [supported, setSupported] = useState(false)
    const [permission, setPermission] = useState(getNotificationPermission)
    const isStandalone = typeof window !== 'undefined' && window.navigator.standalone === true

    // iOS Capacitor 앱은 PWA standalone과 무관 (네이티브 앱)
    const needsInstall = isIOS && !isNative && !isStandalone

    useEffect(() => {
        if (isNative) {
            setSupported(true)
            setSubscribed(!!cachedApnsToken)
        } else {
            const ok = isWebPushSupported()
            setSupported(ok)
            if (ok) checkSubscription()
        }
    }, [])

    const checkSubscription = async () => {
        try {
            const reg = await Promise.race([
                navigator.serviceWorker.ready,
                new Promise((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 5000)),
            ])
            const sub = await reg.pushManager.getSubscription()
            setSubscribed(!!sub)
        } catch {
            // SW 미등록 — 구독 없음
        }
    }

    const subscribe = async () => {
        setLoading(true)
        try {
            if (isNative) {
                const { PushNotifications } = await loadCapacitorPush()

                const permResp = await PushNotifications.requestPermissions()
                const granted = permResp.receive === 'granted'
                setPermission(granted ? 'granted' : (permResp.receive || 'denied'))
                if (!granted) return

                const token = await registerAndGetToken()
                if (!token) throw new Error('빈 APNs 토큰')

                cachedApnsToken = token
                setCachedToken(token)
                await registerApnsToken(token)
                setSubscribed(true)
            } else {
                const perm = await Notification.requestPermission()
                setPermission(perm)
                if (perm !== 'granted') return

                const { data } = await axiosInstance.get('/notifications/vapid-public-key')

                const reg = await Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('SW not ready')), 8000)),
                ])

                const sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(data.publicKey),
                })
                const json = sub.toJSON()
                await axiosInstance.post('/notifications/push/subscribe', {
                    endpoint: json.endpoint,
                    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
                })
                setSubscribed(true)
            }
        } catch (e) {
            console.error('Push subscribe failed:', {
                message: e?.message,
                code: e?.code,
                errorMessage: e?.errorMessage,
                name: e?.name,
                str: String(e),
            })
            const userMessage = buildSubscribeErrorMessage(e)
            try { alert(userMessage) } catch (_) {}
        } finally {
            setLoading(false)
        }
    }

    const unsubscribe = async () => {
        setLoading(true)
        try {
            if (isNative) {
                if (cachedApnsToken) {
                    try { await unregisterApnsToken(cachedApnsToken) } catch (_) {}
                }
                cachedApnsToken = null
                setCachedToken(null)
                setSubscribed(false)
            } else {
                const reg = await navigator.serviceWorker.ready
                const sub = await reg.pushManager.getSubscription()
                if (sub) {
                    await axiosInstance.delete('/notifications/push/unsubscribe', {
                        data: { endpoint: sub.endpoint },
                    })
                    await sub.unsubscribe()
                }
                setSubscribed(false)
            }
        } catch (e) {
            console.error('Push unsubscribe failed:', e)
        } finally {
            setLoading(false)
        }
    }

    return { subscribed, loading, supported, permission, subscribe, unsubscribe, needsInstall, isIOS }
}
