package com.example.todo.service;

import com.example.todo.entity.DmRoom;
import com.example.todo.entity.Recruitment;
import com.example.todo.entity.Workspace;
import com.example.todo.repository.CommentRepository;
import com.example.todo.repository.DmMessageRepository;
import com.example.todo.repository.DmRoomRepository;
import com.example.todo.repository.LocationTriggerRepository;
import com.example.todo.repository.LogRepository;
import com.example.todo.repository.NotificationRepository;
import com.example.todo.repository.ProjectRepository;
import com.example.todo.repository.RecruitmentRepository;
import com.example.todo.repository.TodoChecklistRepository;
import com.example.todo.repository.TodoRecurrenceRepository;
import com.example.todo.repository.TagRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.TodoTemplateRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.UserSettingsRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import com.example.todo.repository.WorkspaceRepository;
import com.example.todo.util.GuestUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 게스트 계정이 만든 모든 잔류 데이터를 즉시 청소.
 * AuthController.guestLogin 진입 직전에 호출되어, 다음 게스트 사용자가
 * 이전 사용자의 알림/DM/댓글/로그를 보지 않도록 한다.
 *
 * 정리 대상:
 *   - 알림 (게스트가 보낸 + 받은)
 *   - DM 메시지 (게스트 sender)
 *   - DM 방 멤버십 (참여자에서 게스트 제거) + 고아 방 정리
 *   - 댓글 (게스트 writer)
 *   - Todo 변경 로그 (게스트 modifier)
 *   - 워크스페이스 멤버십 (게스트 user)
 *   - 게스트가 만든 비샘플 Todo (assignees/checklist/recurrence/location_triggers 포함 cascade)
 *
 * 기존 GuestCleanupScheduler(매일 새벽 4시, 24h 기준)는 안전망으로 그대로 유지.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GuestCleanupService {

    private final NotificationRepository notificationRepository;
    private final DmMessageRepository dmMessageRepository;
    private final DmRoomRepository dmRoomRepository;
    private final CommentRepository commentRepository;
    private final LogRepository logRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final WorkspaceRepository workspaceRepository;
    private final RecruitmentRepository recruitmentRepository;
    private final TodoRepository todoRepository;
    private final LocationTriggerRepository locationTriggerRepository;
    private final TodoChecklistRepository checklistRepository;
    private final TodoRecurrenceRepository recurrenceRepository;
    private final TodoTemplateRepository todoTemplateRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final UserSettingsRepository userSettingsRepository;
    private final TagRepository tagRepository;
    private final com.example.todo.repository.TodoTagRepository todoTagRepository;

    private static final List<String> GUEST_EMAILS = GuestUtils.GUEST_EMAILS_LIST;

    @Transactional
    public void cleanupAllGuestData() {
        // 1. 알림 — 게스트 sender/receiver 모두
        notificationRepository.deleteAllByGuestEmails(GUEST_EMAILS);

        // 2. 댓글 (writer = guest)
        commentRepository.deleteAllByWriterEmails(GUEST_EMAILS);

        // 3. Todo 변경 로그 (modifier = guest)
        logRepository.deleteAllByModifierEmails(GUEST_EMAILS);

        // 4. DM 메시지 (sender = guest) 후 멤버십 제거 + 고아 방 삭제 순으로
        //    샘플 워크스페이스의 시드 DM방은 메시지만 휘발 → 다음 게스트가 다시 사용
        dmMessageRepository.deleteAllBySenderEmails(GUEST_EMAILS);
        dmRoomRepository.removeGuestParticipants(GUEST_EMAILS);
        dmRoomRepository.deleteEmptyRooms();

        // 5. 게스트가 만든 비샘플 Todo — FK 순서대로 cascade (샘플 시드 Todo는 is_sample=true라 제외됨)
        List<Long> todoIds = todoRepository.findAllGuestTodoIds(GUEST_EMAILS);
        if (!todoIds.isEmpty()) {
            locationTriggerRepository.deleteAllByTodoIdIn(todoIds);
            checklistRepository.deleteByTodoIdIn(todoIds);
            recurrenceRepository.deleteBySourceTodoIdIn(todoIds);
            todoRepository.deleteAssigneesByTodoIds(todoIds);
            todoRepository.deleteGuestTodosByIds(todoIds);
            log.info("[GuestCleanupService] 게스트 Todo {} 건 cascade 삭제", todoIds.size());
        }

        // 5-1. 게스트가 만든 프로젝트 삭제 — 샘플 워크스페이스는 삭제되지 않아 그 안의 게스트 프로젝트가 누적됨.
        //      참조 todo(샘플 todo를 옮겨둔 경우 등)의 project_id를 먼저 null 처리해 FK 제약 해소 후 삭제.
        List<Long> guestProjectIds = projectRepository.findGuestProjectIds(GUEST_EMAILS);
        if (!guestProjectIds.isEmpty()) {
            todoRepository.clearProjectByProjectIds(guestProjectIds);
            projectRepository.deleteAllByIdInBatch(guestProjectIds);
            log.info("[GuestCleanupService] 게스트 프로젝트 {} 건 삭제", guestProjectIds.size());
        }

        // 6. 게스트가 OWNER인 비샘플 워크스페이스 cascade 삭제 (샘플 워크스페이스는 isSample=true라 제외)
        //    WorkspaceService.deleteWorkspace의 cascade 패턴 따라감.
        List<Workspace> guestOwnedWorkspaces = workspaceRepository.findGuestOwnedNonSampleWorkspaces(GUEST_EMAILS);
        for (Workspace ws : guestOwnedWorkspaces) {
            Long wsId = ws.getId();
            // DM 메시지 → DM 룸
            dmMessageRepository.deleteByWorkspaceId(wsId);
            List<DmRoom> dmRooms = dmRoomRepository.findAllByWorkspaceId(wsId);
            dmRoomRepository.deleteAll(dmRooms);
            // 모집글 (cascade로 application/question/role 등 하위 삭제)
            List<Recruitment> recruitments = recruitmentRepository.findByWorkspaceId(wsId);
            recruitmentRepository.deleteAll(recruitments);
            // 알림 (workspace 단위)
            notificationRepository.deleteByWorkspaceId(wsId);
            // 워크스페이스 본체 (workspace_member, todos 등은 entity cascade)
            workspaceRepository.delete(ws);
        }
        if (!guestOwnedWorkspaces.isEmpty()) {
            log.info("[GuestCleanupService] 게스트 비샘플 워크스페이스 {} 건 cascade 삭제", guestOwnedWorkspaces.size());
        }

        // 7. 남은 게스트 멤버십 정리 (샘플 워크스페이스 제외 — repository 쿼리에서 자체 필터)
        //    위 6번에서 cascade로 빠진 것 외에, 일반 회원 워크스페이스에 들어가있던 게스트 멤버십도 제거.
        workspaceMemberRepository.deleteAllByUserEmails(GUEST_EMAILS);

        // 8. 게스트가 만든 Todo 템플릿 제거
        todoTemplateRepository.deleteAllByCreatorEmails(GUEST_EMAILS);

        // 8-1. 게스트가 만든 태그 제거. 태그는 삭제 권한이 ADMIN 이상이라 게스트가 스스로 지울 수
        //      없고, 샘플 워크스페이스는 삭제되지 않는다 — 그대로 두면 방문자가 만든 태그가 영구히
        //      쌓여 다음 사람의 태그 목록을 채운다. 시드 태그는 created_by 가 null 이라 제외된다.
        List<Long> guestTagIds = tagRepository.findGuestTagIds(GUEST_EMAILS);
        if (!guestTagIds.isEmpty()) {
            todoTagRepository.deleteByTagIdIn(guestTagIds);   // 부착 관계 먼저 (FK)
            tagRepository.deleteAllByIdInBatch(guestTagIds);
            log.info("[GuestCleanupService] 게스트 태그 {} 건 삭제", guestTagIds.size());
        }

        // 9. 게스트 User 프로필 초기화 — 이전 사용자가 바꿔둔 이름/아바타가 다음 사용자에게 그대로 보이지 않게.
        //    guestLoginCount/lastGuestLoginAt은 통계용이라 보존 (reset 안 함).
        for (String email : GUEST_EMAILS) {
            userRepository.findByEmail(email).ifPresent(u -> {
                // email "guestN@plando.app" → 표시명 "게스트 N"
                String prefix = u.getEmail().replaceAll("@.*$", "");
                String numberPart = prefix.replaceAll("\\D+", ""); // "guest3" → "3"
                String defaultName = numberPart.isEmpty() ? "게스트" : "게스트 " + numberPart;
                u.setName(defaultName);
                u.setProfileImageUrl(null);
                userRepository.save(u);
            });
        }

        // 10. 게스트 대시보드 개인화(메모/북마크/레이아웃)를 **기본 시드로 되돌린다.**
        //     이전 게스트의 메모가 다음 사람에게 보이면 안 되지만, 그냥 비우면 둘러보기 첫 화면이
        //     빈 카드만 남아 써볼 게 없어진다. 그래서 비우는 대신 시드를 다시 깐다.
        userSettingsRepository.resetDashboardForGuestEmails(
                GUEST_EMAILS,
                com.example.todo.util.GuestDashboardSeed.LAYOUT,
                com.example.todo.util.GuestDashboardSeed.BOOKMARKS,
                com.example.todo.util.GuestDashboardSeed.STICKIES);

        log.info("[GuestCleanupService] 게스트 잔류 데이터 일괄 정리 완료");
    }
}
