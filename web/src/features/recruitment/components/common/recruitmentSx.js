/**
 * recruitmentSx.js — 모집(Recruitment) 페이지 공용 sx mixin
 *
 * doc/recruitment/styles-toss.css (Toss tone) 기반.
 * 모든 mixin은 theme 인자(또는 useTheme()) + alpha를 사용 → 토큰 일관성 + 다크 대응 여지.
 *
 * 작성 원칙:
 * - 색은 theme.palette + alpha — 하드코딩 금지 (Toss 고유 카테고리 색은 CAT_CFG에서 가져옴)
 * - shadow는 SHADOW 상수 (tokens.js export) 사용 — --plando-* 변수라 테마별 자동 전환
 * - 모바일/데스크탑 모두 앱 테마(라이트 3종 + 다크 4종)를 그대로 따름
 *
 * 사용 예:
 *   import { cardSx, chipSx, categoryBadgeSx, SHADOW } from "../common/recruitmentSx";
 *   const theme = useTheme();
 *   <Box sx={cardSx(theme, { lift: true })} />
 */
import { alpha } from "@mui/material/styles";
import { SHADOW } from "../desktop/tokens";

export { SHADOW };

// ─────────────────────────────────────────────────────────────
// Surfaces / Borders
// ─────────────────────────────────────────────────────────────

/**
 * Toss 카드 — border 없이 soft shadow + hover lift
 * @param {object} theme
 * @param {object} [opts]
 * @param {boolean} [opts.lift=true] — hover 시 translateY(-2px) + shadow-lift
 * @param {boolean} [opts.clickable=true] — cursor: pointer
 */
export const cardSx = (theme, { lift = true, clickable = true } = {}) => ({
    bgcolor: "background.paper",
    border: 0,
    borderRadius: 2,                            // 16px
    boxShadow: SHADOW.card,
    overflow: "hidden",
    cursor: clickable ? "pointer" : "default",
    transition: "transform 0.18s ease, box-shadow 0.2s ease",
    ...(lift && {
        "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: SHADOW.lift,
        },
    }),
});

/** 사이드바 카드 — lift 없이 깔끔한 surface */
export const sideCardSx = () => ({
    bgcolor: "background.paper",
    border: 0,
    borderRadius: 2,
    boxShadow: SHADOW.card,
    p: 2.75,
});

/** Stat 셀 — KV 통계 박스 */
export const statBoxSx = () => ({
    bgcolor: "background.paper",
    border: 0,
    borderRadius: 2,
    boxShadow: SHADOW.card,
    p: "20px 22px",
});

/**
 * 역할 카드 — 좌측 4px primary accent bar
 * children 구조: <Box sx={roleCardSx(theme)}> ... </Box>
 */
export const roleCardSx = () => ({
    position: "relative",
    bgcolor: "background.paper",
    border: 0,
    borderRadius: 2,
    boxShadow: SHADOW.card,
    p: "20px 22px",
    overflow: "hidden",
    "&::before": {
        content: '""',
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: 4,
        bgcolor: "primary.main",
    },
});

// ─────────────────────────────────────────────────────────────
// Chips / Buttons
// ─────────────────────────────────────────────────────────────

/**
 * 활성 "반전" 칩의 글자색 — 배경이 text.primary라 다크에서는 흰 글씨가 사라짐.
 * (createFormShared.jsx의 activeColor와 같은 규칙)
 */
const invertedInk = (theme) =>
    theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.common.white;

/** 큰 pill chip — 36px 높이. 활성 시 반전(ink) 배경. (탭 옆 카테고리 칩 등) */
export const chipSx = (theme, isActive = false) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 0.5,
    height: 36,
    px: 1.75,
    borderRadius: 99,
    border: "1px solid transparent",
    bgcolor: isActive ? "text.primary" : "background.paper",
    color: isActive ? invertedInk(theme) : "text.secondary",
    fontWeight: 600,
    fontSize: 13,
    boxShadow: isActive ? "none" : SHADOW.card,
    cursor: "pointer",
    transition: "background 0.12s ease, color 0.12s ease",
    "&:hover": isActive
        ? {}
        : { bgcolor: "background.paper", color: "text.primary" },
});

/** Filter chip — 34px 높이, 활성 시 accent-tint 배경 */
export const filterChipSx = (theme, isActive = false) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 0.5,
    height: 34,
    px: 1.75,
    borderRadius: 1.25,
    bgcolor: isActive
        ? alpha(theme.palette.primary.main, 0.12)
        : "transparent",
    color: isActive ? "primary.main" : "text.secondary",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    transition: "background 0.12s ease, color 0.12s ease",
    "&:hover": {
        bgcolor: isActive
            ? alpha(theme.palette.primary.main, 0.16)
            : alpha(theme.palette.text.primary, 0.05),
        color: isActive ? "primary.main" : "text.primary",
    },
});

