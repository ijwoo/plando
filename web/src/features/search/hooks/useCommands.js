import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    Plus, LayoutGrid, Calendar, ListTodo, LayoutDashboard,
    MessageSquare, MapPin, Settings, SunMoon, LogOut, Box,
} from "lucide-react";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { removeToken } from "../../../shared/utils/tokenUtils.js";

/**
 * 명령 팔레트 명령 레지스트리 (데스크탑 GlobalSearch / 모바일 GlobalSearchMobile 공용).
 * 각 명령: { id, icon(lucide 컴포넌트), label, group, keywords[], run() }
 * 아이콘은 shadcn 기조의 lucide 라인 아이콘, 색은 중립(무채색)으로 렌더한다.
 */
export default function useCommands() {
    const navigate = useNavigate();
    const { workspaces, currentWorkspace, changeWorkspace } = useWorkspace();

    return useMemo(() => {
        const toggleTheme = () => {
            const next = localStorage.getItem("settings.themeMode") === "dark" ? "light" : "dark";
            localStorage.setItem("settings.themeMode", next);
            window.dispatchEvent(new Event(APP_EVENTS.SETTINGS_CHANGED));
        };

        const base = [
            { id:"add-todo",     icon:Plus,            label:"새 할 일 추가",        group:"만들기", keywords:["new","task","추가","할일"],         run:() => window.dispatchEvent(new CustomEvent(APP_EVENTS.OPEN_ADD_TODO)) },
            { id:"go-board",     icon:LayoutGrid,      label:"보드로 이동",          group:"이동",   keywords:["board","kanban","칸반","보드"],      run:() => navigate("/todos") },
            { id:"go-calendar",  icon:Calendar,        label:"캘린더로 이동",        group:"이동",   keywords:["calendar","일정","캘린더"],          run:() => navigate("/calendar") },
            { id:"go-tasklist",  icon:ListTodo,        label:"할 일 목록 보기",      group:"이동",   keywords:["list","목록"],                       run:() => navigate("/tasklist") },
            { id:"go-dashboard", icon:LayoutDashboard, label:"대시보드 보기",        group:"이동",   keywords:["dashboard","통계","대시보드"],       run:() => navigate("/dashboard") },
            { id:"go-dm",        icon:MessageSquare,   label:"메시지로 이동",        group:"이동",   keywords:["dm","message","채팅","메시지"],      run:() => navigate("/dm") },
            { id:"go-map",       icon:MapPin,          label:"지도 일정 보기",       group:"이동",   keywords:["map","지도","위치"],                 run:() => navigate("/map") },
            { id:"go-settings",  icon:Settings,        label:"환경 설정 열기",       group:"이동",   keywords:["settings","설정","환경"],            run:() => navigate("/settings") },
            { id:"toggle-theme", icon:SunMoon,         label:"다크/라이트 모드 전환", group:"환경",   keywords:["theme","dark","light","다크","라이트","테마"], run: toggleTheme },
            { id:"logout",       icon:LogOut,          label:"로그아웃",             group:"계정",   keywords:["logout","로그아웃","나가기"],        run:() => { removeToken(); navigate("/login"); } },
        ];
        const wsCmds = (workspaces || [])
            .filter((w) => w.workspaceId !== currentWorkspace?.workspaceId)
            .map((w) => ({
                id:`ws-${w.workspaceId}`, icon:Box, label:`워크스페이스: ${w.workspaceName}`, group:"워크스페이스",
                keywords:["workspace","워크스페이스", w.workspaceName],
                run:() => changeWorkspace(w),
            }));
        return [...base, ...wsCmds];
    }, [workspaces, currentWorkspace, navigate, changeWorkspace]);
}

/** 명령을 라벨·keywords로 퍼지 필터 (q 없으면 전체) */
export function filterCommands(commands, q) {
    if (!q) return commands;
    const lq = q.toLowerCase();
    return commands.filter((c) =>
        c.label.toLowerCase().includes(lq) || (c.keywords || []).some((k) => k.toLowerCase().includes(lq))
    );
}
