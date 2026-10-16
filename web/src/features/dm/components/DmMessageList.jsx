import React, { useMemo, useRef, useState, useCallback } from "react";
import { Box, Typography, Avatar, useMediaQuery, CircularProgress } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import { TAG_META } from "../constants/dmTags.js";
import { STATUS_LABEL } from "../../../shared/ui/tone.js";
import { resolveImageUrl } from "../../../shared/utils/urlUtils.js";
import { renderMarkdown } from "../../../shared/utils/markdownUtils.jsx";
import { formatFileSize } from "../../../shared/utils/formatters.js";
import LoadingSkeleton from "./LoadingSkeleton.jsx";
import { timeStr, dateSep } from "../utils/dmMessageUtils.js";
import MessageActionSheet from "./MessageActionSheet.jsx";
import MessageBubbleActions from "./MessageBubbleActions.jsx";
import LinkPreviewCard from "./LinkPreviewCard.jsx";
import { extractFirstUrl } from "../../../shared/utils/urlUtils.js";
import ConfirmDialog from "../../../shared/ui/common/ConfirmDialog.jsx";
import { Z } from "../../../shared/ui/zIndex.js";
import { getDmColors } from "../../../shared/ui/glassSx.js";
import EmptyState from "../../../shared/ui/common/EmptyState.jsx";

// 가운데 라벨 + 양쪽 가로선 구분선 (날짜 / 안 읽음 공용)
function LabeledDivider({ label, color, lineColor, id, bold = false }) {
    return (
        <Box id={id} sx={{ display: "flex", alignItems: "center", mx: -0.5, my: 1.5, gap: 1.5 }}>
            <Box sx={{ flex: 1, height: "1px", bgcolor: lineColor }} />
            <Typography sx={{ fontSize: 11, fontWeight: bold ? 700 : 600, color, whiteSpace: "nowrap" }}>
                {label}
            </Typography>
            <Box sx={{ flex: 1, height: "1px", bgcolor: lineColor }} />
        </Box>
    );
}

