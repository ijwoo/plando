package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "recruitment_role", schema = "todo")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecruitmentRole {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recruitment_id", nullable = false)
    private Recruitment recruitment;

    @Column(nullable = false)
    private String name;

    @Builder.Default
    private int count = 1;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** 모집중, 마감 */
    @Builder.Default
    private String status = "모집중";
}
