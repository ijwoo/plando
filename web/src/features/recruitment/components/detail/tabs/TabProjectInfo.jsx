import { useState } from "react";
import { Box, Chip, Collapse, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { Z } from "../../../../../shared/ui/zIndex.js";
import RecruitMapCanvas from "../../common/RecruitMapCanvas";
import { StackBadge, RoleBadge, SectionLabel } from "../../common/RecruitmentUI";
import { metaPillSx } from "../../common/recruitmentSx";
import { formatDueDateKorean } from "../../../utils/recruitmentUtils.js";

export default function TabProjectInfo({ detail, cat, kakaoReady }) {
    const theme = useTheme();
    const [progressOpen, setProgressOpen] = useState(false);
    const hasProgress = (detail.progress || []).length > 0;
    const doneCount = (detail.progress || []).filter((p) => p.done).length;

    return (
        <Stack spacing={2.5}>
            {detail.summary && (
                <Typography sx={{
                    fontSize: 13.5,
                    lineHeight: 1.7,
                    color: "text.secondary",
                    wordBreak: "keep-all",
                    whiteSpace: "pre-wrap",
                }}>
                    {detail.summary}
                </Typography>
            )}

            {/* 통계 인라인 칩 */}
            <Stack direction="row" gap={0.75} flexWrap="wrap">
                <Box sx={{
                    ...metaPillSx(theme, cat.color),
                    gap: 0.5,
                    px: 1.25,
                    py: 0.5,
                    fontSize: 11.5,
                }}>
                    <PeopleAltRoundedIcon sx={{ fontSize: 13 }} />
                    {detail.headCount}
                </Box>
                {detail.dueDate && detail.dueDate !== "-" && (
                    <Box sx={{
                        ...metaPillSx(theme),
                        gap: 0.5,
                        px: 1.25,
                        py: 0.5,
                        fontSize: 11.5,
                    }}>
                        <AccessTimeRoundedIcon sx={{ fontSize: 13 }} />
                        마감 {formatDueDateKorean(detail.dueDate)}
                    </Box>
                )}
                {detail.applicants > 0 && (
                    <Box sx={{
                        ...metaPillSx(theme),
                        gap: 0.5,
                        px: 1.25,
                        py: 0.5,
                        fontSize: 11.5,
                    }}>
                        <PersonRoundedIcon sx={{ fontSize: 13 }} />
                        지원 {detail.applicants}명
                    </Box>
                )}
                {detail.views > 0 && (
                    <Box sx={{
                        ...metaPillSx(theme),
                        gap: 0.5,
                        px: 1.25,
                        py: 0.5,
                        fontSize: 11.5,
                    }}>
                        <VisibilityRoundedIcon sx={{ fontSize: 13 }} />
                        조회 {detail.views}
                    </Box>
                )}
            </Stack>

            {/* 기술 스택 */}
            {detail.techStacks.length > 0 && (
                <Box>
                    <SectionLabel>기술 스택</SectionLabel>
                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                        {detail.techStacks.map((s) => <StackBadge key={s} name={s} />)}
                    </Stack>
                </Box>
            )}

            {/* 모집 역할 */}
            {detail.roles.length > 0 && (
                <Box>
                    <SectionLabel>모집 역할</SectionLabel>
                    <Stack spacing={0.75}>
                        {detail.roles.map((r) => (
                            <RoleBadge
                                key={r.id}
                                name={r.name}
                                count={r.count}
                                acceptedCount={r.acceptedCount}
                                status={r.status}
                                description={r.description}
                            />
                        ))}
                    </Stack>
                </Box>
            )}

            {/* 지원자에게 바라는 점 */}
            {detail.requirements && (
                <Box>
                    <SectionLabel>지원자에게 바라는 점</SectionLabel>
                    <Typography sx={{
                        fontSize: 13.5,
                        lineHeight: 1.7,
                        color: "text.secondary",
                        wordBreak: "keep-all",
                        whiteSpace: "pre-wrap",
                    }}>
                        {detail.requirements}
                    </Typography>
                </Box>
            )}

            {/* 진행 방식 태그 */}
            {detail.processTags && detail.processTags.length > 0 && (
                <Box>
                    <SectionLabel>진행 방식</SectionLabel>
                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                        {detail.processTags.map((tag) => (
                            <Box key={tag} sx={metaPillSx(theme)}>
                                {tag}
                            </Box>
                        ))}
                    </Stack>
                </Box>
            )}

            {/* 활동 위치 */}
            <Box>
                <SectionLabel>활동 위치</SectionLabel>
                {detail.hasLocation && detail.locationLat ? (
                    <Box>
                        <Stack direction="row" alignItems="center" gap={0.5} mb={1.25}>
                            <PlaceRoundedIcon sx={{ fontSize: 14, color: cat.color }} />
                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: cat.color }}>
                                {detail.locationText}
                            </Typography>
                        </Stack>
                        <Box sx={{
                            position: "relative",
                            height: 200,
                            borderRadius: 1.75,
                            overflow: "hidden",
                            border: "1px solid",
                            borderColor: "divider",
                        }}>
                            <RecruitMapCanvas
                                items={[detail]}
                                selected={detail}
                                onSelect={() => {}}
                                kakaoReady={kakaoReady}
                                level={6}
                                staticMap
                            />
                            <Chip
                                icon={<MapRoundedIcon sx={{ fontSize: 15 }} />}
                                label="카카오맵에서 열기"
                                size="small"
                                onClick={() => {
                                    const url = `https://map.kakao.com/link/map/${encodeURIComponent(detail.locationText)},${detail.locationLat},${detail.locationLng}`;
                                    window.open(url, "_blank");
                                }}
                                sx={{
                                    position: "absolute",
                                    right: 8,
                                    bottom: 8,
                                    zIndex: Z.STICKY,
                                    height: 28,
                                    borderRadius: 99,
                                    bgcolor: alpha("#0A0A0F", 0.85),
                                    color: "common.white",
                                    border: "0",
                                    cursor: "pointer",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    "& .MuiChip-icon": { color: "primary.light" },
                                    "&:hover": { bgcolor: alpha("#0A0A0F", 0.95) },
                                }}
                            />
                        </Box>
                    </Box>
                ) : (
                    <Stack
                        direction="row"
                        alignItems="center"
                        gap={1.5}
                        sx={{
                            p: 1.75,
                            bgcolor: alpha(theme.palette.success.main, 0.06),
                            border: "1px solid",
                            borderColor: alpha(theme.palette.success.main, 0.18),
                            borderRadius: 2,
                        }}
                    >
                        <PublicRoundedIcon sx={{ color: "success.main", fontSize: 20 }} />
                        <Box>
                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: "success.main" }}>
                                온라인 진행
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
                                {detail.locationText}
                            </Typography>
                        </Box>
                    </Stack>
                )}
            </Box>

            {/* 진행 현황 (접기/펼치기) */}
            {hasProgress && (
                <Box>
                    <Box
                        onClick={() => setProgressOpen((o) => !o)}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: "pointer",
                            py: 0.5,
                        }}
                    >
                        <SectionLabel>
                            진행 현황 ({doneCount}/{(detail.progress || []).length} 완료)
                        </SectionLabel>
                        <ExpandMoreRoundedIcon sx={{
                            fontSize: 18,
                            color: "text.disabled",
                            transform: progressOpen ? "rotate(180deg)" : "none",
                            transition: "transform 0.2s",
                        }} />
                    </Box>
                    <Collapse in={progressOpen}>
                        <Stack spacing={0.75} mt={0.5}>
                            {(detail.progress || []).map((step) => (
                                <Stack
                                    key={step.id}
                                    direction="row"
                                    alignItems="center"
                                    gap={1.25}
                                    sx={{
                                        p: 1.5,
                                        bgcolor: "background.default",
                                        border: "1px solid",
                                        borderColor: step.done
                                            ? alpha(theme.palette.success.main, 0.25)
                                            : "divider",
                                        borderRadius: 1.5,
                                    }}
                                >
                                    {step.done
                                        ? <CheckCircleRoundedIcon sx={{ color: "success.main", fontSize: 18, flexShrink: 0 }} />
                                        : <RadioButtonUncheckedRoundedIcon sx={{ color: "text.disabled", fontSize: 18, flexShrink: 0 }} />
                                    }
                                    <Typography sx={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        flex: 1,
                                        textDecoration: step.done ? "line-through" : "none",
                                        color: step.done ? "text.secondary" : "text.primary",
                                    }}>
                                        {step.label}
                                    </Typography>
                                </Stack>
                            ))}
                        </Stack>
                    </Collapse>
                </Box>
            )}
        </Stack>
    );
}
