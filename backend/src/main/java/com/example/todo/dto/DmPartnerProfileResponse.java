package com.example.todo.dto;

import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DmPartnerProfileResponse {

    private Long   partnerId;
    private String partnerName;
    private String partnerEmail;
    private String partnerProfileImageUrl;
    private LocalDateTime lastActiveAt;  // 마지막 메시지 발신 시각 (null이면 활동 없음)
    private String role;                 // OWNER | MEMBER

    private List<SharedTodoInfo> sharedTodos;
    private List<SharedFileInfo> sharedFiles;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SharedTodoInfo {
        private Long   id;
        private String title;
        private String status;    // TODO | IN_PROGRESS | DONE
        private String priority;  // HIGH | MEDIUM | LOW
        private String dueDate;   // yyyy-MM-dd (nullable)
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SharedFileInfo {
        private String fileUrl;
        private String fileName;
        private String fileType;
        private Long   fileSize;
        private LocalDateTime sentAt;
    }
}
