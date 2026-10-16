import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLayout } from "../../../layouts/LayoutContext.jsx";
import { resolveImageUrl } from "../../../shared/utils/urlUtils.js";
import { BRAND_COLOR } from "../../../shared/ui/tone.js";
import { Z } from "../../../shared/ui/zIndex.js";
import {
    Box, Typography, Stack, TextField, MenuItem,
    Chip, Alert, Avatar, IconButton, CircularProgress, Divider,
} from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import WorkspacesIcon from "@mui/icons-material/Workspaces";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import WidgetsRoundedIcon from "@mui/icons-material/WidgetsRounded";
import ConfirmDialog from "../../../shared/ui/common/ConfirmDialog.jsx";
import HeaderActionButton from "../../../shared/ui/common/HeaderActionButton.jsx";
import { SectionLabel, SettingsCard as SectionCard, SettingsRow as SettingRow, SettingSelectRow, SettingsToggleRow } from "../../../shared/ui/common/SettingsList.jsx";
import PrivacyPolicyModal from "../../../shared/ui/common/PrivacyPolicyModal.jsx";
import TermsModal from "../../../shared/ui/common/TermsModal.jsx";
import OpenSourceLicenseModal from "../../../shared/ui/common/OpenSourceLicenseModal.jsx";
import TransferOwnerDialog from "../../workspace/components/TransferOwnerDialog.jsx";
import ThemePreview from "../components/ThemePreview.jsx";
import WidgetPreview from "../components/WidgetPreview.jsx";
import TemplateManager from "../../todo/components/form/TemplateManager.jsx";
import { fadeDividerSx } from "../../../shared/ui/glassSx.js";
import { THEMES } from "../../../shared/ui/theme.js";
import { ROLE_LABEL } from "../../workspace/hooks/useWorkspacePermissions.js";
import { RESET_CONFIRM_MESSAGE } from "../hooks/useSettingsState.js";

// ── 모바일 전용 헬퍼 컴포넌트 ─────────────────────────────────────

// 저장 버튼 없음 — 설정은 전부 즉시 적용된다 (자유 입력만 각 행의 "변경" 버튼)
function DetailHeader({ title, onBack, isDark, backLabel = "설정" }) {
    const border = "var(--plando-surface-strong)";
    const bg = isDark ? "rgba(19,19,23,0.95)" : "rgba(248,248,248,0.95)";
    return (
        <Box sx={{
            display: "flex", alignItems: "center",
            px: 1.5, py: 1.25, minHeight: 54,
            background: bg,
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            ...fadeDividerSx(border, "bottom"),
            flexShrink: 0, position: "sticky", top: 0, zIndex: Z.FAB,
        }}>
            <Box component="button" onClick={onBack} sx={{
                display: "flex", alignItems: "center", gap: 0.5,
                border: "none", background: "none", cursor: "pointer",
                color: "primary.main", px: 0.5, py: 0.5, borderRadius: 1,
                fontSize: 15, fontWeight: 600, flexShrink: 0,
            }}>
                <ArrowBackIosNewRoundedIcon sx={{ fontSize: 14 }} />
                {backLabel}
            </Box>
            <Typography sx={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 16 }}>
                {title}
            </Typography>
            <Box sx={{ width: 44 }} />
        </Box>
    );
}


