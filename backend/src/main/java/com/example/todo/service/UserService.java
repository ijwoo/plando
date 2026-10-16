package com.example.todo.service;

import com.example.todo.dto.AuthDto;
import com.example.todo.dto.UserDto;
import com.example.todo.exception.ApiException;
import com.example.todo.entity.OAuthProvider;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceMember;
import com.example.todo.entity.WorkspaceRole;
import com.example.todo.repository.DmMessageReactionRepository;
import com.example.todo.repository.NotificationRepository;
import com.example.todo.repository.ApnsTokenRepository;
import com.example.todo.repository.CommentRepository;
import com.example.todo.repository.DmTodoSuggestionRepository;
import com.example.todo.repository.EmailVerificationTokenRepository;
import com.example.todo.repository.LogRepository;
import com.example.todo.repository.TodoAttachmentRepository;
import com.example.todo.repository.TodoTemplateRepository;
import com.example.todo.repository.PasswordResetTokenRepository;
import com.example.todo.repository.PushSubscriptionRepository;
import com.example.todo.repository.RecruitmentBookmarkRepository;
import com.example.todo.repository.WrapCommentCacheRepository;
import com.example.todo.repository.WrapSelfMemoRepository;
import com.example.todo.repository.TodoFocusRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.UserSettingsRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import com.example.todo.repository.WorkspaceRepository;
import com.example.todo.util.GuestUtils;
import com.example.todo.util.InviteCodeGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import com.example.todo.util.ImageUtils;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final WorkspaceResolver workspaceResolver;
    private final PasswordEncoder passwordEncoder;
    private final UserSettingsService userSettingsService;
