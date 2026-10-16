import React from "react";
import { Box, Button, Typography } from "@mui/material";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error("[ErrorBoundary]", error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <Box
                    sx={{
                        minHeight: "100dvh",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                        p: 4,
                        bgcolor: "background.default",
                    }}
                >
                    <ErrorOutlineRoundedIcon sx={{ fontSize: 56, color: "text.disabled" }} />
                    <Box sx={{ textAlign: "center" }}>
                        <Typography variant="h6" fontWeight={700} gutterBottom>
                            문제가 발생했습니다
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            예상치 못한 오류가 발생했어요.
                            <br />
                            앱을 새로고침하면 대부분 해결됩니다.
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        startIcon={<RefreshRoundedIcon />}
                        onClick={() => window.location.reload()}
                        sx={{ borderRadius: 3, fontWeight: 700 }}
                    >
                        새로고침
                    </Button>
                </Box>
            );
        }

        return this.props.children;
    }
}
