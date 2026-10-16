import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTheme } from "@mui/material";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { removeToken } from "../../../shared/utils/tokenUtils.js";
import { getMySettings, updateMySettings } from "../api/settingsApi.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { deleteMyAccount, uploadProfileImage, getMe, unlinkKakao } from "../../../shared/api/userApi.js";
import { updateWorkspace, uploadWorkspaceIcon } from "../../workspace/api/workspaceApi.js";
import { getWorkspaceMembers } from "../../workspace/api/workspaceMemberApi.js";
import { ROLE_RANK } from "../../workspace/hooks/useWorkspacePermissions.js";
import { forgotPassword } from "../../auth/api/authApi.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";
import { useWorkspaceActions } from "../../workspace/hooks/useWorkspaceActions.js";
import { usePushSubscription } from "../../notification/hooks/usePushSubscription.js";
import { PRIORITY_LABEL } from "../../../shared/ui/tone.js";
import { THEMES } from "../../../shared/ui/theme.js";
import { exportTodosCsv } from "../../todo/api/todoApi.js";
import { buildTransferTokens } from "../utils/settingsTokens.js";

const LS_CUSTOM_THEME = "settings.customTheme";
const LS = { loginUser: "loginUser" };

// ── 즉시 적용(instant-apply) 공통 ────────────────────────────────
// 스위치·셀렉트·테마 스와치는 바꾸는 즉시 화면에 반영하고 400ms 뒤 서버에 저장한다.
// (연타해도 API를 한 번만 호출하도록 디바운스)
const SAVE_DEBOUNCE_MS = 400;

// 백엔드 PUT /settings/me 계약 유지 — 한 필드만 바뀌어도 "현재 전체 값"을 보낸다.
const buildSettingsPayload = (v) => ({
    displayName: v.displayName,
    themeMode: v.themeMode,
    sidebarCollapsed: v.sidebarCollapsed,
    defaultPriority: v.defaultPriority,
    calendarDefaultView: v.calendarDefaultView,
    compactMode: v.compactMode,
    dueReminderLeadDays: v.dueReminderLeadDays,
    // 주는 일요일 시작 고정(사용자 설정 아님) — 서버 값도 계속 맞춰 둔다
    defaultDue: v.defaultDue, weekStartDay: "sun", autoArchiveDays: v.autoArchiveDays,
    notificationEnabled: v.notificationEnabled,
    notifyDueDate: v.notifyDueDate, notifyAssignment: v.notifyAssignment, notifyComment: v.notifyComment,
    notifyMention: v.notifyMention, notifyDm: v.notifyDm,
});

// 다른 화면(캘린더·할 일 추가·테마 루트)이 읽는 localStorage 미러
const syncSettingsLocal = (v) => {
    localStorage.setItem("settings.themeMode", v.themeMode);
    localStorage.setItem("settings.sidebarCollapsed", String(v.sidebarCollapsed));
    localStorage.setItem("settings.calendarDefaultView", v.calendarDefaultView);
    localStorage.setItem("settings.defaultDue", v.defaultDue);
    localStorage.setItem("settings.notificationEnabled", String(v.notificationEnabled));
};

// 바뀌면 앱 전체가 다시 읽어야 하는 필드만 브로드캐스트.
// (SETTINGS_CHANGED는 테마 재빌드·STOMP 재연결까지 유발해서 알림 토글마다 쏘면 낭비)
const BROADCAST_FIELDS = ["themeMode", "sidebarCollapsed", "notificationEnabled"];

// "모든 설정 초기화"가 실제로 되돌리는 항목 — 확인 창에 그대로 보여준다(솔직한 범위 고지)
export const RESET_CONFIRM_MESSAGE =
    "아래 설정이 기본값으로 되돌아가요.\n\n" +
    "· 테마: 라이트\n" +
    "· 사이드바 기본 접힘: 끔\n" +
    "· 캘린더 기본 보기: 월\n" +
    "· 기본 우선순위: 중간\n" +
    "· 새 할 일 기본 마감일: 없음\n" +
    "· 완료 항목 자동 보관: 1개월 후\n" +
    "· 마감 알림 시점: 1일 전\n" +
    "· 알림 6종: 모두 켬\n\n" +
    "표시 이름·워크스페이스·할 일 데이터는 그대로예요.";

