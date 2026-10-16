import { useMemo, useState } from "react";
import { Box, Stack, TextField, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
    recruitmentCategoryOptions,
    recruitmentTechStackOptions,
} from "../../mock/recruitmentFormOptions";
import { getCategory } from "../../utils/recruitmentUtils";
import { FieldLabel, scrollInputIntoView } from "./createFormShared";

const MAX_STACK_NAME_LEN = 24;
const MAX_TITLE = 60;
const MAX_DESC = 1000;

export default function Step1BasicInfo({ form, setForm }) {
    const theme = useTheme();
    const [stackSearch, setStackSearch] = useState("");
    const [techFocused, setTechFocused] = useState(false);

    const trimmedSearch = stackSearch.trim();
    const searchLower = trimmedSearch.toLowerCase();
    const surfaceBg = alpha(theme.palette.text.primary, 0.05);

    const isDuplicate = useMemo(() => {
        if (!trimmedSearch) return false;
        const all = [...recruitmentTechStackOptions, ...form.stacks];
        return all.some((s) => s.toLowerCase() === searchLower);
    }, [trimmedSearch, searchLower, form.stacks]);

    const canAddCustom =
        trimmedSearch.length > 0 &&
        trimmedSearch.length <= MAX_STACK_NAME_LEN &&
        !isDuplicate;

    const toggleStack = (s) => {
        setForm((f) => ({
            ...f,
            stacks: f.stacks.includes(s) ? f.stacks.filter((x) => x !== s) : [...f.stacks, s],
        }));
    };
    const addStack = (s) => {
        if (!s || form.stacks.includes(s)) return;
        setForm((f) => ({ ...f, stacks: [...f.stacks, s] }));
        setStackSearch("");
    };
    const removeStack = (s) => {
        setForm((f) => ({ ...f, stacks: f.stacks.filter((x) => x !== s) }));
    };

    const handleSearchKeyDown = (e) => {
        if (e.key === "Enter") {
            // IME 조합 중 Enter 무시 — 한글 스택명 조합 확정 Enter가 바로 추가되는 문제 방지
            if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            const exactMatch = recruitmentTechStackOptions.find(
                (s) => s.toLowerCase() === searchLower && !form.stacks.includes(s)
            );
            if (exactMatch) {
                toggleStack(exactMatch);
                setStackSearch("");
            } else if (canAddCustom) {
                addStack(trimmedSearch);
            }
        } else if (e.key === "Backspace" && !stackSearch && form.stacks.length) {
            setForm((f) => ({ ...f, stacks: f.stacks.slice(0, -1) }));
        }
    };

    // 추천 칩: 검색 필터링 + 이미 선택된 것은 제외
    const suggestedStacks = useMemo(() => {
        return recruitmentTechStackOptions
            .filter((s) => !form.stacks.includes(s))
            .filter((s) => !trimmedSearch || s.toLowerCase().includes(searchLower))
            .slice(0, 14);
    }, [form.stacks, trimmedSearch, searchLower]);

    // 공통 input 스타일 helper
    const fillInputSx = {
        "& .MuiOutlinedInput-root": {
            bgcolor: surfaceBg,
            borderRadius: 1.375,
            fontSize: 14,
            fontWeight: 500,
            transition: "all 0.12s ease",
            "& fieldset": { border: "1.5px solid transparent" },
            "&:hover fieldset": { borderColor: alpha(theme.palette.text.primary, 0.1) },
            "&.Mui-focused": { bgcolor: "background.paper" },
            "&.Mui-focused fieldset": { borderColor: "primary.main", borderWidth: "1.5px" },
        },
        "& .MuiOutlinedInput-input": { py: 1.25, px: 1.75 },
        "& textarea.MuiOutlinedInput-input": { px: 1.75, py: 1.25 },
    };

    return (
        <Stack spacing={2.75}>
            {/* 카테고리 */}
            <Box>
                <FieldLabel required>카테고리</FieldLabel>
                <Box sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(2, 1fr)" },
                    gap: 1,
                }}>
                    {recruitmentCategoryOptions.map((cat) => {
                        const cfg = getCategory(cat, theme);
                        const isA = form.category === cat;
                        return (
                            <Box
                                key={cat}
                                onClick={() => setForm((f) => ({ ...f, category: cat }))}
                                sx={{
                                    p: 1.75,
                                    cursor: "pointer",
                                    bgcolor: isA ? alpha(theme.palette.primary.main, 0.08) : "background.paper",
                                    border: "1.5px solid",
                                    borderColor: isA ? "primary.main" : alpha(theme.palette.text.primary, 0.07),
                                    borderRadius: 1.5,
                                    transition: "all 0.15s ease",
                                    display: "flex", flexDirection: "column",
                                    alignItems: "flex-start",
                                    gap: 0.75,
                                    minHeight: 96,
                                    "&:hover": { borderColor: isA ? "primary.main" : alpha(theme.palette.text.primary, 0.18) },
                                }}
                            >
                                <Box sx={{
                                    width: 32, height: 32, borderRadius: 1.125,
                                    display: "grid", placeItems: "center",
                                    bgcolor: isA ? "background.paper" : surfaceBg,
                                    color: isA ? "primary.main" : "text.secondary",
                                    fontSize: 16,
                                    flexShrink: 0,
                                }}>
                                    {cfg.icon}
                                </Box>
                                <Typography sx={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: "text.primary",
                                    letterSpacing: "-0.015em",
                                }}>
                                    {cat}
                                </Typography>
                                <Typography sx={{
                                    fontSize: 11,
                                    color: "text.disabled",
                                    fontWeight: 500,
                                    lineHeight: 1.35,
                                }}>
                                    {cfg.desc}
                                </Typography>
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            {/* 모집글 제목 */}
            <Box>
                <FieldLabel required hint={`${form.title.length}/${MAX_TITLE}`}>
                    모집글 제목
                </FieldLabel>
                <TextField
                    fullWidth
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    onFocus={scrollInputIntoView}
                    placeholder="어떤 팀원을 찾고 있나요?"
                    inputProps={{ maxLength: MAX_TITLE }}
                    sx={fillInputSx}
                />
            </Box>

            {/* 프로젝트 소개 */}
            <Box>
                <FieldLabel required hint={`${form.desc.length}/${MAX_DESC}`}>
                    프로젝트 소개
                </FieldLabel>
                <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    value={form.desc}
                    onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
                    onFocus={scrollInputIntoView}
                    placeholder={"어떤 프로젝트인지 자세히 알려주세요.\n어떤 문제를 풀고 어떤 기술을 쓰는지 적어주세요."}
                    inputProps={{ maxLength: MAX_DESC }}
                    sx={fillInputSx}
                />
            </Box>

            {/* 기술 스택 */}
            <Box>
                <FieldLabel
                    hint={form.stacks.length > 0 ? `${form.stacks.length}개 선택됨` : null}
                >
                    기술 스택
                </FieldLabel>

                {/* tech picker — selected pills + input inline */}
                <Box sx={{
                    bgcolor: techFocused ? "background.paper" : surfaceBg,
                    border: "1.5px solid",
                    borderColor: techFocused ? "primary.main" : "transparent",
                    borderRadius: 1.5,
                    px: 1.25,
                    pt: form.stacks.length ? 1 : 0.5,
                    pb: 0.75,
                    transition: "all 0.12s ease",
                }}>
                    {form.stacks.length > 0 && (
                        <Stack direction="row" flexWrap="wrap" gap={0.625} sx={{ mb: 0.5 }}>
                            {form.stacks.map((s) => (
                                <Stack
                                    key={s}
                                    direction="row"
                                    alignItems="center"
                                    gap={0.5}
                                    sx={{
                                        height: 26,
                                        pl: 1.25,
                                        pr: 0.625,
                                        bgcolor: "primary.main",
                                        color: "common.white",
                                        borderRadius: 0.875,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        letterSpacing: "-0.005em",
                                    }}
                                >
                                    <span>{s}</span>
                                    <Box
                                        onClick={() => removeStack(s)}
                                        onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); removeStack(s); }}
                                        sx={{
                                            width: 16, height: 16, borderRadius: "50%",
                                            bgcolor: alpha("#FFFFFF", 0.22),
                                            display: "grid", placeItems: "center",
                                            cursor: "pointer",
                                            "&:hover": { bgcolor: alpha("#FFFFFF", 0.34) },
                                        }}
                                    >
                                        <CloseRoundedIcon sx={{ fontSize: 11, color: "common.white" }} />
                                    </Box>
                                </Stack>
                            ))}
                        </Stack>
                    )}
                    <Box
                        component="input"
                        value={stackSearch}
                        onChange={(e) => setStackSearch(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        onFocus={(e) => { setTechFocused(true); scrollInputIntoView(e); }}
                        onBlur={() => setTechFocused(false)}
                        placeholder={form.stacks.length ? "추가로 검색…" : "검색 또는 직접 입력 후 Enter"}
                        maxLength={MAX_STACK_NAME_LEN}
                        sx={{
                            width: "100%",
                            minHeight: 30,
                            border: 0,
                            outline: 0,
                            background: "transparent",
                            font: "inherit",
                            fontSize: 13,
                            fontWeight: 500,
                            color: "text.primary",
                            letterSpacing: "-0.005em",
                            px: 0.5,
                            "&::placeholder": { color: theme.palette.text.disabled },
                        }}
                    />
                </Box>

                {/* 추천 칩 */}
                {suggestedStacks.length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                        <Typography sx={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "text.secondary",
                            mb: 1,
                            letterSpacing: "-0.005em",
                        }}>
                            추천 스택
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={0.75}>
                            {suggestedStacks.map((s) => (
                                <Stack
                                    key={s}
                                    direction="row"
                                    alignItems="center"
                                    gap={0.5}
                                    onClick={() => addStack(s)}
                                    sx={{
                                        height: 32,
                                        px: 1.25,
                                        bgcolor: surfaceBg,
                                        borderRadius: 99,
                                        fontSize: 12.5,
                                        fontWeight: 600,
                                        color: "text.secondary",
                                        letterSpacing: "-0.005em",
                                        cursor: "pointer",
                                        transition: "all 0.12s ease",
                                        "&:hover": {
                                            bgcolor: alpha(theme.palette.primary.main, 0.12),
                                            color: "primary.main",
                                            "& .plus": { color: "primary.main" },
                                        },
                                    }}
                                >
                                    <Box component="span" className="plus" sx={{
                                        fontSize: 13, fontWeight: 700, color: "text.disabled", lineHeight: 1,
                                    }}>
                                        +
                                    </Box>
                                    <span>{s}</span>
                                </Stack>
                            ))}
                        </Stack>
                    </Box>
                )}

                {/* 검색 매치 없을 때 안내 */}
                {trimmedSearch && suggestedStacks.length === 0 && (
                    <Typography sx={{ mt: 1, fontSize: 12, color: "text.disabled", fontWeight: 500 }}>
                        {isDuplicate
                            ? "이미 추가된 스택이에요"
                            : canAddCustom
                                ? `'${trimmedSearch}' Enter로 직접 추가할 수 있어요`
                                : null}
                    </Typography>
                )}
            </Box>
        </Stack>
    );
}
