import React from "react";
import { Avatar, AvatarGroup } from "@mui/material";

/**
 * 참여자 아바타 그룹.
 * 이미지가 있으면 이미지, 없으면 이름 첫 글자 폴백.
 *
 * 서버 AssigneeDto는 email / name / profileImageUrl 뿐이다. 예전엔 없는 필드(`nickname`)를
 * 읽어서 이미지가 없는 참여자가 전부 "?"로 보였다 — name → 이메일 아이디 순으로 폴백한다.
 *
 * @param {{ assignees: Array<{ email?, name?, profileImageUrl? }>, max?: number }} props
 */
function displayName(u) {
    const name = u?.name?.trim();
    if (name) return name;
    const email = u?.email?.trim();
    if (email) return email.split("@")[0];
    return "";
}

export default function AssigneeAvatars({ assignees, max = 3 }) {
    return (
        <AvatarGroup
            max={max}
            sx={{
                flexShrink: 0,
                "& .MuiAvatar-root": {
                    width: 18, height: 18,
                    fontSize: 9, fontWeight: 700,
                    border: "1.5px solid var(--plando-surface)",
                    bgcolor: "var(--plando-surface-mid)",
                    color: "var(--plando-text-secondary)",
                },
                "& .MuiAvatarGroup-avatar": {
                    fontSize: 8.5,
                    bgcolor: "var(--plando-surface-mid)",
                    color: "var(--plando-text-secondary)",
                },
            }}
        >
            {assignees.map((u, i) => {
                const label = displayName(u);
                return (
                    <Avatar
                        key={u.email ?? `assignee-${i}`}
                        src={u.profileImageUrl || undefined}
                        alt={label || "참여자"}
                    >
                        {label ? label[0] : "?"}
                    </Avatar>
                );
            })}
        </AvatarGroup>
    );
}
