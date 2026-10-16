package com.example.todo.dto;

import com.example.todo.entity.Project;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectResponseDto {
    private Long id;
    private String name;
    private String color;
    private String icon;
    /** 비보관 할 일 수 (완료 포함) */
    private long todoCount;
    /** 완료 수 */
    private long doneCount;
    /**
     * 작성자 이메일 — 클라이언트가 삭제 버튼을 보일지 판단한다.
     * 서버 규칙은 "작성자 본인 || ADMIN 이상"인데(PermissionService.requireCanDeleteProject)
     * 이 값을 안 내려주면 앱이 판단할 수 없어, 버튼을 항상 보여주고 403 을 맞거나
     * 반대로 작성자에게도 숨기게 된다.
     */
    private String createdByEmail;

    public static ProjectResponseDto from(Project p, long todoCount, long doneCount) {
        return ProjectResponseDto.builder()
                .id(p.getId())
                .name(p.getName())
                .color(p.getColor())
                .icon(p.getIcon())
                .todoCount(todoCount)
                .doneCount(doneCount)
                .createdByEmail(p.getCreatedBy() != null ? p.getCreatedBy().getEmail() : null)
                .build();
    }
}