/** 옵션 chip (modal-v2의 optionChipSx와 동일) — 36px, accent-tint + accent border 활성 */
export const optionChipSx = (theme, isActive = false) => ({
    display: "inline-flex",
    alignItems: "center",
    height: 36,
    px: 1.75,
    borderRadius: 1.25,
    bgcolor: isActive
        ? alpha(theme.palette.primary.main, 0.12)
        : alpha(theme.palette.text.primary, 0.05),
    border: "1.5px solid",
    borderColor: isActive ? "primary.main" : "transparent",
    color: isActive ? "primary.main" : "text.secondary",
    fontSize: 12.5,
    fontWeight: 600,
    letterSpacing: "-0.005em",
    cursor: "pointer",
    transition: "all 0.12s ease",
    "&:hover": {
        bgcolor: isActive
            ? alpha(theme.palette.primary.main, 0.16)
            : alpha(theme.palette.text.primary, 0.08),
        color: isActive ? "primary.main" : "text.primary",
    },
});

/** Segmented control button — 28px */
export const segButtonSx = (theme, isActive = false) => ({
    width: 30, height: 28,
    borderRadius: 0.875,
    display: "grid",
    placeItems: "center",
    bgcolor: isActive ? "text.primary" : "transparent",
    color: isActive ? invertedInk(theme) : "text.secondary",
    border: 0,
    cursor: "pointer",
    "&:hover": isActive
        ? {}
        : { color: "text.primary" },
});

/** Segmented control container */
export const segContainerSx = () => ({
    display: "inline-flex",
    gap: 0.25,
    p: 0.375,
    bgcolor: "background.paper",
    border: 0,
    borderRadius: 1.25,
    boxShadow: SHADOW.card,
});

/** Bookmark IconButton */
export const bookmarkBtnSx = (theme, isOn = false) => ({
    p: "5px",
    borderRadius: 1,
    color: isOn ? "primary.main" : "text.disabled",
    "&:hover": {
        bgcolor: alpha(theme.palette.primary.main, 0.10),
        color: "primary.main",
    },
});

// ─────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────

