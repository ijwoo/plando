package com.example.todo.service;

import com.example.todo.dto.SearchResultDto;
import com.example.todo.dto.SearchResultDto.*;
import com.example.todo.entity.DmMessage;
import com.example.todo.entity.DmRoom;   // room 참조용 (toMessageResult 내부)
import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceMember;
import com.example.todo.repository.DmMessageRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SearchService {

    private final WorkspaceResolver         workspaceResolver;
    private final TodoRepository            todoRepository;
    private final com.example.todo.repository.ProjectRepository projectRepository;
    private final com.example.todo.repository.TagRepository tagRepository;
    private final DmMessageRepository       dmMessageRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository            userRepository;

    /** 할 일 한 페이지 크기 — 클라이언트가 '더 보기'로 이어 받는다. */
    private static final int TASK_PAGE_SIZE = 30;

    public SearchResultDto search(String userEmail, Long workspaceId, String keyword, int page) {
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        User      me        = workspaceResolver.getUser(userEmail);

        // 한 건 더 요청해서 다음 페이지 존재 여부를 판단한다(count 쿼리 없이).
        //
        // ⚠️ PageRequest.of(page, size) 는 offset 을 page*size 로 계산한다.
        // 예전엔 size 에 TASK_PAGE_SIZE+1(=31)을 넘기면서 응답은 30건으로 잘라,
        // 2페이지가 31번째부터 시작해 **매 페이지 1건씩 영구히 건너뛰었다**
        // (30·61·92번째 결과는 어느 페이지에도 나오지 않았다).
        // offset 은 실제 표시 개수 기준, limit 은 +1 이어야 하므로 둘을 따로 지정한다.
        List<Todo> found = todoRepository.searchRanked(
                workspace, keyword, true,
                offsetLimit((long) Math.max(0, page) * TASK_PAGE_SIZE, TASK_PAGE_SIZE + 1));
        boolean hasMore = found.size() > TASK_PAGE_SIZE;
        List<TaskResult> tasks = found.stream()
                .limit(TASK_PAGE_SIZE)
                .map(this::toTaskResult)
                .toList();

        // 첫 페이지에만 다른 종류를 함께 내려준다 — 2페이지부터는 할 일만 이어 붙이면 된다.
        boolean first = page <= 0;
        return SearchResultDto.builder()
                .tasks(tasks)
                .hasMoreTasks(hasMore)
                .messages(first ? searchMessages(me, workspace, keyword) : List.of())
                .members(first ? searchMembers(workspace, keyword) : List.of())
                .projects(first ? searchProjects(workspace, keyword) : List.of())
                .tags(first ? searchTags(workspace, keyword) : List.of())
                .build();
    }

    // ── 태그 ───────────────────────────────────────────────────
    private List<SearchResultDto.TagResult> searchTags(Workspace workspace, String keyword) {
        List<com.example.todo.entity.Tag> found = tagRepository.searchByKeyword(workspace, keyword)
                .stream().limit(10).toList();
        if (found.isEmpty()) return List.of();

        // 개수는 한 번에 집계 — 태그마다 세면 N+1이 된다
        java.util.Map<Long, Long> counts = new java.util.HashMap<>();
        for (Object[] row : tagRepository.countTodosByTagIds(found.stream().map(com.example.todo.entity.Tag::getId).toList())) {
            counts.put((Long) row[0], ((Number) row[1]).longValue());
        }
        return found.stream()
                .map(t -> SearchResultDto.TagResult.builder()
                        .id(t.getId())
                        .name(t.getName())
                        .color(t.getColor())
                        .todoCount(counts.getOrDefault(t.getId(), 0L))
                        .build())
                .toList();
    }

    // ── 프로젝트 ───────────────────────────────────────────────
    private List<SearchResultDto.ProjectResult> searchProjects(Workspace workspace, String keyword) {
        return projectRepository.searchByKeyword(workspace, keyword)
                .stream()
                .limit(10)
                .map(pr -> SearchResultDto.ProjectResult.builder()
                        .id(pr.getId())
                        .name(pr.getName())
                        .color(pr.getColor())
                        .openCount(todoRepository.countByProjectAndArchivedFalseAndDoneAtIsNull(pr))
                        .build())
                .toList();
    }

    // ── 메시지 (전체 메시지 내용 검색, 룸별 최신 1건) ────────────
    private List<MessageResult> searchMessages(User me, Workspace workspace, String keyword) {
        Map<Long, DmMessage> byRoom = new LinkedHashMap<>();
        for (DmMessage msg : dmMessageRepository.searchByContent(me.getId(), workspace.getId(), keyword)) {
            byRoom.putIfAbsent(msg.getRoom().getId(), msg);  // 룸당 가장 최신 매칭 메시지 1건
            if (byRoom.size() >= 10) break;
        }
        return byRoom.values().stream()
                .map(msg -> toMessageResult(msg, me))
                .toList();
    }

    // ── 멤버 ──────────────────────────────────────────────────
    private List<MemberResult> searchMembers(Workspace workspace, String keyword) {
        return workspaceMemberRepository.searchByKeyword(workspace, keyword)
                .stream()
                .limit(10)
                .map(this::toMemberResult)
                .toList();
    }

    // ── 변환 ──────────────────────────────────────────────────

    private TaskResult toTaskResult(Todo todo) {
        return TaskResult.builder()
                .id(todo.getId())
                .title(todo.getTitle())
                .status(todo.getStatus())
                .priority(todo.getPriority() != null ? todo.getPriority().name() : null)
                .dueDate(todo.getDueDate() != null ? todo.getDueDate().toString() : null)
                .archived(Boolean.TRUE.equals(todo.getArchived()))
                .assignees(todo.getAssignees().stream()
                        .map(u -> AssigneeInfo.builder()
                                .name(u.getName())
                                .profileImageUrl(u.getProfileImageUrl())
                                .build())
                        .toList())
                .build();
    }

    private MessageResult toMessageResult(DmMessage msg, User me) {
        DmRoom room = msg.getRoom();
        User partner = room.getParticipants().stream()
                .filter(u -> !u.getId().equals(me.getId()))
                .findFirst()
                .orElse(me);

        return MessageResult.builder()
                .roomId(room.getId())
                .partnerId(partner.getId())
                .partnerName(partner.getName())
                .partnerProfileImageUrl(partner.getProfileImageUrl())
                .lastMessage(msg.getContent())   // 매칭된 메시지 내용
                .sentAt(msg.getSentAt())
                .build();
    }

    private MemberResult toMemberResult(WorkspaceMember wm) {
        User u = wm.getUser();
        return MemberResult.builder()
                .userId(u.getId())
                .name(u.getName())
                .email(u.getEmail())
                .profileImageUrl(u.getProfileImageUrl())
                .role(wm.getRole().name())
                .build();
    }

    /**
     * offset·limit 을 따로 지정하는 Pageable.
     *
     * Spring 의 PageRequest 는 offset 을 page*size 로만 계산해서, "다음 페이지 존재 확인용으로
     * 한 건 더 가져오기"와 함께 쓸 수 없다(size 를 +1 하면 offset 도 함께 어긋난다).
     * 정렬은 쿼리(@Query)가 직접 하므로 여기서는 Sort.unsorted() 로 둔다.
     */
    private static org.springframework.data.domain.Pageable offsetLimit(long offset, int limit) {
        return new org.springframework.data.domain.Pageable() {
            @Override public int getPageNumber() { return limit == 0 ? 0 : (int) (offset / limit); }
            @Override public int getPageSize() { return limit; }
            @Override public long getOffset() { return offset; }
            @Override public org.springframework.data.domain.Sort getSort() {
                return org.springframework.data.domain.Sort.unsorted();
            }
            @Override public org.springframework.data.domain.Pageable next() { return offsetLimit(offset + limit, limit); }
            @Override public org.springframework.data.domain.Pageable previousOrFirst() {
                return offset <= 0 ? first() : offsetLimit(Math.max(0, offset - limit), limit);
            }
            @Override public org.springframework.data.domain.Pageable first() { return offsetLimit(0, limit); }
            @Override public org.springframework.data.domain.Pageable withPage(int pageNumber) {
                return offsetLimit((long) pageNumber * limit, limit);
            }
            @Override public boolean hasPrevious() { return offset > 0; }
        };
    }
}
