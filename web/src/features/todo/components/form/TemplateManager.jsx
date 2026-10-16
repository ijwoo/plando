import React, { useCallback, useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    SwipeableDrawer,
    TextField,
    Typography,
    useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import CloseIcon from "@mui/icons-material/Close";
import PersonIcon from "@mui/icons-material/Person";
import FlagIcon from "@mui/icons-material/Flag";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";

import { fetchTemplates, createTemplate, updateTemplate, deleteTemplate } from "../../api/todoTemplateApi.js";
import { PRIORITY_LABEL, PRIORITY_OPTIONS } from "../../../../shared/ui/tone.js";
import { fetchAllUsers } from "../../../../shared/api/userApi.js";
import { useProjects } from "../../../project/store/projectStore.js";
import { buildProjectOptions } from "../../../project/utils/projectOptions.js";
import ConfirmDialog from "../../../../shared/ui/common/ConfirmDialog.jsx";
import { Z } from "../../../../shared/ui/zIndex.js";

const F = "-apple-system,'Noto Sans KR',BlinkMacSystemFont,sans-serif";

function getMobileTokens(isDark) {
    return isDark ? {
        bg:      "rgba(24,24,36,0.97)",
        surface: "rgba(255,255,255,0.05)",
        border:  "rgba(255,255,255,0.10)",
        text:    "rgba(255,255,255,0.92)",
        text2:   "rgba(255,255,255,0.50)",
        handle:  "rgba(255,255,255,0.18)",
        inputBg: "rgba(255,255,255,0.06)",
        inputBd: "rgba(255,255,255,0.14)",
    } : {
        bg:      "rgba(252,252,255,0.98)",
        surface: "rgba(0,0,0,0.03)",
        border:  "rgba(0,0,0,0.08)",
        text:    "rgba(0,0,0,0.88)",
        text2:   "rgba(0,0,0,0.50)",
        handle:  "rgba(0,0,0,0.15)",
        inputBg: "rgba(0,0,0,0.03)",
        inputBd: "rgba(0,0,0,0.12)",
    };
}

// defaultSubtasks(서버 필드명과 달리 실제로는 "체크리스트" 항목)는 UI에서 제거됐지만,
// 기존 템플릿에 저장돼 있는 값을 수정 저장 시 지우지 않도록 폼 state에는 그대로 실어 보낸다.
const EMPTY_FORM = {
    name: "",
    defaultTitle: "",
    defaultContent: "",
    defaultPriority: "MEDIUM",
    defaultAssigneeEmails: [],
    defaultSubtasks: [],
    defaultProjectId: null,
};

export default function TemplateManager({ workspaceId }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const t = getMobileTokens(isDark);

    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [userList, setUserList] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const projects = useProjects();
    const projectOptions = buildProjectOptions(projects);
    const projectName = (id) => (id == null ? null : projects.find((p) => p.id === id)?.name ?? null);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        try {
            setLoading(true);
            const res = await fetchTemplates(workspaceId);
            setTemplates(res.data ?? []);
        } catch {
            setError("템플릿을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => { load(); }, [load]);

    const openLoadUsers = () => {
        setLoadingUsers(true);
        fetchAllUsers()
            .then((res) => setUserList(res.data ?? []))
            .catch(() => setUserList([]))
            .finally(() => setLoadingUsers(false));
    };

    const openForm = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setError("");
        setOpen(true);
        openLoadUsers();
    };

    const openEditForm = (tpl) => {
        setEditingId(tpl.id);
        setForm({
            name: tpl.name ?? "",
            defaultTitle: tpl.defaultTitle ?? "",
            defaultContent: tpl.defaultContent ?? "",
            defaultPriority: tpl.defaultPriority ?? "MEDIUM",
            defaultAssigneeEmails: tpl.defaultAssigneeEmails ?? [],
            defaultSubtasks: tpl.defaultSubtasks ?? [],
            defaultProjectId: tpl.defaultProjectId ?? null,
        });
        setError("");
        setOpen(true);
        openLoadUsers();
    };

    const closeForm = () => {
        setOpen(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
    };

    const handleSave = async () => {
        if (!form.name.trim()) { setError("템플릿 이름을 입력하세요."); return; }
        try {
            setSaving(true);
            setError("");
            if (editingId) {
                await updateTemplate(workspaceId, editingId, form);
            } else {
                await createTemplate(workspaceId, form);
            }
            closeForm();
            await load();
        } catch {
            setError(editingId ? "템플릿 수정에 실패했습니다." : "템플릿 저장에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            setError("");
            await deleteTemplate(workspaceId, id);
            await load();
        } catch {
            setError("삭제에 실패했습니다.");
        }
    };

    // ─── 공통 폼 콘텐츠 ─────────────────────────────────────────────
    const formContent = isMobile ? (
        // 모바일: 순수 div/style 기반 (AddTodoMobile 패턴)
        <Box sx={{ px: 2, pb: 2, pt: 1 }}>
            {error && (
                <Alert severity="error" sx={{ mb: 2, fontSize: 13, borderRadius: 2 }} onClose={() => setError("")}>
                    {error}
                </Alert>
            )}

            {/* 템플릿 이름 */}
            <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.text2, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8, fontFamily: F }}>
                    템플릿 이름 *
                </div>
                <input
                    autoFocus
                    placeholder="예: 버그 리포트, 회의록"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    style={{
                        width: "100%", boxSizing: "border-box",
                        padding: "11px 14px", borderRadius: 12, fontSize: 15,
                        fontWeight: 700, fontFamily: F,
                        background: t.inputBg, border: `1.5px solid ${t.inputBd}`,
                        color: t.text, outline: "none",
                    }}
                />
            </div>

            {/* 기본 제목 / 내용 */}
            <div style={{ background: t.surface, borderRadius: 16, padding: "14px 16px", marginBottom: 10, boxShadow: "var(--plando-elev-1)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.text2, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10, fontFamily: F }}>기본 제목 / 내용</div>
                <input
                    placeholder="할 일 제목 (선택)"
                    value={form.defaultTitle}
                    onChange={(e) => setForm((p) => ({ ...p, defaultTitle: e.target.value }))}
                    style={{
                        width: "100%", boxSizing: "border-box",
                        padding: "10px 12px", borderRadius: 10, fontSize: 14,
                        fontWeight: 600, fontFamily: F, marginBottom: 8,
                        background: t.inputBg, border: `1px solid ${t.inputBd}`,
                        color: t.text, outline: "none",
                    }}
                />
                <textarea
                    rows={3}
                    placeholder="할 일 내용 (선택)"
                    value={form.defaultContent}
                    onChange={(e) => setForm((p) => ({ ...p, defaultContent: e.target.value }))}
                    style={{
                        width: "100%", boxSizing: "border-box",
                        padding: "10px 12px", borderRadius: 10, fontSize: 14,
                        fontFamily: F, resize: "none",
                        background: t.inputBg, border: `1px solid ${t.inputBd}`,
                        color: t.text, outline: "none",
                    }}
                />
            </div>

            {/* 상태 정보 */}
            <div style={{ background: t.surface, borderRadius: 16, padding: "14px 16px", marginBottom: 10, boxShadow: "var(--plando-elev-1)" }}>
                {/* 우선순위 세그먼트 */}
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text2, marginBottom: 6, fontFamily: F }}>우선순위</div>
                <Box sx={{
                    display: "flex",
                    bgcolor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
                    borderRadius: 2, p: "3px", gap: "3px", mb: 1.5,
                }}>
                    {PRIORITY_OPTIONS.map((opt) => {
                        const sel = form.defaultPriority === opt.value;
                        return (
                            <Box key={opt.value} onClick={() => setForm((p) => ({ ...p, defaultPriority: opt.value }))} sx={{
                                flex: 1, textAlign: "center", py: "6px", borderRadius: 1.5,
                                fontWeight: 700, fontSize: 12, fontFamily: F, cursor: "pointer", userSelect: "none",
                                transition: "background 0.15s, color 0.15s",
                                bgcolor: sel ? (isDark ? "rgba(255,255,255,0.12)" : "background.paper") : "transparent",
                                color: sel ? "text.primary" : "text.disabled",
                                boxShadow: sel ? (isDark ? "0 1px 3px rgba(0,0,0,0.4)" : "0 1px 3px rgba(0,0,0,0.15)") : "none",
                            }}>
                                {opt.label}
                            </Box>
                        );
                    })}
                </Box>

                {/* 프로젝트 */}
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text2, marginBottom: 6, fontFamily: F }}>프로젝트</div>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
                    {projectOptions.map((opt) => {
                        const optId = opt.key === "inbox" ? null : opt.key;
                        const sel = form.defaultProjectId === optId;
                        return (
                            <Chip
                                key={opt.key}
                                label={opt.label}
                                size="small"
                                onClick={() => setForm((p) => ({ ...p, defaultProjectId: optId }))}
                                variant={sel ? "filled" : "outlined"}
                                color={sel ? "primary" : "default"}
                                sx={{ fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                            />
                        );
                    })}
                </Box>

                {/* 참여자 */}
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text2, marginBottom: 6, fontFamily: F }}>담당자 (선택)</div>
                {loadingUsers ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
                        <CircularProgress size={14} /><Typography sx={{ fontSize: 13, color: "text.disabled" }}>불러오는 중...</Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                        {userList.map((u) => {
                            const sel = form.defaultAssigneeEmails.includes(u.email);
                            return (
                                <Chip
                                    key={u.email}
                                    label={u.name}
                                    size="small"
                                    onClick={() => setForm((p) => ({
                                        ...p,
                                        defaultAssigneeEmails: sel
                                            ? p.defaultAssigneeEmails.filter((e) => e !== u.email)
                                            : [...p.defaultAssigneeEmails, u.email],
                                    }))}
                                    variant={sel ? "filled" : "outlined"}
                                    color={sel ? "primary" : "default"}
                                    sx={{ fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                />
                            );
                        })}
                        {userList.length === 0 && (
                            <Typography sx={{ fontSize: 12, color: "text.disabled" }}>멤버가 없습니다.</Typography>
                        )}
                    </Box>
                )}
            </div>
        </Box>
    ) : (
        // 데스크탑: MUI Card 기반
        <Stack spacing={2} sx={{ px: 0.5 }}>
            {error && (
                <Alert severity="error" sx={{ fontSize: 13 }} onClose={() => setError("")}>
                    {error}
                </Alert>
            )}

            <TextField
                autoFocus size="small"
                label="템플릿 이름 *"
                placeholder="예: 버그 리포트, 회의록"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                fullWidth
            />

            <Card elevation={0} sx={{ borderRadius: 2.5, boxShadow: "var(--plando-elev-1)" }}>
                <CardContent sx={{ pt: 1.5, pb: "12px !important" }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>기본 제목 / 내용</Typography>
                    <TextField size="small" fullWidth placeholder="할 일 제목 (선택)" value={form.defaultTitle}
                        onChange={(e) => setForm((p) => ({ ...p, defaultTitle: e.target.value }))}
                        sx={{ mt: 1, "& input": { fontWeight: 700 } }} />
                    <TextField size="small" fullWidth multiline minRows={3} placeholder="할 일 내용 (선택)" value={form.defaultContent}
                        onChange={(e) => setForm((p) => ({ ...p, defaultContent: e.target.value }))}
                        sx={{ mt: 1.5 }} />
                </CardContent>
            </Card>

            <Card elevation={0} sx={{ borderRadius: 2.5, boxShadow: "var(--plando-elev-1)" }}>
                <CardContent sx={{ pt: 1.5, pb: "12px !important" }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 1.5 }}>상태 정보</Typography>
                    <Stack spacing={1.5}>
                        <FormControl fullWidth size="small">
                            <InputLabel shrink>우선순위</InputLabel>
                            <Select value={form.defaultPriority} label="우선순위" notched
                                onChange={(e) => setForm((p) => ({ ...p, defaultPriority: e.target.value }))}>
                                {PRIORITY_OPTIONS.map((opt) => (
                                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth size="small">
                            <InputLabel shrink>프로젝트</InputLabel>
                            <Select value={form.defaultProjectId ?? "inbox"} label="프로젝트" notched
                                onChange={(e) => setForm((p) => ({ ...p, defaultProjectId: e.target.value === "inbox" ? null : e.target.value }))}>
                                {projectOptions.map((opt) => (
                                    <MenuItem key={opt.key} value={opt.key}>{opt.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth size="small" disabled={loadingUsers}>
                            <InputLabel shrink>담당자 (선택)</InputLabel>
                            <Select multiple value={form.defaultAssigneeEmails} label="담당자 (선택)" notched
                                onChange={(e) => setForm((p) => ({ ...p, defaultAssigneeEmails: e.target.value }))}
                                renderValue={(selected) => (
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                        {selected.map((email) => {
                                            const u = userList.find((x) => x.email === email);
                                            return <Chip key={email} size="small" label={u ? u.name : email} />;
                                        })}
                                    </Box>
                                )}>
                                {loadingUsers ? (
                                    <MenuItem disabled><Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={14} /><Typography variant="body2">불러오는 중...</Typography></Stack></MenuItem>
                                ) : userList.map((u) => (
                                    <MenuItem key={u.email} value={u.email}>{u.name} ({u.email})</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                </CardContent>
            </Card>
        </Stack>
    );

    // ─── 템플릿 목록 ─────────────────────────────────────────────────
    return (
        <Box>
            {error && !open && (
                <Alert severity="error" sx={{ mb: 2, fontSize: 13 }} onClose={() => setError("")}>
                    {error}
                </Alert>
            )}

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                    <CircularProgress size={24} />
                </Box>
            ) : templates.length === 0 ? (
                /* 설정 화면이 카드를 걷어내고 구분선 정렬로 바뀌어, 점선 상자 빈 상태만 남으면
                   그 탭에서만 옛 스타일이 튄다. 담백한 문구로 맞춘다. */
                <Box sx={{ py: 3, mb: 1.5 }}>
                    <Typography sx={{ fontSize: 14, color: "text.secondary", fontWeight: 600 }}>저장된 템플릿이 없어요</Typography>
                    <Typography sx={{ fontSize: 12.5, color: "text.disabled", mt: 0.5 }}>자주 쓰는 할 일 구조를 템플릿으로 저장해두세요</Typography>
                </Box>
            ) : (
                /* 그림자 달린 카드 타일이었다. 설정 화면 전체가 상자 없이 구분선으로 묶이도록
                   바뀌어, 여기만 카드로 남으면 같은 화면 안에서 규칙이 두 개가 된다. */
                <Stack sx={{ mb: 1.5 }}>
                    {templates.map((tpl, ti) => (
                        <Box key={tpl.id} onClick={() => openEditForm(tpl)} sx={{
                            display: "flex", alignItems: "flex-start", gap: 1.5,
                            px: 0.5, py: 1.75, cursor: "pointer",
                            borderBottom: ti === templates.length - 1 ? "none" : "1px solid",
                            borderColor: "var(--plando-divider)",
                            transition: "background 0.1s",
                            "&:hover": { bgcolor: "var(--plando-surface-low)" },
                        }}>
                            <Box sx={{
                                width: 32, height: 32, borderRadius: "10px", flexShrink: 0,
                                bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
                                color: "text.secondary", display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                                <DescriptionRoundedIcon sx={{ fontSize: 18 }} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontSize: 14.5, fontWeight: 700 }} noWrap>{tpl.name}</Typography>
                                {tpl.defaultTitle?.trim() && (
                                    <Typography sx={{ fontSize: 12.5, color: "text.disabled", mt: 0.25 }} noWrap>
                                        {tpl.defaultTitle.trim()}
                                    </Typography>
                                )}
                                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75, flexWrap: "wrap", gap: 0.5 }}>
                                    {projectName(tpl.defaultProjectId) && (
                                        <Chip icon={<FolderRoundedIcon sx={{ fontSize: "12px !important" }} />}
                                            label={projectName(tpl.defaultProjectId)}
                                            size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
                                    )}
                                    {tpl.defaultPriority && (
                                        <Chip icon={<FlagIcon sx={{ fontSize: "12px !important" }} />}
                                            label={PRIORITY_LABEL[tpl.defaultPriority] ?? tpl.defaultPriority}
                                            size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
                                    )}
                                    {tpl.defaultAssigneeEmails?.length > 0 && (
                                        <Chip icon={<PersonIcon sx={{ fontSize: "12px !important" }} />}
                                            label={`담당자 ${tpl.defaultAssigneeEmails.length}명`}
                                            size="small" sx={{ height: 20, fontSize: 11 }} />
                                    )}
                                </Stack>
                            </Box>
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(tpl.id); }} sx={{
                                color: "text.disabled", flexShrink: 0, mt: -0.25,
                                "&:hover": { color: "error.main", bgcolor: alpha(theme.palette.error.main, 0.08) },
                            }}>
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </Box>
                    ))}
                </Stack>
            )}

            <Button fullWidth variant="outlined" startIcon={<AddRoundedIcon />} onClick={openForm}
                sx={{
                    borderRadius: "var(--plando-radius-card)", fontWeight: 700, fontSize: 14, py: 1.25,
                    borderStyle: "dashed", borderColor: "divider", color: "text.secondary",
                    "&:hover": { borderStyle: "dashed", borderColor: "primary.main", color: "primary.main", bgcolor: "transparent" },
                }}>
                템플릿 추가
            </Button>

            <ConfirmDialog
                open={deleteConfirmId !== null}
                title="템플릿 삭제"
                message="템플릿을 삭제하시겠습니까?"
                confirmText="삭제"
                confirmColor="error"
                onClose={() => setDeleteConfirmId(null)}
                onConfirm={() => { handleDelete(deleteConfirmId); setDeleteConfirmId(null); }}
            />

            {/* ── 모바일: SwipeableDrawer ── */}
            {isMobile && (
                <SwipeableDrawer
                    anchor="bottom"
                    open={open}
                    onOpen={() => {}}
                    onClose={closeForm}
                    disableSwipeToOpen
                    sx={{ zIndex: Z.SHEET }}
                    PaperProps={{
                        sx: {
                            borderTopLeftRadius: 20,
                            borderTopRightRadius: 20,
                            maxHeight: "92dvh",
                            background: t.bg,
                            border: "none",
                            display: "flex",
                            flexDirection: "column",
                        },
                    }}
                >
                    {/* 드래그 핸들 */}
                    <Box sx={{ display: "flex", justifyContent: "center", pt: 1.5, pb: 0.5, flexShrink: 0 }}>
                        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: t.handle }} />
                    </Box>

                    {/* 헤더 */}
                    <Box sx={{ px: 2.5, pt: 1, pb: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                        <Box>
                            <Typography sx={{ fontWeight: 900, fontSize: 17, fontFamily: F, color: t.text }}>{editingId ? "템플릿 수정" : "새 템플릿"}</Typography>
                            <Typography sx={{ fontSize: 12, color: t.text2, fontFamily: F, mt: 0.25 }}>
                                {editingId ? "템플릿 내용을 수정하세요" : "할 일 추가 시 자동으로 채워질 기본값"}
                            </Typography>
                        </Box>
                        <IconButton size="small" onClick={closeForm} sx={{ color: t.text2 }}>
                            <CloseIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                    </Box>

                    <Box sx={{ mx: 1, height: "1px", backgroundImage: `linear-gradient(to right, transparent, ${t.border} 15%, ${t.border} 85%, transparent)` }} />

                    {/* 스크롤 폼 */}
                    <Box sx={{ overflowY: "auto", flex: 1, pt: 2 }}>
                        {formContent}
                    </Box>

                    {/* 하단 저장 바 */}
                    <Box sx={{
                        px: 2, pt: 1.5, pb: `calc(env(safe-area-inset-bottom) + 16px)`,
                        backgroundImage: `linear-gradient(to right, transparent, ${t.border} 15%, ${t.border} 85%, transparent)`, backgroundSize: "100% 1px", backgroundRepeat: "no-repeat", backgroundPosition: "top", flexShrink: 0,
                        display: "flex", gap: 1,
                    }}>
                        <Button fullWidth variant="outlined" color="inherit" onClick={closeForm}
                            sx={{ fontWeight: 700, borderRadius: 2.5, py: 1.25, fontFamily: F }}>
                            취소
                        </Button>
                        <Button fullWidth variant="contained" onClick={handleSave}
                            disabled={saving || !form.name.trim()}
                            disableElevation
                            sx={{ fontWeight: 700, borderRadius: 2.5, py: 1.25, fontFamily: F }}>
                            {saving ? <CircularProgress size={18} color="inherit" /> : (editingId ? "수정 완료" : "저장")}
                        </Button>
                    </Box>
                </SwipeableDrawer>
            )}

            {/* ── 데스크탑: Dialog ── */}
            {!isMobile && (
                <Dialog open={open} onClose={closeForm} maxWidth="sm" fullWidth
                    PaperProps={{ sx: { borderRadius: 3, maxHeight: "90vh", border: "none", boxShadow: "var(--plando-elev-3)" } }}>
                    <DialogTitle sx={{ pb: 1 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Box>
                                <Typography sx={{ fontWeight: 900, fontSize: 18 }}>{editingId ? "템플릿 수정" : "새 템플릿"}</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontSize: 12 }}>
                                    {editingId ? "템플릿 내용을 수정하세요" : "할 일 추가 시 자동으로 채워질 기본값을 설정하세요"}
                                </Typography>
                            </Box>
                            <IconButton size="small" onClick={closeForm}><CloseIcon /></IconButton>
                        </Stack>
                    </DialogTitle>
                    <Box sx={{ mx: 1, height: "1px", backgroundImage: `linear-gradient(to right, transparent, var(--plando-divider) 15%, var(--plando-divider) 85%, transparent)` }} />
                    <DialogContent sx={{ py: 2, px: 2.5 }}>
                        {formContent}
                    </DialogContent>
                    <Box sx={{ mx: 1, height: "1px", backgroundImage: `linear-gradient(to right, transparent, var(--plando-divider) 15%, var(--plando-divider) 85%, transparent)` }} />
                    <Box sx={{ p: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
                        <Button variant="outlined" color="inherit" onClick={closeForm} sx={{ fontWeight: 700 }}>취소</Button>
                        <Button variant="contained" onClick={handleSave}
                            disabled={saving || !form.name.trim()} disableElevation sx={{ fontWeight: 700 }}>
                            {saving ? <CircularProgress size={16} color="inherit" /> : (editingId ? "수정 완료" : "저장")}
                        </Button>
                    </Box>
                </Dialog>
            )}
        </Box>
    );
}
