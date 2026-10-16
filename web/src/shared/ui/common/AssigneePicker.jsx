import React, { useRef, useMemo, useState } from "react";
import { Dialog, Popover, Avatar, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { blurSx } from "../glassSx.js";
import { getOptionValue, getOptionLabel, getAvatarSrc } from "../../utils/assigneeUtils.js";
import { Z } from "../zIndex.js";

const F = "-apple-system,'Noto Sans KR',BlinkMacSystemFont,sans-serif";

/**
 * MUI theme palette 기반 토큰 빌드.
 * 이전: 자체 #2563EB / #5B8DEF 하드코딩 (테마 변경 무시).
 * 이후: theme.palette.primary 사용 — 사용자가 accent 변경 시 컴포넌트도 따라감.
 */
function buildTokens(theme) {
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;
    return {
        text:     theme.palette.text.primary,
        text2:    theme.palette.text.secondary,
        text3:    theme.palette.text.disabled,
        primary,
        check:    primary,
        chipText: isDark ? theme.palette.primary.light : primary,
        selected: alpha(primary, isDark ? 0.14 : 0.08),
        selBd:    alpha(primary, isDark ? 0.30 : 0.20),
        chip:     alpha(primary, isDark ? 0.15 : 0.10),
    };
}

/** 참여자 목록 행 — sheet / popover 공통 */
function OptionRow({ option, checked, onToggle, t, compact = false }) {
    const label = typeof option === "string" ? option : getOptionLabel(option);
    const src   = typeof option === "string" ? undefined : getAvatarSrc(option);
    const val   = typeof option === "string" ? option : getOptionValue(option);

    return (
        <div
            onClick={() => onToggle(val)}
            style={{
                display: "flex", alignItems: "center",
                gap: compact ? 8 : 12,
                padding: compact ? "7px 12px" : "10px 16px",
                cursor: "pointer",
                background: checked ? t.selected : "transparent",
                transition: "background 0.12s",
            }}
            onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = t.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = checked ? t.selected : "transparent"; }}
        >
            <Avatar src={src} sx={{ width: compact ? 26 : 34, height: compact ? 26 : 34, fontSize: compact ? 11 : 13, fontWeight: 700 }}>
                {(label?.[0] ?? "?").toUpperCase()}
            </Avatar>
            <span style={{ flex: 1, fontSize: compact ? 13 : 14, fontWeight: checked ? 700 : 500, color: t.text, fontFamily: F }}>
                {label}
            </span>
            <div style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                border: `2px solid ${checked ? t.check : t.border}`,
                background: checked ? t.check : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.12s",
            }}>
                {checked && <CheckRoundedIcon sx={{ fontSize: 12, color: "#fff" }} />}
            </div>
        </div>
    );
}

/**
 * @param {"sheet"|"popover"} variant
 *   - "sheet"   : 모바일 바텀시트 Dialog (기본값)
 *   - "popover" : 데스크탑용 트리거 앵커 Popover
 */
