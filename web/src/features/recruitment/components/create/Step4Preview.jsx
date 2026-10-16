import { Box, Stack, Typography, useMediaQuery } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import PostCard from "../list/PostCard";
import RecruitmentCard from "../list/RecruitmentCard";
import { MEET_TYPE_CFG, normalizeMeetType } from "../../constants/recruitmentConfig";

// form 데이터를 PostCard가 기대하는 item 형태로 변환
function formToPreviewItem(form) {
    const meetType = normalizeMeetType(form.meetType) || "online";
    return {
        id: "preview",
        typeLabel: form.category,
        title: form.title || "모집글 제목을 입력해 주세요",
        summary: form.desc || "프로젝트 소개를 입력해 주세요",
        tags: form.stacks,
        roles: form.roles.map((r) => (typeof r === "string" ? r : r.name)),
        // 진행 방식 뱃지도 실제 카드와 동일하게 보이도록 전달 (예전엔 hasLocation만 넘겨 온/오프 구분이 사라졌다)
        meetType,
        hasLocation: (meetType === "offline" || meetType === "hybrid") && !!form.location,
        locationText: form.location?.locationName || "",
        locationLat: form.location?.locationLat ?? null,
        locationLng: form.location?.locationLng ?? null,
        author: "나",
        members: `${form.currentMembers}/${form.maxMembers}명`,
        dueText: form.deadline ? `~${form.deadline}` : "",
        appliedStatus: null,
        bookmarked: false,
    };
}

const REQUIRED_ROWS = [
    ["카테고리", (f) => f.category],
    ["제목",     (f) => f.title],
    ["소개",     (f) => f.desc ? `${f.desc.slice(0, 32)}…` : null],
    ["모집 역할", (f) => f.roles.length > 0 ? f.roles.map((r) => `${r.name} ${r.count}명`).join(", ") : null, true],
    // 요약표는 사용자에게 보여주는 값이다 — 내부 enum("online"/"hybrid")이 아니라 한국어 라벨로
    ["진행 방식", (f) => MEET_TYPE_CFG[normalizeMeetType(f.meetType)]?.longLabel ?? null],
    ["빈도",     (f) => f.frequency],
    ["기간",     (f) => f.duration],
    ["마감일",   (f) => f.deadline],
];

export default function Step4Preview({ form }) {
    const theme = useTheme();
    const isMobile = useMediaQuery("(max-width:600px)");
    const previewItem = formToPreviewItem(form);
    // 환경에 따라 실제 게시판이 사용하는 카드와 동일한 컴포넌트로 미리보기 — 톤/레이아웃 일치 보장
    const Card = isMobile ? RecruitmentCard : PostCard;

    return (
        <Stack spacing={2}>
            {/* 안내 */}
            <Box sx={{
                p: "8px 14px",
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                borderRadius: 2, fontSize: 11, color: "text.secondary",
            }}>
                👀 실제 게시판에 표시될 모습이에요. 올리기 전에 확인해 주세요.
            </Box>

            {/* 실제 카드 그대로 미리보기 (환경별 동일 컴포넌트) */}
            <Card item={previewItem} />

            {/* 요약 체크리스트 */}
            <Box sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, p: 2 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.07em", mb: 1.25 }}>
                    등록 요약
                </Typography>
                <Stack spacing={0}>
                    {REQUIRED_ROWS.map(([label, getter, optional]) => {
                        const val = getter(form);
                        const required = !optional;
                        return (
                            <Stack key={label} direction="row" alignItems="center" gap={1.25} sx={{ py: 0.75, borderBottom: "1px solid", borderColor: alpha(theme.palette.divider, 0.5) }}>
                                <Box sx={{
                                    width: 16, height: 16, borderRadius: "50%",
                                    bgcolor: val
                                        ? alpha(theme.palette.success.main, 0.15)
                                        : required ? alpha(theme.palette.error.main, 0.15) : alpha(theme.palette.text.disabled, 0.1),
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 9, flexShrink: 0,
                                    color: val ? "success.main" : required ? "error.main" : "text.disabled",
                                    fontWeight: 800,
                                }}>
                                    {val ? "✓" : required ? "!" : "−"}
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 72 }}>{label}</Typography>
                                <Typography variant="caption" color={val ? "text.primary" : "text.disabled"} sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {val || (required ? "입력 필요" : "선택사항")}
                                </Typography>
                            </Stack>
                        );
                    })}
                </Stack>
            </Box>
        </Stack>
    );
}
