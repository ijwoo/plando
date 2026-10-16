package com.example.todo.service;

import com.example.todo.dto.WorkspaceActionResponse;
import com.example.todo.dto.WorkspaceCreateRequest;
import com.example.todo.dto.WorkspaceJoinRequest;
import com.example.todo.dto.WorkspaceMemberResponse;
import com.example.todo.dto.WorkspaceSummaryResponse;
import com.example.todo.dto.WorkspaceUpdateRequest;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceMember;
import com.example.todo.entity.WorkspaceRole;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.DmMessageRepository;
import com.example.todo.repository.DmRoomRepository;
import com.example.todo.repository.NotificationRepository;
import com.example.todo.repository.RecruitmentRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import com.example.todo.repository.WorkspaceRepository;
import com.example.todo.entity.DmRoom;
import com.example.todo.entity.Recruitment;
import com.example.todo.util.EmailVerificationGuard;
import com.example.todo.util.GuestUtils;
import com.example.todo.util.InviteCodeGenerator;
import com.example.todo.util.ImageUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceService {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final NotificationRepository notificationRepository;
    private final RecruitmentRepository recruitmentRepository;
    private final DmRoomRepository dmRoomRepository;
    private final DmMessageRepository dmMessageRepository;
    private final WorkflowStatusService workflowStatusService;

    public List<WorkspaceSummaryResponse> getMyWorkspaces(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));

        List<WorkspaceMember> members = workspaceMemberRepository.findByUser(user);

        /* 상위 역할 먼저. 예전엔 enum 이름을 사전순으로 정렬해서 ADMIN → MEMBER → OWNER → VIEWER
           순이 됐다. 클라이언트는 workspaceList[0] 을 기본 워크스페이스로 고르기 때문에,
           남의 워크스페이스에 ADMIN 으로 들어가 있으면 **자기 워크스페이스 대신 그쪽으로 들어갔다.**
           같은 역할끼리는 가입 순(멤버 id)으로 고정해 순서가 흔들리지 않게 한다. */
        return members.stream()
                .sorted(Comparator
                        .comparingInt((WorkspaceMember member) -> member.getRole().rank()).reversed()
                        .thenComparing(WorkspaceMember::getId))
                .map(member -> WorkspaceSummaryResponse.builder()
                        .workspaceId(member.getWorkspace().getId())
                        .workspaceName(member.getWorkspace().getName())
                        .inviteCode(member.getWorkspace().getInviteCode())
                        .role(member.getRole())
                        .iconImageUrl(member.getWorkspace().getIconImageUrl())
                        .memberCount((int) workspaceMemberRepository.countByWorkspace(member.getWorkspace()))
                        .build())
                .toList();
    }

    @Transactional
    public WorkspaceActionResponse createWorkspace(String userEmail, WorkspaceCreateRequest request) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));

        GuestUtils.requireNonGuest(user);

        if (request == null || request.getName() == null || request.getName().trim().isEmpty()) {
            throw new ApiException(400, "워크스페이스 이름을 입력해주세요.");
        }

        Workspace workspace = Workspace.builder()
                .name(request.getName().trim())
                .inviteCode(generateUniqueInviteCode())
                .build();

        Workspace savedWorkspace = workspaceRepository.save(workspace);

        WorkspaceMember ownerMember = WorkspaceMember.builder()
                .workspace(savedWorkspace)
                .user(user)
                .role(WorkspaceRole.OWNER)
                .build();

        workspaceMemberRepository.save(ownerMember);

        // 새 워크스페이스에 기본 상태(할 일/진행 중/완료) 시드
        workflowStatusService.seedDefaults(savedWorkspace);

        return WorkspaceActionResponse.builder()
                .workspaceId(savedWorkspace.getId())
                .workspaceName(savedWorkspace.getName())
                .inviteCode(savedWorkspace.getInviteCode())
                .role(WorkspaceRole.OWNER)
                .message("워크스페이스가 생성되었습니다.")
                .build();
    }

    @Transactional
    public WorkspaceActionResponse joinWorkspace(String userEmail, WorkspaceJoinRequest request) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));

        // 확인되지 않은 이메일로 남의 팀에 들어오는 것을 막는다.
        // (개인 사용과 로그인은 미인증이어도 허용한다 — 여기가 이메일 인증의 실익이다.)
        EmailVerificationGuard.require(user);

        if (request == null || request.getInviteCode() == null || request.getInviteCode().trim().isEmpty()) {
            throw new ApiException(400, "초대코드를 입력해주세요.");
        }

        Workspace workspace = workspaceRepository.findByInviteCode(request.getInviteCode().trim())
                .orElseThrow(() -> new ApiException(404, "유효하지 않은 초대코드입니다."));

        WorkspaceMember owner = workspaceMemberRepository.findByWorkspaceAndRole(workspace, WorkspaceRole.OWNER)
                .orElse(null);
        if (owner != null && GuestUtils.isGuest(owner.getUser()) && !GuestUtils.isGuest(user)) {
            throw new ApiException(403, "게스트 워크스페이스에는 참여할 수 없습니다.");
        }

        if (workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user)) {
            throw new ApiException(409, "이미 참여 중인 워크스페이스입니다.");
        }

        WorkspaceMember member = WorkspaceMember.builder()
                .workspace(workspace)
                .user(user)
                .role(WorkspaceRole.MEMBER)
                .build();

        workspaceMemberRepository.save(member);

        return WorkspaceActionResponse.builder()
                .workspaceId(workspace.getId())
                .workspaceName(workspace.getName())
                .inviteCode(workspace.getInviteCode())
                .role(WorkspaceRole.MEMBER)
                .message("워크스페이스에 참여했습니다.")
                .build();
    }

    @Transactional
    public WorkspaceActionResponse updateWorkspace(String userEmail, Long workspaceId, WorkspaceUpdateRequest request) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));

        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));

        WorkspaceMember member = workspaceMemberRepository.findByWorkspaceAndUser(workspace, user)
                .orElseThrow(() -> new ApiException(403, "해당 워크스페이스의 멤버가 아닙니다."));

        if (!member.getRole().atLeast(WorkspaceRole.ADMIN)) {
            throw new ApiException(403, "워크스페이스 설정은 관리자 이상만 변경할 수 있어요.");
        }

        if (request.getWorkspaceName() != null && !request.getWorkspaceName().trim().isEmpty()) {
            workspace.setName(request.getWorkspaceName().trim());
        }

        return WorkspaceActionResponse.builder()
                .workspaceId(workspace.getId())
                .workspaceName(workspace.getName())
                .inviteCode(workspace.getInviteCode())
                .role(member.getRole())
                .message("워크스페이스가 수정되었습니다.")
                .iconImageUrl(workspace.getIconImageUrl())
                .build();
    }

    @Transactional
    public void deleteWorkspace(String userEmail, Long workspaceId) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));

        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));

        WorkspaceMember member = workspaceMemberRepository.findByWorkspaceAndUser(workspace, user)
                .orElseThrow(() -> new ApiException(403, "해당 워크스페이스의 멤버가 아닙니다."));

        if (member.getRole() != WorkspaceRole.OWNER) {
            throw new ApiException(403, "워크스페이스 삭제는 관리자만 할 수 있어요.");
        }

        // 소유자 본인의 마지막(유일한) 워크스페이스는 삭제 불가 — 삭제하면 소속 워크스페이스가 0개가 된다.
        if (workspaceMemberRepository.countByUser(user) <= 1) {
            throw new ApiException(400, "마지막 워크스페이스는 삭제할 수 없어요. 새 워크스페이스를 만든 뒤 삭제해주세요.");
        }

        // 이 워크스페이스가 유일한 워크스페이스인 다른 멤버가 있으면 삭제 불가
        List<WorkspaceMember> otherMembers = workspaceMemberRepository.findByWorkspace(workspace)
                .stream()
                .filter(m -> !m.getUser().getId().equals(user.getId()))
                .toList();

        boolean hasStranded = otherMembers.stream()
                .anyMatch(m -> workspaceMemberRepository.countByUser(m.getUser()) <= 1);

        if (hasStranded) {
            throw new ApiException(400, "이 워크스페이스가 유일한 워크스페이스인 멤버가 있어요. 해당 멤버를 내보내거나, 관리자를 위임하고 나가도록 안내한 뒤 삭제해주세요.");
        }

        // 1. DM 메시지 → DM 룸 (FK: dm_rooms.workspace_id)
        dmMessageRepository.deleteByWorkspaceId(workspaceId);
        List<DmRoom> dmRooms = dmRoomRepository.findAllByWorkspaceId(workspaceId);
        dmRoomRepository.deleteAll(dmRooms);

        // 2. 팀 모집글 및 하위 데이터 (FK: recruitment.workspace_id, cascade로 하위 삭제)
        List<Recruitment> recruitments = recruitmentRepository.findByWorkspaceId(workspaceId);
        recruitmentRepository.deleteAll(recruitments);

        // 3. 알림
        notificationRepository.deleteByWorkspaceId(workspaceId);

        // 4. 워크스페이스 삭제 (workspace_member, todo 등은 CASCADE로 처리)
        workspaceRepository.delete(workspace);
    }

    @Transactional
    public void leaveWorkspace(String userEmail, Long workspaceId) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));

        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));

        WorkspaceMember member = workspaceMemberRepository.findByWorkspaceAndUser(workspace, user)
                .orElseThrow(() -> new ApiException(403, "해당 워크스페이스의 멤버가 아닙니다."));

        if (member.getRole() == WorkspaceRole.OWNER) {
            throw new ApiException(403, "관리자는 워크스페이스에서 나갈 수 없어요. 워크스페이스를 삭제하거나 다른 멤버에게 관리자 권한을 넘겨주세요.");
        }

        // 마지막(유일한) 워크스페이스에서는 나갈 수 없다 — 나가면 소속 워크스페이스가 0개가 된다.
        if (workspaceMemberRepository.countByUser(user) <= 1) {
            throw new ApiException(400, "마지막 워크스페이스에서는 나갈 수 없어요. 다른 워크스페이스에 참여하거나 만든 뒤 나가주세요.");
        }

        workspaceMemberRepository.delete(member);
    }

    @Transactional
    public void transferOwner(String userEmail, Long workspaceId, Long targetUserId) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));

        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));

        WorkspaceMember currentMember = workspaceMemberRepository.findByWorkspaceAndUser(workspace, user)
                .orElseThrow(() -> new ApiException(403, "해당 워크스페이스의 멤버가 아닙니다."));

        if (currentMember.getRole() != WorkspaceRole.OWNER) {
            throw new ApiException(403, "관리자만 권한을 위임할 수 있어요.");
        }

        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ApiException(404, "대상 사용자를 찾을 수 없습니다."));

        WorkspaceMember targetMember = workspaceMemberRepository.findByWorkspaceAndUser(workspace, targetUser)
                .orElseThrow(() -> new ApiException(403, "대상 사용자는 해당 워크스페이스의 멤버가 아닙니다."));

        currentMember.setRole(WorkspaceRole.MEMBER);
        targetMember.setRole(WorkspaceRole.OWNER);
    }

    /**
     * 멤버 역할 변경 (ADMIN 이상). OWNER 대상·OWNER로의 승격은 불가(소유권 이전으로만).
     * 자신보다 상위/동급 대상은 변경 불가.
     */
    @Transactional
    public void changeMemberRole(String userEmail, Long workspaceId, Long targetUserId, WorkspaceRole newRole) {
        if (newRole == WorkspaceRole.OWNER) {
            throw new ApiException(400, "소유자 지정은 소유권 이전으로만 가능해요.");
        }
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));
        User requester = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));
        WorkspaceMember requesterMember = workspaceMemberRepository.findByWorkspaceAndUser(workspace, requester)
                .orElseThrow(() -> new ApiException(403, "해당 워크스페이스의 멤버가 아닙니다."));
        if (!requesterMember.getRole().atLeast(WorkspaceRole.ADMIN)) {
            throw new ApiException(403, "역할 변경은 관리자 이상만 할 수 있어요.");
        }

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ApiException(404, "대상 사용자를 찾을 수 없습니다."));
        WorkspaceMember targetMember = workspaceMemberRepository.findByWorkspaceAndUser(workspace, target)
                .orElseThrow(() -> new ApiException(404, "대상 사용자는 해당 워크스페이스의 멤버가 아닙니다."));

        if (targetMember.getRole() == WorkspaceRole.OWNER) {
            throw new ApiException(403, "소유자의 역할은 변경할 수 없어요.");
        }
        // OWNER가 아닌 요청자는 자신보다 상위/동급 대상을 변경할 수 없다.
        if (requesterMember.getRole() != WorkspaceRole.OWNER
                && !requesterMember.getRole().isHigherThan(targetMember.getRole())) {
            throw new ApiException(403, "자신과 같거나 상위 역할의 멤버는 변경할 수 없어요.");
        }

        targetMember.setRole(newRole);
    }

    /**
     * 멤버 강퇴 (ADMIN 이상). OWNER·본인은 강퇴 불가. 자신보다 상위/동급 대상도 불가.
     * 강퇴된 멤버가 작성한 콘텐츠는 유지된다(작성자 참조만 남김).
     */
    @Transactional
    public void removeMember(String userEmail, Long workspaceId, Long targetUserId) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));
        User requester = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));
        WorkspaceMember requesterMember = workspaceMemberRepository.findByWorkspaceAndUser(workspace, requester)
                .orElseThrow(() -> new ApiException(403, "해당 워크스페이스의 멤버가 아닙니다."));
        if (!requesterMember.getRole().atLeast(WorkspaceRole.ADMIN)) {
            throw new ApiException(403, "멤버 내보내기는 관리자 이상만 할 수 있어요.");
        }

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ApiException(404, "대상 사용자를 찾을 수 없습니다."));
        if (target.getId().equals(requester.getId())) {
            throw new ApiException(400, "본인은 내보낼 수 없어요. '나가기'를 이용하세요.");
        }
        WorkspaceMember targetMember = workspaceMemberRepository.findByWorkspaceAndUser(workspace, target)
                .orElseThrow(() -> new ApiException(404, "대상 사용자는 해당 워크스페이스의 멤버가 아닙니다."));

        if (targetMember.getRole() == WorkspaceRole.OWNER) {
            throw new ApiException(403, "소유자는 내보낼 수 없어요.");
        }
        if (requesterMember.getRole() != WorkspaceRole.OWNER
                && !requesterMember.getRole().isHigherThan(targetMember.getRole())) {
            throw new ApiException(403, "자신과 같거나 상위 역할의 멤버는 내보낼 수 없어요.");
        }

        workspaceMemberRepository.delete(targetMember);
    }

    public List<WorkspaceMemberResponse> getMembers(Long workspaceId, String requesterEmail) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));

        User requester = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));

        // 멤버만 조회 가능
        workspaceMemberRepository.findByWorkspaceAndUser(workspace, requester)
                .orElseThrow(() -> new ApiException(403, "해당 워크스페이스의 멤버가 아닙니다."));

        return workspaceMemberRepository.findByWorkspace(workspace).stream()
                .map(WorkspaceMemberResponse::from)
                .toList();
    }

    /**
     * 이 워크스페이스에 팀 모집 글이 있는지.
     * 예전엔 요청자를 아예 보지 않아서, 로그인만 되어 있으면 아무 워크스페이스 id 나 넣어
     * 존재 여부를 훑을 수 있었다. getMembers 와 같은 방식으로 멤버인지 먼저 확인한다.
     */
    public boolean hasRecruitments(Long workspaceId, String requesterEmail) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));

        User requester = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));

        workspaceMemberRepository.findByWorkspaceAndUser(workspace, requester)
                .orElseThrow(() -> new ApiException(403, "해당 워크스페이스의 멤버가 아닙니다."));

        return recruitmentRepository.existsByWorkspaceId(workspaceId);
    }

    @Transactional
    public String uploadWorkspaceIcon(String userEmail, Long workspaceId, MultipartFile file) throws IOException {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));

        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));

        WorkspaceMember member = workspaceMemberRepository.findByWorkspaceAndUser(workspace, user)
                .orElseThrow(() -> new ApiException(403, "해당 워크스페이스의 멤버가 아닙니다."));

        if (!member.getRole().atLeast(WorkspaceRole.ADMIN)) {
            throw new ApiException(403, "워크스페이스 아이콘 변경은 관리자 이상만 할 수 있어요.");
        }

        String originalFilename = file.getOriginalFilename();
        String ext = (originalFilename != null && originalFilename.contains("."))
                ? originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase()
                : ".jpg";

        String filename = UUID.randomUUID() + ".jpg";
        Path iconDir = Paths.get(uploadDir, "workspace-icons");
        Files.createDirectories(iconDir);
        Files.copy(ImageUtils.resizeToJpeg(file, 256), iconDir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);

        String url = "/uploads/workspace-icons/" + filename;
        workspace.setIconImageUrl(url);

        return url;
    }

    private String generateUniqueInviteCode() {
        String code;
        do {
            code = InviteCodeGenerator.generate();
        } while (workspaceRepository.existsByInviteCode(code));
        return code;
    }
}