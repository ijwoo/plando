package com.example.todo.dto;

import com.example.todo.entity.WorkflowStatus;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class WorkflowStatusResponse {
    private Long id;
    private String statusKey;
    private String label;
    private String color;
    private String category;   // TODO | IN_PROGRESS | DONE
    private int sortOrder;

    /* primitive boolean 의 getter 는 isDefault() 라서, Jackson 이 프로퍼티 이름을 "default" 로
       잡아 JSON 키가 `default` 로 나갔다. 웹·앱 **둘 다** `isDefault` 를 읽고 있어서,
       워크스페이스가 지정한 기본 상태가 양쪽 모두에서 무시되고 "첫 미시작 상태"로 폴백됐다.
       (기본 상태 별표가 안 켜지고, 완료 취소가 엉뚱한 상태로 가던 원인)
       클라이언트를 고치면 두 벌을 따로 배포해야 하고 심사 중인 앱은 당장 못 고친다 —
       키 이름을 서버에서 맞추는 쪽이 한 번에 끝난다. `default` 를 읽는 코드는 없다.
       필드명을 defaultStatus 로 바꾼 이유: isDefault 로 두면 Jackson 이 `default` 와
       `isDefault` **두 키를 모두** 내보낸다(필드명 + getter 이름). 한 키만 남긴다. */
    @com.fasterxml.jackson.annotation.JsonProperty("isDefault")
    private boolean defaultStatus;

    public static WorkflowStatusResponse from(WorkflowStatus s) {
        return WorkflowStatusResponse.builder()
                .id(s.getId())
                .statusKey(s.getStatusKey())
                .label(s.getLabel())
                .color(s.getColor())
                .category(s.getCategory() != null ? s.getCategory().name() : null)
                .sortOrder(s.getSortOrder())
                .defaultStatus(s.isDefault())
                .build();
    }
}
