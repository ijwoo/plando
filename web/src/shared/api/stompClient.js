import { Client } from "@stomp/stompjs";
import { getToken } from "../utils/tokenUtils.js";
import { APP_EVENTS } from "../constants/events.js";

/**
 * 앱 전역 단일 STOMP 연결.
 * 기존엔 presence(useGlobalStomp)와 DM 방(useWebSocket)이 각각 별도 연결을 만들고,
 * DM은 방을 옮길 때마다 새 연결을 activate/deactivate 했다(핸드셰이크 churn).
 * → 연결 1개를 공유하고 destination별 subscribe/unsubscribe만 한다.
 *
 *  stompSubscribe(destination, onMessage) → unsubscribe 함수 반환
 *  stompPublish(destination, body)        → 연결돼 있으면 publish (boolean)
 *  stompReconnect()                       → 토큰 변경 시 재연결
 */

function resolveWsUrl() {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    const apiBase = import.meta.env.VITE_API_BASE_URL;
    if (apiBase) {
        return `${apiBase}/ws`
            .replace(/^http:\/\//, "ws://")
            .replace(/^https:\/\//, "wss://");
    }
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws`;
}
const WS_URL = resolveWsUrl();

let client = null;
let connected = false;
let currentToken = null;
const subs = new Map(); // id -> { destination, handler, stompSub }
let seq = 0;

function activate() {
    const token = getToken();
    if (!token) return;
    if (client && currentToken === token) return; // 이미 같은 토큰으로 연결/연결중
    if (client) { try { client.deactivate(); } catch { /* ignore */ } }

    currentToken = token;
    connected = false;
    client = new Client({
        brokerURL: WS_URL,
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 5000,
        debug: () => {},
        onConnect: () => {
            connected = true;
            // 재연결 포함 — 등록된 모든 구독을 (재)연결
            for (const s of subs.values()) {
                s.stompSub = client.subscribe(s.destination, s.handler);
            }
            window.dispatchEvent(new Event(APP_EVENTS.STOMP_CONNECTED));
        },
        onWebSocketClose: () => { connected = false; },
    });
    client.activate();
}

export function stompEnsure() {
    activate();
}

export function stompReconnect() {
    activate();
}

export function stompSubscribe(destination, onMessage) {
    activate();
    const id = ++seq;
    const handler = (frame) => {
        try { onMessage(JSON.parse(frame.body)); } catch { /* parse 실패 무시 */ }
    };
    const entry = { destination, handler, stompSub: null };
    subs.set(id, entry);
    if (client && connected) {
        entry.stompSub = client.subscribe(destination, handler);
    }
    return () => {
        const e = subs.get(id);
        if (e?.stompSub) { try { e.stompSub.unsubscribe(); } catch { /* ignore */ } }
        subs.delete(id);
    };
}

export function stompPublish(destination, body) {
    activate();
    if (client && connected) {
        client.publish({ destination, body: JSON.stringify(body) });
        return true;
    }
    return false;
}