/** 검색 input (페이지 헤더용) — 48px 높이, white surface + shadow */
export const searchFieldSx = (theme) => ({
    "& .MuiOutlinedInput-root": {
        height: 48,
        bgcolor: "background.paper",
        borderRadius: 1.5,
        boxShadow: SHADOW.card,
        fontSize: 14.5,
        fontWeight: 500,
        transition: "box-shadow 0.12s ease",
        "& fieldset": { border: "1px solid transparent" },
        "&:hover fieldset": { borderColor: "transparent" },
        "&.Mui-focused fieldset": { borderColor: "primary.main", borderWidth: "1px" },
        "&.Mui-focused": {
            boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.12)}, ${SHADOW.card}`,
        },
    },
    "& .MuiOutlinedInput-input": { px: 1.75 },
    "& .MuiOutlinedInput-input::placeholder": { color: theme.palette.text.disabled, opacity: 1 },
});

/** 폼 input (modal-v2의 fillInputSx와 동일 — 44px 정도) */
export const fillInputSx = (theme) => ({
    "& .MuiOutlinedInput-root": {
        bgcolor: alpha(theme.palette.text.primary, 0.05),
        borderRadius: 1.375,
        fontSize: 14,
        fontWeight: 500,
        transition: "all 0.12s ease",
        "& fieldset": { border: "1.5px solid transparent" },
        "&:hover fieldset": { borderColor: alpha(theme.palette.text.primary, 0.1) },
        "&.Mui-focused": { bgcolor: "background.paper" },
        "&.Mui-focused fieldset": { borderColor: "primary.main", borderWidth: "1.5px" },
    },
    "& .MuiOutlinedInput-input": { py: 1.25, px: 1.75 },
});

// ─────────────────────────────────────────────────────────────
// Badges / Tags
// ─────────────────────────────────────────────────────────────

/**
 * 카테고리 배지 — bg-tint pill
 * @param {object} theme
 * @param {string} color — 카테고리 색 (CAT_CFG[cat].color)
 * @param {object} [opts]
 * @param {"sm"|"md"} [opts.size="md"]
 */
export const categoryBadgeSx = (theme, color, { size = "md" } = {}) => {
    const isLight = theme.palette.mode === "light";
    const tintBg = isLight ? alpha(color, 0.12) : alpha(color, 0.20);
    const sizes = {
        sm: { height: 22, px: 1, fontSize: 10.5, gap: 0.5 },
        md: { height: 24, px: 1.25, fontSize: 12, gap: 0.625 },
    };
    const s = sizes[size];
    return {
        display: "inline-flex",
        alignItems: "center",
        gap: s.gap,
        height: s.height,
        px: s.px,
        borderRadius: 1,
        bgcolor: tintBg,
        color,
        fontWeight: 600,
        fontSize: s.fontSize,
        letterSpacing: "-0.005em",
        whiteSpace: "nowrap",
        border: 0,
    };
};

/**
 * Meta pill — 작은 bg-tint 칩 (tech tag, role pill, 보조 배지)
 * color 미지정 시 중립 surface tone
 */
export const metaPillSx = (theme, color) => {
    if (color) {
        return {
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            px: 1.125,
            py: 0.375,
            borderRadius: 0.875,
            bgcolor: alpha(color, 0.10),
            color,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "-0.005em",
            whiteSpace: "nowrap",
            border: 0,
        };
    }
    return {
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        px: 1.125,
        py: 0.375,
        borderRadius: 0.875,
        bgcolor: alpha(theme.palette.text.primary, 0.05),
        color: "text.secondary",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "-0.005em",
        whiteSpace: "nowrap",
        border: 0,
    };
};

/**
 * Status badge — 모집 상태 (모집중/대기/마감)
 * @param {"active"|"pending"|"closed"} status
 */
export const statusBadgeSx = (theme, status) => {
    const palette = {
        active:  { color: theme.palette.success.main, bg: alpha(theme.palette.success.main, 0.10) },
        pending: { color: theme.palette.warning.main, bg: alpha(theme.palette.warning.main, 0.10) },
        closed:  { color: theme.palette.text.disabled, bg: alpha(theme.palette.text.primary, 0.05) },
    };
    const p = palette[status] || palette.active;
    return {
        display: "inline-flex",
        alignItems: "center",
        gap: 0.625,
        px: 1.25,
        height: 26,
        borderRadius: 99,
        bgcolor: p.bg,
        color: p.color,
        fontSize: 12.5,
        fontWeight: 600,
        letterSpacing: "-0.005em",
    };
};

// ─────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────

/**
 * Tab 버튼 — underline 활성, badge 카운트 포함 가능
 * 컨테이너에는 borderBottom 1px line-strong 적용 권장
 */
export const tabUnderlineSx = (theme, isActive = false) => ({
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: 0.75,
    px: 2,
    py: 1.5,
    border: 0,
    bgcolor: "transparent",
    color: isActive ? "primary.main" : "text.disabled",
    fontSize: 14.5,
    fontWeight: 600,
    cursor: "pointer",
    transition: "color 0.12s ease",
    "&:hover": { color: isActive ? "primary.main" : "text.primary" },
    "&::after": isActive ? {
        content: '""',
        position: "absolute",
        left: 14, right: 14, bottom: 0,
        height: 2.5,
        bgcolor: "primary.main",
        borderRadius: 1,
    } : {},
});

/** Tab 옆 badge — total count */
export const tabBadgeSx = (theme, isActive = false) => ({
    display: "inline-flex",
    alignItems: "center",
    px: 1,
    py: 0.25,
    borderRadius: 99,
    bgcolor: isActive
        ? alpha(theme.palette.primary.main, 0.12)
        : alpha(theme.palette.text.primary, 0.05),
    color: isActive ? "primary.main" : "text.disabled",
    fontSize: 11.5,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
});

// ─────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────

/** Section eyebrow — 작은 accent 라벨 ("프로젝트 소개" 위 같이) */
export const sectionEyebrowSx = () => ({
    fontSize: 12,
    fontWeight: 700,
    color: "primary.main",
    letterSpacing: "-0.005em",
    mb: 0.75,
    textTransform: "none",
});

/** Section title — 큰 헤딩 ("프로젝트 소개" 같이) */
export const sectionTitleSx = () => ({
    fontSize: 22,
    fontWeight: 700,
    color: "text.primary",
    letterSpacing: "-0.025em",
    mb: 2,
});

// ─────────────────────────────────────────────────────────────
// Empty state (재사용 — modal Step2 empty 패턴)
// ─────────────────────────────────────────────────────────────

export const emptyStateSx = (theme) => ({
    p: "28px 18px",
    textAlign: "center",
    bgcolor: alpha(theme.palette.text.primary, 0.03),
    border: "1px dashed",
    borderColor: alpha(theme.palette.text.primary, 0.14),
    borderRadius: 2,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 0.5,
});

export const emptyStateGlyphSx = () => ({
    width: 40, height: 40,
    borderRadius: 1.5,
    bgcolor: "background.paper",
    display: "grid", placeItems: "center",
    color: "text.disabled",
    mb: 0.875,
});

// ─────────────────────────────────────────────────────────────
// Map panel (지도 컨테이너)
// ─────────────────────────────────────────────────────────────

export const mapPanelSx = () => ({
    bgcolor: "background.paper",
    border: 0,
    borderRadius: 2,
    boxShadow: SHADOW.card,
    overflow: "hidden",
});
