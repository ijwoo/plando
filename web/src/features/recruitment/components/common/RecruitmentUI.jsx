/**
 * 팀 모집 기능 공용 UI 컴포넌트
 * 모든 recruitment 컴포넌트는 반드시 여기서 import 해야 합니다.
 *
 * 내보내는 컴포넌트:
 *  - StackBadge       기술 스택 컬러 뱃지
 *  - LeaderAvatar     리스트/카드용 작은 아바타
 *  - MemberAvatar     상세 모달용 큰 아바타 (이름 + 역할)
 *  - MemberDots       인원 현황 점 표시
 *  - RoleBadge        역할 뱃지
 *  - AppliedStatusBadge 신청 상태 뱃지
 *  - SectionLabel     섹션 헤더 레이블
 *  - TypeBadge        카테고리 타입 뱃지
 *  - ModeBadge        온라인/오프라인 방식 뱃지
 *
 * Toss 톤: hairline border 제거 + 작은 inline pill / 단색 아바타.
 */
import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import {
    STACK_COLORS,
    MEET_TYPE_CFG,
    inferMeetType,
    normalizeMeetType,
    APPLICATION_STATUS_CFG,
    resolveStatusColor,
} from "../../constants/recruitmentConfig";
import { getCategory, avatarColor } from "../../utils/recruitmentUtils";

// ─────────────────────────────────────────────────────────────
// Inline pill base — Toss tone (border 없음, 단순 bg-tint)
// ─────────────────────────────────────────────────────────────
const BADGE_BASE = {
    display: "inline-flex",
    alignItems: "center",
    height: 20,
    px: "8px",
    borderRadius: 999,
    fontSize: 10,
    whiteSpace: "nowrap",
    flexShrink: 0,
    lineHeight: 1,
    letterSpacing: "-0.005em",
};

/** 기술 스택 뱃지 — Toss .tech 톤 (no border, soft bg-tint) */
export function StackBadge({ name, size = "sm" }) {
    const theme = useTheme();
    const color = STACK_COLORS[name] || theme.palette.text.secondary;
    const fs = size === "sm" ? 10 : 11;
    return (
        <Box
            component="span"
            sx={{
                fontSize: fs,
                fontWeight: 600,
                color,
                bgcolor: alpha(color, 0.10),
                borderRadius: 0.875,
                px: 1,
                py: "3px",
                whiteSpace: "nowrap",
                letterSpacing: "-0.005em",
            }}
        >
            {name}
        </Box>
    );
}

/** 리스트/카드용 작은 아바타 — Toss 톤 (단색, 그라데이션 제거) */
export function LeaderAvatar({ name, src, size = 22 }) {
    const color = avatarColor(name);
    return (
        <Box sx={{
            width: size, height: size,
            borderRadius: "50%",
            bgcolor: src ? "transparent" : color,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: size * 0.40,
            color: "#fff",
            fontWeight: 700,
            flexShrink: 0,
            overflow: "hidden",
            letterSpacing: "-0.01em",
        }}>
            {src
                ? <Box component="img" src={src} alt={name} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : (name?.[0] || "?")}
        </Box>
    );
}

/** 상세 모달용 큰 아바타 (이름 + 역할 표시) — Toss 톤 */
export function MemberAvatar({ name, size = 36, role }) {
    const color = avatarColor(name);
    return (
        <Stack direction="row" alignItems="center" gap={1.5}>
            <Box sx={{
                width: size, height: size,
                borderRadius: "50%",
                bgcolor: color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: size * 0.38,
                color: "#fff",
                fontWeight: 700,
                flexShrink: 0,
                letterSpacing: "-0.01em",
            }}>
                {name?.[0] || "?"}
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "text.primary",
                    letterSpacing: "-0.015em",
                }}>
                    {name}
                </Typography>
                {role && (
                    <Typography sx={{
                        fontSize: 11.5,
                        color: "text.secondary",
                        fontWeight: 500,
                        mt: 0.125,
                    }}>
                        {role}
                    </Typography>
                )}
            </Box>
        </Stack>
    );
}

/** 인원 현황 점 표시 (current/max) */
export function MemberDots({ current, max, color }) {
    const theme = useTheme();
    const dotColor = color || theme.palette.primary.main;
    // current: "2/4명" 형태 or 숫자, max: 숫자
    let cur, tot;
    if (typeof current === "string" && current.includes("/")) {
        const parts = current.split("/");
        cur = parseInt(parts[0], 10) || 1;
        tot = parseInt(parts[1], 10) || (parseInt(max, 10) || 4);
    } else {
        cur = parseInt(current, 10) || 1;
        tot = parseInt(max, 10) || 4;
    }

    return (
        <Stack direction="row" spacing={0.4} alignItems="center">
            {Array.from({ length: Math.min(tot, 8) }).map((_, i) => (
                <Box
                    key={i}
                    sx={{
                        width: 5, height: 5, borderRadius: "50%",
                        bgcolor: i < cur ? dotColor : alpha(dotColor, 0.18),
                    }}
                />
            ))}
        </Stack>
    );
}

