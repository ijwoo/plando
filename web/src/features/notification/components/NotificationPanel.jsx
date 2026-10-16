import React from "react";
import { CircularProgress } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { blurSx } from "../../../shared/ui/glassSx.js";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AccessAlarmRoundedIcon from "@mui/icons-material/AccessAlarmRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import AlternateEmailRoundedIcon from "@mui/icons-material/AlternateEmailRounded";
import SmsRoundedIcon from "@mui/icons-material/SmsRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import { formatNotificationTime } from "../../../shared/utils/formatters.js";
import { markNotificationAsRead } from "../api/notificationsApi.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { toast } from "../../../shared/utils/toast.js";

const F = "-apple-system,'Noto Sans KR',BlinkMacSystemFont,sans-serif";

/** 알림 타입 → 아이콘·틴트 색 (백엔드 타입이 느슨해 키워드로 매칭 — 네이티브 typeMeta 미러) */
function typeMeta(type) {
    const t = (type || "").toUpperCase();
    if (t.includes("DM")) return { Icon: SmsRoundedIcon, color: "#3D7BFF" };
    if (t.includes("MENTION")) return { Icon: AlternateEmailRoundedIcon, color: "#7C5CF0" };
    if (t.includes("COMMENT")) return { Icon: ChatBubbleOutlineRoundedIcon, color: "#0EA5E9" };
    if (t.includes("ASSIGN")) return { Icon: PersonAddAltRoundedIcon, color: "#10B981" };
    if (t.includes("DUE") || t.includes("REMIND")) return { Icon: AccessAlarmRoundedIcon, color: "#F59E0B" };
    if (t.includes("RECRUIT")) return { Icon: GroupsRoundedIcon, color: "#F59E0B" };
    return { Icon: NotificationsNoneRoundedIcon, color: "#94A3B8" };
}

/**
 * 섹션 라벨 / 알림 행 — 모듈 스코프에 둔다.
 * 렌더 함수 안에서 정의하면 렌더마다 컴포넌트 타입이 바뀌어 목록 전체가 재마운트된다.
 */
function SectionLabel({ tok, children }) {
    return (
        <div style={{ padding: "10px 16px 4px", fontSize: 11.5, fontWeight: 800, color: tok.text3, letterSpacing: 0.3, fontFamily: F }}>
            {children}
        </div>
    );
}

