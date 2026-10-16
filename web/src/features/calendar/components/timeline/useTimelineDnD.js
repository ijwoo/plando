import { useState, useRef, useCallback, useEffect } from "react";
import moment from "moment";
import {
    TOTAL_MINUTES, SNAP, LONG_PRESS_MS, CANCEL_MOVE_PX,
    AUTO_SCROLL_ZONE, AUTO_SCROLL_SPEED, SWIPE_RATIO,
    pxToMin, snap,
} from "./timelineConstants.js";

/**
 * 타임라인 DnD 훅 — 빈 영역 드래그 생성 + 이벤트 이동 + 스와이프.
 * 일 뷰/주 뷰에서 공유.
 *
 * @param {{
 *   scrollRef: React.RefObject,
 *   gridRef: React.RefObject,
 *   containerRef: React.RefObject,
 *   getDateAt: (clientX: number) => Date,   // touchX → 해당 컬럼 기준 날짜
 *   getColIdx?: (clientX: number) => number, // 인디케이터 표시용 (선택)
 *   onCreateSlot?: (start: Date, end: Date) => void,
 *   onEventDrop?: ({ event, start, end }) => void,
 *   onSwipe?: (dir: 1|-1) => void,
 *   ev_eventDate?: (ev) => Date,            // 이벤트의 원본 날짜 (week에서 사용)
 * }} opts
 */
