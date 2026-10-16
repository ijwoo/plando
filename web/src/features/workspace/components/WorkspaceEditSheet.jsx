import React, { useCallback, useEffect, useRef, useState } from "react";
import { blurSx } from "../../../shared/ui/glassSx.js";
import { createPortal } from "react-dom";
import { alpha, useTheme } from "@mui/material/styles";
import { Avatar, Dialog, DialogContent, useMediaQuery } from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import ExitToAppRounded from "@mui/icons-material/ExitToAppRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import CameraAltRounded from "@mui/icons-material/CameraAltRounded";

import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { updateWorkspace, uploadWorkspaceIcon } from "../api/workspaceApi.js";
import { getWorkspaceMembers, changeMemberRole, removeMember } from "../api/workspaceMemberApi.js";
import { useWorkspacePermissions, ROLE_LABEL } from "../hooks/useWorkspacePermissions.js";
import { toast } from "../../../shared/utils/toast.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { resolveImageUrl } from "../../../shared/utils/urlUtils.js";
import { getUser } from "../../../shared/utils/tokenUtils.js";
import { copyToClipboard } from "../utils/clipboard.js";
import ConfirmDialog from "../../../shared/ui/common/ConfirmDialog.jsx";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import TransferOwnerDialog from "./TransferOwnerDialog.jsx";
import { useWorkspaceActions } from "../hooks/useWorkspaceActions.js";
import { Z } from "../../../shared/ui/zIndex.js";
import EmptyState from "../../../shared/ui/common/EmptyState.jsx";

// ── Tokens ────────────────────────────────────────────────────────
/**
 * MUI theme palette + alpha 기반 토큰.
 * 이전: 자체 #2563EB / #5B8DEF 하드코딩 (테마 변경 무시).
 * 이후: theme.palette 사용 — accent 변경 시 컴포넌트도 따라감.
 *
 * 단, blue/purple/teal/amber/violet은 "워크스페이스 아이콘 색상 옵션"으로
 * 의미적으로 고정값(사용자가 워크스페이스 아이콘 색을 직접 선택) → 유지.
 */
function buildTokens(theme) {
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;
    const error = theme.palette.error.main;
    const success = theme.palette.success.main;
    return {
        // 표면 / 텍스트
        sheet:      theme.palette.background.paper,
        dialogBg:   theme.palette.background.paper,
        ovBg:       isDark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.30)",
        surface:    isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.04)",
        surfaceMd:  isDark ? "rgba(255,255,255,0.08)"  : "rgba(0,0,0,0.06)",
        text:       theme.palette.text.primary,
        text2:      theme.palette.text.secondary,
        text3:      theme.palette.text.disabled,
        sep:        theme.palette.divider,
        border:     isDark ? "rgba(255,255,255,0.08)" : "rgba(60,60,67,0.12)",
        borderHi:   isDark ? "rgba(255,255,255,0.14)" : "rgba(60,60,67,0.18)",
        handle:     isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.18)",

        // Theme primary (accent 따라감)
        primary,
        primaryDim: alpha(primary, isDark ? 0.18 : 0.10),

        // 상태 색
        red:        error,
        redDim:     alpha(error, isDark ? 0.10 : 0.07),
        redBorder:  alpha(error, isDark ? 0.22 : 0.18),
        green:      success,

        // 워크스페이스 아이콘 색 옵션 (UI 선택지로 노출 — semantic하게 고정)
        blue:       isDark ? "#3B82F6" : "#2563EB",
        purple:     isDark ? "#8B5CF6" : "#7C3AED",
        teal:       isDark ? "#10B981" : "#059669",
        amber:      isDark ? "#F59E0B" : "#D97706",
        violet:     isDark ? "#7C3AED" : "#6D28D9",

        // 입력 필드
        inputBg:    isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)",
        inputBorder:isDark ? "rgba(255,255,255,0.12)" : "rgba(60,60,67,0.16)",
    };
}

// ── Sub-components ────────────────────────────────────────────────
function IconBox({ color, children }) {
    return (
        <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: color, display: "flex",
            alignItems: "center", justifyContent: "center",
            flexShrink: 0, color: "#fff",
        }}>
            {children}
        </div>
    );
}

