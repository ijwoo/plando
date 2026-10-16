import { Box, IconButton, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded";
import BookmarkRoundedIcon from "@mui/icons-material/BookmarkRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { StackBadge, LeaderAvatar, AppliedStatusBadge, ModeBadge } from "../common/RecruitmentUI";
import {
    cardSx,
    categoryBadgeSx,
    metaPillSx,
    bookmarkBtnSx,
    SHADOW,
} from "../common/recruitmentSx";
import {
    getCategory,
    getMemberText,
    getDueText,
    getLocationText,
} from "../../utils/recruitmentUtils";
import { normalizeMeetType } from "../../constants/recruitmentConfig";

// ── sub-components ───────────────────────────────────────────
function MetaChip({ icon, label, value, highlight }) {
    return (
        <Stack direction="row" alignItems="center" gap="4px">
            {icon}
            <Typography sx={{
                fontSize: 11,
                color: highlight ? "error.main" : "text.disabled",
                fontWeight: 600,
            }}>
                {label}
            </Typography>
            <Typography sx={{
                fontSize: 11,
                fontWeight: 700,
                color: highlight ? "error.main" : "text.primary",
                letterSpacing: "-0.01em",
            }}>
                {value}
            </Typography>
        </Stack>
    );
}

// ── PostCard (list grid card) ─────────────────────────────────
export default function PostCard({ item, onDetail, onBookmark, compact = false }) {
    const theme = useTheme();
    const cat = getCategory(item.typeLabel, theme);

    const memberText = getMemberText(item);
    const dueText = getDueText(item);
    const isUrgent = String(dueText).match(/D-[0-3](?!\d)/);

    const locationText = getLocationText(item);

    const stackTags = item.tags || item.techStacks || [];
    const roles = item.roles || [];
    const meetType = normalizeMeetType(item.meetType);

    return (
        <Box
            onClick={() => onDetail?.(item)}
            sx={{
                // onDetail이 없는 미리보기에서는 포인터·hover lift를 주지 않는다(눌러도 열리지 않으므로)
                ...cardSx(theme, { lift: !!onDetail, clickable: !!onDetail }),
                borderRadius: 1.75,
            }}
        >
            <Box sx={{ px: 2, pt: 1.75, pb: 1.625 }}>

                {/* 배지 row + bookmark */}
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mb: 1 }}
                >
                    <Stack direction="row" alignItems="center" gap={0.625} flexWrap="wrap">
                        {/* 카테고리 배지 */}
                        <Box sx={categoryBadgeSx(theme, cat.color, { size: "sm" })}>
                            <span>{cat.icon}</span>
                            <span>{item.typeLabel}</span>
                        </Box>

                        {/* 온라인은 뱃지 생략(기본값이라 노이즈). 레거시 대문자 값도 정규화해서 판단한다 */}
                        {meetType && meetType !== "online" && (
                            <ModeBadge meetType={meetType} />
                        )}

                        <AppliedStatusBadge status={item.appliedStatus} />

                        {item.unansweredCount > 0 && (
                            <Box sx={metaPillSx(theme, theme.palette.warning.main)}>
                                미답변 Q&A {item.unansweredCount}
                            </Box>
                        )}
                    </Stack>

                    {/* 핸들러가 없는 곳(작성 미리보기)에서는 눌러도 아무 일이 없다 —
                        무동작 버튼 대신 비활성으로 보여주고 이유를 툴팁으로 알린다 */}
                    <IconButton
                        size="small"
                        disabled={!onBookmark}
                        title={onBookmark ? "북마크" : "미리보기에서는 북마크할 수 없어요"}
                        onClick={(e) => { e.stopPropagation(); onBookmark?.(item.id ?? item); }}
                        sx={bookmarkBtnSx(theme, item.bookmarked)}
                    >
                        {item.bookmarked
                            ? <BookmarkRoundedIcon sx={{ fontSize: 17 }} />
                            : <BookmarkBorderRoundedIcon sx={{ fontSize: 17 }} />}
                    </IconButton>
                </Stack>

                {/* 제목 */}
                <Typography sx={{
                    fontSize: 15,
                    fontWeight: 800,
                    lineHeight: 1.35,
                    letterSpacing: "-0.025em",
                    color: "text.primary",
                    mb: 0.5,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    minHeight: 40,
                }}>
                    {item.title}
                </Typography>

                {/* summary */}
                <Typography sx={{
                    fontSize: 13,
                    lineHeight: 1.65,
                    color: "text.secondary",
                    mb: 1,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                }}>
                    {item.summary}
                </Typography>

                {/* stack tags */}
                {stackTags.length > 0 && (
                    <Stack direction="row" flexWrap="wrap" gap={0.625} sx={{ mb: 0.875 }}>
                        {stackTags.slice(0, 5).map((t) => <StackBadge key={t} name={t} />)}
                        {stackTags.length > 5 && (
                            <Typography sx={{
                                fontSize: 10,
                                color: "text.disabled",
                                fontWeight: 600,
                                alignSelf: "center",
                            }}>
                                +{stackTags.length - 5}
                            </Typography>
                        )}
                    </Stack>
                )}

                {/* role pills */}
                {roles.length > 0 && (
                    <Stack direction="row" flexWrap="wrap" gap={0.625} sx={{ mb: 1.125 }}>
                        {roles.slice(0, 4).map((role, idx) => {
                            const roleName = typeof role === "string" ? role : role?.name || "-";
                            return (
                                <Box key={role?.id ?? roleName ?? idx} sx={metaPillSx(theme, cat.color)}>
                                    {roleName}
                                </Box>
                            );
                        })}
                        {roles.length > 4 && (
                            <Typography sx={{
                                fontSize: 10,
                                color: "text.disabled",
                                fontWeight: 600,
                                alignSelf: "center",
                            }}>
                                +{roles.length - 4}
                            </Typography>
                        )}
                    </Stack>
                )}

                {/* divider */}
                <Box sx={{
                    height: "1px",
                    bgcolor: alpha(theme.palette.text.primary, 0.06),
                    mb: 1.125,
                }} />

                {/* meta row */}
                <Stack
                    direction="row"
                    alignItems="center"
                    gap={1}
                    sx={{ overflow: "hidden", flexWrap: "nowrap" }}
                >
                    <MetaChip
                        icon={<PeopleAltRoundedIcon sx={{ fontSize: 11, color: "text.disabled" }} />}
                        label="인원"
                        value={memberText}
                    />
                    <Typography sx={{
                        fontSize: 11, color: "text.disabled", flexShrink: 0, lineHeight: 1,
                    }}>·</Typography>
                    <MetaChip
                        icon={
                            <AccessTimeRoundedIcon sx={{
                                fontSize: 11,
                                color: isUrgent ? "error.main" : "text.disabled",
                            }} />
                        }
                        label="마감"
                        value={dueText}
                        highlight={!!isUrgent}
                    />
                    {!compact && item.hasLocation && (<>
                        <Typography sx={{
                            fontSize: 11, color: "text.disabled", flexShrink: 0, lineHeight: 1,
                        }}>·</Typography>
                        <Stack
                            direction="row"
                            alignItems="center"
                            gap="3px"
                            sx={{ flexShrink: 0, maxWidth: 80, overflow: "hidden" }}
                        >
                            <PlaceRoundedIcon sx={{ fontSize: 11, color: cat.color, flexShrink: 0 }} />
                            <Typography sx={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: cat.color,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}>
                                {locationText.length > 5 ? locationText.slice(0, 5) + "…" : locationText}
                            </Typography>
                        </Stack>
                    </>)}
                    <Box sx={{ flex: 1 }} />
                    <Stack
                        direction="row"
                        alignItems="center"
                        gap={0.625}
                        sx={{ flexShrink: 0 }}
                    >
                        <LeaderAvatar name={item.author} size={18} />
                        <Typography sx={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "text.secondary",
                            maxWidth: 60,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}>
                            {item.author}
                        </Typography>
                    </Stack>
                </Stack>
            </Box>
        </Box>
    );
}

