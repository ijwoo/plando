import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { resolveImageUrl } from "../../../shared/utils/urlUtils.js";
import { fadeDividerSx } from "../../../shared/ui/glassSx.js";
import { fieldSx } from "../../../shared/ui/common/fieldStyles.jsx";
import { BRAND_COLOR } from "../../../shared/ui/tone.js";
import CustomThemePreview from "../components/CustomThemePreview.jsx";
import ThemePreview from "../components/ThemePreview.jsx";
import {
    Box, Typography, Stack, Switch,
    TextField, MenuItem, Chip, Alert, Avatar, IconButton,
    CircularProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import WorkspacesIcon from "@mui/icons-material/Workspaces";
import LogoutIcon from "@mui/icons-material/Logout";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import GroupIcon from "@mui/icons-material/Group";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";

import ConfirmDialog from "../../../shared/ui/common/ConfirmDialog.jsx";
import HeaderActionButton from "../../../shared/ui/common/HeaderActionButton.jsx";
import SegmentedControl from "../../../shared/ui/common/SegmentedControl.jsx";
import PrivacyPolicyModal from "../../../shared/ui/common/PrivacyPolicyModal.jsx";
import TermsModal from "../../../shared/ui/common/TermsModal.jsx";
import OpenSourceLicenseModal from "../../../shared/ui/common/OpenSourceLicenseModal.jsx";
import TransferOwnerDialog from "../../workspace/components/TransferOwnerDialog.jsx";
import TemplateManager from "../../todo/components/form/TemplateManager.jsx";
import { THEMES } from "../../../shared/ui/theme.js";
import { PRIORITY_OPTIONS } from "../../../shared/ui/tone.js";
import { ROLE_LABEL } from "../../workspace/hooks/useWorkspacePermissions.js";
import { RESET_CONFIRM_MESSAGE } from "../hooks/useSettingsState.js";

/* 카드를 전부 걷어내고 2열 그리드로 간다.
   카드가 계층을 뜻하지 않게 된 게 문제였다 — 같은 층위인데 어떤 그룹은 행 4개가 한 카드,
   어떤 그룹은 행 1개가 한 카드였다. 이제 그룹은 "섹션 제목 + 여백"이 만들고,
   경계는 얇은 구분선만 남긴다. 시선이 따라갈 세로선은 컨트롤 열 정렬이 대신한다. */
const ROW_GRID = {
    display: "grid",
    // md(900px) 아래에서는 1열로 접는다 — 260px 라벨열을 붙잡으면 컨트롤 쪽이 짓눌린다
    gridTemplateColumns: { xs: "1fr", md: "minmax(0, 260px) minmax(0, 1fr)" },
    columnGap: 5,
    rowGap: 1.25,
};

// 컨트롤 열 안에서 입력/선택이 지나치게 늘어나지 않게 잡아두는 상한
const CONTROL_MAX = 400;

/* 입력·선택은 로그인/회원가입과 같은 공용 fieldSx(12px radius, 얇은 테두리, 4px 포커스 링)를 쓴다.
   다만 fieldSx 는 단독 폼 기준이라 padding 14px / 폰트 15px다. 여기 컨트롤은 전부 size="small"이고
   왼쪽 라벨 열과 같은 줄에 서기 때문에, 그대로 두면 행이 눈에 띄게 높아지고 라벨과 세로 중심이
   어긋난다. 공용 스타일은 그대로 두고 이 페이지에서만 small 치수로 되돌린다.
   (색은 테마에서 나오므로 라이트/다크 모두 자동으로 맞는다.) */
const SETTING_FIELD_SX = [
    fieldSx,
    {
        "& .MuiOutlinedInput-input": { padding: "8.5px 12px", fontSize: 14 },
        "& .MuiSelect-select": { padding: "8.5px 12px", fontSize: 14 },
    },
];

/** 문의처 — 인증 메일 발신 주소와 같다(사용자가 이미 보고 있는 주소). */
const SUPPORT_EMAIL = "wawa9972@gmail.com";
const SUPPORT_MAILTO =
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent("[Plan Do!] 문의")}` +
    `&body=${encodeURIComponent("어떤 상황에서 무엇이 안 되었는지 적어주시면 빠르게 확인할 수 있어요.\n\n- 사용 환경(웹 / iPhone 앱):\n- 무엇을 하려 했나:\n- 무슨 일이 일어났나:\n")}`;

function SectionHeader({ title, description }) {
    return (
        <Box sx={{ mb: 1 }}>
            {/* 타입 토큰 title1 — 20px/900(스케일 밖)에서 교체 */}
            <Typography sx={{
                fontSize: "var(--plando-type-title1-size)",
                fontWeight: "var(--plando-type-title1-weight)",
                letterSpacing: "var(--plando-type-title1-ls)",
            }}>{title}</Typography>
            {description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {description}
                </Typography>
            )}
        </Box>
    );
}

/**
 * 설정 한 줄 — 왼쪽 라벨/설명, 오른쪽 컨트롤(열 왼쪽 정렬).
 * alignTop: 컨트롤이 높을 때(테마 그리드·미리보기) 라벨을 위에 붙인다.
 * note: 컨트롤 아래 보조 안내 — 컨트롤 열 안에 두어야 정렬이 안 깨진다.
 */
function SettingRow({ label, description, action, note, last = false, alignTop = false, sx }) {
    return (
        <Box
            sx={{
                ...ROW_GRID,
                py: 2,
                alignItems: { xs: "stretch", md: alignTop ? "flex-start" : "center" },
                ...(last ? {} : fadeDividerSx("var(--plando-divider)", "bottom")),
                ...sx,
            }}
        >
            <Box sx={{ minWidth: 0 }}>
                {/* 라벨/설명에 뱃지 같은 노드가 들어오므로 component="div" — p 안의 div는 잘못된 마크업 */}
                <Typography variant="body2" component="div" sx={{ fontWeight: 600 }}>{label}</Typography>
                {description && (
                    <Typography variant="caption" component="div" color="text.secondary" sx={{ mt: 0.25, lineHeight: 1.5 }}>
                        {description}
                    </Typography>
                )}
            </Box>
            <Box sx={{ minWidth: 0 }}>
                {/* 오른쪽 끝이 아니라 "컨트롤 열의 왼쪽"에 붙인다 — 행마다 컨트롤 x가 달라지던 게 산만함의 원인이었다 */}
                <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, minWidth: 0 }}>
                    {action}
                </Box>
                {note && <Box sx={{ mt: 1.25 }}>{note}</Box>}
            </Box>
        </Box>
    );
}

/** 섹션 — Card/Paper 없이 작은 제목 + 행들. 그룹 간격은 테두리가 아니라 margin이 만든다. */
// 섹션 간격 — 처음엔 mt:5(40px)였는데 행의 py까지 더해져 섹션 사이가 100px 넘게 비었다.
// 상자를 걷어낸 자리를 여백으로 채우려다 페이지가 성기게 흩어졌다. 제목이 이미 묶음을
// 알려주므로 간격은 그보다 좁아도 된다.
function SettingSection({ title, first = false, children, sx }) {
    return (
        <Box sx={{ mt: first ? 2 : 3.5, ...sx }}>
            {title && (
                <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ display: "flex", alignItems: "center", gap: 0.75, fontWeight: 800, letterSpacing: 0.4, lineHeight: 1.8 }}
                >
                    {title}
                </Typography>
            )}
            {children}
        </Box>
    );
}

/**
 * 위험 구역 — 빨간 테두리 카드를 없앤다.
 * 제일 드물게 쓰는 기능이 화면에서 제일 강했던 게 문제였다. 맨 아래 구분선 뒤로 내리고
 * 빨강은 버튼에만 남긴다(컨테이너·테두리 착색 없음).
 */
function DangerZone({ children }) {
    return (
        <Box sx={{ mt: 7, pt: 3, ...fadeDividerSx("var(--plando-divider)", "top") }}>
            <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: "block", fontWeight: 800, letterSpacing: 0.4, lineHeight: 1.8 }}
            >
                위험 구역
            </Typography>
            {children}
        </Box>
    );
}

/** 카드 대신 쓰는 빈 상태 문구 (워크스페이스 미선택 등) */
function EmptyNote({ children }) {
    return (
        <Typography variant="body2" color="text.secondary" sx={{ py: 5 }}>
            {children}
        </Typography>
    );
}

// SettingRow의 action으로 쓰는 셀렉트 (설정 값 선택 공용)
function SelectAction({ value, onChange, children }) {
    return (
        <TextField select size="small" value={value} onChange={onChange} sx={[...SETTING_FIELD_SX, { minWidth: 160 }]}>
            {children}
        </TextField>
    );
}

// 커스텀 테마 색상 입력 (기준/카드/배경 색상 공용)
function ColorSwatchInput({ value, onChange }) {
    return (
        <Box
            component="input"
            type="color"
            value={value}
            onChange={onChange}
            sx={{
                width: 40, height: 30, border: "1px solid", borderColor: "divider",
                borderRadius: "var(--plando-radius-sm)", cursor: "pointer", p: 0, bgcolor: "transparent",
            }}
        />
    );
}

export default function SettingsPageDesktop({ s }) {
    const location = useLocation();
    const [activeSection, setActiveSection] = useState(location.state?.section ?? "profile");

    // 사이드바 설정 패널에서 섹션 클릭 시 navigation-state로 전달 → 해당 섹션 열기
    useEffect(() => {
        const sec = location.state?.section;
        if (sec) setActiveSection(sec);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.key]);
    const [privacyOpen, setPrivacyOpen] = useState(false);
    const [termsOpen, setTermsOpen] = useState(false);
    const [licenseOpen, setLicenseOpen] = useState(false);

    const {
        userEmail, displayName, setDisplayName, profileImageUrl, uploadingImage,
        savedDisplayName, displayNameSaving, handleDisplayNameSave,
        provider, kakaoLinked, unlinkLoading, setErrorMessage,
        showPasswordCard, canResetPassword, passwordUnavailableReason, canUnlinkKakao, kakaoUnlinkBlocked,
        confirmKakaoUnlink, setConfirmKakaoUnlink, fileInputRef, handleProfileImageChange, handleKakaoUnlink,
        themeMode, setThemeMode, customColor, setCustomColor, customBgColor, setCustomBgColor,
        customBaseMode, setCustomBaseMode, customCardColor, setCustomCardColor,
        sidebarCollapsed, setSidebarCollapsed,
        defaultPriority, setDefaultPriority,
        calendarDefaultView, setCalendarDefaultView,
        defaultDue, setDefaultDue,
        autoArchiveDays, setAutoArchiveDays,
        dueReminderLeadDays, setDueReminderLeadDays,
        push, notificationEnabled, setNotificationEnabled, notifyMention, setNotifyMention, notifyDm, setNotifyDm,
        notifyDueDate, setNotifyDueDate, notifyAssignment, setNotifyAssignment, notifyComment, setNotifyComment,
        currentWorkspace, workspaceMembers, canManageWs, membersExpanded, setMembersExpanded, MEMBERS_PREVIEW,
        editingWsName, setEditingWsName, wsIconInputRef, wsNameSaving,
        uploadingWsIcon, handleWsNameSave, handleWsIconChange,
        wsActions,
        confirmDeleteAccount, setConfirmDeleteAccount, actionLoading,
        handleDeleteAccount, handleLogout, handleCopyInviteCode,
        confirmResetAll, setConfirmResetAll, resetting, handleResetAll,
        errorMessage,
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

    const renderContent = () => {
        switch (activeSection) {

            case "profile": return (
                <Box>
                    <SectionHeader title="프로필" description="이름과 사진을 설정하세요." />

                    <SettingSection first>
                        <SettingRow
                            label="프로필 사진"
                            description="정사각형 이미지를 권장해요"
                            action={
                                <Stack direction="row" alignItems="center" spacing={2}>
                                    <Box sx={{ position: "relative", flexShrink: 0 }}>
                                        <Avatar src={resolveImageUrl(profileImageUrl)} sx={{ width: 64, height: 64, fontSize: 24, fontWeight: 800 }}>
                                            {!profileImageUrl && (displayName?.[0] || userEmail?.[0] || "U").toUpperCase()}
                                        </Avatar>
                                        <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}
                                            sx={{ position: "absolute", bottom: -4, right: -4, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", width: 26, height: 26, "&:hover": { bgcolor: "action.hover" } }}>
                                            {uploadingImage ? <CircularProgress size={13} /> : <CameraAltIcon sx={{ fontSize: 13 }} />}
                                        </IconButton>
                                        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleProfileImageChange} />
                                    </Box>
                                    {/* 가짜 링크(Typography+onClick) → 공용 버튼. 채운 버튼은 탭당 하나만 두기로 해서 outlined 톤 */}
                                    <HeaderActionButton variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                                        사진 변경
                                    </HeaderActionButton>
                                </Stack>
                            }
                        />
                        <SettingRow
                            label="표시 이름"
                            description="댓글·멤버 목록에 보이는 이름"
                            action={
                                /* 자유 입력이라 즉시 저장하지 않고 "변경"으로만 저장 (모바일과 동일한 문법) */
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%", maxWidth: CONTROL_MAX }}>
                                    <TextField size="small" placeholder="이름을 입력하세요" value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)} fullWidth sx={SETTING_FIELD_SX}
                                        onKeyDown={(e) => { if (e.key === "Enter") handleDisplayNameSave(); }} />
                                    {/* 프로필 탭의 유일한 주 액션 — 채운 버튼은 여기 하나 */}
                                    <HeaderActionButton onClick={handleDisplayNameSave}
                                        disabled={displayNameSaving || !displayName.trim() || displayName.trim() === savedDisplayName}
                                        sx={{ whiteSpace: "nowrap" }}>
                                        {displayNameSaving ? <CircularProgress size={14} color="inherit" /> : "변경"}
                                    </HeaderActionButton>
                                </Stack>
                            }
                        />
                        <SettingRow
                            last
                            label="이메일"
                            description="로그인에 사용하는 주소예요"
                            action={<Typography variant="body2" color="text.secondary">{userEmail}</Typography>}
                        />
                    </SettingSection>

                    <SettingSection title="소셜 계정 연동">
                        <SettingRow
                            last
                            label={
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: BRAND_COLOR.KAKAO, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12, color: "#3C1E1E", flexShrink: 0 }}>K</Box>
                                    <span>카카오</span>
                                </Stack>
                            }
                            description={
                                /* 해제 불가 사유를 여기서 미리 밝힌다 — 누른 뒤 400을 보고 알게 하면 안 됨 */
                                provider === "KAKAO" ? "카카오 전용 계정"
                                    : kakaoLinked
                                        ? (kakaoUnlinkBlocked
                                            ? "연동됨 · 비밀번호가 없는 계정이라 해제하면 로그인할 수단이 사라져요"
                                            : "연동됨 · 카카오 로그인 사용 가능")
                                        : "미연동 · 같은 이메일로 카카오 로그인하면 자동 연동돼요"
                            }
                            action={
                                provider === "KAKAO" ? (
                                    <Chip label="전용" size="small" sx={{ bgcolor: BRAND_COLOR.KAKAO, fontWeight: 700 }} />
                                ) : kakaoLinked ? (
                                    /* 숨기지 않고 비활성 — 연동된 계정에서 해제 버튼만 사라지면 고장으로 보인다 */
                                    <HeaderActionButton variant="danger" disabled={unlinkLoading || !canUnlinkKakao} onClick={() => setConfirmKakaoUnlink(true)}>연동 해제</HeaderActionButton>
                                ) : (
                                    <Chip label="미연동" size="small" variant="outlined" />
                                )
                            }
                        />
                    </SettingSection>
                </Box>
            );

            case "display": return (
                <Box>
                    <SectionHeader title="화면 설정" description="테마와 레이아웃을 조정하세요." />

                    <SettingSection first title="테마">
                        <SettingRow
                            alignTop
                            last={themeMode !== "custom"}
                            label="테마"
                            description="앱 전체의 배경과 강조 색을 정해요"
                            action={
                                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 1.25, width: "100%" }}>
                                    {THEMES.map((t) => (
                                        <ThemePreview
                                            key={t.key}
                                            theme={t}
                                            selected={themeMode === t.key}
                                            onClick={() => setThemeMode(t.key)}
                                        />
                                    ))}
                                    <ThemePreview
                                        theme={{ label: "커스텀", color: customBgColor, dot: customColor }}
                                        selected={themeMode === "custom"}
                                        onClick={() => setThemeMode("custom")}
                                    />
                                </Box>
                            }
                        />
                        {/* 커스텀 설정도 같은 행 문법으로 — 카드 안 또 카드(중첩 박스)를 없앤다 */}
                        {themeMode === "custom" && (
                            <>
                                <SettingRow
                                    label="기준 색상"
                                    description="버튼·강조에 쓰는 색"
                                    action={
                                        <>
                                            <ColorSwatchInput value={customColor} onChange={(e) => setCustomColor(e.target.value)} />
                                            <Typography variant="caption" color="text.secondary">{customColor.toUpperCase()}</Typography>
                                        </>
                                    }
                                />
                                <SettingRow
                                    label="배경 모드"
                                    description="밝은 바탕과 어두운 바탕 중 선택"
                                    action={
                                        <Stack direction="row" spacing={0.75}>
                                            {[{ value: "light", label: "라이트", defaultBg: "#F6F7FB" }, { value: "dark", label: "다크", defaultBg: "#0B0F14" }].map((m) => (
                                                <Chip key={m.value} size="small" label={m.label}
                                                    variant={customBaseMode === m.value ? "filled" : "outlined"}
                                                    color={customBaseMode === m.value ? "primary" : "default"}
                                                    onClick={() => { setCustomBaseMode(m.value); setCustomBgColor(m.defaultBg); }}
                                                    sx={{ cursor: "pointer" }} />
                                            ))}
                                        </Stack>
                                    }
                                />
                                <SettingRow
                                    label="카드 색상"
                                    description="비워두면 배경색에 맞춰 자동으로 정해요"
                                    action={
                                        <>
                                            <ColorSwatchInput value={customCardColor || "#FFFFFF"} onChange={(e) => setCustomCardColor(e.target.value)} />
                                            <Typography variant="caption" color="text.secondary">
                                                {customCardColor ? customCardColor.toUpperCase() : "자동"}
                                            </Typography>
                                            {customCardColor && (
                                                <HeaderActionButton variant="ghost" onClick={() => setCustomCardColor("")}>
                                                    재설정
                                                </HeaderActionButton>
                                            )}
                                        </>
                                    }
                                />
                                <SettingRow
                                    label="배경 색상"
                                    description="앱 바탕색"
                                    action={
                                        <>
                                            <ColorSwatchInput value={customBgColor} onChange={(e) => setCustomBgColor(e.target.value)} />
                                            <Typography variant="caption" color="text.secondary">{customBgColor.toUpperCase()}</Typography>
                                        </>
                                    }
                                />
                                <SettingRow
                                    last
                                    alignTop
                                    label="미리보기"
                                    description="선택한 값이 실제로 어떻게 보이는지"
                                    action={
                                        <Box sx={{ width: "100%", maxWidth: CONTROL_MAX }}>
                                            <CustomThemePreview
                                                primaryColor={customColor}
                                                baseMode={customBaseMode}
                                                bgColor={customBgColor}
                                                cardColor={customCardColor}
                                            />
                                        </Box>
                                    }
                                />
                            </>
                        )}
                    </SettingSection>

                    <SettingSection title="캘린더">
                        <SettingRow last
                            label="기본 보기"
                            description="캘린더를 열 때 처음 보여줄 형태"
                            action={
                                <SelectAction value={calendarDefaultView} onChange={(e) => setCalendarDefaultView(e.target.value)}>
                                    <MenuItem value="month">월</MenuItem>
                                    <MenuItem value="week">주</MenuItem>
                                    <MenuItem value="day">일</MenuItem>
                                </SelectAction>
                            }
                        />
                    </SettingSection>

                    <SettingSection title="레이아웃">
                        <SettingRow last
                            label="사이드바 기본 접힘"
                            description="앱을 열 때 사이드바를 접힌 상태로 시작해요"
                            action={<Switch checked={sidebarCollapsed} onChange={(e) => setSidebarCollapsed(e.target.checked)} />}
                        />
                    </SettingSection>

                    {/* 「홈 화면 위젯」 섹션은 여기 없다 — 위젯은 iOS WidgetKit 확장이라
                        데스크탑 브라우저에서는 추가할 수도, 보여줄 수도 없다.
                        (모바일 설정에는 남아 있음: Capacitor iOS 셸에서는 실제로 유효한 안내) */}
                </Box>
            );

            case "tasks": return (
                <Box>
                    <SectionHeader title="작업 기본값" description="할 일을 새로 만들 때 자동으로 채워질 값을 설정하세요." />

                    <SettingSection first title="새 할 일 기본값">
                        <SettingRow
                            label="기본 우선순위"
                            description="새 할 일에 미리 선택될 우선순위"
                            action={
                                <SegmentedControl
                                    options={PRIORITY_OPTIONS}
                                    value={defaultPriority}
                                    onChange={setDefaultPriority}
                                    fullWidth
                                    sx={{ width: "100%", maxWidth: 280 }}
                                />
                            }
                        />
                        <SettingRow last
                            label="기본 마감일"
                            description="새 할 일에 자동으로 들어갈 마감일"
                            action={
                                <SelectAction value={defaultDue} onChange={(e) => setDefaultDue(e.target.value)}>
                                    <MenuItem value="none">없음</MenuItem>
                                    <MenuItem value="today">오늘</MenuItem>
                                    <MenuItem value="tomorrow">내일</MenuItem>
                                    <MenuItem value="week">이번 주</MenuItem>
                                </SelectAction>
                            }
                        />
                    </SettingSection>

                    <SettingSection title="정리">
                        <SettingRow last
                            label="완료 항목 자동 보관"
                            description="내가 만든 완료 할 일을 일정 기간 후 보관함으로 옮겨요"
                            action={
                                <SelectAction value={autoArchiveDays} onChange={(e) => setAutoArchiveDays(Number(e.target.value))}>
                                    <MenuItem value={0}>안 함</MenuItem>
                                    <MenuItem value={7}>1주 후</MenuItem>
                                    <MenuItem value={14}>2주 후</MenuItem>
                                    <MenuItem value={30}>1개월 후</MenuItem>
                                </SelectAction>
                            }
                        />
                    </SettingSection>

                    <SettingSection title="데이터 내보내기">
                        {exportError && <Alert severity="error" sx={{ mt: 1, borderRadius: 2 }} onClose={() => setExportError("")}>{exportError}</Alert>}
                        <SettingRow last
                            label="CSV로 내보내기"
                            description={
                                currentWorkspace
                                    ? `"${currentWorkspace.workspaceName}" 워크스페이스의 모든 할 일을 CSV 파일로 내려받아요. 엑셀·구글 시트에서 바로 열 수 있어요.`
                                    : "워크스페이스를 선택하면 할 일을 내보낼 수 있어요."
                            }
                            action={
                                /* 작업 기본값 탭의 유일한 실행 액션 — 채운 버튼은 여기 하나 */
                                <HeaderActionButton
                                    icon={exporting ? <CircularProgress size={14} color="inherit" /> : <FileDownloadRoundedIcon sx={{ fontSize: 17 }} />}
                                    disabled={!currentWorkspace || exporting}
                                    onClick={handleExportCsv}
                                >
                                    {exporting ? "내보내는 중…" : "CSV로 내보내기"}
                                </HeaderActionButton>
                            }
                        />
                    </SettingSection>
                </Box>
            );

            case "notifications": return (
                <Box>
                    <SectionHeader title="알림" description="어디서, 어떤 활동을 알림 받을지 설정하세요." />

                    <SettingSection first title="알림을 어디서 받을지">
                        <SettingRow
                            label="인앱 알림"
                            description="앱 사용 중 상단 벨 아이콘으로 받는 알림"
                            action={<Switch checked={notificationEnabled} onChange={(e) => setNotificationEnabled(e.target.checked)} />}
                        />
                        <SettingRow last
                            label="앱 푸시 알림"
                            description={
                                push.needsInstall ? "홈 화면에 추가 후 사용할 수 있어요"
                                : !push.supported ? "이 브라우저는 푸시 알림을 지원하지 않아요"
                                : push.permission === "denied" ? "브라우저 설정에서 알림 권한을 허용해주세요"
                                : push.subscribed ? "앱이 꺼져 있어도 알림을 받아요"
                                : "앱 종료 후에도 백그라운드 알림을 받아요"
                            }
                            action={
                                <Switch checked={push.subscribed}
                                    disabled={push.needsInstall || !push.supported || push.loading || push.permission === "denied"}
                                    onChange={(e) => e.target.checked ? push.subscribe() : push.unsubscribe()} />
                            }
                            /* 설치 안내는 컨트롤 열 안에 둔다 — 밖으로 빼면 열 정렬이 깨진다 */
                            note={push.needsInstall && (
                                <Box sx={{ px: 1.5, py: 1.25, borderRadius: 2, bgcolor: "action.hover", maxWidth: CONTROL_MAX }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                                        Safari에서 푸시 알림을 받으려면 홈 화면에 앱을 추가해야 해요.{"\n"}
                                        하단의 <strong>공유 버튼(□↑)</strong> → <strong>홈 화면에 추가</strong>를 탭한 뒤 추가된 아이콘으로 열어주세요.
                                    </Typography>
                                </Box>
                            )}
                        />
                    </SettingSection>

                    {/* 인앱 알림이 꺼지면 하위 설정은 의미가 없다 — 카드가 아니라 섹션이 흐려진다 */}
                    <SettingSection
                        title="어떤 활동을 알림 받을지"
                        sx={{ opacity: notificationEnabled ? 1 : 0.45, pointerEvents: notificationEnabled ? "auto" : "none", transition: "opacity 0.2s" }}
                    >
                        <SettingRow
                            label="담당자 지정"
                            description="할 일에 나를 담당자로 지정했을 때"
                            action={<Switch checked={notifyAssignment} onChange={(e) => setNotifyAssignment(e.target.checked)} />}
                        />
                        <SettingRow
                            label="마감일"
                            description="내가 담당한 할 일의 마감일이 다가올 때"
                            action={<Switch checked={notifyDueDate} onChange={(e) => setNotifyDueDate(e.target.checked)} />}
                        />
                        <SettingRow
                            label="댓글"
                            description="내 할 일이나 내가 참여한 스레드에 댓글이 달렸을 때"
                            action={<Switch checked={notifyComment} onChange={(e) => setNotifyComment(e.target.checked)} />}
                        />
                        <SettingRow
                            label="@멘션"
                            description="댓글에서 나를 언급했을 때"
                            action={<Switch checked={notifyMention} onChange={(e) => setNotifyMention(e.target.checked)} />}
                        />
                        <SettingRow last
                            label="다이렉트 메시지"
                            description="DM 메시지 또는 파일을 받았을 때"
                            action={<Switch checked={notifyDm} onChange={(e) => setNotifyDm(e.target.checked)} />}
                        />
                    </SettingSection>

                    <SettingSection
                        title="마감 리마인더"
                        sx={{ opacity: (notificationEnabled && notifyDueDate) ? 1 : 0.45, pointerEvents: (notificationEnabled && notifyDueDate) ? "auto" : "none", transition: "opacity 0.2s" }}
                    >
                        <SettingRow last
                            label="알림 시점"
                            description="마감 며칠 전에 미리 알려드릴지 (오전 9시 발송)"
                            action={
                                <SelectAction value={dueReminderLeadDays} onChange={(e) => setDueReminderLeadDays(Number(e.target.value))}>
                                    <MenuItem value={0}>당일</MenuItem>
                                    <MenuItem value={1}>1일 전</MenuItem>
                                    <MenuItem value={3}>3일 전</MenuItem>
                                </SelectAction>
                            }
                        />
                    </SettingSection>
                </Box>
            );

            case "workspace": return (
                <Box>
                    <SectionHeader title="워크스페이스" description="멤버를 관리하고 초대 코드를 공유하세요." />

                    {!currentWorkspace ? (
                        <EmptyNote>현재 선택된 워크스페이스가 없어요.</EmptyNote>
                    ) : (
                        <>
                            {wsErrorMsg && <Alert severity="error" sx={{ mt: 2 }} onClose={clearWsError}>{wsErrorMsg}</Alert>}

                            <SettingSection first>
                                <SettingRow
                                    label="아이콘"
                                    description={canManageWs ? "사이드바와 목록에 보이는 아이콘" : "관리자만 변경할 수 있어요"}
                                    action={
                                        <Box sx={{ position: "relative", flexShrink: 0 }}>
                                            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.12), display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                                                {currentWorkspace.iconImageUrl
                                                    ? <Box component="img" src={currentWorkspace.iconImageUrl} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                    : <WorkspacesIcon sx={{ color: "primary.main", fontSize: 22 }} />}
                                            </Box>
                                            {canManageWs && (
                                                <>
                                                    <IconButton size="small" onClick={() => wsIconInputRef.current?.click()} disabled={uploadingWsIcon}
                                                        sx={{ position: "absolute", bottom: -4, right: -4, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", width: 22, height: 22, "&:hover": { bgcolor: "action.hover" } }}>
                                                        {uploadingWsIcon ? <CircularProgress size={11} /> : <CameraAltIcon sx={{ fontSize: 11 }} />}
                                                    </IconButton>
                                                    <input ref={wsIconInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleWsIconChange} />
                                                </>
                                            )}
                                        </Box>
                                    }
                                />
                                <SettingRow
                                    label="이름"
                                    description="멤버 모두에게 보이는 이름"
                                    action={
                                        canManageWs ? (
                                            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%", maxWidth: CONTROL_MAX }}>
                                                <TextField size="small" value={editingWsName} onChange={(e) => setEditingWsName(e.target.value)}
                                                    fullWidth sx={[...SETTING_FIELD_SX, { "& input": { fontWeight: 700 } }]} />
                                                <HeaderActionButton variant="secondary" onClick={handleWsNameSave}
                                                    disabled={wsNameSaving || !editingWsName.trim() || editingWsName.trim() === currentWorkspace.workspaceName}
                                                    sx={{ whiteSpace: "nowrap" }}>
                                                    {wsNameSaving ? <CircularProgress size={14} color="inherit" /> : "변경"}
                                                </HeaderActionButton>
                                            </Stack>
                                        ) : (
                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{currentWorkspace.workspaceName}</Typography>
                                        )
                                    }
                                />
                                <SettingRow
                                    label="내 역할"
                                    description="역할에 따라 관리 권한이 달라져요"
                                    action={
                                        <Chip size="small" color={currentWorkspace.role === "OWNER" ? "primary" : "default"}
                                            label={ROLE_LABEL[currentWorkspace.role] ?? currentWorkspace.role ?? "멤버"}
                                            variant={currentWorkspace.role === "OWNER" ? "filled" : "outlined"}
                                            sx={{ height: 22, fontSize: 11 }} />
                                    }
                                />
                                <SettingRow last
                                    label="초대 코드"
                                    description="이 코드를 받은 사람은 워크스페이스에 참여할 수 있어요"
                                    action={
                                        <Stack direction="row" spacing={1} sx={{ width: "100%", maxWidth: CONTROL_MAX }}>
                                            <TextField size="small" value={currentWorkspace.inviteCode || ""} fullWidth sx={SETTING_FIELD_SX}
                                                InputProps={{ readOnly: true, sx: { fontFamily: "monospace", letterSpacing: 1 } }} />
                                            {/* 워크스페이스 탭의 주 액션(코드 공유) — 채운 버튼은 여기 하나 */}
                                            <HeaderActionButton icon={<ContentCopyIcon sx={{ fontSize: 16 }} />} onClick={handleCopyInviteCode} disabled={!currentWorkspace.inviteCode} sx={{ whiteSpace: "nowrap" }}>복사</HeaderActionButton>
                                        </Stack>
                                    }
                                />
                            </SettingSection>

                            <SettingSection title={<><GroupIcon sx={{ fontSize: 16 }} />{`멤버 (${workspaceMembers.length})`}</>}>
                                {workspaceMembers.length === 0 ? (
                                    <EmptyNote>참여 중인 멤버가 없어요.</EmptyNote>
                                ) : (
                                    <>
                                        {/* 멤버도 같은 행 문법 — 이름/이메일은 라벨 열, 역할은 컨트롤 열에 정렬된다 */}
                                        {(membersExpanded ? workspaceMembers : workspaceMembers.slice(0, MEMBERS_PREVIEW)).map((member, idx, arr) => {
                                            const isMe = member.email === userEmail;
                                            const roleLabel = ROLE_LABEL[member.role] ?? member.role;
                                            return (
                                                <SettingRow
                                                    key={member.email}
                                                    last={idx === arr.length - 1}
                                                    sx={{ py: 1.75 }}
                                                    label={
                                                        <Box component="span" sx={{ color: isMe ? "primary.main" : "inherit", fontWeight: isMe ? 700 : 600 }}>
                                                            {member.name || "-"}{isMe ? " (나)" : ""}
                                                        </Box>
                                                    }
                                                    description={member.email}
                                                    action={roleLabel
                                                        ? <Chip size="small" label={roleLabel} color={member.role === "OWNER" ? "primary" : "default"} variant="outlined" sx={{ height: 22, fontSize: 11 }} />
                                                        : null}
                                                />
                                            );
                                        })}
                                        {workspaceMembers.length > MEMBERS_PREVIEW && (
                                            <Box sx={{ pt: 1.5 }}>
                                                <HeaderActionButton variant="ghost" onClick={() => setMembersExpanded(v => !v)}>
                                                    {membersExpanded ? "접기" : `${workspaceMembers.length - MEMBERS_PREVIEW}명 더 보기`}
                                                </HeaderActionButton>
                                            </Box>
                                        )}
                                    </>
                                )}
                            </SettingSection>

                            <DangerZone>
                                {currentWorkspace.role === "OWNER" ? (
                                    <SettingRow last
                                        label="워크스페이스 삭제"
                                        description="모든 할 일과 멤버 정보가 영구적으로 삭제돼요."
                                        action={
                                            <HeaderActionButton variant="danger" icon={<DeleteOutlineIcon sx={{ fontSize: 17 }} />}
                                                onClick={() => wsHandleDeleteClick(currentWorkspace)}>
                                                삭제
                                            </HeaderActionButton>
                                        }
                                    />
                                ) : (
                                    <SettingRow last
                                        label="워크스페이스 나가기"
                                        description="나간 후 재참여하려면 초대 코드가 필요해요."
                                        action={
                                            <HeaderActionButton variant="danger" icon={<ExitToAppIcon sx={{ fontSize: 17 }} />}
                                                onClick={() => wsHandleLeaveClick(currentWorkspace, workspaceMembers)}>
                                                나가기
                                            </HeaderActionButton>
                                        }
                                    />
                                )}
                            </DangerZone>
                        </>
                    )}
                </Box>
            );

            case "templates": return (
                <Box>
                    <SectionHeader title="태스크 템플릿" description="자주 쓰는 할 일 구조를 저장해두고 빠르게 적용하세요." />
                    {!currentWorkspace ? (
                        <EmptyNote>워크스페이스를 선택해야 템플릿을 관리할 수 있어요.</EmptyNote>
                    ) : (
                        <Box sx={{ mt: 2 }}>
                            <TemplateManager workspaceId={currentWorkspace.workspaceId} />
                        </Box>
                    )}
                </Box>
            );

            case "account": return (
                <Box>
                    <SectionHeader title="계정" description="로그아웃하거나 계정을 삭제하세요." />

                    {errorMessage && <Alert severity="error" onClose={() => setErrorMessage("")} sx={{ mt: 2 }}>{errorMessage}</Alert>}

                    {/* 도움말·문의 — 예전엔 사용자가 문제를 알릴 곳이 웹·앱·문서 어디에도 없었다.
                        오류 추적은 "터졌다"를 잡지만 "불편하다"는 못 잡는다. */}
                    <SettingSection first title="도움말">
                        <SettingRow
                            label="사용 안내서"
                            description="기능별 사용법과 자주 묻는 질문을 정리해 두었어요."
                            action={
                                <Button
                                    variant="outlined"
                                    size="small"
                                    href="/docs/"
                                    target="_blank"
                                    rel="noopener"
                                    sx={{ maxWidth: CONTROL_MAX }}
                                >
                                    열기
                                </Button>
                            }
                        />
                        <SettingRow last
                            label="문의하기"
                            description={`고장이나 불편한 점을 알려주세요. ${SUPPORT_EMAIL} 으로 메일이 열려요.`}
                            action={
                                <Button
                                    variant="outlined"
                                    size="small"
                                    href={SUPPORT_MAILTO}
                                    sx={{ maxWidth: CONTROL_MAX }}
                                >
                                    메일 보내기
                                </Button>
                            }
                        />
                    </SettingSection>

                    {showPasswordCard && (
                        <SettingSection first title="보안">
                            <SettingRow last
                                label="비밀번호 변경"
                                description={pwResetSent ? undefined : (
                                    /* 비밀번호가 없으면 서버가 메일을 보내지 않는다 — 안내부터 사실대로 바꾼다 */
                                    passwordUnavailableReason || `이메일(${userEmail})로 비밀번호 재설정 링크를 보내드려요.`
                                )}
                                action={pwResetSent ? (
                                    <Alert severity="success" sx={{ fontSize: 13, width: "100%", maxWidth: CONTROL_MAX }}>
                                        <strong>{userEmail}</strong>로 비밀번호 재설정 메일을 보냈어요.
                                    </Alert>
                                ) : (
                                    /* 눌러도 성공할 수 없는 버튼은 감추지 말고 비활성으로 — 왼쪽 설명이 이유를 말한다.
                                       계정 탭의 유일한 실행 액션이라 채운 버튼은 여기 하나 */
                                    <HeaderActionButton onClick={handlePasswordReset} disabled={pwResetSending || !canResetPassword}
                                        icon={pwResetSending ? <CircularProgress size={14} color="inherit" /> : undefined}>
                                        재설정 메일 보내기
                                    </HeaderActionButton>
                                )}
                                note={!pwResetSent && pwResetError && (
                                    <Alert severity="error" sx={{ fontSize: 12, maxWidth: CONTROL_MAX }} onClose={() => setPwResetError("")}>{pwResetError}</Alert>
                                )}
                            />
                        </SettingSection>
                    )}

                    <SettingSection first={!showPasswordCard} title="약관 및 정책">
                        <SettingRow
                            label="개인정보처리방침"
                            action={<HeaderActionButton variant="secondary" onClick={() => setPrivacyOpen(true)}>보기</HeaderActionButton>}
                        />
                        <SettingRow
                            label="이용약관"
                            action={<HeaderActionButton variant="secondary" onClick={() => setTermsOpen(true)}>보기</HeaderActionButton>}
                        />
                        <SettingRow last
                            label="오픈소스 라이선스"
                            action={<HeaderActionButton variant="secondary" onClick={() => setLicenseOpen(true)}>보기</HeaderActionButton>}
                        />
                    </SettingSection>

                    <SettingSection title="세션">
                        <SettingRow last
                            label="로그아웃"
                            description="현재 기기에서 로그아웃해요"
                            action={
                                /* 빨강은 위험 구역 전용 — 로그아웃은 되돌릴 수 있으니 중립 톤 */
                                <HeaderActionButton variant="secondary" icon={<LogoutIcon sx={{ fontSize: 17 }} />} onClick={handleLogout}>
                                    로그아웃
                                </HeaderActionButton>
                            }
                        />
                    </SettingSection>

                    <DangerZone>
                        {/* 전체 초기화 — 여러 섹션을 한 번에 되돌리므로 섹션 안이 아니라 계정에 둔다.
                            데이터는 남기 때문에 탈퇴보다 한 단계 낮은 중립 톤 */}
                        <SettingRow
                            label="모든 설정 초기화"
                            description="화면·작업 기본값·알림 설정을 기본값으로 되돌려요. 표시 이름과 데이터는 그대로예요."
                            action={
                                <HeaderActionButton variant="secondary" icon={<RestartAltIcon sx={{ fontSize: 17 }} />}
                                    onClick={() => setConfirmResetAll(true)}>
                                    초기화
                                </HeaderActionButton>
                            }
                        />
                        <SettingRow last
                            label="회원 탈퇴"
                            description="소유자인 워크스페이스는 통째로 삭제되지만, 다른 워크스페이스의 내 할 일은 작성자 표시만 지워진 채 남아요. 되돌릴 수 없어요."
                            action={
                                <HeaderActionButton variant="danger" icon={<DeleteOutlineIcon sx={{ fontSize: 17 }} />}
                                    onClick={() => setConfirmDeleteAccount(true)}>
                                    탈퇴
                                </HeaderActionButton>
                            }
                        />
                    </DangerZone>
                </Box>
            );

            default: return null;
        }
    };

    return (
        <Box sx={{ display: "flex", height: "100%", overflow: "hidden" }}>

            {/* 콘텐츠 패널 (섹션 내비는 글로벌 사이드바 SidebarSettingsPanel이 제공) */}
            <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
                {/* 카드가 없어진 대신 라벨열(260) + 컨트롤열이 들어가야 해서 640 → 820 */}
                <Box sx={{ maxWidth: 820, mx: "auto", pb: 6 }}>
                    {renderContent()}
                </Box>
            </Box>

            <PrivacyPolicyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
            <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
            <OpenSourceLicenseModal open={licenseOpen} onClose={() => setLicenseOpen(false)} />

            {/* 다이얼로그 */}
            <ConfirmDialog open={wsConfirm?.type === "delete"} title="워크스페이스 삭제"
                message={wsConfirm?.hasRecruitments
                    ? `"${currentWorkspace?.workspaceName}" 워크스페이스에 팀 모집글이 있습니다.\n모집글을 포함한 모든 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없어요.`
                    : `"${currentWorkspace?.workspaceName}" 워크스페이스를 삭제하면 모든 할 일과 멤버 정보가 영구적으로 삭제돼요.\n\n정말 삭제할까요?`}
                confirmText="삭제" confirmColor="error"
                onClose={() => setWsConfirm(null)} onConfirm={() => wsHandleDelete(currentWorkspace)} />
            <ConfirmDialog open={wsConfirm?.type === "leave"} title="워크스페이스 나가기"
                message={`"${currentWorkspace?.workspaceName}" 워크스페이스에서 나갈까요?\n\n나간 후 다시 참여하려면 초대 코드가 필요해요.`}
                confirmText="나가기" confirmColor="warning"
                onClose={() => setWsConfirm(null)} onConfirm={() => wsHandleLeave(currentWorkspace)} />
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
                confirmText="해제" confirmColor="error" loading={s.unlinkLoading}
                onClose={() => setConfirmKakaoUnlink(false)} onConfirm={handleKakaoUnlink} />
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
        </Box>
    );
}
