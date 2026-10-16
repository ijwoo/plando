package com.example.todo.service;

import com.example.todo.dto.CommentCreateRequest;
import com.example.todo.dto.CommentResponse;
import java.util.stream.Collectors;
import java.util.Map;
import com.example.todo.entity.Comment;
import com.example.todo.entity.NotificationType;
import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.CommentRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import com.example.todo.util.MentionExtractor;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CommentService {

    private final CommentRepository commentRepository;
    private final TodoRepository todoRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final PermissionService permissionService;

    public List<CommentResponse> getComments(Long todoId, String requesterEmail) {
        Todo todo = todoRepository.findById(todoId)
                .orElseThrow(() -> new ApiException(404, "작업을 찾을 수 없습니다."));
        requireWorkspaceMember(todo, requesterEmail);
        List<Comment> comments = commentRepository.findByTodoIdOrderByCreatedAtAsc(todoId);

        /* 작성자 사진은 한 번에 조회한다 — 댓글마다 찾으면 N+1 이다.
           Comment 는 작성자 이메일·이름만 들고 있어(비정규화) 사진은 여기서 붙여야 한다. */
        Map<String, String> imageByEmail = comments.isEmpty() ? Map.of()
                : userRepository.findByEmailIn(comments.stream().map(Comment::getWriterEmail)
                        .filter(Objects::nonNull).distinct().toList())
                .stream()
                .filter(u -> u.getProfileImageUrl() != null)
                .collect(Collectors.toMap(User::getEmail, User::getProfileImageUrl, (a, b) -> a));

        return comments.stream()
                .map(c -> CommentResponse.from(c, imageByEmail.get(c.getWriterEmail())))
                .toList();
    }

    @Transactional
    public CommentResponse createComment(CommentCreateRequest request, Authentication authentication) {
        String writerEmail = authentication.getName();

        Todo todo = todoRepository.findById(request.getTodoId())
                .orElseThrow(() -> new ApiException(404, "작업을 찾을 수 없습니다."));
        requireWorkspaceMember(todo, writerEmail);
        if (Boolean.TRUE.equals(todo.getIsSample())) {
            throw new ApiException(403, "샘플 데이터는 수정하거나 삭제할 수 없습니다.");
        }

        User writer = userRepository.findByEmail(writerEmail)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));

        Comment comment = Comment.builder()
                .todoId(request.getTodoId())
                .content(request.getContent())
                .writerEmail(writerEmail)
                .writerName(writer.getName() != null ? writer.getName()
                        : (writerEmail.contains("@") ? writerEmail.split("@")[0] : writerEmail))
                .build();

        Comment saved = commentRepository.save(comment);

        // @멘션 먼저 처리 (멘션은 더 강한 신호) → 멘션된 emails 반환
        Set<String> mentionedEmails = notifyMentionedUsers(todo, saved, writerEmail);

        // 담당자 알림 — 이미 멘션 알림 받은 사람은 제외
        notifyAssigneesForComment(todo, saved, writerEmail, mentionedEmails);

        return CommentResponse.from(saved);
    }

    @Transactional
    public void deleteComment(Long commentId, Authentication authentication) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ApiException(404, "댓글을 찾을 수 없습니다."));

        Todo todo = todoRepository.findById(comment.getTodoId())
                .orElseThrow(() -> new ApiException(404, "작업을 찾을 수 없습니다."));
        // 삭제 = 작성자 본인 || ADMIN 이상(모더레이션). 멤버십도 함께 검증됨.
        permissionService.requireCanDeleteComment(authentication.getName(), comment, todo);

        commentRepository.delete(comment);
    }

    /** 멘션 알림 발송 후 멘션된 사용자 emails를 반환 (담당자 알림에서 중복 제거에 사용). */
    private Set<String> notifyMentionedUsers(Todo todo, Comment comment, String writerEmail) {
        Workspace workspace = todo.getWorkspace();
        if (workspace == null) return Set.of();
        Long workspaceId = workspace.getId();

        List<User> workspaceUsers = workspaceMemberRepository.findByWorkspace(workspace).stream()
                .map(wm -> wm.getUser())
                .filter(Objects::nonNull)
                .toList();

        Set<String> mentionedEmails = MentionExtractor.extractMentionedEmails(
                comment.getContent(), workspaceUsers, writerEmail);

        if (mentionedEmails.isEmpty()) return Set.of();

        String writerName = comment.getWriterName() != null ? comment.getWriterName() : writerEmail;
        String todoTitle = todo.getTitle() != null ? todo.getTitle() : "작업";

        mentionedEmails.forEach(receiverEmail ->
                notificationService.createNotification(
                        receiverEmail,
                        writerEmail,
                        NotificationType.MENTION.name(),
                        writerName + "님이 댓글에서 회원님을 멘션했어요",
                        "[" + todoTitle + "] 댓글: " + truncate(comment.getContent(), 60),
                        todo.getId(),
                        workspaceId
                )
        );

        return mentionedEmails;
    }

    private void requireWorkspaceMember(Todo todo, String email) {
        Workspace workspace = todo.getWorkspace();
        if (workspace == null) {
            throw new ApiException(403, "워크스페이스 정보가 없는 작업입니다.");
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));
        boolean isMember = workspaceMemberRepository
                .findByWorkspaceAndUser(workspace, user)
                .isPresent();
        if (!isMember) {
            throw new ApiException(403, "해당 워크스페이스에 접근 권한이 없습니다.");
        }
    }

    private String truncate(String text, int max) {
        if (text == null) return "";
        return text.length() <= max ? text : text.substring(0, max) + "...";
    }

    private void notifyAssigneesForComment(Todo todo, Comment comment, String writerEmail, Set<String> excludeEmails) {
        if (todo.getAssignees() == null || todo.getAssignees().isEmpty()) {
            return;
        }

        String todoTitle = todo.getTitle() != null ? todo.getTitle() : "작업";
        String writerName = comment.getWriterName() != null ? comment.getWriterName() : writerEmail;

        Long workspaceId = todo.getWorkspace() != null ? todo.getWorkspace().getId() : null;

        todo.getAssignees().stream()
                .filter(Objects::nonNull)
                .map(User::getEmail)
                .filter(Objects::nonNull)
                .distinct()
                .filter(receiverEmail -> !receiverEmail.equals(writerEmail)) // 본인 제외
                .filter(receiverEmail -> !excludeEmails.contains(receiverEmail)) // 멘션 알림 받은 사람 제외
                .forEach(receiverEmail ->
                        notificationService.createNotification(
                                receiverEmail,
                                writerEmail,
                                NotificationType.COMMENT.name(),
                                "새 댓글이 등록되었습니다.",
                                writerName + "님이 [" + todoTitle + "] 작업에 댓글을 남겼습니다.",
                                todo.getId(),
                                workspaceId
                        )
                );
    }
}