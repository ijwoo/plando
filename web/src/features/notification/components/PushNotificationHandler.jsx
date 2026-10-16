import { useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useOpenTodoDetail } from "../../todo/hooks/useOpenTodoDetail.jsx";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { isNative } from "../../../shared/utils/platformUtils.js";

/**
 * 푸시 알림 클릭 → 앱 진입 시 URL 파라미터를 감지해 처리.
 * - workspaceId: 해당 워크스페이스로 전환
 * - openTask:   태스크 상세 패널 자동 오픈
 * - openRoom:   DM 채팅방으로 이동
 */
export default function PushNotificationHandler() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const openTodoDetail = useOpenTodoDetail();
    const { workspaces, currentWorkspace, changeWorkspace } = useWorkspace();

    const pendingTaskId = useRef(null);
    const pendingRoomId = useRef(null);
    const pendingWorkspaceId = useRef(null);

    const workspacesRef = useRef(workspaces);
    const changeWorkspaceRef = useRef(changeWorkspace);
    workspacesRef.current = workspaces;
    changeWorkspaceRef.current = changeWorkspace;

    // 워크스페이스 전환 완료 후 태스크/룸 오픈
    useEffect(() => {
        if (!pendingWorkspaceId.current) return;
        if (String(currentWorkspace?.workspaceId) !== String(pendingWorkspaceId.current)) return;

        if (pendingTaskId.current) {
            const taskId = pendingTaskId.current;
            pendingTaskId.current = null;
            pendingWorkspaceId.current = null;
            openTodoDetail(Number(taskId));
        } else if (pendingRoomId.current) {
            const roomId = pendingRoomId.current;
            pendingWorkspaceId.current = null;
            pendingRoomId.current = null;
            // 목록이 아니라 해당 대화방을 바로 연다 (DmPage가 location.state.openRoomId 처리)
            navigate("/dm", { state: { openRoomId: Number(roomId) } });
        }
    }, [currentWorkspace, openTodoDetail, navigate]);

    useEffect(() => {
        const taskId = searchParams.get("openTask");
        const roomId = searchParams.get("openRoom");
        const workspaceId = searchParams.get("workspaceId");
        if (!taskId && !roomId && !workspaceId) return;

        setSearchParams((prev) => {
            prev.delete("openTask");
            prev.delete("openRoom");
            prev.delete("workspaceId");
            return prev;
        }, { replace: true });

        const needsSwitch = workspaceId && String(currentWorkspace?.workspaceId) !== String(workspaceId);
        if (needsSwitch) {
            const target = workspacesRef.current.find((w) => String(w.workspaceId) === String(workspaceId));
            if (target) {
                pendingTaskId.current = taskId;
                pendingRoomId.current = roomId;
                pendingWorkspaceId.current = workspaceId;
                changeWorkspaceRef.current(target);
                return;
            }
        }

        if (taskId) {
            openTodoDetail(Number(taskId));
        } else if (roomId) {
            navigate("/dm", { state: { openRoomId: Number(roomId) } });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // iOS Capacitor: native push 알림 탭 처리 (data 페이로드의 targetId/workspaceId/type 사용)
    useEffect(() => {
        if (!isNative) return;
        let tapListener;
        let recvListener;

        (async () => {
            const { PushNotifications } = await import("@capacitor/push-notifications");

            tapListener = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
                const data = action?.notification?.data || {};
                const taskId = data.targetId;
                const wsId = data.workspaceId;
                const type = data.type || "";
                const isDm = type.startsWith("DM");

                const needsSwitch = wsId && String(currentWorkspace?.workspaceId) !== String(wsId);
                if (needsSwitch) {
                    const target = workspaces.find((w) => String(w.workspaceId) === String(wsId));
                    if (target) {
                        // DM 타입은 taskId 필드에 roomId 가 들어오므로 pendingTaskId 에 세팅하면
                        // 워크스페이스 전환 후 effect 가 openTodoDetail 로 잘못 라우팅됨 (404).
                        pendingWorkspaceId.current = wsId;
                        if (isDm) {
                            pendingRoomId.current = taskId;
                        } else {
                            pendingTaskId.current = taskId;
                        }
                        changeWorkspace(target);
                        return;
                    }
                }

                const isRecruit = type.startsWith("RECRUITMENT_");
                if (isDm) {
                    // DM 푸시의 targetId는 roomId — 해당 대화방을 바로 연다
                    navigate("/dm", taskId != null
                        ? { state: { openRoomId: Number(taskId) } }
                        : undefined);
                } else if (isRecruit) {
                    // 모집글 알림은 todo 상세로 가지 않도록 prefix 매칭. Q&A는 탭 자동 진입.
                    const isQa = type === "RECRUITMENT_QUESTION_RECEIVED"
                              || type === "RECRUITMENT_QUESTION_ANSWERED";
                    navigate(`/recruitments/?detail=${taskId}${isQa ? "&tab=qa" : ""}`);
                } else if (taskId) {
                    openTodoDetail(Number(taskId));
                }
            });

            // foreground 수신 — iOS는 기본적으로 OS가 표시 안 함. 필요시 in-app toast로 처리 가능
            recvListener = await PushNotifications.addListener("pushNotificationReceived", () => {
                // 현재는 별도 처리 없음 (필요 시 toast 추가)
            });
        })();

        return () => {
            tapListener?.remove?.();
            recvListener?.remove?.();
        };
    }, [workspaces, currentWorkspace, changeWorkspace, navigate, openTodoDetail]);

    return null;
}
