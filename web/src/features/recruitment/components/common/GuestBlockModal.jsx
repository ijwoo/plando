import React from "react";
import { useNavigate } from "react-router-dom";
import {
    Dialog, DialogContent, DialogActions,
    Typography, Button, Box, Stack,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Z } from "../../../../shared/ui/zIndex.js";

export default function GuestBlockModal({ open, onClose, title = "회원 전용 기능이에요", description }) {
    const navigate = useNavigate();

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            sx={{ zIndex: Z.MODAL_NESTED }}
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    p: 1,
                },
            }}
        >
            <DialogContent sx={{ textAlign: "center", pt: 4, pb: 2 }}>
                <Box
                    sx={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mx: "auto",
                        mb: 2.5,
                        bgcolor: (t) =>
                            t.palette.mode === "dark"
                                ? "rgba(99,102,241,0.15)"
                                : "#EEF2FF",
                    }}
                >
                    <LockOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />
                </Box>

                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, letterSpacing: -0.3 }}>
                    {title}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7 }}>
                    {description ?? (<>회원가입 후 모든 기능을<br />이용할 수 있어요.</>)}
                </Typography>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3, flexDirection: "column", gap: 1 }}>
                <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    sx={{ borderRadius: 2.5, fontWeight: 800, height: 46 }}
                    onClick={() => navigate("/register")}
                >
                    회원가입
                </Button>
                <Button
                    fullWidth
                    variant="text"
                    size="large"
                    sx={{ borderRadius: 2.5, fontWeight: 700, height: 40, color: "text.secondary" }}
                    onClick={onClose}
                >
                    닫기
                </Button>
            </DialogActions>
        </Dialog>
    );
}
