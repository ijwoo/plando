import React, { useCallback, useRef, useState } from "react";
import {
    Box, Button, CircularProgress, Divider,
    Drawer, IconButton, InputAdornment, Stack, TextField, Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseRoundedIcon  from "@mui/icons-material/CloseRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import RoomRoundedIcon   from "@mui/icons-material/RoomRounded";
import AddRoundedIcon    from "@mui/icons-material/AddRounded";
import { Z } from "../../../shared/ui/zIndex.js";

/**
 * 모바일 장소 검색 바텀시트
 * - 장소 선택 후 onPlaceSelected({ lat, lng, name, address }) 호출
 * - 할 일 추가 폼은 MapAddTodoModal(AddTodoMobile)에서 처리
 */
export default function PlaceSearchSheet({ open, onClose, onPlaceSelected }) {
    const theme = useTheme();

    const [query, setQuery]         = useState("");
    const [results, setResults]     = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const debounceRef = useRef(null);

    const search = useCallback((keyword) => {
        if (!keyword.trim() || !window.kakao?.maps?.services) { setResults([]); return; }
        setSearching(true);
        const ps = new window.kakao.maps.services.Places();
        ps.keywordSearch(keyword, (data, status) => {
            setSearching(false);
            setResults(
                status === window.kakao.maps.services.Status.OK ? data.slice(0, 8) : []
            );
        });
    }, []);

    const handleQueryChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(val), 350);
    };

    const handleSelectPlace = (place) => {
        setSelectedPlace({
            lat:     parseFloat(place.y),
            lng:     parseFloat(place.x),
            name:    place.place_name,
            address: place.road_address_name || place.address_name,
        });
    };

    const handleConfirm = () => {
        if (!selectedPlace) return;
        onClose();
        onPlaceSelected(selectedPlace);
        // 다음 오픈 시 초기화
        setQuery("");
        setResults([]);
        setSelectedPlace(null);
    };

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            sx={{ zIndex: Z.SHEET }}
            PaperProps={{
                sx: {
                    height: "88dvh",
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                },
            }}
        >
            {/* 핸들 */}
            <Box sx={{ display: "flex", justifyContent: "center", pt: 1.5, pb: 0.5, flexShrink: 0 }}>
                <Box sx={{ width: 36, height: 5, borderRadius: 999, bgcolor: "divider" }} />
            </Box>

            {/* 헤더 */}
            <Box sx={{ px: 2, py: 1.25, display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
                <Typography sx={{ flex: 1, fontSize: 16, fontWeight: 800 }}>장소 찾기</Typography>
                <IconButton size="small" onClick={onClose}>
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>
            <Divider />

            {/* 검색 인풋 */}
            <Box sx={{ px: 2, py: 1.5, flexShrink: 0 }}>
                <TextField
                    fullWidth autoFocus size="small"
                    placeholder="장소 이름으로 검색"
                    value={query}
                    onChange={handleQueryChange}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                {searching
                                    ? <CircularProgress size={16} />
                                    : <SearchRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                                }
                            </InputAdornment>
                        ),
                        endAdornment: query ? (
                            <InputAdornment position="end">
                                <IconButton size="small" onClick={() => { setQuery(""); setResults([]); setSelectedPlace(null); }}>
                                    <CloseRoundedIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                            </InputAdornment>
                        ) : null,
                    }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                />
            </Box>
            <Divider />

            {/* 선택된 장소 미리보기 */}
            {selectedPlace && (
                <Box sx={{ mx: 2, mt: 1.5, mb: 0.5, p: "10px 12px", borderRadius: 2, bgcolor: "var(--plando-primary-soft)", border: "1px solid var(--plando-primary)", flexShrink: 0 }}>
                    <Stack direction="row" alignItems="center" gap={1}>
                        <RoomRoundedIcon sx={{ fontSize: 15, color: "var(--plando-primary)", flexShrink: 0 }} />
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "var(--plando-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {selectedPlace.name}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: "var(--plando-primary)", opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {selectedPlace.address}
                            </Typography>
                        </Box>
                    </Stack>
                </Box>
            )}

            {/* 결과 목록 */}
            <Box sx={{ flex: 1, overflowY: "auto" }}>
                {results.length === 0 && !searching && (
                    <Box sx={{ py: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, opacity: 0.45 }}>
                        <RoomRoundedIcon sx={{ fontSize: 40, color: "text.secondary" }} />
                        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                            {query.trim() ? "검색 결과가 없어요" : "장소 이름을 입력해주세요"}
                        </Typography>
                    </Box>
                )}
                {results.map((place) => {
                    const isSelected =
                        selectedPlace?.lat === parseFloat(place.y) &&
                        selectedPlace?.lng === parseFloat(place.x);
                    return (
                        <Box
                            key={place.id}
                            onClick={() => handleSelectPlace(place)}
                            sx={{
                                px: 2, py: "13px",
                                cursor: "pointer",
                                borderBottom: "1px solid var(--plando-border)",
                                borderLeft: `3px solid ${isSelected ? "var(--plando-primary)" : "transparent"}`,
                                bgcolor: isSelected ? "var(--plando-primary-soft)" : "transparent",
                                "&:last-child": { borderBottom: "none" },
                                "&:active": { bgcolor: alpha(theme.palette.action.hover, 0.6) },
                            }}
                        >
                            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: "3px", color: isSelected ? "var(--plando-primary)" : "var(--plando-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {place.place_name}
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: "var(--plando-text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {place.road_address_name || place.address_name}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>

            {/* CTA */}
            <Divider />
            <Box sx={{ p: "12px 16px", flexShrink: 0, pb: "max(12px, env(safe-area-inset-bottom))" }}>
                <Button
                    fullWidth variant="contained"
                    disabled={!selectedPlace}
                    startIcon={<AddRoundedIcon />}
                    onClick={handleConfirm}
                    sx={{ borderRadius: 2.5, fontWeight: 700, fontSize: 14, py: 1.5 }}
                >
                    {selectedPlace ? `"${selectedPlace.name}" 에서 할 일 추가` : "장소를 선택해주세요"}
                </Button>
            </Box>
        </Drawer>
    );
}
