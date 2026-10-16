import { PRIORITY_LABEL, STATUS_LABEL } from "../../../shared/ui/tone.js";
import { getOptionValue, getOptionLabel, getAvatarSrc } from "../../../shared/utils/assigneeUtils.js";
import { stripMarkdown } from "../../../shared/utils/markdownUtils.jsx";
import { eulReul, euRo, josa } from "../../../shared/utils/josa.js";

/**
 * 활동 로그 한 건을 사람 읽기 좋은 형태로 가공.
 *
 * 기존에 LogSection.jsx의 getActivityText 와
 * TodoDetailDesktop의 ActivityPreview에 같은 로직이 중복 있었음 → 통합.
 */

export const FIELD_LABELS = {
    title: "제목",
    content: "내용",
    priority: "우선순위",
    dueDate: "마감일",
    assignees: "담당자",
    assignee: "담당자",
    startAt: "시작일",
    startTime: "시작 시간",
    endTime: "종료 시간",
    status: "상태",
};

export function formatLogValue(field, value) {
    if (!value || value === "(없음)") return value;
    if (field === "priority") return PRIORITY_LABEL[value] ?? value;
    if (field === "status") return STATUS_LABEL[value] ?? value;
    // 내용(설명)은 마크다운으로 저장되므로 로그에선 기호 제거 + 한 줄로 축약
    if (field === "content") return stripMarkdown(value).replace(/\s*\n\s*/g, " ");
    if (field === "assignees" || field === "assignee") {
        return value
            .split(",")
            .map((s) => {
                const t = s.trim();
                return t.includes("@") ? t.split("@")[0] : t;
            })
            .filter(Boolean)
            .join(", ");
    }
    return value;
}

export function formatLogModifier(modifier) {
    if (!modifier) return "사용자";
    const s = String(modifier).trim();
    if (s.includes("@")) return s.split("@")[0];
    return s;
}


/**
 * 로그/활동 항목의 actor를 표시 가능한 형태로 해석.
 *
 * 백엔드 TodoLogResponseDto가 `modifierName` / `modifierProfileImageUrl`을 함께 내려주므로
 * 1순위로 사용. 누락된 경우 전달된 users 리스트(email key)에서 lookup해 보완.
 * 그래도 못 찾으면 modifier 이메일을 formatLogModifier로 가공한 이름만 노출.
 *
 * @param {object} item — 로그/활동 응답 항목
 * @param {Array<{email:string,name?:string,profileImageUrl?:string}>} users — 워크스페이스 사용자 목록
 * @returns {{ name: string, profileImageUrl: string | undefined, email: string | undefined }}
 */
export function getLogActor(item, users = []) {
    if (!item) return { name: "사용자", profileImageUrl: undefined, email: undefined };

    const email = item.modifier || item.modifierEmail || item.writerEmail || item.userEmail || undefined;

    // 1) 응답에 이름·이미지가 직접 들어있으면 우선
    const directName =
        item.modifierName || item.modifierNickname || item.writerName || item.userName || item.createdByName || "";
    const directSrc =
        item.modifierProfileImageUrl || item.profileImageUrl || item.writerProfileImageUrl || undefined;

    if (directName || directSrc) {
        return {
            name: directName || formatLogModifier(email) || "사용자",
            profileImageUrl: directSrc,
            email,
        };
    }

    // 2) users 디렉터리에서 lookup
    if (email && users.length > 0) {
        const found = users.find((u) => {
            const e = getOptionValue(u);
            return e && e.toLowerCase() === email.toLowerCase();
        });
        if (found) {
            return {
                name: getOptionLabel(found) || formatLogModifier(email),
                profileImageUrl: getAvatarSrc(found),
                email,
            };
        }
    }

    // 3) email만이라도 있으면 가공된 이름으로 fallback
    return {
        name: formatLogModifier(email) || "사용자",
        profileImageUrl: undefined,
        email,
    };
}

function truncate(s, n) {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n) + "…" : t;
}

export function getLogActivityText(item, statusLabel) {
    if (item.message) return item.message;
    if (item.description) return item.description;

    const field = item.field || "";
    const fieldLabel = FIELD_LABELS[field] || item.fieldLabel || field;

    // 내용: 마크다운 전문을 그대로 뿌리면 활동 피드가 벽이 됨 → 새 내용 앞부분만 미리보기.
    // 전체 내용은 할 일 상세 본문에 항상 그대로 있음.
    if (field === "content") {
        const preview = truncate(stripMarkdown(item.afterValue || "").replace(/\s*\n\s*/g, " "), 30);
        return preview ? `내용을 수정했어요 · "${preview}"` : "내용을 수정했어요";
    }
    if (field === "title") {
        const after = truncate(item.afterValue, 24);
        return after ? `제목을 "${after}"${euRo(after)} 변경했어요` : "제목을 변경했어요";
    }
    // 생성 — 서버가 남기는 첫 기록. 필드 변경이 아니라 사건이라 문장을 따로 쓴다.
    if (field === "created") {
        const title = truncate(item.afterValue, 24);
        return title ? `"${title}" 할 일을 만들었어요` : "할 일을 만들었어요";
    }
    // 상태: 커스텀 상태(st_...)는 statusLabel로 라벨 해석(없으면 기본 3상태만).
    if (field === "status") {
        const resolve = (v) => (v ? (statusLabel ? statusLabel(v) : formatLogValue("status", v)) : "");
        const before = resolve(item.beforeValue);
        const after = resolve(item.afterValue);
        if (before && after) return `상태를 "${before}" → "${after}"${euRo(after)} 변경했어요`;
        if (after) return `상태를 "${after}"${euRo(after)} 변경했어요`;
        return "상태를 변경했어요";
    }

    if (fieldLabel) {
        const before = formatLogValue(field, item.beforeValue);
        const after = formatLogValue(field, item.afterValue);

        /* 받침에 따라 을/를, 로/으로 를 고른다.
           "우선순위을(를) '높음'로" 처럼 괄호를 그대로 내보내면 기계가 쓴 글로 읽힌다. */
        if (before && after) {
            return `${josa(fieldLabel, eulReul)} "${before}" → "${after}"${euRo(after)} 변경했어요`;
        }
        if (after) {
            return `${josa(fieldLabel, eulReul)} "${after}"${euRo(after)} 변경했어요`;
        }
        return `${josa(fieldLabel, eulReul)} 변경했어요`;
    }

    return "태스크를 수정했어요";
}

/** 값 변화가 실제로 있는 로그만(무변경 저장 제거). */
export function isMeaningfulLog(item) {
    return !(item.beforeValue != null && item.afterValue != null && item.beforeValue === item.afterValue);
}

/**
 * 활동 로그 정리 — (1) 무의미 로그 제거 (2) 시간 내림차순에서 연속된
 * 같은 (대상·필드·수정자) 편집을 최신 1건으로 접기(내용 여러 번 저장·상태 토글 스팸 방지).
 * 입력은 이미 최신순(desc) 정렬되어 있다고 가정.
 */
export function collapseLogs(list) {
    const out = [];
    for (const l of list || []) {
        if (!isMeaningfulLog(l)) continue;
        const p = out[out.length - 1];
        if (
            p &&
            p.field === l.field &&
            (p.todoId ?? null) === (l.todoId ?? null) &&
            (p.modifier ?? p.modifierName) === (l.modifier ?? l.modifierName)
        ) {
            continue;
        }
        out.push(l);
    }
    return out;
}
