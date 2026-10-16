import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Skeleton, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import RecruitMapCanvas from "../common/RecruitMapCanvas";
import { getCurrentPosition } from "../../../../shared/utils/geoUtils";
import RecruitmentCard, { CARD_H } from "../list/RecruitmentCard";
import { RECRUITMENT_EMPTY_STATES as EMPTY } from "../../constants/recruitmentConfig";
import RecruitNotifPanel from "../common/RecruitNotifPanel.jsx";
import { getToken } from "../../../../shared/utils/tokenUtils.js";
import MapBottomSheet, { SNAP_H } from "./MapBottomSheet";
import useRecruitmentFilter from "../../hooks/useRecruitmentFilter";
import MobileListHeader from "./list/MobileListHeader";
import FeaturedCarousel from "./list/FeaturedCarousel";
import CreateFab from "./list/CreateFab";

// ── 빈 상태 ──────────────────────────────────────────────────────────────────
function EmptyState({ emoji, title, desc, action }) {
    return (
        <Box sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            py: 8,
            px: 3,
            textAlign: "center",
        }}>
            <Typography sx={{ fontSize: 36, mb: 0.5 }}>{emoji}</Typography>
            <Typography sx={{
                fontSize: 15,
                fontWeight: 700,
                color: "text.primary",
                letterSpacing: "-0.02em",
            }}>
                {title}
            </Typography>
            <Typography sx={{
                fontSize: 13,
                color: "text.secondary",
                fontWeight: 500,
                lineHeight: 1.55,
            }}>
                {desc}
            </Typography>
            {action}
        </Box>
    );
}

