package com.example.todo.dto;

import com.example.todo.entity.Comment;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class CommentResponse {
    private Long id;
    private Long todoId;
    private String content;
    private String writerEmail;
    private String writerName;
    /**
     * 작성자 프로필 사진.
     * [고치는 결함] 화면은 진작 이 값을 읽고 있었는데 서버가 보내지 않아, 댓글만 늘 이니셜로
     * 떴다. 다른 곳은 사진을 쓰는데 댓글만 달라 보였다.
     */
    private String writerProfileImageUrl;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static CommentResponse from(Comment comment) {
        return from(comment, null);
    }

    public static CommentResponse from(Comment comment, String writerProfileImageUrl) {
        return CommentResponse.builder()
                .writerProfileImageUrl(writerProfileImageUrl)
                .id(comment.getId())
                .todoId(comment.getTodoId())
                .content(comment.getContent())
                .writerEmail(comment.getWriterEmail())
                .writerName(comment.getWriterName())
                .createdAt(comment.getCreatedAt())
                .updatedAt(comment.getUpdatedAt())
                .build();
    }
}