import React, { useEffect, useState } from "react";
import { Box, Checkbox, Typography } from "@mui/material";
import { fadeDividerSx } from "../../../../shared/ui/glassSx.js";
import {
    getOptionValue,
    getOptionLabel,
    getAvatarSrc,
} from "../../../../shared/utils/assigneeUtils.js";
import UserAvatar from "../../../../shared/ui/common/UserAvatar.jsx";

/**
 * 참여자 선택 본문 — 체크박스 다중 선택 리스트 + 헤더 카운트 + 취소/적용 버튼.
 *
 * 데스크탑은 Popover, 모바일은 BottomSheet Dialog로 감싸서 호출.
 *
 * @param {{
 *   options: any[],
 *   selectedValues: string[],
 *   onApply: (nextValues: string[]) => void,
 *   onClose: () => void,
 *   sizeHint?: "compact" | "comfortable",  // 모바일은 comfortable로 큰 터치 타겟
 * }} props
 */
export default function AssigneeListContent({ options, selectedValues, onApply, onClose, sizeHint = "compact" }) {
    const [draft, setDraft] = useState(selectedValues);
    useEffect(() => { setDraft(selectedValues); }, [selectedValues]);

    const toggle = (val) => {
        setDraft((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));
    };

    const apply = () => { onApply?.(draft); onClose?.(); };

    const rowPy = sizeHint === "comfortable" ? 1.2 : 0.75;
    const rowFontSize = sizeHint === "comfortable" ? 14 : 12.5;
    const avatarSize = sizeHint === "comfortable" ? 28 : 22;

    return (
        <>
            <Box sx={{
                px: 1.75, py: 1.25, ...fadeDividerSx("var(--plando-divider)", "bottom"),
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0,
            }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: "var(--plando-text-primary)" }}>담당자</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: "var(--plando-text-tertiary)" }}>
                    {draft.length}명 선택
                </Typography>
            </Box>

            <Box sx={{ overflowY: "auto", flex: 1, py: 0.5 }}>
                {options.length === 0 ? (
                    <Typography sx={{ p: 2, fontSize: 13, color: "var(--plando-text-tertiary)", textAlign: "center" }}>
                        선택 가능한 참여자가 없습니다.
                    </Typography>
                ) : (
                    options.map((opt) => {
                        const val = getOptionValue(opt);
                        const label = getOptionLabel(opt);
                        const src = getAvatarSrc(opt);
                        const checked = draft.includes(val);
                        return (
                            <Box key={val}
                                onClick={() => toggle(val)}
                                sx={{
                                    display: "flex", alignItems: "center", gap: 1.5,
                                    px: 1.75, py: rowPy, cursor: "pointer",
                                    "&:active": { background: "var(--plando-surface-alt)" },
                                    "&:hover": { background: "var(--plando-surface-alt)" },
                                }}
                            >
                                <Checkbox size="small" checked={checked} sx={{ p: 0 }} />
                                <UserAvatar name={label} src={src} size={avatarSize} />
                                <Typography sx={{ fontSize: rowFontSize, fontWeight: 500, color: "var(--plando-text-primary)", flex: 1 }}>
                                    {label}
                                </Typography>
                            </Box>
                        );
                    })
                )}
            </Box>

            <Box sx={{
                ...fadeDividerSx("var(--plando-divider)"),
                display: "flex",
                flexShrink: 0,
            }}>
                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        flex: 1,
                        padding: sizeHint === "comfortable" ? "14px" : "10px",
                        background: "transparent",
                        border: 0,
                        borderRight: "1px solid var(--plando-divider)",
                        fontSize: sizeHint === "comfortable" ? 15 : 13,
                        fontWeight: 600,
                        color: "var(--plando-text-secondary)",
                        cursor: "pointer",
                        fontFamily: "inherit",
                    }}
                >
                    취소
                </button>
                <button
                    type="button"
                    onClick={apply}
                    style={{
                        flex: 1,
                        padding: sizeHint === "comfortable" ? "14px" : "10px",
                        background: "transparent",
                        border: 0,
                        fontSize: sizeHint === "comfortable" ? 15 : 13,
                        fontWeight: 700,
                        color: "var(--plando-primary)",
                        cursor: "pointer",
                        fontFamily: "inherit",
                    }}
                >
                    적용
                </button>
            </Box>
        </>
    );
}
