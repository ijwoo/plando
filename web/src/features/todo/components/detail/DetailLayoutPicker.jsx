import React, { useState } from "react";
import { Box, Popover, Typography } from "@mui/material";
import ViewSidebarRoundedIcon from "@mui/icons-material/ViewSidebarRounded";

/**
 * 할 일 상세 배치 선택 — ClickUp 의 "Switch layout" 과 같은 방식.
 *
 * 왜 순환 버튼이 아니라 선택 팝오버인가: 3단계를 한 버튼으로 돌리면 다음에 어떤 배치가
 * 나올지 예측할 수 없다. 썸네일 3개를 나란히 보여주면 그림만으로 배치가 전달되고,
 * 지금 어느 배치인지도 한눈에 보인다.
 */

const OPTIONS = [
    { value: "sidebar", label: "사이드 패널", desc: "목록을 보면서 훑기" },
    { value: "modal", label: "모달", desc: "이 할 일에만 집중" },
    { value: "fullscreen", label: "전체화면", desc: "댓글까지 한 화면에" },
];

/** 배치를 나타내는 작은 도식. 실제 화면 비율을 흉내내 그린다(아이콘보다 전달이 빠르다). */
function Thumb({ value, active }) {
    // 비활성일 때 채움을 transparent 로 두면 도식이 거의 보이지 않아
    // "어떤 배치인지" 전달이 안 된다(첫 구현에서 실제로 그랬다).
    // 활성=브랜드색, 비활성=옅은 회색으로 항상 형태가 읽히게 한다.
    const line = active ? "var(--plando-primary)" : "rgba(100,116,139,0.45)";
    const fill = active ? "var(--plando-primary-soft)" : "rgba(100,116,139,0.16)";
    return (
        <Box
            sx={{
                width: 62,
                height: 40,
                borderRadius: "5px",
                border: "1px solid",
                borderColor: line,
                bgcolor: "background.paper",
                position: "relative",
                overflow: "hidden",
                flexShrink: 0,
            }}
        >
            {/* 상단 바 — 어느 배치든 네비는 남는다 */}
            <Box sx={{ height: 6, borderBottom: "1px solid", borderColor: line, opacity: 0.6 }} />

            {value === "sidebar" && (
                <Box sx={{ position: "absolute", top: 7, right: 0, bottom: 0, width: 20, bgcolor: fill, borderLeft: "1px solid", borderColor: line }} />
            )}
            {value === "modal" && (
                <Box sx={{ position: "absolute", top: 12, left: 11, right: 11, bottom: 6, bgcolor: fill, border: "1px solid", borderColor: line, borderRadius: "3px" }} />
            )}
            {value === "fullscreen" && (
                <>
                    <Box sx={{ position: "absolute", top: 7, left: 0, right: 18, bottom: 0, bgcolor: fill }} />
                    {/* 오른쪽 댓글 열 */}
                    <Box sx={{ position: "absolute", top: 7, right: 0, bottom: 0, width: 18, borderLeft: "1px solid", borderColor: line, bgcolor: fill, opacity: 0.55 }} />
                </>
            )}
        </Box>
    );
}

export default function DetailLayoutPicker({ value, onChange, onBeforeChange }) {
    const [anchorEl, setAnchorEl] = useState(null);
    const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];

    const pick = (next) => {
        setAnchorEl(null);
        if (next === value) return;
        // 배치를 바꾸면 컴포넌트가 다시 마운트되므로, 입력 중이던 변경을 먼저 저장한다.
        onBeforeChange?.();
        onChange(next);
    };

    return (
        <>
            <button
                type="button"
                className={`pd-iconbtn${value !== "sidebar" ? " is-active" : ""}`}
                title={`배치: ${current.label}`}
                aria-label="상세 배치 바꾸기"
                onClick={(e) => setAnchorEl(e.currentTarget)}
            >
                <ViewSidebarRoundedIcon sx={{ fontSize: 15 }} />
            </button>

            <Popover
                open={!!anchorEl}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{ paper: { sx: { mt: 0.75, p: 1, borderRadius: 2.5, boxShadow: "var(--plando-elev-2)" } } }}
            >
                <Typography sx={{ px: 0.75, pt: 0.25, pb: 0.75, fontSize: 11, fontWeight: 800, color: "text.disabled", letterSpacing: "0.02em" }}>
                    배치 바꾸기
                </Typography>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                    {OPTIONS.map((o) => {
                        const active = o.value === value;
                        return (
                            <Box
                                key={o.value}
                                role="button"
                                tabIndex={0}
                                onClick={() => pick(o.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(o.value); } }}
                                sx={{
                                    width: 92,
                                    p: 0.875,
                                    borderRadius: 2,
                                    cursor: "pointer",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 0.625,
                                    bgcolor: active ? "var(--plando-primary-soft)" : "transparent",
                                    "&:hover": { bgcolor: active ? "var(--plando-primary-soft)" : "action.hover" },
                                }}
                            >
                                <Thumb value={o.value} active={active} />
                                <Box sx={{ textAlign: "center", minWidth: 0 }}>
                                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: active ? "primary.main" : "text.primary", lineHeight: 1.3 }}>
                                        {o.label}
                                    </Typography>
                                    <Typography sx={{ fontSize: 10.5, color: "text.disabled", lineHeight: 1.35, mt: 0.125 }}>
                                        {o.desc}
                                    </Typography>
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Popover>
        </>
    );
}
