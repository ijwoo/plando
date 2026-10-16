import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { fieldSx, FieldLabel } from "../../../shared/ui/common/fieldStyles.jsx";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { createAgent, updateAgent, deleteAgent } from "../api/chatApi.js";

/**
 * 역할 만들기 · 수정.
 *
 * 이 화면의 핵심은 이름이나 지침이 아니라 **어떤 도구를 줄지**다.
 * "무엇을 할 수 있는가"가 곧 "무엇을 망칠 수 있는가"이기 때문에, 고르는 순간 결과를
 * 바로 보여준다(아무것도 안 고르면 제한 없음 — 그 사실을 분명히 알린다).
 */

const TOOL_OPTIONS = [
    { id: "search_tasks", label: "조회", desc: "할 일을 찾아봐요", mutating: false },
    { id: "create_task", label: "생성", desc: "새 할 일을 만들어요", mutating: true },
    { id: "update_task", label: "수정", desc: "기존 할 일을 바꿔요", mutating: true },
    { id: "delete_task", label: "삭제", desc: "할 일을 지워요", mutating: true },
];

const EMOJI_CHOICES = ["🤖", "📝", "🧭", "🎯", "📊", "🗂️", "🔔", "💡"];

export default function AgentEditDialog({ open, agent, onClose, onSaved }) {
    const theme = useTheme();
    const editing = Boolean(agent?.id);

    const [name, setName] = useState("");
    const [emoji, setEmoji] = useState("🤖");
    const [description, setDescription] = useState("");
    const [instructions, setInstructions] = useState("");
    const [tools, setTools] = useState([]);
    const [summarize, setSummarize] = useState(false);
    const [voice, setVoice] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) return;
        setName(agent?.name ?? "");
        setEmoji(agent?.emoji ?? "🤖");
        setDescription(agent?.description ?? "");
        setInstructions(agent?.instructions ?? "");
        setTools(Array.isArray(agent?.tools) ? [...agent.tools] : []);
        setSummarize(!!agent?.summarize);
        setVoice(!!agent?.voice);
        setError("");
    }, [open, agent]);

    const toggleTool = (id) =>
        setTools((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

    // 고른 도구로부터 바로 계산한다 — 서버 판정과 같은 규칙이라 화면이 거짓말하지 않는다
    const unrestricted = tools.length === 0;
    const readOnly = !unrestricted && tools.every((t) => !TOOL_OPTIONS.find((o) => o.id === t)?.mutating);

    const handleSave = async () => {
        if (!name.trim()) { setError("역할 이름을 입력해 주세요."); return; }
        setSaving(true);
        setError("");
        try {
            const payload = { name, emoji, description, instructions, tools, summarize, voice };
            if (editing) {
                await updateAgent(String(agent.id).replace("custom:", ""), payload);
            } else {
                await createAgent(payload);
            }
            onSaved?.();
            onClose?.();
        } catch (e) {
            // 저장이 안 됐는데 닫히면 사용자는 저장된 줄 안다 — 열어둔 채 이유를 보여준다
            setError(e?.response?.data?.message || "저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setSaving(true);
        setError("");
        try {
            await deleteAgent(String(agent.id).replace("custom:", ""));
            onSaved?.();
            onClose?.();
        } catch (e) {
            setError(e?.response?.data?.message || "삭제하지 못했어요.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontSize: 18, fontWeight: 800 }}>
                {editing ? "역할 수정" : "역할 만들기"}
            </DialogTitle>

            <DialogContent dividers>
                <Stack spacing={2.25}>
                    {error && <Alert severity="error">{error}</Alert>}

                    <Box>
                        <FieldLabel htmlFor="agent-name">이름</FieldLabel>
                        <Stack direction="row" spacing={1}>
                            <TextField
                                id="agent-name"
                                fullWidth
                                size="small"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="예: 회고 도우미"
                                sx={fieldSx(theme)}
                            />
                        </Stack>
                        <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}>
                            {EMOJI_CHOICES.map((e) => (
                                <Press
                                    key={e}
                                    onClick={() => setEmoji(e)}
                                    haptic="light"
                                    pressScale={0.94}
                                    style={{
                                        width: 34, height: 34, borderRadius: 9,
                                        fontSize: 17, lineHeight: "34px", textAlign: "center",
                                        backgroundColor: e === emoji
                                            ? alpha(theme.palette.primary.main, 0.14)
                                            : theme.palette.action.hover,
                                    }}
                                >
                                    {e}
                                </Press>
                            ))}
                        </Stack>
                    </Box>

                    <Box>
                        <FieldLabel htmlFor="agent-desc">설명</FieldLabel>
                        <TextField
                            id="agent-desc"
                            fullWidth
                            size="small"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="목록에서 무엇을 하는 역할인지 알 수 있게"
                            sx={fieldSx(theme)}
                        />
                    </Box>

                    <Box>
                        <FieldLabel htmlFor="agent-inst">지침</FieldLabel>
                        <TextField
                            id="agent-inst"
                            fullWidth
                            multiline
                            minRows={4}
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder={"AI 가 어떻게 행동할지 적어주세요.\n예: 조회한 내용을 바탕으로 질문을 던져라. 한 번에 많이 바꾸지 마라."}
                            sx={fieldSx(theme)}
                        />
                        <Typography sx={{ mt: 0.5, fontSize: 11.5, color: "text.disabled" }}>
                            {instructions.length} / 1200자 · 길수록 매 대화의 비용이 늘어요
                        </Typography>
                    </Box>

                    <Box>
                        <FieldLabel>할 수 있는 일</FieldLabel>
                        <Stack spacing={0.5}>
                            {TOOL_OPTIONS.map((t) => {
                                const on = tools.includes(t.id);
                                return (
                                    <Press
                                        key={t.id}
                                        onClick={() => toggleTool(t.id)}
                                        haptic="light"
                                        pressScale={0.99}
                                        activeBg={theme.palette.action.hover}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 10,
                                            padding: "10px 12px", borderRadius: 10, textAlign: "left",
                                            backgroundColor: on
                                                ? alpha(t.mutating ? theme.palette.warning.main : theme.palette.primary.main, 0.10)
                                                : "transparent",
                                            boxShadow: on ? "none" : "var(--plando-shadow-card-ring)",
                                        }}
                                    >
                                        <span style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ display: "block", fontSize: 13.5, fontWeight: on ? 700 : 600 }}>
                                                {t.label}
                                                {t.mutating && (
                                                    <span style={{ marginLeft: 6, fontSize: 11, color: theme.palette.warning.dark }}>
                                                        데이터 변경
                                                    </span>
                                                )}
                                            </span>
                                            <span style={{ display: "block", marginTop: 2, fontSize: 11.5, color: theme.palette.text.disabled }}>
                                                {t.desc}
                                            </span>
                                        </span>
                                        <span style={{ fontSize: 13, color: on ? theme.palette.primary.main : theme.palette.text.disabled }}>
                                            {on ? "켬" : "끔"}
                                        </span>
                                    </Press>
                                );
                            })}
                        </Stack>

                    </Box>

                    <Box>
                        <FieldLabel>조회 결과 요약</FieldLabel>
                        {/* 조회마다 AI 를 한 번 더 부른다 — 하루 사용량이 그만큼 더 든다.
                            그래서 전역이 아니라 역할마다 두고, 비용을 문구에 그대로 적는다. */}
                        <Press
                            onClick={() => setSummarize((v) => !v)}
                            haptic="light"
                            pressScale={0.99}
                            activeBg={theme.palette.action.hover}
                            style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "10px 12px", borderRadius: 10, textAlign: "left", width: "100%",
                                backgroundColor: summarize ? alpha(theme.palette.primary.main, 0.10) : "transparent",
                                boxShadow: summarize ? "none" : "var(--plando-shadow-card-ring)",
                            }}
                        >
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: "block", fontSize: 13.5, fontWeight: summarize ? 700 : 600 }}>
                                    무엇부터 할지 한 줄로 알려주기
                                </span>
                                <span style={{ display: "block", marginTop: 2, fontSize: 11.5, color: theme.palette.text.disabled }}>
                                    조회할 때마다 AI 를 한 번 더 써요 (하루 사용량 2배)
                                </span>
                            </span>
                            <span style={{ fontSize: 13, color: summarize ? theme.palette.primary.main : theme.palette.text.disabled }}>
                                {summarize ? "켬" : "끔"}
                            </span>
                        </Press>

                        {/* 말투 — 이 앱의 답변은 서버가 만든 고정 문구라, 지침을 아무리 써도
                            말투가 안 바뀌었다. 이걸 켠 역할만 답변을 지침대로 다시 쓴다.
                            둘 다 켜면 위의 한 줄 요약은 건너뛴다(서버가 그렇게 처리한다) —
                            같은 값을 위해 AI 를 두 번 쓰지 않게. 그 사실을 문구에 적는다. */}
                        <Press
                            onClick={() => setVoice((v) => !v)}
                            haptic="light"
                            pressScale={0.99}
                            activeBg={theme.palette.action.hover}
                            style={{
                                display: "flex", alignItems: "center", gap: 10, marginTop: 8,
                                padding: "10px 12px", borderRadius: 10, textAlign: "left", width: "100%",
                                backgroundColor: voice ? alpha(theme.palette.primary.main, 0.10) : "transparent",
                                boxShadow: voice ? "none" : "var(--plando-shadow-card-ring)",
                            }}
                        >
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: "block", fontSize: 13.5, fontWeight: voice ? 700 : 600 }}>
                                    지침대로 말하게 하기
                                </span>
                                <span style={{ display: "block", marginTop: 2, fontSize: 11.5, color: theme.palette.text.disabled }}>
                                    {voice
                                        ? "위 지침의 말투로 답변을 다시 써요. 켜면 한 줄 요약은 건너뜁니다"
                                        : "끄면 지침은 도구 선택에만 쓰이고 답변 말투는 안 바뀌어요"}
                                </span>
                            </span>
                            <span style={{ fontSize: 13, color: voice ? theme.palette.primary.main : theme.palette.text.disabled }}>
                                {voice ? "켬" : "끔"}
                            </span>
                        </Press>
                    </Box>

                    <Box>
                        {/* 고른 결과를 즉시 말해준다 — 저장하고 나서 알면 늦다 */}
                        <Alert
                            severity={unrestricted ? "warning" : readOnly ? "success" : "info"}
                            sx={{ mt: 1.25, py: 0.5, fontSize: 12.5 }}
                        >
                            {unrestricted
                                ? "아무것도 고르지 않으면 제한 없이 모든 일을 할 수 있어요."
                                : readOnly
                                    ? "이 역할은 아무것도 바꾸지 않아요. 조회만 합니다."
                                    : "이 역할은 데이터를 바꿀 수 있어요."}
                        </Alert>
                    </Box>
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
                <Box>
                    {editing && (
                        <Button color="error" onClick={handleDelete} disabled={saving}>
                            삭제
                        </Button>
                    )}
                </Box>
                <Stack direction="row" spacing={1}>
                    <Button onClick={onClose} disabled={saving}>취소</Button>
                    <Button variant="contained" onClick={handleSave} disabled={saving}>
                        {saving ? "저장 중…" : "저장"}
                    </Button>
                </Stack>
            </DialogActions>
        </Dialog>
    );
}