// ── 로딩 스켈레톤 ────────────────────────────────────────────────────────────
// 첫 요청이 끝나기 전 / 탭 전환 재요청 중에 "검색 결과가 없어요"가 뜨지 않도록.
// 카드 규격(CARD_H, radius)을 그대로 따라가 로드 완료 시 레이아웃이 튀지 않음.
function ListSkeleton({ count = 4 }) {
    return (
        <Box sx={{ px: 2, pt: 1.25 }}>
            <Stack spacing={1}>
                {Array.from({ length: count }, (_, i) => (
                    <Skeleton
                        key={i}
                        variant="rounded"
                        height={CARD_H}
                        sx={{ borderRadius: 1.75, transform: "none" }}
                    />
                ))}
            </Stack>
        </Box>
    );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export default function RecruitmentListMobile({
    items,
    loading,
    loadError,
    onRetry,
    onOpenCreate,
    kakaoReady,
    onDetail,
    onTabChange,
    onBookmark,
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const [tab, setTab] = useState("browse");
    const [notifAnchorEl, setNotifAnchorEl] = useState(null);
    const [notifUnread, setNotifUnread] = useState(0);
    const [mode, setMode] = useState("list");
    const [filter, setFilter] = useState("all");
    const [appStatusFilter, setAppStatusFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(null);
    const [nearbyKm, setNearbyKm] = useState(3);
    const [userLocation, setUserLocation] = useState(null);
    const [locLoading, setLocLoading] = useState(false);
    const [sheetSnap, setSheetSnap] = useState("peek");
    const mapContainerRef = useRef(null);
    const [mapContainerH, setMapContainerH] = useState(0);
    const [mapBounds, setMapBounds] = useState(null);

    const headerRef = useRef(null);
    const [headerH, setHeaderH] = useState(148);
    const scrollRef = useRef(null);
    const lastScrollY = useRef(0);
    const [collapsed, setCollapsed] = useState(false);
    const collapsibleRef = useRef(null);
    const [collapsibleH, setCollapsibleH] = useState(0);

    const handleTabChange = (id) => {
        setTab(id);
        if (id !== "browse") setMode("list");
        setFilter("all");
        setAppStatusFilter("all");
        onTabChange?.(id);
    };

    const filtered = useRecruitmentFilter(items, { search, filter, nearbyKm, userLocation, tab, appStatusFilter });

    // 추천 캐러셀은 결과가 3개 이상일 때만 — 2개 이하면 "추천"이 아니라 전체 목록을
    // 위로 복사한 꼴이라, 아래 피드가 비어 안내 문구를 대신 띄워야 했음.
    const featuredItems = filtered.length >= 3 ? filtered.slice(0, 2) : [];
    const feedItems = filtered.slice(featuredItems.length);

    // 현재 지도 뷰포트 안에 있는 아이템 (바텀시트용)
    const visibleItems = useMemo(() => {
        if (!mapBounds) return [];
        return filtered.filter((item) => {
            if (!item.locationLat || !item.locationLng) return false;
            return (
                item.locationLat >= mapBounds.sw.lat &&
                item.locationLat <= mapBounds.ne.lat &&
                item.locationLng >= mapBounds.sw.lng &&
                item.locationLng <= mapBounds.ne.lng
            );
        });
    }, [filtered, mapBounds]);

    // 헤더 높이 측정 (FAB 위치 계산용)
    useEffect(() => {
        const el = headerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setHeaderH(e.contentRect.height));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // collapsible 영역 높이 측정
    useEffect(() => {
        const el = collapsibleRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setCollapsibleH(el.scrollHeight));
        ro.observe(el);
        setCollapsibleH(el.scrollHeight);
        return () => ro.disconnect();
    }, []);

    // 스크롤 시 헤더 접힘 감지
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const handleScroll = () => {
            if (el.scrollHeight <= el.clientHeight + 60) {
                setCollapsed(false);
                return;
            }
            const y = el.scrollTop;
            const delta = y - lastScrollY.current;
            if (Math.abs(delta) < 8) return;
            setCollapsed(delta > 0 && y > 20);
            lastScrollY.current = y;
        };
        el.addEventListener("scroll", handleScroll, { passive: true });
        return () => el.removeEventListener("scroll", handleScroll);
    }, []);

    // 지도 모드 진입 시 시트/bbox 리셋 + 내 위치 자동 요청
    useEffect(() => {
        if (mode === "map") {
            setSheetSnap("peek");
            setMapBounds(null);
            if (!userLocation) {
                getCurrentPosition({ timeout: 8000 })
                    .then((pos) => setUserLocation({ lat: pos.latitude, lng: pos.longitude }))
                    .catch(() => {});
            }
        }
    }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

    // 마커 선택 시 peek → half 자동 확장
    useEffect(() => {
        if (selected && sheetSnap === "peek") setSheetSnap("half");
    }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

    // 지도 컨테이너 높이 측정 (FAB 위치 계산용)
    useEffect(() => {
        if (mode !== "map") return;
        const el = mapContainerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setMapContainerH(e.contentRect.height));
        ro.observe(el);
        setMapContainerH(el.clientHeight);
        return () => ro.disconnect();
    }, [mode]);

    const handleFilterClick = useCallback(async (id) => {
        setFilter(id);
        if (id === "nearby" && !userLocation && !locLoading) {
            setLocLoading(true);
            try {
                const pos = await getCurrentPosition({ timeout: 10000 });
                setUserLocation({ lat: pos.latitude, lng: pos.longitude });
            } catch { /* 위치 권한 없어도 필터 유지 */ }
            finally { setLocLoading(false); }
        }
    }, [userLocation, locLoading]);

    // 캐러셀 리셋 트리거 (검색/필터/탭 변경 시)
    const carouselResetKey = `${search}-${filter}-${nearbyKm}-${tab}`;

    return (
        <Box
            ref={scrollRef}
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                overflowY: mode === "map" ? "hidden" : "auto",
                bgcolor: "background.default",
                pb: mode === "map" ? 0 : 12,
            }}
        >
            <MobileListHeader
                ref={headerRef}
                tab={tab}
                mode={mode}
                filter={filter}
                appStatusFilter={appStatusFilter}
                search={search}
                nearbyKm={nearbyKm}
                locLoading={locLoading}
                collapsed={collapsed}
                collapsibleH={collapsibleH}
                collapsibleRef={collapsibleRef}
                notifUnread={notifUnread}
                onSetTab={handleTabChange}
                onSetMode={setMode}
                onSetSearch={setSearch}
                onSetNearbyKm={setNearbyKm}
                onSetAppStatusFilter={setAppStatusFilter}
                onFilterClick={handleFilterClick}
                onOpenNotif={(e) => { if (getToken()) setNotifAnchorEl(e.currentTarget); }}
            />

            {/* 로드 실패 — 빈 상태 대신 에러 + 재시도 (구분 불가 문제 해결) */}
            {loadError && (
                <Box sx={{ px: 2, pt: 1.25 }}>
                    <EmptyState
                        emoji={EMPTY.loadError.emoji}
                        title={EMPTY.loadError.title}
                        desc={EMPTY.loadError.desc}
                        action={
                            <Button
                                variant="contained"
                                disableElevation
                                onClick={onRetry}
                                sx={{ mt: 1, borderRadius: 1.5, fontWeight: 700 }}
                            >
                                {EMPTY.loadError.actionLabel}
                            </Button>
                        }
                    />
                </Box>
            )}

            {/* 둘러보기 탭 */}
            {!loadError && tab === "browse" && (
                <Box sx={{
                    pt: 0,
                    ...(mode === "map" ? {
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                    } : {}),
                }}>
                    {mode === "list" && (loading ? <ListSkeleton /> : (
                        <>
                            <FeaturedCarousel
                                items={featuredItems}
                                onDetail={onDetail}
                                onBookmark={onBookmark}
                                resetTrigger={carouselResetKey}
                            />

                            {filtered.length > 0 && (
                                <Box sx={{ px: 2, pt: featuredItems.length > 0 ? 1.5 : 1.25 }}>
                                    <Typography sx={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "text.disabled",
                                        mb: 1,
                                        letterSpacing: "0.01em",
                                    }}>
                                        전체 {filtered.length}개
                                        {filter === "nearby" ? ` · ${nearbyKm}km 이내` : ""}
                                    </Typography>

                                    <Stack spacing={1}>
                                        {feedItems.map((item) => (
                                            <RecruitmentCard
                                                key={item.id}
                                                item={item}
                                                onDetail={onDetail}
                                                onBookmark={onBookmark}
                                            />
                                        ))}
                                    </Stack>
                                </Box>
                            )}

                            {filtered.length === 0 && (
                                <EmptyState
                                    emoji={EMPTY.search.emoji}
                                    title={EMPTY.search.title}
                                    desc={EMPTY.search.desc}
                                />
                            )}
                        </>
                    ))}

                    {mode === "map" && (
                        <Box
                            ref={mapContainerRef}
                            sx={{
                                position: "relative",
                                flex: 1,
                                minHeight: 0,
                                height: `calc(100dvh - ${headerH}px)`,
                            }}
                        >
                            <RecruitMapCanvas
                                items={filtered}
                                selected={selected}
                                onSelect={setSelected}
                                kakaoReady={kakaoReady}
                                level={9}
                                myLocation={userLocation}
                                nearbyRadius={filter === "nearby" && userLocation ? nearbyKm : null}
                                onMyLocation={setUserLocation}
                                onBoundsChange={setMapBounds}
                                yPanOffset={mapContainerH > 0
                                    ? Math.round(mapContainerH * (SNAP_H[sheetSnap] ?? 50) / 100 / 2)
                                    : 0}
                            />
                            <MapBottomSheet
                                items={visibleItems}
                                selected={selected}
                                onSelect={setSelected}
                                onDetail={onDetail}
                                onBookmark={onBookmark}
                                snap={sheetSnap}
                                onSnap={setSheetSnap}
                                isDark={isDark}
                            />
                        </Box>
                    )}
                </Box>
            )}

            {/* 내 신청 */}
            {!loadError && tab === "applied" && (loading ? <ListSkeleton /> : (
                <Box sx={{ px: 2, pt: 1.25 }}>
                    {items.length === 0 ? (
                        <EmptyState
                            emoji={EMPTY.applied.emoji}
                            title={EMPTY.applied.title}
                            desc={EMPTY.applied.desc}
                            action={
                                <Button
                                    variant="contained"
                                    disableElevation
                                    onClick={() => handleTabChange("browse")}
                                    sx={{ mt: 1, borderRadius: 1.5, fontWeight: 700 }}
                                >
                                    {EMPTY.applied.actionLabel}
                                </Button>
                            }
                        />
                    ) : filtered.length === 0 ? (
                        <EmptyState
                            emoji={EMPTY.appStatus.emoji}
                            title={EMPTY.appStatus.title}
                            desc={EMPTY.appStatus.desc}
                        />
                    ) : (
                        <Stack spacing={1}>
                            {filtered.map((item) => (
                                <RecruitmentCard key={item.id} item={item} onDetail={onDetail} onBookmark={onBookmark} />
                            ))}
                        </Stack>
                    )}
                </Box>
            ))}

            {/* 내가 만든 */}
            {!loadError && tab === "mine" && (loading ? <ListSkeleton /> : (
                <Box sx={{ px: 2, pt: 1.25 }}>
                    {items.length === 0 ? (
                        <EmptyState
                            emoji={EMPTY.mine.emoji}
                            title={EMPTY.mine.title}
                            desc={EMPTY.mine.desc}
                            action={
                                <Button
                                    variant="contained"
                                    disableElevation
                                    onClick={onOpenCreate}
                                    sx={{ mt: 1, borderRadius: 1.5, fontWeight: 700 }}
                                >
                                    {EMPTY.mine.actionLabel}
                                </Button>
                            }
                        />
                    ) : (
                        <Stack spacing={1}>
                            {items.map((item) => (
                                <RecruitmentCard key={item.id} item={item} onDetail={onDetail} onBookmark={onBookmark} />
                            ))}
                        </Stack>
                    )}
                </Box>
            ))}

            {/* 북마크 */}
            {!loadError && tab === "bookmarked" && (loading ? <ListSkeleton /> : (
                <Box sx={{ px: 2, pt: 1.25 }}>
                    {items.length === 0 ? (
                        <EmptyState
                            emoji={EMPTY.bookmarked.emoji}
                            title={EMPTY.bookmarked.title}
                            desc={EMPTY.bookmarked.desc}
                            action={
                                <Button
                                    variant="contained"
                                    disableElevation
                                    onClick={() => handleTabChange("browse")}
                                    sx={{ mt: 1, borderRadius: 1.5, fontWeight: 700 }}
                                >
                                    {EMPTY.bookmarked.actionLabel}
                                </Button>
                            }
                        />
                    ) : filtered.length === 0 ? (
                        <EmptyState
                            emoji={EMPTY.search.emoji}
                            title={EMPTY.search.title}
                            desc={EMPTY.search.desc}
                        />
                    ) : (
                        <Stack spacing={1}>
                            {filtered.map((item) => (
                                <RecruitmentCard key={item.id} item={item} onDetail={onDetail} onBookmark={onBookmark} />
                            ))}
                        </Stack>
                    )}
                </Box>
            ))}

            <CreateFab
                onClick={onOpenCreate}
                collapsed={collapsed}
                mode={mode}
                sheetSnap={sheetSnap}
                mapContainerH={mapContainerH}
            />

            <RecruitNotifPanel
                anchorEl={notifAnchorEl}
                onClose={() => setNotifAnchorEl(null)}
                isDark={isDark}
                onUnreadCount={setNotifUnread}
            />
        </Box>
    );
}
