import React, { useEffect, useState } from "react";
import { ThemeProvider, useTheme } from "@mui/material/styles";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

import RecruitNotifPanel from "../common/RecruitNotifPanel.jsx";
import { getToken } from "../../../../shared/utils/tokenUtils.js";
import {
    RECRUITMENT_TABS,
    RECRUITMENT_FILTERS,
    RECRUITMENT_EMPTY_STATES as EMPTY,
} from "../../constants/recruitmentConfig";
import RecruitMapCanvas from "../common/RecruitMapCanvas";
import { MapOverlayCardDesktop } from "../list/PostCard";
import { useRecruitmentTheme } from "./tokens";
import { SHADOW } from "../common/recruitmentSx";
import { TabBar, CardGrid, CardGridSkeleton, StatsRowSkeleton, EmptyState } from "./DesktopUI";
import RecruitmentDetailDesktop from "./RecruitmentDetailDesktop";
import useRecruitmentFilter from "../../hooks/useRecruitmentFilter";
import { getCurrentPosition } from "../../../../shared/utils/geoUtils";
import MapDesktopSidePanel from "./map/MapDesktopSidePanel";
import ScrollToTopFab from "./list/ScrollToTopFab";
import ListTopBar from "./list/ListTopBar";
import HeroSection from "./list/HeroSection";
import StatsRow from "./list/StatsRow";
import ListControls from "./list/ListControls";

import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import BookmarkBorderOutlinedIcon from "@mui/icons-material/BookmarkBorderOutlined";
import HourglassBottomRoundedIcon from "@mui/icons-material/HourglassBottomRounded";

// 데스크탑은 지도뷰가 위치 컨텍스트를 직접 제공하므로 "내 근처" 필터 불필요 — 제외
const DESKTOP_FILTERS = RECRUITMENT_FILTERS.filter((f) => f.id !== "nearby");
const MAIN_TABS = RECRUITMENT_TABS.map((t) => ({ id: t.id, label: t.label }));