//    private final TodoSampleService todoSampleService;
    private final NotificationRepository notificationRepository;
    private final TodoRepository todoRepository;
    private final TodoFocusRepository todoFocusRepository;
    private final UserSettingsRepository userSettingsRepository;
    private final DmMessageReactionRepository dmReactionRepository;
    /** 연동 해제 시 카카오 쪽 연결도 끊기 위해 */
    private final KakaoService kakaoService;
    // 회원 탈퇴(소프트 삭제) 시 정리하는 본인 전용 데이터
    private final WrapSelfMemoRepository wrapSelfMemoRepository;
    private final WrapCommentCacheRepository wrapCommentCacheRepository;
    private final RecruitmentBookmarkRepository recruitmentBookmarkRepository;
    // 이메일 문자열로만 연결된 테이블들 — 익명화 전에 지워야 한다
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final ApnsTokenRepository apnsTokenRepository;
    private final PushSubscriptionRepository pushSubscriptionRepository;
    // 이메일·실명이 문자열로 박혀 있어 함께 익명화해야 하는 테이블들
    private final CommentRepository commentRepository;
    private final TodoAttachmentRepository todoAttachmentRepository;
    private final LogRepository logRepository;
    private final TodoTemplateRepository todoTemplateRepository;
    private final DmTodoSuggestionRepository dmTodoSuggestionRepository;

    @Transactional
    public User registerUser(AuthDto authDto) {
        validateRegisterRequest(authDto);

        if (userRepository.findByEmail(authDto.getEmail()).isPresent()) {
            throw new ApiException(409, "이미 존재하는 이메일입니다.");
        }

        User user = new User();
        user.setEmail(authDto.getEmail());
        user.setPassword(passwordEncoder.encode(authDto.getPassword()));
        user.setName(authDto.getName());

        User savedUser = userRepository.save(user);

        // 초대코드가 있어도 **여기서 참여시키지 않는다.** 가입 시점의 사용자는 항상 미인증이라,
        // 여기서 넣어주면 소유하지도 않은 이메일로 남의 팀에 들어갈 수 있다(정상 참여 경로인
        // WorkspaceService.joinWorkspace 에는 EmailVerificationGuard 가 있는데 여기만 없었다).
        // 코드는 보관해 두었다가 이메일 인증이 끝나면 그때 소비한다.
        // 참여 전에도 앱을 쓸 수 있어야 하므로 본인 워크스페이스는 항상 만들어 준다.
        createWorkspaceAndJoinAsOwner(savedUser, authDto.getWorkspaceName());
        if (hasText(authDto.getInviteCode())) {
            savedUser.setPendingInviteCode(authDto.getInviteCode().trim());
            userRepository.save(savedUser);
        }

        userSettingsService.createDefaultSettings(savedUser);

        if (!hasText(authDto.getInviteCode())) {
//            todoSampleService.createOnboardingSampleTodos(savedUser);
        }

        return savedUser;
    }

    @Transactional(readOnly = true)
    public UserDto getMe(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        String providerName = user.getProvider() != null ? user.getProvider().name() : "LOCAL";
        // providerId 는 카카오·구글이 **같은 컬럼을 공유**한다. 그래서 예전처럼
        // "providerId 가 있으면 카카오 연동"으로 보면 구글로 로그인한 사람에게도
        // '카카오 연동됨'이 뜬다(실제로 그렇게 보고됐다).
        // 카카오만 액세스 토큰을 저장하므로(구글은 저장하지 않는다) 그걸로 구분한다.
        boolean kakaoLinked = user.getProvider() == OAuthProvider.KAKAO
                || user.getKakaoAccessToken() != null;
        // displayName이 설정되어 있으면 우선 사용, 없으면 user.name, 그것도 없으면 이메일 앞부분
        String displayName = userSettingsRepository.findByUserId(user.getId())
                .map(s -> s.getDisplayName())
                .filter(n -> n != null && !n.isBlank())
                .orElse(null);
        String resolvedName = displayName != null ? displayName
                : (user.getName() != null ? user.getName()
                : (userEmail.contains("@") ? userEmail.split("@")[0] : userEmail));
        UserDto dto = new UserDto(user.getEmail(), resolvedName, user.getProfileImageUrl(), providerName,
                kakaoLinked, user.getPassword() != null && !user.getPassword().isBlank());
        dto.setId(user.getId());
        return dto;
    }

    @Transactional(readOnly = true)
    public List<UserDto> getUsersByWorkspace(String userEmail, Long workspaceId) {
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        return workspaceMemberRepository.findByWorkspace(workspace).stream()
                .map(WorkspaceMember::getUser)
                .distinct()
                .map(user -> {
                    UserDto dto = new UserDto(user.getEmail(),
                            user.getName() != null ? user.getName() : user.getEmail().split("@")[0],
                            user.getProfileImageUrl());
                    dto.setId(user.getId());
                    return dto;
                })
                .collect(Collectors.toList());
    }

    /**
     * 카카오 연동 해제.
     *
     * 예전엔 providerId 만 null 로 만들고 **액세스 토큰을 그대로 남겨 뒀다.** 그래서
     * '연동 해제'를 눌러도 서버는 여전히 그 사람의 카카오 친구 목록을 읽고 그 사람 이름으로
     * 메시지를 보낼 수 있는 토큰을 들고 있었다 — 사용자는 끊었다고 믿는데 실제로는 아니었다.
     *
     * 이제 세 가지를 한다:
     *   1) 카카오 쪽 앱 연결도 끊는다(실패해도 계속 — 아래에서 우리 토큰을 폐기하므로 무해).
     *   2) 우리가 보관한 액세스·리프레시 토큰을 지운다.
     *   3) providerId 를 비운다.
     *
     * providerId 는 카카오·구글이 공유하는 컬럼이라, 구글도 연동돼 있었다면 이 값이 구글 것일
     * 수 있다. 비워도 다음 구글 로그인에서 이메일로 다시 연결되므로(CustomOAuth2UserService
     * 2단계) 로그인이 막히지는 않는다.
     */
    @Transactional
    public void unlinkKakao(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        if (user.getPassword() == null) {
            throw new ApiException(400, "비밀번호가 없는 계정은 카카오 연동을 해제할 수 없습니다. 먼저 비밀번호를 설정하세요.");
        }
        // 카카오 연동이 아예 없으면 알려준다(예전엔 조용히 성공한 척했다).
        boolean kakaoLinked = user.getProvider() == OAuthProvider.KAKAO
                || user.getKakaoAccessToken() != null;
        if (!kakaoLinked) {
            throw new ApiException(400, "카카오 연동이 없습니다.");
        }

        kakaoService.unlinkFromKakao(user.getKakaoAccessToken());

        user.setKakaoAccessToken(null);
        user.setKakaoRefreshToken(null);
        user.setProviderId(null);
        userRepository.save(user);
    }

    @Transactional
    public void deleteAccount(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        if (user.isDeleted()) return; // 이미 탈퇴 — 멱등

        // 게스트(둘러보기) 계정은 절대 탈퇴시키면 안 된다.
        // guest1~6@plando.app 은 미리 만들어 둔 공용 행이고, guestLogin 이 이메일로 찾는다.
        // 하나라도 익명화되면 그 계정이 걸린 사람은 둘러보기가 영구히 깨진다(찾지 못해 예외).
        // 공개 데모라 누구나 호출할 수 있으므로 여기서 막는다.
        GuestUtils.requireNonGuest(user);

        Long userId = user.getId();

        // ── 지우는 것: 본인만의 데이터 ────────────────────────────────
        // 아래 셋은 users 를 **이메일 문자열**로만 참조한다(FK 없음).
        // 익명화하면 원래 이메일을 든 채 고아가 되므로, 익명화보다 **먼저** 지운다.
        notificationRepository.deleteByReceiverEmail(userEmail);
        // 재설정 토큰: 남겨두면 탈퇴로 해방된 원래 이메일로 새로 가입한 **다른 사람**의
        // 비밀번호를 이 토큰으로 바꿀 수 있다(토큰이 user_id 가 아니라 email 로 연결됨).
        passwordResetTokenRepository.deleteAllByEmail(userEmail);
        // 이메일 인증 토큰도 정리한다. (user_id 로 묶여 있어 위 취약점은 없지만,
        // 탈퇴 계정을 인증 완료로 바꿀 수 있는 링크를 남겨둘 이유가 없다.)
        emailVerificationTokenRepository.deleteByUserId(userId);
        // 기기 푸시 토큰: 남겨두면 같은 이메일로 재가입한 사람이 탈퇴자의 기기 푸시를 받는다.
        apnsTokenRepository.deleteByUserEmail(userEmail);
        pushSubscriptionRepository.deleteByUserEmail(userEmail);

        // 소유한 워크스페이스는 통째로 삭제한다(할 일·멤버 캐스케이드).
        // 클라이언트 확인 문구도 "내가 관리자인 워크스페이스와 모든 할 일이 삭제된다"고 알린다.
        workspaceMemberRepository.findByUserAndRole(user, WorkspaceRole.OWNER)
                .forEach(ownerMember -> {
                    Workspace ws = ownerMember.getWorkspace();
                    notificationRepository.deleteByWorkspaceId(ws.getId());
                    workspaceRepository.delete(ws);
                });

        todoRepository.deleteAssigneesByUserId(userId);   // 남의 워크스페이스 할 일 담당자에서 빠짐
        todoRepository.nullifyCreatedBy(userId);          // 남은 할 일의 작성자 표시 해제
        todoFocusRepository.deleteByUserId(userId);
        dmReactionRepository.deleteByUserId(userId);
        wrapSelfMemoRepository.deleteByUserId(userId);
        wrapCommentCacheRepository.deleteByUserId(userId);
        recruitmentBookmarkRepository.deleteByUserId(userId);
        userSettingsRepository.findByUserId(userId).ifPresent(userSettingsRepository::delete);

        // 남의 워크스페이스 멤버십은 끊는다 — 탈퇴자가 팀 목록에 계속 보이면 안 된다.
        // (예전엔 User 삭제 시 cascade 로 지워졌는데, 이제 행을 남기므로 직접 지운다.)
        workspaceMemberRepository.deleteAll(workspaceMemberRepository.findByUser(user));

        // 프로필 사진 파일도 지운다 — 개인정보다. 실패해도 탈퇴는 계속 진행한다.
        deleteProfileImageFile(user.getProfileImageUrl());

        // ── 남기는 것: 상대방의 기록 ──────────────────────────────────
        // dm_messages / dm_room_members / project.created_by / recruitment* 는 그대로 둔다.
        // 내 메시지가 사라지면 상대 대화가 찢어지기 때문이다. 대신 아래 익명화로
        // 누구였는지 알 수 없게 만든다.

        // ── 익명화 + 탈퇴 표시 ───────────────────────────────────────
        String anonEmail = "deleted-" + userId + "@deleted.invalid";

        // 이메일·이름을 문자열로 박아둔 테이블들을 함께 익명화한다.
        // users.name 만 바꿔도 이쪽 '실명 스냅샷'은 남아서 상대 화면에 계속 실명이 보인다.
        // 이메일은 NULL 이 아니라 익명화된 주소로 바꾼다 — 화면이 이름을 다시 조회할 때
        // users 행을 찾아 '탈퇴한 사용자'로 표시되게 하려는 것이다.
        commentRepository.anonymizeByEmail(userEmail, anonEmail);
        todoAttachmentRepository.anonymizeByEmail(userEmail, anonEmail);
        logRepository.anonymizeByEmail(userEmail, anonEmail);
        notificationRepository.anonymizeByEmail(userEmail, anonEmail);
        todoTemplateRepository.anonymizeByEmail(userEmail, anonEmail);
        dmTodoSuggestionRepository.deleteByOwnerEmail(userEmail);

        // email 은 UNIQUE NOT NULL 이라 지울 수 없다 → 수신 불가 도메인의 고유값으로 바꾼다.
        // 원래 이메일이 비면 같은 주소로 다시 가입할 수 있다.
        user.setEmail(anonEmail);
        user.setName("탈퇴한 사용자");
        // 비밀번호는 지우지 않고 못 쓰는 값으로 바꾼다(null 로 두면 소셜 계정과 구분이 흐려진다).
        user.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setProfileImageUrl(null);
        // 소셜 재로그인이 이 행을 찾아 되살리지 못하게 연결고리를 끊는다.
        user.setAppleId(null);
        user.setProviderId(null);
        user.setKakaoAccessToken(null);
        user.setKakaoRefreshToken(null);
        user.setDeletedAt(java.time.LocalDateTime.now());
        userRepository.save(user);
    }

    /**
     * 프로필 사진 파일 삭제.
     * 업로드는 `uploadDir/profiles/{uuid}.jpg` 에 저장하고 URL 은 `/uploads/profiles/...` 다.
     * 카카오 등 외부 URL 이면 우리 파일이 아니므로 건드리지 않는다.
     * 실패해도 조용히 넘어간다 — 파일 정리가 탈퇴를 막아선 안 된다.
     */
    private void deleteProfileImageFile(String profileImageUrl) {
        if (profileImageUrl == null || !profileImageUrl.startsWith("/uploads/profiles/")) return;
        try {
            String filename = Paths.get(profileImageUrl).getFileName().toString();
            Files.deleteIfExists(Paths.get(uploadDir, "profiles", filename));
        } catch (Exception ignored) {
            // 무시
        }
    }

    @Transactional
    public String uploadProfileImage(String userEmail, MultipartFile file) throws IOException {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        String originalFilename = file.getOriginalFilename();
        String ext = (originalFilename != null && originalFilename.contains("."))
                ? originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase()
                : ".jpg";

        String filename = UUID.randomUUID() + ".jpg";
        Path profileDir = Paths.get(uploadDir, "profiles");
        Files.createDirectories(profileDir);
        Files.copy(ImageUtils.resizeToJpeg(file, 256), profileDir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);

        String url = "/uploads/profiles/" + filename;
        user.setProfileImageUrl(url);
        userRepository.save(user);

        return url;
    }

    @Transactional(readOnly = true)
    public User findByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
    }

    private Workspace createWorkspaceAndJoinAsOwner(User user, String workspaceName) {
        Workspace workspace = Workspace.builder()
                .name(resolveWorkspaceName(user, workspaceName))
                .inviteCode(generateUniqueInviteCode())
                .build();

        Workspace savedWorkspace = workspaceRepository.save(workspace);

        WorkspaceMember ownerMember = WorkspaceMember.builder()
                .workspace(savedWorkspace)
                .user(user)
                .role(WorkspaceRole.OWNER)
                .build();

        workspaceMemberRepository.save(ownerMember);
        return savedWorkspace;
    }

    private String resolveWorkspaceName(User user, String workspaceName) {
        if (hasText(workspaceName)) {
            return workspaceName.trim();
        }
        String name = user.getName() != null ? user.getName() : user.getEmail().split("@")[0];
        return name + "의 워크스페이스";
    }

    private String generateUniqueInviteCode() {
        String code;
        do {
            code = InviteCodeGenerator.generate();
        } while (workspaceRepository.existsByInviteCode(code));
        return code;
    }

    private void validateRegisterRequest(AuthDto authDto) {
        if (authDto == null) throw new ApiException(400, "회원가입 요청이 비어 있습니다.");
        if (!hasText(authDto.getEmail())) throw new ApiException(400, "이메일은 필수입니다.");
        if (!hasText(authDto.getPassword())) throw new ApiException(400, "비밀번호는 필수입니다.");
        if (authDto.getPassword().length() < 8) throw new ApiException(400, "비밀번호는 8자 이상이어야 합니다.");
        if (!hasText(authDto.getName())) throw new ApiException(400, "이름은 필수입니다.");
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}