function MenuRow({ iconBg, icon, title, desc, right, noBorder, t, onClick, chevronRotated }) {
    return (
        <div
            onClick={onClick}
            style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 16px",
                ...(noBorder ? {} : { backgroundImage: `linear-gradient(to right, transparent, ${t.sep} 15%, ${t.sep} 85%, transparent)`, backgroundSize: "100% 1px", backgroundRepeat: "no-repeat", backgroundPosition: "bottom" }),
                cursor: onClick ? "pointer" : "default",
                WebkitTapHighlightColor: "transparent",
            }}
        >
            <IconBox color={iconBg}>{icon}</IconBox>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{title}</div>
                {desc && <div style={{ fontSize: 11.5, color: t.text2, marginTop: 1 }}>{desc}</div>}
            </div>
            {right !== undefined ? right : onClick ? (
                <ChevronRightRounded sx={{ fontSize: 16, color: t.text3, transition: "transform 0.2s", transform: chevronRotated ? "rotate(90deg)" : "none" }} />
            ) : null}
        </div>
    );
}

function DangerRow({ icon, title, desc, badge, noBorder, t, onClick }) {
    return (
        <div
            onClick={onClick}
            style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 16px",
                ...(noBorder ? {} : { backgroundImage: `linear-gradient(to right, transparent, ${t.sep} 15%, ${t.sep} 85%, transparent)`, backgroundSize: "100% 1px", backgroundRepeat: "no-repeat", backgroundPosition: "bottom" }),
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
            }}
        >
            <IconBox color={`${t.red}30`}>{icon}</IconBox>
            <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: t.red }}>{title}</span>
                    {badge && (
                        <span style={{
                            background: `${t.red}22`, color: t.red,
                            borderRadius: 100, padding: "1px 7px",
                            fontSize: 10.5, fontWeight: 700,
                        }}>{badge}</span>
                    )}
                </div>
                {desc && <div style={{ fontSize: 11.5, color: t.text2, marginTop: 1 }}>{desc}</div>}
            </div>
            <ChevronRightRounded sx={{ fontSize: 16, color: t.text3 }} />
        </div>
    );
}

