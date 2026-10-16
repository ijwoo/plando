import { Box, InputAdornment, MenuItem, Stack, TextField } from "@mui/material";
import { hideScrollbarSx } from "../../../../../shared/ui/glassSx.js";
import { alpha, useTheme } from "@mui/material/styles";
import SortRoundedIcon from "@mui/icons-material/SortRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import {
    SHADOW,
    segContainerSx,
    segButtonSx,
} from "../../common/recruitmentSx";
import { FilterPill } from "../DesktopUI";

const VIEW_MODES = [
    { id: "list", icon: <ViewListRoundedIcon sx={{ fontSize: 16 }} /> },
    { id: "map",  icon: <MapRoundedIcon sx={{ fontSize: 16 }} /> },
];

const SORT_OPTIONS = [
    { value: "latest",   label: "최신순" },
    { value: "deadline", label: "마감임박순" },
    { value: "members",  label: "모집여유 적은순" },
];

/**
 * 둘러보기 탭의 컨트롤 바 — 필터 칩 + 정렬 + view mode 토글.
 */
export default function ListControls({
    filters,
    filter,
    onFilterChange,
    sortBy,
    onSortChange,
    viewMode,
    onViewModeChange,
}) {
    const theme = useTheme();

    return (
        <Stack
            direction={{ xs: "column", xl: "row" }}
            alignItems={{ xs: "stretch", xl: "center" }}
            gap={1.25}
            sx={{ mb: 2 }}
        >
            <Stack
                direction="row"
                gap={0.625}
                sx={{
                    flex: 1,
                    overflowX: "auto",
                    ...hideScrollbarSx,
                }}
            >
                {filters.map(({ id, label }) => (
                    <FilterPill
                        key={id}
                        label={label}
                        active={filter === id}
                        onClick={() => onFilterChange(filter === id && id !== "all" ? "all" : id)}
                    />
                ))}
            </Stack>

            <Stack direction="row" alignItems="center" gap={1}>
                <TextField
                    size="small"
                    select
                    value={sortBy}
                    onChange={(e) => onSortChange(e.target.value)}
                    sx={{
                        width: 160,
                        "& .MuiOutlinedInput-root": {
                            bgcolor: "background.paper",
                            borderRadius: 1.25,
                            fontSize: 13,
                            fontWeight: 600,
                            boxShadow: SHADOW.card,
                            "& fieldset": { border: "1px solid transparent" },
                            "&:hover fieldset": { borderColor: "transparent" },
                            "&.Mui-focused fieldset": { borderColor: "primary.main", borderWidth: "1px" },
                            "&.Mui-focused": {
                                boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.12)}, ${SHADOW.card}`,
                            },
                        },
                    }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SortRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                            </InputAdornment>
                        ),
                    }}
                >
                    {SORT_OPTIONS.map(({ value, label }) => (
                        <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                </TextField>

                <Box sx={segContainerSx()}>
                    {VIEW_MODES.map(({ id, icon }) => (
                        <Box
                            key={id}
                            onClick={() => onViewModeChange(id)}
                            sx={segButtonSx(theme, viewMode === id)}
                        >
                            {icon}
                        </Box>
                    ))}
                </Box>
            </Stack>
        </Stack>
    );
}
