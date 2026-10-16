import { Box, IconButton, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded";
import BookmarkRoundedIcon from "@mui/icons-material/BookmarkRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import { getCategory } from "../../utils/recruitmentUtils";
import { LeaderAvatar, AppliedStatusBadge, StackBadge, TypeBadge, ModeBadge } from "../common/RecruitmentUI";
import {
    cardSx,
    metaPillSx,
    bookmarkBtnSx,
    SHADOW,
} from "../common/recruitmentSx";

// 카드 고정 높이
export const CARD_H = 178;

// featured=true  → 추천 슬라이드 카드 (shadow-pop으로 살짝 떠 있는 느낌)
// featured=false → 피드 일반 카드 (shadow-card)
export default function RecruitmentCard({ item, featured = false, onDetail, onBookmark }) {
    const theme = useTheme();
    const cat = getCategory(item.typeLabel, theme);
    const tags = item.tags || item.techStacks || [];
    const roles = item.roles || [];

    return (
        <Box
            onClick={() => onDetail?.(item)}
            sx={{
                // Toss 톤 카드 베이스 (border 0, shadow only)
                // onDetail이 없는 미리보기에서는 포인터·터치 피드백을 주지 않는다(눌러도 열리지 않으므로)
                ...cardSx(theme, { lift: false, clickable: !!onDetail }),
                // 모바일은 hover lift 대신 active scale (터치 피드백)
                transition: "transform 0.13s ease, box-shadow 0.2s ease",
                ...(onDetail ? { "&:active": { transform: "scale(0.982)" } } : {}),
                // featured: 더 떠 있는 그림자
                boxShadow: featured ? SHADOW.pop : SHADOW.card,
                // 고정 높이 / 레이아웃
                height: CARD_H,
                display: "flex",
                flexDirection: "column",
                borderRadius: 1.75,
                position: "relative",
            }}
        >
            <Box sx={{
                p: 1.75,
                display: "flex",
                flexDirection: "column",
                height: "100%",
                boxSizing: "border-box",
                position: "relative",
            }}>
                {/* 배지 행 + 북마크 */}
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    sx={{ mb: 1, flexShrink: 0 }}
                >
                    <Stack
                        direction="row"
                        gap={0.5}
                        sx={{ flexWrap: "nowrap", overflow: "hidden", flex: 1, mr: 0.5 }}
                    >
                        <TypeBadge typeLabel={item.typeLabel} cat={cat} />
                        {/* meetType이 있으면 그걸 쓰고(정규화 포함), 없을 때만 hasLocation으로 추정 */}
                        <ModeBadge item={item} />
                        {item.appliedStatus && <AppliedStatusBadge status={item.appliedStatus} />}
                        {item.unansweredCount > 0 && (
                            <Box sx={{
                                ...metaPillSx(theme, theme.palette.warning.main),
                                fontSize: 10,
                                px: 0.875,
                                py: 0.125,
                                flexShrink: 0,
                            }}>
                                미답변 {item.unansweredCount}
                            </Box>
                        )}
                    </Stack>
                    {/* 핸들러가 없는 곳(작성 미리보기)에서는 눌러도 아무 일이 없다 —
                        무동작 버튼 대신 비활성으로 보여주고 이유를 툴팁으로 알린다 */}
                    <IconButton
                        size="small"
                        disabled={!onBookmark}
                        title={onBookmark ? "북마크" : "미리보기에서는 북마크할 수 없어요"}
                        onClick={(e) => { e.stopPropagation(); onBookmark?.(item.id); }}
                        sx={{
                            ...bookmarkBtnSx(theme, item.bookmarked),
                            mt: -0.5,
                            mr: -0.75,
                            flexShrink: 0,
                        }}
                    >
                        {item.bookmarked
                            ? <BookmarkRoundedIcon sx={{ fontSize: 17 }} />
                            : <BookmarkBorderRoundedIcon sx={{ fontSize: 17 }} />}
                    </IconButton>
                </Stack>

                {/* 제목 — 1줄 고정 */}
                <Typography sx={{
                    fontSize: featured ? 15 : 14,
                    fontWeight: 800,
                    letterSpacing: "-0.025em",
                    lineHeight: 1.3,
                    color: "text.primary",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    mb: 0.5,
                    flexShrink: 0,
                }}>
                    {item.title}
                </Typography>

                {/* 한줄소개 — 1줄 고정 */}
                <Typography sx={{
                    fontSize: 12,
                    color: "text.secondary",
                    lineHeight: 1.4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    mb: 0.875,
                    flexShrink: 0,
                }}>
                    {item.summary || " "}
                </Typography>

                {/* 스택 칩 — 1줄, 넘치면 +N */}
                {tags.length > 0 && (
                    <Stack
                        direction="row"
                        gap={0.5}
                        sx={{ flexWrap: "nowrap", overflow: "hidden", mb: 0.625, flexShrink: 0 }}
                    >
                        {tags.slice(0, 3).map((t) => <StackBadge key={t} name={t} />)}
                        {tags.length > 3 && (
                            <Box component="span" sx={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: "text.disabled",
                                alignSelf: "center",
                                flexShrink: 0,
                            }}>
                                +{tags.length - 3}
                            </Box>
                        )}
                    </Stack>
                )}

                {/* 역할 pill — 1줄, +N */}
                {roles.length > 0 && (
                    <Stack
                        direction="row"
                        gap={0.5}
                        sx={{ flexWrap: "nowrap", overflow: "hidden", mb: 0.625, flexShrink: 0 }}
                    >
                        {roles.slice(0, 2).map((r, i) => {
                            const name = typeof r === "string" ? r : r.name;
                            return (
                                <Box key={i} sx={{
                                    ...metaPillSx(theme, cat.color),
                                    fontSize: 10,
                                    px: 0.875,
                                    py: 0.25,
                                    flexShrink: 0,
                                }}>
                                    {name}
                                </Box>
                            );
                        })}
                        {roles.length > 2 && (
                            <Box component="span" sx={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: "text.disabled",
                                alignSelf: "center",
                                flexShrink: 0,
                            }}>
                                +{roles.length - 2}
                            </Box>
                        )}
                    </Stack>
                )}

                <Box sx={{ flex: 1 }} />

                {/* 하단 구분선 + 메타 */}
                <Box sx={{
                    borderTop: "1px solid",
                    borderColor: alpha(theme.palette.text.primary, 0.06),
                    pt: 0.875,
                    flexShrink: 0,
                }}>
                    <Stack
                        direction="row"
                        alignItems="center"
                        gap={0.625}
                        sx={{ flexWrap: "nowrap", overflow: "hidden" }}
                    >
                        <LeaderAvatar name={item.author} size={14} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, flexShrink: 0 }}>
                            {item.author}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>·</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                            {item.members}
                        </Typography>
                        {item.dueText && (
                            <>
                                <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>·</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                                    {item.dueText}
                                </Typography>
                            </>
                        )}
                        {item.hasLocation && item.locationText && (
                            <>
                                <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>·</Typography>
                                <PlaceRoundedIcon sx={{ fontSize: 10, color: cat.color, flexShrink: 0 }} />
                                <Typography variant="caption" sx={{
                                    color: cat.color,
                                    fontWeight: 600,
                                    flexShrink: 1,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}>
                                    {item.locationText}
                                </Typography>
                            </>
                        )}
                    </Stack>
                </Box>
            </Box>
        </Box>
    );
}