export default function AssigneePicker({
    assigneeOptions = [],
    selectedValues = [],
    onChange,
    title = "담당자",
    emptyText = "탭하여 선택",
    dialogTitle = "담당자 선택",
    variant = "sheet",
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const t = buildTokens(theme);

    const triggerBg = theme.palette.background.paper;
    const triggerBd = theme.palette.divider;
    const pickerBg  = alpha(theme.palette.background.paper, 0.98);
    const pickerBd  = theme.palette.divider;

    const anchorRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState([]);

    const selectedOptions = useMemo(() => {
        return selectedValues
            .map((val) => assigneeOptions.find((u) => getOptionValue(u) === val) ?? val)
            .filter(Boolean);
    }, [assigneeOptions, selectedValues]);

    const handleOpen  = () => { setDraft(selectedValues); setOpen(true); };
    const handleClose = () => setOpen(false);
    const handleToggle  = (value) => {
        setDraft((prev) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]);
    };
    const handleConfirm = () => { onChange?.(draft); setOpen(false); };

    /* ── 트리거 카드 (공통) ── */
    const trigger = (
        <div
            ref={anchorRef}
            onClick={handleOpen}
            style={{
                background: triggerBg,
                border: `1px solid ${triggerBd}`,
                borderRadius: 12,
                padding: "10px 14px",
                cursor: "pointer",
                marginBottom: 2,
                fontFamily: F,
                transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.text3; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = triggerBd; }}
        >
            {title && (
                <div style={{ fontSize: 11, fontWeight: 700, color: t.text2, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 7, fontFamily: F }}>
                    {title}
                </div>
            )}
            {selectedValues.length === 0 ? (
                <div style={{ fontSize: 13.5, color: t.text3, fontFamily: F }}>{emptyText}</div>
            ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    {selectedOptions.map((option, idx) => {
                        const value = typeof option === "string" ? option : getOptionValue(option);
                        const label = typeof option === "string" ? option : getOptionLabel(option);
                        const src   = typeof option === "string" ? undefined : getAvatarSrc(option);
                        return (
                            <div key={`${value}-${idx}`} style={{
                                display: "flex", alignItems: "center", gap: 5,
                                background: t.chip, borderRadius: 999,
                                padding: "3px 10px 3px 4px",
                            }}>
                                <Avatar src={src} sx={{ width: 20, height: 20, fontSize: 10, fontWeight: 700 }}>
                                    {(label?.[0] ?? "?").toUpperCase()}
                                </Avatar>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: t.chipText, fontFamily: F }}>{label}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    /* ── 공통 옵션 목록 ── */
    const optionList = (compact = false) => (
        <div style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
            {assigneeOptions.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", fontSize: 13, color: t.text2, fontFamily: F }}>
                    선택 가능한 참여자가 없습니다.
                </div>
            ) : (
                assigneeOptions.map((option) => {
                    const val = getOptionValue(option);
                    return (
                        <OptionRow
                            key={val}
                            option={option}
                            checked={draft.includes(val)}
                            onToggle={handleToggle}
                            t={t}
                            compact={compact}
                        />
                    );
                })
            )}
        </div>
    );

    /* ════════════════════════════════
       데스크탑 — Popover
    ════════════════════════════════ */
    if (variant === "popover") {
        return (
            <>
                {trigger}
                <Popover
                    open={open}
                    anchorEl={anchorRef.current}
                    onClose={handleClose}
                    anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                    transformOrigin={{ vertical: "top", horizontal: "left" }}
                    disablePortal={false}
                    sx={{ zIndex: Z.MODAL_NESTED }}
                    slotProps={{
                        paper: {
                            sx: {
                                width: anchorRef.current?.offsetWidth ?? 280,
                                maxHeight: 320,
                                display: "flex",
                                flexDirection: "column",
                                borderRadius: 2.5,
                                border: `1px solid ${pickerBd}`,
                                bgcolor: pickerBg,
                                backgroundImage: "none",
                                boxShadow: isDark
                                    ? "0 8px 32px rgba(0,0,0,0.5)"
                                    : "0 8px 24px rgba(0,0,0,0.12)",
                                overflow: "hidden",
                                mt: 0.5,
                            },
                        },
                    }}
                >
                    {/* 헤더 */}
                    <div style={{
                        padding: "10px 14px 8px",
                        borderBottom: `1px solid ${pickerBd}`,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: t.text, fontFamily: F }}>
                            {dialogTitle}
                        </span>
                        {draft.length > 0 && (
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: t.primary, fontFamily: F }}>
                                {draft.length}명 선택됨
                            </span>
                        )}
                    </div>

                    {/* 목록 */}
                    {optionList(true)}

                    {/* 버튼 */}
                    <div style={{ display: "flex", borderTop: `1px solid ${pickerBd}` }}>
                        <button
                            onClick={handleClose}
                            style={{
                                flex: 1, padding: "10px", background: "none", border: "none",
                                borderRight: `1px solid ${pickerBd}`,
                                fontSize: 13, fontWeight: 600, color: t.text2,
                                cursor: "pointer", fontFamily: F,
                            }}
                        >
                            취소
                        </button>
                        <button
                            onClick={handleConfirm}
                            style={{
                                flex: 1, padding: "10px", background: "none", border: "none",
                                fontSize: 13, fontWeight: 700, color: t.primary,
                                cursor: "pointer", fontFamily: F,
                            }}
                        >
                            완료
                        </button>
                    </div>
                </Popover>
            </>
        );
    }

    /* ════════════════════════════════
       모바일 — 바텀시트 Dialog
    ════════════════════════════════ */
    return (
        <>
            {trigger}
            <Dialog
                open={open}
                onClose={handleClose}
                fullWidth
                sx={{ zIndex: Z.MODAL_NESTED }}
                PaperProps={{
                    sx: {
                        position: "fixed",
                        bottom: 0, left: 0, right: 0,
                        width: "100%", m: 0,
                        borderRadius: "20px 20px 0 0",
                        maxHeight: "60vh",
                        display: "flex", flexDirection: "column",
                        background: pickerBg,
                        backgroundImage: "none",
                        ...blurSx("blur(20px)"),
                        border: `1px solid ${pickerBd}`,
                        borderBottom: "none",
                        boxShadow: "0 -8px 40px rgba(0,0,0,0.28)",
                    },
                }}
                slotProps={{ backdrop: { sx: { ...blurSx("blur(4px)"), backgroundColor: "rgba(0,0,0,0.4)" } } }}
            >
                {/* 핸들 */}
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 4 }}>
                    <div style={{ width: 36, height: 4, borderRadius: 999, background: pickerBd }} />
                </div>

                {/* 제목 */}
                <div style={{ padding: "4px 20px 10px", borderBottom: `1px solid ${pickerBd}` }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: t.text, letterSpacing: -0.3, fontFamily: F }}>
                        {dialogTitle}
                    </span>
                </div>

                {/* 목록 */}
                {optionList(false)}

                {/* 버튼 */}
                <div style={{ display: "flex", borderTop: `1px solid ${pickerBd}`, fontFamily: F }}>
                    <button
                        onClick={handleClose}
                        style={{
                            flex: 1, padding: "14px", background: "none", border: "none",
                            borderRight: `1px solid ${pickerBd}`,
                            fontSize: 15, fontWeight: 600, color: t.text2,
                            cursor: "pointer", fontFamily: F,
                        }}
                    >
                        취소
                    </button>
                    <button
                        onClick={handleConfirm}
                        style={{
                            flex: 1, padding: "14px", background: "none", border: "none",
                            fontSize: 15, fontWeight: 700, color: t.primary,
                            cursor: "pointer", fontFamily: F,
                        }}
                    >
                        완료
                    </button>
                </div>
            </Dialog>
        </>
    );
}