export default function RecruitmentListDesktop({
    items,
    statsItems,
    appliedCount,
    bookmarkedCount,
    loading,
    loadError,
    onRetry,
    onOpenCreate,
    kakaoReady,
    onDetail,
    onTabChange,
    onBookmark,
    detailFull,
    detailLoading,
    detailError,
    onRetryDetail,
    onApply,
    onDelete,
    onStatusChange,
    onReview,
    onEdit,
    onCloseDetail,
    openDetailItem,
    onGuestBlock,
    onQuestionsCountsChange,
}) {
    // 모집 데스크탑 전용 테마 — 앱 테마(라이트 3종 + 다크 4종)를 상속하고 radius만 Toss 톤
    const recruitmentTheme = useRecruitmentTheme();

    const [tab, setTab] = useState("browse");
    const [viewMode, setViewMode] = useState("list");
    const [filter, setFilter] = useState("all");
    const [catF, setCatF] = useState("전체");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [mapBounds, setMapBounds] = useState(null);
    const [sortBy, setSortBy] = useState("latest");
    const [detailItem, setDetailItem] = useState(null);
    const [notifAnchorEl, setNotifAnchorEl] = useState(null);
    const [notifUnread, setNotifUnread] = useState(0);

    // map 모드 진입 시 위치 권한 자동 요청 (있으면 무시) + bbox/선택 리셋
    useEffect(() => {
        if (viewMode !== "map") return;
        setMapBounds(null);
        setSelected(null);
        if (!userLocation) {
            getCurrentPosition({ timeout: 8000 })
                .then((pos) => setUserLocation({ lat: pos.latitude, lng: pos.longitude }))
                .catch(() => { /* 권한 거부 → 서울 default */ });
        }
    }, [viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (openDetailItem) setDetailItem(openDetailItem);
    }, [openDetailItem]);

    const handleTabChange = (id) => {
        setTab(id);
        onTabChange?.(id);
    };

    const openDetailPage = (item) => {
        setDetailItem(item);
        onDetail?.(item);
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    };

    const filtered = useRecruitmentFilter(items, { search, filter, catF, userLocation, sortBy });
    const contentEmpty = filtered.length === 0;

    // map 모드용 — 현재 지도 bbox 안에 있는 모집만
    const visibleItems = (!mapBounds) ? [] : filtered.filter((item) => {
        if (!item.locationLat || !item.locationLng) return false;
        return (
            item.locationLat >= mapBounds.sw.lat &&
            item.locationLat <= mapBounds.ne.lat &&
            item.locationLng >= mapBounds.sw.lng &&
            item.locationLng <= mapBounds.ne.lng
        );
    });

    // stats 카운트 — 탭과 무관하게 항상 같은 값
    const statsSource = statsItems || [];
    const activeCount = statsSource.length;
    const imminentCount = statsSource.filter((it) => {
        const due = it.dueText || "";
        if (due === "D-Day") return true;
        const m = String(due).match(/^(\d+)일 남음$/);
        return m ? parseInt(m[1], 10) <= 7 : false;
    }).length;
    const safeApplied  = appliedCount ?? 0;
    const safeBookmark = bookmarkedCount ?? 0;

    const statItems = [
        { label: "활성 모집",  value: `${activeCount}건`,    helper: "지금 둘러볼 수 있는 공고", Icon: GroupsOutlinedIcon },
        { label: "내 신청",    value: `${safeApplied}건`,    helper: "지원 중인 팀 수",         Icon: DescriptionOutlinedIcon },
        { label: "북마크",     value: `${safeBookmark}건`,   helper: "저장한 관심 공고",        Icon: BookmarkBorderOutlinedIcon },
        { label: "마감 임박",  value: `${imminentCount}건`,  helper: "7일 안에 마감되는 공고",  Icon: HourglassBottomRoundedIcon },
    ];

    return (
        <ThemeProvider theme={recruitmentTheme}>
            <ScrollToTopFab />
            {detailItem ? (
                <>
                {/* 상세 로드 실패 — 예전엔 조용히 무시돼 오래된 목록 데이터가 그대로 보였음 */}
                {detailError && (
                    <Box sx={{ px: 3, pt: 2 }}>
                        <Alert
                            severity="error"
                            action={<Button color="inherit" size="small" onClick={onRetryDetail}>재시도</Button>}
                        >
                            모집 정보를 불러오지 못했어요. 표시된 내용이 최신이 아닐 수 있어요.
                        </Alert>
                    </Box>
                )}
                <RecruitmentDetailDesktop
                    item={detailItem}
                    allItems={items}
                    detailFull={detailFull}
                    detailLoading={detailLoading}
                    onBack={() => {
                        setDetailItem(null);
                        onCloseDetail?.();
                    }}
                    onOpenProject={(project) => {
                        setDetailItem(project);
                        onDetail?.(project);
                    }}
                    onBookmark={(id) => {
                        onBookmark?.(id);
                        setDetailItem((prev) =>
                            prev?.id === id ? { ...prev, bookmarked: !prev.bookmarked } : prev
                        );
                    }}
                    onApply={onApply}
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                    onReview={onReview}
                    onEdit={onEdit}
                    onGuestBlock={onGuestBlock}
                    onQuestionsCountsChange={onQuestionsCountsChange}
                />
                </>
            ) : (
                <ListPageInner
                    items={items}
                    filtered={filtered}
                    visibleItems={visibleItems}
                    statItems={statItems}
                    contentEmpty={contentEmpty}
                    loading={loading}
                    // stats는 탭과 무관하게 browse 응답 기준 — 첫 로드에만 스켈레톤
                    statsLoading={loading && statsSource.length === 0}
                    loadError={loadError}
                    onRetry={onRetry}
                    tab={tab}
                    viewMode={viewMode}
                    filter={filter}
                    catF={catF}
                    search={search}
                    selected={selected}
                    userLocation={userLocation}
                    sortBy={sortBy}
                    notifAnchorEl={notifAnchorEl}
                    notifUnread={notifUnread}
                    onTabChangeLocal={handleTabChange}
                    setViewMode={setViewMode}
                    setFilter={setFilter}
                    setCatF={setCatF}
                    setSearch={setSearch}
                    setSelected={setSelected}
                    setUserLocation={setUserLocation}
                    setMapBounds={setMapBounds}
                    setSortBy={setSortBy}
                    setNotifAnchorEl={setNotifAnchorEl}
                    setNotifUnread={setNotifUnread}
                    onOpenCreate={onOpenCreate}
                    onBookmark={onBookmark}
                    openDetailPage={openDetailPage}
                    kakaoReady={kakaoReady}
                />
            )}
        </ThemeProvider>
    );
}