/**
 * 역할 뱃지 (상세 모달 역할 목록용) — Toss 톤: 부드러운 surface + 우측 진행도 pill.
 * count + acceptedCount 가 있으면 "N/M명" 진행도 표시, 없으면 status pill.
 */
export function RoleBadge({ name, count, acceptedCount, status, description }) {
    const theme = useTheme();
    const hasProgress = count != null;
    const accepted = acceptedCount ?? 0;
    const isFull = hasProgress && accepted >= count;

    return (
        <Box sx={{
            px: 1.75,
            py: 1.125,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: alpha(theme.palette.text.primary, 0.07),
            borderRadius: 1.5,
        }}>
            <Stack direction="row" alignItems="center" gap={1}>
                <Typography sx={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: isFull ? "text.disabled" : "text.primary",
                    letterSpacing: "-0.015em",
                    flex: 1,
                }}>
                    {name}
                </Typography>
                {hasProgress ? (
                    <Box component="span" sx={{
                        ...BADGE_BASE,
                        fontWeight: 700,
                        color: isFull ? theme.palette.text.disabled : theme.palette.primary.main,
                        bgcolor: isFull
                            ? alpha(theme.palette.text.primary, 0.06)
                            : alpha(theme.palette.primary.main, 0.10),
                    }}>
                        {isFull ? "모집 완료" : `${accepted}/${count}명`}
                    </Box>
                ) : (
                    <Box component="span" sx={{
                        ...BADGE_BASE,
                        fontWeight: 600,
                        color: theme.palette.success.main,
                        bgcolor: alpha(theme.palette.success.main, 0.12),
                    }}>
                        {status}
                    </Box>
                )}
            </Stack>
            {description && (
                <Typography sx={{
                    mt: 0.75,
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: "text.secondary",
                    fontWeight: 500,
                    whiteSpace: "pre-wrap",
                }}>
                    {description}
                </Typography>
            )}
        </Box>
    );
}

/**
 * 섹션 헤더 레이블 (uppercase 소제목)
 * RecruitmentDetailMobile / RecruitmentDetailModal 공용
 */
export function SectionLabel({ children, mb = 1.25 }) {
    return (
        <Typography sx={{
            fontSize: 11,
            fontWeight: 700,
            color: "text.disabled",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            mb,
        }}>
            {children}
        </Typography>
    );
}

/**
 * 카테고리 타입 뱃지 (🚀 토이프로젝트 등)
 * typeLabel 에서 CAT_CFG 자동 조회
 */
export function TypeBadge({ typeLabel, cat: catProp }) {
    const theme = useTheme();
    const cat = catProp || getCategory(typeLabel, theme);
    return (
        <Box component="span" sx={{
            ...BADGE_BASE,
            gap: 0.375,
            fontWeight: 600,
            color: cat.color,
            bgcolor: alpha(cat.color, 0.10),
        }}>
            <span>{cat.icon}</span>
            <span>{typeLabel}</span>
        </Box>
    );
}

/**
 * 진행 방식 뱃지 — 🌐 온라인 / 📍 오프라인 / ⚡ 온/오프
 * meetType 우선 사용, 없으면 hasLocation(bool)에서 추정.
 */
export function ModeBadge({ meetType, hasLocation, item, showIcon = true }) {
    const theme = useTheme();
    // 대문자 레거시 값("OFFLINE")·백엔드 어휘("mixed")도 받아들인다.
    // 예전엔 조회 실패 시 null을 반환해서 뱃지가 통째로 사라졌다 —
    // 알 수 없는 값이면 hasLocation 기준으로 추정해서라도 항상 뱃지를 보여준다.
    const id = normalizeMeetType(meetType) || inferMeetType(item || { hasLocation, meetType });
    const cfg = MEET_TYPE_CFG[id] || MEET_TYPE_CFG.online;
    const color = theme.palette[cfg.colorKey]?.main || theme.palette.text.secondary;
    return (
        <Box component="span" sx={{
            ...BADGE_BASE,
            gap: 0.375,
            fontWeight: 600,
            color,
            bgcolor: alpha(color, 0.10),
        }}>
            {showIcon && <span>{cfg.icon}</span>}
            <span>{cfg.label}</span>
        </Box>
    );
}

/** 신청 상태 뱃지 — Toss 톤: border 제거, theme 색 사용 */
export function AppliedStatusBadge({ status }) {
    const theme = useTheme();
    if (!status) return null;
    const cfg = APPLICATION_STATUS_CFG[status];
    if (!cfg) return null;
    const color = resolveStatusColor(theme, cfg.colorKey);
    return (
        <Box component="span" sx={{
            ...BADGE_BASE,
            fontWeight: 700,
            color,
            bgcolor: alpha(color, 0.12),
        }}>
            {cfg.label}
        </Box>
    );
}
