package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 이메일 인증 토큰.
 *
 * PasswordResetToken 과 달리 **user_id 로 묶는다**. 재설정 토큰은 email 문자열로 묶여 있어서,
 * 회원 탈퇴로 그 이메일이 해방되면 같은 주소로 새로 가입한 다른 사람에게 옛 토큰이
 * 적용될 수 있었다(실제 취약점). 같은 실수를 반복하지 않기 위한 선택이다.
 */
@Entity
@Table(name = "email_verification_token", schema = "todo")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailVerificationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, unique = true)
    private String token;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    @Builder.Default
    @Column(nullable = false)
    private boolean used = false;

    @Builder.Default
    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public boolean isExpired() {
        return expiresAt.isBefore(LocalDateTime.now());
    }
}
