package com.example.todo.service;

import com.example.todo.exception.ApiException;
import com.example.todo.dto.DmMessageResponse;
import com.example.todo.dto.DmPartnerProfileResponse;
import com.example.todo.dto.DmPartnerProfileResponse.SharedTodoInfo;
import com.example.todo.dto.DmPartnerProfileResponse.SharedFileInfo;
import com.example.todo.dto.DmRoomResponse;
import com.example.todo.entity.DmMessage;
import com.example.todo.entity.NotificationType;
import com.example.todo.entity.DmRoom;
import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceMember;
import com.example.todo.repository.DmMessageRepository;
import com.example.todo.repository.DmRoomRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.entity.DmMessageReaction;
import com.example.todo.entity.DmRoomRead;
import com.example.todo.repository.DmMessageReactionRepository;
import com.example.todo.repository.DmRoomReadRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import com.example.todo.repository.WorkspaceRepository;
import com.example.todo.util.MentionExtractor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DmService {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    private final DmRoomRepository dmRoomRepository;
    private final DmMessageRepository dmMessageRepository;
    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final NotificationService notificationService;
    private final TodoRepository            todoRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final DmMessageReactionRepository reactionRepository;
    private final DmRoomReadRepository dmRoomReadRepository;
    private final DmSuggestionService dmSuggestionService;

    // per-user 읽음 기록이 없을 때의 기준 시각 (전부 안읽음으로 간주)
    private static final LocalDateTime EPOCH = LocalDateTime.of(1970, 1, 1, 0, 0);

    public List<DmRoomResponse> getMyRooms(String email, Long workspaceId) {
        User me = getUser(email);
        if (workspaceId != null) {
            Workspace workspace = workspaceRepository.findById(workspaceId)
                    .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));
            requireWorkspaceMember(workspace, me);
        }
        List<DmRoom> rooms = dmRoomRepository.findAllByParticipantIdAndWorkspaceId(me.getId(), workspaceId);

        return rooms.stream().map(room -> {
            long unread = unreadCount(room.getId(), me.getId());
            if (Boolean.TRUE.equals(room.getIsGroup())) {
                return DmRoomResponse.ofGroup(room, unread);
            }
            User partner = room.getParticipants().stream()
                    .filter(u -> !u.getId().equals(me.getId()))
                    .findFirst()
                    .orElse(me);
            return DmRoomResponse.of(room, me, partner, unread);
        }).toList();
    }

    @Transactional
    public DmRoomResponse createGroupRoom(String myEmail, List<Long> memberIds, String groupName, Long workspaceId) {
        User me = getUser(myEmail);
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));
        requireWorkspaceMember(workspace, me);

        List<User> participants = new ArrayList<>();
        participants.add(me);
        for (Long memberId : memberIds) {
            if (!memberId.equals(me.getId())) {
                userRepository.findById(memberId).ifPresent(candidate -> {
                    requireWorkspaceMember(workspace, candidate);
                    participants.add(candidate);
                });
            }
        }

        if (participants.size() < 2) {
            throw new ApiException(400, "그룹 채팅에는 1명 이상의 다른 멤버가 필요합니다.");
        }

        // 참여자 집합이 완전히 같은 그룹이 이미 있으면 그 방을 재사용한다 (1:1 getOrCreate와 같은 정책).
        // 중복 방지가 없어서 같은 3명으로 두 사람이 각자 그룹을 만들면 방이 2개 생기고 대화가 갈라졌다.
        // 방 이름은 판별에 쓰지 않는다 — 이름만 다른 같은 멤버 조합이 바로 그 갈라짐의 원인이므로.
        Set<Long> wantedIds = participants.stream().map(User::getId).collect(Collectors.toSet());
        for (DmRoom existing : dmRoomRepository.findGroupRoomsWithParticipants(workspaceId)) {
            Set<Long> existingIds = existing.getParticipants().stream().map(User::getId).collect(Collectors.toSet());
            if (existingIds.equals(wantedIds)) {
                return DmRoomResponse.ofGroup(existing, unreadCount(existing.getId(), me.getId()));
            }
        }

        String name = (groupName != null && !groupName.isBlank()) ? groupName.trim() : null;

        DmRoom room = DmRoom.builder()
                .workspace(workspace)
                .participants(participants)
                .isGroup(true)
                .groupName(name)
                .build();

        dmRoomRepository.save(room);
        return DmRoomResponse.ofGroup(room, 0);
    }

    @Transactional
    public DmRoomResponse getOrCreateRoom(String myEmail, Long partnerId, Long workspaceId) {
        User me = getUser(myEmail);
        User partner = userRepository.findById(partnerId)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));
        requireWorkspaceMember(workspace, me);
        requireWorkspaceMember(workspace, partner);

        DmRoom room = dmRoomRepository.findRoomsBetween(me.getId(), partner.getId(), workspaceId)
                .stream().findFirst()
                .orElseGet(() -> {
                    List<User> participants = new ArrayList<>();
                    participants.add(me);
                    participants.add(partner);
                    DmRoom newRoom = DmRoom.builder()
                            .workspace(workspace)
                            .participants(participants)
                            .build();
                    return dmRoomRepository.save(newRoom);
                });

        long unread = unreadCount(room.getId(), me.getId());
        return DmRoomResponse.of(room, me, partner, unread);
    }

    @Transactional
    public DmRoomResponse inviteToGroupRoom(String myEmail, Long roomId, List<Long> memberIds) {
        User me = getUser(myEmail);
        DmRoom room = getRoom(roomId);
        validateParticipant(room, me);

        if (!Boolean.TRUE.equals(room.getIsGroup())) {
            throw new ApiException(400, "1:1 채팅에는 멤버를 초대할 수 없습니다.");
        }

        Workspace workspace = room.getWorkspace();
        List<User> current = room.getParticipants();
        for (Long memberId : memberIds) {
            boolean alreadyIn = current.stream().anyMatch(u -> u.getId().equals(memberId));
            if (!alreadyIn) {
                userRepository.findById(memberId).ifPresent(candidate -> {
                    requireWorkspaceMember(workspace, candidate);
                    current.add(candidate);
                });
            }
        }
        dmRoomRepository.save(room);

        long unread = unreadCount(room.getId(), me.getId());
        return DmRoomResponse.ofGroup(room, unread);
    }

    public List<DmMessageResponse> getMessages(String email, Long roomId) {
        return getMessages(email, roomId, null, 30);
    }

    /**
     * 페이지네이션 메시지 조회. before=null이면 최신 size개, before가 있으면 그 id보다 오래된 size개.
     * 항상 시간 오름차순(ASC)으로 반환 (화면 표시 순서).
     */
    @Transactional(readOnly = true)
    public List<DmMessageResponse> getMessages(String email, Long roomId, Long before, int size) {
        User me = getUser(email);
        DmRoom room = getRoom(roomId);
        validateParticipant(room, me);

        int pageSize = (size <= 0 || size > 100) ? 30 : size;
        PageRequest page = PageRequest.of(0, pageSize);
        List<DmMessage> desc = (before == null)
                ? dmMessageRepository.findByRoomIdOrderByIdDesc(roomId, page)
                : dmMessageRepository.findByRoomIdAndIdLessThanOrderByIdDesc(roomId, before, page);

        List<DmMessage> asc = new ArrayList<>(desc);
        java.util.Collections.reverse(asc); // 최신순 → 오름차순
        return enrichBatch(asc, me.getId());
    }

    /** 대화 내 검색 — 내용 매칭 메시지(최신순, 최대 50개). */
    @Transactional(readOnly = true)
    public List<DmMessageResponse> searchInRoom(String email, Long roomId, String q) {
        User me = getUser(email);
        DmRoom room = getRoom(roomId);
        validateParticipant(room, me);
        if (q == null || q.trim().isEmpty()) return List.of();
        List<DmMessage> found = dmMessageRepository
                .findByRoomIdAndContentContainingIgnoreCaseOrderByIdDesc(roomId, q.trim(), PageRequest.of(0, 50));
        return enrichBatch(found, me.getId());
    }

    @Transactional
    public DmMessageResponse sendMessage(String senderEmail, Long roomId, String content) {
        return sendMessage(senderEmail, roomId, content, null, null, null);
    }

    @Transactional
    public DmMessageResponse sendMessage(String senderEmail, Long roomId, String content, String tag, Long linkedTodoId) {
        return sendMessage(senderEmail, roomId, content, tag, linkedTodoId, null);
    }

    @Transactional
    public DmMessageResponse sendMessage(String senderEmail, Long roomId, String content, String tag, Long linkedTodoId, Long replyToId) {
        User sender = getUser(senderEmail);
        DmRoom room = getRoom(roomId);
        validateParticipant(room, sender);

        // 내용 null-safe + 빈 메시지 차단 (linkedTodo만 있는 메시지는 내용 없이 허용)
        String body = content == null ? "" : content.trim();
        if (body.isEmpty() && linkedTodoId == null) {
            throw new ApiException(400, "메시지 내용을 입력하세요.");
        }
        // content 컬럼은 varchar(2000). 넘기면 INSERT 가 DB 오류로 실패하고 사용자는 이유를 모른다.
        if (body.length() > 2000) {
            throw new ApiException(400, "메시지는 2000자까지 보낼 수 있어요.");
        }

        // 답장 대상은 같은 방의 메시지만 허용
        Long validReplyTo = null;
        if (replyToId != null) {
            validReplyTo = dmMessageRepository.findById(replyToId)
                    .filter(r -> r.getRoom().getId().equals(roomId))
                    .map(DmMessage::getId)
                    .orElse(null);
        }

        /* 연결 할 일도 답장 대상과 같은 수준으로 검증한다.
           예전엔 클라이언트가 준 id 를 그대로 저장했고, 조회 시 findById 로 워크스페이스
           스코프 없이 읽어 제목·상태를 응답에 실었다. 임의 정수를 넣어 보내면 **다른 팀의
           할 일 제목이 그대로 돌아왔다**(id 를 훑으면 전체 덤프). */
        Long validLinkedTodo = null;
        if (linkedTodoId != null) {
            validLinkedTodo = todoRepository.findById(linkedTodoId)
                    .filter(t -> t.getWorkspace() != null && room.getWorkspace() != null
                            && t.getWorkspace().getId().equals(room.getWorkspace().getId()))
                    .map(Todo::getId)
                    .orElse(null);
        }

        DmMessage message = DmMessage.builder()
                .room(room)
                .sender(sender)
                .content(body)
                .tag(tag)
                .linkedTodoId(validLinkedTodo)
                .replyToId(validReplyTo)
                .build();
        dmMessageRepository.save(message);

        /* 방 목록 미리보기. 1:1 방은 예전에 **본문을 통째로** 넣었는데, lastMessage 는 varchar(500)
           이고 메시지 본문은 2000자까지 허용된다. 그래서 501자 이상을 보내면 이 UPDATE 가 터지고,
           이 메서드가 @Transactional 이라 방금 넣은 메시지 INSERT 까지 함께 롤백됐다.
           사용자에겐 일반 오류만 뜨고 쓴 글이 통째로 사라졌다. 1:1 도 미리보기이므로 잘라 담는다.
           (그룹은 이름 접두사 때문에 30자로 더 짧게 자르던 기존 규칙 유지) */
        String lastMsgText = Boolean.TRUE.equals(room.getIsGroup())
                ? sender.getName() + ": " + preview(body, 30)
                : preview(body, 200);
        room.setLastMessage(clampToColumn(lastMsgText, 500));
        room.setLastMessageAt(LocalDateTime.now());
        dmRoomRepository.save(room);

        // 멘션 추출 — 댓글 멘션과 동일한 규칙 (MentionExtractor utility).
        // 단 1:1 톡방은 멘션 자체가 의미 없어 skip (받을 사람이 한 명뿐).
        Set<String> mentionedEmails = Boolean.TRUE.equals(room.getIsGroup())
                ? MentionExtractor.extractMentionedEmails(body, room.getParticipants(), sender.getEmail())
                : Set.of();

        // 알림 전송 — 멘션된 사용자는 DM_MENTION 우선, 그 외는 일반 DM_RECEIVED
        // workspaceId를 null로 넘기고 있어서 알림함/미읽음 수 조회(workspace_id = ? 조건)에 절대 잡히지 않았다.
        // 푸시만 도착하고 인앱 목록은 비어 있던 원인 — DM 방의 워크스페이스를 그대로 넘긴다.
        Long roomWorkspaceId = room.getWorkspace().getId();
        String previewBody = body.length() > 50 ? body.substring(0, 50) + "..." : body;
        room.getParticipants().stream()
                .filter(u -> !u.getId().equals(sender.getId()))
                .forEach(receiver -> {
                    if (mentionedEmails.contains(receiver.getEmail())) {
                        notificationService.createNotification(
                                receiver.getEmail(),
                                sender.getEmail(),
                                NotificationType.DM_MENTION.name(),
                                "DM에서 " + sender.getName() + "님이 멘션했어요",
                                previewBody,
                                room.getId(),
                                roomWorkspaceId
                        );
                    } else {
                        notificationService.createNotification(
                                receiver.getEmail(),
                                sender.getEmail(),
                                NotificationType.DM_RECEIVED.name(),
                                sender.getName(),
                                previewBody,
                                room.getId(),
                                roomWorkspaceId
                        );
                    }
                });

        // AI 할 일 제안 — 프리필터 통과 시에만, 커밋 후 비동기 분석 (외부 API는 트랜잭션 밖 규칙)
        if (dmSuggestionService.shouldAnalyze(body, tag, linkedTodoId)) {
            final Long msgId = message.getId();
            final Long wsId = room.getWorkspace().getId();
            final String sName = sender.getName();
            final String sEmail = sender.getEmail();
            // owner=receiver 후보: 1:1은 상대, 그룹은 멘션된 사람(있으면) — "@재우 이거 부탁해요"
            final String partnerEmail = Boolean.TRUE.equals(room.getIsGroup())
                    ? mentionedEmails.stream().findFirst().orElse(null)
                    : room.getParticipants().stream()
                        .map(User::getEmail)
                        .filter(e -> !e.equals(sender.getEmail()))
                        .findFirst().orElse(null);
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    dmSuggestionService.analyze(roomId, msgId, wsId, sName, sEmail, partnerEmail, body);
                }
            });
        }

        return enrich(message, sender.getId());
    }

    // ── 메시지 수정 ────────────────────────────────────────────────────────
    @Transactional
    public DmMessageResponse updateMessage(String senderEmail, Long roomId, Long messageId, String newContent) {
        User sender = getUser(senderEmail);
        DmMessage message = dmMessageRepository.findById(messageId)
                .orElseThrow(() -> new ApiException(404, "메시지를 찾을 수 없습니다."));
        if (!message.getRoom().getId().equals(roomId)) {
            throw new ApiException(403, "잘못된 채팅방입니다.");
        }
        if (!message.getSender().getId().equals(sender.getId())) {
            throw new ApiException(403, "본인이 보낸 메시지만 수정할 수 있습니다.");
        }
        message.setContent(newContent == null ? "" : newContent);
        message.setEditedAt(LocalDateTime.now());
        dmMessageRepository.save(message);
        return enrich(message, sender.getId());
    }

    /** 메시지를 공지로 등록/해제 (참여자 누구나 가능). pinned=true → tag NOTICE, false → tag 제거 */
    @Transactional
    public DmMessageResponse setNotice(String callerEmail, Long roomId, Long messageId, boolean pinned) {
        User caller = getUser(callerEmail);
        DmMessage message = dmMessageRepository.findById(messageId)
                .orElseThrow(() -> new ApiException(404, "메시지를 찾을 수 없습니다."));
        if (!message.getRoom().getId().equals(roomId)) {
            throw new ApiException(403, "잘못된 채팅방입니다.");
        }
        validateParticipant(message.getRoom(), caller);
        message.setTag(pinned ? "NOTICE" : null);
        dmMessageRepository.save(message);
        return enrich(message, caller.getId());
    }

    // ── 이모지 reaction 토글 ───────────────────────────────────────────────
    @Transactional
    public DmMessageResponse toggleReaction(String callerEmail, Long roomId, Long messageId, String emoji) {
        if (emoji == null || emoji.isBlank() || emoji.length() > 20) {
            throw new ApiException(400, "유효하지 않은 이모지입니다.");
        }
        User caller = getUser(callerEmail);
        DmMessage message = dmMessageRepository.findById(messageId)
                .orElseThrow(() -> new ApiException(404, "메시지를 찾을 수 없습니다."));
        if (!message.getRoom().getId().equals(roomId)) {
            throw new ApiException(403, "잘못된 채팅방입니다.");
        }
        validateParticipant(message.getRoom(), caller);

        Optional<DmMessageReaction> existing = reactionRepository
                .findByMessageIdAndUserIdAndEmoji(messageId, caller.getId(), emoji);
        if (existing.isPresent()) {
            reactionRepository.delete(existing.get());
        } else {
            reactionRepository.save(DmMessageReaction.builder()
                    .messageId(messageId)
                    .userId(caller.getId())
                    .emoji(emoji)
                    .build());
        }
        return enrich(message, caller.getId());
    }

    // ── enrich helpers ─────────────────────────────────────────────────────
    /** 단일 메시지의 reactions / linkedTodo 정보를 채워 응답으로. */
    private DmMessageResponse enrich(DmMessage message, Long callerUserId) {
        List<DmMessageReaction> reactions = reactionRepository.findByMessageIdIn(List.of(message.getId()));
        Map<String, Integer> counts = new HashMap<>();
        List<String> mine = new ArrayList<>();
        for (DmMessageReaction r : reactions) {
            counts.merge(r.getEmoji(), 1, Integer::sum);
            if (callerUserId != null && callerUserId.equals(r.getUserId())) {
                mine.add(r.getEmoji());
            }
        }

        String linkedTitle = null;
        String linkedStatus = null;
        if (message.getLinkedTodoId() != null) {
            // 저장 시점에도 막지만, 이미 들어가 있는 과거 데이터가 있을 수 있어 조회에서도 스코프를 건다.
            Long roomWsId = message.getRoom() != null && message.getRoom().getWorkspace() != null
                    ? message.getRoom().getWorkspace().getId() : null;
            Optional<Todo> t = todoRepository.findById(message.getLinkedTodoId())
                    .filter(x -> roomWsId != null && x.getWorkspace() != null
                            && roomWsId.equals(x.getWorkspace().getId()));
            if (t.isPresent()) {
                linkedTitle = t.get().getTitle();
                linkedStatus = t.get().getStatus() != null ? t.get().getStatus() : null;
            }
        }

        DmRoom room = message.getRoom();
        List<Long> participantIds = room.getParticipants().stream().map(User::getId).toList();
        Map<Long, LocalDateTime> readByUser = dmRoomReadRepository.findByRoomId(room.getId()).stream()
                .collect(Collectors.toMap(DmRoomRead::getUserId, DmRoomRead::getLastReadAt));

        DmMessage replyTo = message.getReplyToId() != null
                ? dmMessageRepository.findById(message.getReplyToId()).orElse(null) : null;

        return DmMessageResponse.builderFrom(message)
                .readAt(computeReadAt(message, participantIds, readByUser))
                .reactionCounts(counts.isEmpty() ? null : counts)
                .myReactions(mine.isEmpty() ? null : mine)
                .linkedTodoTitle(linkedTitle)
                .linkedTodoStatus(linkedStatus)
                .replyToSenderName(replyTo != null ? replyTo.getSender().getName() : null)
                .replyToContent(replyTo != null ? replySnippet(replyTo) : null)
                .build();
    }

    /** 답장 인용 스니펫 (내용 없으면 [파일] 표기). */
    private String replySnippet(DmMessage target) {
        if (target == null) return null;
        String c = target.getContent();
        if (c == null || c.isBlank()) {
            return target.getFileUrl() != null ? "[파일]" : "";
        }
        return c.length() > 60 ? c.substring(0, 60) + "…" : c;
    }

    /** 리스트 응답용 — reactions / linkedTodo 정보를 한 번에 batch fetch. */
    private List<DmMessageResponse> enrichBatch(List<DmMessage> messages, Long callerUserId) {
        if (messages.isEmpty()) return List.of();

        // 방 참여자 + 참여자별 마지막 읽음 시각 (읽음 표시 계산용)
        DmRoom room = messages.get(0).getRoom();
        List<Long> participantIds = room.getParticipants().stream().map(User::getId).toList();
        Map<Long, LocalDateTime> readByUser = dmRoomReadRepository.findByRoomId(room.getId()).stream()
                .collect(Collectors.toMap(DmRoomRead::getUserId, DmRoomRead::getLastReadAt));

        List<Long> messageIds = messages.stream().map(DmMessage::getId).toList();
        Map<Long, Map<String, Integer>> countsByMsg = new HashMap<>();
        Map<Long, List<String>> mineByMsg = new HashMap<>();
        for (DmMessageReaction r : reactionRepository.findByMessageIdIn(messageIds)) {
            countsByMsg.computeIfAbsent(r.getMessageId(), k -> new HashMap<>())
                    .merge(r.getEmoji(), 1, Integer::sum);
            if (callerUserId != null && callerUserId.equals(r.getUserId())) {
                mineByMsg.computeIfAbsent(r.getMessageId(), k -> new ArrayList<>()).add(r.getEmoji());
            }
        }

        Set<Long> todoIds = messages.stream()
                .map(DmMessage::getLinkedTodoId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        // 단건 경로와 같은 이유로 방 워크스페이스 밖의 할 일은 걸러낸다(제목 유출 방지).
        Long listWsId = messages.stream()
                .map(m -> m.getRoom() != null ? m.getRoom().getWorkspace() : null)
                .filter(Objects::nonNull)
                .map(Workspace::getId)
                .findFirst().orElse(null);
        Map<Long, Todo> todosById = todoIds.isEmpty()
                ? Map.of()
                : todoRepository.findAllById(todoIds).stream()
                        .filter(t -> listWsId != null && t.getWorkspace() != null
                                && listWsId.equals(t.getWorkspace().getId()))
                        .collect(Collectors.toMap(Todo::getId, t -> t));

        // 답장 대상 메시지 batch fetch
        Set<Long> replyIds = messages.stream()
                .map(DmMessage::getReplyToId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, DmMessage> replyById = replyIds.isEmpty()
                ? Map.of()
                : dmMessageRepository.findAllById(replyIds).stream()
                        .collect(Collectors.toMap(DmMessage::getId, m -> m));

        return messages.stream().map(m -> {
            Map<String, Integer> counts = countsByMsg.get(m.getId());
            List<String> mine = mineByMsg.get(m.getId());
            Todo t = m.getLinkedTodoId() != null ? todosById.get(m.getLinkedTodoId()) : null;
            DmMessage rt = m.getReplyToId() != null ? replyById.get(m.getReplyToId()) : null;
            return DmMessageResponse.builderFrom(m)
                    .readAt(computeReadAt(m, participantIds, readByUser))
                    .reactionCounts(counts)
                    .myReactions(mine)
                    .linkedTodoTitle(t != null ? t.getTitle() : null)
                    .linkedTodoStatus(t != null ? t.getStatus() : null)
                    .replyToSenderName(rt != null ? rt.getSender().getName() : null)
                    .replyToContent(rt != null ? replySnippet(rt) : null)
                    .build();
        }).toList();
    }


    @Transactional
    public int markAsRead(String email, Long roomId) {
        User me = getUser(email);
        DmRoom room = getRoom(roomId);
        validateParticipant(room, me);

        DmRoomRead read = dmRoomReadRepository.findByRoomIdAndUserId(roomId, me.getId()).orElse(null);
        LocalDateTime prev = (read != null) ? read.getLastReadAt() : EPOCH;
        // 이번에 새로 읽게 된 메시지 수 (broadcast 여부 판단용)
        int newlyRead = (int) dmMessageRepository.countUnreadAfter(roomId, me.getId(), prev);

        LocalDateTime now = LocalDateTime.now();
        if (read == null) {
            read = DmRoomRead.builder().roomId(roomId).userId(me.getId()).lastReadAt(now).build();
        } else {
            read.setLastReadAt(now);
        }
        dmRoomReadRepository.save(read);
        return newlyRead;
    }

    // ── per-user 읽음 헬퍼 ──────────────────────────────────────────────────
    /** 방·사용자의 안읽음 수 (마지막 읽은 시각 이후, 내가 보내지 않은 메시지). */
    private long unreadCount(Long roomId, Long userId) {
        LocalDateTime after = dmRoomReadRepository.findByRoomIdAndUserId(roomId, userId)
                .map(DmRoomRead::getLastReadAt).orElse(EPOCH);
        return dmMessageRepository.countUnreadAfter(roomId, userId, after);
    }

    /**
     * 메시지의 "읽음" 시각 — 수신자(보낸이 제외 참여자) 전원의 lastReadAt이 메시지 시각 이후면 읽음.
     * 한 명이라도 아직 안 읽었으면 null. (1:1은 상대 한 명 기준이라 기존 "읽음"과 동일)
     */
    private LocalDateTime computeReadAt(DmMessage m, List<Long> participantIds, Map<Long, LocalDateTime> readByUser) {
        Long senderId = m.getSender().getId();
        LocalDateTime minRead = null;
        boolean hasRecipient = false;
        for (Long pid : participantIds) {
            if (pid.equals(senderId)) continue;
            hasRecipient = true;
            LocalDateTime r = readByUser.get(pid);
            if (r == null || r.isBefore(m.getSentAt())) return null; // 아직 안 읽은 수신자 존재
            if (minRead == null || r.isBefore(minRead)) minRead = r;
        }
        return hasRecipient ? minRead : null;
    }

    // 파일 전송 최대 크기 (25MB)
    private static final long MAX_FILE_SIZE = 25L * 1024 * 1024;

    // 실행 파일 등 위험 확장자 차단 목록
    private static final java.util.Set<String> BLOCKED_EXTENSIONS = java.util.Set.of(
            ".exe", ".bat", ".cmd", ".sh", ".ps1", ".vbs", ".js", ".msi",
            ".dll", ".com", ".scr", ".hta", ".pif", ".php", ".jsp", ".asp", ".aspx",
            ".html", ".htm", ".svg", ".xml", ".xhtml", ".xht", ".shtml", ".mhtml"
    );

    @Transactional
    public DmMessageResponse sendFile(String senderEmail, Long roomId, MultipartFile file, String content) throws IOException {
        User sender = getUser(senderEmail);
        DmRoom room = getRoom(roomId);
        validateParticipant(room, sender);

        // 빈 파일 / 크기 제한 검증
        if (file == null || file.isEmpty()) {
            throw new ApiException(400, "빈 파일은 전송할 수 없어요.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ApiException(400, "파일은 최대 25MB까지 전송할 수 있어요.");
        }

        // 파일 저장 (절대 경로 사용)
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String ext = originalName.contains(".") ? originalName.substring(originalName.lastIndexOf('.')).toLowerCase() : "";
        if (!ext.isEmpty() && BLOCKED_EXTENSIONS.contains(ext)) {
            throw new ApiException(400, "해당 형식의 파일은 전송할 수 없어요.");
        }
        String storedName = UUID.randomUUID() + ext;
        Path dmDir = Paths.get(uploadDir).toAbsolutePath().resolve("dm");
        Files.createDirectories(dmDir);
        Path targetPath = dmDir.resolve(storedName);
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, targetPath, StandardCopyOption.REPLACE_EXISTING);
        }
        String fileUrl = "/uploads/dm/" + storedName;

        String messageContent = (content != null && !content.isBlank()) ? content.trim() : "";

        DmMessage message = DmMessage.builder()
                .room(room)
                .sender(sender)
                .content(messageContent)
                .fileUrl(fileUrl)
                .fileName(originalName)
                .fileType(file.getContentType())
                .fileSize(file.getSize())
                .build();
        dmMessageRepository.save(message);

        String lastMsg = messageContent.isEmpty()
                ? "[파일] " + originalName
                : "[파일] " + originalName + " · " + messageContent;
        room.setLastMessage(lastMsg);
        room.setLastMessageAt(LocalDateTime.now());
        dmRoomRepository.save(room);

        // 파일 공유 시 상대방에게 알림 전송
        // sendMessage와 동일하게 workspaceId가 null이라 알림함에 뜨지 않았다 — 방의 워크스페이스를 넘긴다.
        Long roomWorkspaceId = room.getWorkspace().getId();
        String notifyBody = "[파일] " + (originalName.length() > 40 ? originalName.substring(0, 40) + "…" : originalName);
        room.getParticipants().stream()
                .filter(u -> !u.getId().equals(sender.getId()))
                .forEach(receiver -> notificationService.createNotification(
                        receiver.getEmail(),
                        sender.getEmail(),
                        NotificationType.DM_RECEIVED.name(),
                        sender.getName(),
                        notifyBody,
                        room.getId(),
                        roomWorkspaceId
                ));

        return enrich(message, sender.getId());
    }

    @Transactional(readOnly = true)
    public DmPartnerProfileResponse getPartnerProfile(String myEmail, Long roomId) {
        User me      = getUser(myEmail);
        DmRoom room  = getRoom(roomId);
        validateParticipant(room, me);

        User partner = room.getParticipants().stream()
                .filter(u -> !u.getId().equals(me.getId()))
                .findFirst()
                .orElse(me);

        /* 파트너의 마지막 활동 시각.
           예전엔 '가장 최근에 보낸 DM'이라, 상대가 앱을 쓰면서 할 일을 만들고 내 메시지를
           읽고 있어도 DM만 안 보내면 "N일 전 활동"이 계속 떴다 — 라벨은 '활동'인데 실제로는
           'DM 발신'만 재고 있었다. 이제 users.last_active_at(인증 요청마다 갱신)을 쓴다.
           그 컬럼 도입 이전 사용자는 값이 없으므로 예전 방식으로 폴백한다. */
        LocalDateTime lastActiveAt = partner.getLastActiveAt();
        if (lastActiveAt == null) {
            lastActiveAt = dmMessageRepository
                    .findTopBySenderOrderBySentAtDesc(partner.getId(), PageRequest.of(0, 1))
                    .stream().findFirst()
                    .map(DmMessage::getSentAt)
                    .orElse(null);
        }

        // 워크스페이스 내 역할
        String role = workspaceMemberRepository
                .findByWorkspaceAndUser(room.getWorkspace(), partner)
                .map(wm -> wm.getRole().name())
                .orElse(null);

        // 함께하는 할 일 (두 사람 모두 담당자)
        List<SharedTodoInfo> sharedTodos = todoRepository
                .findSharedTodos(room.getWorkspace(), me.getId(), partner.getId())
                .stream()
                .limit(10)
                .map(t -> SharedTodoInfo.builder()
                        .id(t.getId())
                        .title(t.getTitle())
                        .status(t.getStatus())
                        .priority(t.getPriority() != null ? t.getPriority().name() : null)
                        .dueDate(t.getDueDate() != null ? t.getDueDate().toString() : null)
                        .build())
                .toList();

        List<SharedFileInfo> sharedFiles = dmMessageRepository
                .findFilesByRoomId(room.getId(), PageRequest.of(0, 20))
                .stream()
                .map(m -> SharedFileInfo.builder()
                        .fileUrl(m.getFileUrl())
                        .fileName(m.getFileName())
                        .fileType(m.getFileType())
                        .fileSize(m.getFileSize())
                        .sentAt(m.getSentAt())
                        .build())
                .toList();

        return DmPartnerProfileResponse.builder()
                .partnerId(partner.getId())
                .partnerName(partner.getName())
                .partnerEmail(partner.getEmail())
                .partnerProfileImageUrl(partner.getProfileImageUrl())
                .lastActiveAt(lastActiveAt)
                .role(role)
                .sharedTodos(sharedTodos)
                .sharedFiles(sharedFiles)
                .build();
    }

    @Transactional
    public void deleteMessage(String myEmail, Long roomId, Long messageId) {
        User me = getUser(myEmail);
        DmRoom room = getRoom(roomId);
        validateParticipant(room, me);

        DmMessage message = dmMessageRepository.findById(messageId)
                .orElseThrow(() -> new ApiException(404, "메시지를 찾을 수 없습니다."));

        if (!message.getSender().getId().equals(me.getId())) {
            throw new ApiException(403, "본인이 보낸 메시지만 삭제할 수 있습니다.");
        }

        reactionRepository.deleteByMessageId(messageId);
        dmMessageRepository.delete(message);
        dmMessageRepository.flush();

        // 룸 목록 미리보기 동기화 — 삭제된 게 마지막 메시지였다면 직전 메시지로, 없으면 비움
        List<DmMessage> latest = dmMessageRepository
                .findByRoomIdOrderBySentAtDesc(roomId, PageRequest.of(0, 1));
        if (latest.isEmpty()) {
            room.setLastMessage(null);
            room.setLastMessageAt(null);
        } else {
            DmMessage tail = latest.get(0);
            String content = tail.getContent() != null ? tail.getContent() : "";
            String preview = Boolean.TRUE.equals(room.getIsGroup())
                    ? (tail.getSender().getName() + ": " + (content.length() > 30 ? content.substring(0, 30) + "..." : content))
                    : content;
            room.setLastMessage(preview);
            room.setLastMessageAt(tail.getSentAt());
        }
        dmRoomRepository.save(room);
    }

    private User getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));
    }

    private DmRoom getRoom(Long roomId) {
        return dmRoomRepository.findById(roomId)
                .orElseThrow(() -> new ApiException(404, "채팅방을 찾을 수 없습니다."));
    }

    /** 미리보기 자르기. */
    private static String preview(String text, int max) {
        if (text == null) return "";
        return text.length() > max ? text.substring(0, max) + "..." : text;
    }

    /** 마지막 안전장치 — 보낸 사람 이름이 아무리 길어도 lastMessage 컬럼 길이를 넘지 않게 한다. */
    private static String clampToColumn(String text, int max) {
        if (text == null) return null;
        return text.length() > max ? text.substring(0, max) : text;
    }

    /**
     * 타이핑 인디케이터용 참여자 확인. 참여자면 표시할 이름을, 아니면 null 을 돌려준다.
     * STOMP 경로라 예외를 던져도 클라이언트가 받을 방법이 마땅치 않아 boolean/null 로 처리한다.
     * (다른 DM 진입점은 전부 validateParticipant 를 통과하는데 /dm.typing 만 클라이언트가 준
     *  roomId·senderName 을 그대로 믿고 브로드캐스트해서, 남의 방에 가짜 타이핑을 꽂을 수 있었다.)
     */
    @Transactional(readOnly = true)
    public String resolveTypingSenderName(String userEmail, Long roomId) {
        User me = userRepository.findByEmail(userEmail).orElse(null);
        if (me == null) return null;
        DmRoom room = dmRoomRepository.findById(roomId).orElse(null);
        if (room == null) return null;
        boolean isMember = room.getParticipants().stream().anyMatch(u -> u.getId().equals(me.getId()));
        if (!isMember) return null;
        return me.getName() == null ? "" : me.getName(); // null 이면 "참여자 아님"과 구분이 안 되므로 빈 문자열
    }

    private void validateParticipant(DmRoom room, User user) {
        boolean isMember = room.getParticipants().stream()
                .anyMatch(u -> u.getId().equals(user.getId()));
        if (!isMember) {
            throw new ApiException(403, "채팅방 참여자가 아닙니다.");
        }
    }

    private void requireWorkspaceMember(Workspace workspace, User user) {
        if (workspace == null) return;
        boolean isMember = workspaceMemberRepository.findByWorkspaceAndUser(workspace, user).isPresent();
        if (!isMember) {
            throw new ApiException(403, "해당 워크스페이스의 멤버가 아닙니다.");
        }
    }
}
