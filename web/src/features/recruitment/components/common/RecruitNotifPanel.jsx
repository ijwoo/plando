import React, { useCallback, useEffect, useState } from "react";
import { Popover } from "@mui/material";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useNavigate } from "react-router-dom";
import { blurSx } from "../../../../shared/ui/glassSx.js";
import { formatNotificationTime } from "../../../../shared/utils/formatters.js";
import {
    fetchRecruitmentNotifications,
    fetchRecruitmentUnreadCount,
    markAllRecruitmentNotificationsAsRead,
    markNotificationAsRead,
} from "../../../notification/api/notificationsApi.js";

const F = "-apple-system,'Noto Sans KR',BlinkMacSystemFont,sans-serif";

const TYPE_LABEL = {
    RECRUITMENT_ACCEPTED:         "수락",
    RECRUITMENT_REJECTED:         "거절",
    RECRUITMENT_APPLIED:          "새 신청",
    RECRUITMENT_QUESTION_RECEIVED:"새 질문",
    RECRUITMENT_QUESTION_ANSWERED:"답변 도착",
};

/** 알림 타입 → 상세 모달 진입 시 자동으로 열 탭 (없으면 기본 0번 탭) */
const TYPE_TO_TAB = {
    RECRUITMENT_QUESTION_RECEIVED: "qa",
    RECRUITMENT_QUESTION_ANSWERED: "qa",
};