const writeCustomTheme = (c) => {
    localStorage.setItem(LS_CUSTOM_THEME, JSON.stringify({
        primaryColor: c.customColor, baseMode: c.customBaseMode,
        bgColor: c.customBgColor, cardColor: c.customCardColor || null,
    }));
};

export function useSettingsState() {
    const nav = useNavigate();
    const muiTheme = useTheme();
    const isDark = muiTheme.palette.mode === "dark";
    const { currentWorkspace, loadWorkspaces } = useWorkspace();

    // ── 섹션 네비게이션 (모바일) ─────────────────────────────────
    // 더보기 허브에서 /settings?section=templates 등으로 직접 진입 가능
    const [searchParams] = useSearchParams();
    const [activeSection, setActiveSection] = useState(() => searchParams.get("section") || null);
    const goBack = () => {
        // 딥링크(더보기 등 외부)로 진입한 섹션 → 이전 화면으로 복귀
        if (searchParams.get("section")) {
            nav(-1);
            return;
        }
        setActiveSection(null);
    };

    // ── 상태 ──────────────────────────────────────────────────────
    const [userEmail, setUserEmail] = useState("user@example.com");
    const [displayName, setDisplayName] = useState("");
    const [profileImageUrl, setProfileImageUrl] = useState("");
    const [uploadingImage, setUploadingImage] = useState(false);
    const [provider, setProvider] = useState("LOCAL");
    const [kakaoLinked, setKakaoLinked] = useState(false);
    // 비밀번호 보유 여부 — 재설정 메일/카카오 연동 해제가 "실제로 가능한지"의 유일한 기준.
    // null = 아직 모름(getMe 응답 전). false로 시작하면 응답 전 한 프레임 동안 정상 계정에도
    // "비밀번호가 없어요"라고 잘못 알린다 — 모를 땐 단정하지 않고 버튼만 잠근다.
    const [hasPassword, setHasPassword] = useState(null);
    const [unlinkLoading, setUnlinkLoading] = useState(false);
    const fileInputRef = useRef(null);

    const [themeMode, setThemeMode] = useState("light");
    const [customColor, setCustomColor] = useState("#6366F1");
    const [customBgColor, setCustomBgColor] = useState("#F6F7FB");
    const [customBaseMode, setCustomBaseMode] = useState("light");
    const [customCardColor, setCustomCardColor] = useState("");   // ""이면 자동 derivation
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const [defaultPriority, setDefaultPriority] = useState("MEDIUM");

    const push = usePushSubscription();
    const [notificationEnabled, setNotificationEnabled] = useState(true);
    const [notifyMention, setNotifyMention] = useState(true);
    const [notifyDm, setNotifyDm] = useState(true);
    const [notifyDueDate, setNotifyDueDate] = useState(true);
    const [notifyAssignment, setNotifyAssignment] = useState(true);
    const [notifyComment, setNotifyComment] = useState(true);

    // 화면 설정 추가
    const [calendarDefaultView, setCalendarDefaultView] = useState("month");
    const [compactMode, setCompactMode] = useState(false);

    // 마감 알림 리드타임 (0=당일, 1=1일 전, 3=3일 전)
    const [dueReminderLeadDays, setDueReminderLeadDays] = useState(1);
    // 새 할 일 기본 마감일 (none/today/tomorrow/week)
    const [defaultDue, setDefaultDue] = useState("none");
    // 완료 항목 자동 보관 기간 (0=안 함, 7/14/30)
    const [autoArchiveDays, setAutoArchiveDays] = useState(30);

    // 워크스페이스 편집
    const [editingWsName, setEditingWsName] = useState("");
    const wsIconInputRef = useRef(null);
    const [wsNameSaving, setWsNameSaving] = useState(false);
    const [uploadingWsIcon, setUploadingWsIcon] = useState(false);

    // 비밀번호 재설정
    const [pwResetSending, setPwResetSending] = useState(false);
    const [pwResetSent, setPwResetSent] = useState(false);
    const [pwResetError, setPwResetError] = useState("");
    const [workspaceMembers, setWorkspaceMembers] = useState([]);
    const [membersExpanded, setMembersExpanded] = useState(false);
    const MEMBERS_PREVIEW = 4;

    // 표시 이름은 자유 입력이라 즉시 저장하지 않고 "변경" 버튼으로만 저장한다.
    const [savedDisplayName, setSavedDisplayName] = useState("");
    const [displayNameSaving, setDisplayNameSaving] = useState(false);

    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
    const [confirmResetAll, setConfirmResetAll] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [confirmKakaoUnlink, setConfirmKakaoUnlink] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const wsActions = useWorkspaceActions();

    // ── 데이터 로드 ───────────────────────────────────────────────
    useEffect(() => {
        const rawUser = localStorage.getItem(LS.loginUser);
        let loginUser = null;
        try { loginUser = rawUser ? JSON.parse(rawUser) : null; } catch { /* ignore */ }

        setUserEmail(loginUser?.email || "user@example.com");
        setProfileImageUrl(loginUser?.profileImageUrl || "");

        getMe().then(res => {
            setProvider(res.data?.provider || "LOCAL");
            setKakaoLinked(res.data?.kakaoLinked || false);
            setHasPassword(res.data?.hasPassword === true);
        }).catch(() => {});

        const fetchSettings = async () => {
            try {
                const res = await getMySettings();
                const data = res.data ?? {};
                setDisplayName(data.displayName ?? loginUser?.name ?? "");
                setSavedDisplayName(data.displayName ?? loginUser?.name ?? "");
                setThemeMode(data.themeMode ?? "light");
                setSidebarCollapsed(data.sidebarCollapsed ?? false);
                setDefaultPriority(data.defaultPriority ?? "MEDIUM");
                setNotificationEnabled(data.notificationEnabled ?? true);
                setNotifyMention(data.notifyMention ?? true);
                setNotifyDm(data.notifyDm ?? true);
                setNotifyDueDate(data.notifyDueDate ?? true);
                setNotifyAssignment(data.notifyAssignment ?? true);
                setNotifyComment(data.notifyComment ?? true);
                setCalendarDefaultView(data.calendarDefaultView ?? "month");
                setCompactMode(data.compactMode ?? false);
                setDueReminderLeadDays(data.dueReminderLeadDays ?? 1);
                setDefaultDue(data.defaultDue ?? "none");
                setAutoArchiveDays(data.autoArchiveDays ?? 30);
                // 캘린더·할 일 추가가 읽도록 localStorage에도 반영 (themeMode 패턴)
                localStorage.setItem("settings.calendarDefaultView", data.calendarDefaultView ?? "month");
                localStorage.setItem("settings.defaultDue", data.defaultDue ?? "none");
                try {
                    const raw = localStorage.getItem(LS_CUSTOM_THEME);
                    if (raw) {
                        const { primaryColor, baseMode, bgColor, cardColor } = JSON.parse(raw);
                        if (primaryColor) setCustomColor(primaryColor);
                        if (baseMode) setCustomBaseMode(baseMode);
                        if (bgColor) setCustomBgColor(bgColor);
                        if (cardColor) setCustomCardColor(cardColor);
                    }
                } catch { /* ignore */ }
            } catch {
                setDisplayName(loginUser?.name || "");
                setSavedDisplayName(loginUser?.name || "");
                setThemeMode("light");
                setSidebarCollapsed(false);
                setDefaultPriority("MEDIUM");
                setNotificationEnabled(true);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        if (!currentWorkspace?.workspaceId) { setWorkspaceMembers([]); return; }
        // /users(UserDto)는 role이 없어 전원 "멤버"로 보임 → 역할이 담긴 워크스페이스 멤버 API 사용
        getWorkspaceMembers(currentWorkspace.workspaceId)
            .then(data => setWorkspaceMembers(Array.isArray(data) ? data : []))
            .catch(() => setWorkspaceMembers([]));
        setEditingWsName(currentWorkspace.workspaceName ?? "");
    }, [currentWorkspace?.workspaceId, currentWorkspace?.workspaceName]);

    // ── 핸들러 ───────────────────────────────────────────────────
    const handleProfileImageChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingImage(true);
        try {
            const res = await uploadProfileImage(file);
            const url = res.data?.profileImageUrl;
            if (url) {
                setProfileImageUrl(url);
                const rawUser = localStorage.getItem(LS.loginUser);
                let loginUser = {};
                try { loginUser = rawUser ? JSON.parse(rawUser) : {}; } catch { /* ignore */ }
                localStorage.setItem(LS.loginUser, JSON.stringify({ ...loginUser, profileImageUrl: url }));
                window.dispatchEvent(new Event(APP_EVENTS.SETTINGS_CHANGED));
            }
        } catch (err) {
            toast.error(getApiError(err, "프로필 사진 변경에 실패했어요."));
        } finally {
            setUploadingImage(false);
            e.target.value = "";
        }
    };

    // ── 즉시 적용 엔진 ───────────────────────────────────────────
    // 컨트롤을 바꾸면 (1) 상태·localStorage에 바로 반영해 화면이 즉시 바뀌고
    // (2) 400ms 뒤 전체 payload를 PUT, (3) 실패하면 이전 값으로 되돌리고 토스트로 알린다.
    // displayName은 즉시 저장 대상이 아니라 valuesRef에 넣지 않는다.
    // (입력 중인 이름이 스위치 토글에 묻어 저장되면 안 됨 — 저장된 이름만 payload에 실림)
    const valuesRef = useRef(null);
    valuesRef.current = {
        themeMode, sidebarCollapsed, defaultPriority,
        calendarDefaultView, compactMode, dueReminderLeadDays,
        defaultDue, autoArchiveDays, notificationEnabled,
        notifyDueDate, notifyAssignment, notifyComment, notifyMention, notifyDm,
    };
    const savedNameRef = useRef("");
    savedNameRef.current = savedDisplayName;
    // 서버로 보낼 전체 payload — 저장된 표시 이름 + 현재 즉시적용 값
    const currentPayload = (patch) => buildSettingsPayload({
        ...valuesRef.current, ...patch, displayName: patch?.displayName ?? savedNameRef.current,
    });

    const settersRef = useRef(null);
    settersRef.current = {
        themeMode: setThemeMode, sidebarCollapsed: setSidebarCollapsed,
        defaultPriority: setDefaultPriority, calendarDefaultView: setCalendarDefaultView,
        compactMode: setCompactMode, dueReminderLeadDays: setDueReminderLeadDays,
        defaultDue: setDefaultDue, autoArchiveDays: setAutoArchiveDays,
        notificationEnabled: setNotificationEnabled,
        notifyDueDate: setNotifyDueDate, notifyAssignment: setNotifyAssignment,
        notifyComment: setNotifyComment, notifyMention: setNotifyMention, notifyDm: setNotifyDm,
    };

    const saveTimerRef = useRef(null);
    // 저장 실패 시 되돌릴 "바뀌기 전" 값 (같은 필드를 연타해도 최초 값 유지)
    const revertRef = useRef(null);
    const flushRef = useRef(null);

    const applyValues = (patch) => {
        const next = { ...valuesRef.current, ...patch };
        valuesRef.current = next;
        Object.entries(patch).forEach(([k, v]) => settersRef.current[k]?.(v));
        syncSettingsLocal(next);
        if (Object.keys(patch).some(k => BROADCAST_FIELDS.includes(k))) {
            window.dispatchEvent(new Event(APP_EVENTS.SETTINGS_CHANGED));
        }
        return next;
    };

    const flushSettings = async () => {
        const revert = revertRef.current;
        revertRef.current = null;
        saveTimerRef.current = null;
        if (!revert) return;
        try {
            await updateMySettings(currentPayload());
        } catch (err) {
            // 서버가 원본 — 저장 실패를 삼키면 다음 로그인 때 설정이 되돌아간다.
            // UI가 거짓말하지 않도록 컨트롤을 되돌린 뒤 실패만 알린다.
            applyValues(revert);
            toast.error(getApiError(err, "설정 저장에 실패했어요. 잠시 후 다시 시도해주세요."));
        }
    };
    flushRef.current = flushSettings;

    const commitSettings = (patch) => {
        const prev = valuesRef.current;
        const revert = revertRef.current ?? {};
        Object.keys(patch).forEach(k => { if (!(k in revert)) revert[k] = prev[k]; });
        revertRef.current = revert;
        applyValues(patch);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => flushRef.current(), SAVE_DEBOUNCE_MS);
    };

    // 화면을 떠나도 대기 중인 변경은 저장되게 (설정이 조용히 사라지지 않도록)
    useEffect(() => () => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            flushRef.current?.();
        }
    }, []);

    const instant = (field) => (value) => commitSettings({ [field]: value });

    // ── 커스텀 테마 (localStorage 전용 — 서버 필드 아님) ──────────
    const customRef = useRef(null);
    customRef.current = { customColor, customBgColor, customBaseMode, customCardColor };
    const customSettersRef = useRef(null);
    customSettersRef.current = {
        customColor: setCustomColor, customBgColor: setCustomBgColor,
        customBaseMode: setCustomBaseMode, customCardColor: setCustomCardColor,
    };
    const customTimerRef = useRef(null);
    const commitCustomTheme = (patch) => {
        const next = { ...customRef.current, ...patch };
        customRef.current = next;
        Object.entries(patch).forEach(([k, v]) => customSettersRef.current[k]?.(v));
        // 컬러 피커 드래그마다 앱 전체를 리테마하지 않도록 반영도 디바운스
        if (customTimerRef.current) clearTimeout(customTimerRef.current);
        customTimerRef.current = setTimeout(() => {
            writeCustomTheme(next);
            if (valuesRef.current.themeMode === "custom") {
                window.dispatchEvent(new Event(APP_EVENTS.SETTINGS_CHANGED));
            }
        }, SAVE_DEBOUNCE_MS);
    };

    const applyThemeMode = (mode) => {
        // 커스텀으로 전환할 땐 색상 값을 먼저 LS에 써야 테마 빌드가 집어간다
        if (mode === "custom") writeCustomTheme(customRef.current);
        commitSettings({ themeMode: mode });
    };

    // ── 표시 이름 (자유 입력 — 명시적 저장) ───────────────────────
    const handleDisplayNameSave = async () => {
        const name = displayName.trim();
        if (!name || name === savedDisplayName) return;
        setDisplayNameSaving(true);
        try {
            await updateMySettings(currentPayload({ displayName: name }));
            setDisplayName(name);
            setSavedDisplayName(name);
            const rawUser = localStorage.getItem(LS.loginUser);
            let loginUser = null;
            try { loginUser = rawUser ? JSON.parse(rawUser) : {}; } catch { loginUser = {}; }
            localStorage.setItem(LS.loginUser, JSON.stringify({ ...loginUser, name, email: userEmail }));
            window.dispatchEvent(new Event(APP_EVENTS.SETTINGS_CHANGED));
            toast.success("표시 이름을 변경했어요.");
        } catch (err) {
            toast.error(getApiError(err, "표시 이름 변경에 실패했어요."));
        } finally { setDisplayNameSaving(false); }
    };

    // ── 전체 초기화 (계정 섹션 — ConfirmDialog 필수) ───────────────
    // 표시 이름은 건드리지 않는다: 이름은 별도 "변경" 버튼으로 관리하는 값이라
    // "설정 초기화"가 조용히 바꿔버리면 안 된다.
    const RESET_DEFAULTS = {
        themeMode: "light", sidebarCollapsed: false, defaultPriority: "MEDIUM",
        calendarDefaultView: "month", compactMode: false, dueReminderLeadDays: 1,
        defaultDue: "none", autoArchiveDays: 30,
        notificationEnabled: true, notifyDueDate: true, notifyAssignment: true,
        notifyComment: true, notifyMention: true, notifyDm: true,
    };
    const handleResetAll = async () => {
        setResetting(true);
        // 대기 중인 디바운스 저장이 초기화를 덮어쓰지 않도록 취소
        if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
        revertRef.current = null;
        const prev = valuesRef.current;
        applyValues(RESET_DEFAULTS);
        try {
            await updateMySettings(currentPayload());
            setConfirmResetAll(false);
            toast.success("설정을 기본값으로 되돌렸어요.");
        } catch (err) {
            applyValues(prev);
            toast.error(getApiError(err, "설정 초기화에 실패했어요. 잠시 후 다시 시도해주세요."));
        } finally { setResetting(false); }
    };

    const handleDeleteAccount = async () => {
        setActionLoading(true);
        setErrorMessage("");
        try {
            await deleteMyAccount();
            removeToken();
            nav("/login");
        } catch (err) {
            setConfirmDeleteAccount(false);
            setErrorMessage(getApiError(err, "회원 탈퇴에 실패했습니다."));
        } finally { setActionLoading(false); }
    };

    const handleLogout = () => { removeToken(); nav("/login"); };

    const handleCopyInviteCode = async () => {
        const code = currentWorkspace?.inviteCode;
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            toast.success("초대 코드를 복사했어요.");
        } catch {
            try {
                const el = document.createElement("textarea");
                el.value = code;
                el.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
                document.body.appendChild(el);
                el.focus(); el.select();
                document.execCommand("copy");
                document.body.removeChild(el);
                toast.success("초대 코드를 복사했어요.");
            } catch {
                toast.error("초대 코드를 복사하지 못했어요.");
            }
        }
    };

    const handleKakaoUnlink = async () => {
        // 비밀번호 없는 계정은 서버(UserService.unlinkKakao)가 400으로 막는다 —
        // 해제하면 로그인 수단이 사라지기 때문. UI에서도 아예 실행하지 않는다.
        if (!hasPassword) return;
        setUnlinkLoading(true);
        try {
            await unlinkKakao();
            setKakaoLinked(false);
            setConfirmKakaoUnlink(false);
        } catch (e) {
            setErrorMessage(e?.response?.data?.message || "연동 해제에 실패했습니다.");
        } finally { setUnlinkLoading(false); }
    };

    const handleWsNameSave = async () => {
        if (!currentWorkspace?.workspaceId || !editingWsName.trim()) return;
        setWsNameSaving(true);
        try {
            await updateWorkspace(currentWorkspace.workspaceId, { workspaceName: editingWsName.trim() });
            await loadWorkspaces();
            toast.success("워크스페이스 이름을 변경했어요.");
        } catch (err) {
            toast.error(getApiError(err, "워크스페이스 이름 변경에 실패했어요."));
        } finally { setWsNameSaving(false); }
    };

    const handleWsIconChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !currentWorkspace?.workspaceId) return;
        setUploadingWsIcon(true);
        try {
            await uploadWorkspaceIcon(currentWorkspace.workspaceId, file);
            toast.success("워크스페이스 아이콘을 변경했어요.");
            window.dispatchEvent(new Event(APP_EVENTS.SETTINGS_CHANGED));
        } catch (err) {
            toast.error(getApiError(err, "워크스페이스 아이콘 변경에 실패했어요."));
        } finally {
            setUploadingWsIcon(false);
            e.target.value = "";
        }
    };

    const handlePasswordReset = async () => {
        if (!userEmail) return;
        // 비밀번호가 없는 계정에는 PasswordResetService가 조용히 아무것도 보내지 않는다.
        // 그대로 호출하면 200이 와서 "메일 보냈어요"라고 거짓말하게 되므로 여기서 끊는다.
        if (!hasPassword) return;
        setPwResetSending(true);
        setPwResetError("");
        try {
            await forgotPassword(userEmail);
            setPwResetSent(true);
            setTimeout(() => setPwResetSent(false), 4000);
        } catch { setPwResetError("메일 발송에 실패했습니다."); } finally { setPwResetSending(false); }
    };

    // ── 데이터 내보내기 (CSV) — 데스크탑/모바일 공통 ───────────────
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState("");
    const handleExportCsv = async () => {
        setExporting(true);
        setExportError("");
        try {
            const res = await exportTodosCsv();
            const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `plando-todos-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("CSV 내보내기 실패:", e);
            setExportError("내보내기에 실패했어요. 잠시 후 다시 시도해주세요.");
        } finally {
            setExporting(false);
        }
    };

    // 워크스페이스 이름·아이콘 변경 권한 — 백엔드(WorkspaceService)도 ADMIN 이상 허용.
    // 기존엔 UI가 OWNER만 열어줘서 ADMIN이 변경 수단을 아예 못 찾았음.
    const canManageWs = (ROLE_RANK[currentWorkspace?.role] ?? 0) >= ROLE_RANK.ADMIN;

    // ── 비밀번호 관련 노출 규칙 ──────────────────────────────────
    // 재설정 메일은 "비밀번호가 있는 계정"에만 실제로 발송된다(PasswordResetService는 그 외엔
    // 조용히 return). provider === "LOCAL" 만 보고 열어주면 둘러보기(게스트) 계정도 통과해서
    // 보내지도 않은 메일을 "보냈어요"라고 알리게 된다 — 그래서 기준을 hasPassword로 바꾼다.
    //   · 비밀번호 있음        → 평소대로 노출
    //   · LOCAL·비밀번호 없음  → 노출하되 비활성 + 이유 (이메일 계정인데 항목이 그냥 사라지면 더 혼란)
    //   · 소셜 전용 계정       → 숨김 (바로 위 "소셜 계정" 카드가 로그인 수단을 보여줘 부재가 자명)
    const showPasswordCard = hasPassword === true || provider === "LOCAL";
    const canResetPassword = hasPassword === true;
    // 사유 문구는 "없는 게 확인된" 경우에만 — 모르는 동안은 버튼만 잠긴다.
    const passwordUnavailableReason = hasPassword === false
        ? "이 계정에는 비밀번호가 없어요. 둘러보기로 시작했거나 소셜 로그인으로 가입한 계정이라 재설정 메일을 보낼 수 없어요."
        : "";
    // 카카오 연동 해제도 비밀번호가 있어야만 가능 — 없으면 서버가 400으로 막는다(로그인 수단 상실 방지).
    const canUnlinkKakao = hasPassword === true;
    const kakaoUnlinkBlocked = hasPassword === false;

    // TransferOwnerDialog 테마 토큰 (공통)
    const transferTokens = buildTransferTokens(muiTheme);

    // ── 유틸 레이블 ──────────────────────────────────────────────
    const themeLabel = THEMES.find(t => t.key === themeMode)?.label ?? (themeMode === "custom" ? "커스텀" : themeMode);
    const priorityLabel = PRIORITY_LABEL[defaultPriority] ?? defaultPriority;
    const notifLabel = notificationEnabled ? "켜짐" : "꺼짐";

    return {
        // meta
        isDark, muiTheme, loading,
        // section nav (mobile)
        activeSection, setActiveSection, goBack,
        // profile — 표시 이름만 명시적 저장(자유 입력)
        userEmail, displayName, setDisplayName,
        savedDisplayName, displayNameSaving, handleDisplayNameSave,
        profileImageUrl, uploadingImage, provider,
        hasPassword, showPasswordCard, canResetPassword, passwordUnavailableReason,
        canUnlinkKakao, kakaoUnlinkBlocked,
        kakaoLinked, setKakaoLinked, unlinkLoading,
        confirmKakaoUnlink, setConfirmKakaoUnlink,
        fileInputRef, handleProfileImageChange, handleKakaoUnlink,
        // theme — 아래 setter들은 전부 즉시 적용 + 디바운스 저장
        themeMode, setThemeMode: applyThemeMode,
        customColor, setCustomColor: (v) => commitCustomTheme({ customColor: v }),
        customBgColor, setCustomBgColor: (v) => commitCustomTheme({ customBgColor: v }),
        customBaseMode, setCustomBaseMode: (v) => commitCustomTheme({ customBaseMode: v }),
        customCardColor, setCustomCardColor: (v) => commitCustomTheme({ customCardColor: v }),
        setCustomTheme: commitCustomTheme,
        sidebarCollapsed, setSidebarCollapsed: instant("sidebarCollapsed"),
        // preferences
        defaultPriority, setDefaultPriority: instant("defaultPriority"),
        // notifications
        push, notificationEnabled, setNotificationEnabled: instant("notificationEnabled"),
        notifyMention, setNotifyMention: instant("notifyMention"),
        notifyDm, setNotifyDm: instant("notifyDm"),
        notifyDueDate, setNotifyDueDate: instant("notifyDueDate"),
        notifyAssignment, setNotifyAssignment: instant("notifyAssignment"),
        notifyComment, setNotifyComment: instant("notifyComment"),
        // display extras
        calendarDefaultView, setCalendarDefaultView: instant("calendarDefaultView"),
        compactMode, setCompactMode: instant("compactMode"),
        dueReminderLeadDays, setDueReminderLeadDays: instant("dueReminderLeadDays"),
        defaultDue, setDefaultDue: instant("defaultDue"),
        autoArchiveDays, setAutoArchiveDays: instant("autoArchiveDays"),
        // workspace edit
        editingWsName, setEditingWsName,
        wsIconInputRef, wsNameSaving,
        uploadingWsIcon,
        handleWsNameSave, handleWsIconChange,
        // password reset
        pwResetSending, pwResetSent, pwResetError, setPwResetError,
        handlePasswordReset,
        // workspace
        currentWorkspace, workspaceMembers, canManageWs,
        membersExpanded, setMembersExpanded, MEMBERS_PREVIEW,
        // workspace actions
        wsActions,
        // account
        confirmDeleteAccount, setConfirmDeleteAccount,
        actionLoading,
        handleDeleteAccount, handleLogout, handleCopyInviteCode,
        // 전체 초기화 (확인 다이얼로그 필수)
        confirmResetAll, setConfirmResetAll, resetting, handleResetAll,
        // data export (CSV)
        exporting, exportError, setExportError, handleExportCsv,
        // transfer-owner dialog tokens
        transferTokens,
        // status flags
        errorMessage, setErrorMessage,
        // labels
        themeLabel, priorityLabel, notifLabel,
    };
}
