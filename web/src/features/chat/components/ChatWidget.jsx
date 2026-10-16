import { useState, useRef, useEffect, useCallback } from "react";
import { hideScrollbarSx } from "../../../shared/ui/glassSx.js";
import {
    Box,
    Dialog,
    Drawer,
    IconButton,
    Stack,
    Typography,
    useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import OpenInFullRoundedIcon from "@mui/icons-material/OpenInFullRounded";
import CloseFullscreenRoundedIcon from "@mui/icons-material/CloseFullscreenRounded";
import MicNoneRoundedIcon from "@mui/icons-material/MicNoneRounded";
import AlarmRoundedIcon from "@mui/icons-material/AlarmRounded";

import { useKeyboardOffset } from "../../../shared/hooks/useKeyboardOffset.js";
import { isNative } from "../../../shared/utils/platformUtils.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { fetchAllUsers } from "../../../shared/api/userApi.js";
import { getUser } from "../../../shared/utils/tokenUtils.js";
import { isGuestEmail } from "../../../shared/utils/guestUtils.js";
import {
    listConversations,
    saveConversation,
    removeConversation,
    newConversationId,
    relativeTime,
    groupByDate,
} from "../chatHistory.js";
import { addTodo, getTodoById, deleteTodo } from "../../todo/api/todoApi.js";
import { setTodoTags } from "../../todo/api/tagApi.js";
import { callChat, fetchAgents, fetchUsage } from "../api/chatApi.js";
import Sheet from "../../../shared/ui/primitives/Sheet.jsx";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { Z } from "../../../shared/ui/zIndex.js";

import ChatParsedCard from "./ChatParsedCard.jsx";
import ChatSteps from "./ChatSteps.jsx";
import AgentEditDialog from "./AgentEditDialog.jsx";
import ScheduleDialog from "./ScheduleDialog.jsx";
import { TaskResultCard } from "./ChatResultCards.jsx";
import { Toast } from "./ChatTaskRow.jsx";
import TodoDetailModal from "../../todo/components/detail/TodoDetailModal.jsx";

// ── 로직 헬퍼 ─────────────────────────────────────────────────────────────

const CRUD_TYPES = ["TASK_CREATED", "TASK_LISTED", "TASK_UPDATED", "TASK_DELETED"];

// Capacitor 네이티브(iOS/Android WebView)에서는 webkitSpeechRecognition 객체가
// 노출되더라도 실제 .start() 가 동작하지 않아 Apple 리뷰에서 "unresponsive" 판정.
// 네이티브에서는 무조건 숨기고, 웹에서는 객체 존재 여부로만 판단.
const SPEECH_RECOGNITION_SUPPORTED =
    !isNative &&
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

function detectActionType(actions = []) {
    return actions.find((a) => CRUD_TYPES.includes(a.type))?.type ?? null;
}

function extractTasks(actions = []) {
    const collected = [];
    for (const action of actions) {
        if (action.type === "TASK_LISTED") return action.payload?.tasks ?? [];
        // 다건 생성이면 TASK_CREATED 액션이 여러 개 온다 — 전부 수집
        if ((action.type === "TASK_CREATED" || action.type === "TASK_UPDATED") && action.payload?.task) {
            collected.push(action.payload.task);
        }
    }
    return collected;
}

/** ChatTask → 편집 초안(parsed). 다건 생성 시 항목별로 호출. */
function buildParsedDraft(task, userMap = {}) {
    const assigneeEmails = task.assigneeId
        ? task.assigneeId.split(",").map((e) => e.trim()).filter(Boolean)
        : [];
    return {
        _actionType: "TASK_CREATED",
        title: task.title || "",
        description: task.description || "",
        priority: (task.priority || "MEDIUM").toLowerCase(),
        startAt: task.startAt || "",
        dueDate: task.dueDate || new Date().toISOString().slice(0, 10),
        startTime: task.startTime || "",
        endTime: task.endTime || "",
        allDay: !task.startTime,
        assignees: assigneeEmails.map((email) => userMap[email] ?? (email.includes("@") ? email.split("@")[0] : email)),
        assigneeEmails,
        category: "할 일",
        place: task.locationName || "",
        locationName: task.locationName || null,
        locationAddress: task.locationAddress || null,
        locationLat: task.locationLat ?? null,
        locationLng: task.locationLng ?? null,
        projectId: task.projectId && !Number.isNaN(Number(task.projectId)) ? Number(task.projectId) : null,
        tags: Array.isArray(task.tags) ? task.tags : [],
        _status: task.status || "TODO",
    };
}

function normalizeTask(task, userMap = {}) {
    return {
        ...task,
        numericId: task.id ? parseInt(task.id.replace("T-", ""), 10) || null : null,
        assignees: task.assigneeId
            ? task.assigneeId.split(",").map((e) => {
                const email = e.trim();
                return userMap[email] ?? (email.includes("@") ? email.split("@")[0] : email);
            }).filter(Boolean)
            : [],
    };
}

function extractContext(actions = [], prevContext = {}) {
    const needMore = actions.find((a) => a.type === "NEED_MORE_INFO");
    if (needMore) {
        return {
            lastTaskId: prevContext.lastTaskId,
            lastSearchIds: prevContext.lastSearchIds,
            pendingAction: needMore.payload.pendingAction,
            pendingMissingFields: needMore.payload.missingFields,
            pendingArgs: needMore.payload.pendingArgs,
        };
    }
    const listedAction = actions.find((a) => a.type === "TASK_LISTED");
    if (listedAction) {
        const ids = (listedAction.payload?.tasks ?? []).map((t) => t.id).filter(Boolean);
        return { lastTaskId: prevContext.lastTaskId, lastSearchIds: ids };
    }
    const taskAction = actions.find(
        (a) => (a.type === "TASK_CREATED" || a.type === "TASK_UPDATED") && a.payload?.task?.id
    );
    if (taskAction) return { lastTaskId: taskAction.payload.task.id, lastSearchIds: prevContext.lastSearchIds };
    return { lastTaskId: prevContext.lastTaskId, lastSearchIds: prevContext.lastSearchIds };
}

const PENDING_LABELS = {
    create_task: "일정 생성",
    update_task: "일정 수정",
    delete_task: "일정 삭제",
    search_tasks: "일정 조회",
};

/**
 * 목적별 예시. 예전에는 한 줄로 4개를 나열했는데 그중 셋이 "추가"라, **조회·수정도 된다는 걸
 * 아무도 몰랐다.** 실제로 서버는 search_tasks / update_task / delete_task 를 모두 처리한다.
 * 탭으로 나누면 "무엇까지 되는가"가 목록 자체로 드러난다.
 */
const EXAMPLE_TABS = [
    {
        id: "create",
        label: "추가",
        hint: "말하듯 적으면 마감·우선순위까지 알아서 채워요",
        items: [
            "다음주 금요일까지 보고서 초안 작성 급하게",
            "내일까지 재고 현황 작성 후 공유",
            "이번주 토요일 오전에 팀 미팅 일정 잡기",
            "매주 월요일 아침 주간 회의 준비",
        ],
    },
    {
        id: "search",
        label: "조회",
        hint: "쌓인 할 일에서 지금 필요한 것만 골라줘요",
        items: [
            "오늘 마감 임박 작업 알려줘",
            "이번주에 아직 시작 안 한 일 뭐야?",
            "내가 담당인 할 일만 보여줘",
            "지난 마감 지난 것들 정리해줘",
        ],
    },
    {
        id: "edit",
        label: "정리",
        hint: "옮기고 바꾸는 것도 한 문장으로",
        items: [
            "보고서 초안 마감을 다음주 월요일로 미뤄줘",
            "재고 현황 작업 완료 처리해줘",
            "제품 리뉴얼 프로젝트 할 일 우선순위 높게",
            "오늘 끝낸 일들 보관함으로 옮겨줘",
        ],
    },
];

/**
 * 서버에 실어 보낼 최근 대화.
 *
 * 로딩 중인 말풍선과 빈 답변은 뺀다 — 맥락에 보탬이 없으면서 토큰만 쓴다.
 * 서버도 상한을 두지만 보내는 쪽에서 먼저 줄이는 게 맞다(요청 크기가 대화 길이에 비례하면
 * 긴 대화에서 느려진다).
 */
const HISTORY_TURNS = 8;
function recentHistory(messages) {
    return messages
        .filter((m) => !m.loading && typeof m.text === "string" && m.text.trim())
        .slice(-HISTORY_TURNS)
        .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", text: m.text }));
}

// ── ChatWidget ─────────────────────────────────────────────────────────────

export default function ChatWidget({ open = true, onClose }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const kbOffset = useKeyboardOffset();
    const { currentWorkspace } = useWorkspace();

    const textareaRef = useRef(null);
    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);

    const [messages, setMessages] = useState([]);
    /* 전송 콜백이 useCallback 으로 묶여 있어서 messages 를 그대로 읽으면 **낡은 대화**를
       보낸다(의존성에 넣으면 대화가 한 줄 늘 때마다 콜백이 새로 만들어진다).
       ref 로 최신값을 따로 들고 간다. */
    const messagesRef = useRef([]);
    messagesRef.current = messages;
    const [input, setInput] = useState("");
    // 빈 상태 예시 탭 — 기본은 "추가"(가장 흔한 용도)
    const [exampleTab, setExampleTab] = useState(EXAMPLE_TABS[0].id);
    // 전체화면 모드 — 답변 카드(할 일 목록)가 460px 패널에서 눌려 보여서 넓게 볼 수단이 필요하다
    const [fullscreen, setFullscreen] = useState(false);
    // 역할(에이전트). 목록은 서버에서 받는다 — 화면에 하드코딩하면 서버와 조용히 어긋난다.
    const [agents, setAgents] = useState([]);
    const [agentId, setAgentId] = useState("default");
    const [usage, setUsage] = useState(null);
    const [agentDialog, setAgentDialog] = useState(null);   // null=닫힘, {}=새로, {…}=수정
    const [agentsVersion, setAgentsVersion] = useState(0);
    const [scheduleOpen, setScheduleOpen] = useState(false);
    // 대화 기록(브라우저 저장). 이게 없으면 왼쪽 목록이 빈 껍데기가 된다.
    const [convId, setConvId] = useState(() => newConversationId());
    const [history, setHistory] = useState(() => listConversations());
    const [chatContext, setChatContext] = useState({});
    const [users, setUsers] = useState([]);
    const [userMap, setUserMap] = useState({});
    const [toast, setToast] = useState(null);
    const [focused, setFocused] = useState(false);
    const [detailTodo, setDetailTodo] = useState(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const activeExampleTab =
        EXAMPLE_TABS.find((t) => t.id === exampleTab) ?? EXAMPLE_TABS[0];

    useEffect(() => {
        if (!open) return;
        let alive = true;
        fetchAgents().then((list) => { if (alive) setAgents(list); });
        fetchUsage().then((u) => { if (alive) setUsage(u); });
        return () => { alive = false; };
    }, [open, agentsVersion]);

    /** 역할을 만들거나 지운 뒤 목록을 다시 불러온다 — 안 하면 방금 만든 게 안 보인다. */
    const reloadAgents = useCallback(() => setAgentsVersion((v) => v + 1), []);

    const activeAgent = agents.find((a) => a.id === agentId) ?? null;
    // 인사말용 이름. 없으면 인사 줄 자체를 그리지 않는다(빈 "님, 안녕하세요"를 피한다).
    const me = getUser();
    const displayName = me?.name?.trim() || "";
    const isGuest = isGuestEmail(me?.email);

    /**
     * 대화가 바뀔 때마다 저장.
     *
     * **불러오기 직후에는 저장하지 않는다.** saveConversation 은 updatedAt 을 갱신해 그 대화를
     * 목록 맨 위로 올리는데, 불러올 때도 저장이 돌면 무엇을 눌러도 즉시 맨 위로 튀어 올라
     * "항상 첫 항목만 선택된다"처럼 보인다(실제로 그렇게 보고받았다).
     */
    const skipSaveRef = useRef(false);
    useEffect(() => {
        if (skipSaveRef.current) {
            skipSaveRef.current = false;
            return;
        }
        if (messages.length === 0) return;
        setHistory(saveConversation(convId, messages));
    }, [messages, convId]);

    /** 새 대화 — 지금 대화는 이미 저장돼 있으므로 비우기만 하면 된다. */
    const startNewConversation = useCallback(() => {
        setMessages([]);
        setChatContext({});
        setInput("");
        setConvId(newConversationId());
    }, []);

    /** 저장된 대화 불러오기. 진행 중이던 문맥(pendingAction 등)은 되살리지 않는다 —
        서버 쪽 대화 상태가 이미 지나갔을 수 있어, 살리면 엉뚱한 확인 질문이 뜬다. */
    const loadConversation = useCallback((conv) => {
        skipSaveRef.current = true;   // 순서를 흔들지 않는다 (위 주석 참고)
        setMessages(conv.messages || []);
        setChatContext({});
        setInput("");
        setConvId(conv.id);
    }, []);

    const deleteConversation = useCallback((id, e) => {
        e?.stopPropagation();
        setHistory(removeConversation(id));
        // 지금 보고 있던 대화를 지웠으면 화면도 비운다 — 목록에 없는 대화가 열려 있으면 혼란스럽다
        setConvId((cur) => {
            if (cur !== id) return cur;
            setMessages([]);
            setChatContext({});
            return newConversationId();
        });
    }, []);
    const [isListening, setIsListening] = useState(false);

    const isLoading = messages.length > 0 && messages[messages.length - 1]?.loading === true;

    // 워크스페이스 전환 시 대화 초기화
    useEffect(() => {
        if (!currentWorkspace?.workspaceId) return;
        setMessages([]);
        setChatContext({});
        setInput("");
    }, [currentWorkspace?.workspaceId]);

    // 새 메시지마다 맨 아래로 스크롤
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // 유저 목록
    useEffect(() => {
        if (!currentWorkspace?.workspaceId) return;
        fetchAllUsers()
            .then((res) => {
                const list = res.data ?? [];
                setUsers(list);
                const map = {};
                list.forEach((u) => { if (u.email) map[u.email] = u.name ?? u.email; });
                setUserMap(map);
            })
            .catch(() => {});
    }, [currentWorkspace?.workspaceId]);

    // textarea 자동 높이
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
        }
    }, [input]);

    // ── 공통 응답 처리 ────────────────────────────────────────────────────────

    const processResponse = useCallback((res) => {
        const { assistantMessage, actions = [], steps = null, usage: nextUsage = null } = res.data;
        if (nextUsage) setUsage(nextUsage);
        setChatContext((prev) => extractContext(actions, prev));

        const actionType = detectActionType(actions);
        const taskList = extractTasks(actions);
        let parsed = null;

        let parsedList = null;

        if (actionType === "TASK_CREATED" && taskList.length > 0) {
            // 다건 생성이면 항목별 편집 초안 배열, 단건이면 기존처럼 parsed 하나
            if (taskList.length > 1) {
                parsedList = taskList.map((tk) => buildParsedDraft(tk, userMap));
            } else {
                parsed = buildParsedDraft(taskList[0], userMap);
            }
        } else if ((actionType === "TASK_LISTED" || actionType === "TASK_UPDATED") && taskList.length > 0) {
            parsed = {
                _actionType: actionType,
                _tasks: taskList.map((tk) => normalizeTask(tk, userMap)),
            };
        }

        return { text: assistantMessage || "", parsed, parsedList, steps };
    }, [userMap]);

    // ── 핸들러 ────────────────────────────────────────────────────────────────

    const dismissCard = useCallback((msgId) => {
        setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, parsed: null } : m));
    }, []);

    // 다건 생성 카드 중 하나만 닫기(확정/편집)
    const dismissCardItem = useCallback((msgId, itemIdx) => {
        setMessages((prev) => prev.map((m) => {
            if (m.id !== msgId || !Array.isArray(m.parsedList)) return m;
            const next = m.parsedList.slice();
            next[itemIdx] = null;
            return { ...m, parsedList: next };
        }));
    }, []);

    const handleSubmit = useCallback(async () => {
        const text = input.trim();
        if (!text || isLoading) return;

        const userMsgId = Date.now();
        const asstMsgId = userMsgId + 1;
        setMessages((prev) => [
            ...prev,
            { id: userMsgId, role: "user", text },
            { id: asstMsgId, role: "assistant", loading: true },
        ]);
        setInput("");

        try {
            const res = await callChat(text, chatContext, agentId, recentHistory(messagesRef.current));
            const { text: respText, parsed, parsedList, steps } = processResponse(res);
            setMessages((prev) => prev.map((m) =>
                m.id === asstMsgId ? { ...m, loading: false, text: respText, parsed, parsedList, steps } : m
            ));
        } catch {
            setMessages((prev) => prev.map((m) =>
                m.id === asstMsgId
                    ? { ...m, loading: false, text: "요청 처리 중 오류가 발생했어요. 다시 시도해주세요.", parsed: null }
                    : m
            ));
        }
    }, [input, isLoading, chatContext, processResponse, agentId]);

    const handleRetry = useCallback(async (msgId) => {
        if (isLoading) return;
        const idx = messages.findIndex((m) => m.id === msgId);
        if (idx < 1) return;
        const userMsg = messages[idx - 1];
        if (!userMsg || userMsg.role !== "user") return;

        // 해당 응답만 제자리에서 로딩 상태로 교체 — 이후 대화는 그대로 보존
        setMessages((prev) => prev.map((m) =>
            m.id === msgId ? { id: msgId, role: "assistant", loading: true } : m
        ));

        try {
            const res = await callChat(userMsg.text, chatContext, agentId, recentHistory(messagesRef.current));
            const { text: respText, parsed, parsedList, steps } = processResponse(res);
            setMessages((prev) => prev.map((m) =>
                m.id === msgId ? { ...m, loading: false, text: respText, parsed, parsedList, steps } : m
            ));
        } catch {
            setMessages((prev) => prev.map((m) =>
                m.id === msgId
                    ? { ...m, loading: false, text: "요청 처리 중 오류가 발생했어요.", parsed: null }
                    : m
            ));
        }
    }, [messages, isLoading, chatContext, processResponse, agentId]);

    const handleConfirm = useCallback(async (task, msgId, itemIdx) => {
        const priorityMap = { high: "HIGH", medium: "MEDIUM", low: "LOW" };
        try {
            const { data } = await addTodo({
                title: task.title,
                content: task.description || "",
                priority: priorityMap[task.priority] ?? task.priority.toUpperCase(),
                status: task._status || "TODO",
                startAt: task.startAt || null,
                dueDate: task.dueDate || null,
                startTime: task.startTime || null,
                endTime: task.endTime || null,
                assignees: task.assigneeEmails || [],
                projectId: task.projectId ?? null,
                locationName: task.locationName || null,
                locationAddress: task.locationAddress || null,
                locationLat: task.locationLat ?? null,
                locationLng: task.locationLng ?? null,
            });
            // AI 인식 태그 부착(서버가 실존 태그로 매핑한 것만)
            if (data?.id != null && Array.isArray(task.tags) && task.tags.length > 0) {
                try { await setTodoTags(data.id, task.tags.map((t) => t.id)); } catch { /* ignore */ }
            }
            window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_ADDED, { detail: data }));
            window.dispatchEvent(new Event(APP_EVENTS.NOTIFICATIONS_CHANGED));
            setToast({ title: task.title });
            // 성공했을 때만 카드 닫기 — 실패 시 카드를 남겨 그대로 재시도할 수 있게
            if (itemIdx != null) dismissCardItem(msgId, itemIdx);
            else dismissCard(msgId);
        } catch (e) {
            console.error("태스크 추가 실패", e);
            setToast({ title: task.title, error: true });
        }
    }, [dismissCard, dismissCardItem]);

    const handleOpenTask = useCallback(async (task) => {
        if (!task.numericId) return;
        try {
            const res = await getTodoById(task.numericId);
            setDetailTodo(res.data);
            setDetailModalOpen(true);
        } catch (e) {
            console.error("todo 상세 불러오기 실패", e);
        }
    }, []);

    const handleDetailClose = useCallback(() => { setDetailModalOpen(false); setDetailTodo(null); }, []);
    const handleDetailDelete = useCallback(async (id) => {
        await deleteTodo(id);
        setDetailModalOpen(false);
        setDetailTodo(null);
    }, []);
    const handleDetailPatchLocal = useCallback((patch) => {
        setDetailTodo((prev) => prev ? { ...prev, ...patch } : prev);
    }, []);

    const inputRef = useRef(input);
    inputRef.current = input;

    const handleMicToggle = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;
        if (isListening) { recognitionRef.current?.stop(); return; }
        const rec = new SR();
        rec.lang = "ko-KR"; rec.interimResults = true; rec.continuous = false;
        recognitionRef.current = rec;
        const base = inputRef.current;
        rec.onresult = (e) => {
            setInput(base + Array.from(e.results).map((r) => r[0].transcript).join(""));
        };
        rec.onend = () => setIsListening(false);
        rec.onerror = () => setIsListening(false);
        rec.start();
        setIsListening(true);
    }, [isListening]);

    const handleExample = (ex) => { setInput(ex); textareaRef.current?.focus(); };

    const cancelPending = () => setChatContext((prev) => {
        const next = { ...prev };
        delete next.pendingAction; delete next.pendingMissingFields; delete next.pendingArgs;
        return next;
    });

    // ── 렌더 ──────────────────────────────────────────────────────────────────

    /* 헤더: AI 로고(navbar와 동일 AutoAwesomeRoundedIcon) + 타이틀 + (대화 초기화) + 닫기 */
    const header = (
        <Box
            sx={{
                bgcolor: "background.paper",
                borderBottom: 1,
                borderColor: "divider",
                px: 2.25,
                py: 1.25,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
            }}
        >
            {/* 전체화면에서는 사이드바가 브랜드를 갖는다 — 같은 로고·이름을 두 번 쓰면 헤더만 붐빈다.
                왼쪽을 통째로 비우되 빈 Box 를 둬서 오른쪽 액션이 space-between 으로 밀려나게 한다. */}
            {fullscreen ? <Box /> : (
                <Stack direction="row" alignItems="center" spacing={1.25}>
                    <Box
                        sx={{
                            width: 32,
                            height: 32,
                            borderRadius: 1.5,
                            background: "var(--plando-ai-grad)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                        }}
                    >
                        <AutoAwesomeRoundedIcon sx={{ fontSize: 18 }} />
                    </Box>
                    <Typography sx={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.4px" }}>
                        AI 어시스턴트
                    </Typography>
                    {/* 패널 모드엔 사이드바가 없어 어떤 역할인지 알 방법이 없다.
                        기본 역할일 때는 굳이 보여주지 않는다(대부분의 경우 잡음이 된다). */}
                    {activeAgent && activeAgent.id !== "default" && (
                        <Box
                            sx={{
                                px: 0.875, py: 0.125, borderRadius: 999,
                                fontSize: 11.5, fontWeight: 700, lineHeight: 1.7,
                                bgcolor: (t) => alpha(t.palette.primary.main, 0.10),
                                color: "primary.main",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {activeAgent.emoji} {activeAgent.name}
                        </Box>
                    )}
                </Stack>
            )}
            <Stack direction="row" spacing={0.75} alignItems="center">
                {/* 예약 — 패널(Drawer) 모드에는 역할 사이드바가 없어서, 사이드바에만 두면
                    **넓게 보기를 누르기 전에는 예약에 닿을 길이 없다.** 기본으로 열리는 쪽이
                    패널이라 사실상 기능이 숨겨진 셈이었다. 헤더에 두면 두 모드 모두에서 보인다
                    (앱도 헤더 아이콘으로 같은 자리에 있다). */}
                <IconButton
                    onClick={() => setScheduleOpen(true)}
                    aria-label="예약"
                    title="정해둔 시각에 역할이 알아서 돌아요"
                    size="small"
                    sx={{
                        width: 34,
                        height: 34,
                        bgcolor: "var(--plando-input-bg)",
                        color: "text.secondary",
                        "&:hover": { bgcolor: "var(--plando-input-bg-hover)" },
                    }}
                >
                    <AlarmRoundedIcon sx={{ fontSize: 17 }} />
                </IconButton>
                {!isMobile && (
                    <IconButton
                        onClick={() => setFullscreen((v) => !v)}
                        aria-label={fullscreen ? "패널로 보기" : "넓게 보기"}
                        title={fullscreen ? "패널로 보기" : "넓게 보기"}
                        size="small"
                        sx={{
                            width: 34,
                            height: 34,
                            bgcolor: "var(--plando-input-bg)",
                            color: "text.secondary",
                            "&:hover": { bgcolor: "var(--plando-input-bg-hover)" },
                        }}
                    >
                        {fullscreen
                            ? <CloseFullscreenRoundedIcon sx={{ fontSize: 16 }} />
                            : <OpenInFullRoundedIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                )}
                {messages.length > 0 && (
                    <IconButton
                        onClick={startNewConversation}
                        aria-label="새 대화"
                        size="small"
                        sx={{
                            width: 34,
                            height: 34,
                            bgcolor: "var(--plando-input-bg)",
                            color: "text.secondary",
                            "&:hover": { bgcolor: "var(--plando-input-bg-hover)" },
                        }}
                    >
                        <RefreshRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                )}
                <IconButton
                    onClick={onClose}
                    aria-label="닫기"
                    size="small"
                    sx={{
                        width: 34,
                        height: 34,
                        bgcolor: "var(--plando-input-bg)",
                        color: "text.secondary",
                        "&:hover": { bgcolor: "var(--plando-input-bg-hover)" },
                    }}
                >
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Stack>
        </Box>
    );

    /* 본문 메시지 영역 + 초기 hero */
    /**
     * 전체화면 좌측 패널 — 다우오피스의 AI 사이드바를 참고했다.
     * 다만 거기 있는 "에이전트 / 새 폴더"는 만들지 않았다. 대응하는 기능이 없어서
     * 눌러도 아무 일이 없는 항목이 되고, 그건 화면을 고장난 것처럼 보이게 한다.
     */
    const sidebar = (
        <Box
            sx={{
                width: 264,
                flex: "none",
                borderRight: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
            }}
        >
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2, pt: 2, pb: 1.5 }}>
                <Box
                    sx={{
                        width: 28, height: 28, borderRadius: 1.5,
                        background: "var(--plando-ai-grad)",
                        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                    }}
                >
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />
                </Box>
                <Typography sx={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.3px" }}>
                    AI 어시스턴트
                </Typography>
            </Stack>

            <Box sx={{ px: 1.5, pb: 0.5 }}>
                <Press
                    onClick={startNewConversation}
                    haptic="light"
                    pressScale={0.98}
                    activeBg={theme.palette.action.hover}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 12,
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                        color: theme.palette.primary.main,
                        fontSize: 14,
                        fontWeight: 700,
                    }}
                >
                    <AddRoundedIcon sx={{ fontSize: 18 }} />
                    새 대화
                </Press>
            </Box>

            {/* 역할 선택 — "무엇까지 건드릴 수 있느냐"가 사용자에게 가장 중요한 구분이다.
                읽기 전용 역할은 그렇다고 알려주면 마음 놓고 써볼 수 있다. */}
            {agents.length > 1 && (
                <Box sx={{ px: 1.5, pb: 1.25 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 0.5, pb: 0.625 }}>
                        <Typography
                            sx={{
                                fontSize: 11, fontWeight: 700, letterSpacing: "0.6px",
                                color: "text.disabled", textTransform: "uppercase",
                            }}
                        >
                            역할
                        </Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            {/* 예약 — 역할을 시간에 걸어둔다. 역할 옆에 두어야 "역할로 무엇을
                                할 수 있는가" 의 연장으로 읽힌다. */}
                            <Press
                                onClick={() => setScheduleOpen(true)}
                                haptic="light"
                                pressScale={0.95}
                                activeBg={theme.palette.action.hover}
                                style={{
                                    padding: "1px 7px", borderRadius: 999,
                                    fontSize: 11, fontWeight: 700,
                                    color: theme.palette.text.secondary,
                                    backgroundColor: theme.palette.action.hover,
                                }}
                            >
                                예약
                            </Press>
                            <Press
                                onClick={() => setAgentDialog({})}
                                haptic="light"
                                pressScale={0.95}
                                activeBg={theme.palette.action.hover}
                                style={{
                                    padding: "1px 7px", borderRadius: 999,
                                    fontSize: 11, fontWeight: 700,
                                    color: theme.palette.primary.main,
                                    backgroundColor: alpha(theme.palette.primary.main, 0.10),
                                }}
                            >
                                + 만들기
                            </Press>
                        </Stack>
                    </Stack>
                    <Stack spacing={0.25}>
                        {agents.map((a) => {
                            const active = a.id === agentId;
                            return (
                                <Press
                                    key={a.id}
                                    onClick={() => setAgentId(a.id)}
                                    haptic="light"
                                    pressScale={0.99}
                                    activeBg={theme.palette.action.hover}
                                    style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: 8,
                                        padding: "8px 10px",
                                        borderRadius: 10,
                                        textAlign: "left",
                                        backgroundColor: active
                                            ? alpha(theme.palette.primary.main, 0.10)
                                            : "transparent",
                                    }}
                                >
                                    <span style={{ fontSize: 15, lineHeight: "18px", flex: "none" }}>{a.emoji}</span>
                                    <span style={{ minWidth: 0, flex: 1 }}>
                                        <span
                                            style={{
                                                display: "flex", alignItems: "center", gap: 5,
                                                fontSize: 13,
                                                fontWeight: active ? 700 : 600,
                                                color: active ? theme.palette.primary.main : theme.palette.text.primary,
                                            }}
                                        >
                                            {a.name}
                                            {a.readOnly && (
                                                <span
                                                    style={{
                                                        padding: "0 5px",
                                                        borderRadius: 999,
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        lineHeight: "15px",
                                                        backgroundColor: alpha(theme.palette.success.main, 0.16),
                                                        color: theme.palette.success.dark,
                                                    }}
                                                >
                                                    읽기 전용
                                                </span>
                                            )}
                                        </span>
                                        <span
                                            style={{
                                                display: "block",
                                                marginTop: 2,
                                                fontSize: 11.5,
                                                lineHeight: 1.45,
                                                color: theme.palette.text.disabled,
                                            }}
                                        >
                                            {a.description}
                                        </span>
                                    </span>
                                    {/* 사용자 정의만 편집할 수 있다. 내장에 버튼을 두면 눌러도
                                        아무 일이 없어 고장으로 보인다. */}
                                    {a.custom && (
                                        <Box
                                            component="span"
                                            onClick={(e) => { e.stopPropagation(); setAgentDialog(a); }}
                                            sx={{
                                                flex: "none", alignSelf: "center",
                                                px: 0.75, py: 0.125, borderRadius: 1,
                                                fontSize: 11, color: "text.disabled",
                                                "&:hover": { color: "primary.main", bgcolor: "action.hover" },
                                            }}
                                        >
                                            수정
                                        </Box>
                                    )}
                                </Press>
                            );
                        })}
                    </Stack>
                </Box>
            )}

            <Box className="cw-scroll" sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1, pb: 1.5 }}>
                {history.length === 0 ? (
                    <Typography sx={{ px: 1.5, py: 1.5, fontSize: 12.5, color: "text.disabled", lineHeight: 1.7 }}>
                        아직 저장된 대화가 없어요.<br />대화를 시작하면 여기에 쌓입니다.
                    </Typography>
                ) : (
                    groupByDate(history).map((group) => (
                        <Box key={group.key} sx={{ mb: 1 }}>
                            {/* 날짜 그룹 — 30건이 한 덩어리로 늘어서면 "언제 것인지"가 안 읽힌다 */}
                            <Typography
                                sx={{
                                    px: 1.5, pt: 1.25, pb: 0.5,
                                    fontSize: 11, fontWeight: 700, letterSpacing: "0.6px",
                                    color: "text.disabled", textTransform: "uppercase",
                                }}
                            >
                                {group.label}
                            </Typography>
                            <Stack spacing={0.125}>
                                {group.items.map((c) => {
                                    const active = c.id === convId;
                                    return (
                                        <Box
                                            key={c.id}
                                            onClick={() => loadConversation(c)}
                                            sx={{
                                                position: "relative",
                                                px: 1.5, py: 0.875,
                                                borderRadius: 2.5,
                                                cursor: "pointer",
                                                bgcolor: active ? alpha(theme.palette.primary.main, 0.10) : "transparent",
                                                transition: "background-color .14s",
                                                "&:hover": {
                                                    bgcolor: active
                                                        ? alpha(theme.palette.primary.main, 0.14)
                                                        : theme.palette.action.hover,
                                                },
                                                "&:hover .cw-del": { opacity: 1 },
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    fontSize: 13.5,
                                                    fontWeight: active ? 700 : 500,
                                                    color: active ? "primary.main" : "text.primary",
                                                    pr: 3,
                                                    lineHeight: 1.45,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {c.title}
                                            </Typography>
                                            <Typography
                                                sx={{
                                                    fontSize: 11,
                                                    color: active ? alpha(theme.palette.primary.main, 0.75) : "text.disabled",
                                                    mt: 0.125,
                                                }}
                                            >
                                                {relativeTime(c.updatedAt)}
                                            </Typography>
                                            <IconButton
                                                className="cw-del"
                                                onClick={(e) => deleteConversation(c.id, e)}
                                                aria-label="대화 삭제"
                                                size="small"
                                                sx={{
                                                    position: "absolute", top: "50%", right: 4,
                                                    transform: "translateY(-50%)",
                                                    width: 26, height: 26,
                                                    opacity: 0,
                                                    transition: "opacity .15s, color .15s",
                                                    color: "text.disabled",
                                                    "&:hover": { color: "error.main", bgcolor: "transparent" },
                                                }}
                                            >
                                                <CloseRoundedIcon sx={{ fontSize: 15 }} />
                                            </IconButton>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </Box>
                    ))
                )}
            </Box>

            {/* 어느 계정·워크스페이스로 보고 있는지.
                예전엔 표시가 없어서, 실계정으로 들어와 있는데 둘러보기 중인 줄 알고
                "게스트인데 남의 데이터가 보인다"고 오해한 일이 있었다. */}
            <Box sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: "divider" }}>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
                    <Typography
                        sx={{
                            fontSize: 12.5, fontWeight: 700, color: "text.primary",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}
                    >
                        {displayName || me?.email || "알 수 없는 계정"}
                    </Typography>
                    {isGuest && (
                        <Box
                            sx={{
                                flex: "none",
                                px: 0.75, py: 0.125, borderRadius: 999,
                                fontSize: 10.5, fontWeight: 700, lineHeight: 1.6,
                                bgcolor: (t) => alpha(t.palette.warning.main, 0.16),
                                color: "warning.dark",
                            }}
                        >
                            둘러보기
                        </Box>
                    )}
                </Stack>
                {currentWorkspace?.workspaceName && (
                    <Typography
                        sx={{
                            fontSize: 11.5, color: "text.secondary", mb: 0.75,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}
                    >
                        {currentWorkspace.workspaceName}
                    </Typography>
                )}
                {/* 남은 횟수 — 상한에 걸리고 나서야 아는 것보다 미리 보이는 편이 낫다 */}
                {usage && usage.limit > 0 && (
                    <Box sx={{ mb: 1 }}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                            <Typography sx={{ fontSize: 11, color: "text.secondary", fontWeight: 600 }}>
                                오늘 AI 사용
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: usage.remaining <= 5 ? "warning.dark" : "text.disabled" }}>
                                {usage.used} / {usage.limit}
                            </Typography>
                        </Stack>
                        <Box sx={{ height: 3, borderRadius: 2, bgcolor: "action.hover", overflow: "hidden" }}>
                            <Box
                                sx={{
                                    height: "100%",
                                    width: `${Math.min(100, (usage.used / usage.limit) * 100)}%`,
                                    bgcolor: usage.remaining <= 5 ? "warning.main" : "primary.main",
                                    transition: "width .3s",
                                }}
                            />
                        </Box>
                    </Box>
                )}
                <Typography sx={{ fontSize: 11, color: "text.disabled", lineHeight: 1.7 }}>
                    대화는 이 브라우저에만 저장돼요.<br />다른 기기에서는 보이지 않아요.
                </Typography>
            </Box>
        </Box>
    );

    const messagesArea = (
        <Box
            className="cw-scroll"
            sx={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                px: "16px",
                pt: "16px",
                pb: "8px",
                ...hideScrollbarSx,
            }}
        >
            {/* 전체화면에서 스크롤은 **화면 전체 폭**이 갖고, 글줄 폭만 안쪽에서 제한한다.
                예전엔 760px 칼럼 자체가 스크롤 영역이라 양옆 빈 곳에 커서를 두면 휠이
                먹지 않았다 — 화면 대부분에서 스크롤이 안 되는 셈이었다. */}
            <Box sx={fullscreen ? { maxWidth: 860, mx: "auto", ...(messages.length === 0 && { height: "100%" }) } : null}>
            {messages.length === 0 && (
                <Box
                    sx={{
                        animation: "cw-fadeUp 0.3s ease",
                        // 전체화면에서는 인사말·예시를 세로 가운데로 모은다.
                        // 위에 붙여 두면 아래로 화면 절반이 비어 입력창과 따로 놀았다.
                        ...(fullscreen && { minHeight: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }),
                    }}
                >
                    <Box sx={{ textAlign: "center", pt: fullscreen ? 0 : 3.5, pb: 2.5 }}>
                        <Box
                            sx={{
                                width: 56,
                                height: 56,
                                borderRadius: 3,
                                background: "var(--plando-ai-grad)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                                mx: "auto",
                                mb: 1.75,
                                boxShadow: "0 8px 28px var(--plando-ai-glow)",
                            }}
                        >
                            <AutoAwesomeRoundedIcon sx={{ fontSize: 28 }} />
                        </Box>
                        {displayName && (
                            <Typography sx={{ fontSize: 15, fontWeight: 600, color: "text.secondary", mb: 0.5 }}>
                                {displayName}님, 안녕하세요!
                            </Typography>
                        )}
                        <Typography sx={{ fontSize: fullscreen ? 28 : 21, fontWeight: 800, letterSpacing: "-0.5px", mb: 0.75 }}>
                            무엇을 도와드릴까요?
                        </Typography>
                        <Typography sx={{ fontSize: 13.5, color: "text.secondary", lineHeight: 1.6 }}>
                            할 일을 만들고, 찾고, 정리하는 걸<br />한 문장으로 처리해드려요
                        </Typography>
                    </Box>

                    {/* 목적별 예시 탭 — 한 줄 나열이던 예전 UI 는 4개 중 3개가 "추가"라
                        조회·정리도 된다는 걸 아무도 몰랐다. 탭 자체가 기능 안내가 된다. */}
                    <Box>
                        <Stack
                            direction="row"
                            spacing={0.5}
                            sx={{ mb: 1.25, overflowX: "auto", pb: 0.25, "&::-webkit-scrollbar": { display: "none" } }}
                        >
                            {EXAMPLE_TABS.map((tab) => {
                                const active = tab.id === exampleTab;
                                return (
                                    <Press
                                        key={tab.id}
                                        onClick={() => setExampleTab(tab.id)}
                                        haptic="light"
                                        pressScale={0.97}
                                        activeBg={theme.palette.action.hover}
                                        style={{
                                            flex: "none",
                                            borderRadius: 999,
                                            padding: "6px 14px",
                                            fontSize: 13,
                                            fontWeight: active ? 700 : 500,
                                            color: active ? theme.palette.primary.main : theme.palette.text.secondary,
                                            // 단축 속성 background 를 쓰면 안 된다 — Press 의 whileTap 은
                                            // backgroundColor 를 애니메이션하므로, 키가 다르면 탭이 끝나도
                                            // 눌린 색이 남아 **비활성 탭까지 선택된 것처럼 보인다**(실제로 겪음).
                                            backgroundColor: active ? alpha(theme.palette.primary.main, 0.10) : "transparent",
                                            boxShadow: active ? "none" : "var(--plando-shadow-card-ring)",
                                        }}
                                    >
                                        {tab.label}
                                    </Press>
                                );
                            })}
                        </Stack>

                        <Typography sx={{ fontSize: 12.5, color: "text.disabled", mb: 1.25, lineHeight: 1.5 }}>
                            {activeExampleTab.hint}
                        </Typography>

                        <Stack spacing={0.75}>
                            {activeExampleTab.items.map((ex, i) => (
                                <Press
                                    key={`${activeExampleTab.id}-${i}`}
                                    onClick={() => handleExample(ex)}
                                    haptic="light"
                                    pressScale={0.99}
                                    activeBg={theme.palette.action.hover}
                                    style={{
                                        background: "transparent",
                                        boxShadow: "var(--plando-shadow-card-ring)",
                                        borderRadius: 12,
                                        padding: "11px 14px",
                                        textAlign: "left",
                                        color: theme.palette.text.secondary,
                                        fontSize: 13,
                                        lineHeight: 1.4,
                                    }}
                                >
                                    {ex}
                                </Press>
                            ))}
                        </Stack>
                    </Box>
                </Box>
            )}

            {messages.map((msg) => (
                <Box key={msg.id} sx={{ mb: 1.75, animation: "cw-fadeUp 0.2s ease" }}>
                    {msg.role === "user" ? (
                        /* 사용자 말풍선 */
                        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                            <Box
                                sx={{
                                    maxWidth: "78%",
                                    bgcolor: "primary.main",
                                    color: "#fff",
                                    borderRadius: "18px 18px 4px 18px",
                                    px: 1.75,
                                    py: 1.25,
                                    fontSize: 14,
                                    lineHeight: 1.6,
                                    wordBreak: "break-word",
                                    // 서버 문구에 줄바꿈이 들어오는 경우가 있다(상한 안내, 단계 요약 등).
                                    // 이게 없으면 \n 이 공백으로 뭉개져 한 덩어리로 읽힌다.
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {msg.text}
                            </Box>
                        </Box>
                    ) : (
                        /* AI 말풍선 */
                        <Stack direction="row" alignItems="flex-start" spacing={1}>
                            <Box
                                sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 1.25,
                                    background: "var(--plando-ai-grad)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#fff",
                                    flexShrink: 0,
                                    mt: 0.25,
                                }}
                            >
                                <AutoAwesomeRoundedIcon sx={{ fontSize: 14 }} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                {msg.loading ? (
                                    <Box
                                        sx={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 0.625,
                                            bgcolor: "background.paper",
                                            boxShadow: "var(--plando-shadow-card-ring)",
                                            borderRadius: "4px 16px 16px 16px",
                                            px: 1.75,
                                            py: 1.375,
                                        }}
                                    >
                                        <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "text.disabled", animation: "cw-dot1 1.2s infinite" }} />
                                        <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "text.disabled", animation: "cw-dot2 1.2s infinite" }} />
                                        <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "text.disabled", animation: "cw-dot3 1.2s infinite" }} />
                                    </Box>
                                ) : (
                                    <>
                                        {msg.text && (
                                            <Box
                                                sx={{
                                                    display: "inline-block",
                                                    bgcolor: "background.paper",
                                                    boxShadow: "var(--plando-shadow-card-ring)",
                                                    borderRadius: "4px 16px 16px 16px",
                                                    px: 1.75,
                                                    py: 1.25,
                                                    fontSize: 14,
                                                    color: "text.primary",
                                                    lineHeight: 1.6,
                                                    wordBreak: "break-word",
                                                    maxWidth: "100%",
                                                    whiteSpace: "pre-wrap",
                                                }}
                                            >
                                                {msg.text}
                                            </Box>
                                        )}
                                        {/* AI 가 실행한 단계 — 결과 문장만으로는 무엇을 했는지 알 수 없다 */}
                                        <ChatSteps steps={msg.steps} />

                                        {/* 다건 생성 — 항목별 편집 카드 */}
                                        {Array.isArray(msg.parsedList) && msg.parsedList.length > 0 && (
                                            <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                                                {msg.parsedList.map((p, pi) => (
                                                    p ? (
                                                        <ChatParsedCard
                                                            key={pi}
                                                            task={p}
                                                            assigneeOptions={users}
                                                            onConfirm={(task) => handleConfirm(task, msg.id, pi)}
                                                            onEdit={() => dismissCardItem(msg.id, pi)}
                                                            loading={isLoading}
                                                        />
                                                    ) : null
                                                ))}
                                            </Box>
                                        )}
                                        {msg.parsed && (
                                            <Box sx={{ mt: 1 }}>
                                                {msg.parsed._actionType === "TASK_CREATED" && (
                                                    <ChatParsedCard
                                                        task={msg.parsed}
                                                        assigneeOptions={users}
                                                        onConfirm={(task) => handleConfirm(task, msg.id)}
                                                        onEdit={() => dismissCard(msg.id)}
                                                        onRetry={() => handleRetry(msg.id)}
                                                        loading={isLoading}
                                                    />
                                                )}
                                                {(msg.parsed._actionType === "TASK_LISTED" || msg.parsed._actionType === "TASK_UPDATED") && (
                                                    <TaskResultCard
                                                        tasks={msg.parsed._tasks}
                                                        actionType={msg.parsed._actionType}
                                                        onOpen={handleOpenTask}
                                                        onDismiss={() => dismissCard(msg.id)}
                                                    />
                                                )}
                                            </Box>
                                        )}
                                    </>
                                )}
                            </Box>
                        </Stack>
                    )}
                </Box>
            ))}

            <div ref={messagesEndRef} />
            </Box>
        </Box>
    );

    /* 하단 영역 — pending 인디케이터 + 입력 바 */
    const inputBar = (
        <Box sx={{ flexShrink: 0 }}>
            {chatContext.pendingAction && (
                <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{
                        px: 1.75,
                        py: 0.875,
                        bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                        borderTop: 1,
                        borderColor: (t) => alpha(t.palette.primary.main, 0.20),
                    }}
                >
                    <Box
                        sx={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            bgcolor: "primary.main",
                            animation: "cw-pulse 1.4s ease-in-out infinite",
                        }}
                    />
                    <Typography sx={{ fontSize: 12, color: "primary.main", fontWeight: 700 }}>
                        {PENDING_LABELS[chatContext.pendingAction] ?? "이어서"} 이어가는 중
                    </Typography>
                    <Press
                        as="span"
                        onClick={cancelPending}
                        haptic="light"
                        pressScale={0.92}
                        style={{
                            marginLeft: "auto",
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: theme.palette.text.disabled,
                            padding: "2px 8px",
                            borderRadius: 6,
                        }}
                    >
                        취소
                    </Press>
                </Stack>
            )}
            {/* 입력 영역.
                예전엔 화면 바닥에 붙은 얇은 바에 위쪽 실선 하나였다. 대화가 없을 때는 위쪽 예시와
                멀찍이 떨어져 시선이 끊겼다. 도톰한 카드로 띄워 "여기에 쓰면 된다"가 먼저 읽히게 한다.
                포커스 표시도 패널 전체를 가로지르던 선 대신 카드 테두리로 좁힌다. */}
            <Box
                sx={{
                    // 전체화면에서는 페이지 배경(background.default) 위에 얹히므로 paper 를 깔면
                    // 폭 760px 짜리 흰 띠가 화면 가운데에 툭 튀어나온다. 그때는 배경을 비운다.
                    bgcolor: fullscreen ? "transparent" : "background.paper",
                    px: 1.5,
                    pt: 1,
                    pb: isMobile
                        ? (kbOffset > 0 ? `${kbOffset + 8}px` : "calc(env(safe-area-inset-bottom) + 8px)")
                        : "10px",
                }}
            >
                <Stack
                    direction="row"
                    alignItems="flex-end"
                    spacing={1}
                    sx={{
                        p: 1,
                        pl: 1.75,
                        borderRadius: 4,
                        bgcolor: "var(--plando-input-bg)",
                        border: 1,
                        borderColor: focused ? "primary.main" : "transparent",
                        boxShadow: focused
                            ? (t) => `0 0 0 3px ${alpha(t.palette.primary.main, 0.14)}`
                            : "var(--plando-shadow-card-ring)",
                        transition: "border-color 0.18s, box-shadow 0.18s",
                    }}
                >
                    <Box
                        component="textarea"
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                // IME 조합 중 Enter 무시 — 한글 마지막 글자 중복/조기 전송 방지
                                if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                                handleSubmit();
                            }
                        }}
                        placeholder={chatContext.pendingAction ? "답변을 입력하세요..." : "메시지를 입력하세요..."}
                        sx={{
                            flex: 1,
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            fontSize: 15,
                            color: "text.primary",
                            resize: "none",
                            minHeight: 36,
                            maxHeight: 120,
                            lineHeight: 1.5,
                            py: 1,
                            fontFamily: "var(--plando-font)",
                            overflowY: "auto",
                            "&::placeholder": { color: "text.disabled" },
                        }}
                    />
                    {SPEECH_RECOGNITION_SUPPORTED && (
                        <IconButton
                            onClick={handleMicToggle}
                            aria-label="음성 입력"
                            sx={{
                                width: 38,
                                height: 38,
                                flexShrink: 0,
                                borderRadius: 2,
                                bgcolor: isListening
                                    ? (t) => alpha(t.palette.error.main, 0.12)
                                    : "var(--plando-input-bg)",
                                color: isListening ? "error.main" : "text.secondary",
                                animation: isListening ? "cw-pulse 1.2s ease-in-out infinite" : "none",
                                "&:hover": {
                                    bgcolor: isListening
                                        ? (t) => alpha(t.palette.error.main, 0.18)
                                        : "var(--plando-input-bg-hover)",
                                },
                            }}
                        >
                            <MicNoneRoundedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    )}
                    <Press
                        onClick={handleSubmit}
                        disabled={!input.trim() || isLoading}
                        haptic="medium"
                        pressScale={0.95}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            height: 38,
                            minWidth: 56,
                            padding: "0 14px",
                            borderRadius: 12,
                            background: input.trim() && !isLoading
                                ? "var(--plando-ai-grad)"
                                : "var(--plando-input-bg)",
                            color: input.trim() && !isLoading ? "#fff" : theme.palette.text.disabled,
                            fontSize: 13,
                            fontWeight: 700,
                            boxShadow: input.trim() && !isLoading
                                ? "0 4px 16px var(--plando-ai-glow)"
                                : "none",
                            border: "none",
                            transition: "all 0.18s",
                        }}
                    >
                        {isLoading ? (
                            <Box sx={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "currentColor", animation: "cw-dot1 1.2s infinite" }} />
                                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "currentColor", animation: "cw-dot2 1.2s infinite" }} />
                                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "currentColor", animation: "cw-dot3 1.2s infinite" }} />
                            </Box>
                        ) : (
                            <SendRoundedIcon sx={{ fontSize: 16 }} />
                        )}
                    </Press>
                </Stack>

                {/* 카드 아래 보조 안내. 단축키는 데스크탑에서만 의미가 있다.
                    AI 고지는 답변을 그대로 믿게 두지 않기 위해 항상 둔다. */}
                <Typography
                    sx={{
                        mt: 0.75,
                        textAlign: "center",
                        fontSize: 11.5,
                        color: "text.disabled",
                        lineHeight: 1.5,
                    }}
                >
                    {!isMobile && "Ctrl(⌘)+Enter 로 전송 · "}
                    AI 답변은 정확하지 않을 수 있어요
                </Typography>
            </Box>
        </Box>
    );

    const sharedStyle = (
        <style>{`
            @keyframes cw-pulse  { 0%,100%{opacity:.4} 50%{opacity:.9} }
            @keyframes cw-dot1   { 0%,80%,100%{opacity:.2} 40%{opacity:1} }
            @keyframes cw-dot2   { 0%,80%,100%{opacity:.2} 50%{opacity:1} }
            @keyframes cw-dot3   { 0%,80%,100%{opacity:.2} 60%{opacity:1} }
            @keyframes cw-fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        `}</style>
    );

    const detailModal = (
        <TodoDetailModal
            open={detailModalOpen}
            onClose={handleDetailClose}
            todo={detailTodo}
            onDelete={handleDetailDelete}
            onPatchLocal={handleDetailPatchLocal}
        />
    );

    if (isMobile) {
        /* 모바일 — Sheet primitive (drag handle / radius / safe-area / blur 통일) */
        return (
            <>
                <Sheet
                    open={open}
                    onClose={onClose}
                    height="92dvh"
                    zIndex={Z.CHAT_WIDGET}
                    header={header}
                    footer={inputBar}
                >
                    {sharedStyle}
                    {toast && <Toast task={toast} onClose={() => setToast(null)} />}
                    {messagesArea}
                </Sheet>
                {detailModal}
                {/* 헤더 버튼은 세 분기(모바일 Sheet · 전체화면 · 데스크톱 Drawer)에서 모두 보인다.
                    다이얼로그를 한 분기라도 빠뜨리면 **그 화면에서만 버튼이 먹통**이 된다 —
                    보이는데 눌러도 아무 일이 없으니 고장으로 읽힌다.
                    실제로 여기 두 개가 빠져 있어서 모바일에서 예약·역할 편집이 안 열렸다. */}
                <AgentEditDialog
                    open={agentDialog !== null}
                    agent={agentDialog}
                    onClose={() => setAgentDialog(null)}
                    onSaved={reloadAgents}
                />
                <ScheduleDialog open={scheduleOpen} agents={agents} onClose={() => setScheduleOpen(false)} />
            </>
        );
    }

    /* 데스크톱 — 전체화면 모드.
       460px 패널에서는 답변의 할 일 카드가 눌려 보인다. 넓게 볼 수단을 따로 둔다.
       다우오피스처럼 가운데 한 단으로 모으되, 좌측 대화 목록 사이드바는 만들지 않았다 —
       이 위젯은 대화를 저장하지 않아(새로고침하면 사라진다) 목록·검색·폴더가 전부 빈 껍데기가 된다. */
    if (fullscreen) {
        return (
            <>
                <Dialog fullScreen open={open} onClose={onClose}>
                    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", bgcolor: "background.default" }}>
                        {sharedStyle}
                        {toast && <Toast task={toast} onClose={() => setToast(null)} />}
                        {header}
                        <Box sx={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                            {sidebar}
                            {/* 가운데 한 단 — 넓은 화면에서 글줄이 지나치게 길어지지 않게 */}
                            <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                                {messagesArea}
                                <Box sx={{ width: "100%", maxWidth: 860, mx: "auto" }}>{inputBar}</Box>
                            </Box>
                        </Box>
                    </Box>
                </Dialog>
                {detailModal}
                {/* 역할 편집은 사이드바(전체화면)에서 열리므로 이 분기에도 있어야 한다.
                    없으면 "만들기"를 눌러도 아무 일이 없다. */}
                <AgentEditDialog
                    open={agentDialog !== null}
                    agent={agentDialog}
                    onClose={() => setAgentDialog(null)}
                    onSaved={reloadAgents}
                />
                <ScheduleDialog open={scheduleOpen} agents={agents} onClose={() => setScheduleOpen(false)} />
            </>
        );
    }

    /* 데스크톱 — 우측 Drawer */
    return (
        <>
            <Drawer
                anchor="right"
                open={open}
                onClose={onClose}
                PaperProps={{
                    sx: {
                        width: 460,
                        maxWidth: "100%",
                        bgcolor: "background.default",
                    },
                }}
            >
                <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
                    {sharedStyle}
                    {toast && <Toast task={toast} onClose={() => setToast(null)} />}
                    {header}
                    {messagesArea}
                    {inputBar}
                </Box>
            </Drawer>
            {detailModal}
            <AgentEditDialog
                open={agentDialog !== null}
                agent={agentDialog}
                onClose={() => setAgentDialog(null)}
                onSaved={reloadAgents}
            />
            <ScheduleDialog open={scheduleOpen} agents={agents} onClose={() => setScheduleOpen(false)} />
        </>
    );
}
