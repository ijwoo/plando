import { useState } from "react";
import { Box, Collapse, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import Press from "../../../shared/ui/primitives/Press.jsx";

/**
 * AI 가 실행한 단계 목록.
 *
 * 왜 보여주는가: 결과 문장만으로는 "어떤 조건으로 찾았는지", "무엇을 바꿨는지"를 알 수 없다.
 * 결과가 이상해도 사용자는 고칠 단서를 못 얻고 **AI 를 못 믿게 될 뿐**이다.
 * 단계를 보여주면 확인할 수 있고, 실패했을 때 어디서 멈췄는지도 드러난다.
 *
 * 기본은 접어 둔다 — 잘 돌아갈 때 매번 펼쳐져 있으면 답변을 가린다.
 * 다만 **실패한 단계가 있으면 처음부터 펼친다.** 문제가 났을 때 한 번 더 누르게 하면 안 된다.
 */

const TOOL_ICON = {
    search_tasks: SearchRoundedIcon,
    create_task: AddRoundedIcon,
    update_task: EditRoundedIcon,
    delete_task: DeleteOutlineRoundedIcon,
};

/** 인자 키를 사람 말로. 모르는 키는 그대로 둔다(빈칸보다 낫다). */
const ARG_LABEL = {
    query: "검색어",
    status: "상태",
    priority: "우선순위",
    dueDate: "마감일",
    overdue: "마감 지남",
    limit: "최대",
    title: "제목",
    taskId: "대상",
    projectName: "프로젝트",
    statusKey: "상태",
};

function formatArgValue(v) {
    if (v === true) return "예";
    if (v === false) return "아니오";
    return String(v);
}

export default function ChatSteps({ steps }) {
    const theme = useTheme();
    const hasFailure = Array.isArray(steps) && steps.some((s) => s && s.ok === false);
    const [open, setOpen] = useState(hasFailure);

    if (!Array.isArray(steps) || steps.length === 0) return null;

    const totalMs = steps.reduce((sum, s) => sum + (s?.durationMs || 0), 0);

    return (
        <Box sx={{ mt: 0.75 }}>
            <Press
                onClick={() => setOpen((v) => !v)}
                haptic="light"
                pressScale={0.99}
                activeBg={theme.palette.action.hover}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 999,
                    backgroundColor: hasFailure
                        ? alpha(theme.palette.error.main, 0.10)
                        : alpha(theme.palette.text.primary, 0.05),
                    color: hasFailure ? theme.palette.error.main : theme.palette.text.secondary,
                    fontSize: 12,
                    fontWeight: 600,
                }}
            >
                {hasFailure ? "일부 단계가 실패했어요" : `${steps.length}단계 실행`}
                {totalMs > 0 && !hasFailure && (
                    <Box component="span" sx={{ color: "text.disabled", fontWeight: 500 }}>
                        · {totalMs < 1000 ? `${totalMs}ms` : `${(totalMs / 1000).toFixed(1)}초`}
                    </Box>
                )}
                <KeyboardArrowDownRoundedIcon
                    sx={{
                        fontSize: 16,
                        transition: "transform .18s",
                        transform: open ? "rotate(180deg)" : "none",
                    }}
                />
            </Press>

            <Collapse in={open} unmountOnExit>
                <Stack spacing={0.5} sx={{ mt: 0.75 }}>
                    {steps.map((s, i) => {
                        if (!s) return null;
                        const Icon = TOOL_ICON[s.tool] || SearchRoundedIcon;
                        const failed = s.ok === false;
                        const argEntries = Object.entries(s.args || {});
                        return (
                            <Box
                                key={`${s.tool}-${i}`}
                                sx={{
                                    px: 1.25,
                                    py: 1,
                                    borderRadius: 2.5,
                                    bgcolor: failed
                                        ? (t) => alpha(t.palette.error.main, 0.06)
                                        : "var(--plando-input-bg)",
                                    border: 1,
                                    borderColor: failed
                                        ? (t) => alpha(t.palette.error.main, 0.25)
                                        : "transparent",
                                }}
                            >
                                <Stack direction="row" alignItems="center" spacing={0.875}>
                                    <Box
                                        sx={{
                                            width: 20, height: 20, borderRadius: 1,
                                            flex: "none",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            bgcolor: failed
                                                ? (t) => alpha(t.palette.error.main, 0.14)
                                                : s.mutating
                                                    ? (t) => alpha(t.palette.warning.main, 0.16)
                                                    : (t) => alpha(t.palette.primary.main, 0.12),
                                            color: failed
                                                ? "error.main"
                                                : s.mutating ? "warning.dark" : "primary.main",
                                        }}
                                    >
                                        <Icon sx={{ fontSize: 13 }} />
                                    </Box>

                                    <Typography sx={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }}>
                                        {s.summary || s.tool}
                                    </Typography>

                                    {/* 데이터를 바꾼 단계는 눈에 띄게 — 조회와 삭제가 같아 보이면 안 된다 */}
                                    {s.mutating && !failed && (
                                        <Box
                                            component="span"
                                            sx={{
                                                flex: "none",
                                                px: 0.625, borderRadius: 999,
                                                fontSize: 10.5, fontWeight: 700, lineHeight: 1.7,
                                                bgcolor: (t) => alpha(t.palette.warning.main, 0.16),
                                                color: "warning.dark",
                                            }}
                                        >
                                            변경
                                        </Box>
                                    )}

                                    {failed
                                        ? <CloseRoundedIcon sx={{ fontSize: 15, color: "error.main", flex: "none" }} />
                                        : <CheckRoundedIcon sx={{ fontSize: 15, color: "success.main", flex: "none" }} />}
                                </Stack>

                                {argEntries.length > 0 && (
                                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.625, flexWrap: "wrap", gap: 0.5, pl: 3.5 }}>
                                        {argEntries.map(([k, v]) => (
                                            <Box
                                                key={k}
                                                sx={{
                                                    px: 0.75, py: 0.125, borderRadius: 1,
                                                    bgcolor: "background.paper",
                                                    border: 1, borderColor: "divider",
                                                    fontSize: 11, color: "text.secondary",
                                                }}
                                            >
                                                {ARG_LABEL[k] || k} <strong>{formatArgValue(v)}</strong>
                                            </Box>
                                        ))}
                                    </Stack>
                                )}

                                {failed ? (
                                    <Typography sx={{ mt: 0.625, pl: 3.5, fontSize: 12, color: "error.main", lineHeight: 1.5 }}>
                                        {s.error || "처리하지 못했어요."}
                                    </Typography>
                                ) : (
                                    (s.result?.count != null || s.durationMs > 0) && (
                                        <Typography sx={{ mt: 0.5, pl: 3.5, fontSize: 11.5, color: "text.disabled" }}>
                                            {s.result?.count != null && `결과 ${s.result.count}건`}
                                            {s.result?.count != null && s.durationMs > 0 && " · "}
                                            {s.durationMs > 0 && (s.durationMs < 1000
                                                ? `${s.durationMs}ms`
                                                : `${(s.durationMs / 1000).toFixed(1)}초`)}
                                        </Typography>
                                    )
                                )}
                            </Box>
                        );
                    })}
                </Stack>
            </Collapse>
        </Box>
    );
}
