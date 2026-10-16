import React from "react";
import { Box } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import TabQuestions from "../../detail/tabs/TabQuestions";
import { getUser } from "../../../../../shared/utils/tokenUtils";
import { detailCardSx, SectionEyebrow } from "./detailHelpers";

/**
 * DetailQa — 메인 컬럼 마지막 Q&A 카드
 * TabQuestions를 wrap하고 헤더에 카운트/미답변 배지 표시
 * sectionRef: 사이드바 "질문하기" 클릭 시 이 영역으로 scrollIntoView 할 수 있게 전달
 */
export default function DetailQa({
    item,
    onGuestBlock,
    onQuestionsCountsChange,
    sectionRef,
    defaultPrivate = false,
}) {
    const theme = useTheme();

    return (
        <Box ref={sectionRef} sx={{ ...detailCardSx, mb: 0 }}>
            <SectionEyebrow
                eyebrow="Q&A"
                title="모집 공고 Q&A"
                hint={item.questionCount > 0 ? `${item.questionCount}개` : null}
                action={
                    item.isAuthor && item.unansweredCount > 0 ? (
                        <Box component="span" sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            fontSize: 11.5,
                            fontWeight: 700,
                            px: 1,
                            py: 0.25,
                            borderRadius: 99,
                            bgcolor: alpha(theme.palette.warning.main, 0.14),
                            color: "warning.main",
                            letterSpacing: "-0.005em",
                        }}>
                            미답변 {item.unansweredCount}
                        </Box>
                    ) : null
                }
            />

            <TabQuestions
                recruitmentId={item.id}
                isAuthor={item.isAuthor}
                currentUserId={getUser()?.id ?? null}
                onGuestBlock={onGuestBlock}
                open={true}
                defaultPrivate={defaultPrivate}
                onCountsChange={(counts) => onQuestionsCountsChange?.(item.id, counts)}
            />
        </Box>
    );
}
