import { useEffect, useMemo, useRef, useState } from "react";
import { useKeyboardOffset } from "../../../../shared/hooks/useKeyboardOffset.js";
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Stack,
    Typography,
    useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Z } from "../../../../shared/ui/zIndex.js";
import { APP_EVENTS } from "../../../../shared/constants/events.js";
import ConfirmDialog from "../../../../shared/ui/common/ConfirmDialog";
import { useWorkspace } from "../../../workspace/context/WorkspaceContext";

function toast(message, severity = "warning") {
    window.dispatchEvent(
        new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message, severity } })
    );
}
import { createWorkspace, uploadWorkspaceIcon } from "../../../workspace/api/workspaceApi";
import { createInitialForm, StepBar } from "../create/createFormShared";
import Step1BasicInfo from "../create/Step1BasicInfo";
import Step2Roles from "../create/Step2Roles";
import Step3Process from "../create/Step3Process";
import Step4Preview from "../create/Step4Preview";
import WsTypeStep from "../create/WsTypeStep";
import WsExistingStep from "../create/WsExistingStep";
import WsNewStep from "../create/WsNewStep";

const STEPS = [Step1BasicInfo, Step2Roles, Step3Process, Step4Preview];

export default function RecruitmentCreateModal({ open, onClose, onSubmit, initialValues, workspaceMemberCount = 1, kakaoReady = false, editMode = false, editId = null }) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("md"));
    const kbOffset = useKeyboardOffset();
    const bodyRef = useRef(null);
    const { currentWorkspace, workspaces, loadWorkspaces } = useWorkspace();

    const wsName = currentWorkspace?.workspaceName || null;

    // ── 워크스페이스 선택 단계 상태 ──
    // 단일 phase: "select"(모드 + 하위 입력 통합) | "done"
    const [wsPhase, setWsPhase] = useState(editMode ? "done" : "select");
    const [wsMode, setWsMode] = useState(null);     // "existing" | "new"
    const [selectedWsId, setSelectedWsId] = useState(null);
    const [newWsData, setNewWsData] = useState({ workspaceName: "", iconFile: null, iconPreview: null });
    const [wsError, setWsError] = useState("");

    const [step, setStep] = useState(0);
    const [form, setForm] = useState(createInitialForm(workspaceMemberCount));
    const [submitting, setSubmitting] = useState(false);
    const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

    // "새 워크스페이스" 모드에서 이번 작성 세션 중 이미 생성한 워크스페이스 { id, name }.
    // 게시 실패 후 재시도 시 워크스페이스를 또 만들지 않고 재사용하기 위한 기록.
    const createdWsRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        setStep(0);
        setSubmitting(false);
        setForm({ ...createInitialForm(workspaceMemberCount), ...(initialValues || {}) });
        setWsPhase(editMode ? "done" : "select");
        setWsMode(null);
        setSelectedWsId(null);
        setNewWsData({ workspaceName: "", iconFile: null, iconPreview: null });
        setWsError("");
        setConfirmCloseOpen(false);
        createdWsRef.current = null;
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    /**
     * 작성 중 닫기 방지용 dirty 판정.
     * - editMode: 항상 dirty (기존 데이터를 수정 중)
     * - 신규: 사용자가 의도적으로 입력한 흔적이 하나라도 있으면 dirty
     *   (default 값으로 채워지는 currentMembers/maxMembers/meetType 등은 제외)
     */
    const isDirty = useMemo(() => {
        if (editMode) return true;
        if (form.title?.trim()) return true;
        if (form.desc?.trim()) return true;
        if ((form.roles?.length ?? 0) > 0) return true;
        if ((form.stacks?.length ?? 0) > 0) return true;
        if (form.deadline) return true;
        if (form.location) return true;
        if ((form.tools?.length ?? 0) > 0) return true;
        if (wsMode || selectedWsId || newWsData.workspaceName?.trim() || newWsData.iconFile) return true;
        return false;
    }, [editMode, form, wsMode, selectedWsId, newWsData]);

    const attemptClose = () => {
        if (submitting) return; // 제출 중엔 닫기 무시
        if (isDirty) {
            setConfirmCloseOpen(true);
        } else {
            onClose?.();
        }
    };

    const handleConfirmDiscard = () => {
        setConfirmCloseOpen(false);
        onClose?.();
    };

    // 모드 변경 시: "existing" 선택하면 현재 워크스페이스를 default로 자동 선택
    const handleSetWsMode = (mode) => {
        setWsMode(mode);
        if (mode === "existing" && !selectedWsId) {
            setSelectedWsId(currentWorkspace?.workspaceId || null);
        }
    };

    useEffect(() => {
        bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, [step]);

    // 각 step에서 가장 먼저 비어 있는 필드를 사용자 문구로 반환. null이면 valid.
    const validationHint = useMemo(() => {
        if (step === 0) {
            if (!form.category) return "카테고리를 선택해 주세요.";
            if (form.title.trim().length < 2) return "제목을 2자 이상 입력해 주세요.";
            if (form.desc.trim().length < 10) return "프로젝트 설명을 10자 이상 입력해 주세요.";
            return null;
        }
        if (step === 1) {
            if (!(form.maxMembers > form.currentMembers)) return "현재 인원보다 많은 최대 인원을 설정해 주세요.";
            if (form.roles.length === 0) return "역할을 1개 이상 추가해 주세요.";
            const totalRoles = form.roles.reduce((s, r) => s + Number(r.count), 0);
            if (totalRoles > (form.maxMembers - form.currentMembers)) {
                return "역할 인원 합계가 남은 자리보다 많아요. 인원을 조정해 주세요.";
            }
            return null;
        }
        if (step === 2) {
            if (!form.meetType) return "진행 방식을 선택해 주세요.";
            if (!form.frequency) return "모임 빈도를 선택해 주세요.";
            if (!form.duration) return "프로젝트 기간을 선택해 주세요.";
            if (!form.deadline) return "마감일을 선택해 주세요.";
            const needsLocation = form.meetType === "offline" || form.meetType === "hybrid";
            if (needsLocation && !form.location) return "오프라인 모임 장소를 선택해 주세요.";
            return null;
        }
        return null;
    }, [step, form]);

    const isValid = validationHint === null;

    const handleNextClick = () => {
        if (!isValid) {
            toast(validationHint, "warning");
            return;
        }
        setStep((s) => s + 1);
    };

    const selectedWsName = useMemo(() => {
        if (selectedWsId) {
            const found = workspaces?.find((w) => w.workspaceId === selectedWsId);
            return found?.workspaceName || wsName;
        }
        return wsName;
    }, [selectedWsId, workspaces, wsName]);

    // ── 워크스페이스 단계 유효성 + 진행 핸들러 ──
    const wsSelectValid =
        wsMode === "existing"
            ? !!selectedWsId
            : wsMode === "new"
                ? !!newWsData.workspaceName.trim()
                : false;

    const handleWsContinue = () => {
        if (!wsSelectValid) return;
        if (wsMode === "existing") {
            // 선택한 워크스페이스의 멤버 수를 form.currentMembers로 자동 매핑.
            // memberCount 누락 시 1로 안전 fallback.
            const ws = workspaces?.find((w) => w.workspaceId === selectedWsId);
            const memberCount = Math.max(1, Number(ws?.memberCount) || 1);
            setForm((prev) => ({
                ...prev,
                currentMembers: memberCount,
                maxMembers: Math.max(prev.maxMembers, memberCount + 1),
            }));
        } else {
            // 새 워크스페이스는 본인 1명만 있는 상태로 시작
            setForm((prev) => ({
                ...prev,
                currentMembers: 1,
                maxMembers: Math.max(prev.maxMembers, 3),
            }));
        }
        setWsPhase("done");
    };

    const handleSubmit = async () => {
        if (!isValid || submitting) return;
        setSubmitting(true);

        let wsId = selectedWsId;

        // 새 워크스페이스: 모집글 제출 직전에 생성 (취소 시 생성되지 않도록)
        if (wsMode === "new") {
            const newWsName = newWsData.workspaceName.trim();
            if (createdWsRef.current && createdWsRef.current.name === newWsName) {
                // 이전 제출 시도에서 이미 생성됨 → 재사용 (재시도로 인한 중복 생성 방지)
                wsId = createdWsRef.current.id;
            } else {
                try {
                    const res = await createWorkspace({ name: newWsName });
                    wsId = res?.workspaceId ?? res?.data?.workspaceId ?? null;
                    if (wsId) createdWsRef.current = { id: wsId, name: newWsName };
                    if (wsId && newWsData.iconFile) {
                        try { await uploadWorkspaceIcon(wsId, newWsData.iconFile); } catch { /* 아이콘 업로드 실패 무시 */ }
                    }
                    await loadWorkspaces();
                    // 워크스페이스는 이 시점에 생성 완료 — 이후 게시가 실패해도 남아 있음을 알린다
                    toast(`워크스페이스 '${newWsName}'가 생성되었어요.`, "success");
                } catch (e) {
                    setWsError(e?.response?.data?.message || "워크스페이스 생성에 실패했어요");
                    setWsPhase("select");
                    setStep(0);
                    setSubmitting(false);
                    return;
                }
            }
        }

        const ok = await onSubmit?.({
            ...form,
            _editId: editMode ? editId : undefined,
            title: form.title.trim(),
            summary: form.desc.trim(),
            techStacks: form.stacks,
            hasLocation: !!(form.location?.locationLat),
            locationText: form.location?.locationName
                || (form.meetType === "online" ? "어디서든 참여 가능" : ""),
            locationLat: form.location?.locationLat ?? null,
            locationLng: form.location?.locationLng ?? null,
            roles: form.roles.filter((r) => r.name.trim()).map((r) => ({ ...r, name: r.name.trim(), count: Number(r.count) || 1 })),
            workspaceId: wsId || form.workspaceId || currentWorkspace?.workspaceId || null,
        });
        // 게시 실패(onSubmit이 명시적으로 false 반환) + 이번 세션에 새 워크스페이스를 만든 경우:
        // 재시도 시 그 워크스페이스를 그대로 쓴다는 것을 안내 (페이지의 실패 토스트를 보완)
        if (ok === false && wsMode === "new" && createdWsRef.current) {
            toast(
                `모집글 게시에 실패했어요. 워크스페이스 '${createdWsRef.current.name}'는 이미 생성되어 있어, 다시 게시하면 그대로 사용돼요.`,
                "warning"
            );
        }
        setSubmitting(false);
    };

    const StepComponent = STEPS[step];

    // 전체 진행 단계 (워크스페이스 + Step1~4 = 5)
    // 표시상 step 라벨에서 워크스페이스는 별도 표시이므로 1~4로 간주
    const displayStep = wsPhase !== "done" ? 1 : step + 2;
    // StepBar는 1~4(워크스페이스/기본/역할/진행) 라벨만 사용 → 워크스페이스 단계는 1, 이후는 +1
    const stepBarStep = wsPhase !== "done" ? 1 : step + 2;

    return (
        <Dialog
            open={open}
            onClose={attemptClose}
            fullScreen={fullScreen}
            fullWidth
            maxWidth="md"
            sx={{ zIndex: Z.MODAL_NESTED }}
            PaperProps={{
                sx: {
                    borderRadius: fullScreen ? 0 : 4,
                    overflow: "hidden",
                    display: "flex", flexDirection: "column",
                    maxHeight: "100vh",
                },
            }}
        >
            {/* 헤더 */}
            <DialogTitle sx={{ px: { xs: 2, sm: 2.5 }, pt: { xs: 2, sm: 2.25 }, pb: 0.5, flexShrink: 0 }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{
                            fontSize: { xs: 17, sm: 18 },
                            fontWeight: 800,
                            letterSpacing: "-0.025em",
                            color: "text.primary",
                            lineHeight: 1.2,
                        }}>
                            {editMode ? "모집글 수정" : "모집글 올리기"}
                        </Typography>
                        <Typography sx={{
                            mt: 0.25,
                            fontSize: 12.5,
                            color: "text.disabled",
                            fontWeight: 500,
                            letterSpacing: "-0.005em",
                        }}>
                            {editMode ? "내용을 수정해 보세요" : "팀원을 모집해 보세요"}
                        </Typography>
                    </Box>
                    <IconButton
                        onClick={attemptClose}
                        size="small"
                        sx={{
                            width: 32, height: 32,
                            borderRadius: 1.5,
                            color: "text.secondary",
                            "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.06), color: "text.primary" },
                        }}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Stack>
            </DialogTitle>

            {/* 스텝퍼 */}
            {!editMode && (
                <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 1.75, pb: 1.25, flexShrink: 0 }}>
                    <StepBar step={stepBarStep} />
                </Box>
            )}

            {/* 바디 */}
            <DialogContent
                ref={bodyRef}
                sx={{
                    px: { xs: 2, sm: 2.5 },
                    pt: 1.75,
                    pb: kbOffset > 0 ? `${kbOffset}px` : 1,
                    flex: 1,
                    overflow: "auto",
                }}
            >
                {wsPhase === "select" && (
                    <Stack spacing={2.75}>
                        <WsTypeStep wsMode={wsMode} setWsMode={handleSetWsMode} />
                        {wsMode === "existing" && (
                            <WsExistingStep
                                workspaces={workspaces || []}
                                selectedWsId={selectedWsId}
                                setSelectedWsId={setSelectedWsId}
                            />
                        )}
                        {wsMode === "new" && (
                            <WsNewStep
                                newWsData={newWsData}
                                setNewWsData={setNewWsData}
                                wsError={wsError}
                            />
                        )}
                    </Stack>
                )}
                {wsPhase === "done" && (
                    <StepComponent form={form} setForm={setForm} workspaceName={selectedWsName} kakaoReady={kakaoReady} />
                )}
            </DialogContent>

            {/* 푸터 */}
            <DialogActions sx={{
                px: { xs: 2, sm: 2.5 },
                py: 1.75,
                borderTop: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                flexShrink: 0,
                justifyContent: "space-between",
                gap: 1,
            }}>
                {wsPhase !== "done" ? (
                    <>
                        <Button
                            variant="outlined"
                            onClick={attemptClose}
                            sx={{
                                borderRadius: 1.5,
                                fontWeight: 700,
                                fontSize: 13.5,
                                minWidth: 88,
                                height: 44,
                                color: "text.primary",
                                borderColor: alpha(theme.palette.text.primary, 0.12),
                                "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.04), borderColor: alpha(theme.palette.text.primary, 0.2) },
                            }}
                        >
                            취소
                        </Button>
                        <Typography sx={{
                            flex: 1,
                            textAlign: "center",
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "text.disabled",
                            fontVariantNumeric: "tabular-nums",
                        }}>
                            {displayStep}/4 단계
                        </Typography>
                        <Button
                            variant="contained"
                            disableElevation
                            disabled={!wsSelectValid}
                            onClick={handleWsContinue}
                            sx={{
                                borderRadius: 1.5,
                                fontWeight: 800,
                                fontSize: 13.5,
                                minWidth: 88,
                                height: 44,
                            }}
                        >
                            다음 →
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            variant="outlined"
                            onClick={() => {
                                if (step > 0) setStep((s) => s - 1);
                                else if (editMode) attemptClose();
                                else setWsPhase("select");
                            }}
                            sx={{
                                borderRadius: 1.5,
                                fontWeight: 700,
                                fontSize: 13.5,
                                minWidth: 88,
                                height: 44,
                                color: "text.primary",
                                borderColor: alpha(theme.palette.text.primary, 0.12),
                                "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.04), borderColor: alpha(theme.palette.text.primary, 0.2) },
                            }}
                        >
                            {step === 0 ? (editMode ? "취소" : "← 워크스페이스") : "← 이전"}
                        </Button>
                        {!editMode && step < STEPS.length - 1 && (
                            <Typography sx={{
                                flex: 1,
                                textAlign: "center",
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: "text.disabled",
                                fontVariantNumeric: "tabular-nums",
                            }}>
                                {displayStep}/4 단계
                            </Typography>
                        )}
                        {(editMode || step >= STEPS.length - 1) && <Box sx={{ flex: 1 }} />}
                        {step < STEPS.length - 1 ? (
                            <Button
                                variant="contained"
                                disableElevation
                                onClick={handleNextClick}
                                sx={{
                                    borderRadius: 1.5,
                                    fontWeight: 800,
                                    fontSize: 13.5,
                                    minWidth: 88,
                                    height: 44,
                                    opacity: isValid ? 1 : 0.55,
                                    "&:hover": { opacity: isValid ? 1 : 0.65 },
                                }}
                            >
                                다음 →
                            </Button>
                        ) : (
                            <Button
                                variant="contained"
                                color="primary"
                                disableElevation
                                onClick={() => {
                                    if (!isValid) { toast(validationHint, "warning"); return; }
                                    handleSubmit();
                                }}
                                disabled={submitting}
                                sx={{
                                    borderRadius: 1.5,
                                    fontWeight: 800,
                                    fontSize: 13.5,
                                    minWidth: 140,
                                    height: 44,
                                    opacity: isValid ? 1 : 0.55,
                                    "&:hover": { opacity: isValid ? 1 : 0.65 },
                                }}
                            >
                                {submitting ? <CircularProgress size={16} color="inherit" /> : editMode ? "✏️ 수정 완료" : "🚀 모집글 게시하기"}
                            </Button>
                        )}
                    </>
                )}
            </DialogActions>

            <ConfirmDialog
                open={confirmCloseOpen}
                title={editMode ? "수정을 취소할까요?" : "모집글 작성을 취소할까요?"}
                message={editMode
                    ? "변경한 내용은 저장되지 않아요."
                    : "지금까지 작성한 내용은 저장되지 않아요."}
                confirmText="나가기"
                cancelText="계속 작성"
                confirmColor="error"
                onClose={() => setConfirmCloseOpen(false)}
                onConfirm={handleConfirmDiscard}
                zIndex={Z.MODAL_NESTED + 100}
            />
        </Dialog>
    );
}
