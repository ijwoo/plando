import React from "react";
import { Dialog, useTheme } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { blurSx } from "../../../shared/ui/glassSx.js";
import moment from "moment";
import { StatusChip } from "../../../shared/ui/common/Chips.jsx";
import { PRIORITY_LABEL, priorityColor, softOn } from "../../../shared/ui/tone.js";

const FONT = "var(--plando-font)";

const TOK = {
    bg:       "var(--plando-surface)",
    border:   "var(--plando-border)",
    sep:      "var(--plando-divider)",
    text:     "var(--plando-text-primary)",
    text2:    "var(--plando-text-secondary)",
    text3:    "var(--plando-text-disabled)",
    surface:  "var(--plando-surface-low)",
};

export default function CalendarEventModal({ open, onClose, event }) {
    const theme = useTheme();

    if (!event) return null;

    const priority = event.priority;
    const priorityHex = priority ? priorityColor(theme, priority) : TOK.text2;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: "var(--plando-radius-lg)",
                    background: TOK.bg,
                    backgroundImage: "none",
                    ...blurSx("blur(40px)"),
                    border: `1px solid ${TOK.border}`,
                    boxShadow: "var(--plando-shadow-4)",
                    overflow: "hidden",
                    fontFamily: FONT,
                },
            }}
            slotProps={{
                backdrop: { sx: { ...blurSx("blur(4px)"), backgroundColor: "var(--plando-overlay-bg)" } },
            }}
        >
            {/* 헤더 */}
            <div style={{
                padding: "18px 20px 14px",
                display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8,
                borderBottom: `1px solid ${TOK.sep}`,
            }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: TOK.text, letterSpacing: -0.3, lineHeight: 1.4, fontFamily: FONT }}>
                    {event.title}
                </div>
                <button
                    onClick={onClose}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: TOK.text2, display: "flex", alignItems: "center", flexShrink: 0 }}
                >
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                </button>
            </div>

            {/* 본문 */}
            <div style={{ padding: "14px 20px 20px", fontFamily: FONT }}>
                {/* 일정 */}
                <div style={{ marginBottom: 12 }}>
                    <SectionLabel>일정</SectionLabel>
                    <div style={{ fontSize: 13.5, color: TOK.text, fontFamily: FONT }}>
                        {event.start ? moment(event.start).format("YYYY.MM.DD") : "—"}
                        {event.end && event.end !== event.start ? ` ~ ${moment(event.end).format("YYYY.MM.DD")}` : ""}
                    </div>
                </div>

                {/* 우선순위 */}
                {priority && (
                    <div style={{ marginBottom: 12 }}>
                        <SectionLabel>우선순위</SectionLabel>
                        <span style={{
                            fontSize: 12.5, fontWeight: 700, color: priorityHex,
                            background: priority ? softOn(theme, priorityHex) : "transparent",
                            padding: "3px 10px", borderRadius: "var(--plando-radius-pill)", fontFamily: FONT,
                        }}>
                            {PRIORITY_LABEL[priority] ?? priority}
                        </span>
                    </div>
                )}

                {/* 상태 */}
                {event.status && (
                    <div style={{ marginBottom: 12 }}>
                        <SectionLabel>상태</SectionLabel>
                        <StatusChip status={event.status} />
                    </div>
                )}

                {/* 참여자 */}
                {event.assignees?.length > 0 && (
                    <div>
                        <SectionLabel marginBottom={8}>담당자</SectionLabel>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {event.assignees.map((user) => (
                                <div key={user.email} style={{
                                    display: "flex", alignItems: "center", gap: 8,
                                    padding: "7px 10px",
                                    background: TOK.surface, borderRadius: "var(--plando-radius-sm)",
                                }}>
                                    <div style={{
                                        width: 26, height: 26,
                                        borderRadius: "var(--plando-radius-pill)",
                                        background: TOK.text3, display: "grid", placeItems: "center",
                                        fontSize: 11, fontWeight: 700, color: TOK.text, flexShrink: 0,
                                    }}>
                                        {user.name?.[0] ?? "?"}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: TOK.text, fontFamily: FONT }}>{user.name}</div>
                                        <div style={{ fontSize: 11.5, color: TOK.text2, fontFamily: FONT }}>{user.email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 닫기 버튼 */}
            <div style={{ borderTop: `1px solid ${TOK.sep}` }}>
                <button
                    onClick={onClose}
                    style={{
                        width: "100%", padding: "14px", background: "none", border: "none",
                        fontSize: 15, fontWeight: 700, color: TOK.text2,
                        cursor: "pointer", fontFamily: FONT,
                    }}
                >
                    닫기
                </button>
            </div>
        </Dialog>
    );
}

function SectionLabel({ children, marginBottom = 5 }) {
    return (
        <div style={{
            fontSize: 11, fontWeight: 700, color: TOK.text3,
            letterSpacing: 0.4, textTransform: "uppercase",
            marginBottom, fontFamily: FONT,
        }}>
            {children}
        </div>
    );
}
