package com.example.todo.controller;

import com.example.todo.dto.TagResponse;
import com.example.todo.entity.Tag;
import com.example.todo.entity.Todo;
import com.example.todo.entity.TodoTag;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceRole;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.TagRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.TodoTagRepository;
import com.example.todo.service.PermissionService;
import com.example.todo.service.WorkspaceResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * 태그(라벨) — 워크스페이스 단위. 생성·수정=MEMBER+, 삭제=ADMIN+(공유 자산). 조회=멤버 전원.
 * 할 일에 태그 부착=그 할 일 편집 권한(MEMBER+).
 */
@RestController
@RequiredArgsConstructor
public class TagController {

    private final TagRepository tagRepository;
    private final TodoTagRepository todoTagRepository;
    private final TodoRepository todoRepository;
    private final WorkspaceResolver workspaceResolver;
    private final PermissionService permissionService;

    // ── 태그 CRUD ─────────────────────────────────────────

    @GetMapping("/api/tags")
    public List<TagResponse> list(
            Authentication auth,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        Workspace ws = workspaceResolver.resolve(auth.getName(), workspaceId);
        permissionService.requireMember(auth.getName(), ws);
        return tagRepository.findByWorkspaceOrderByNameAsc(ws).stream().map(TagResponse::from).toList();
    }

    @PostMapping("/api/tags")
    @Transactional
    public TagResponse create(
            @RequestBody Map<String, String> body,
            Authentication auth,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        Workspace ws = workspaceResolver.resolve(auth.getName(), workspaceId);
        permissionService.requireCanCreateContent(auth.getName(), ws);
        String name = body.getOrDefault("name", "").trim();
        if (name.isEmpty()) throw new ApiException(400, "태그 이름을 입력해주세요.");
        if (name.length() > 40) throw new ApiException(400, "태그 이름은 40자 이하로 해주세요.");
        requireValidColor(body.get("color"));
        // 같은 이름 있으면 재사용(중복 생성 방지)
        Tag tag = tagRepository.findByWorkspaceAndNameIgnoreCase(ws, name).orElse(null);
        if (tag == null) {
            User creator = workspaceResolver.getUser(auth.getName());
            tag = tagRepository.save(Tag.builder()
                    .name(name)
                    .color(body.get("color"))
                    .workspace(ws)
                    .createdBy(creator)
                    .build());
        } else if (body.get("color") != null) {
            tag.setColor(body.get("color"));
        }
        return TagResponse.from(tag);
    }

    @PatchMapping("/api/tags/{id}")
    @Transactional
    public TagResponse update(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication auth,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        Workspace ws = workspaceResolver.resolve(auth.getName(), workspaceId);
        permissionService.requireCanCreateContent(auth.getName(), ws);
        Tag tag = tagRepository.findByIdAndWorkspace(id, ws)
                .orElseThrow(() -> new ApiException(404, "태그를 찾을 수 없습니다."));
        if (body.containsKey("name") && body.get("name") != null && !body.get("name").trim().isEmpty()) {
            String newName = body.get("name").trim();
            if (newName.length() > 40) throw new ApiException(400, "태그 이름은 40자 이하로 해주세요.");
            tag.setName(newName);
        }
        if (body.containsKey("color")) {
            requireValidColor(body.get("color"));
            tag.setColor(body.get("color"));
        }
        return TagResponse.from(tag);
    }

    @DeleteMapping("/api/tags/{id}")
    @Transactional
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            Authentication auth,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        Workspace ws = workspaceResolver.resolve(auth.getName(), workspaceId);
        // 공유 자산(모든 할 일에 영향) → ADMIN 이상만 삭제
        permissionService.requireRole(auth.getName(), ws, WorkspaceRole.ADMIN);
        Tag tag = tagRepository.findByIdAndWorkspace(id, ws)
                .orElseThrow(() -> new ApiException(404, "태그를 찾을 수 없습니다."));
        todoTagRepository.deleteByTagId(tag.getId());
        tagRepository.delete(tag);
        return ResponseEntity.noContent().build();
    }

    /** color 컬럼은 varchar(16)(#RRGGBB 용). 길이 검사가 없어 넘치면 DB 오류 원문이 그대로 올라왔다. */
    private static void requireValidColor(String color) {
        if (color != null && color.length() > 16) {
            throw new ApiException(400, "색상 값이 올바르지 않습니다.");
        }
    }

    // ── 할 일 ↔ 태그 ──────────────────────────────────────

    /** 할 일의 태그 전체 교체 (편집 권한 = MEMBER+). body: {"tagIds":[...]} */
    @PutMapping("/api/todos/{todoId}/tags")
    @Transactional
    public List<TagResponse> setTodoTags(
            @PathVariable Long todoId,
            @RequestBody Map<String, List<Long>> body,
            Authentication auth,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        Workspace ws = workspaceResolver.resolve(auth.getName(), workspaceId);
        Todo todo = todoRepository.findById(todoId)
                .orElseThrow(() -> new ApiException(404, "작업을 찾을 수 없습니다."));
        if (todo.getWorkspace() == null || !Objects.equals(todo.getWorkspace().getId(), ws.getId())) {
            throw new ApiException(403, "다른 워크스페이스의 작업입니다.");
        }
        permissionService.requireCanEditTodo(auth.getName(), todo);

        // 같은 태그 id 가 두 번 들어오면 uk_todo_tag 위반으로 통째로 실패한다.
        // 클라이언트가 이미 붙어 있는 태그를 다시 더해 보내는 경우가 실제로 있었다(태그 생성은
        // 같은 이름이 있으면 기존 것을 재사용하는데, 화면은 그걸 새 태그처럼 목록에 덧붙였다).
        // 전체 교체 API 라 중복은 의미가 없으므로 서버에서도 접는다.
        List<Long> tagIds = body.getOrDefault("tagIds", List.of())
                .stream().filter(Objects::nonNull).distinct().toList();
        // 워크스페이스에 속한 유효 태그만 반영
        List<Tag> valid = tagIds.stream()
                .map(tid -> tagRepository.findByIdAndWorkspace(tid, ws).orElse(null))
                .filter(Objects::nonNull)
                .toList();

        /* 예전엔 "전부 지우고 전부 다시 넣기"였는데, JPA 는 같은 트랜잭션에서 **insert 를 delete
           보다 먼저** 실행한다. 그래서 이미 붙어 있는 태그를 그대로 둔 채 저장하면 — 태그 하나를
           더하는 가장 흔한 동작이다 — 지워지기 전의 행과 부딪혀 uk_todo_tag 위반으로 통째로
           실패했다. 화면엔 DB 원문 오류가 뜨고, 새로고침하면 반영돼 있어 더 헷갈렸다.
           지울 것/더할 것만 계산해 건드린다. 안 바뀐 행은 아예 손대지 않으므로 순서 문제가 없다. */
        Set<Long> want = valid.stream().map(Tag::getId).collect(java.util.stream.Collectors.toSet());
        List<TodoTag> current = todoTagRepository.findByTodoId(todoId);
        Set<Long> have = current.stream().map(TodoTag::getTagId).collect(java.util.stream.Collectors.toSet());

        for (TodoTag row : current) {
            if (!want.contains(row.getTagId())) todoTagRepository.delete(row);
        }
        for (Long tagId : want) {
            if (!have.contains(tagId)) {
                todoTagRepository.save(TodoTag.builder().todoId(todoId).tagId(tagId).build());
            }
        }
        return valid.stream().map(TagResponse::from).toList();
    }
}
