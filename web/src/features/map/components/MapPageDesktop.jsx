import React from "react";
import { Box } from "@mui/material";
import MapCanvasDesktop from "./MapCanvasDesktop.jsx";

/**
 * 데스크탑 지도 = 풀폭 캔버스.
 * 상태 요약 · 필터 · 위치 할 일 목록은 글로벌 사이드바 맥락 패널(SidebarMapPanel)이 제공하며,
 * 필터/검색/선택 상태는 MapUiContext로 공유되어 여기 마커에 바로 반영된다.
 */
export default function MapPageDesktop({
    tasks,
    selectedTask,
    onSelect,
    onClear,
    searchValue,
    onSearchChange,
    kakaoReady,
    loading,
    onRefresh,
    onAddClick,
}) {
    return (
        <Box sx={{ display: "flex", height: "100%", minHeight: 0 }}>
            <Box sx={{ flex: 1, position: "relative", minWidth: 0, overflow: "hidden" }}>
                <MapCanvasDesktop
                    tasks={tasks}
                    selectedTask={selectedTask}
                    onSelect={onSelect}
                    onClear={onClear}
                    onRefresh={onRefresh}
                    onAddClick={onAddClick}
                    searchValue={searchValue}
                    onSearchChange={onSearchChange}
                    kakaoReady={kakaoReady}
                    loading={loading}
                />
            </Box>
        </Box>
    );
}