// ── MapOverlayCardDesktop (map pin popup card) ────────────────
export function MapOverlayCardDesktop({ item, onDetail, onClose }) {
    const theme = useTheme();
    const cat = getCategory(item.typeLabel, theme);

    const memberText = getMemberText(item);
    const dueText = getDueText(item);

    return (
        <Box sx={{
            position: "absolute", bottom: 20, right: 20,
            pointerEvents: "auto",
            bgcolor: "background.paper",
            border: 0,
            borderRadius: 1.75,
            overflow: "hidden",
            minWidth: 260, maxWidth: 320,
            boxShadow: SHADOW.lift,
        }}>
            <Box sx={{ p: "14px 16px 15px" }}>
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    sx={{ mb: 1 }}
                >
                    <Stack gap={0.625} sx={{ flex: 1, pr: 1 }}>
                        <Box sx={{
                            ...categoryBadgeSx(theme, cat.color, { size: "sm" }),
                            width: "fit-content",
                        }}>
                            <span>{cat.icon}</span>
                            <span>{item.typeLabel}</span>
                        </Box>
                        <Typography sx={{
                            fontSize: 14,
                            fontWeight: 800,
                            letterSpacing: "-0.02em",
                            lineHeight: 1.35,
                            color: "text.primary",
                        }}>
                            {item.title}
                        </Typography>
                    </Stack>
                    <IconButton
                        size="small"
                        onClick={onClose}
                        sx={{
                            mt: -0.5, mr: -0.5,
                            color: "text.disabled",
                            borderRadius: 1,
                            "&:hover": { color: "text.primary" },
                        }}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                </Stack>

                {(item.tags || item.techStacks || []).length > 0 && (
                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 1.25 }}>
                        {(item.tags || item.techStacks || []).slice(0, 3).map((t) => (
                            <StackBadge key={t} name={t} />
                        ))}
                    </Stack>
                )}

                <Box sx={{
                    p: "10px 12px",
                    borderRadius: 1.25,
                    bgcolor: alpha(theme.palette.text.primary, 0.03),
                    mb: 1.5,
                }}>
                    <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.5 }}>
                        {memberText} · {dueText}
                    </Typography>
                </Box>

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                        {getLocationText(item)}
                    </Typography>
                    <Box
                        component="button"
                        onClick={() => onDetail?.(item)}
                        sx={{
                            px: 1.75,
                            py: 0.875,
                            borderRadius: 1,
                            bgcolor: "primary.main",
                            color: "primary.contrastText",
                            fontSize: 12,
                            fontWeight: 700,
                            border: 0,
                            cursor: "pointer",
                            boxShadow: SHADOW.card,
                            "&:hover": { bgcolor: "primary.dark" },
                        }}
                    >
                        상세 보기
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}
