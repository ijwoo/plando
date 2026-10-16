package com.example.todo.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter @NoArgsConstructor
public class TodoChecklistRequest {
    // create는 컨트롤러에서 명시적으로 비어있음 검증, update는 partial 허용 (content null이면 미수정)
    private String content;
    private Integer orderIndex;
    private Boolean checked;
}
