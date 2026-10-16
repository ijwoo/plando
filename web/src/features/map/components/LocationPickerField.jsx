import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Box,
    CircularProgress,
    IconButton,
    InputAdornment,
    List,
    ListItemButton,
    ListItemText,
    Paper,
    Popper,
    TextField,
    Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useKakaoLoader } from "react-kakao-maps-sdk";
import { Z } from "../../../shared/ui/zIndex.js";

/**
 * @param inputSx 입력칸 스타일 덮어쓰기(선택). 이 컴포넌트를 여러 화면이 공유하는데
 *   화면마다 입력칸 톤이 다르다. 전역으로 바꾸면 다른 화면이 흔들리므로 필요한 쪽에서만 넘긴다.
 */
export default function LocationPickerField({ value, onChange, inputSx }) {
    useKakaoLoader({
        appkey: import.meta.env.VITE_KAKAO_MAP_KEY,
        libraries: ["services"],
    });
    const [keyword, setKeyword] = useState(value?.locationName ?? "");
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const timerRef = useRef(null);
    const anchorRef = useRef(null);

    useEffect(() => {
        if (value?.locationName) setKeyword(value.locationName);
        else if (!value) setKeyword("");
    }, [value?.locationName]);

    const search = useCallback((kw) => {
        if (!kw.trim()) { setResults([]); return; }
        if (!window.kakao?.maps?.services) return;
        setSearching(true);
        const ps = new window.kakao.maps.services.Places();
        ps.keywordSearch(kw, (data, status) => {
            setSearching(false);
            if (status === window.kakao.maps.services.Status.OK) {
                setResults(data.slice(0, 5));
            } else {
                setResults([]);
            }
        });
    }, []);

    const handleKeywordChange = (e) => {
        const kw = e.target.value;
        setKeyword(kw);
        if (value) onChange(null);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => search(kw), 350);
    };

    const handleSelect = (place) => {
        onChange({
            locationLat: parseFloat(place.y),
            locationLng: parseFloat(place.x),
            locationAddress: place.road_address_name || place.address_name || "",
            locationName: place.place_name,
        });
        setKeyword(place.place_name);
        setResults([]);
    };

    const handleClear = () => {
        onChange(null);
        setKeyword("");
        setResults([]);
    };

    return (
        <Box>
            <TextField
                ref={anchorRef}
                fullWidth
                size="small"
                sx={inputSx}
                placeholder="장소 검색"
                value={keyword}
                onChange={handleKeywordChange}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            {searching
                                ? <CircularProgress size={16} />
                                : <SearchRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />}
                        </InputAdornment>
                    ),
                    endAdornment: keyword ? (
                        <InputAdornment position="end">
                            <IconButton size="small" onClick={handleClear} edge="end">
                                <CloseRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </InputAdornment>
                    ) : null,
                }}
            />

            {/* Portal로 body에 렌더링 — 부모 stacking context 영향 없음 */}
            <Popper
                open={results.length > 0 && !value}
                anchorEl={anchorRef.current}
                placement="bottom-start"
                style={{ zIndex: Z.MODAL_NESTED, width: anchorRef.current?.offsetWidth }}
            >
                <Paper
                    elevation={8}
                    sx={{ mt: 0.5, borderRadius: 2, overflow: "hidden" }}
                >
                    <List dense disablePadding>
                        {results.map((place) => (
                            <ListItemButton key={place.id} onClick={() => handleSelect(place)} sx={{ py: 1 }}>
                                <PlaceRoundedIcon sx={{ fontSize: 16, mr: 1, color: "primary.main", flexShrink: 0 }} />
                                <ListItemText
                                    primary={place.place_name}
                                    secondary={place.road_address_name || place.address_name}
                                    primaryTypographyProps={{ variant: "body2", fontWeight: 700 }}
                                    secondaryTypographyProps={{ variant: "caption" }}
                                />
                            </ListItemButton>
                        ))}
                    </List>
                </Paper>
            </Popper>

            {value && (
                <Box sx={{ mt: 1, display: "flex", alignItems: "flex-start", gap: 0.75, px: 0.5 }}>
                    <PlaceRoundedIcon sx={{ fontSize: 16, color: "primary.main", mt: 0.25, flexShrink: 0 }} />
                    <Box>
                        <Typography variant="caption" fontWeight={700} color="primary.main">
                            {value.locationName}
                        </Typography>
                        {value.locationAddress && (
                            <Typography variant="caption" color="text.secondary" display="block">
                                {value.locationAddress}
                            </Typography>
                        )}
                    </Box>
                </Box>
            )}
        </Box>
    );
}
