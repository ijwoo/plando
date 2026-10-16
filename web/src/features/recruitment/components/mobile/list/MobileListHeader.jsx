import React, { forwardRef } from "react";
import { hideScrollbarSx } from "../../../../../shared/ui/glassSx.js";
import {
    Badge,
    Box,
    IconButton,
    InputAdornment,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import {
    RECRUITMENT_TABS,
    RECRUITMENT_FILTERS,
    NEARBY_KM_OPTIONS,
    APPLICATION_STATUS_FILTERS,
} from "../../../constants/recruitmentConfig";
import { Z } from "../../../../../shared/ui/zIndex.js";
import { filterChipSx } from "../../common/recruitmentSx";

const MAIN_TABS = RECRUITMENT_TABS.map((t) => ({ id: t.id, label: t.mobileLabel }));

/**
 * MobileListHeader — sticky header (서비스 헤더 + 탭 + 검색/필터 collapsible 영역)
 *
 * collapsibleH / collapsed 는 부모(RecruitmentListMobile)에서 측정해서 전달.
 */
const MobileListHeader = forwardRef(function MobileListHeader({
    tab,
    mode,
    filter,
    appStatusFilter,
    search,
    nearbyKm,
    locLoading,
    collapsed,
    collapsibleH,
    collapsibleRef,
    notifUnread,
    onSetTab,
    onSetMode,
    onSetSearch,
    onSetNearbyKm,
    onSetAppStatusFilter,
    onFilterClick,
    onOpenNotif,
}, ref) {
    const theme = useTheme();
    const navigate = useNavigate();

    return (
        <Box
            ref={ref}
            sx={{
                position: "sticky",
                top: 0,
                zIndex: Z.FAB,
                bgcolor: alpha(theme.palette.background.default, 0.92),
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                borderBottom: "1px solid",
                borderColor: alpha(theme.palette.divider, 0.4),
                px: 2,
                pt: 1,
                pb: 0.85,
            }}
        >
            {/* 서비스 헤더 */}
            <Stack direction="row" alignItems="center" sx={{ height: 44, mb: 0.25 }}>
                <IconButton
                    size="small"
                    onClick={() => navigate(-1)}
                    sx={{ ml: -0.75, mr: 0.5, color: "text.primary" }}
                >
                    <ArrowBackIosNewRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <Typography sx={{
                    fontSize: 17,
                    fontWeight: 700,
                    flex: 1,
                    letterSpacing: "-0.025em",
                }}>
                    팀 모집
                </Typography>
                <IconButton
                    size="small"
                    onClick={onOpenNotif}
                    sx={{ mr: -0.75, color: "text.primary" }}
                >
                    <Badge badgeContent={notifUnread || 0} color="error" max={99}>
                        <NotificationsNoneRoundedIcon sx={{ fontSize: 22 }} />
                    </Badge>
                </IconButton>
            </Stack>

            {/* 탭 (underline) */}
            <Stack direction="row" sx={{ mb: 0.75 }}>
                {MAIN_TABS.map(({ id, label }) => (
                    <Box
                        key={id}
                        onClick={() => onSetTab(id)}
                        sx={{
                            flex: 1,
                            py: 0.875,
                            cursor: "pointer",
                            textAlign: "center",
                            fontSize: 13,
                            fontWeight: tab === id ? 700 : 600,
                            color: tab === id ? "primary.main" : "text.disabled",
                            borderBottom: "2.5px solid",
                            borderColor: tab === id ? "primary.main" : "transparent",
                            transition: "all 0.13s",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        {label}
                    </Box>
                ))}
            </Stack>

            {/* 검색 + 필터 collapsible */}
            <Box sx={{
                height: collapsibleH || "auto",
                overflow: "hidden",
                transition: "height 0.28s cubic-bezier(0.4,0,0.2,1)",
                ...(collapsed && collapsibleH > 0 ? { height: 0 } : {}),
                "@media (prefers-reduced-motion: reduce)": { transition: "none" },
            }}>
                <Box
                    ref={collapsibleRef}
                    sx={{
                        transform: collapsed ? "translateY(-8px)" : "translateY(0)",
                        opacity: collapsed ? 0 : 1,
                        transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
                        willChange: "transform, opacity",
                        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                    }}
                >
                    {/* 검색 + 뷰 토글 */}
                    <Stack direction="row" gap={0.75} alignItems="center" sx={{ mb: 0.875 }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="프로젝트, 스택, 역할 검색..."
                            value={search}
                            onChange={(e) => onSetSearch(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchRoundedIcon sx={{ fontSize: 17, color: "text.disabled" }} />
                                    </InputAdornment>
                                ),
                                sx: {
                                    height: 38,
                                    fontSize: 13,
                                    borderRadius: 1.5,
                                    bgcolor: alpha(theme.palette.text.primary, 0.04),
                                    "& .MuiOutlinedInput-notchedOutline": {
                                        borderColor: "transparent",
                                    },
                                    "&.Mui-focused": {
                                        bgcolor: "background.paper",
                                    },
                                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                                        borderColor: "primary.main",
                                        borderWidth: "1px",
                                    },
                                },
                            }}
                        />

                        <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={mode}
                            onChange={(_, val) => { if (val) onSetMode(val); }}
                            style={{ visibility: tab === "browse" ? "visible" : "hidden" }}
                            sx={{
                                p: 0.375,
                                gap: 0.375,
                                borderRadius: 1.5,
                                flexShrink: 0,
                                bgcolor: alpha(theme.palette.text.primary, 0.04),
                                border: 0,
                                "& .MuiToggleButtonGroup-grouped": {
                                    border: 0,
                                    mx: 0,
                                    borderRadius: "10px !important",
                                },
                                "& .MuiToggleButton-root": {
                                    width: 36,
                                    height: 30,
                                    textTransform: "none",
                                    color: "text.secondary",
                                    border: 0,
                                    "&:hover": {
                                        bgcolor: alpha(theme.palette.text.primary, 0.06),
                                        color: "text.primary",
                                    },
                                    "&.Mui-selected": {
                                        bgcolor: "text.primary",
                                        color: theme.palette.mode === "dark"
                                            ? theme.palette.grey[900]
                                            : "common.white",
                                    },
                                    "&.Mui-selected:hover": {
                                        bgcolor: "text.primary",
                                    },
                                },
                            }}
                        >
                            <ToggleButton value="list">
                                <ViewListRoundedIcon sx={{ fontSize: 17 }} />
                            </ToggleButton>
                            <ToggleButton value="map">
                                <MapRoundedIcon sx={{ fontSize: 17 }} />
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Stack>

                    {/* 필터 칩 — 탭별 분기 */}
                    <Box sx={{
                        display: "flex",
                        gap: 0.625,
                        overflowX: "auto",
                        pb: 0.125,
                        ...hideScrollbarSx,
                    }}>
                        {/* 둘러보기 / 북마크: 위치 필터 */}
                        {(tab === "browse" || tab === "bookmarked") && RECRUITMENT_FILTERS.map(({ id, label }) => (
                            <Box
                                key={id}
                                onClick={() => onFilterClick(id)}
                                sx={{
                                    ...filterChipSx(theme, filter === id),
                                    height: 28,
                                    px: 1.5,
                                    fontSize: 12,
                                    borderRadius: 99,
                                    flexShrink: 0,
                                }}
                            >
                                {id === "nearby" && locLoading ? "위치 확인 중..." : label}
                            </Box>
                        ))}

                        {/* 내 근처 거리 선택 */}
                        {(tab === "browse" || tab === "bookmarked") && filter === "nearby" && (
                            <Box sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                flexShrink: 0,
                                height: 28,
                                bgcolor: alpha(theme.palette.text.primary, 0.04),
                                borderRadius: 99,
                                overflow: "hidden",
                            }}>
                                {NEARBY_KM_OPTIONS.map((opt, i) => (
                                    <Box
                                        key={opt.id}
                                        onClick={() => onSetNearbyKm(opt.id)}
                                        sx={{
                                            px: 1.5,
                                            height: "100%",
                                            display: "flex",
                                            alignItems: "center",
                                            cursor: "pointer",
                                            fontSize: 11.5,
                                            fontWeight: nearbyKm === opt.id ? 700 : 500,
                                            color: nearbyKm === opt.id ? "primary.main" : "text.secondary",
                                            bgcolor: nearbyKm === opt.id
                                                ? alpha(theme.palette.primary.main, 0.12)
                                                : "transparent",
                                            borderRight: i < NEARBY_KM_OPTIONS.length - 1 ? "1px solid" : "none",
                                            borderColor: alpha(theme.palette.text.primary, 0.06),
                                            transition: "all 0.12s",
                                        }}
                                    >
                                        {opt.label}
                                    </Box>
                                ))}
                            </Box>
                        )}

                        {/* 내 신청: 상태 필터 */}
                        {tab === "applied" && APPLICATION_STATUS_FILTERS.map(({ id, label }) => (
                            <Box
                                key={id}
                                onClick={() => onSetAppStatusFilter(id)}
                                sx={{
                                    ...filterChipSx(theme, appStatusFilter === id),
                                    height: 28,
                                    px: 1.5,
                                    fontSize: 12,
                                    borderRadius: 99,
                                    flexShrink: 0,
                                }}
                            >
                                {label}
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
});

export default MobileListHeader;