// 내부 페이지 본문 — useTheme()를 사용하려면 ThemeProvider 하위에서 호출 필요
function ListPageInner({
    items,
    filtered,
    visibleItems,
    statItems,
    contentEmpty,
    loading,
    statsLoading,
    loadError,
    onRetry,
    tab,
    viewMode,
    filter,
    catF,
    search,
    selected,
    userLocation,
    sortBy,
    notifAnchorEl,
    notifUnread,
    onTabChangeLocal,
    setViewMode,
    setFilter,
    setCatF,
    setSearch,
    setSelected,
    setUserLocation,
    setMapBounds,
    setSortBy,
    setNotifAnchorEl,
    setNotifUnread,
    onOpenCreate,
    onBookmark,
    openDetailPage,
    kakaoReady,
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    return (
        <Box sx={{
            minHeight: "100vh",
            bgcolor: "background.default",
            position: "relative",
            zIndex: 0,
            isolation: "isolate",
            overflow: "hidden",
        }}>
            <ListTopBar
                notifUnread={notifUnread}
                onOpenNotif={(e) => { if (getToken()) setNotifAnchorEl(e.currentTarget); }}
                onOpenCreate={onOpenCreate}
            />

            <RecruitNotifPanel
                anchorEl={notifAnchorEl}
                onClose={() => setNotifAnchorEl(null)}
                isDark={isDark}
                onUnreadCount={setNotifUnread}
            />

            <Box sx={{ maxWidth: 1560, mx: "auto", px: 3, py: 4 }}>
                <HeroSection
                    search={search}
                    onSearchChange={setSearch}
                    catF={catF}
                    onCatChange={setCatF}
                    showSearchAndCats={tab === "browse"}
                />

                {statsLoading ? <StatsRowSkeleton /> : <StatsRow items={statItems} />}

                <Box sx={{ mb: 1.75 }}>
                    <TabBar
                        tabs={MAIN_TABS}
                        activeTab={tab}
                        onTabChange={onTabChangeLocal}
                    />
                </Box>

                {/* 로드 실패 — 빈 상태 대신 에러 + 재시도 (구분 불가 문제 해결) */}
                {loadError && (
                    <Box sx={{ pt: 1, pb: 3 }}>
                        <EmptyState
                            icon={EMPTY.loadError.emoji}
                            title={EMPTY.loadError.title}
                            desc={EMPTY.loadError.desc}
                            actionLabel={EMPTY.loadError.actionLabel}
                            onAction={onRetry}
                        />
                    </Box>
                )}

                {!loadError && tab === "browse" && (
                    <>
                        <ListControls
                            filters={DESKTOP_FILTERS}
                            filter={filter}
                            onFilterChange={setFilter}
                            sortBy={sortBy}
                            onSortChange={setSortBy}
                            viewMode={viewMode}
                            onViewModeChange={setViewMode}
                        />

                        {/* result count — 로딩 중엔 0개가 잠깐 보이므로 감춤 */}
                        <Stack
                            direction="row"
                            alignItems="baseline"
                            gap={0.625}
                            sx={{ mb: 2, minHeight: 22, visibility: loading ? "hidden" : "visible" }}
                        >
                            <Typography sx={{
                                fontSize: 15,
                                fontWeight: 700,
                                color: "text.primary",
                                letterSpacing: "-0.02em",
                            }}>
                                {filtered.length}개
                            </Typography>
                            <Typography sx={{
                                fontSize: 13.5,
                                fontWeight: 500,
                                color: "text.secondary",
                            }}>
                                의 팀 모집
                            </Typography>
                        </Stack>

                        <Box sx={{ pb: 3 }}>
                            {viewMode === "list" && (
                                loading ? (
                                    <CardGridSkeleton />
                                ) : contentEmpty ? (
                                    <EmptyState
                                        icon={EMPTY.search.emoji}
                                        title={EMPTY.search.title}
                                        desc={EMPTY.search.desc}
                                    />
                                ) : (
                                    <CardGrid
                                        items={filtered}
                                        onDetail={openDetailPage}
                                        onBookmark={onBookmark}
                                    />
                                )
                            )}

                            {viewMode === "map" && (
                                // 지도는 로딩 중에도 유지 (스켈레톤으로 갈아끼우면 지도가 리마운트됨)
                                contentEmpty && !loading ? (
                                    <EmptyState
                                        icon={EMPTY.search.emoji}
                                        title={EMPTY.search.title}
                                        desc={EMPTY.search.desc}
                                    />
                                ) : (
                                    <Box
                                        sx={{
                                            display: "flex",
                                            gap: 2,
                                            alignItems: "stretch",
                                            height: "calc(100vh - 480px)",
                                            minHeight: 560,
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                flex: 1,
                                                minWidth: 0,
                                                overflow: "hidden",
                                                borderRadius: 2,
                                                bgcolor: "background.paper",
                                                boxShadow: SHADOW.card,
                                                position: "relative",
                                            }}
                                        >
                                            <RecruitMapCanvas
                                                items={filtered}
                                                selected={selected}
                                                onSelect={setSelected}
                                                kakaoReady={kakaoReady}
                                                level={9}
                                                myLocation={userLocation}
                                                onMyLocation={setUserLocation}
                                                onBoundsChange={setMapBounds}
                                            >
                                                {selected ? (
                                                    <MapOverlayCardDesktop
                                                        item={selected}
                                                        onDetail={openDetailPage}
                                                        onClose={() => setSelected(null)}
                                                    />
                                                ) : null}
                                            </RecruitMapCanvas>
                                        </Box>

                                        <MapDesktopSidePanel
                                            items={visibleItems}
                                            selected={selected}
                                            onSelect={setSelected}
                                            onDetail={openDetailPage}
                                            onBookmark={onBookmark}
                                        />
                                    </Box>
                                )
                            )}
                        </Box>
                    </>
                )}

                {!loadError && tab !== "browse" && (
                    <Box sx={{ pt: 1, pb: 3 }}>
                        {/* 탭 전환도 재요청이므로 응답 전까진 빈 상태 대신 스켈레톤 */}
                        {loading ? (
                            <CardGridSkeleton />
                        ) : items.length === 0 ? (
                            <EmptyState
                                icon={EMPTY[tab]?.emoji}
                                title={EMPTY[tab]?.title}
                                desc={EMPTY[tab]?.desc}
                                actionLabel={EMPTY[tab]?.actionLabel}
                                onAction={tab === "mine" ? onOpenCreate : () => onTabChangeLocal("browse")}
                            />
                        ) : (
                            <CardGrid
                                items={items}
                                onDetail={openDetailPage}
                                onBookmark={onBookmark}
                            />
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
}