// ── Shared inner content ──────────────────────────────────────────
function EditContent({ t, ws, isOwner, canManageWs, inviteCode, members, perms, myUserId, onChangeMemberRole, onKickMember, editingName, nameValue, nameSaving, copied, confirm, iconUploading, errorMsg, onErrorClear, onClose, onStartEditName, onNameChange, onSaveName, onCancelEdit, onCopy, onConfirmSet, onLeaveClick, onDeleteCheck, onLeave, onDelete, onIconClick, fileInputRef }) {
    const f = "-apple-system,'Noto Sans KR',BlinkMacSystemFont,sans-serif";
    const [membersOpen, setMembersOpen] = useState(false);
    const [menuFor, setMenuFor] = useState(null); // 역할 관리 메뉴가 열린 멤버 userId
    const [kickTarget, setKickTarget] = useState(null); // 내보내기 확인 대상 멤버

    return (
        <>
            {/* workspace profile */}
            <div style={{ padding: "0 20px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {/* 아바타 — 관리자만 클릭하면 이미지 업로드 */}
                    <div
                        onClick={canManageWs ? onIconClick : undefined}
                        style={{ position: "relative", flexShrink: 0, cursor: canManageWs ? "pointer" : "default" }}
                    >
                        {ws.iconImageUrl ? (
                            <img
                                src={resolveImageUrl(ws.iconImageUrl)}
                                alt="workspace icon"
                                loading="lazy"
                                style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", display: "block" }}
                            />
                        ) : (
                            <div style={{ width: 60, height: 60, borderRadius: "50%", background: t.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, color: "#fff" }}>
                                {ws.workspaceName?.charAt(0)?.toUpperCase() || "W"}
                            </div>
                        )}
                        {canManageWs && (
                            <div style={{
                                position: "absolute", bottom: -3, right: -3,
                                width: 22, height: 22, borderRadius: "50%",
                                background: iconUploading ? t.primary : t.surfaceMd,
                                border: `1.5px solid ${t.borderHi}`,
                                display: "flex", alignItems: "center", justifyContent: "center", color: iconUploading ? "#fff" : t.text2,
                            }}>
                                <CameraAltRounded sx={{ fontSize: 12 }} />
                            </div>
                        )}
                        {canManageWs && <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                            <span style={{ fontSize: 16, fontWeight: 800, color: t.text, letterSpacing: -0.3 }}>{ws.workspaceName}</span>
                            <span style={{ background: t.primaryDim, color: t.primary, borderRadius: 100, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                                {ROLE_LABEL[ws.role] ?? ws.role ?? "멤버"}
                            </span>
                        </div>
                        {inviteCode && (
                            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: t.text3, letterSpacing: 0.3, fontFamily: f }}>초대코드</span>
                                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: t.text2, letterSpacing: 1 }}>{inviteCode}</span>
                                <button onClick={onCopy} style={{ display: "flex", alignItems: "center", gap: 4, background: copied ? `${t.green}22` : t.surfaceMd, border: `1px solid ${copied ? t.green + "44" : t.border}`, borderRadius: 8, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, color: copied ? t.green : t.text2, cursor: "pointer", fontFamily: f, transition: "all 0.18s" }}>
                                    {copied ? <CheckRounded sx={{ fontSize: 12 }} /> : <ContentCopyRounded sx={{ fontSize: 12 }} />}
                                    {copied ? "복사됨" : "복사"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* name edit inline */}
            {editingName && (
                <div style={{ margin: "0 16px 12px", padding: "12px 16px", background: t.surface, borderRadius: 14, boxShadow: "var(--plando-elev-1)" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text2, marginBottom: 7 }}>새 이름</div>
                    <input
                        autoFocus
                        value={nameValue}
                        onChange={(e) => onNameChange(e.target.value)}
                        onKeyDown={(e) => {
                            // IME 조합 중 Enter 무시 — 한글 이름 마지막 글자 유실/중복 저장 방지
                            if (e.key === "Enter" && !(e.nativeEvent?.isComposing || e.keyCode === 229)) onSaveName();
                            if (e.key === "Escape") onCancelEdit();
                        }}
                        style={{ width: "100%", padding: "9px 12px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 9, fontSize: 14, fontWeight: 600, color: t.text, fontFamily: f, outline: "none", boxSizing: "border-box" }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                        <button onClick={onCancelEdit} style={{ flex: 1, padding: "9px", background: t.surfaceMd, border: `1px solid ${t.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, color: t.text2, cursor: "pointer", fontFamily: f }}>취소</button>
                        <button onClick={onSaveName} disabled={nameSaving} style={{ flex: 1, padding: "9px", background: t.primary, border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: f, opacity: nameSaving ? 0.7 : 1 }}>
                            {nameSaving ? "저장 중..." : "저장"}
                        </button>
                    </div>
                </div>
            )}

            {/* menu section */}
            <div style={{ margin: "0 16px 12px", background: t.surface, borderRadius: 16, overflow: "hidden", boxShadow: "var(--plando-elev-1)" }}>
                {canManageWs && (
                    <MenuRow t={t} iconBg={t.blue} icon={<EditRounded sx={{ fontSize: 15 }} />}
                        title="이름 변경" desc={null} onClick={onStartEditName}
                    />
                )}
                <MenuRow t={t} iconBg={t.teal} icon={<PeopleAltRounded sx={{ fontSize: 15 }} />}
                    title="멤버 관리"
                    desc={null}
                    right={
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {members.length > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: t.text2 }}>{members.length}명</span>}
                            <ChevronRightRounded sx={{ fontSize: 16, color: t.text3, transition: "transform 0.2s", transform: membersOpen ? "rotate(90deg)" : "none" }} />
                        </div>
                    }
                    noBorder
                    onClick={() => setMembersOpen((v) => !v)}
                />
                {/* 멤버 드롭다운 */}
                {/* 멤버 0명일 때 예전엔 아무것도 안 나와 "고장"으로 읽혔다 */}
                {membersOpen && members.length === 0 && (
                    <EmptyState
                        emoji="👥"
                        title="아직 멤버가 없어요"
                        desc="초대 코드를 공유하면 팀원이 참여할 수 있어요."
                        size="sm"
                    />
                )}
                {membersOpen && members.length > 0 && (
                    <div style={{ backgroundImage: `linear-gradient(to right, transparent, ${t.sep} 15%, ${t.sep} 85%, transparent)`, backgroundSize: "100% 1px", backgroundRepeat: "no-repeat", backgroundPosition: "top" }}>
                        {members.map((m, i) => {
                            const canManage = perms?.canManageMembers && perms.canManageMember(m.role) && m.userId !== myUserId;
                            return (
                            <div key={m.userId || m.id || i} style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", ...(i < members.length - 1 ? { backgroundImage: `linear-gradient(to right, transparent, ${t.sep} 15%, ${t.sep} 85%, transparent)`, backgroundSize: "100% 1px", backgroundRepeat: "no-repeat", backgroundPosition: "bottom" } : {}), background: t.surfaceMd }}>
                                <Avatar src={m.profileImageUrl ? resolveImageUrl(m.profileImageUrl) : undefined} sx={{ width: 28, height: 28, fontSize: 12 }}>
                                    {(m.name || m.nickname || "?")[0]}
                                </Avatar>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{m.name || m.nickname || m.email}</div>
                                    <div style={{ fontSize: 11, color: t.text2 }}>{m.email}</div>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: m.role === "OWNER" ? t.blue : t.text2, background: m.role === "OWNER" ? `${t.blue}1A` : t.surface, padding: "2px 8px", borderRadius: 999, flexShrink: 0 }}>
                                    {ROLE_LABEL[m.role] ?? m.role}
                                </span>
                                {canManage && (
                                    <button onClick={() => setMenuFor(menuFor === m.userId ? null : m.userId)} style={{ background: "none", border: "none", cursor: "pointer", color: t.text3, fontSize: 18, lineHeight: 1, padding: "2px 4px", flexShrink: 0 }}>⋯</button>
                                )}
                                {canManage && menuFor === m.userId && (
                                    <div style={{ position: "absolute", right: 12, top: 42, zIndex: 5, background: t.surface, borderRadius: 12, boxShadow: "var(--plando-elev-2)", overflow: "hidden", minWidth: 148 }}>
                                        {["ADMIN", "MEMBER", "VIEWER"].filter((r) => r !== m.role).map((r) => (
                                            <div key={r} onClick={() => { setMenuFor(null); onChangeMemberRole(m.userId, r); }}
                                                style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, color: t.text, cursor: "pointer" }}>
                                                {ROLE_LABEL[r]}(으)로 변경
                                            </div>
                                        ))}
                                        <div onClick={() => { setMenuFor(null); setKickTarget(m); }}
                                            style={{ padding: "9px 14px", fontSize: 13, fontWeight: 700, color: t.red, cursor: "pointer", backgroundImage: `linear-gradient(to right, transparent, ${t.sep} 15%, ${t.sep} 85%, transparent)`, backgroundSize: "100% 1px", backgroundRepeat: "no-repeat", backgroundPosition: "top" }}>
                                            내보내기
                                        </div>
                                    </div>
                                )}
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 에러 배너 */}
            {errorMsg && (
                <div style={{
                    margin: "0 16px 12px", padding: "10px 14px",
                    background: t.redDim,
                    borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 8,
                }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: t.red, lineHeight: 1.5, fontFamily: f }}>
                        {errorMsg}
                    </div>
                    <button
                        onClick={onErrorClear}
                        style={{ background: "none", border: "none", cursor: "pointer", color: t.text3, fontSize: 16, lineHeight: 1, padding: "0 2px", flexShrink: 0 }}
                    >×</button>
                </div>
            )}

            {/* danger section */}
            <div style={{ margin: "0 16px 12px", background: t.redDim, borderRadius: 16, overflow: "hidden" }}>
                <DangerRow t={t} iconBg={`${t.red}28`} icon={<ExitToAppRounded sx={{ fontSize: 15, color: t.red }} />}
                    title="워크스페이스 나가기" desc={null}
                    onClick={onLeaveClick}
                />
                {isOwner && (
                    <DangerRow t={t} iconBg={`${t.red}28`} icon={<DeleteOutlineRounded sx={{ fontSize: 15, color: t.red }} />}
                        title="워크스페이스 삭제" desc={null} badge="관리자" noBorder
                        onClick={onDeleteCheck}
                    />
                )}
            </div>

            {/* close button */}
            <div style={{ padding: "0 16px 32px" }}>
                <button onClick={onClose} style={{ width: "100%", background: t.surfaceMd, border: `1px solid ${t.border}`, borderRadius: 14, padding: "13px", fontSize: 15, fontWeight: 600, color: t.text, cursor: "pointer", fontFamily: f }}>닫기</button>
            </div>

            {/* confirm dialogs */}
            <ConfirmDialog
                open={!!kickTarget}
                title="멤버 내보내기"
                message={`${kickTarget?.name || kickTarget?.nickname || kickTarget?.email || "이 멤버"} 님을 워크스페이스에서 내보낼까요?\n다시 참여하려면 초대 코드가 필요해요.`}
                confirmText="내보내기"
                zIndex={1600}
                onConfirm={() => { const target = kickTarget; setKickTarget(null); if (target) onKickMember(target.userId); }}
                onClose={() => setKickTarget(null)}
            />
            <ConfirmDialog
                open={confirm?.type === "leave"}
                title="워크스페이스 나가기"
                message="워크스페이스를 나가면 멤버에서 제외됩니다. 계속하시겠어요?"
                confirmText="나가기"
                zIndex={1600}
                onConfirm={onLeave}
                onClose={() => onConfirmSet(null)}
            />
            <ConfirmDialog
                open={confirm?.type === "delete"}
                title="워크스페이스 삭제"
                message={confirm?.hasRecruitments
                    ? "현재 팀 모집글이 있습니다. 워크스페이스와 모든 데이터(팀 모집글 포함)가 영구 삭제됩니다. 이 작업은 되돌릴 수 없어요."
                    : "워크스페이스와 모든 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없어요."}
                confirmText="삭제"
                zIndex={1600}
                onConfirm={onDelete}
                onClose={() => onConfirmSet(null)}
            />
        </>
    );
}

// ── Main Sheet ────────────────────────────────────────────────────
export default function WorkspaceEditSheet({ open, onClose }) {
    const theme   = useTheme();
    const isDark  = theme.palette.mode === "dark";
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const t       = buildTokens(theme);
    const { currentWorkspace, loadWorkspaces, workspaces } = useWorkspace();

    const ws         = currentWorkspace;
    const isOwner    = ws?.role === "OWNER";
    const inviteCode = ws?.inviteCode || ws?.code || "";

    const [editingName,   setEditingName]   = useState(false);
    const [nameValue,     setNameValue]     = useState("");
    const [nameSaving,    setNameSaving]    = useState(false);
    const [copied,        setCopied]        = useState(false);
    const [members,       setMembers]       = useState([]);
    const [iconUploading, setIconUploading] = useState(false);

    const {
        confirm, setConfirm,
        transferTarget, setTransferTarget,
        transferring,
        errorMsg, clearError,
        handleLeaveClick: _handleLeaveClick,
        handleDeleteClick,
        handleLeave: _handleLeave,
        handleDelete: _handleDelete,
        handleTransferAndLeave: _handleTransferAndLeave,
        reset: resetActions,
    } = useWorkspaceActions();

    // swipe (mobile only)
    const sheetRef   = useRef(null);
    const swipeStart = useRef(0);
    const swipeDelta = useRef(0);
    const fileInputRef = useRef(null);

    const reloadMembers = useCallback(() => {
        if (!ws) return;
        getWorkspaceMembers(ws.workspaceId).then((data) => setMembers(Array.isArray(data) ? data : [])).catch(() => {});
    }, [ws]);

    useEffect(() => {
        if (!open || !ws) return;
        reloadMembers();
    }, [open, ws, reloadMembers]);

    const perms = useWorkspacePermissions();
    const onChangeMemberRole = useCallback(async (userId, role) => {
        try {
            await changeMemberRole(ws.workspaceId, userId, role);
            reloadMembers();
        } catch (e) {
            toast.error(getApiError(e, "역할 변경에 실패했어요."));
        }
    }, [ws, reloadMembers]);
    const onKickMember = useCallback(async (userId) => {
        try {
            await removeMember(ws.workspaceId, userId);
            reloadMembers();
            toast.success("멤버를 내보냈어요.");
        } catch (e) {
            toast.error(getApiError(e, "멤버 내보내기에 실패했어요."));
        }
    }, [ws, reloadMembers]);

    // 시트 열릴 때 배경 스크롤 잠금
    useEffect(() => {
        if (!isMobile) return;
        if (open) {
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [open, isMobile]);

    const onSheetTouchStart = (e) => {
        swipeStart.current = e.touches[0].clientY;
        swipeDelta.current = 0;
        if (sheetRef.current) sheetRef.current.style.transition = "none";
    };
    const onSheetTouchMove = (e) => {
        const dy = e.touches[0].clientY - swipeStart.current;
        if (dy < 0) return;
        swipeDelta.current = dy;
        if (sheetRef.current) sheetRef.current.style.transform = `translateY(${dy}px)`;
    };
    const onSheetTouchEnd = () => {
        if (swipeDelta.current > 100) onClose();
        else if (sheetRef.current) {
            sheetRef.current.style.transition = "transform 0.25s ease";
            sheetRef.current.style.transform  = "translateY(0)";
        }
    };

    const handleCopy = useCallback(async () => {
        // 복사 성공을 확인한 뒤에만 "복사됨"으로 바꾼다.
        // 예전엔 navigator.clipboard?.writeText(...).catch(()=>{}) 뒤에 무조건 setCopied(true) 였다 —
        // clipboard API 가 없는 환경(비보안 컨텍스트·구형 웹뷰)에서는 호출 자체가 건너뛰어졌는데도
        // "복사됨"이라고 알려서, 붙여넣기하면 아무것도 안 나오는 상태였다.
        const ok = await copyToClipboard(inviteCode || ws?.workspaceId);
        if (!ok) {
            toast.error("초대 코드를 복사하지 못했어요. 코드를 직접 선택해 복사해 주세요.");
            return;
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    }, [inviteCode, ws]);

    const handleSaveName = useCallback(async () => {
        if (!nameValue.trim() || !ws) return;
        setNameSaving(true);
        try {
            await updateWorkspace(ws.workspaceId, { workspaceName: nameValue.trim() });
            await loadWorkspaces();
            setEditingName(false);
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "워크스페이스 이름이 변경되었습니다.", severity: "success" } }));
        } catch (e) {
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "이름 변경에 실패했습니다.", severity: "error" } }));
        } finally { setNameSaving(false); }
    }, [nameValue, ws, loadWorkspaces]);

    const handleLeaveClick  = useCallback(() => _handleLeaveClick(ws, members), [_handleLeaveClick, ws, members]);
    const handleLeave       = useCallback(() => _handleLeave(ws, onClose), [_handleLeave, ws, onClose]);
    const handleDelete      = useCallback(() => _handleDelete(ws, onClose), [_handleDelete, ws, onClose]);
    const handleDeleteCheck = useCallback(() => handleDeleteClick(ws), [handleDeleteClick, ws]);
    const handleTransferAndLeave = useCallback(() => _handleTransferAndLeave(ws, onClose), [_handleTransferAndLeave, ws, onClose]);
    const handleClose = useCallback(() => { resetActions(); onClose(); }, [resetActions, onClose]);

    const handleIconClick = useCallback(() => {
        if (fileInputRef.current) {
            fileInputRef.current.onchange = async (e) => {
                const file = e.target.files?.[0];
                if (!file || !ws) return;
                setIconUploading(true);
                try {
                    await uploadWorkspaceIcon(ws.workspaceId, file);
                    await loadWorkspaces();
                    window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "워크스페이스 아이콘이 변경되었습니다.", severity: "success" } }));
                } catch (err) {
                    window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "아이콘 변경에 실패했습니다.", severity: "error" } }));
                } finally {
                    setIconUploading(false);
                    fileInputRef.current.value = "";
                }
            };
            fileInputRef.current.click();
        }
    }, [ws, loadWorkspaces]);

    if (!open || !ws) return null;

    const f = "-apple-system,'Noto Sans KR',BlinkMacSystemFont,sans-serif";
    const currentUser = getUser();

    const contentProps = {
        t, ws, isOwner, canManageWs: perms.canManageWorkspace, inviteCode, members,
        perms, myUserId: currentUser?.userId ?? currentUser?.id,
        onChangeMemberRole, onKickMember,
        editingName, nameValue, nameSaving, copied, confirm,
        iconUploading, fileInputRef,
        errorMsg, onErrorClear: clearError,
        onClose: handleClose,
        onStartEditName: () => { setNameValue(ws.workspaceName || ""); setEditingName(true); },
        onNameChange: setNameValue,
        onSaveName: handleSaveName,
        onCancelEdit: () => setEditingName(false),
        onCopy: handleCopy,
        onIconClick: handleIconClick,
        onConfirmSet: setConfirm,
        onLeaveClick: handleLeaveClick,
        onDeleteCheck: handleDeleteCheck,
        onLeave: handleLeave,
        onDelete: handleDelete,
    };

    const transferDialogProps = {
        open: confirm?.type === "transfer",
        t,
        members,
        currentEmail: currentUser?.email,
        transferTarget,
        onTargetSet: setTransferTarget,
        onConfirm: handleTransferAndLeave,
        onClose: () => { setConfirm(null); clearError(); },
        loading: transferring,
    };

    // ── 데스크탑: MUI Dialog ────────────────────────────────────
    if (!isMobile) {
        return (
            <>
                <Dialog
                    open={open}
                    onClose={onClose}
                    maxWidth="sm"
                    fullWidth
                    PaperProps={{
                        sx: {
                            borderRadius: 4,
                            background: isDark ? t.dialogBg : "#fff",
                            backgroundImage: "none",
                            boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
                            fontFamily: f,
                        },
                    }}
                >
                    {/* dialog header */}
                    <div style={{ padding: "20px 20px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", backgroundImage: `linear-gradient(to right, transparent, ${t.sep} 15%, ${t.sep} 85%, transparent)`, backgroundSize: "100% 1px", backgroundRepeat: "no-repeat", backgroundPosition: "bottom" }}>
                        <div>
                            <h2 style={{ fontSize: 18, fontWeight: 800, color: t.text, letterSpacing: -0.5, margin: "0 0 4px", fontFamily: f }}>
                                워크스페이스 편집
                            </h2>
                            <p style={{ fontSize: 13, color: t.text2, margin: 0, fontFamily: f }}>
                                워크스페이스 정보를 관리하고 멤버를 초대할 수 있어요.
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            style={{ width: 32, height: 32, borderRadius: "50%", background: t.surfaceMd, border: `1px solid ${t.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.text2, flexShrink: 0, marginLeft: 12, fontFamily: f }}
                        >
                            <CloseRounded sx={{ fontSize: 16 }} />
                        </button>
                    </div>

                    <DialogContent sx={{ p: 0, overflowY: "auto" }}>
                        <div style={{ paddingTop: 16, fontFamily: f }}>
                            <EditContent {...contentProps} />
                        </div>
                    </DialogContent>

                </Dialog>
                <TransferOwnerDialog {...transferDialogProps} />
            </>
        );
    }

    // ── 모바일: Bottom Sheet (createPortal) ─────────────────────
    const sheet = createPortal(
        <>
            {/* backdrop */}
            <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: Z.MODAL_NESTED, background: t.ovBg, ...blurSx("blur(6px)") }} />

            {/* sheet */}
            <div
                ref={sheetRef}
                style={{
                    position: "fixed", bottom: 0, left: 0, right: 0, zIndex: Z.MODAL_NESTED,
                    background: t.sheet,
                    ...blurSx("blur(40px)"),
                    borderRadius: "28px 28px 0 0",
                    boxShadow: "var(--plando-elev-3)",
                    maxHeight: "94dvh", display: "flex", flexDirection: "column",
                    fontFamily: f, willChange: "transform",
                    animation: "wsSheetUp .28s cubic-bezier(.4,0,.2,1)",
                }}
            >
                {/* handle + header — 스와이프 감지 영역 */}
                <div
                    onTouchStart={onSheetTouchStart}
                    onTouchMove={onSheetTouchMove}
                    onTouchEnd={onSheetTouchEnd}
                    style={{ flexShrink: 0, touchAction: "none" }}
                >
                    {/* handle */}
                    <div style={{ padding: "12px 0 0", display: "flex", justifyContent: "center" }}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: t.handle }} />
                    </div>

                    {/* header */}
                    <div style={{ padding: "12px 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <h2 style={{ fontSize: 19, fontWeight: 800, color: t.text, letterSpacing: -0.5, margin: "0 0 4px" }}>워크스페이스 편집</h2>
                            <p style={{ fontSize: 13, color: t.text2, margin: 0 }}>워크스페이스 정보를 관리하고 멤버를 초대할 수 있어요.</p>
                        </div>
                        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: t.surfaceMd, border: `1px solid ${t.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.text2, flexShrink: 0, marginLeft: 12, fontFamily: f }}>
                            <CloseRounded sx={{ fontSize: 16 }} />
                        </button>
                    </div>
                </div>

                {/* scrollable content */}
                <div style={{ overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>
                    <EditContent {...contentProps} />
                </div>
            </div>

            <style>{`
                @keyframes wsSheetUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
            `}</style>
        </>,
        document.body
    );

    return (
        <>
            {sheet}
            <TransferOwnerDialog {...transferDialogProps} />
        </>
    );
}