export default function RecruitNotifPanel({ anchorEl, onClose, isDark, onUnreadCount }) {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchRecruitmentUnreadCount()
            .then((res) => onUnreadCount?.(res.data?.unreadCount ?? 0))
            .catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const tok = isDark ? {
        bg: "rgba(19,19,23,0.98)", border: "rgba(255,255,255,0.12)",
        sep: "rgba(255,255,255,0.07)", text: "rgba(255,255,255,0.92)",
        text2: "rgba(255,255,255,0.50)", text3: "rgba(255,255,255,0.28)",
        unread: "rgba(91,141,239,0.12)", hover: "rgba(255,255,255,0.05)",
        dot: "#5B8DEF", badge: "rgba(91,141,239,0.20)", badgeText: "#5B8DEF",
        btn: "rgba(255,255,255,0.08)",
        accepted: "#34d399", rejected: "#f87171",
    } : {
        bg: "rgba(248,248,252,0.98)", border: "rgba(60,60,67,0.16)",
        sep: "rgba(0,0,0,0.06)", text: "rgba(0,0,0,0.88)",
        text2: "rgba(0,0,0,0.50)", text3: "rgba(0,0,0,0.28)",
        unread: "rgba(37,99,235,0.07)", hover: "rgba(0,0,0,0.04)",
        dot: "#2563EB", badge: "rgba(37,99,235,0.12)", badgeText: "#2563EB",
        btn: "rgba(0,0,0,0.06)",
        accepted: "#059669", rejected: "#dc2626",
    };

    const load = useCallback(async () => {
        if (!anchorEl) return;
        setLoading(true);
        try {
            const res = await fetchRecruitmentNotifications();
            setItems(res.data ?? []);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [anchorEl]);

    useEffect(() => { load(); }, [load]);

    const unreadCount = items.filter((n) => !n.read).length;

    const handleReadAll = async () => {
        try {
            await markAllRecruitmentNotificationsAsRead();
            setItems((prev) => prev.map((n) => ({ ...n, read: true })));
            onUnreadCount?.(0);
        } catch {
            // silent
        }
    };

    const handleClickItem = async (item) => {
        if (!item.read) {
            try {
                await markNotificationAsRead(item.id);
                setItems((prev) => {
                    const next = prev.map((n) => n.id === item.id ? { ...n, read: true } : n);
                    onUnreadCount?.(next.filter((n) => !n.read).length);
                    return next;
                });
            } catch {
                // silent
            }
        }
        onClose();
        if (item.targetId) {
            // Q&A 관련 알림은 상세 모달의 Q&A 탭으로 자동 진입
            const tab = TYPE_TO_TAB[item.type];
            const tabQuery = tab ? `&tab=${tab}` : "";
            navigate(`/recruitments/?detail=${item.targetId}${tabQuery}`);
        }
    };

    const typeColor = (type) => {
        if (type === "RECRUITMENT_ACCEPTED")          return tok.accepted;
        if (type === "RECRUITMENT_QUESTION_ANSWERED") return tok.accepted;
        if (type === "RECRUITMENT_APPLIED")           return tok.dot;
        if (type === "RECRUITMENT_QUESTION_RECEIVED") return tok.dot;
        return tok.rejected;
    };

    return (
        <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            PaperProps={{
                sx: {
                    mt: 1,
                    boxShadow: "none",
                    backgroundColor: "transparent",
                    overflow: "visible",
                },
            }}
        >
            <div style={{
                width: 340,
                maxWidth: "calc(100vw - 24px)",
                background: tok.bg,
                ...blurSx("blur(40px)"),
                border: `1px solid ${tok.border}`,
                borderRadius: 20,
                boxShadow: "0 16px 48px rgba(0,0,0,0.28)",
                overflow: "hidden",
                fontFamily: F,
            }}>
                {/* 헤더 */}
                <div style={{
                    padding: "14px 16px 12px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    borderBottom: `1px solid ${tok.sep}`,
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: tok.text, letterSpacing: -0.3, fontFamily: F }}>
                            팀 모집 알림
                        </span>
                        {unreadCount > 0 ? (
                            <span style={{
                                fontSize: 11, fontWeight: 700, color: tok.badgeText,
                                background: tok.badge, borderRadius: 999, padding: "2px 8px", fontFamily: F,
                            }}>
                                {unreadCount}개 안 읽음
                            </span>
                        ) : (
                            <span style={{
                                fontSize: 11, fontWeight: 600, color: tok.text3,
                                background: tok.btn, borderRadius: 999, padding: "2px 8px", fontFamily: F,
                            }}>
                                모두 읽음
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: tok.text2, display: "flex", alignItems: "center" }}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 18 }} />
                    </button>
                </div>

                {/* 모두 읽음 바 */}
                <div style={{
                    padding: "8px 16px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    borderBottom: `1px solid ${tok.sep}`,
                }}>
                    <span style={{ fontSize: 12, color: tok.text2, fontFamily: F }}>지원 결과를 확인하세요</span>
                    {unreadCount > 0 && (
                        <button
                            onClick={handleReadAll}
                            style={{
                                background: "none", border: "none", cursor: "pointer",
                                fontSize: 12, fontWeight: 700, color: tok.dot,
                                fontFamily: F, padding: "4px 8px", borderRadius: 8,
                            }}
                        >
                            모두 읽음
                        </button>
                    )}
                </div>

                {/* 목록 */}
                {loading ? (
                    <div style={{ padding: "32px 16px", textAlign: "center" }}>
                        <span style={{ fontSize: 13, color: tok.text2, fontFamily: F }}>불러오는 중...</span>
                    </div>
                ) : items.length === 0 ? (
                    <div style={{ padding: "40px 16px", textAlign: "center" }}>
                        <NotificationsNoneRoundedIcon sx={{ fontSize: 32, color: tok.text3, marginBottom: "8px" }} />
                        <div style={{ fontSize: 14, fontWeight: 700, color: tok.text, marginBottom: 4, fontFamily: F }}>
                            모집 알림이 없어요
                        </div>
                        <div style={{ fontSize: 12.5, color: tok.text2, lineHeight: 1.5, fontFamily: F }}>
                            지원 수락·거절 알림이 여기에 표시돼요.
                        </div>
                    </div>
                ) : (
                    <div style={{ maxHeight: 400, overflowY: "auto" }}>
                        {items.map((item, idx) => (
                            <div
                                key={item.id}
                                onClick={() => handleClickItem(item)}
                                style={{
                                    padding: "12px 16px",
                                    background: item.read ? "transparent" : tok.unread,
                                    borderBottom: idx < items.length - 1 ? `1px solid ${tok.sep}` : "none",
                                    cursor: "pointer",
                                    transition: "background 0.15s",
                                }}
                                onMouseEnter={(e) => { if (item.read) e.currentTarget.style.background = tok.hover; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = item.read ? "transparent" : tok.unread; }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{
                                            fontSize: 10.5, fontWeight: 700,
                                            color: typeColor(item.type),
                                            background: `${typeColor(item.type)}18`,
                                            borderRadius: 999, padding: "2px 7px",
                                            fontFamily: F, flexShrink: 0,
                                        }}>
                                            {TYPE_LABEL[item.type] ?? item.type}
                                        </span>
                                        <span style={{
                                            fontSize: 13, fontWeight: item.read ? 600 : 800,
                                            color: tok.text, fontFamily: F,
                                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                            maxWidth: 180,
                                        }}>
                                            {item.title}
                                        </span>
                                    </div>
                                    {!item.read && (
                                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: tok.dot, flexShrink: 0, marginTop: 3 }} />
                                    )}
                                </div>
                                <div style={{
                                    fontSize: 12.5, color: tok.text2, lineHeight: 1.5, marginBottom: 4, fontFamily: F,
                                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                                }}>
                                    {item.message}
                                </div>
                                <div style={{ fontSize: 11.5, color: tok.text3, fontFamily: F }}>
                                    {formatNotificationTime(item.createdAt)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Popover>
    );
}
