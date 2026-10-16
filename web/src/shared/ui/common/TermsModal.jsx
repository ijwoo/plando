import React from "react";
import { Typography } from "@mui/material";
import InfoDocModal, { Section, Body, BulletList } from "./InfoDocModal.jsx";

export default function TermsModal({ open, onClose }) {
    return (
        <InfoDocModal open={open} onClose={onClose} title="이용약관" updated="2026년 4월 28일">
            <Body>
                본 약관은 Plan Do!(이하 &quot;서비스&quot;) 이용에 관한 조건과 절차, 이용자와 서비스의 권리·의무를 규정합니다.
            </Body>

            <Section title="제1조 (목적)">
                <Body>
                    이 약관은 이용자가 서비스를 이용함에 있어 필요한 사항을 정함을 목적으로 합니다.
                </Body>
            </Section>

            <Section title="제2조 (정의)">
                <BulletList items={[
                    "\"이용자\"란 본 약관에 따라 서비스를 이용하는 회원을 말합니다.",
                    "\"워크스페이스\"란 할 일·일정을 함께 관리하는 협업 공간을 말합니다.",
                    "\"콘텐츠\"란 이용자가 서비스에 입력·업로드한 할 일, 일정, 댓글, 파일 등을 말합니다.",
                ]} />
            </Section>

            <Section title="제3조 (서비스의 제공)">
                <BulletList items={[
                    "서비스는 할 일 관리, 일정·캘린더, 팀 협업, 알림 등의 기능을 제공합니다.",
                    "서비스는 운영상·기술상 필요에 따라 제공 내용을 변경할 수 있습니다.",
                    "서비스는 연중무휴 제공을 원칙으로 하되, 점검 등의 사유로 일시 중단될 수 있습니다.",
                ]} />
            </Section>

            <Section title="제4조 (이용자의 의무)">
                <BulletList items={[
                    "이용자는 타인의 정보를 도용하거나 허위 정보를 등록해서는 안 됩니다.",
                    "이용자는 서비스를 법령과 본 약관에 위배되는 목적으로 이용해서는 안 됩니다.",
                    "이용자가 작성한 콘텐츠에 대한 책임은 이용자 본인에게 있습니다.",
                ]} />
            </Section>

            <Section title="제5조 (콘텐츠의 권리)">
                <Body>
                    이용자가 작성한 콘텐츠의 권리는 이용자에게 있으며, 서비스는 서비스 제공·운영에 필요한 범위 내에서만 이를 이용합니다.
                </Body>
            </Section>

            <Section title="제6조 (책임의 제한)">
                <Body>
                    서비스는 천재지변, 이용자의 귀책사유, 통신 장애 등 불가항력으로 인한 손해에 대해 책임을 지지 않습니다.
                    서비스는 무료로 제공되는 기능의 정확성·완전성을 보증하지 않습니다.
                </Body>
            </Section>

            <Section title="제7조 (회원 탈퇴 및 이용 제한)">
                <Body>
                    이용자는 언제든지 설정 화면에서 회원 탈퇴를 할 수 있으며, 본 약관을 위반한 경우 서비스 이용이 제한될 수 있습니다.
                </Body>
            </Section>

            <Section title="제8조 (약관의 변경)">
                <Body>
                    서비스는 필요 시 약관을 변경할 수 있으며, 변경 시 서비스 내 공지를 통해 안내합니다.
                    변경된 약관은 공지 후 효력이 발생합니다.
                </Body>
            </Section>

            <Section title="문의">
                <Body>약관 관련 문의는 아래로 연락해 주세요.</Body>
                <Typography sx={{ fontSize: 13.5, color: "primary.main", mt: 0.75, fontWeight: 600 }}>
                    wawa9972@gmail.com
                </Typography>
            </Section>
        </InfoDocModal>
    );
}