// ── 메인 모바일 컴포넌트 ──────────────────────────────────────────
export default function SettingsPageMobile({ s }) {
    const navigate = useNavigate();
    const { setImmersive } = useLayout();
    // 설정은 풀스크린 푸시 — 글로벌 상단바·바텀네비 숨김 (이탈 시 복구)
    useEffect(() => {
        setImmersive(true);
        return () => setImmersive(false);
    }, [setImmersive]);

    const {
        isDark, muiTheme,
        activeSection, setActiveSection, goBack,
        userEmail, displayName, setDisplayName, profileImageUrl, uploadingImage,
        savedDisplayName, displayNameSaving, handleDisplayNameSave,
        provider, kakaoLinked, unlinkLoading,
        showPasswordCard, canResetPassword, passwordUnavailableReason, canUnlinkKakao, kakaoUnlinkBlocked,
        confirmKakaoUnlink, setConfirmKakaoUnlink, fileInputRef, handleProfileImageChange, handleKakaoUnlink,
        themeMode, setThemeMode,
        defaultPriority, setDefaultPriority,
        calendarDefaultView, setCalendarDefaultView, dueReminderLeadDays, setDueReminderLeadDays,
        defaultDue, setDefaultDue,
        autoArchiveDays, setAutoArchiveDays,
        push, notificationEnabled, setNotificationEnabled, notifyMention, setNotifyMention, notifyDm, setNotifyDm,
        notifyDueDate, setNotifyDueDate, notifyAssignment, setNotifyAssignment, notifyComment, setNotifyComment,
        currentWorkspace, workspaceMembers, canManageWs, membersExpanded, setMembersExpanded, MEMBERS_PREVIEW,
        editingWsName, setEditingWsName, wsIconInputRef, wsNameSaving,
        uploadingWsIcon, handleWsNameSave, handleWsIconChange,
        wsActions,
        confirmDeleteAccount, setConfirmDeleteAccount, actionLoading,
        handleDeleteAccount, handleLogout, handleCopyInviteCode,
        confirmResetAll, setConfirmResetAll, resetting, handleResetAll,
        errorMessage, setErrorMessage,
        themeLabel, priorityLabel, notifLabel,
        pwResetSending, pwResetSent, pwResetError, setPwResetError, handlePasswordReset,
        exporting, exportError, setExportError, handleExportCsv, transferTokens,
    } = s;

    const {
        confirm: wsConfirm, setConfirm: setWsConfirm,
        transferTarget, setTransferTarget, transferring,
        errorMsg: wsErrorMsg, clearError: clearWsError,
        handleLeaveClick: wsHandleLeaveClick, handleDeleteClick: wsHandleDeleteClick,
        handleLeave: wsHandleLeave, handleDelete: wsHandleDelete, handleTransferAndLeave,
    } = wsActions;

    const handleDeleteWorkspace = () => wsHandleDelete(currentWorkspace);
    const handleLeaveWorkspace  = () => wsHandleLeave(currentWorkspace);

    // 섹션 전환 슬라이드 — 세부로 들어갈 땐 우→좌, 뒤로 나올 땐 좌→우 (토스식 푸시/팝)
    const prevSectionRef = useRef(null);
    const goingBack = !activeSection && !!prevSectionRef.current;
    useEffect(() => { prevSectionRef.current = activeSection; }, [activeSection]);
    const screenSlide = {
        "@keyframes _scrFwd":  { from: { opacity: 0, transform: "translateX(40px)" },  to: { opacity: 1, transform: "none" } },
        "@keyframes _scrBack": { from: { opacity: 0, transform: "translateX(-40px)" }, to: { opacity: 1, transform: "none" } },
        animation: `${goingBack ? "_scrBack" : "_scrFwd"} 0.42s cubic-bezier(0.32, 0.72, 0, 1)`,
        willChange: "opacity, transform",
    };

    // 성공은 토스트로만 알린다 — 성공 배너를 끼워 넣으면 레이아웃이 밀려서 오히려 방해됨
    //
    // 컴포넌트(const AlertBanners = () => …)가 아니라 "엘리먼트 변수"로 둔다.
    // 렌더 함수 안에서 컴포넌트를 정의하면 렌더마다 타입 identity가 바뀌어서
    // React가 서브트리를 언마운트→재마운트한다(스위치 하나 켤 때마다 배너·다이얼로그가 다시 열림).
    const alertBanners = (
        <>
            {errorMessage && <Alert severity="error" sx={{ mx: 2 }} onClose={() => setErrorMessage("")}>{errorMessage}</Alert>}
            {wsErrorMsg && <Alert severity="error" sx={{ mx: 2 }} onClose={clearWsError}>{wsErrorMsg}</Alert>}
        </>
    );

    const [privacyOpen, setPrivacyOpen] = useState(false);
    const [termsOpen, setTermsOpen] = useState(false);
    const [licenseOpen, setLicenseOpen] = useState(false);
    const [widgetOpen, setWidgetOpen] = useState(false);


    // 위 alertBanners 와 같은 이유로 엘리먼트 변수 — 렌더마다 재마운트되면
    // 열려 있던 확인창이 진입 애니메이션을 다시 재생하고(actionLoading 변화 시 깜빡임) 포커스도 튄다.
    const dialogs = (
        <>
            <ConfirmDialog open={wsConfirm?.type === "delete"} title="워크스페이스 삭제"
                message={wsConfirm?.hasRecruitments
                    ? `"${currentWorkspace?.workspaceName}" 워크스페이스에 팀 모집글이 있습니다.\n모집글을 포함한 모든 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없어요.`
                    : `"${currentWorkspace?.workspaceName}" 워크스페이스를 삭제하면 모든 할 일과 멤버 정보가 영구적으로 삭제돼요.\n\n정말 삭제할까요?`}
                confirmText="삭제" confirmColor="error"
                onClose={() => setWsConfirm(null)} onConfirm={handleDeleteWorkspace} />
            <ConfirmDialog open={wsConfirm?.type === "leave"} title="워크스페이스 나가기"
                message={`"${currentWorkspace?.workspaceName}" 워크스페이스에서 나갈까요?\n\n나간 후 다시 참여하려면 초대 코드가 필요해요.`}
                confirmText="나가기" confirmColor="warning"
                onClose={() => setWsConfirm(null)} onConfirm={handleLeaveWorkspace} />
            <ConfirmDialog open={confirmDeleteAccount} title="회원 탈퇴"
                message={`탈퇴하면 이렇게 돼요.\n\n• 내가 소유자인 워크스페이스는 할 일까지 통째로 삭제돼요.\n• 다른 워크스페이스에서는 자동으로 나가지고, 내가 만든 할 일은 남되 작성자 표시가 지워져요.\n• 주고받은 메시지·댓글은 상대방 기록으로 남고 "탈퇴한 사용자"로 표시돼요.\n\n되돌릴 수 없어요. 정말 탈퇴할까요?`}
                confirmText="탈퇴" confirmColor="error" loading={actionLoading}
                onClose={() => setConfirmDeleteAccount(false)} onConfirm={handleDeleteAccount} />
            <ConfirmDialog open={confirmResetAll} title="모든 설정 초기화"
                message={RESET_CONFIRM_MESSAGE}
                confirmText="초기화" confirmColor="warning" loading={resetting}
                onClose={() => setConfirmResetAll(false)} onConfirm={handleResetAll} />
            <ConfirmDialog open={confirmKakaoUnlink} title="카카오 연동 해제"
                message="카카오 계정 연동을 해제할까요? 해제 후 카카오로 로그인할 수 없어요."
                confirmText="해제" confirmColor="error" loading={unlinkLoading}
                onClose={() => setConfirmKakaoUnlink(false)}
                onConfirm={handleKakaoUnlink} />
            <TransferOwnerDialog
                open={wsConfirm?.type === "transfer"}
                t={transferTokens}
                members={workspaceMembers}
                currentEmail={userEmail}
                transferTarget={transferTarget}
                onTargetSet={setTransferTarget}
                onConfirm={() => handleTransferAndLeave(currentWorkspace)}
                onClose={() => { setWsConfirm(null); clearWsError(); }}
                loading={transferring}
            />
        </>
    );

    // ── 섹션: 프로필 ──────────────────────────────────────────────
    if (activeSection === "profile") {
        return (
            <Box key={activeSection || "main"} sx={{ ...screenSlide, display: "flex", flexDirection: "column", minHeight: "100%" }}>
                <DetailHeader title="프로필" onBack={goBack} isDark={isDark} />
                <Box sx={{ flex: 1, overflowY: "auto", pb: 4 }}>
                    {alertBanners}
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", pt: 4, pb: 3, gap: 1.5 }}>
                        <Box sx={{ position: "relative" }}>
                            <Avatar src={resolveImageUrl(profileImageUrl)} sx={{ width: 90, height: 90, fontSize: 36, fontWeight: 800 }}>
                                {!profileImageUrl && (displayName?.[0] || userEmail?.[0] || "U").toUpperCase()}
                            </Avatar>
                            <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}
                                sx={{ position: "absolute", bottom: -2, right: -2, bgcolor: "background.paper", border: "1.5px solid", borderColor: "divider", width: 30, height: 30, "&:hover": { bgcolor: "action.hover" } }}>
                                {uploadingImage ? <CircularProgress size={14} /> : <CameraAltIcon sx={{ fontSize: 14 }} />}
                            </IconButton>
                            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleProfileImageChange} />
                        </Box>
                        {/* 가짜 링크(Typography+onClick) → 공용 ghost 버튼 */}
                        <HeaderActionButton variant="ghost" onClick={() => fileInputRef.current?.click()}>
                            사진 변경
                        </HeaderActionButton>
                    </Box>

                    <SectionLabel>기본 정보</SectionLabel>
                    <SectionCard isDark={isDark}>
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">표시 이름</Typography>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                <TextField size="small" fullWidth variant="standard" placeholder="이름을 입력하세요" value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    sx={{ "& .MuiInput-underline:before": { borderColor: "divider" } }} />
                                <HeaderActionButton variant="secondary" onClick={handleDisplayNameSave}
                                    disabled={displayNameSaving || !displayName?.trim() || displayName.trim() === savedDisplayName}
                                    sx={{ whiteSpace: "nowrap" }}>
                                    {displayNameSaving ? <CircularProgress size={13} color="inherit" /> : "변경"}
                                </HeaderActionButton>
                            </Stack>
                        </Box>
                        <Divider />
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">이메일</Typography>
                            <Typography sx={{ fontSize: 15, mt: 0.25 }}>{userEmail}</Typography>
                        </Box>
                    </SectionCard>

                    <SectionLabel>소셜 계정</SectionLabel>
                    <SectionCard isDark={isDark}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.5 }}>
                            <Box sx={{ width: 32, height: 32, borderRadius: "50%", bgcolor: BRAND_COLOR.KAKAO, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>K</Box>
                            <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontSize: 15, fontWeight: 600 }}>카카오</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {/* 해제 불가 사유를 여기서 미리 밝힌다 — 누른 뒤 400을 보고 알게 하면 안 됨 */}
                                    {provider === "KAKAO" ? "카카오 전용 계정"
                                        : kakaoLinked
                                            ? (kakaoUnlinkBlocked ? "연동됨 · 비밀번호가 없어 해제할 수 없어요" : "연동됨")
                                            : "미연동"}
                                </Typography>
                            </Box>
                            {provider === "KAKAO" ? (
                                <Chip label="전용" size="small" sx={{ bgcolor: BRAND_COLOR.KAKAO, fontWeight: 700 }} />
                            ) : kakaoLinked ? (
                                /* 숨기지 않고 비활성 — 연동된 계정에서 해제 버튼만 사라지면 고장으로 보인다 */
                                <HeaderActionButton variant="danger" disabled={unlinkLoading || !canUnlinkKakao} onClick={() => setConfirmKakaoUnlink(true)}>해제</HeaderActionButton>
                            ) : (
                                <Chip label="미연동" size="small" variant="outlined" />
                            )}
                        </Box>
                    </SectionCard>

                    {showPasswordCard && (
                        <>
                            <SectionLabel>비밀번호</SectionLabel>
                            <SectionCard isDark={isDark}>
                                <Box sx={{ px: 2, py: 1.5 }}>
                                    {pwResetSent ? (
                                        <Alert severity="success" sx={{ fontSize: 13, py: 0.5 }}>
                                            재설정 메일을 보냈어요.
                                        </Alert>
                                    ) : (
                                        <>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                                                {/* 비밀번호가 없으면 서버가 메일을 보내지 않는다 — 안내부터 사실대로 바꾼다 */}
                                                {passwordUnavailableReason || `이메일(${userEmail})로 재설정 링크를 보내드려요.`}
                                            </Typography>
                                            {pwResetError && <Alert severity="error" sx={{ mb: 1, fontSize: 12 }} onClose={() => setPwResetError("")}>{pwResetError}</Alert>}
                                            {/* 눌러도 성공할 수 없는 버튼은 감추지 말고 비활성으로 — 위 문구가 이유를 설명한다 */}
                                            <HeaderActionButton fullWidth onClick={handlePasswordReset} disabled={pwResetSending || !canResetPassword}
                                                icon={pwResetSending ? <CircularProgress size={14} color="inherit" /> : undefined}>
                                                비밀번호 재설정 메일 보내기
                                            </HeaderActionButton>
                                        </>
                                    )}
                                </Box>
                            </SectionCard>
                        </>
                    )}

                    <SectionLabel>정보</SectionLabel>
                    <SectionCard isDark={isDark}>
                        <SettingRow label="개인정보처리방침" onClick={() => setPrivacyOpen(true)} isLast isDark={isDark} />
                    </SectionCard>
                </Box>
                {dialogs}
                <PrivacyPolicyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
            </Box>
        );
    }

    // ── 섹션: 워크스페이스 ────────────────────────────────────────
    if (activeSection === "workspace") {
        return (
            <Box key={activeSection || "main"} sx={{ ...screenSlide, display: "flex", flexDirection: "column", minHeight: "100%" }}>
                <DetailHeader title="워크스페이스" onBack={goBack} isDark={isDark} />
                <Box sx={{ flex: 1, overflowY: "auto", pb: 4 }}>
                    {alertBanners}
                    {!currentWorkspace ? (
                        <Box sx={{ p: 3 }}>
                            <Typography color="text.secondary">현재 선택된 워크스페이스가 없어요.</Typography>
                        </Box>
                    ) : (
                        <>
                            <SectionLabel>현재 워크스페이스</SectionLabel>
                            <SectionCard isDark={isDark}>
                                <Box sx={{ px: 2, py: 1.75 }}>
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                        <Box sx={{ position: "relative", flexShrink: 0 }}>
                                            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: "action.selected", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                {currentWorkspace.iconImageUrl
                                                    ? <Box component="img" src={currentWorkspace.iconImageUrl} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                    : <WorkspacesIcon fontSize="small" color="primary" />}
                                            </Box>
                                            {canManageWs && (
                                                <>
                                                    <IconButton size="small" onClick={() => wsIconInputRef.current?.click()} disabled={uploadingWsIcon}
                                                        sx={{ position: "absolute", bottom: -3, right: -3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", width: 20, height: 20 }}>
                                                        {uploadingWsIcon ? <CircularProgress size={10} /> : <CameraAltIcon sx={{ fontSize: 10 }} />}
                                                    </IconButton>
                                                    <input ref={wsIconInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleWsIconChange} />
                                                </>
                                            )}
                                        </Box>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            {canManageWs ? (
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <TextField size="small" value={editingWsName} onChange={(e) => setEditingWsName(e.target.value)} variant="standard"
                                                        sx={{ flex: 1, "& input": { fontWeight: 800, fontSize: 15 } }} />
                                                    <HeaderActionButton variant="secondary" onClick={handleWsNameSave}
                                                        disabled={wsNameSaving || !editingWsName.trim() || editingWsName.trim() === currentWorkspace.workspaceName}
                                                        sx={{ whiteSpace: "nowrap" }}>
                                                        {wsNameSaving ? <CircularProgress size={13} color="inherit" /> : "변경"}
                                                    </HeaderActionButton>
                                                </Stack>
                                            ) : (
                                                <Typography sx={{ fontWeight: 800, fontSize: 15 }}>{currentWorkspace.workspaceName}</Typography>
                                            )}
                                            <Chip size="small" color={currentWorkspace.role === "OWNER" ? "primary" : "default"} label={ROLE_LABEL[currentWorkspace.role] ?? currentWorkspace.role ?? "멤버"} variant={currentWorkspace.role === "OWNER" ? "filled" : "outlined"} sx={{ mt: 0.5, height: 20, fontSize: 11 }} />
                                        </Box>
                                    </Stack>
                                </Box>
                            </SectionCard>

                            <SectionLabel>초대 코드</SectionLabel>
                            <SectionCard isDark={isDark}>
                                <Box sx={{ px: 2, py: 1.75 }}>
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                        <Typography sx={{ flex: 1, fontSize: 15, fontFamily: "monospace", letterSpacing: 1, color: "text.primary" }}>
                                            {currentWorkspace.inviteCode || "—"}
                                        </Typography>
                                        {/* 데스크탑과 같은 라벨 버튼으로 통일 (아이콘 전용 → primary 버튼) */}
                                        <HeaderActionButton icon={<ContentCopyIcon sx={{ fontSize: 16 }} />} onClick={handleCopyInviteCode} disabled={!currentWorkspace.inviteCode}>복사</HeaderActionButton>
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary">코드를 공유해 멤버를 초대할 수 있어요.</Typography>
                                </Box>
                            </SectionCard>

                            <SectionLabel>멤버 ({workspaceMembers.length})</SectionLabel>
                            <SectionCard isDark={isDark}>
                                {workspaceMembers.length === 0 ? (
                                    <Box sx={{ px: 2, py: 1.5 }}>
                                        <Typography variant="body2" color="text.secondary">참여 중인 멤버가 없어요.</Typography>
                                    </Box>
                                ) : (
                                    <>
                                        {(membersExpanded ? workspaceMembers : workspaceMembers.slice(0, MEMBERS_PREVIEW))
                                            .map((member, idx, arr) => {
                                                const isMe = member.email === userEmail;
                                                const roleLabel = ROLE_LABEL[member.role] ?? member.role;
                                                return (
                                                    <Box key={member.email} sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.25, ...(idx < arr.length - 1 ? fadeDividerSx(muiTheme.palette.divider, "bottom") : {}) }}>
                                                        <Avatar src={resolveImageUrl(member.profileImageUrl || member.profileImage)} sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 700 }}>
                                                            {(member.name || member.email || "?")[0].toUpperCase()}
                                                        </Avatar>
                                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                                            <Typography sx={{ fontWeight: 600, fontSize: 15 }} noWrap>{member.name || "-"}{isMe ? " (나)" : ""}</Typography>
                                                            <Typography variant="caption" color="text.secondary" noWrap>{member.email}</Typography>
                                                        </Box>
                                                        <Stack direction="row" spacing={0.5}>
                                                            {isMe && <Chip size="small" label="나" variant="outlined" />}
                                                            {roleLabel && <Chip size="small" label={roleLabel} color={member.role === "OWNER" ? "primary" : "default"} variant="outlined" />}
                                                        </Stack>
                                                    </Box>
                                                );
                                            })}
                                        {workspaceMembers.length > MEMBERS_PREVIEW && (
                                            <Box sx={{ px: 2, py: 1.25 }}>
                                                <HeaderActionButton variant="ghost" onClick={() => setMembersExpanded(v => !v)}>
                                                    {membersExpanded ? "접기" : `${workspaceMembers.length - MEMBERS_PREVIEW}명 더 보기`}
                                                </HeaderActionButton>
                                            </Box>
                                        )}
                                    </>
                                )}
                            </SectionCard>

                            <SectionLabel>관리</SectionLabel>
                            <SectionCard isDark={isDark}>
                                {currentWorkspace.role === "OWNER" ? (
                                    <SettingRow label="워크스페이스 삭제" onClick={() => wsHandleDeleteClick(currentWorkspace)} isDestructive isLast isDark={isDark} />
                                ) : (
                                    <SettingRow label="워크스페이스 나가기" onClick={() => wsHandleLeaveClick(currentWorkspace, workspaceMembers)} isDestructive isLast isDark={isDark} />
                                )}
                            </SectionCard>
                        </>
                    )}
                </Box>
                {dialogs}
            </Box>
        );
    }

    // ── 섹션: 화면 ────────────────────────────────────────────────
    if (activeSection === "display") {
        return (
            <Box key={activeSection || "main"} sx={{ ...screenSlide, display: "flex", flexDirection: "column", minHeight: "100%" }}>
                <DetailHeader title="화면" onBack={goBack} isDark={isDark} />
                <Box sx={{ flex: 1, overflowY: "auto", pb: 4 }}>
                    {alertBanners}
                    <SectionLabel>테마</SectionLabel>
                    <SectionCard isDark={isDark}>
                        <Box sx={{ p: 2, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.25 }}>
                            {THEMES.map((t) => (
                                <ThemePreview
                                    key={t.key}
                                    theme={t}
                                    selected={themeMode === t.key}
                                    onClick={() => setThemeMode(t.key)}
                                />
                            ))}
                        </Box>
                    </SectionCard>

                    <SectionLabel>캘린더</SectionLabel>
                    <SectionCard isDark={isDark}>
                        <SettingSelectRow label="기본 보기" desc="캘린더를 열 때 처음 보여줄 형태" value={calendarDefaultView} onChange={(e) => setCalendarDefaultView(e.target.value)} isLast>
                            <MenuItem value="month">월</MenuItem>
                            <MenuItem value="week">주</MenuItem>
                            <MenuItem value="day">일</MenuItem>
                        </SettingSelectRow>
                    </SectionCard>
                </Box>
            </Box>
        );
    }

    // ── 섹션: 작업 기본값 ─────────────────────────────────────────
    if (activeSection === "tasks") {
        return (
            <Box key={activeSection || "main"} sx={{ ...screenSlide, display: "flex", flexDirection: "column", minHeight: "100%" }}>
                <DetailHeader title="작업 기본값" onBack={goBack} isDark={isDark} />
                <Box sx={{ flex: 1, overflowY: "auto", pb: 4 }}>
                    {alertBanners}
                    <SectionLabel>기본값</SectionLabel>
                    <SectionCard isDark={isDark}>
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">기본 우선순위</Typography>
                            <TextField size="small" select fullWidth variant="standard" value={defaultPriority} onChange={(e) => setDefaultPriority(e.target.value)} helperText="새 할 일을 만들 때 자동으로 적용돼요." sx={{ mt: 0.5, "& .MuiInput-underline:before": { borderColor: "divider" } }}>
                                <MenuItem value="HIGH">높음</MenuItem>
                                <MenuItem value="MEDIUM">중간</MenuItem>
                                <MenuItem value="LOW">낮음</MenuItem>
                            </TextField>
                        </Box>
                    </SectionCard>

                    <SectionLabel>새 할 일 기본값</SectionLabel>
                    <SectionCard isDark={isDark}>
                        <SettingSelectRow label="기본 마감일" desc="새 할 일에 자동으로 들어갈 마감일" value={defaultDue} onChange={(e) => setDefaultDue(e.target.value)} isLast>
                            <MenuItem value="none">없음</MenuItem>
                            <MenuItem value="today">오늘</MenuItem>
                            <MenuItem value="tomorrow">내일</MenuItem>
                            <MenuItem value="week">이번 주</MenuItem>
                        </SettingSelectRow>
                    </SectionCard>

                    <SectionLabel>정리</SectionLabel>
                    <SectionCard isDark={isDark}>
                        <SettingSelectRow label="완료 항목 자동 보관" desc="내가 만든 완료 할 일을 일정 기간 후 보관함으로" value={autoArchiveDays} onChange={(e) => setAutoArchiveDays(Number(e.target.value))} isLast>
                            <MenuItem value={0}>안 함</MenuItem>
                            <MenuItem value={7}>1주 후</MenuItem>
                            <MenuItem value={14}>2주 후</MenuItem>
                            <MenuItem value={30}>1개월 후</MenuItem>
                        </SettingSelectRow>
                    </SectionCard>
                </Box>
            </Box>
        );
    }

    // ── 섹션: 태스크 템플릿 ───────────────────────────────────────
    if (activeSection === "templates") {
        return (
            <Box key={activeSection || "main"} sx={{ ...screenSlide, display: "flex", flexDirection: "column", minHeight: "100%" }}>
                <DetailHeader title="태스크 템플릿" onBack={goBack} isDark={isDark} />
                <Box sx={{ flex: 1, overflowY: "auto", pb: 4 }}>
                    {alertBanners}
                    {!currentWorkspace ? (
                        <Box sx={{ p: 3 }}>
                            <Typography color="text.secondary">워크스페이스를 선택해야 템플릿을 관리할 수 있어요.</Typography>
                        </Box>
                    ) : (
                        <>
                            <SectionLabel>워크스페이스 템플릿</SectionLabel>
                            <Box sx={{ mx: 2 }}>
                                <TemplateManager workspaceId={currentWorkspace.workspaceId} />
                            </Box>
                        </>
                    )}
                </Box>
            </Box>
        );
    }

    // ── 섹션: 알림 ────────────────────────────────────────────────
    if (activeSection === "notifications") {
        const eventsDisabled = !notificationEnabled;
        const channelItems = [
            {
                label: "인앱 알림",
                desc: "앱 사용 중 상단 벨 아이콘으로 받는 알림",
                checked: notificationEnabled,
                onChange: (v) => setNotificationEnabled(v),
            },
            {
                label: "앱 푸시 알림",
                desc: push.needsInstall ? "홈 화면에 추가 후 사용할 수 있어요"
                    : !push.supported ? "이 브라우저는 푸시 알림을 지원하지 않아요"
                    : push.permission === "denied" ? "브라우저 설정에서 알림 권한을 허용해주세요"
                    : push.subscribed ? "앱이 꺼져 있어도 알림을 받아요"
                    : "앱 종료 후에도 백그라운드 알림을 받아요",
                checked: push.subscribed,
                onChange: (v) => v ? push.subscribe() : push.unsubscribe(),
                extraDisabled: push.needsInstall || !push.supported || push.loading || push.permission === "denied",
                isLast: true,
            },
        ];
        const eventItems = [
            { label: "담당자 지정", desc: "할 일에 나를 담당자로 지정했을 때", checked: notifyAssignment, onChange: (v) => setNotifyAssignment(v) },
            { label: "마감일", desc: "내가 담당한 할 일의 마감일이 다가올 때", checked: notifyDueDate, onChange: (v) => setNotifyDueDate(v) },
            { label: "댓글", desc: "내 할 일이나 내가 참여한 스레드에 댓글이 달렸을 때", checked: notifyComment, onChange: (v) => setNotifyComment(v) },
            { label: "@멘션", desc: "댓글에서 나를 언급했을 때", checked: notifyMention, onChange: (v) => setNotifyMention(v) },
            { label: "다이렉트 메시지", desc: "DM 메시지 또는 파일을 받았을 때", checked: notifyDm, onChange: (v) => setNotifyDm(v), isLast: true },
        ];
        const renderRow = ({ label, desc, checked, onChange, extraDisabled, isLast }) => (
            <Box key={label}>
                <SettingsToggleRow
                    label={label} desc={desc}
                    checked={checked} onChange={onChange}
                    disabled={extraDisabled} isLast={isLast}
                />
                {label === "앱 푸시 알림" && push.needsInstall && (
                    <Box sx={{ mx: 2, mb: 1.5, px: 1.5, py: 1.25, borderRadius: 2, bgcolor: "action.hover", border: "1px solid", borderColor: "divider" }}>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                            Safari에서 푸시 알림을 받으려면 홈 화면에 앱을 추가해야 해요.{"\n"}
                            하단의 <strong>공유 버튼(</strong>□↑<strong>)</strong> → <strong>홈 화면에 추가</strong>를 탭해주세요.
                        </Typography>
                    </Box>
                )}
            </Box>
        );
        return (
            <Box key={activeSection || "main"} sx={{ ...screenSlide, display: "flex", flexDirection: "column", minHeight: "100%" }}>
                <DetailHeader title="알림 설정" onBack={goBack} isDark={isDark} />
                <Box sx={{ flex: 1, overflowY: "auto", pb: 4 }}>
                    {alertBanners}
                    <SectionLabel>알림을 어디서 받을지</SectionLabel>
                    <SectionCard isDark={isDark}>
                        {channelItems.map(renderRow)}
                    </SectionCard>

                    <SectionLabel>어떤 활동을 알림 받을지</SectionLabel>
                    <Box sx={{ opacity: eventsDisabled ? 0.4 : 1, pointerEvents: eventsDisabled ? "none" : "auto", transition: "opacity 0.2s" }}>
                        <SectionCard isDark={isDark}>
                            {eventItems.map(renderRow)}
                        </SectionCard>
                    </Box>

                    <SectionLabel>마감 리마인더</SectionLabel>
                    <Box sx={{ opacity: (eventsDisabled || !notifyDueDate) ? 0.4 : 1, pointerEvents: (eventsDisabled || !notifyDueDate) ? "none" : "auto", transition: "opacity 0.2s" }}>
                        <SectionCard isDark={isDark}>
                            <SettingSelectRow label="알림 시점" desc="마감 며칠 전에 미리 알려드릴지 (오전 9시 발송)" value={dueReminderLeadDays} onChange={(e) => setDueReminderLeadDays(Number(e.target.value))} isLast>
                                <MenuItem value={0}>당일</MenuItem>
                                <MenuItem value={1}>1일 전</MenuItem>
                                <MenuItem value={3}>3일 전</MenuItem>
                            </SettingSelectRow>
                        </SectionCard>
                    </Box>
                </Box>
            </Box>
        );
    }

    // ── 섹션: 데이터 내보내기 ──────────────────────────────────────
    if (activeSection === "data") {
        return (
            <Box key={activeSection || "main"} sx={{ ...screenSlide, display: "flex", flexDirection: "column", minHeight: "100%" }}>
                <DetailHeader title="데이터 내보내기" onBack={goBack} isDark={isDark} />
                <Box sx={{ flex: 1, overflowY: "auto", pb: 4 }}>
                    {alertBanners}
                    {exportError && <Alert severity="error" sx={{ mx: 2 }} onClose={() => setExportError("")}>{exportError}</Alert>}
                    <SectionLabel>CSV 내보내기</SectionLabel>
                    <SectionCard isDark={isDark}>
                        <Box sx={{ px: 2, py: 2 }}>
                            <Typography sx={{ fontSize: 15, color: "text.secondary", lineHeight: 1.6, mb: 1.75 }}>
                                {currentWorkspace
                                    ? `"${currentWorkspace.workspaceName}" 워크스페이스의 모든 할 일을 CSV 파일로 내려받아요. 엑셀·구글 시트에서 바로 열 수 있어요.`
                                    : "워크스페이스를 선택하면 할 일을 내보낼 수 있어요."}
                            </Typography>
                            <HeaderActionButton
                                fullWidth
                                icon={exporting ? <CircularProgress size={14} color="inherit" /> : <FileDownloadRoundedIcon sx={{ fontSize: 17 }} />}
                                disabled={!currentWorkspace || exporting}
                                onClick={handleExportCsv}
                            >
                                {exporting ? "내보내는 중…" : "CSV로 내보내기"}
                            </HeaderActionButton>
                        </Box>
                    </SectionCard>
                </Box>
            </Box>
        );
    }

    // ── 섹션: 정보 ────────────────────────────────────────────────
    if (activeSection === "about") {
        return (
            <Box key={activeSection || "main"} sx={{ ...screenSlide, display: "flex", flexDirection: "column", minHeight: "100%" }}>
                <DetailHeader title="정보" onBack={goBack} isDark={isDark} />
                <Box sx={{ flex: 1, overflowY: "auto", pb: 4 }}>
                    <SectionLabel>약관 & 정책</SectionLabel>
                    <SectionCard isDark={isDark}>
                        <SettingRow label="개인정보처리방침" onClick={() => setPrivacyOpen(true)} isDark={isDark} />
                        <SettingRow label="이용약관" onClick={() => setTermsOpen(true)} isDark={isDark} />
                        <SettingRow label="오픈소스 라이선스" onClick={() => setLicenseOpen(true)} isLast isDark={isDark} />
                    </SectionCard>

                    <SectionLabel>지원</SectionLabel>
                    <SectionCard isDark={isDark}>
                        <SettingRow label="문의하기" value="wawa9972@gmail.com" onClick={() => { window.location.href = "mailto:wawa9972@gmail.com"; }} isLast isDark={isDark} />
                    </SectionCard>

                    <SectionLabel>버전</SectionLabel>
                    <SectionCard isDark={isDark}>
                        <SettingRow label="현재 버전" value="v1.2.0" isDark={isDark} />
                        <SettingRow label="만든 곳" value="Plan Do!" isLast isDark={isDark} />
                    </SectionCard>
                </Box>
                <PrivacyPolicyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
                <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
                <OpenSourceLicenseModal open={licenseOpen} onClose={() => setLicenseOpen(false)} />
            </Box>
        );
    }

    // ── 메인 리스트 ───────────────────────────────────────────────
    return (
        <Box key={activeSection || "main"} sx={{ ...screenSlide, display: "flex", flexDirection: "column", minHeight: "100%", pb: "env(safe-area-inset-bottom, 16px)" }}>
            {/* 풀스크린 푸시 — 자체 헤더(< 더보기). 프로필·워크스페이스는 더보기 허브로 일원화. */}
            <DetailHeader title="환경설정" backLabel="더보기" onBack={() => navigate("/more")} isDark={isDark} />
            {alertBanners}

            <SectionLabel>일반</SectionLabel>
            <SectionCard isDark={isDark}>
                <SettingRow iconEl={<PaletteRoundedIcon sx={{ fontSize: 18 }} />} iconColor="#7C5CF0" label="화면" value={themeLabel} onClick={() => setActiveSection("display")} isDark={isDark} />
                <SettingRow iconEl={<TuneRoundedIcon sx={{ fontSize: 18 }} />} iconColor="#3B82F6" label="작업 기본값" value={priorityLabel} onClick={() => setActiveSection("tasks")} isDark={isDark} isLast />
            </SectionCard>

            <SectionLabel>홈 화면 위젯</SectionLabel>
            <SectionCard isDark={isDark}>
                <SettingRow iconEl={<WidgetsRoundedIcon sx={{ fontSize: 18 }} />} iconColor="#1B6FF5" label="위젯 미리보기" desc="홈 화면에서 보이는 모습 · 추가 방법" onClick={() => setWidgetOpen(true)} isDark={isDark} isLast />
            </SectionCard>

            <SectionLabel>알림</SectionLabel>
            <SectionCard isDark={isDark}>
                <SettingRow iconEl={<NotificationsRoundedIcon sx={{ fontSize: 18 }} />} iconColor="#F59E0B" label="알림" value={notifLabel} onClick={() => setActiveSection("notifications")} isDark={isDark} isLast />
            </SectionCard>

            <SectionLabel>데이터</SectionLabel>
            <SectionCard isDark={isDark}>
                <SettingRow iconEl={<FileDownloadRoundedIcon sx={{ fontSize: 18 }} />} iconColor="#10B981" label="데이터 내보내기" onClick={() => setActiveSection("data")} isDark={isDark} isLast />
            </SectionCard>

            <SectionLabel>정보</SectionLabel>
            <SectionCard isDark={isDark}>
                <SettingRow iconEl={<HelpOutlineRoundedIcon sx={{ fontSize: 18 }} />} iconColor="#64748B" label="정보" value="v1.2.0" onClick={() => setActiveSection("about")} isDark={isDark} isLast />
            </SectionCard>

            <SectionLabel>계정</SectionLabel>
            <SectionCard isDark={isDark}>
                {/* 여러 섹션을 한 번에 되돌리는 동작이라 섹션 안이 아니라 계정에 둔다 */}
                <SettingRow label="모든 설정 초기화" desc="화면·작업 기본값·알림을 기본값으로"
                    onClick={() => setConfirmResetAll(true)} isDestructive isDark={isDark} />
                <SettingRow label="로그아웃" onClick={handleLogout} isDestructive isDark={isDark} />
                <SettingRow label="회원 탈퇴" onClick={() => setConfirmDeleteAccount(true)} isDestructive isLast isDark={isDark} />
            </SectionCard>

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mt: 3, mb: 0.5 }}>
                <Chip size="small" label="Plan Do!" variant="outlined" />
                <Typography variant="caption" color="text.disabled">v1.2.0</Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 1 }}>
                <Typography variant="caption" color="text.disabled" sx={{ cursor: "pointer", "&:hover": { color: "text.secondary" } }} onClick={() => setPrivacyOpen(true)}>
                    개인정보처리방침
                </Typography>
            </Box>

            {dialogs}
            <PrivacyPolicyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
            <WidgetPreview isDark={isDark} open={widgetOpen} onClose={() => setWidgetOpen(false)} />
        </Box>
    );
}