export default function DmMessageList({
    room,
    loading,
    groups,
    lastReadIdx,
    bottomRef,
    messagesBoxRef,
    onScroll,
    loadingOlder = false,
    typingName = null,
    onReply,
    onRetry,
    onJumpToMessage,
    firstUnreadId = null,
    highlightId = null,
    textColor,
    primaryColor,
    isDark,
    myBubble,
    theirBubble,
    isDesktop = false,
    openPreview,
    onDeleteMessage,
    onCreateTodo,
    onEditMessage,
    onReactMessage,
    onPinNotice,
    onOpenTodo,
}) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    // 내 말풍선 위 글자색 — 말풍선 배경(테마 primary)에 맞춰 계산 (custom 테마 대비 보호)
    const myBubbleText = getDmColors(theme).myBubbleText;

    const [actionMsg, setActionMsg] = useState(null);
    const [actionIsMe, setActionIsMe] = useState(false);
    // 삭제는 상대방에게도 즉시 전파되므로 확인 후 실행 (데스크탑 호버 / 모바일 시트 공용)
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const longPressTimer = useRef(null);

    const requestDelete = useCallback((messageId) => setDeleteConfirmId(messageId), []);

    const previewFiles = useMemo(() => {
        return groups
            .map((g) => g.msg)
            .filter((m) => m?.fileUrl)
            .map((m) => ({ fileUrl: m.fileUrl, fileName: m.fileName, fileType: m.fileType, fileSize: m.fileSize }));
    }, [groups]);

    const openAction = useCallback((msg, isMe) => {
        // 어떤 메시지든 시트를 연다 — 답장/이모지/공지는 텍스트 없는 사진·파일에도 필요.
        // 어떤 항목을 보여줄지는 시트가 스스로 판단(복사=텍스트 있을 때, 삭제=내 메시지일 때).
        if (!msg) return;
        setActionMsg(msg);
        setActionIsMe(isMe);
    }, []);

    // 롱프레스 핸들러 (모바일)
    const makeLongPressHandlers = (msg, isMe) => ({
        onTouchStart: () => {
            longPressTimer.current = setTimeout(() => openAction(msg, isMe), 500);
        },
        onTouchEnd: () => clearTimeout(longPressTimer.current),
        onTouchMove: () => clearTimeout(longPressTimer.current),
    });

    return (
        <>
            <Box
                ref={messagesBoxRef}
                onScroll={onScroll}
                sx={{
                    flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch",
                    display: "flex", flexDirection: "column",
                    pt: isDesktop ? 0 : "68px",
                }}
            >
                {loading ? (
                    <LoadingSkeleton />
                ) : (
                    <>
                        {loadingOlder && (
                            <Box sx={{ display: "flex", justifyContent: "center", py: 1.5 }}>
                                <CircularProgress size={18} />
                            </Box>
                        )}
                        <Box sx={{ px: 2.5, pt: 6, pb: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
                            {room?.isGroup ? (
                                <>
                                    <Avatar sx={{ width: 72, height: 72, bgcolor: alpha(primaryColor, isDark ? 0.2 : 0.12) }}>
                                        <GroupsRoundedIcon sx={{ fontSize: 38, color: primaryColor }} />
                                    </Avatar>
                                    <Typography sx={{ fontSize: 24, fontWeight: 700, color: textColor, mt: 0.5 }}>
                                        {room?.groupName || "그룹 채팅"}
                                    </Typography>
                                    <Typography sx={{ fontSize: 14.5, lineHeight: 1.65, color: isDark ? "rgba(255,255,255,0.55)" : "#3c3c43" }}>
                                        <Box component="span" sx={{ color: primaryColor, fontWeight: 600 }}>{room?.memberCount || 0}명</Box>
                                        {" "}이 참여 중인 그룹 채팅입니다.
                                    </Typography>
                                </>
                            ) : (
                                <>
                                    <Avatar
                                        src={room?.partnerProfileImageUrl ? resolveImageUrl(room.partnerProfileImageUrl) : undefined}
                                        sx={{ width: 72, height: 72, fontSize: 28, fontWeight: 700 }}
                                    >
                                        {room?.partnerName?.charAt(0)}
                                    </Avatar>
                                    <Typography sx={{ fontSize: 24, fontWeight: 700, color: textColor, mt: 0.5 }}>
                                        {room?.partnerName}
                                    </Typography>
                                    <Typography sx={{ fontSize: 14.5, lineHeight: 1.65, color: isDark ? "rgba(255,255,255,0.55)" : "#3c3c43" }}>
                                        <Box component="span" sx={{ color: primaryColor, fontWeight: 600 }}>@{room?.partnerName}</Box>
                                        {" "}님과의 메시지 내역의 첫 부분입니다.
                                    </Typography>
                                </>
                            )}
                        </Box>

                        <Box sx={{ px: 2, pt: 1, pb: 0.5, display: "flex", flexDirection: "column" }}>
                            {/* 새 대화는 상대 아바타 헤더 아래가 그냥 빈 여백이었다 — 앱에서 가장 자주 보는 빈 화면 */}
                            {groups.length === 0 && (
                                <EmptyState
                                    emoji="👋"
                                    title="아직 주고받은 메시지가 없어요"
                                    desc="첫 메시지를 보내 대화를 시작해 보세요."
                                    size="sm"
                                />
                            )}
                            {groups.map(({ msg, isMe, grouped, lastInGroup, showDate }, idx) => {
                                const showRead = isMe && lastInGroup && idx === lastReadIdx;
                                const previewFile = msg.fileUrl
                                    ? { fileUrl: msg.fileUrl, fileName: msg.fileName, fileType: msg.fileType, fileSize: msg.fileSize }
                                    : null;

                                const touchHandlers = isMobile ? makeLongPressHandlers(msg, isMe) : {};

                                return (
                                    <React.Fragment key={msg.id}>
                                        {firstUnreadId === msg.id && (
                                            <LabeledDivider id="dm-unread-divider" label="여기까지 읽음" color={primaryColor} lineColor={alpha(primaryColor, 0.4)} bold />
                                        )}
                                        {showDate && (
                                            <LabeledDivider label={dateSep(msg.sentAt)} color="text.secondary" lineColor="divider" />
                                        )}

                                        <Box
                                            id={`dm-msg-${msg.id}`}
                                            className="bubble-row"
                                            {...touchHandlers}
                                            sx={{
                                                display: "flex",
                                                flexDirection: isMe ? "row-reverse" : "row",
                                                alignItems: "flex-start",
                                                mt: grouped ? 0.25 : 1.5,
                                                gap: 1,
                                                // 전송 중(낙관적) 버블은 살짝 흐리게 — 전송 완료되면 실 메시지로 치환
                                                opacity: msg._pending ? 0.55 : 1,
                                                transition: "opacity 0.15s, background-color 0.3s",
                                                // 검색 점프 하이라이트
                                                bgcolor: highlightId === msg.id ? alpha(primaryColor, isDark ? 0.18 : 0.10) : "transparent",
                                                borderRadius: 2,
                                            }}
                                        >
                                            {!isMe && (
                                                <Box sx={{ width: 32, flexShrink: 0 }}>
                                                    {!grouped && (
                                                        <Avatar
                                                            src={msg.senderProfileImageUrl ? resolveImageUrl(msg.senderProfileImageUrl) : undefined}
                                                            sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 700 }}
                                                        >
                                                            {msg.senderName?.charAt(0)}
                                                        </Avatar>
                                                    )}
                                                </Box>
                                            )}

                                            <Box sx={{ maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 0.3 }}>
                                                {!isMe && !grouped && (
                                                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", px: 0.5, mb: 0.25 }}>
                                                        {msg.senderName}
                                                    </Typography>
                                                )}

                                                {/* 답장 인용 — 말풍선 위에 표시, 탭하면 원문으로 점프 */}
                                                {msg.replyToId && (
                                                    <Box
                                                        onClick={() => onJumpToMessage?.(msg.replyToId)}
                                                        sx={{
                                                            maxWidth: "100%", mb: 0.25, px: 1, py: 0.5,
                                                            borderLeft: `3px solid ${alpha(primaryColor, 0.6)}`,
                                                            bgcolor: "var(--plando-surface-low)",
                                                            borderRadius: "0 8px 8px 0",
                                                            cursor: "pointer",
                                                            "&:hover": { bgcolor: alpha(primaryColor, isDark ? 0.12 : 0.07) },
                                                        }}
                                                    >
                                                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: primaryColor, lineHeight: 1.3 }} noWrap>
                                                            {msg.replyToSenderName || "메시지"}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.35 }} noWrap>
                                                            {msg.replyToContent || "삭제된 메시지"}
                                                        </Typography>
                                                    </Box>
                                                )}

                                                {/* 업무 태그 chip — 말풍선 위에 표시 */}
                                                {msg.tag && TAG_META[msg.tag] && (
                                                    <Box sx={{
                                                        display: "inline-flex", alignItems: "center", gap: 0.5,
                                                        px: 0.875, py: 0.25, borderRadius: 1,
                                                        fontSize: 11, fontWeight: 700,
                                                        bgcolor: alpha(TAG_META[msg.tag].color, isDark ? 0.18 : 0.12),
                                                        color: TAG_META[msg.tag].color,
                                                        mb: 0.25,
                                                    }}>
                                                        <span>{TAG_META[msg.tag].emoji}</span>
                                                        <span>{TAG_META[msg.tag].label}</span>
                                                    </Box>
                                                )}

                                                {/* 버블 + 데스크탑 호버 액션 */}
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexDirection: isMe ? "row" : "row-reverse" }}>
                                                    {!isMobile && onDeleteMessage && (
                                                        <MessageBubbleActions
                                                            msg={msg}
                                                            isMe={isMe}
                                                            isDark={isDark}
                                                            onDelete={requestDelete}
                                                            onCreateTodo={onCreateTodo}
                                                            onEdit={onEditMessage}
                                                            onReact={onReactMessage}
                                                            onReply={onReply}
                                                            onPinNotice={onPinNotice}
                                                        />
                                                    )}

                                                    {msg.fileUrl && msg.fileType?.startsWith("image/") ? (
                                                        <Box sx={{ borderRadius: 2.5, overflow: "hidden", display: "inline-block" }}>
                                                            <Box
                                                                component="img"
                                                                src={resolveImageUrl(msg.fileUrl)}
                                                                alt={msg.fileName}
                                                                onClick={() => openPreview?.(previewFile, previewFiles)}
                                                                sx={{ maxWidth: 240, maxHeight: 240, display: "block", cursor: "pointer", objectFit: "cover" }}
                                                            />
                                                            {msg.content?.trim() && (
                                                                <Box sx={{ px: 1.5, py: 0.75, bgcolor: isMe ? myBubble : theirBubble }}>
                                                                    <Typography component="span" sx={{ fontSize: 14, color: isMe ? myBubbleText : textColor, display: "block", "& strong": { fontWeight: 700 }, "& em": { fontStyle: "italic" } }}>
                                                                        {renderMarkdown(msg.content)}
                                                                    </Typography>
                                                                </Box>
                                                            )}
                                                        </Box>
                                                    ) : msg.fileUrl ? (
                                                        <Box sx={{ borderRadius: 2.5, overflow: "hidden" }}>
                                                            <Box
                                                                onClick={() => openPreview?.(previewFile, previewFiles)}
                                                                sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, bgcolor: isMe ? myBubble : theirBubble, cursor: "pointer" }}
                                                            >
                                                                <InsertDriveFileRoundedIcon sx={{ fontSize: 22, color: isMe ? alpha(myBubbleText, 0.85) : primaryColor }} />
                                                                <Box>
                                                                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: isMe ? myBubbleText : textColor, lineHeight: 1.3 }}>
                                                                        {msg.fileName}
                                                                    </Typography>
                                                                    {msg.fileSize && (
                                                                        <Typography sx={{ fontSize: 10.5, color: isMe ? alpha(myBubbleText, 0.65) : "text.disabled" }}>
                                                                            {formatFileSize(msg.fileSize)}
                                                                        </Typography>
                                                                    )}
                                                                </Box>
                                                            </Box>
                                                            {msg.content?.trim() && (
                                                                <Box sx={{ px: 1.5, py: 0.75, bgcolor: isMe ? myBubble : theirBubble, borderTop: `1px solid ${isMe ? alpha(myBubbleText, 0.15) : alpha(theme.palette.text.primary, 0.06)}` }}>
                                                                    <Typography component="span" sx={{ fontSize: 14, color: isMe ? myBubbleText : textColor, display: "block", "& strong": { fontWeight: 700 }, "& em": { fontStyle: "italic" } }}>
                                                                        {renderMarkdown(msg.content)}
                                                                    </Typography>
                                                                </Box>
                                                            )}
                                                        </Box>
                                                    ) : (
                                                        <Box
                                                            sx={{
                                                                px: 1.5, py: 0.875,
                                                                borderRadius: isMe
                                                                    ? !grouped ? "16px 4px 16px 16px" : "16px 4px 4px 16px"
                                                                    : !grouped ? "4px 16px 16px 16px" : "4px 16px 16px 4px",
                                                                bgcolor: isMe ? myBubble : theirBubble,
                                                                color: isMe ? myBubbleText : textColor,
                                                                wordBreak: "break-word", whiteSpace: "pre-wrap",
                                                            }}
                                                        >
                                                            <Typography component="span" sx={{ fontSize: 15, lineHeight: 1.5, letterSpacing: -0.1, display: "block", "& strong": { fontWeight: 700 }, "& em": { fontStyle: "italic" } }}>
                                                                {renderMarkdown(msg.content)}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </Box>

                                                {/* todo 링크 첨부 카드 — 말풍선 아래에 묶어 표시 */}
                                                {msg.linkedTodoId && msg.linkedTodoTitle && (
                                                    <Box
                                                        onClick={() => onOpenTodo?.(msg.linkedTodoId)}
                                                        sx={{
                                                            display: "flex", alignItems: "center", gap: 1,
                                                            px: 1.25, py: 0.875, borderRadius: 2,
                                                            border: "1px solid", borderColor: "divider",
                                                            bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                                                            cursor: "pointer", mt: 0.5, maxWidth: 280,
                                                            "&:hover": { borderColor: primaryColor },
                                                        }}
                                                    >
                                                        <AssignmentRoundedIcon sx={{ fontSize: 18, color: primaryColor, flexShrink: 0 }} />
                                                        <Box sx={{ minWidth: 0 }}>
                                                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: textColor, lineHeight: 1.2 }} noWrap>
                                                                {msg.linkedTodoTitle}
                                                            </Typography>
                                                            <Typography sx={{ fontSize: 10.5, color: "text.disabled", mt: 0.25 }}>
                                                                {STATUS_LABEL[msg.linkedTodoStatus] || STATUS_LABEL.TODO}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                )}

                                                {/* 링크 미리보기 — 본문 첫 URL의 unfurl 카드 (말풍선 아래) */}
                                                {!msg.fileUrl && extractFirstUrl(msg.content) && (
                                                    <LinkPreviewCard url={extractFirstUrl(msg.content)} isDark={isDark} />
                                                )}

                                                {/* reaction chips — 같은 줄에 emoji + count */}
                                                {msg.reactionCounts && Object.keys(msg.reactionCounts).length > 0 && (
                                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                                                        {Object.entries(msg.reactionCounts).map(([emo, count]) => {
                                                            const mine = (msg.myReactions || []).includes(emo);
                                                            return (
                                                                <Box
                                                                    key={emo}
                                                                    onClick={() => onReactMessage?.(msg.id, emo)}
                                                                    sx={{
                                                                        display: "inline-flex", alignItems: "center", gap: 0.4,
                                                                        px: 0.75, py: "2px", borderRadius: 10,
                                                                        fontSize: 12, lineHeight: 1.2,
                                                                        cursor: "pointer",
                                                                        border: "1px solid",
                                                                        borderColor: mine ? primaryColor : "divider",
                                                                        bgcolor: mine
                                                                            ? alpha(primaryColor, isDark ? 0.18 : 0.1)
                                                                            : (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"),
                                                                        color: mine ? primaryColor : "text.secondary",
                                                                        fontWeight: 700,
                                                                    }}
                                                                >
                                                                    <span>{emo}</span>
                                                                    <span>{count}</span>
                                                                </Box>
                                                            );
                                                        })}
                                                    </Box>
                                                )}

                                                {lastInGroup && (
                                                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 0.2, px: 0.5, mt: 0.25 }}>
                                                        {showRead && (
                                                            <Typography sx={{ fontSize: 10, color: primaryColor, fontWeight: 600 }}>읽음</Typography>
                                                        )}
                                                        <Typography sx={{ fontSize: 10.5, color: "text.disabled" }}>
                                                            {timeStr(msg.sentAt)}
                                                            {msg.editedAt && (
                                                                <Box component="span" sx={{ ml: 0.5, fontStyle: "italic" }}>(수정됨)</Box>
                                                            )}
                                                        </Typography>
                                                    </Box>
                                                )}

                                                {msg._failed && (
                                                    <Box
                                                        onClick={() => onRetry?.(msg)}
                                                        sx={{
                                                            display: "flex", alignItems: "center", gap: 0.25,
                                                            alignSelf: isMe ? "flex-end" : "flex-start",
                                                            px: 0.5, mt: 0.25, cursor: "pointer", color: "#ef4444",
                                                            "&:active": { opacity: 0.6 },
                                                        }}
                                                    >
                                                        <ErrorOutlineRoundedIcon sx={{ fontSize: 13 }} />
                                                        <Typography sx={{ fontSize: 10.5, fontWeight: 700 }}>전송 실패 · 재시도</Typography>
                                                    </Box>
                                                )}
                                            </Box>

                                            {isMe && <Box sx={{ width: 32, flexShrink: 0 }} />}
                                        </Box>
                                    </React.Fragment>
                                );
                            })}

                            {typingName && (
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1, pt: 0.5, pb: 0.25 }}>
                                    <Box sx={{ display: "flex", gap: "3px" }}>
                                        {[0, 1, 2].map((i) => (
                                            <Box key={i} sx={{
                                                width: 5, height: 5, borderRadius: "50%", bgcolor: "text.disabled",
                                                animation: "dmTypingBlink 1.2s infinite both",
                                                animationDelay: `${i * 0.18}s`,
                                                "@keyframes dmTypingBlink": { "0%, 80%, 100%": { opacity: 0.25 }, "40%": { opacity: 1 } },
                                            }} />
                                        ))}
                                    </Box>
                                    <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
                                        {typingName}
                                    </Typography>
                                </Box>
                            )}

                            <div ref={bottomRef} style={{ height: 8 }} />
                        </Box>
                    </>
                )}
            </Box>

            {/* 모바일 롱프레스 액션 시트 */}
            {isMobile && (
                <MessageActionSheet
                    open={!!actionMsg}
                    onClose={() => setActionMsg(null)}
                    msg={actionMsg}
                    isMe={actionIsMe}
                    isDark={isDark}
                    onDelete={onDeleteMessage ? requestDelete : undefined}
                    onCreateTodo={onCreateTodo}
                    onEdit={onEditMessage}
                    onReact={onReactMessage}
                    onReply={onReply}
                    onPinNotice={onPinNotice}
                />
            )}

            {/* 메시지 삭제 확인 — 액션 시트(Z.TOAST) 위로 떠야 함 */}
            <ConfirmDialog
                open={deleteConfirmId !== null}
                title="메시지 삭제"
                message={"이 메시지를 삭제할까요?\n상대방 화면에서도 사라지며 되돌릴 수 없어요."}
                confirmText="삭제"
                confirmColor="error"
                zIndex={Z.TOAST + 1}
                onClose={() => setDeleteConfirmId(null)}
                onConfirm={() => { onDeleteMessage?.(deleteConfirmId); setDeleteConfirmId(null); }}
            />
        </>
    );
}
