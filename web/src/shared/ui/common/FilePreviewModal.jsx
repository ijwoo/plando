import React, { useMemo, useCallback } from "react";
import {
    Box,
    Dialog,
    IconButton,
    Typography,
    Button,
    Stack,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { useTheme } from "@mui/material/styles";
import { resolveImageUrl } from "../../utils/urlUtils.js";
import { formatFileSize } from "../../utils/formatters.js";
import { Z } from "../zIndex.js";

async function downloadFileBlob(fileUrl, fileName) {
    const response = await fetch(fileUrl, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("파일 다운로드 실패");
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
    }, 1000);
}

export default function FilePreviewModal({
                                             open,
                                             file,
                                             onClose,
                                             files = [],
                                             currentIndex = -1,
                                             onPrev,
                                             onNext,
                                         }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const fileUrl = useMemo(() => {
        if (!file?.fileUrl) return "";
        return resolveImageUrl(file.fileUrl);
    }, [file]);

    const isImage = file?.fileType?.startsWith("image/");
    const isPdf = file?.fileType === "application/pdf";
    const hasMultiple = files.length > 1;
    const canPrev = hasMultiple && currentIndex > 0;
    const canNext = hasMultiple && currentIndex < files.length - 1;

    const handleDownload = useCallback(async () => {
        if (!fileUrl) return;
        try {
            await downloadFileBlob(fileUrl, file?.fileName);
        } catch (e) {
            console.error(e);
            window.open(fileUrl, "_blank", "noopener,noreferrer");
        }
    }, [fileUrl, file?.fileName]);

    if (!file) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            sx={{
                zIndex: Z.MODAL_NESTED,
                "& .MuiDialog-paper": {
                    width: { xs: "92vw", sm: "88vw", md: "900px" },
                    maxWidth: "900px",
                    height: { xs: "72vh", sm: "78vh", md: "86vh" },
                    maxHeight: "86vh",
                    m: { xs: 1.5, sm: 2 },
                    borderRadius: { xs: 3, sm: 3.5 },
                    overflow: "hidden",
                },
            }}
            PaperProps={{
                sx: {
                    zIndex: Z.FILE_PREVIEW,
                    bgcolor: isDark ? "#0b1020" : "#ffffff",
                    backgroundImage: "none",
                },
            }}
        >
            <Box
                sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                }}
            >
                <Box
                    sx={{
                        px: 2,
                        py: 1.25,
                        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1.5,
                        minHeight: 64,
                    }}
                >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                            sx={{
                                fontSize: 15,
                                fontWeight: 700,
                                color: "text.primary",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {file.fileName || "파일 미리보기"}
                        </Typography>

                        <Stack direction="row" spacing={1} sx={{ mt: 0.35, flexWrap: "wrap" }}>
                            {file.fileType && (
                                <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                                    {file.fileType}
                                </Typography>
                            )}
                            {file.fileSize ? (
                                <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                                    {formatFileSize(file.fileSize)}
                                </Typography>
                            ) : null}
                            {hasMultiple && currentIndex > -1 && (
                                <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                                    {currentIndex + 1} / {files.length}
                                </Typography>
                            )}
                        </Stack>
                    </Box>

                    <Stack direction="row" spacing={0.5} alignItems="center">
                        {hasMultiple && (
                            <>
                                <IconButton onClick={onPrev} disabled={!canPrev}>
                                    <ChevronLeftRoundedIcon />
                                </IconButton>
                                <IconButton onClick={onNext} disabled={!canNext}>
                                    <ChevronRightRoundedIcon />
                                </IconButton>
                            </>
                        )}

                        <Button
                            onClick={handleDownload}
                            startIcon={<DownloadRoundedIcon />}
                            sx={{ minWidth: 0, px: 1.25 }}
                        >
                            다운로드
                        </Button>

                        <Button
                            component="a"
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            startIcon={<OpenInNewRoundedIcon />}
                            sx={{ minWidth: 0, px: 1.25, display: { xs: "none", sm: "inline-flex" } }}
                        >
                            새창 열기
                        </Button>

                        <IconButton onClick={onClose}>
                            <CloseRoundedIcon />
                        </IconButton>
                    </Stack>
                </Box>

                <Box
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        bgcolor: isImage ? "#000" : (isDark ? "#0A0A0F" : "#f8fafc"),
                        p: isImage ? 0 : 2,
                    }}
                >
                    {hasMultiple && (
                        <>
                            <IconButton
                                onClick={onPrev}
                                disabled={!canPrev}
                                sx={{
                                    position: "absolute",
                                    left: 10,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    zIndex: Z.STICKY,
                                    bgcolor: "rgba(0,0,0,0.35)",
                                    color: "#fff",
                                    "&:hover": { bgcolor: "rgba(0,0,0,0.5)" },
                                    "&.Mui-disabled": {
                                        bgcolor: "rgba(0,0,0,0.15)",
                                        color: "rgba(255,255,255,0.3)",
                                    },
                                }}
                            >
                                <ChevronLeftRoundedIcon />
                            </IconButton>

                            <IconButton
                                onClick={onNext}
                                disabled={!canNext}
                                sx={{
                                    position: "absolute",
                                    right: 10,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    zIndex: Z.STICKY,
                                    bgcolor: "rgba(0,0,0,0.35)",
                                    color: "#fff",
                                    "&:hover": { bgcolor: "rgba(0,0,0,0.5)" },
                                    "&.Mui-disabled": {
                                        bgcolor: "rgba(0,0,0,0.15)",
                                        color: "rgba(255,255,255,0.3)",
                                    },
                                }}
                            >
                                <ChevronRightRoundedIcon />
                            </IconButton>
                        </>
                    )}

                    {isImage ? (
                        <Box
                            component="img"
                            src={fileUrl}
                            alt={file.fileName}
                            sx={{
                                maxWidth: "100%",
                                maxHeight: "100%",
                                objectFit: "contain",
                                userSelect: "none",
                                WebkitUserDrag: "none",
                            }}
                        />
                    ) : isPdf ? (
                        <Box
                            component="iframe"
                            src={fileUrl}
                            title={file.fileName || "pdf-preview"}
                            sx={{
                                width: "100%",
                                height: "100%",
                                border: 0,
                                bgcolor: "#fff",
                            }}
                        />
                    ) : (
                        <Box
                            sx={{
                                width: "100%",
                                maxWidth: 460,
                                borderRadius: 3,
                                p: 3,
                                textAlign: "center",
                                border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
                                bgcolor: isDark ? "rgba(255,255,255,0.03)" : "#fff",
                            }}
                        >
                            <InsertDriveFileRoundedIcon
                                sx={{
                                    fontSize: 56,
                                    color: "primary.main",
                                    mb: 1.5,
                                }}
                            />
                            <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 0.75 }}>
                                미리보기를 지원하지 않는 파일입니다
                            </Typography>
                            <Typography sx={{ fontSize: 13.5, color: "text.secondary", mb: 2 }}>
                                다운로드 후 확인해주세요.
                            </Typography>

                            <Stack direction="row" spacing={1} justifyContent="center">
                                <Button
                                    onClick={handleDownload}
                                    variant="contained"
                                    startIcon={<DownloadRoundedIcon />}
                                >
                                    다운로드
                                </Button>

                                <Button
                                    component="a"
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    variant="outlined"
                                    startIcon={<OpenInNewRoundedIcon />}
                                >
                                    새창 열기
                                </Button>
                            </Stack>
                        </Box>
                    )}
                </Box>
            </Box>
        </Dialog>
    );
}