import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { APP_EVENTS } from "../shared/constants/events.js";

const LayoutContext = createContext(null);

const LS_SIDEBAR = "settings.sidebarCollapsed";
const LS_DETAIL_LAYOUT = "settings.detailLayout";
/** 레거시 키 — 예전엔 확장 여부만 boolean 으로 저장했다. 읽기만 하고 새로 쓰지 않는다. */
const LS_DETAIL_EXPANDED = "settings.detailExpanded";

/**
 * 할 일 상세를 어떤 배치로 볼지. ClickUp 의 Switch layout 과 같은 3종.
 *  sidebar    — 오른쪽 사이드 패널(420px). 목록을 보면서 훑을 때
 *  modal      — 가운데 모달. 이 할 일에만 집중할 때
 *  fullscreen — 본문 영역을 가득 채우고 댓글을 오른쪽 열에 상시 노출. 길게 쓰고 논의할 때
 */
export const DETAIL_LAYOUTS = ["sidebar", "modal", "fullscreen"];

function readInitialDetailLayout() {
    const v = localStorage.getItem(LS_DETAIL_LAYOUT);
    if (DETAIL_LAYOUTS.includes(v)) return v;
    // 레거시 사용자: 확장을 켜 두었으면 모달로 이어준다(그때의 확장이 모달이었다).
    return localStorage.getItem(LS_DETAIL_EXPANDED) === "true" ? "modal" : "sidebar";
}

export function LayoutProvider({ children }) {
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailContent, setDetailContent] = useState(null);
    // 상세 배치 선호 — 다음 열기에도 유지
    const [detailLayout, setDetailLayoutState] = useState(readInitialDetailLayout);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(
        () => localStorage.getItem(LS_SIDEBAR) === "true"
    );

    // SettingsPage 등 외부에서 localStorage를 직접 바꾸고 settings-changed를 발생시킬 때 동기화
    useEffect(() => {
        const sync = () => setSidebarCollapsed(localStorage.getItem(LS_SIDEBAR) === "true");
        window.addEventListener(APP_EVENTS.SETTINGS_CHANGED, sync);
        return () => window.removeEventListener(APP_EVENTS.SETTINGS_CHANGED, sync);
    }, []);

    const toggleSidebar = useCallback(() => {
        setSidebarCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem(LS_SIDEBAR, String(next));
            window.dispatchEvent(new Event(APP_EVENTS.SETTINGS_CHANGED));
            return next;
        });
    }, []);

    // ReactNode를 받아 우측 패널에 렌더링
    const openDetail = useCallback((node) => {
        setDetailContent(node ?? null);
        setDetailOpen(true);
    }, []);

    const closeDetail = useCallback(() => setDetailOpen(false), []);

    const clearDetail = useCallback(() => {
        setDetailOpen(false);
        setDetailContent(null);
    }, []);

    const setDetailLayout = useCallback((next) => {
        if (!DETAIL_LAYOUTS.includes(next)) return;
        localStorage.setItem(LS_DETAIL_LAYOUT, next);
        setDetailLayoutState(next);
    }, []);

    // 몰입 모드 — 페이지(캘린더 풀스크린 등)가 글로벌 Navbar/바텀네비를 숨기고 싶을 때
    const [immersive, setImmersive] = useState(false);

    // Pull-to-refresh: pages register their refresh fn via setPageRefresh
    const pageRefreshRef = useRef(null);
    const setPageRefresh = useCallback((fn) => {
        pageRefreshRef.current = fn ?? null;
    }, []);

    const value = useMemo(
        () => ({
            sidebarCollapsed,
            toggleSidebar,
            detailOpen,
            detailContent,
            detailLayout,
            setDetailLayout,
            openDetail,
            closeDetail,
            clearDetail,
            setPageRefresh,
            pageRefreshRef,
            immersive,
            setImmersive,
        }),
        [sidebarCollapsed, toggleSidebar, detailOpen, detailContent, detailLayout, setDetailLayout, openDetail, closeDetail, clearDetail, setPageRefresh, immersive]
    );

    return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout() {
    const ctx = useContext(LayoutContext);
    if (!ctx) throw new Error("useLayout must be used within a LayoutProvider");
    return ctx;
}