export default function useTimelineDnD({
    scrollRef, gridRef, containerRef,
    getDateAt, getColIdx,
    onCreateSlot, onEventDrop, onSwipe,
}) {
    const [moveDrag, setMoveDrag] = useState(null);
    const [createDrag, setCreateDrag] = useState(null);
    const activeRef = useRef(null);
    const timerRef = useRef(null);
    const autoScrollRef = useRef(null);
    const swipeRef = useRef({ sx: 0, sy: 0, mode: null, dx: 0 });

    // 매 렌더마다 최신 callback을 ref에 저장 — touchmove 리스너의 stale closure 방지
    const getDateAtRef = useRef(getDateAt);
    const getColIdxRef = useRef(getColIdx);
    useEffect(() => {
        getDateAtRef.current = getDateAt;
        getColIdxRef.current = getColIdx;
    });

    const yToMin = useCallback((clientY) => {
        const g = gridRef.current;
        if (!g) return 0;
        return Math.max(0, Math.min(TOTAL_MINUTES, pxToMin(clientY - g.getBoundingClientRect().top)));
    }, [gridRef]);

    const startAutoScroll = useCallback((clientY) => {
        if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);
        const el = scrollRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const topD = clientY - r.top, botD = r.bottom - clientY;
        let sp = 0;
        if (topD < AUTO_SCROLL_ZONE) sp = -AUTO_SCROLL_SPEED * (1 - topD / AUTO_SCROLL_ZONE);
        else if (botD < AUTO_SCROLL_ZONE) sp = AUTO_SCROLL_SPEED * (1 - botD / AUTO_SCROLL_ZONE);
        if (sp) {
            const tick = () => { el.scrollTop += sp; autoScrollRef.current = requestAnimationFrame(tick); };
            autoScrollRef.current = requestAnimationFrame(tick);
        }
    }, [scrollRef]);

    const stopAutoScroll = useCallback(() => {
        if (autoScrollRef.current) { cancelAnimationFrame(autoScrollRef.current); autoScrollRef.current = null; }
    }, []);

    const clearTimer = () => { clearTimeout(timerRef.current); timerRef.current = null; };
    useEffect(() => () => { clearTimer(); stopAutoScroll(); }, [stopAutoScroll]);

    // ── 빈 영역 길게 누르기 → 생성 ──
    const onGridTouchStart = useCallback((e) => {
        if (e.target.closest("[data-ev]")) return;
        const t = e.touches[0];
        swipeRef.current = { sx: t.clientX, sy: t.clientY, mode: null, dx: 0 };
        activeRef.current = {
            type: "create-pending",
            ox: t.clientX, oy: t.clientY,
            anchorMin: snap(yToMin(t.clientY)),
            anchorX: t.clientX,
        };
        timerRef.current = setTimeout(() => {
            const a = activeRef.current;
            if (!a || a.type !== "create-pending") return;
            a.type = "create";
            if (navigator.vibrate) navigator.vibrate(15);
            setCreateDrag({
                startMin: a.anchorMin,
                endMin: a.anchorMin + SNAP,
                colIdx: getColIdxRef.current?.(a.anchorX) ?? 0,
            });
        }, LONG_PRESS_MS);
    }, [yToMin]);

    // ── 이벤트 길게 누르기 → 이동 ──
    const onEventTouchStart = useCallback((e, ev) => {
        e.stopPropagation();
        clearTimer();
        const t = e.touches[0];
        swipeRef.current = { sx: t.clientX, sy: t.clientY, mode: null, dx: 0 };
        const sM = moment(ev.start), eM = moment(ev.end);
        const startMin = sM.hours() * 60 + sM.minutes();
        const dur = Math.max(eM.hours() * 60 + eM.minutes() - startMin, 30);
        activeRef.current = {
            type: "move-pending", ev, startMin, dur,
            offset: yToMin(t.clientY) - startMin,
            ox: t.clientX, oy: t.clientY,
        };
        timerRef.current = setTimeout(() => {
            const a = activeRef.current;
            if (!a || a.type !== "move-pending") return;
            a.type = "move";
            if (navigator.vibrate) navigator.vibrate(20);
            setMoveDrag({
                ev: a.ev,
                startMin: snap(a.startMin),
                dur: a.dur,
                colIdx: getColIdxRef.current?.(a.ox) ?? 0,
            });
        }, LONG_PRESS_MS);
    }, [yToMin]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const onMove = (e) => {
            const t = e.touches[0];
            const a = activeRef.current;
            if (!a || a.type.endsWith("-pending")) {
                const sw = swipeRef.current;
                const dx = t.clientX - sw.sx, dy = t.clientY - sw.sy;
                if (sw.mode === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8))
                    sw.mode = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
                if (sw.mode === "h") sw.dx = dx;
            }
            if (!a) return;
            if (a.type.endsWith("-pending")) {
                if (Math.abs(t.clientX - a.ox) > CANCEL_MOVE_PX || Math.abs(t.clientY - a.oy) > CANCEL_MOVE_PX) {
                    clearTimer(); activeRef.current = null;
                }
                return;
            }
            e.preventDefault();
            if (a.type === "create") {
                const touchMin = snap(yToMin(t.clientY));
                const s = Math.min(a.anchorMin, touchMin);
                const en = Math.max(a.anchorMin, touchMin) + SNAP;
                setCreateDrag((p) => ({
                    startMin: s,
                    endMin: Math.min(en, TOTAL_MINUTES),
                    colIdx: p?.colIdx ?? 0,   // 생성은 시작 컬럼 고정
                }));
            } else if (a.type === "move") {
                const ns = snap(Math.max(0, Math.min(TOTAL_MINUTES - a.dur, yToMin(t.clientY) - a.offset)));
                const newCol = getColIdxRef.current?.(t.clientX) ?? 0;
                const newDate = getDateAtRef.current(t.clientX);
                setMoveDrag((p) => p ? { ...p, startMin: ns, colIdx: newCol, targetDate: newDate } : null);
            }
            startAutoScroll(t.clientY);
        };
        el.addEventListener("touchmove", onMove, { passive: false });
        return () => el.removeEventListener("touchmove", onMove);
    }, [yToMin, startAutoScroll, scrollRef]);

    const onTouchEnd = useCallback(() => {
        clearTimer(); stopAutoScroll();
        const a = activeRef.current; activeRef.current = null;

        if (a?.type === "create" && createDrag) {
            const base = moment(getDateAtRef.current(a.anchorX)).startOf("day");
            const endMin = Math.min(createDrag.endMin, TOTAL_MINUTES - 1);
            setCreateDrag(null);
            onCreateSlot?.(
                base.clone().add(createDrag.startMin, "m").toDate(),
                base.clone().add(endMin, "m").toDate(),
            );
            return;
        }
        setCreateDrag(null);

        if (a?.type === "move" && moveDrag) {
            const base = moment(moveDrag.targetDate ?? getDateAtRef.current(a.ox)).startOf("day");
            // end가 24:00(다음 날)로 넘어가지 않도록 23:59로 캡
            const endMin = Math.min(moveDrag.startMin + a.dur, TOTAL_MINUTES - 1);
            setMoveDrag(null);
            onEventDrop?.({
                event: a.ev,
                start: base.clone().add(moveDrag.startMin, "m").toDate(),
                end: base.clone().add(endMin, "m").toDate(),
            });
            return;
        }
        setMoveDrag(null);

        if (!a || a.type.endsWith("-pending")) {
            const s = swipeRef.current;
            if (s.mode === "h") {
                const w = containerRef.current?.clientWidth || 390;
                let dir = 0;
                if (s.dx < -w * SWIPE_RATIO) dir = 1;
                else if (s.dx > w * SWIPE_RATIO) dir = -1;
                if (dir !== 0) {
                    if (navigator.vibrate) navigator.vibrate(8);
                    onSwipe?.(dir);
                }
            }
        }
        swipeRef.current = { sx: 0, sy: 0, mode: null, dx: 0 };
    }, [createDrag, moveDrag, onCreateSlot, onEventDrop, onSwipe, stopAutoScroll, containerRef]);

    return {
        moveDrag, createDrag,
        onGridTouchStart, onEventTouchStart, onTouchEnd,
        isDragActive: !!(moveDrag || createDrag),
    };
}
