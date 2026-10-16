package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * 할 일 ↔ 태그 다대다 조인. Todo 엔티티 매핑을 건드리지 않고 별도 조회(배치)하는
 * Plando 기존 패턴(서브태스크 카운트·포커스와 동일)이라 핫패스 직렬화/N+1 영향 없음.
 */
@Entity
@Table(
        name = "todo_tag",
        schema = "todo",
        uniqueConstraints = @UniqueConstraint(columnNames = {"todo_id", "tag_id"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TodoTag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "todo_id", nullable = false)
    private Long todoId;

    @Column(name = "tag_id", nullable = false)
    private Long tagId;
}
