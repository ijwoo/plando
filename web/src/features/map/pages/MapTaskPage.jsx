import React, { useState } from "react";
import { useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useKakaoLoader } from "react-kakao-maps-sdk";
import MapPageDesktop from "../components/MapPageDesktop.jsx";
import MapPageMobile from "../components/MapPageMobile.jsx";
import MapAddTodoModal from "../components/MapAddTodoModal.jsx";
import { useMapUi } from "../context/MapUiContext.jsx";

export default function MapTaskPage() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    // 카카오 맵 SDK 로드 (kakaoLoading: true=로딩중, false=준비완료)
    const [kakaoLoading] = useKakaoLoader({
        appkey: import.meta.env.VITE_KAKAO_MAP_KEY,
        libraries: ["services"],
    });
    const kakaoReady = !kakaoLoading;

    // 지도 UI 상태(필터/검색/선택/목록)는 공유 컨텍스트 — 사이드바 패널과 동일 소스
    const {
        filteredTasks,
        selectedTask, setSelectedTask,
        filter, setFilter,
        search, setSearch,
        recurringOnly, setRecurringOnly,
        loading, refresh,
    } = useMapUi();

    const [addModalOpen, setAddModalOpen] = useState(false);

    if (isMobile) {
        return (
            <>
                <MapPageMobile
                    tasks={filteredTasks}
                    selectedTask={selectedTask}
                    onSelect={setSelectedTask}
                    onClear={() => setSelectedTask(null)}
                    filter={filter}
                    onChangeFilter={setFilter}
                    searchValue={search}
                    onSearchChange={setSearch}
                    kakaoReady={kakaoReady}
                    loading={loading}
                    onAddClick={() => setAddModalOpen(true)}
                    onRefresh={refresh}
                    recurringOnly={recurringOnly}
                    onToggleRecurring={() => setRecurringOnly((v) => !v)}
                />
                <MapAddTodoModal
                    open={addModalOpen}
                    onClose={() => setAddModalOpen(false)}
                    onSaved={refresh}
                />
            </>
        );
    }

    return (
        <>
            <MapPageDesktop
                tasks={filteredTasks}
                selectedTask={selectedTask}
                onSelect={setSelectedTask}
                onClear={() => setSelectedTask(null)}
                searchValue={search}
                onSearchChange={setSearch}
                kakaoReady={kakaoReady}
                loading={loading}
                onRefresh={refresh}
                onAddClick={() => setAddModalOpen(true)}
            />
            <MapAddTodoModal
                open={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onSaved={refresh}
            />
        </>
    );
}
