import React from "react";
import {
    Box, Dialog, DialogContent, DialogTitle,
    IconButton, Typography, Divider,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Z } from "../zIndex.js";

function Section({ title, children }) {
    return (
        <Box sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 800, mb: 1 }}>{title}</Typography>
            {children}
        </Box>
    );
}

function Body({ children }) {
    return (
        <Typography sx={{ fontSize: 13.5, color: "text.secondary", lineHeight: 1.75 }}>
            {children}
        </Typography>
    );
}

function BulletList({ items }) {
    return (
        <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
            {items.map((item, i) => (
                <Box component="li" key={i} sx={{ fontSize: 13.5, color: "text.secondary", lineHeight: 1.75, mb: 0.25 }}>
                    {item}
                </Box>
            ))}
        </Box>
    );
}

export default function PrivacyPolicyModal({ open, onClose }) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            sx={{ zIndex: Z.MODAL_NESTED }}
            PaperProps={{ sx: { borderRadius: 3, maxHeight: "85vh" } }}
        >
            <DialogTitle sx={{ pb: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box>
                        <Typography sx={{ fontWeight: 900, fontSize: 17 }}>개인정보처리방침</Typography>
                        <Typography variant="caption" color="text.secondary">최종 업데이트: 2026년 4월 28일</Typography>
                    </Box>
                    <IconButton size="small" onClick={onClose}>
                        <CloseRoundedIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <Divider sx={{ mt: 1.5 }} />

            <DialogContent sx={{ py: 2.5 }}>
                <Body>
                    Plan Do!는 이용자의 개인정보를 중요하게 생각하며 관련 법령을 준수합니다.
                </Body>

                <Divider sx={{ my: 2.5 }} />

                <Section title="1. 수집하는 개인정보 항목">
                    <BulletList items={[
                        "이메일 주소, 이름(표시 이름)",
                        "프로필 사진 (사용자가 직접 업로드한 경우)",
                        "위치 정보 (지도 기능 사용 시, 동의 후 수집)",
                        "서비스 이용 기록 (할 일, 일정, 댓글 등 입력 데이터)",
                        "소셜 로그인 시 해당 플랫폼(카카오, Apple)에서 제공하는 식별자",
                    ]} />
                </Section>

                <Section title="2. 개인정보 수집 및 이용 목적">
                    <BulletList items={[
                        "회원 가입 및 본인 확인",
                        "서비스 제공 (할 일 관리, 팀 협업, 일정 관리 등)",
                        "위치 기반 알림 서비스 제공",
                        "고객 문의 대응 및 서비스 개선",
                        "푸시 알림 발송",
                    ]} />
                </Section>

                <Section title="3. 개인정보 보유 및 이용 기간">
                    <Body>
                        회원 탈퇴 시 즉시 삭제합니다. 단, 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관 후 삭제합니다.
                    </Body>
                </Section>

                <Section title="4. 개인정보의 제3자 제공">
                    <Body>
                        서비스는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 단, 소셜 로그인 연동 시 해당 플랫폼(Kakao, Apple)의 정책에 따라 최소한의 정보가 사용됩니다.
                    </Body>
                </Section>

                <Section title="5. 이용자의 권리">
                    <BulletList items={[
                        "개인정보 열람, 수정, 삭제 요청",
                        "설정 페이지에서 계정 삭제(회원 탈퇴) 가능",
                        "위치 정보 수집 동의 철회: 기기 설정에서 언제든지 변경 가능",
                    ]} />
                </Section>

                <Section title="6. 개인정보 보호책임자">
                    <Body>개인정보 관련 문의는 아래로 연락해 주세요.</Body>
                    <Typography sx={{ fontSize: 13.5, color: "primary.main", mt: 0.75, fontWeight: 600 }}>
                        wawa9972@gmail.com
                    </Typography>
                </Section>
            </DialogContent>
        </Dialog>
    );
}
