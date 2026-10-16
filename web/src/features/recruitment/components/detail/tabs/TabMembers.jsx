import { Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { MemberAvatar } from "../../common/RecruitmentUI";
import { metaPillSx } from "../../common/recruitmentSx";
import useUserQaStats, { formatLatencyKor } from "../../../hooks/useUserQaStats";

export default function TabMembers({ leader, members, cat }) {
    const theme = useTheme();
    const otherMembers = (members || []).filter(
        (m) => m.name !== leader?.name && m.id !== leader?.id
    );

    // 팀장(=작성자) Q&A 응답 신뢰도 — totalQuestionCount > 0일 때만 라인 노출
    const { stats: leaderQaStats } = useUserQaStats(leader?.userId);

    return (
        <Stack spacing={2}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.disabled", letterSpacing: "0.07em", textTransform: "uppercase" }}>
                팀원 {1 + otherMembers.length}명
            </Typography>

            {/* 팀장 row — cat color tint 강조 */}
            <Box sx={{
                p: 1.75,
                borderRadius: 2,
                bgcolor: alpha(cat.color, 0.06),
                border: 0,
            }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <MemberAvatar name={leader?.name} size={42} role={leader?.role} />
                    <Box sx={{
                        ...metaPillSx(theme, cat.color),
                        fontSize: 10.5,
                        fontWeight: 700,
                        px: 1,
                        py: 0.25,
                    }}>
                        팀장
                    </Box>
                </Stack>

                {/* 팀장 Q&A 응답 신뢰도 — totalQuestionCount > 0일 때만 (Phase 5) */}
                {leaderQaStats && (
                    <Typography sx={{
                        mt: 1.25,
                        fontSize: 11.5,
                        fontWeight: 500,
                        color: "text.secondary",
                        letterSpacing: "-0.005em",
                    }}>
                        Q&amp;A 응답 · 평균 {formatLatencyKor(leaderQaStats.avgAnswerLatencyMinutes) ?? "-"}
                        {" · "}응답률 {leaderQaStats.answerRate ?? "-"}%
                        {" · "}응답 {leaderQaStats.answeredCount}건
                    </Typography>
                )}
            </Box>

            {/* 팀원 */}
            {otherMembers.map((m) => (
                <Box key={m.id} sx={{
                    p: 1.75,
                    borderRadius: 2,
                    border: 0,
                    bgcolor: alpha(theme.palette.text.primary, 0.03),
                }}>
                    <MemberAvatar name={m.name} size={40} role={m.role} />
                </Box>
            ))}

            {otherMembers.length === 0 && (
                <Box sx={{ textAlign: "center", py: 4 }}>
                    <Box sx={{
                        width: 56, height: 56,
                        borderRadius: 1.75,
                        bgcolor: alpha(theme.palette.text.primary, 0.04),
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 26,
                        mb: 1.5,
                    }}>
                        👥
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.primary" }}>
                        아직 합류한 팀원이 없어요
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "text.disabled", mt: 0.5 }}>
                        신청자를 수락하면 이 곳에 표시됩니다
                    </Typography>
                </Box>
            )}
        </Stack>
    );
}
