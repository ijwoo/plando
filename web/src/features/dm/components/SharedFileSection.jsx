import React from "react";
import { Box, Typography, Stack } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import { resolveImageUrl } from "../../../shared/utils/urlUtils.js";
import { formatFileSize } from "../../../shared/utils/formatters.js";

/**
 * DM 패널 / 프로필 모달에서 공통으로 쓰는 "공유 파일" 섹션
 *
 * @param {{ files: Array, imageSize?: number, compact?: boolean, onPreview?: Function }} props
 *   imageSize — 이미지 썸네일 크기 (px). 기본 72
 *   compact   — 더 작은 폰트/간격 사용 (DmPage 오른쪽 패널용). 기본 false
 *   onPreview — 파일 클릭 시 미리보기 모달 오픈 핸들러
 */
export default function SharedFileSection({
                                              files = [],
                                              imageSize = 72,
                                              compact = false,
                                              onPreview,
                                          }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const divider = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)";
    const primary = theme.palette.primary.main;

    if (!files.length) {
        return (
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ py: 0.75, color: "text.disabled" }}>
                <InsertDriveFileRoundedIcon sx={{ fontSize: 15, flexShrink: 0 }} />
                <Typography sx={{ fontSize: compact ? 11.5 : 12 }}>주고받은 파일이 없어요</Typography>
            </Stack>
        );
    }

    const normalizedFiles = files
        .filter((f) => f?.fileUrl)
        .map((f) => ({
            fileUrl: f.fileUrl,
            fileName: f.fileName,
            fileType: f.fileType,
            fileSize: f.fileSize,
        }));

    const images = normalizedFiles.filter((f) => f.fileType?.startsWith("image/"));
    const nonImages = normalizedFiles.filter((f) => !f.fileType?.startsWith("image/"));

    const handlePreview = (file) => {
        if (onPreview) {
            onPreview(file, normalizedFiles);
            return;
        }

        window.open(resolveImageUrl(file.fileUrl), "_blank");
    };

    return (
        <>
            {images.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.25 }}>
                    {images.map((f, i) => (
                        <Box
                            key={`${f.fileUrl}-${i}`}
                            component="img"
                            src={resolveImageUrl(f.fileUrl)}
                            alt={f.fileName}
                            onClick={() => handlePreview(f)}
                            sx={{
                                width: imageSize,
                                height: imageSize,
                                objectFit: "cover",
                                borderRadius: compact ? 1.5 : 2,
                                cursor: "pointer",
                                border: `1px solid ${divider}`,
                            }}
                        />
                    ))}
                </Box>
            )}

            {nonImages.map((f, i) => (
                <Box
                    key={`${f.fileUrl}-${i}`}
                    onClick={() => handlePreview(f)}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: compact ? 1 : 1.25,
                        py: compact ? 0.75 : 0.875,
                        textDecoration: "none",
                        borderBottom: `1px solid ${divider}`,
                        cursor: "pointer",
                        "&:last-child": { borderBottom: "none" },
                        "&:hover": { opacity: 0.75 },
                    }}
                >
                    <InsertDriveFileRoundedIcon
                        sx={{
                            fontSize: compact ? 16 : 18,
                            color: primary,
                            flexShrink: 0,
                        }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                            sx={{
                                fontSize: compact ? 11 : 12.5,
                                fontWeight: 600,
                                color: "text.primary",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {f.fileName}
                        </Typography>

                        {f.fileSize && (
                            <Typography sx={{ fontSize: compact ? 10 : 10.5, color: "text.disabled" }}>
                                {formatFileSize(f.fileSize)}
                            </Typography>
                        )}
                    </Box>
                </Box>
            ))}
        </>
    );
}