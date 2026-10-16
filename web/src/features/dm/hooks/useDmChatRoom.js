import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { fetchMessages, sendDmMessage, searchDmMessages, markAsRead, uploadDmFile, deleteDmMessage, updateDmMessage, toggleDmReaction, setDmNotice } from "../api/dmApi.js";
import { useWebSocket } from "./useWebSocket.js";
import { stompPublish } from "../../../shared/api/stompClient.js";

const PAGE_SIZE = 30;
import { buildGroups } from "../utils/dmMessageUtils.js";
import { useKeyboardOffset } from "../../../shared/hooks/useKeyboardOffset.js";
import { useFilePreview } from "../../../shared/hooks/useFilePreview.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { getUser } from "../../../shared/utils/tokenUtils.js";

export default function useDmChatRoom({ room, fullscreen = false }) {
    const me = getUser();
    const myEmail = me?.email;
    const myId = me?.id;
    const myName = me?.name;
    const kbOffset = useKeyboardOffset();

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [typingUsers, setTypingUsers] = useState({}); // { email: name } — 그룹 다중 타이핑 집계
    const typingTimersRef = useRef({}); // { email: timeoutId }
    const lastTypingSentRef = useRef(0);

    const stopTyping = useCallback((email) => {
        if (!email) return;
        setTypingUsers((prev) => {
            if (!(email in prev)) return prev;
            const next = { ...prev };
            delete next[email];
            return next;
        });
        clearTimeout(typingTimersRef.current[email]);
        delete typingTimersRef.current[email];
    }, []);
    const preserveScrollRef = useRef(null);

    // 안 읽은 메시지 구분선 / 맨 아래로 점프 버튼 상태
    const [firstUnreadId, setFirstUnreadId] = useState(null);
    const [atBottom, setAtBottom] = useState(true);
    const [newCount, setNewCount] = useState(0);
    const atBottomRef = useRef(true);
    const initialScrollDoneRef = useRef(false);

    // 답장 대상 / 첨부할 기존 할 일 (전송 시 자동 병합)
    const [replyTarget, setReplyTarget] = useState(null);
    const [attachedTodo, setAttachedTodo] = useState(null);
    // 대화 내 검색
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [highlightId, setHighlightId] = useState(null);
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const [inputFocused, setInputFocused] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [emojiOpen, setEmojiOpen] = useState(false);

    // 파일 미리보기 — 공용 useFilePreview 훅 사용 (기존 인라인 재구현 제거)
    const {
        previewOpen, previewFile, previewFiles, previewIndex,
        openPreview, closePreview, handlePrevPreview, handleNextPreview,
    } = useFilePreview();

    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const messagesBoxRef = useRef(null);

    useEffect(() => {
        if (!fullscreen) return;

        const prevOverflow = document.body.style.overflow;
        const prevPosition = document.body.style.position;
        const prevWidth = document.body.style.width;

        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.width = "100%";

        const blockTouchMove = (e) => {
            if (messagesBoxRef.current?.contains(e.target)) return;
            e.preventDefault();
        };

        document.addEventListener("touchmove", blockTouchMove, { passive: false });

        return () => {
            document.body.style.overflow = prevOverflow;
            document.body.style.position = prevPosition;
            document.body.style.width = prevWidth;
            document.removeEventListener("touchmove", blockTouchMove);
        };
    }, [fullscreen]);

    useEffect(() => {
        if (!fullscreen || kbOffset === 0) return;
        setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 60);
    }, [fullscreen, kbOffset]);

    const handleIncoming = useCallback(
        (msg) => {
            if (msg.type === "READ_RECEIPT") {
                // 1:1은 상대가 읽으면 내 메시지 전부 읽음 처리(낙관적).
                // 그룹은 "전원 읽음"이라야 읽음이므로 낙관적 처리 안 함 — 다음 로드 때 서버 계산값 반영.
                if (!room?.isGroup) {
                    setMessages((prev) =>
                        prev.map((m) => (m.readAt ? m : { ...m, readAt: new Date().toISOString() }))
                    );
                }
                return;
            }

            if (msg.type === "TYPING") {
                const email = msg.senderEmail;
                if (email && email !== myEmail) {
                    setTypingUsers((prev) => ({ ...prev, [email]: msg.senderName || "상대방" }));
                    clearTimeout(typingTimersRef.current[email]);
                    typingTimersRef.current[email] = setTimeout(() => stopTyping(email), 4000);
                }
                return;
            }

            if (msg.type === "MESSAGE_DELETED") {
                setMessages((prev) => prev.filter((m) => m.id !== msg.messageId));
                // 마지막 메시지 삭제 시 방 목록 미리보기가 낡지 않도록 갱신 이벤트 발행
                window.dispatchEvent(new Event(APP_EVENTS.DM_UNREAD_CHANGED));
                return;
            }

            if (msg.type === "MESSAGE_UPDATED" || msg.type === "REACTION_UPDATED") {
                const updated = msg.message;
                if (!updated?.id) return;
                setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
                // 수정은 방 목록 미리보기(lastMessage)에 반영 — 리액션은 미리보기와 무관하므로 제외
                if (msg.type === "MESSAGE_UPDATED") {
                    window.dispatchEvent(new Event(APP_EVENTS.DM_UNREAD_CHANGED));
                }
                return;
            }

            // 새 메시지가 오면 그 사람은 더 이상 입력 중 아님
            if (msg.senderEmail && msg.senderEmail !== myEmail) stopTyping(msg.senderEmail);

            setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                // 내 메시지 echo가 REST 응답보다 먼저 오는 경우 — 같은 내용의 낙관적(pending) 버블 제거
                const cleaned = msg.senderEmail === myEmail
                    ? prev.filter((m) => !(m._pending && m.content === msg.content))
                    : prev;
                return [...cleaned, msg];
            });

            // 하단에서 벗어나 있을 때 상대 메시지가 오면 '새 메시지' 배지 카운트 증가
            if (msg.senderEmail !== myEmail && !atBottomRef.current) {
                setNewCount((c) => c + 1);
            }

            if (room?.id) {
                markAsRead(room.id).catch(() => {});
            }

            window.dispatchEvent(new Event(APP_EVENTS.DM_UNREAD_CHANGED));
        },
        [room?.id, room?.isGroup, myEmail, stopTyping]
    );

    // WebSocket은 수신 전용 (전송은 REST — 성공/실패 확실, 미연결 시 유실 방지)
    useWebSocket({
        roomId: room?.id,
        onMessage: handleIncoming,
    });

    useEffect(() => {
        if (!room?.id) return;

        setLoading(true);
        setMessages([]);
        setHasMore(false);
        // 방 전환 시 작성/검색 상태 초기화 (이전 방의 답장·첨부·검색이 남지 않게)
        setReplyTarget(null);
        setAttachedTodo(null);
        setTypingUsers({});
        Object.values(typingTimersRef.current).forEach(clearTimeout);
        typingTimersRef.current = {};
        setSearchOpen(false);
        setSearchResults([]);
        // 스크롤/안읽음 상태 초기화
        setFirstUnreadId(null);
        setNewCount(0);
        setAtBottom(true);
        atBottomRef.current = true;
        initialScrollDoneRef.current = false;

        const unread = room.unreadCount || 0;

        fetchMessages(room.id, { size: PAGE_SIZE })
            .then((res) => {
                const page = res.data || [];
                setMessages(page);
                setHasMore(page.length >= PAGE_SIZE); // 가득 차면 더 있을 수 있음
                // 안 읽은 메시지가 있고, 그 위에 읽은 메시지가 최소 1개 있으면 구분선 표시
                if (unread > 0 && page.length > unread) {
                    setFirstUnreadId(page[page.length - unread]?.id ?? null);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));

        markAsRead(room.id)
            .then(() => window.dispatchEvent(new Event(APP_EVENTS.DM_UNREAD_CHANGED)))
            .catch(() => {});
        // unreadCount는 진입 시점 값만 사용 — deps에 넣으면 markAsRead 후 0으로 갱신돼 구분선이 사라짐
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room?.id]);

    // STOMP (재)연결 시 최근 메시지 재조회 — 연결이 끊긴 사이(잠금/네트워크 blip)에
    // 도착한 메시지가 영구히 비는 문제 방지. 기존 메시지와 id로 병합/중복 제거.
    useEffect(() => {
        if (!room?.id) return;
        const roomId = room.id;
        const handler = () => {
            fetchMessages(roomId, { size: PAGE_SIZE })
                .then((res) => {
                    const page = res.data || [];
                    if (!page.length) return;
                    setMessages((prev) => {
                        const latest = new Map(page.map((m) => [m.id, m]));
                        const known = new Set(prev.map((m) => m.id));
                        const fresh = page.filter((m) => !known.has(m.id));
                        // 이미 있는 메시지는 서버 최신본으로 교체 (끊긴 사이의 읽음/수정/리액션 반영)
                        let merged = prev.map((m) => latest.get(m.id) ?? m);
                        if (!fresh.length) return merged;
                        // 내 메시지 echo dedupe와 동일 규칙 — 같은 내용의 낙관적(pending) 버블 제거
                        merged = merged.filter((m) =>
                            !(m._pending && fresh.some((f) => f.senderEmail === myEmail && f.content === m.content))
                        );
                        return [...merged, ...fresh];
                    });
                    // 끊긴 사이 도착분 읽음 처리 + 방 목록 갱신
                    markAsRead(roomId)
                        .then(() => window.dispatchEvent(new Event(APP_EVENTS.DM_UNREAD_CHANGED)))
                        .catch(() => {});
                })
                .catch(() => {});
        };
        window.addEventListener(APP_EVENTS.STOMP_CONNECTED, handler);
        return () => window.removeEventListener(APP_EVENTS.STOMP_CONNECTED, handler);
    }, [room?.id, myEmail]);

    // 위로 스크롤 시 이전 메시지 추가 로드 (스크롤 위치 보존)
    const loadOlder = useCallback(() => {
        const oldest = messages[0];
        if (!room?.id || !hasMore || loadingOlder || !oldest || typeof oldest.id !== "number") return;
        const el = messagesBoxRef.current;
        const prevHeight = el ? el.scrollHeight : 0;
        const prevTop = el ? el.scrollTop : 0;
        setLoadingOlder(true);
        fetchMessages(room.id, { before: oldest.id, size: PAGE_SIZE })
            .then((res) => {
                const older = res.data || [];
                setHasMore(older.length >= PAGE_SIZE);
                if (older.length) {
                    preserveScrollRef.current = { prevHeight, prevTop };
                    setMessages((prev) => [...older, ...prev]);
                }
            })
            .catch(() => {})
            .finally(() => setLoadingOlder(false));
    }, [room?.id, hasMore, loadingOlder, messages]);

    const handleScroll = useCallback(() => {
        const el = messagesBoxRef.current;
        if (!el) return;
        const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
        const bottom = dist < 120;
        atBottomRef.current = bottom;
        setAtBottom(bottom);
        if (bottom && newCount) setNewCount(0);
        if (el.scrollTop < 80) loadOlder();
    }, [loadOlder, newCount]);

    const scrollToBottom = useCallback(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        setNewCount(0);
    }, []);

    // 이전 메시지 prepend 후 스크롤 위치 보존 (점프 방지)
    useLayoutEffect(() => {
        if (!preserveScrollRef.current) return;
        const el = messagesBoxRef.current;
        if (el) {
            const { prevHeight, prevTop } = preserveScrollRef.current;
            el.scrollTop = prevTop + (el.scrollHeight - prevHeight);
        }
        preserveScrollRef.current = null;
    }, [messages]);

    useEffect(() => {
        // prepend(이전 로드) 직후엔 자동 하단 스크롤 건너뜀 — 위치 보존이 처리
        if (preserveScrollRef.current) return;

        // 첫 로드: 안 읽은 메시지가 있으면 구분선으로, 없으면 맨 아래로 이동
        if (!initialScrollDoneRef.current && messages.length) {
            initialScrollDoneRef.current = true;
            if (firstUnreadId) {
                const divider = document.getElementById("dm-unread-divider");
                if (divider) {
                    divider.scrollIntoView({ block: "start" });
                    atBottomRef.current = false;
                    setAtBottom(false);
                    return;
                }
            }
            bottomRef.current?.scrollIntoView();
            return;
        }

        const container = bottomRef.current?.parentElement;
        if (!container) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            return;
        }
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distanceFromBottom < 150) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, firstUnreadId]);

    useEffect(() => {
        if (profileOpen) {
            setInputFocused(false);
        }
    }, [profileOpen]);

    // 입력 중 — 타이핑 이벤트 throttle 발행 (2.5s마다)
    useEffect(() => {
        if (!room?.id || !text) return;
        const now = Date.now();
        if (now - lastTypingSentRef.current > 2500) {
            lastTypingSentRef.current = now;
            stompPublish("/app/dm.typing", { roomId: room.id, senderName: myName || "" });
        }
    }, [text, room?.id, myName]);

    const insertAtCursor = useCallback(
        (insert) => {
            const el = inputRef.current;
            if (!el) return;
            const start = el.selectionStart ?? text.length;
            const end = el.selectionEnd ?? text.length;
            const newText = text.substring(0, start) + insert + text.substring(end);
            setText(newText);

            setTimeout(() => {
                el.focus();
                el.setSelectionRange(start + insert.length, start + insert.length);
            }, 0);
        },
        [text]
    );

    const wrapSelection = useCallback(
        (marker) => {
            const el = inputRef.current;
            if (!el) return;
            const start = el.selectionStart ?? text.length;
            const end = el.selectionEnd ?? text.length;
            const selected = text.substring(start, end);
            const wrapped = selected ? `${marker}${selected}${marker}` : `${marker}${marker}`;
            const newText = text.substring(0, start) + wrapped + text.substring(end);
            setText(newText);

            setTimeout(() => {
                el.focus();
                const cursor = selected ? start + wrapped.length : start + marker.length;
                el.setSelectionRange(cursor, cursor);
            }, 0);
        },
        [text]
    );

    const sendFile = useCallback(
        async (file, content) => {
            if (!file || !room?.id) return;
            const trimmed = content?.trim() || "";
            const isImage = file.type?.startsWith("image/");

            // 이미지: 낙관적 프리뷰 버블 즉시 표시(blob) → 업로드 완료 시 실제 메시지로 치환
            if (isImage) {
                const previewUrl = URL.createObjectURL(file);
                const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const optimistic = {
                    id: tempId, roomId: room.id, senderId: myId, senderEmail: myEmail,
                    content: trimmed, sentAt: new Date().toISOString(), readAt: null,
                    fileUrl: previewUrl, fileName: file.name, fileType: file.type, fileSize: file.size,
                    _pending: true, _localPreview: previewUrl,
                    _filePayload: { file, content: trimmed },
                };
                setMessages((prev) => [...prev, optimistic]);
                setText("");
                setSending(true);
                try {
                    const formData = new FormData();
                    formData.append("file", file);
                    if (trimmed) formData.append("content", trimmed);
                    const res = await uploadDmFile(room.id, formData);
                    const real = res?.data;
                    setMessages((prev) => {
                        const without = prev.filter((m) => m.id !== tempId);
                        return real?.id && !without.some((m) => m.id === real.id) ? [...without, real] : without;
                    });
                    URL.revokeObjectURL(previewUrl);
                    window.dispatchEvent(new Event(APP_EVENTS.DM_FILE_SENT));
                } catch {
                    setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _pending: false, _failed: true } : m)));
                    window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, {
                        detail: { message: "이미지 전송에 실패했어요. 버블을 탭해 다시 시도해주세요.", severity: "error" },
                    }));
                } finally {
                    setSending(false);
                }
                return;
            }

            // 일반 파일: 업로드 완료 후 응답을 목록에 반영
            setSending(true);
            try {
                const formData = new FormData();
                formData.append("file", file);
                if (trimmed) formData.append("content", trimmed);

                const res = await uploadDmFile(room.id, formData);
                setText("");
                const real = res?.data;
                if (real?.id) {
                    setMessages((prev) => (prev.some((m) => m.id === real.id) ? prev : [...prev, real]));
                }

                window.dispatchEvent(new Event(APP_EVENTS.DM_FILE_SENT));
            } catch {
                window.dispatchEvent(
                    new CustomEvent(APP_EVENTS.APP_TOAST, {
                        detail: { message: "파일 전송에 실패했습니다.", severity: "error" },
                    })
                );
            } finally {
                setSending(false);
            }
        },
        [room?.id, myId, myEmail]
    );

    const handleSend = useCallback(async (extras = {}) => {
        const content = text.trim();
        // 첨부된 할 일 / 답장도 전송 트리거가 될 수 있음
        const linkedTodoId = extras.linkedTodoId ?? attachedTodo?.id ?? null;
        const replyToId = replyTarget && typeof replyTarget.id === "number" ? replyTarget.id : null;
        if ((!content && !linkedTodoId) || !room?.id) return;

        const tag = extras.tag ?? null;

        // 1) 낙관적 버블 즉시 추가 (echo 왕복 기다리지 않음)
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const optimistic = {
            id: tempId,
            roomId: room.id,
            senderId: myId,
            senderEmail: myEmail,
            content,
            sentAt: new Date().toISOString(),
            readAt: null,
            tag,
            linkedTodoId,
            linkedTodoTitle: attachedTodo?.title ?? null,
            linkedTodoStatus: attachedTodo?.status ?? null,
            replyToId,
            replyToSenderName: replyTarget?.senderName ?? null,
            replyToContent: replyTarget?.content ?? null,
            _pending: true,
            // 전송 실패 시 재시도에 필요한 원본 payload 보관
            _payload: { content, tag, linkedTodoId, replyToId },
        };
        setMessages((prev) => [...prev, optimistic]);
        setText("");
        setReplyTarget(null);
        setAttachedTodo(null);
        inputRef.current?.focus();

        // 2) REST 전송 → 성공 시 실 메시지로 치환, 실패 시 버블 제거 + 입력 복원
        try {
            const res = await sendDmMessage(room.id, { content, tag, linkedTodoId, replyToId });
            const real = res.data;
            setMessages((prev) => {
                const withoutTemp = prev.filter((m) => m.id !== tempId);
                return withoutTemp.some((m) => m.id === real.id) ? withoutTemp : [...withoutTemp, real];
            });
            window.dispatchEvent(new Event(APP_EVENTS.DM_UNREAD_CHANGED));
        } catch {
            // 버블을 지우지 않고 '실패' 상태로 유지 — 사용자가 탭해서 재전송
            setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _pending: false, _failed: true } : m)));
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, {
                detail: { message: "메시지 전송에 실패했어요. 버블을 탭해 다시 시도해주세요.", severity: "error" },
            }));
        }
    }, [text, room?.id, myId, myEmail, attachedTodo, replyTarget]);

    // 전송 실패한 낙관적 버블 재전송 (버블 객체를 그대로 받아 payload 사용)
    const retrySend = useCallback(async (failedMsg) => {
        if (!room?.id) return;
        const tempId = failedMsg?.id;

        // 이미지/파일 재전송
        if (failedMsg?._filePayload) {
            const { file, content } = failedMsg._filePayload;
            setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _pending: true, _failed: false } : m)));
            try {
                const formData = new FormData();
                formData.append("file", file);
                if (content) formData.append("content", content);
                const res = await uploadDmFile(room.id, formData);
                const real = res?.data;
                setMessages((prev) => {
                    const without = prev.filter((m) => m.id !== tempId);
                    return real?.id && !without.some((m) => m.id === real.id) ? [...without, real] : without;
                });
                if (failedMsg._localPreview) URL.revokeObjectURL(failedMsg._localPreview);
                window.dispatchEvent(new Event(APP_EVENTS.DM_FILE_SENT));
            } catch {
                setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _pending: false, _failed: true } : m)));
                window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, {
                    detail: { message: "다시 전송에 실패했어요. 잠시 후 시도해주세요.", severity: "error" },
                }));
            }
            return;
        }

        if (!failedMsg?._payload) return;
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _pending: true, _failed: false } : m)));
        const { content, tag, linkedTodoId, replyToId } = failedMsg._payload;
        try {
            const res = await sendDmMessage(room.id, { content, tag, linkedTodoId, replyToId });
            const real = res.data;
            setMessages((prev) => {
                const without = prev.filter((m) => m.id !== tempId);
                return without.some((m) => m.id === real.id) ? without : [...without, real];
            });
            window.dispatchEvent(new Event(APP_EVENTS.DM_UNREAD_CHANGED));
        } catch {
            setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _pending: false, _failed: true } : m)));
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, {
                detail: { message: "다시 전송에 실패했어요. 잠시 후 시도해주세요.", severity: "error" },
            }));
        }
    }, [room?.id]);

    // 대화 내 검색
    const runSearch = useCallback(async (q) => {
        if (!room?.id) return;
        const query = (q || "").trim();
        if (!query) { setSearchResults([]); return; }
        setSearchLoading(true);
        try {
            const res = await searchDmMessages(room.id, query);
            setSearchResults(res.data || []);
        } catch {
            // 실패를 삼키면 "결과가 없어요"로 보여서 검색이 정상 동작한 것처럼 오해한다
            setSearchResults([]);
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, {
                detail: { message: "메시지 검색에 실패했어요. 잠시 후 다시 시도해 주세요.", severity: "error" },
            }));
        } finally {
            setSearchLoading(false);
        }
    }, [room?.id]);

    // 검색 결과 → 메시지로 점프(로드돼 있으면 스크롤+하이라이트)
    const jumpToMessage = useCallback((messageId) => {
        setSearchOpen(false);
        const el = document.getElementById(`dm-msg-${messageId}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            setHighlightId(messageId);
            setTimeout(() => setHighlightId(null), 1800);
        } else {
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, {
                detail: { message: "이전 메시지예요. 위로 스크롤해 불러온 뒤 다시 검색해 주세요.", severity: "info" },
            }));
        }
    }, []);

    const editMessage = useCallback(async (messageId, newContent) => {
        if (!room?.id) return;
        try {
            const res = await updateDmMessage(room.id, messageId, newContent);
            const updated = res.data;
            if (updated?.id) {
                setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            }
            // 마지막 메시지를 수정한 경우 방 목록 미리보기 갱신
            window.dispatchEvent(new Event(APP_EVENTS.DM_UNREAD_CHANGED));
        } catch {
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, {
                detail: { message: "메시지 수정에 실패했습니다.", severity: "error" },
            }));
        }
    }, [room?.id]);

    const reactToMessage = useCallback(async (messageId, emoji) => {
        if (!room?.id || !emoji) return;
        try {
            const res = await toggleDmReaction(room.id, messageId, emoji);
            const updated = res.data;
            if (updated?.id) {
                setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            }
        } catch {
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, {
                detail: { message: "이모지 추가에 실패했습니다.", severity: "error" },
            }));
        }
    }, [room?.id]);

    // 메시지를 공지로 등록/해제 (tag NOTICE 토글)
    const pinNotice = useCallback(async (message) => {
        if (!room?.id || !message?.id) return;
        const pinned = message.tag !== "NOTICE"; // 현재 공지가 아니면 등록, 공지면 해제
        try {
            const res = await setDmNotice(room.id, message.id, pinned);
            const updated = res.data;
            if (updated?.id) {
                setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            }
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, {
                detail: { message: pinned ? "공지로 등록했어요." : "공지를 해제했어요.", severity: "success" },
            }));
        } catch {
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, {
                detail: { message: "공지 설정에 실패했습니다.", severity: "error" },
            }));
        }
    }, [room?.id]);

    const deleteMessage = useCallback(
        async (messageId) => {
            if (!room?.id) return;
            setMessages((prev) => prev.filter((m) => m.id !== messageId));
            try {
                await deleteDmMessage(room.id, messageId);
                window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, {
                    detail: { message: "메시지가 삭제되었습니다.", severity: "success" },
                }));
                // 마지막 메시지를 삭제한 경우 방 목록 미리보기 갱신
                window.dispatchEvent(new Event(APP_EVENTS.DM_UNREAD_CHANGED));
            } catch {
                window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, {
                    detail: { message: "메시지 삭제에 실패했습니다.", severity: "error" },
                }));
                fetchMessages(room.id)
                    .then((res) => setMessages(res.data))
                    .catch(() => {});
            }
        },
        [room?.id]
    );

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                // IME(한국어/일본어 등) 조합 중 Enter는 무시 — 미완성 글자가 두 번 전송되는 문제 방지
                if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend]
    );

    const openInput = useCallback(() => {
        setProfileOpen(false);
        setInputFocused(true);
        setTimeout(() => inputRef.current?.focus(), 50);
    }, []);


    const groups = buildGroups(messages, myEmail);
    const lastReadIdx = groups.reduce(
        (acc, g, i) => ((g.isMe && g.msg.readAt) ? i : acc),
        -1
    );

    // 타이핑 라벨 — 1명: "OO 님이 입력 중…", 2명: "OO, XX …", 3+: "OO 외 N명 입력 중…"
    const typingNames = Object.values(typingUsers);
    const typingName = typingNames.length === 0
        ? null
        : typingNames.length === 1
            ? `${typingNames[0]} 님이 입력 중…`
            : typingNames.length === 2
                ? `${typingNames[0]}, ${typingNames[1]} 님이 입력 중…`
                : `${typingNames[0]} 외 ${typingNames.length - 1}명 입력 중…`;

    // 상대가 입력 시작하면 입력중 인디케이터가 입력바에 가려 반만 보이던 문제 →
    // 사용자가 하단 근처일 때만 살짝 스크롤해 인디케이터가 보이도록. (히스토리 보는 중이면 끌어내리지 않음)
    useEffect(() => {
        if (!typingName || !atBottomRef.current) return;
        const id = setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }, 60);
        return () => clearTimeout(id);
    }, [typingName]);

    return {
        messages,
        loading,
        hasMore,
        loadingOlder,
        onScroll: handleScroll,
        typingName,
        highlightId,
        // 안 읽음 구분선 / 맨 아래로 버튼 / 전송 실패 재시도
        firstUnreadId,
        atBottom,
        newCount,
        scrollToBottom,
        retrySend,
        // 답장 / 할 일 첨부 / 검색
        replyTarget,
        setReplyTarget,
        attachedTodo,
        setAttachedTodo,
        searchOpen,
        setSearchOpen,
        searchResults,
        searchLoading,
        runSearch,
        jumpToMessage,
        text,
        setText,
        sending,
        inputFocused,
        setInputFocused,
        profileOpen,
        setProfileOpen,
        emojiOpen,
        setEmojiOpen,
        kbOffset,
        bottomRef,
        inputRef,
        messagesBoxRef,
        handleKeyDown,
        handleSend,
        openInput,
        insertAtCursor,
        wrapSelection,
        sendFile,
        groups,
        lastReadIdx,
        previewOpen,
        previewFile,
        previewFiles,
        previewIndex,
        openPreview,
        closePreview,
        handlePrevPreview,
        handleNextPreview,
        deleteMessage,
        editMessage,
        reactToMessage,
        pinNotice,
    };
}