package com.example.todo.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class DmSendRequest {
    private Long roomId;
    private String content;
    /** 업무 태그 (옵션). 예: "BUG" / "PLAN" / "NOTICE". */
    private String tag;
    /** 메시지에 첨부된 Todo 링크 (옵션). */
    private Long linkedTodoId;
    /** 답장 대상 메시지 id (옵션). */
    private Long replyToId;
}
