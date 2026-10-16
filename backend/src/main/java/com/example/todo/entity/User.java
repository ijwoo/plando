package com.example.todo.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "users", schema = "todo")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @JsonIgnore
    @Column(nullable = true)
    private String password;

    private String name;

    private String profileImageUrl;

    @Column(unique = true)
    private String appleId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(255) default 'LOCAL'")
    @Builder.Default
    private OAuthProvider provider = OAuthProvider.LOCAL;

    private String providerId;

    @JsonIgnore
    @Column(length = 512)
    private String kakaoAccessToken;

    @JsonIgnore
    @Column(length = 512)
    private String kakaoRefreshToken;

    /** 게스트 계정 누적 로그인 횟수 — 통계용. 일반 회원은 0 유지. cleanup에서 reset 안 함. */
    @Column(name = "guest_login_count", nullable = false)
    @Builder.Default
    private int guestLoginCount = 0;

    /** 마지막 게스트 로그인 시각 — 통계용. 일반 회원은 null. */
    @Column(name = "last_guest_login_at")
    private LocalDateTime lastGuestLoginAt;

    /**
     * 마지막 활동 시각 — 인증된 API 요청이 올 때 갱신(분 단위 스로틀).
     * DM 헤더의 "N일 전 활동"이 예전엔 'DM을 마지막으로 보낸 시각'이라, 상대가 앱을 쓰고 있어도
     * DM만 안 보내면 오래된 값이 떴다. 실제 사용 시각을 여기에 남긴다.
     * null = 활동 기록 없음(이 컬럼 도입 이전 사용자) — 클라이언트는 문구를 숨긴다.
     */
    @Column(name = "last_active_at")
    private LocalDateTime lastActiveAt;

    /**
     * 탈퇴 시각. null = 정상 계정.
     *
     * 왜 행을 지우지 않는가: dm_messages 는 상대방의 대화 기록이다. 탈퇴로 내 메시지가
     * 통째로 사라지면 상대 대화가 찢어진다. 그래서 행은 남기고 식별정보만 지운다
     * (email/name/password/apple_id/provider_id/kakao 토큰/프로필 사진).
     * 값이 있으면 어떤 경로로도 로그인할 수 없어야 한다 — 기존에 발급된 JWT 포함.
     */
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    /** 탈퇴 계정인지. 인증 경로에서 반드시 확인한다. */
    public boolean isDeleted() {
        return deletedAt != null;
    }

    /**
     * 이메일 인증 시각. null = 미인증.
     *
     * 미인증이어도 **로그인은 된다**(가입 직후 아무것도 못 하면 이탈이 크다).
     * 대신 남의 워크스페이스에 참여하거나 초대 코드를 다루는 것은 막는다.
     * 소셜 로그인(카카오·구글·Apple)은 제공자가 이미 검증했으므로 계정 생성 시 바로 채운다.
     * 기존 사용자는 마이그레이션에서 전원 인증 완료로 채웠다.
     */
    @Column(name = "email_verified_at")
    private LocalDateTime emailVerifiedAt;

    /**
     * 가입할 때 받은 초대코드를 **아직 쓰지 않고 보관**해 둔 값.
     *
     * 예전에는 가입 즉시 워크스페이스에 넣어줬는데, 가입 시점의 사용자는 항상 미인증이라
     * 초대코드만 알면 소유하지도 않은 이메일로 남의 팀에 들어갈 수 있었다.
     * 이메일 인증이 끝나는 순간 이 코드를 소비해 참여시키고 null 로 비운다.
     */
    @Column(name = "pending_invite_code", length = 64)
    private String pendingInviteCode;

    public boolean isEmailVerified() {
        return emailVerifiedAt != null;
    }

    /**
     * 시스템 역할 — USER / ADMIN. 워크스페이스 역할(WorkspaceRole)과는 별개다.
     * ADMIN 지정은 API 로 열지 않는다(psql 로 직접). 요청마다 DB 에서 다시 읽어서,
     * 권한을 내리면 이미 발급된 토큰에도 바로 적용된다.
     */
    @Column(name = "system_role", nullable = false, length = 20,
            columnDefinition = "varchar(20) default 'USER'")
    @Builder.Default
    private String systemRole = "USER";

    /** 운영자가 정지한 시각. null = 정상. 값이 있으면 탈퇴 계정처럼 어떤 토큰으로도 들어올 수 없다. */
    @Column(name = "suspended_at")
    private LocalDateTime suspendedAt;

    @Column(name = "suspended_reason", length = 500)
    private String suspendedReason;

    /** 관리자 2단계 인증(TOTP) 비밀값 — base32. 등록 확인 전에는 enabledAt 이 null. */
    @JsonIgnore
    @Column(name = "admin_totp_secret", length = 64)
    private String adminTotpSecret;

    @JsonIgnore
    @Column(name = "admin_totp_enabled_at")
    private LocalDateTime adminTotpEnabledAt;

    /** 마지막으로 받아들인 OTP 의 시간 칸 — 같은 코드를 두 번 쓰지 못하게(재전송 공격). */
    @JsonIgnore
    @Column(name = "admin_totp_last_step")
    private Long adminTotpLastStep;

    public boolean isAdmin() {
        return "ADMIN".equals(systemRole);
    }

    public boolean isSuspended() {
        return suspendedAt != null;
    }

    @Builder.Default
    @ManyToMany(mappedBy = "assignees")
    private List<Todo> assignedTodos = new ArrayList<>();

    @Builder.Default
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<WorkspaceMember> workspaceMembers = new ArrayList<>();
}