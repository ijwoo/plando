import React, { useState } from "react";
import { Box, Typography, Avatar, Stack, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HandshakeRoundedIcon from "@mui/icons-material/HandshakeRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";

import Press from "../../../shared/ui/primitives/Press.jsx";
import Sheet from "../../../shared/ui/primitives/Sheet.jsx";
import { SectionLabel, SettingsCard, SettingsRow, SettingsToggleRow } from "../../../shared/ui/common/SettingsList.jsx";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { DOCS_URL } from "../../../shared/constants/links.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { ROLE_LABEL } from "../../workspace/hooks/useWorkspacePermissions.js";
import { updateMySettings } from "../../settings/api/settingsApi.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";
import { getUser } from "../../../shared/utils/tokenUtils.js";
import { resolveImageUrl } from "../../../shared/utils/urlUtils.js";

/**
 * 모바일 "더보기" 허브 — 바텀네비 더보기 탭의 목적지(/more).
 * 환경설정이 아닌 부가 기능(지도·AI·템플릿·회고)과 워크스페이스·환경설정 진입을 한곳에.
 * 진짜 환경설정은 /settings로 분리(토스식: 설정 ≠ 더보기). 설정 화면과 동일 카드 컴포넌트 사용.
 */
export default function MorePage() {
    const navigate = useNavigate();
    const { currentWorkspace, workspaces, changeWorkspace } = useWorkspace();
    const user = getUser();

    const roleLabel = currentWorkspace ? (ROLE_LABEL[currentWorkspace.role] ?? currentWorkspace.role ?? "멤버") : "";
    const wsCount = workspaces?.length ?? 0;
    const multiWorkspace = wsCount > 1;
    const profileMeta = [user?.email, wsCount > 0 ? `워크스페이스 ${wsCount}개` : null].filter(Boolean).join("  ·  ");

    // 워크스페이스 아이콘 — 이미지 있으면 이미지(컨테이너 채움), 없으면 기본 아이콘
    const wsIconNode = (ws) => (ws?.iconImageUrl
        ? <Box component="img" src={resolveImageUrl(ws.iconImageUrl)} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "10px" }} />
        : <GroupsRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />);

    // 워크스페이스 전환 시트
    const [switcherOpen, setSwitcherOpen] = useState(false);
    const handleWorkspaceRow = () => (multiWorkspace ? setSwitcherOpen(true) : navigate("/settings?section=workspace"));
    const handleSwitch = (ws) => { changeWorkspace(ws); setSwitcherOpen(false); };

    // 다크모드 빠른 토글 — light↔dark 즉시 전환 + 앱 전체 리테마
    const [themeMode, setThemeMode] = useState(() => localStorage.getItem("settings.themeMode") || "light");
    const applyThemeMode = (mode) => {
        localStorage.setItem("settings.themeMode", mode);
        setThemeMode(mode);
        window.dispatchEvent(new Event(APP_EVENTS.SETTINGS_CHANGED));
    };
    const toggleDark = () => {
        const prev = themeMode;
        const next = prev === "dark" ? "light" : "dark";
        applyThemeMode(next);
        // 서버에도 영속(재로그인 유지) — 실패하면 되돌려서 UI가 거짓말하지 않게
        updateMySettings({ themeMode: next }).catch((err) => {
            applyThemeMode(prev);
            toast.error(getApiError(err, "테마 변경에 실패했어요."));
        });
    };

    // 팀원 초대 시트 — 워크스페이스 초대 코드 공유
    const [inviteOpen, setInviteOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const inviteCode = currentWorkspace?.inviteCode || "";
    const handleCopyInvite = async () => {
        try {
            await navigator.clipboard.writeText(inviteCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* ignore */ }
    };

    const openChat = () => window.dispatchEvent(new Event(APP_EVENTS.OPEN_CHAT));

    // 안내서는 앱 밖(정적 사이트)이라 새 탭으로 연다.
    // noopener: 새 탭에서 window.opener 로 이쪽을 건드리지 못하게.
    const openDocs = () => window.open(DOCS_URL, "_blank", "noopener,noreferrer");

    const FEATURES = [
        { icon: AutoAwesomeRoundedIcon, label: "AI 어시스턴트", desc: "말하듯 일정·할 일 추가", color: "#7C5CF0", onClick: openChat },
        { icon: PlaceRoundedIcon,       label: "지도 일정",     desc: "위치 기반 할 일",        color: "#EF4444", onClick: () => navigate("/map") },
        { icon: HandshakeRoundedIcon,   label: "팀 모집",       desc: "함께할 팀원 찾기",        color: "#F59E0B", onClick: () => navigate("/recruitments") },
        { icon: DescriptionRoundedIcon, label: "템플릿",        desc: "자주 쓰는 작업 양식",     color: "#3B82F6", onClick: () => navigate("/settings?section=templates") },
        { icon: InsightsRoundedIcon,    label: "주간 회고",     desc: "지난 한 주 돌아보기",     color: "#10B981", onClick: () => navigate("/wrap") },
        { icon: Inventory2RoundedIcon,  label: "아카이브",      desc: "완료·보관된 할 일",       color: "#64748B", onClick: () => navigate("/todos?view=archive") },
        { icon: MenuBookRoundedIcon,    label: "사용 안내서",   desc: "기능 설명·자주 묻는 질문", color: "#0EA5E9", onClick: openDocs },
    ];

    return (
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pb: "calc(env(safe-area-inset-bottom) + 96px)" }}>
            {/* 프로필 카드 → 계정 (설정의 프로필 섹션) */}
            <Box sx={{ px: 2, pt: "calc(env(safe-area-inset-top, 0px) + 16px)" }}>
                <Press
                    onClick={() => navigate("/settings?section=profile")}
                    haptic="light"
                    pressScale={0.99}
                    activeBg="var(--plando-surface-faint)"
                    style={{
                        display: "flex", alignItems: "center", gap: 12, width: "100%",
                        padding: "14px 16px",
                        borderRadius: "var(--plando-radius-card)",
                        background: "var(--plando-surface-card)",
                        boxShadow: "var(--plando-elev-1)",
                    }}
                >
                    <Avatar
                        src={user?.profileImageUrl ? resolveImageUrl(user.profileImageUrl) : undefined}
                        sx={{ width: 48, height: 48, fontSize: 18, fontWeight: 800, bgcolor: "primary.main" }}
                    >
                        {!user?.profileImageUrl && (user?.name?.[0] || user?.email?.[0] || "U").toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: 16.5, fontWeight: 800 }} noWrap>{user?.name || "—"}</Typography>
                            {roleLabel && (
                                <Box sx={{ flexShrink: 0, px: 0.75, py: "1px", borderRadius: "6px", fontSize: 11, fontWeight: 700, bgcolor: "var(--plando-surface-faint)", color: "text.secondary" }}>
                                    {roleLabel}
                                </Box>
                            )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" noWrap>{profileMeta}</Typography>
                    </Box>
                    <ChevronRightRoundedIcon sx={{ color: "text.disabled" }} />
                </Press>
            </Box>

            {/* 기능 */}
            <SectionLabel>기능</SectionLabel>
            <SettingsCard>
                {FEATURES.map((f, i) => (
                    <SettingsRow
                        key={f.label}
                        iconEl={<f.icon sx={{ fontSize: 18 }} />}
                        iconColor={f.color}
                        label={f.label}
                        desc={f.desc}
                        onClick={f.onClick}
                        isLast={i === FEATURES.length - 1}
                    />
                ))}
            </SettingsCard>

            {/* 워크스페이스 */}
            <SectionLabel>워크스페이스</SectionLabel>
            <SettingsCard>
                <SettingsRow
                    iconEl={wsIconNode(currentWorkspace)}
                    iconColor={currentWorkspace?.iconImageUrl ? undefined : "var(--plando-primary)"}
                    label={currentWorkspace?.workspaceName || "워크스페이스"}
                    desc={multiWorkspace
                        ? `${roleLabel || "멤버"} · 전환하려면 탭`
                        : roleLabel}
                    onClick={handleWorkspaceRow}
                    isLast={!inviteCode}
                />
                {inviteCode && (
                    <SettingsRow
                        iconEl={<PersonAddRoundedIcon sx={{ fontSize: 18 }} />}
                        iconColor="#0EA5E9"
                        label="팀원 초대"
                        desc="초대 코드로 멤버 추가"
                        onClick={() => setInviteOpen(true)}
                        isLast
                    />
                )}
            </SettingsCard>

            {/* 앱 */}
            <SectionLabel>앱</SectionLabel>
            <SettingsCard>
                <SettingsToggleRow
                    iconEl={<DarkModeRoundedIcon sx={{ fontSize: 18 }} />}
                    iconColor="#6366F1"
                    label="다크 모드"
                    checked={themeMode === "dark"}
                    onChange={toggleDark}
                />
                <SettingsRow
                    iconEl={<SettingsRoundedIcon sx={{ fontSize: 18 }} />}
                    iconColor="#64748B"
                    label="환경설정"
                    desc="화면·작업 기본값·알림"
                    onClick={() => navigate("/settings")}
                    isLast
                />
            </SettingsCard>

            {/* 워크스페이스 전환 시트 (2개 이상일 때) */}
            <Sheet
                open={switcherOpen}
                onClose={() => setSwitcherOpen(false)}
                height={`${90 + Math.min(wsCount, 6) * 64}px`}
                header={
                    <Box sx={{ px: 2.5, pt: 0.75, pb: 1.5 }}>
                        <Typography sx={{ fontSize: 17, fontWeight: 800 }}>워크스페이스 전환</Typography>
                    </Box>
                }
            >
                {workspaces.map((ws) => {
                    const active = String(ws.workspaceId) === String(currentWorkspace?.workspaceId);
                    return (
                        <Press
                            key={ws.workspaceId}
                            onClick={() => handleSwitch(ws)}
                            haptic="light"
                            activeBg="var(--plando-surface-faint)"
                            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 20px" }}
                        >
                            <Box sx={{ width: 36, height: 36, borderRadius: "10px", overflow: "hidden", bgcolor: "action.selected", display: "grid", placeItems: "center", flexShrink: 0 }}>
                                {wsIconNode(ws)}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                                <Typography sx={{ fontSize: 15, fontWeight: 700 }} noWrap>{ws.workspaceName}</Typography>
                                <Typography variant="caption" color="text.secondary">{ROLE_LABEL[ws.role] ?? ws.role ?? "멤버"}</Typography>
                            </Box>
                            {active && <CheckRoundedIcon sx={{ color: "primary.main", flexShrink: 0 }} />}
                        </Press>
                    );
                })}
            </Sheet>

            {/* 팀원 초대 시트 — 초대 코드 공유 */}
            <Sheet
                open={inviteOpen}
                onClose={() => setInviteOpen(false)}
                height="320px"
                header={
                    <Box sx={{ px: 2.5, pt: 0.75, pb: 1.5 }}>
                        <Typography sx={{ fontSize: 17, fontWeight: 800 }}>팀원 초대</Typography>
                    </Box>
                }
            >
                <Box sx={{ px: 2.5, pt: 1 }}>
                    <Typography sx={{ fontSize: 14, color: "text.secondary", lineHeight: 1.6, mb: 2 }}>
                        &quot;{currentWorkspace?.workspaceName}&quot; 워크스페이스 초대 코드를 공유하면 팀원이 참여할 수 있어요.
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 2, mb: 2, borderRadius: "var(--plando-radius-card)", bgcolor: "var(--plando-surface-low)" }}>
                        <Typography sx={{ fontSize: 26, fontWeight: 800, letterSpacing: 3, fontFamily: "monospace" }}>
                            {inviteCode || "—"}
                        </Typography>
                    </Box>
                    <Button
                        fullWidth variant="contained" disableElevation
                        startIcon={<ContentCopyRoundedIcon />}
                        onClick={handleCopyInvite}
                        sx={{ fontWeight: 700, borderRadius: 2, py: 1.1 }}
                    >
                        {copied ? "복사됨!" : "코드 복사"}
                    </Button>
                </Box>
            </Sheet>
        </Box>
    );
}
