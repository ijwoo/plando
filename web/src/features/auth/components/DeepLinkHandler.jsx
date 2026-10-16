import { useEffect } from "react";
import { getTaskPath } from "../../todo/utils/taskView.js";
import { useNavigate } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isNative } from "../../../shared/utils/platformUtils.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";

export default function DeepLinkHandler() {
    const navigate = useNavigate();

    useEffect(() => {
        if (!isNative) return;

        let subscription;
        CapacitorApp.addListener("appUrlOpen", ({ url }) => {
            if (!url || !url.startsWith("plando://")) return;

            // ── 위젯 deep link ───────────────────────────
            // plando://today          → 대시보드
            // plando://calendar       → 캘린더
            // plando://todo/{id}      → 보드(/todos)로 이동, openId 쿼리 전달
            // plando://addTodo        → 보드(/todos)로 이동 + 추가 모달 자동 오픈
            if (url.startsWith("plando://today")) {
                navigate("/dashboard", { replace: true });
                return;
            }
            if (url.startsWith("plando://calendar")) {
                navigate("/calendar", { replace: true });
                return;
            }
            if (url.startsWith("plando://addTodo")) {
                // 보드를 박아두면 목록을 쓰는 사람도 딥링크마다 보드로 튄다
                navigate(getTaskPath(), { replace: true });
                // navigate 후 mount 완료 대기 → AddTodoModal 자동 오픈 이벤트 dispatch
                setTimeout(() => {
                    window.dispatchEvent(new Event(APP_EVENTS.OPEN_ADD_TODO));
                }, 150);
                return;
            }
            const todoMatch = url.match(/^plando:\/\/todo\/(\d+)/);
            if (todoMatch) {
                navigate(`/todos?openId=${encodeURIComponent(todoMatch[1])}`, { replace: true });
                return;
            }

            // ── OAuth 콜백 (기존) ─────────────────────────
            const queryIndex = url.indexOf("?");
            const search = queryIndex >= 0 ? url.slice(queryIndex) : "";
            const params = new URLSearchParams(search);
            const error = params.get("error");
            const token = params.get("token");
            const isNew = params.get("isNew");

            Browser.close().catch(() => {});

            if (error) {
                navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
                return;
            }
            if (token) {
                // JWT 기본 형식 검증 (header.payload.signature)
                const parts = token.split(".");
                if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
                    navigate("/login?error=invalid_token", { replace: true });
                    return;
                }
                const qs = new URLSearchParams();
                qs.set("token", token);
                if (isNew != null) qs.set("isNew", isNew);
                navigate(`/oauth2/callback?${qs.toString()}`, { replace: true });
            }
        }).then((s) => { subscription = s; });

        return () => { subscription?.remove(); };
    }, [navigate]);

    return null;
}
