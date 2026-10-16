package com.example.todo.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 사용자가 만든 AI 역할.
 *
 * 워크스페이스 단위로 공유한다 — 팀이 같은 방식으로 AI 를 쓰게 하는 게 이 기능의 값어치다.
 * 개인용이면 그냥 프롬프트를 매번 치는 것과 다르지 않다.
 *
 * allowedTools 는 쉼표로 구분한 문자열로 둔다. 별도 테이블로 나눌 만큼 복잡하지 않고,
 * 도구 이름은 ToolRegistry 가 검증하므로 자유 입력이 아니다.
 */
@Entity
@Table(name = "custom_agent")
public class CustomAgent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    @Column(nullable = false, length = 40)
    private String name;

    /** 목록에서 눈에 띄게. 아이콘 세트를 늘리지 않고 구분한다. */
    @Column(length = 8)
    private String emoji;

    @Column(length = 120)
    private String description;

    /** 시스템 프롬프트에 덧붙일 지침. 길이를 제한해 프롬프트가 비대해지는 걸 막는다. */
    @Column(columnDefinition = "TEXT")
    private String instructions;

    /** 쉼표 구분 도구 이름. 비어 있으면 제한 없음. */
    @Column(name = "allowed_tools", length = 300)
    private String allowedTools;

    /**
     * 조회 결과를 한 줄로 요약할지.
     * 켜면 조회할 때마다 LLM 을 한 번 더 부르므로 하루 사용량이 더 든다 — 그래서 전역이
     * 아니라 역할마다 둔다.
     */
    @Column(nullable = false)
    private boolean summarize = false;

    /**
     * 답변 문장을 이 역할의 지침대로 다시 쓸지.
     * 끄면 서버가 만든 고정 문구가 그대로 나가고, 지침은 도구 선택에만 쓰인다.
     */
    @Column(nullable = false)
    private boolean voice = false;

    @Column(name = "created_by", length = 120)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    protected CustomAgent() {}

    public CustomAgent(Long workspaceId, String createdBy) {
        this.workspaceId = workspaceId;
        this.createdBy = createdBy;
        this.createdAt = LocalDateTime.now();
    }

    public void apply(String name, String emoji, String description,
                      String instructions, String allowedTools, boolean summarize, boolean voice) {
        this.name = name;
        this.emoji = emoji;
        this.description = description;
        this.instructions = instructions;
        this.allowedTools = allowedTools;
        this.summarize = summarize;
        this.voice = voice;
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getWorkspaceId() { return workspaceId; }
    public String getName() { return name; }
    public String getEmoji() { return emoji; }
    public String getDescription() { return description; }
    public String getInstructions() { return instructions; }
    public String getAllowedTools() { return allowedTools; }
    public boolean isSummarize() { return summarize; }
    public boolean isVoice() { return voice; }
    public String getCreatedBy() { return createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
