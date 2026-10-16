import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Badge,
    Box,
    Chip,
    Stack,
    Typography,
    Button,
    IconButton,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { getMobilePageBg, blurSx, hideScrollbarSx } from "../../../shared/ui/glassSx.js";
import { Z } from "../../../shared/ui/zIndex.js";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RepeatIcon from "@mui/icons-material/Repeat";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import SensorsRoundedIcon from "@mui/icons-material/SensorsRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import { FILTERS } from "../utils/mapUtils.js";
import { softOn, statusColor } from "../../../shared/ui/tone.js";

/** 필터 칩 톤 — tone.js statusColor에서 bg/border 파생 (기존 getStatusTone 대체) */
function filterTone(theme, status) {
    if (!status) return null;
    const base = statusColor(theme, status);
    return { bg: softOn(theme, base, 0.65), border: softOn(theme, base, 1.2), text: theme.palette.text.primary };
}
import MapCanvasMobile from "./MapCanvasMobile.jsx";
import VisitTaskList from "./VisitTaskList.jsx";
import MiniTaskRow from "./MiniTaskRow.jsx";
import SelectedTaskCardMobile from "./SelectedTaskCardMobile.jsx";
import TriggerSettingSheet from "./TriggerSettingSheet.jsx";
import PlaceSearchSheet from "./PlaceSearchSheet.jsx";
import MapAddTodoModal from "./MapAddTodoModal.jsx";
import { fetchTriggers, saveTriggers } from "../api/triggerApi.js";
import { toast } from "../../../shared/utils/toast.js";
import useLocationTrigger from "../hooks/useLocationTrigger.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { APP_EVENTS } from "../../../shared/constants/events.js";

const NAVBAR_H = 0;
const BOTTOM_NAV_H = 70;

// 시트 높이 비율 (모두 containerHeight 기준)
const SHEET_COLLAPSED_RATIO  = 0.08;  // 핸들만 노출
const SHEET_PEEK_RATIO       = 0.33;  // 카드 2개 + 헤더
const SHEET_EXPANDED_RATIO   = 0.82;  // 거의 전체
const SHEET_SELECTED_RATIO   = 0.48;  // 선택 카드 (장소 알림 포함)

function DragHandle() {
    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                py: 1,
            }}
        >
            <Box
                sx={{
                    width: 36,
                    height: 5,
                    borderRadius: 999,
                    bgcolor: "divider",
                }}
            />
        </Box>
    );
}