function Row({ item, last, tok, onClick }) {
    const { Icon, color } = typeMeta(item.type);
    return (
        <div
            onClick={() => onClick(item)}
            style={{
                padding: "12px 16px",
                display: "flex",
                gap: 11,
                alignItems: "flex-start",
                background: item.read ? "transparent" : tok.unread,
                ...(!last ? { backgroundImage: `linear-gradient(to right, transparent, ${tok.sep} 15%, ${tok.sep} 85%, transparent)`, backgroundSize: "100% 1px", backgroundRepeat: "no-repeat", backgroundPosition: "bottom" } : {}),
                cursor: "pointer",
                transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { if (item.read) e.currentTarget.style.background = tok.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = item.read ? "transparent" : tok.unread; }}
        >
            {/* 타입 아이콘 — 틴트만(뱃지 박스 없이) */}
            <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}1F` }}>
                <Icon sx={{ fontSize: 18, color }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
                    <span style={{
                        fontSize: 13.5, fontWeight: item.read ? 600 : 800,
                        color: tok.text, flex: 1, paddingRight: 8, fontFamily: F,
                        display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                        {item.title}
                    </span>
                    {!item.read && (
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: tok.dot, flexShrink: 0, marginTop: 4 }} />
                    )}
                </div>
                {item.senderName && (
                    <div style={{ fontSize: 11.5, color: tok.dot, fontWeight: 700, marginBottom: 2, fontFamily: F }}>
                        {item.senderName}
                    </div>
                )}
                <div style={{
                    fontSize: 12.5, color: tok.text2, lineHeight: 1.5, marginBottom: 5, fontFamily: F,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                    {item.message}
                </div>
                <div style={{ fontSize: 11.5, color: tok.text3, fontFamily: F }}>{formatNotificationTime(item.createdAt)}</div>
            </div>
        </div>
    );
}

export default function NotificationPanel({ notifications = [], loading = false, onClose, onReadAll, onClickItem, fullScreen = false }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const tok = isDark ? {
        bg:      "rgba(19,19,23,0.98)",
        border:  "rgba(255,255,255,0.12)",
        sep:     "rgba(255,255,255,0.07)",
        text:    "rgba(255,255,255,0.92)",
        text2:   "rgba(255,255,255,0.50)",
        text3:   "rgba(255,255,255,0.28)",
        unread:  "rgba(91,141,239,0.12)",
        hover:   "rgba(255,255,255,0.05)",
        dot:     "#5B8DEF",
        badge:   "rgba(91,141,239,0.20)",
        badgeText: "#5B8DEF",
        btn:     "rgba(255,255,255,0.08)",
    } : {
        bg:      "rgba(248,248,252,0.98)",
        border:  "rgba(60,60,67,0.16)",
        sep:     "rgba(0,0,0,0.06)",
        text:    "rgba(0,0,0,0.88)",
        text2:   "rgba(0,0,0,0.50)",
        text3:   "rgba(0,0,0,0.28)",
        unread:  "rgba(37,99,235,0.07)",
        hover:   "rgba(0,0,0,0.04)",
        dot:     "#2563EB",
        badge:   "rgba(37,99,235,0.12)",
        badgeText: "#2563EB",
        btn:     "rgba(0,0,0,0.06)",
    };

    // 패널을 먼저 열고 조회하므로, 첫 조회 중에는 빈 상태 대신 스피너를 보여준다(빈 상태 깜빡임 방지)
    const initialLoading = loading && notifications.length === 0;

    const unreadCount = notifications.filter((n) => !n.read).length;
    const unreadItems = notifications.filter((n) => !n.read);
    const readItems = notifications.filter((n) => n.read);

    const handleClick = (item) => {
        if (!item.read) {
            // 읽음 PATCH가 서버에 반영된 "뒤에" 알린다.
            // 예전엔 요청과 동시에 dispatch해서, Navbar가 아직 갱신 안 된 unread-count를
            // 다시 읽어와 뱃지가 이전 숫자로 되돌아갔다(10초 폴링이 뒤늦게 고쳐서 깜빡임처럼 보임).
            markNotificationAsRead(item.id)
                .then(() => window.dispatchEvent(new Event(APP_EVENTS.NOTIFICATIONS_CHANGED)))
                .catch(() => {
                    // 실패를 삼키면 읽음 표시만 사라진 채 다음 조회 때 되살아난다 — 이유를 알린다.
                    toast.error("알림을 읽음 처리하지 못했어요.");
                    window.dispatchEvent(new Event(APP_EVENTS.NOTIFICATIONS_CHANGED));
                });
        }
        onClickItem?.(item);
    };

    return (
        <div style={fullScreen ? {
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            paddingTop: "env(safe-area-inset-top, 0px)",
            background: tok.bg,
            overflow: "hidden",
            fontFamily: F,
        } : {
            width: 360,
            maxWidth: "calc(100vw - 24px)",
            background: tok.bg,
            ...blurSx("blur(40px)"),
            borderRadius: 20,
            boxShadow: "var(--plando-elev-3)",
            overflow: "hidden",
            fontFamily: F,
        }}>
            {/* 헤더 */}
            <div style={{
                padding: fullScreen ? "10px 16px 12px 8px" : "14px 16px 12px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0,
                backgroundImage: `linear-gradient(to right, transparent, ${tok.sep} 15%, ${tok.sep} 85%, transparent)`, backgroundSize: "100% 1px", backgroundRepeat: "no-repeat", backgroundPosition: "bottom",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {fullScreen && (
                        <button
                            onClick={onClose}
                            aria-label="뒤로"
                            style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 8px", color: tok.text2, display: "flex", alignItems: "center" }}
                        >
                            <ArrowBackIosNewRoundedIcon sx={{ fontSize: 18 }} />
                        </button>
                    )}
                    <span style={{ fontSize: 15, fontWeight: 800, color: tok.text, letterSpacing: -0.3, fontFamily: F }}>알림</span>
                    {unreadCount > 0 ? (
                        <span style={{
                            fontSize: 11, fontWeight: 700, color: tok.badgeText,
                            background: tok.badge, borderRadius: 999, padding: "2px 8px", fontFamily: F,
                        }}>
                            {unreadCount}개 안 읽음
                        </span>
                    ) : initialLoading ? null : (
                        <span style={{
                            fontSize: 11, fontWeight: 600, color: tok.text3,
                            background: tok.btn, borderRadius: 999, padding: "2px 8px", fontFamily: F,
                        }}>
                            모두 읽음
                        </span>
                    )}
                </div>
                {fullScreen ? (
                    // 안 읽은 게 있을 때만 액션 노출 — 상태 배지 "모두 읽음"과 중복 방지
                    unreadCount > 0 ? (
                        <button
                            onClick={onReadAll}
                            style={{
                                background: "none", border: "none", cursor: "pointer",
                                fontSize: 13, fontWeight: 700, color: tok.dot,
                                fontFamily: F, padding: "6px 4px",
                            }}
                        >
                            모두 읽음
                        </button>
                    ) : null
                ) : (
                    <button
                        onClick={onClose}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: tok.text2, display: "flex", alignItems: "center" }}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 18 }} />
                    </button>
                )}
            </div>

            {/* 모두 읽음 바 — 풀스크린은 헤더 우측으로 흡수 */}
            {!fullScreen && <div style={{
                padding: "8px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                backgroundImage: `linear-gradient(to right, transparent, ${tok.sep} 15%, ${tok.sep} 85%, transparent)`, backgroundSize: "100% 1px", backgroundRepeat: "no-repeat", backgroundPosition: "bottom",
            }}>
                <span style={{ fontSize: 12, color: tok.text2, fontFamily: F }}>최근 알림을 확인하세요</span>
                {unreadCount > 0 && (
                    <button
                        onClick={onReadAll}
                        style={{
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: 12, fontWeight: 700, color: tok.dot,
                            fontFamily: F, padding: "4px 8px", borderRadius: 8,
                        }}
                    >
                        모두 읽음
                    </button>
                )}
            </div>}

            {/* 알림 목록 */}
            {initialLoading ? (
                <div style={{ padding: fullScreen ? "30vh 16px 0" : "40px 16px", display: "flex", justifyContent: "center" }}>
                    <CircularProgress size={22} sx={{ color: tok.dot }} />
                </div>
            ) : notifications.length === 0 ? (
                <div style={{ padding: fullScreen ? "30vh 16px 0" : "40px 16px", textAlign: "center" }}>
                    <NotificationsNoneRoundedIcon sx={{ fontSize: 32, color: tok.text3, marginBottom: "8px" }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: tok.text, marginBottom: 4, fontFamily: F }}>새 알림이 없어요</div>
                    <div style={{ fontSize: 12.5, color: tok.text2, lineHeight: 1.5, fontFamily: F }}>
                        작업 배정, 상태 변경, 마감 알림이 여기에 표시돼요.
                    </div>
                </div>
            ) : (
                <div style={fullScreen ? { flex: 1, overflowY: "auto", paddingBottom: "env(safe-area-inset-bottom, 0px)" } : { maxHeight: 420, overflowY: "auto" }}>
                    {/* 안 읽음 섹션 */}
                    {unreadItems.length > 0 && (
                        <>
                            <SectionLabel tok={tok}>안 읽음</SectionLabel>
                            {unreadItems.map((item, idx) => (
                                <Row key={item.id} item={item} tok={tok} onClick={handleClick} last={idx === unreadItems.length - 1 && readItems.length === 0} />
                            ))}
                        </>
                    )}
                    {/* 읽음 섹션 */}
                    {readItems.length > 0 && (
                        <>
                            {unreadItems.length > 0 && <SectionLabel tok={tok}>읽음</SectionLabel>}
                            {readItems.map((item, idx) => (
                                <Row key={item.id} item={item} tok={tok} onClick={handleClick} last={idx === readItems.length - 1} />
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
