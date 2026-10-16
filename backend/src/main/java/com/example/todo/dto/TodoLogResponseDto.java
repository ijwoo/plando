package com.example.todo.dto;

import com.example.todo.entity.TodoLog;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 활동 로그 응답 DTO.
 * TodoLog 엔티티의 modifier(email)에 더해 사용자 표시 이름/프로필 이미지를 함께 내려
 * 프론트가 별도 lookup 없이 바로 렌더할 수 있도록 함.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TodoLogResponseDto {
    private Long id;
    private Long todoId;
    private String field;
    private String beforeValue;
    private String afterValue;
    private String modifier;                 // email (기존 호환)
    private String modifierName;             // 표시 이름
    private String modifierProfileImageUrl;  // 프로필 이미지 (없으면 null)
    private LocalDateTime modifiedAt;

    public static TodoLogResponseDto from(TodoLog log, UserDto user) {
        return TodoLogResponseDto.builder()
                .id(log.getId())
                .todoId(log.getTodoId())
                .field(log.getField())
                .beforeValue(log.getBeforeValue())
                .afterValue(log.getAfterValue())
                .modifier(log.getModifier())
                .modifierName(user != null ? user.getName() : null)
                .modifierProfileImageUrl(user != null ? user.getProfileImageUrl() : null)
                .modifiedAt(log.getModifiedAt())
                .build();
    }
}
