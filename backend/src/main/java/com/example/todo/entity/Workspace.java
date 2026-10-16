package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "workspace", schema = "todo")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Workspace {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 50)
    private String inviteCode;

    @Column(length = 255)
    private String iconImageUrl;

    /**
     * 게스트 둘러보기용 데모 워크스페이스 표시.
     * true이면 GuestCleanupService가 멤버십을 청소할 때 제외 → 게스트가 영구 멤버 유지.
     */
    @Column(name = "is_sample", nullable = false)
    @Builder.Default
    private boolean isSample = false;

    @Builder.Default
    @OneToMany(mappedBy = "workspace", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<WorkspaceMember> members = new ArrayList<>();

    @Builder.Default
    @OneToMany(mappedBy = "workspace", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Todo> todos = new ArrayList<>();
}