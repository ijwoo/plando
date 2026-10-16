import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { fetchTodos } from "../../features/todo/api/todoApi.js";
import { isIOS } from "../utils/platformUtils.js";
import { APP_EVENTS } from "../constants/events.js";
import { getToken } from "../utils/tokenUtils.js";
import { pushTodayTodosToWidget, setWidgetLoggedIn } from "../native/widgetSync.js";

/**
 * iOS 위젯과의 전역 동기화 훅.
 *
 * App.jsx 에 1회 mount. 비 iOS / 비 native 환경에서는 즉시 return — 다른 플랫폼 영향 0.
 *
 * 동작:
 *   1) 마운트 시 — 토큰 있으면 setWidgetLoggedIn(true) + fetchTodos → push.
 *   2) todo CRUD 이벤트(`TODO_ADDED/UPDATED/DELETED`) 시 800ms debounce 후 재fetch & push.
 *   3) 앱이 foreground 로 복귀할 때(resume) 재sync — 백그라운드 동안 다른 디바이스의 변경 반영.
 *
 * 위젯 로그아웃 정리(setWidgetLoggedIn=false + clear) 는 tokenUtils.removeToken 에서 처리.
 */
export default function useWidgetSync() {
    const debounceRef = useRef(null);

    useEffect(() => {
        if (!isIOS || !Capacitor.isNativePlatform()) return undefined;

        const sync = async () => {
            const hasToken = !!getToken();
            await setWidgetLoggedIn(hasToken);
            if (!hasToken) return;
            try {
                const res = await fetchTodos();
                const todos = Array.isArray(res?.data) ? res.data : [];
                await pushTodayTodosToWidget(todos, null);
            } catch (e) {
                // 401 등 — 위젯은 이전 캐시 유지
                console.warn("[widget] fetchTodos 실패:", e);
            }
        };

        const debouncedSync = () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                debounceRef.current = null;
                sync();
            }, 800);
        };

        // 1) 초기 push
        sync();

        // 2) todo CRUD
        window.addEventListener(APP_EVENTS.TODO_ADDED, debouncedSync);
        window.addEventListener(APP_EVENTS.TODO_UPDATED, debouncedSync);
        window.addEventListener(APP_EVENTS.TODO_DELETED, debouncedSync);

        // 3) foreground 복귀 시 — 위젯 sync + 메인 앱 todo 화면들도 refetch 트리거.
        //    위젯에서 체크박스로 완료한 todo를 앱이 다시 켜질 때 즉시 반영하기 위함.
        let resumeSubscription;
        CapacitorApp.addListener("appStateChange", ({ isActive }) => {
            if (isActive) {
                debouncedSync();
                window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED));
            }
        }).then((s) => { resumeSubscription = s; })
          .catch(() => {});

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            window.removeEventListener(APP_EVENTS.TODO_ADDED, debouncedSync);
            window.removeEventListener(APP_EVENTS.TODO_UPDATED, debouncedSync);
            window.removeEventListener(APP_EVENTS.TODO_DELETED, debouncedSync);
            resumeSubscription?.remove?.();
        };
    }, []);
}
