package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "recruitment_application", schema = "todo",
        uniqueConstraints = @UniqueConstraint(columnNames = {"recruitment_id", "applicant_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecruitmentApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recruitment_id", nullable = false)
    private Recruitment recruitment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "applicant_id", nullable = false)
    private User applicant;

    /**
     * 지원 시 선택한 역할. 기존 데이터 호환을 위해 nullable.
     * 같은 모집글의 RecruitmentRole.id 만 허용 (service에서 검증).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "selected_role_id")
    private RecruitmentRole selectedRole;

    /** PENDING, ACCEPTED, REJECTED, CANCELLED */
    @Builder.Default
    private String status = "PENDING";

    @Column(columnDefinition = "TEXT")
    private String message;

    private LocalDateTime appliedAt;

    @PrePersist
    protected void onCreate() {
        this.appliedAt = LocalDateTime.now();
    }
}
