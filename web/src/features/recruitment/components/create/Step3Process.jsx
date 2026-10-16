import { Box, Stack, TextField, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import {
    recruitmentDurationOptions,
    recruitmentFrequencyOptions,
    recruitmentToolOptions,
} from "../../mock/recruitmentFormOptions";
import { MEET_TYPE_LIST } from "../../constants/recruitmentConfig";
import LocationPickerField from "../../../map/components/LocationPickerField";
import { FieldLabel, scrollInputIntoView } from "./createFormShared";

const MODE_META = {
    online:  { Icon: LanguageRoundedIcon, sub: "원격으로 진행" },
    offline: { Icon: PlaceRoundedIcon,    sub: "직접 만나서 진행" },
    hybrid:  { Icon: BoltRoundedIcon,     sub: "두 방식 모두 활용" },
};

const MAX_REQ = 300;

export default function Step3Process({ form, setForm, kakaoReady }) {
    const theme = useTheme();
    const surfaceBg = alpha(theme.palette.text.primary, 0.05);

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

    // 옵션 칩 — 진행 주기 / 기간 / 마감
    const optionChipSx = (isA) => ({
        height: 36,
        px: 1.75,
        borderRadius: 1.25,
        bgcolor: isA ? alpha(theme.palette.primary.main, 0.12) : surfaceBg,
        border: "1.5px solid",
        borderColor: isA ? "primary.main" : "transparent",
        fontSize: 12.5,
        fontWeight: 600,
        color: isA ? "primary.main" : "text.secondary",
        letterSpacing: "-0.005em",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        transition: "all 0.12s ease",
        "&:hover": {
            bgcolor: isA
                ? alpha(theme.palette.primary.main, 0.16)
                : alpha(theme.palette.text.primary, 0.08),
            color: isA ? "primary.main" : "text.primary",
        },
    });

    return (
        <Stack spacing={2.75}>
            {/* 진행 방식 — mode cards */}
            <Box>
                <FieldLabel required>진행 방식</FieldLabel>
                <Box sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                    gap: 1,
                }}>
                    {MEET_TYPE_LIST.map((opt) => {
                        const meta = MODE_META[opt.id] || { Icon: LanguageRoundedIcon, sub: "" };
                        const Icon = meta.Icon;
                        const isA = form.meetType === opt.id;
                        // cfg는 짧은 label("온라인")인데 폼 카드는 longLabel("온라인 전용") 사용
                        const cardLabel = opt.longLabel || opt.label;
                        return (
                            <Box
                                key={opt.id}
                                onClick={() => setForm((f) => ({
                                    ...f,
                                    meetType: opt.id,
                                    location: opt.id === "online" ? null : f.location,
                                    locationLat: opt.id === "online" ? null : f.locationLat,
                                    locationLng: opt.id === "online" ? null : f.locationLng,
                                }))}
                                sx={{
                                    p: { xs: "12px 14px", sm: "14px 12px" },
                                    cursor: "pointer",
                                    bgcolor: isA ? alpha(theme.palette.primary.main, 0.08) : "background.paper",
                                    border: "1.5px solid",
                                    borderColor: isA ? "primary.main" : alpha(theme.palette.text.primary, 0.07),
                                    borderRadius: 1.5,
                                    transition: "all 0.15s ease",
                                    display: "flex",
                                    flexDirection: { xs: "row", sm: "column" },
                                    alignItems: { xs: "center", sm: "flex-start" },
                                    gap: { xs: 1.5, sm: 0.625 },
                                    "&:hover": { borderColor: isA ? "primary.main" : alpha(theme.palette.text.primary, 0.18) },
                                }}
                            >
                                <Box sx={{
                                    width: 28, height: 28, borderRadius: 1,
                                    bgcolor: isA ? "background.paper" : surfaceBg,
                                    color: isA ? "primary.main" : "text.secondary",
                                    display: "grid", placeItems: "center",
                                    flexShrink: 0,
                                }}>
                                    <Icon sx={{ fontSize: 16 }} />
                                </Box>
                                <Box sx={{ flex: { xs: 1, sm: "0 0 auto" }, minWidth: 0 }}>
                                    <Typography sx={{
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        color: "text.primary",
                                        letterSpacing: "-0.015em",
                                    }}>
                                        {cardLabel}
                                    </Typography>
                                    {meta.sub && (
                                        <Typography sx={{
                                            fontSize: 10.5,
                                            color: "text.disabled",
                                            fontWeight: 500,
                                            mt: 0.25,
                                        }}>
                                            {meta.sub}
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            {/* 위치 (오프라인/혼합) */}
            {(form.meetType === "offline" || form.meetType === "hybrid") && (
                <Box>
                    <FieldLabel required>주요 활동 지역</FieldLabel>
                    {kakaoReady ? (
                        <LocationPickerField
                            value={form.location}
                            onChange={(loc) => setForm((f) => ({
                                ...f,
                                location: loc,
                                locationLat: loc?.locationLat ?? null,
                                locationLng: loc?.locationLng ?? null,
                            }))}
                        />
                    ) : (
                        <TextField fullWidth disabled placeholder="지도 서비스 로딩 중..." sx={fillInputSx} />
                    )}
                    {!form.location && (
                        <Typography sx={{ fontSize: 11.5, color: "text.disabled", fontWeight: 500, mt: 0.875 }}>
                            장소를 검색하면 지도에서 위치가 표시돼요.
                        </Typography>
                    )}
                </Box>
            )}

            {/* 미팅 빈도 + 예상 기간 — two col */}
            <Box sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1.75,
            }}>
                <Box>
                    <FieldLabel required>미팅 빈도</FieldLabel>
                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                        {recruitmentFrequencyOptions.map((opt) => (
                            <Box
                                key={opt}
                                onClick={() => setForm((f) => ({ ...f, frequency: opt }))}
                                sx={optionChipSx(form.frequency === opt)}
                            >
                                {opt}
                            </Box>
                        ))}
                    </Stack>
                </Box>
                <Box>
                    <FieldLabel required>예상 기간</FieldLabel>
                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                        {recruitmentDurationOptions.map((opt) => (
                            <Box
                                key={opt}
                                onClick={() => setForm((f) => ({ ...f, duration: opt }))}
                                sx={optionChipSx(form.duration === opt)}
                            >
                                {opt}
                            </Box>
                        ))}
                    </Stack>
                </Box>
            </Box>

            {/* 마감일 + 커뮤니케이션 툴 */}
            <Box sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1.75,
            }}>
                <Box>
                    <FieldLabel required>모집 마감일</FieldLabel>
                    <TextField
                        fullWidth
                        type="date"
                        value={form.deadline}
                        onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                        InputLabelProps={{ shrink: true }}
                        sx={fillInputSx}
                    />
                </Box>
                <Box>
                    <FieldLabel>커뮤니케이션 툴</FieldLabel>
                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                        {recruitmentToolOptions.map((tool) => {
                            const isA = form.tools.includes(tool);
                            return (
                                <Box
                                    key={tool}
                                    onClick={() => setForm((f) => ({
                                        ...f,
                                        tools: isA ? f.tools.filter((t) => t !== tool) : [...f.tools, tool],
                                    }))}
                                    sx={optionChipSx(isA)}
                                >
                                    {tool}
                                </Box>
                            );
                        })}
                    </Stack>
                </Box>
            </Box>

            {/* 지원자에게 바라는 점 */}
            <Box>
                <FieldLabel hint={`${form.requirements.length}/${MAX_REQ}`}>
                    지원자에게 바라는 점
                </FieldLabel>
                <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    value={form.requirements}
                    onChange={(e) => setForm((f) => ({ ...f, requirements: e.target.value }))}
                    onFocus={scrollInputIntoView}
                    placeholder="예: 매주 목요일 저녁 미팅 가능하신 분, 포트폴리오 있으신 분 우대, 초보자도 환영…"
                    inputProps={{ maxLength: MAX_REQ }}
                    sx={fillInputSx}
                />
            </Box>
        </Stack>
    );
}
