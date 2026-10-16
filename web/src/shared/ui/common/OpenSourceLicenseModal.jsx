import React from "react";
import { Box, Typography } from "@mui/material";
import InfoDocModal, { Section, Body } from "./InfoDocModal.jsx";

// 주요 오픈소스 의존성 — 라이선스 표기 (정보 탭 고지용)
const LIBRARIES = [
    { name: "React", license: "MIT" },
    { name: "React Router", license: "MIT" },
    { name: "MUI (Material UI)", license: "MIT" },
    { name: "Emotion", license: "MIT" },
    { name: "Capacitor", license: "MIT" },
    { name: "Axios", license: "MIT" },
    { name: "Moment.js", license: "MIT" },
    { name: "date-fns", license: "MIT" },
    { name: "Framer Motion", license: "MIT" },
    { name: "Recharts", license: "MIT" },
    { name: "react-big-calendar", license: "MIT" },
    { name: "STOMP.js / SockJS", license: "Apache-2.0 / MIT" },
    { name: "react-kakao-maps-sdk", license: "MIT" },
    { name: "jwt-decode", license: "MIT" },
];

export default function OpenSourceLicenseModal({ open, onClose }) {
    return (
        <InfoDocModal open={open} onClose={onClose} title="오픈소스 라이선스">
            <Body>
                Plan Do!는 아래의 오픈소스 소프트웨어를 사용하여 만들어졌습니다. 각 라이브러리는 해당 라이선스를 따릅니다.
            </Body>

            <Section>
                <Box sx={{ mt: 1 }}>
                    {LIBRARIES.map((lib, i) => (
                        <Box
                            key={lib.name}
                            sx={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                py: 1.25,
                                borderTop: i === 0 ? "none" : "1px solid",
                                borderColor: "divider",
                            }}
                        >
                            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{lib.name}</Typography>
                            <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{lib.license}</Typography>
                        </Box>
                    ))}
                </Box>
            </Section>

            <Body>
                각 라이선스 전문은 해당 프로젝트의 공식 저장소에서 확인할 수 있습니다.
            </Body>
        </InfoDocModal>
    );
}
