package com.example.todo.dto;

import com.example.todo.entity.TodoAttachment;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class TodoAttachmentResponse {

    private Long id;
    private Long todoId;
    private String uploaderEmail;
    private String uploaderName;
    private String fileUrl;
    private String fileName;
    private String fileType;
    private Long fileSize;
    private LocalDateTime createdAt;

    public static TodoAttachmentResponse from(TodoAttachment a) {
        return TodoAttachmentResponse.builder()
                .id(a.getId())
                .todoId(a.getTodoId())
                .uploaderEmail(a.getUploaderEmail())
                .uploaderName(a.getUploaderName())
                .fileUrl(a.getFileUrl())
                .fileName(a.getFileName())
                .fileType(a.getFileType())
                .fileSize(a.getFileSize())
                .createdAt(a.getCreatedAt())
                .build();
    }
}
