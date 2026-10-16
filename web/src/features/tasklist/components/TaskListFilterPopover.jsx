import React from "react";
import { Popover, useTheme } from "@mui/material";
import { blurSx } from "../../../shared/ui/glassSx.js";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { PRIORITY_LABEL } from "../../../shared/ui/tone.js";

const F = "-apple-system,'Noto Sans KR',BlinkMacSystemFont,sans-serif";

export default function TaskListFilterPopover({
    anchorEl,
    open,
    onClose,
    prioritySet,
    onTogglePriority,
    recurringOnly,
    onToggleRecurring,
    dueDateFilter,
    onSetDueDateFilter,
    assigneeSel = [],
    onToggleAssignee,
    tagSel = [],
    onToggleTag,
    tags = [],
    members = [],
    myEmail,
    onClear,
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const tok = isDark ? {
        bg:      "rgba(19,19,23,0.98)",
        border:  "rgba(255,255,255,0.12)",
        sep:     "rgba(255,255,255,0.07)",
        text:    "rgba(255,255,255,0.92)",
        text2:   "rgba(255,255,255,0.50)",
        text3:   "rgba(255,255,255,0.28)",
        surface: "rgba(255,255,255,0.05)",
        hover:   "rgba(255,255,255,0.06)",
        check:   "#5B8DEF",
        checkBg: "rgba(91,141,239,0.15)",
    } : {
        bg:      "rgba(248,248,252,0.98)",
        border:  "rgba(60,60,67,0.16)",
        sep:     "rgba(0,0,0,0.06)",
        text:    "rgba(0,0,0,0.88)",
        text2:   "rgba(0,0,0,0.50)",
        text3:   "rgba(0,0,0,0.28)",
        surface: "rgba(0,0,0,0.03)",
        hover:   "rgba(0,0,0,0.04)",
        check:   "#2563EB",
        checkBg: "rgba(37,99,235,0.10)",
    };

    const CheckRow = ({ label, checked, onToggle }) => (
        <div
            onClick={onToggle}
            style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 10, cursor: "pointer",
                background: checked ? tok.checkBg : "transparent",
                transition: "background 0.12s",
                fontFamily: F,
            }}
            onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = tok.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = checked ? tok.checkBg : "transparent"; }}
        >
            {/* custom checkbox */}
            <div style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                border: `2px solid ${checked ? tok.check : tok.border}`,
                background: checked ? tok.check : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.12s",
            }}>
                {checked && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </div>
            <span style={{ fontSize: 13.5, fontWeight: checked ? 700 : 500, color: checked ? tok.text : tok.text2, fontFamily: F }}>
                {label}
            </span>
        </div>
    );

    return (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            PaperProps={{
                sx: {
                    mt: 0.5,
                    width: 260,
                    borderRadius: "16px",
                    background: tok.bg,
                    backgroundImage: "none",
                    ...blurSx("blur(40px)"),
                    border: `1px solid ${tok.border}`,
                    boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
                    overflow: "hidden",
                },
            }}
        >
            <div style={{ padding: "14px 14px 10px", fontFamily: F }}>
                {/* 헤더 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: tok.text, letterSpacing: -0.3, fontFamily: F }}>필터</span>
                    <button
                        onClick={onClear}
                        style={{
                            display: "flex", alignItems: "center", gap: 4,
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: 12.5, fontWeight: 700, color: tok.text2, fontFamily: F,
                            padding: "4px 8px", borderRadius: 8,
                        }}
                    >
                        <RefreshRoundedIcon sx={{ fontSize: 14 }} />
                        초기화
                    </button>
                </div>

                {/* 우선순위 */}
                <div style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: tok.text3, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4, paddingLeft: 2, fontFamily: F }}>
                        우선순위
                    </div>
                    {["HIGH", "MEDIUM", "LOW"].map((k) => (
                        <CheckRow key={k} label={PRIORITY_LABEL?.[k] ?? k} checked={prioritySet?.has(k)} onToggle={() => onTogglePriority?.(k)} />
                    ))}
                </div>

                <div style={{ borderTop: `1px solid ${tok.sep}`, margin: "8px 0" }} />

                {/* 기간 (오늘 마감 / 지연) */}
                <div style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: tok.text3, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4, paddingLeft: 2, fontFamily: F }}>
                        기간
                    </div>
                    <CheckRow
                        label="오늘 마감"
                        checked={dueDateFilter === "today"}
                        onToggle={() => onSetDueDateFilter?.(dueDateFilter === "today" ? null : "today")}
                    />
                    <CheckRow
                        label="지연된 작업"
                        checked={dueDateFilter === "overdue"}
                        onToggle={() => onSetDueDateFilter?.(dueDateFilter === "overdue" ? null : "overdue")}
                    />
                </div>

                <div style={{ borderTop: `1px solid ${tok.sep}`, margin: "8px 0" }} />

                {/* 담당 — 내 할 일 / 멤버 / 미지정 (여러 명 선택 가능, 합집합) */}
                <div style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: tok.text3, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4, paddingLeft: 2, fontFamily: F }}>
                        담당 · 여러 명 선택 가능
                    </div>
                    {[
                        { token: "me", label: "내 할 일" },
                        ...members
                            .filter((m) => m.email && m.email !== myEmail)
                            .map((m) => ({ token: m.email, label: m.name || m.email })),
                        { token: "none", label: "미지정" },
                    ].map((c) => (
                        <CheckRow
                            key={c.token}
                            label={c.label}
                            checked={assigneeSel.includes(c.token)}
                            onToggle={() => onToggleAssignee?.(c.token)}
                        />
                    ))}
                </div>

                {/* 태그 — 여러 개 선택 시 합집합(담당 축과 같은 규칙).
                    워크스페이스에 태그가 없으면 섹션 자체를 감춘다(빈 칸을 그리지 않는다). */}
                {tags.length > 0 ? (
                    <>
                        <div style={{ borderTop: `1px solid ${tok.sep}`, margin: "8px 0" }} />
                        <div style={{ marginBottom: 4 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: tok.text3, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4, paddingLeft: 2, fontFamily: F }}>
                                태그 · 여러 개 선택 가능
                            </div>
                            {tags.map((t) => (
                                <CheckRow
                                    key={t.id}
                                    label={t.name}
                                    checked={tagSel.includes(t.id)}
                                    onToggle={() => onToggleTag?.(t.id)}
                                />
                            ))}
                        </div>
                    </>
                ) : null}

                <div style={{ borderTop: `1px solid ${tok.sep}`, margin: "8px 0" }} />

                {/* 반복 일정 */}
                <div style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: tok.text3, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4, paddingLeft: 2, fontFamily: F }}>
                        반복
                    </div>
                    <CheckRow label="반복 일정만" checked={!!recurringOnly} onToggle={() => onToggleRecurring?.()} />
                </div>
            </div>
        </Popover>
    );
}
