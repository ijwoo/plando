import { useRef } from "react";
import { Box, Stack, TextField, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import { FieldLabel, scrollInputIntoView } from "./createFormShared";

const MAX_NAME = 30;

export default function WsNewStep({ newWsData, setNewWsData, wsError }) {
    const theme = useTheme();
    const fileRef = useRef(null);

    const handleIconFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const preview = URL.createObjectURL(file);
        setNewWsData((d) => ({ ...d, iconFile: file, iconPreview: preview }));
    };

    const surfaceBg = alpha(theme.palette.text.primary, 0.05);

    return (
        <Stack spacing={2.75}>
            {/* 아이콘 이미지 (선택) */}
            <Box>
                <FieldLabel>아이콘 이미지 (선택)</FieldLabel>
                <Stack direction="row" alignItems="center" gap={2}>
                    <Box
                        onClick={() => fileRef.current?.click()}
                        sx={{
                            width: 72, height: 72,
                            borderRadius: 1.75,
                            flexShrink: 0,
                            border: "1.5px dashed",
                            borderColor: newWsData.iconPreview
                                ? alpha(theme.palette.primary.main, 0.4)
                                : alpha(theme.palette.text.primary, 0.15),
                            bgcolor: newWsData.iconPreview ? "transparent" : surfaceBg,
                            cursor: "pointer",
                            display: "grid", placeItems: "center",
                            overflow: "hidden",
                            transition: "all 0.15s ease",
                            "&:hover": {
                                borderColor: alpha(theme.palette.primary.main, 0.5),
                                bgcolor: alpha(theme.palette.primary.main, 0.04),
                            },
                        }}
                    >
                        {newWsData.iconPreview ? (
                            <Box component="img"
                                src={newWsData.iconPreview}
                                sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                        ) : (
                            <Stack alignItems="center" gap={0.5}>
                                <AddPhotoAlternateRoundedIcon sx={{ fontSize: 22, color: "text.disabled" }} />
                                <Typography sx={{ fontSize: 9.5, color: "text.disabled", fontWeight: 600 }}>
                                    이미지 추가
                                </Typography>
                            </Stack>
                        )}
                    </Box>
                    <Stack spacing={0.5}>
                        <Typography sx={{ fontSize: 12.5, color: "text.secondary", fontWeight: 500, lineHeight: 1.5 }}>
                            워크스페이스를 대표하는 이미지예요
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: "text.disabled", fontWeight: 500 }}>
                            JPG, PNG · 최대 5MB
                        </Typography>
                        {newWsData.iconPreview && (
                            <Box
                                component="span"
                                onClick={() => setNewWsData((d) => ({ ...d, iconFile: null, iconPreview: null }))}
                                sx={{
                                    fontSize: 11.5,
                                    color: "error.main",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                    width: "fit-content",
                                    "&:hover": { textDecoration: "underline" },
                                }}
                            >
                                제거
                            </Box>
                        )}
                    </Stack>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleIconFile}
                    />
                </Stack>
            </Box>

            {/* 워크스페이스 이름 */}
            <Box>
                <FieldLabel
                    required
                    hint={`${newWsData.workspaceName.length}/${MAX_NAME}`}
                >
                    워크스페이스 이름
                </FieldLabel>
                <TextField
                    fullWidth
                    value={newWsData.workspaceName}
                    onChange={(e) => setNewWsData((d) => ({ ...d, workspaceName: e.target.value }))}
                    onFocus={scrollInputIntoView}
                    placeholder="예: 알고리즘 스터디"
                    inputProps={{ maxLength: MAX_NAME }}
                    sx={{
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
                        "& .MuiOutlinedInput-input": { py: 1.25, px: 1.75, height: "auto" },
                    }}
                />
            </Box>

            {wsError && (
                <Stack
                    direction="row"
                    alignItems="center"
                    gap={0.875}
                    sx={{
                        p: "10px 14px",
                        bgcolor: alpha(theme.palette.error.main, 0.08),
                        border: "1px solid",
                        borderColor: alpha(theme.palette.error.main, 0.25),
                        borderRadius: 1.5,
                    }}
                >
                    <WarningAmberRoundedIcon sx={{ fontSize: 16, color: "error.main" }} />
                    <Typography sx={{ fontSize: 12.5, color: "error.main", fontWeight: 600 }}>
                        {wsError}
                    </Typography>
                </Stack>
            )}
        </Stack>
    );
}
