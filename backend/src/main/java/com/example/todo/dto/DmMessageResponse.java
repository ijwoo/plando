package com.example.todo.dto;

import com.example.todo.entity.DmMessage;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Getter
@Builder
public class DmMessageResponse {

    private Long id;
    private Long roomId;
    private Long senderId;
    private String senderEmail;
    private String senderName;
    private String senderProfileImageUrl;
    private String content;
    private LocalDateTime sentAt;
    private LocalDateTime readAt;
    private String fileUrl;
    private String fileName;
    private String fileType;
    private Long   fileSize;

    /** 메시지가 수정됐다면 수정 시각 (없으면 null). */
    private LocalDateTime editedAt;

    /** 업무 태그 (없으면 null). 예: "BUG", "PLAN", "NOTICE". */
    private String tag;

    /** 첨부된 Todo 링크 (없으면 null). */
    private Long linkedTodoId;
    private String linkedTodoTitle;
    private String linkedTodoStatus;

    /** 답장(인용) — 대상 메시지 id / 보낸이 이름 / 내용 스니펫 (없으면 null). */
    private Long replyToId;
    private String replyToSenderName;
    private String replyToContent;

    /** 이 메시지의 이모지 reactions 집계. emoji → 사용자 수. 비어 있을 수 있음. */
    private Map<String, Integer> reactionCounts;

    /** 현재 호출자가 이미 누른 reactions (토글 UI용). 비어 있을 수 있음. */
    private List<String> myReactions;

    public static DmMessageResponse from(DmMessage message) {
        return builderFrom(message).build();
    }

    /** enrich 단계에서 reactions / linkedTodo 정보 등을 덧붙일 수 있도록 builder를 노출. */
    public static DmMessageResponseBuilder builderFrom(DmMessage message) {
        return DmMessageResponse.builder()
                .id(message.getId())
                .roomId(message.getRoom().getId())
                .senderId(message.getSender().getId())
                .senderEmail(message.getSender().getEmail())
                .senderName(message.getSender().getName())
                .senderProfileImageUrl(message.getSender().getProfileImageUrl())
                .content(message.getContent())
                .sentAt(message.getSentAt())
                .readAt(message.getReadAt())
                .fileUrl(message.getFileUrl())
                .fileName(message.getFileName())
                .fileType(message.getFileType())
                .fileSize(message.getFileSize())
                .editedAt(message.getEditedAt())
                .tag(message.getTag())
                .linkedTodoId(message.getLinkedTodoId())
                .replyToId(message.getReplyToId());
    }
}
