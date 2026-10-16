package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "dm_messages", schema = "todo")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DmMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private DmRoom room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    /* 운영 컬럼은 NOT NULL 이다. 여기서 nullable=true 로 선언해 두면 테스트 DB(엔티티에서 생성)
       만 null 을 받아, 테스트는 통과하는데 운영에서 500 이 나는 조합이 만들어진다.
       실제로는 sendMessage 가 `content == null ? "" : ...` 로 막고 있어 null 이 저장될 경로가 없다.
       파일 전송은 null 이 아니라 빈 문자열이다. 현실에 맞춘다. */
    @Column(nullable = false, length = 2000)
    private String content;

    // 첨부파일 (nullable — 텍스트 메시지는 null)
    @Column(length = 500)
    private String fileUrl;

    @Column(length = 255)
    private String fileName;

    @Column(length = 100)
    private String fileType;  // MIME type (image/jpeg, application/pdf 등)

    private Long fileSize;    // bytes

    @Column(nullable = false, updatable = false)
    private LocalDateTime sentAt;

    private LocalDateTime readAt;

    /** 사용자가 메시지를 수정한 시각 (nullable). 표시에 "(수정됨)" 표기를 위함. */
    private LocalDateTime editedAt;

    /** 업무 태그 (nullable). 예: BUG / PLAN / NOTICE. enum 대신 string으로 유연성 확보. */
    @Column(length = 20)
    private String tag;

    /** 메시지에 첨부된 Todo 링크 (nullable). 말풍선이 todo 카드로 렌더되고 클릭 시 detail로. */
    @Column(name = "linked_todo_id")
    private Long linkedTodoId;

    /** 답장 대상 메시지 id (nullable). 말풍선 위에 인용 스니펫으로 렌더. */
    @Column(name = "reply_to_id")
    private Long replyToId;

    @PrePersist
    protected void onCreate() {
        sentAt = LocalDateTime.now();
    }
}