export default function MapPageMobile({
                                          tasks,
                                          selectedTask,
                                          onSelect,
                                          onClear,
                                          filter,
                                          onChangeFilter,
                                          searchValue,
                                          onSearchChange,
                                          kakaoReady,
                                          loading,
                                          onAddClick,
                                          onRefresh,
                                          recurringOnly,
                                          onToggleRecurring,
                                      }) {
    const { currentWorkspace } = useWorkspace();

    const [viewMode, setViewMode] = useState("map");
    const [sheetMode, setSheetMode] = useState("peek"); // collapsed | peek | expanded
    const [placeSheetOpen, setPlaceSheetOpen] = useState(false);
    const [placeForTodo, setPlaceForTodo] = useState(null);
    const [placeAddModalOpen, setPlaceAddModalOpen] = useState(false);
    const [dragOffset, setDragOffset] = useState(0);
    const [showTriggers, setShowTriggers] = useState(true);
    const [triggerView, setTriggerView] = useState(false);
    const [triggerMap, setTriggerMap] = useState({});

    // 워크스페이스 변경 시마다 트리거 새로 로드
    useEffect(() => {
        if (!currentWorkspace?.workspaceId) return;
        setTriggerMap({});
        fetchTriggers()
            .then((res) => {
                // 서버 키가 숫자(Long)로 오므로 문자열로 변환
                const normalized = {};
                Object.entries(res.data || {}).forEach(([k, v]) => {
                    normalized[String(k)] = v;
                });
                setTriggerMap(normalized);
            })
            .catch(() => {});
    }, [currentWorkspace?.workspaceId]);

    const activeCount = Object.values(triggerMap).filter((v) => v?.enabled).length;

    // 장소 반경 진입 모니터링 → 푸시 알림
    useLocationTrigger(tasks, triggerMap);

    const saveTriggerMap = useCallback(async (newMap) => {
        setTriggerMap(newMap);
        setTriggerView(false);
        try {
            const payload = {};
            Object.entries(newMap).forEach(([k, v]) => {
                payload[Number(k)] = v;
            });
            await saveTriggers(payload);
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "알림 설정이 저장되었습니다.", severity: "success" } }));
        } catch (e) {
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "알림 설정 저장에 실패했습니다.", severity: "error" } }));
        }
    }, []);

    // 태스크 삭제 시 해당 트리거를 triggerMap에서 제거하고 서버에 반영
    const removeTrigger = useCallback(async (taskId) => {
        const id = String(taskId);
        setTriggerMap((prev) => {
            const { [id]: _, ...rest } = prev;
            const payload = {};
            Object.entries(rest).forEach(([k, v]) => { payload[Number(k)] = v; });
            saveTriggers(payload).catch(() => {
                toast.error("알림 설정 저장에 실패했어요.");
            });
            return rest;
        });
    }, []);

    const startYRef = useRef(0);
    const startTranslateRef = useRef(0);
    const draggingRef = useRef(false);
    const sheetRef = useRef(null);

    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const hasFilter = filter !== "all";
    const filterLabel = FILTERS.find((f) => f.key === filter)?.label ?? "전체";

    const viewportHeight =
        typeof window !== "undefined" ? window.innerHeight : 800;
    const containerHeight = viewportHeight - NAVBAR_H - BOTTOM_NAV_H;

    const collapsedHeight = Math.round(containerHeight * SHEET_COLLAPSED_RATIO);
    const peekHeight      = Math.round(containerHeight * SHEET_PEEK_RATIO);
    const expandedHeight  = Math.round(containerHeight * SHEET_EXPANDED_RATIO);
    const selectedHeight  = Math.round(containerHeight * SHEET_SELECTED_RATIO);

    const currentSheetHeight = useMemo(() => {
        if (selectedTask) return selectedHeight;
        if (sheetMode === "collapsed") return collapsedHeight;
        if (sheetMode === "expanded") return expandedHeight;
        return peekHeight;
    }, [selectedTask, sheetMode, collapsedHeight, peekHeight, expandedHeight, selectedHeight]);

    // translateY 방식으로 구현
    const maxSheetHeight = selectedTask ? selectedHeight : expandedHeight;
    const translateY = Math.max(0, maxSheetHeight - currentSheetHeight + dragOffset);

    useEffect(() => {
        if (selectedTask) {
            setSheetMode("peek");
            setDragOffset(0);
        }
    }, [selectedTask]);

    const setModeSafely = useCallback(
        (mode) => {
            if (selectedTask) return;
            setSheetMode(mode);
            setDragOffset(0);
        },
        [selectedTask]
    );

    const handlePointerStart = useCallback(
        (clientY) => {
            if (selectedTask) return;
            draggingRef.current = true;
            startYRef.current = clientY;
            startTranslateRef.current = maxSheetHeight - currentSheetHeight;
        },
        [selectedTask, maxSheetHeight, currentSheetHeight]
    );

    const handlePointerMove = useCallback(
        (clientY) => {
            if (!draggingRef.current || selectedTask) return;

            const delta = clientY - startYRef.current;
            const next = startTranslateRef.current + delta;
            const minTranslate = 0;
            const maxTranslate = maxSheetHeight - collapsedHeight;

            const clamped = Math.min(maxTranslate, Math.max(minTranslate, next));
            setDragOffset(clamped - (maxSheetHeight - currentSheetHeight));
        },
        [selectedTask, maxSheetHeight, currentSheetHeight]
    );

    const handlePointerEnd = useCallback(() => {
        if (!draggingRef.current || selectedTask) return;
        draggingRef.current = false;

        const finalTranslate = Math.max(
            0,
            maxSheetHeight - currentSheetHeight + dragOffset
        );

        const collapsedTranslate = maxSheetHeight - collapsedHeight;
        const peekTranslate = maxSheetHeight - peekHeight;
        const expandedTranslate = 0;

        const candidates = [
            { mode: "collapsed", value: collapsedTranslate },
            { mode: "peek", value: peekTranslate },
            { mode: "expanded", value: expandedTranslate },
        ];

        let nearest = candidates[0];
        let minDiff = Math.abs(finalTranslate - candidates[0].value);

        for (let i = 1; i < candidates.length; i += 1) {
            const diff = Math.abs(finalTranslate - candidates[i].value);
            if (diff < minDiff) {
                minDiff = diff;
                nearest = candidates[i];
            }
        }

        setSheetMode(nearest.mode);
        setDragOffset(0);
    }, [selectedTask, maxSheetHeight, currentSheetHeight, dragOffset]);

    const onTouchStart = useCallback(
        (e) => handlePointerStart(e.touches[0].clientY),
        [handlePointerStart]
    );

    const onTouchMove = useCallback(
        (e) => handlePointerMove(e.touches[0].clientY),
        [handlePointerMove]
    );

    const onTouchEnd = useCallback(() => {
        handlePointerEnd();
    }, [handlePointerEnd]);

    const toggleListView = useCallback(() => {
        setViewMode((prev) => (prev === "map" ? "list" : "map"));
    }, []);

    if (triggerView) {
        return (
            <Box sx={{ height: `calc(100dvh - ${NAVBAR_H}px - ${BOTTOM_NAV_H}px - env(safe-area-inset-bottom, 0px))`, overflow: "hidden" }}>
                <TriggerSettingSheet
                    tasks={tasks}
                    triggerMap={triggerMap}
                    onSave={saveTriggerMap}
                    onBack={() => setTriggerView(false)}
                />
            </Box>
        );
    }

    if (viewMode === "list") {
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    minHeight: "100%",
                    background: getMobilePageBg(theme),
                }}
            >
                <Box
                    sx={{
                        px: 2,
                        // 맵 페이지는 Layout이 safe-area pt를 안 주고 Navbar도 없음 → 헤더 자체가 노치 영역까지 blur로 덮음
                        pt: "calc(env(safe-area-inset-top, 0px) + 12px)",
                        pb: 1,
                        backgroundColor: alpha(theme.palette.background.paper, 0.88),
                        ...blurSx("blur(20px)"),
                        borderBottom: "1px solid",
                        borderColor: theme.palette.divider,
                        position: "sticky",
                        top: 0,
                        zIndex: Z.FAB,
                    }}
                >
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ mb: 1 }}
                    >
                        <Stack direction="row" alignItems="center" spacing={0.75}>
                            <Typography variant="subtitle2" fontWeight={800}>
                                {filterLabel} 일정
                            </Typography>
                            <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                {tasks.length}건
                            </Typography>
                        </Stack>
                        <Box
                            onClick={toggleListView}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                                px: 1.5,
                                py: 0.75,
                                borderRadius: 999,
                                bgcolor: "primary.main",
                                color: "#fff",
                                cursor: "pointer",
                                fontSize: 13,
                                fontWeight: 700,
                            }}
                        >
                            <MapRoundedIcon sx={{ fontSize: 16 }} />
                            지도로 보기
                        </Box>
                    </Stack>

                    <Stack
                        direction="row"
                        spacing={0.75}
                        sx={{
                            overflowX: "auto",
                            pb: 0.25,
                            ...hideScrollbarSx,
                        }}
                    >
                        {FILTERS.map((item) => {
                            const tone = filterTone(theme, item.status);
                            const selected = filter === item.key;
                            return (
                                <Chip
                                    key={item.key}
                                    label={item.label}
                                    clickable
                                    size="small"
                                    variant="outlined"
                                    onClick={() => onChangeFilter(item.key)}
                                    sx={{
                                        flexShrink: 0,
                                        ...(tone ? {
                                            bgcolor: tone.bg,
                                            borderColor: tone.border,
                                            color: tone.text,
                                        } : {}),
                                        fontWeight: hasFilter ? (selected ? 900 : 600) : 700,
                                        filter: hasFilter && !selected ? "saturate(0.4)" : "none",
                                        "&:hover": { filter: "none" },
                                    }}
                                />
                            );
                        })}
                        <Box sx={{ width: "1px", height: 22, bgcolor: "divider", alignSelf: "center", flexShrink: 0 }} />
                        <Chip
                            icon={<RepeatIcon sx={{ fontSize: "13px !important" }} />}
                            label="반복만"
                            size="small"
                            clickable
                            variant={recurringOnly ? "filled" : "outlined"}
                            color={recurringOnly ? "primary" : "default"}
                            onClick={onToggleRecurring}
                            sx={{ fontWeight: 700, fontSize: 12, flexShrink: 0, borderColor: "divider" }}
                        />
                    </Stack>
                </Box>

                <Box sx={{ p: 2, pb: 2 }}>
                    <VisitTaskList
                        tasks={tasks}
                        selectedId={selectedTask?.id}
                        onSelect={(task) => {
                            onSelect(task);
                            setViewMode("map");
                        }}
                        showTitle={false}
                    />
                </Box>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                position: "relative",
                height: `calc(100dvh - ${NAVBAR_H}px - ${BOTTOM_NAV_H}px - env(safe-area-inset-bottom, 0px))`,
                overflow: "hidden",
            }}
        >
            <MapCanvasMobile
                tasks={tasks}
                selectedTask={selectedTask}
                onSelect={onSelect}
                onAddClick={onAddClick}
                onPlaceSearchClick={() => setPlaceSheetOpen(true)}
                searchValue={searchValue}
                onSearchChange={onSearchChange}
                sheetHeight={selectedTask ? peekHeight * 1.4 : currentSheetHeight}
                kakaoReady={kakaoReady}
                loading={loading}
                triggerMap={triggerMap}
                showTriggers={showTriggers}
                hideRightActions={sheetMode === "expanded" && !selectedTask}
            />

            {/* 왼쪽 플로팅 버튼 — 트리거 토글 + 알림 설정 */}
            <Box
                sx={{
                    position: "absolute",
                    left: 12,
                    top: "calc(66px + env(safe-area-inset-top, 0px))",
                    zIndex: Z.FAB,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                }}
            >
                <IconButton
                    onClick={() => setShowTriggers((p) => !p)}
                    sx={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        bgcolor: showTriggers
                            ? "primary.main"
                            : alpha(theme.palette.background.paper, 0.92),
                        color: showTriggers ? "#fff" : "text.secondary",
                        border: "1px solid",
                        borderColor: showTriggers ? "transparent" : "divider",
                        ...blurSx("blur(20px)"),
                        boxShadow: showTriggers
                            ? `0 4px 16px ${alpha(theme.palette.primary.main, 0.35)}`
                            : "0 2px 8px rgba(0,0,0,0.12)",
                    }}
                >
                    <SensorsRoundedIcon sx={{ fontSize: 20 }} />
                </IconButton>

                <Badge
                    badgeContent={activeCount}
                    color="error"
                    overlap="circular"
                    sx={{ "& .MuiBadge-badge": { fontSize: 9, minWidth: 16, height: 16 } }}
                >
                    <IconButton
                        onClick={() => setTriggerView(true)}
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            bgcolor: alpha(theme.palette.background.paper, 0.92),
                            color: "text.secondary",
                            border: "1px solid",
                            borderColor: "divider",
                            ...blurSx("blur(20px)"),
                            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                        }}
                    >
                        <NotificationsRoundedIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                </Badge>
            </Box>

            <Box
                ref={sheetRef}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                sx={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: selectedTask ? "auto" : maxSheetHeight,
                    transform: selectedTask ? "translateY(0)" : `translateY(${translateY}px)`,
                    bgcolor: alpha(theme.palette.background.paper, 0.97),
                    ...blurSx("blur(8px)"),
                    borderTopLeftRadius: "var(--plando-radius-modal)",
                    borderTopRightRadius: "var(--plando-radius-modal)",
                    borderTop: "1px solid",
                    borderColor: theme.palette.divider,
                    boxShadow: isDark
                        ? "0 -6px 24px rgba(0,0,0,0.4)"
                        : "0 -6px 24px rgba(100,100,150,0.12)",
                    transition: draggingRef.current
                        ? "none"
                        : "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    zIndex: Z.FAB,
                    touchAction: "none",
                }}
            >
                <Box
                    onClick={() => {
                        if (selectedTask) return;
                        if (sheetMode === "collapsed") setModeSafely("peek");
                        else if (sheetMode === "peek") setModeSafely("expanded");
                        else setModeSafely("peek");
                    }}
                    sx={{ cursor: selectedTask ? "default" : "pointer" }}
                >
                    <DragHandle />
                </Box>

                {!selectedTask && (
                    <Stack sx={{ px: 2, pb: 1, gap: 1 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                                <Typography fontWeight={800} fontSize={15}>
                                    {filterLabel === "전체" ? "주변 일정" : filterLabel}
                                </Typography>
                                <Box
                                    sx={{
                                        px: 1,
                                        py: 0.2,
                                        borderRadius: 999,
                                        bgcolor: "action.selected",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "text.secondary",
                                    }}
                                >
                                    {tasks.length}
                                </Box>
                            </Stack>
                            <Box
                                onClick={() => setViewMode("list")}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    px: 1.25,
                                    py: 0.5,
                                    borderRadius: 999,
                                    border: "1px solid",
                                    borderColor: "divider",
                                    cursor: "pointer",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: "text.secondary",
                                    "&:active": { bgcolor: "action.hover" },
                                }}
                            >
                                <FormatListBulletedRoundedIcon sx={{ fontSize: 14 }} />
                                전체 목록
                            </Box>
                        </Stack>

                        <Stack
                            direction="row"
                            spacing={0.75}
                            sx={{ overflowX: "auto", ...hideScrollbarSx }}
                        >
                            {FILTERS.map((item) => {
                                const tone = filterTone(theme, item.status);
                                const selected = filter === item.key;
                                return (
                                    <Chip
                                        key={item.key}
                                        label={item.label}
                                        clickable
                                        size="small"
                                        variant={selected ? "filled" : "outlined"}
                                        onClick={() => onChangeFilter(item.key)}
                                        sx={{
                                            flexShrink: 0,
                                            ...(tone ? {
                                                bgcolor: selected ? tone.border : tone.bg,
                                                borderColor: tone.border,
                                                color: selected ? "#fff" : tone.text,
                                            } : {
                                                bgcolor: selected ? "primary.main" : "transparent",
                                                borderColor: selected ? "primary.main" : "divider",
                                                color: selected ? "#fff" : "text.secondary",
                                            }),
                                            fontWeight: selected ? 800 : 600,
                                            fontSize: 12,
                                        }}
                                    />
                                );
                            })}
                            <Box sx={{ width: "1px", height: 22, bgcolor: "divider", alignSelf: "center", flexShrink: 0 }} />
                            <Chip
                                icon={<RepeatIcon sx={{ fontSize: "13px !important" }} />}
                                label="반복만"
                                size="small"
                                clickable
                                variant={recurringOnly ? "filled" : "outlined"}
                                color={recurringOnly ? "primary" : "default"}
                                onClick={onToggleRecurring}
                                sx={{ fontWeight: 700, fontSize: 12, flexShrink: 0, borderColor: "divider" }}
                            />
                        </Stack>
                    </Stack>
                )}

                <Box
                    sx={{
                        flex: selectedTask ? "0 0 auto" : 1,
                        overflowY: selectedTask || sheetMode === "expanded" ? "auto" : "hidden",
                        px: 2,
                        pb: "max(16px, env(safe-area-inset-bottom))",
                    }}
                >
                    {selectedTask ? (
                        <SelectedTaskCardMobile
                            task={selectedTask}
                            onClose={onClear}
                            onRefresh={onRefresh}
                            triggerInfo={triggerMap[selectedTask.id]}
                            onTriggerSettings={() => setTriggerView(true)}
                            onDeleteTrigger={removeTrigger}
                        />
                    ) : tasks.length === 0 ? (
                        <Stack alignItems="center" spacing={1.5} sx={{ py: 2 }}>
                            <Typography variant="body2" color="text.secondary" fontWeight={700}>
                                장소가 등록된 일정이 없어요
                            </Typography>
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={<AddRoundedIcon />}
                                onClick={onAddClick}
                                sx={{
                                    borderRadius: "var(--plando-radius-card)",
                                    fontWeight: 800,
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                일정 추가
                            </Button>
                        </Stack>
                    ) : (
                        <Stack spacing={1}>
                            {(sheetMode === "expanded" ? tasks : tasks.slice(0, 2)).map((task) => (
                                <MiniTaskRow
                                    key={task.id}
                                    task={task}
                                    onClick={() => onSelect(task)}
                                />
                            ))}

                        </Stack>
                    )}
                </Box>
            </Box>

            <PlaceSearchSheet
                open={placeSheetOpen}
                onClose={() => setPlaceSheetOpen(false)}
                onPlaceSelected={(place) => {
                    setPlaceForTodo({
                        locationLat:     place.lat,
                        locationLng:     place.lng,
                        locationName:    place.name,
                        locationAddress: place.address,
                    });
                    setPlaceAddModalOpen(true);
                }}
            />
            <MapAddTodoModal
                open={placeAddModalOpen}
                onClose={() => setPlaceAddModalOpen(false)}
                onSaved={onRefresh}
                initialLocation={placeForTodo}
            />
        </Box>
    );
}