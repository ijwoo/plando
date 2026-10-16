package com.example.todo.service;

import com.example.todo.entity.StatusCategory;
import com.example.todo.entity.WorkflowStatus;
import com.example.todo.entity.Workspace;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.WorkflowStatusRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * 커스텀 상태(워크플로우) — 워크스페이스별 상태 집합. 완료 판정은 category==DONE으로.
 * 기본 3상태(TODO/IN_PROGRESS/DONE) key는 기존 Todo.status 값과 동일 → 무마이그레이션.
 */
@Service
@RequiredArgsConstructor
public class WorkflowStatusService {

    private final WorkflowStatusRepository repo;
    private final TodoRepository todoRepository;

    // ── 시드 ──────────────────────────────────────────────

    /** 새 워크스페이스(또는 아직 상태 없는 기존 워크스페이스)에 기본 3상태 시드. 멱등. */
    @Transactional
    public void seedDefaults(Workspace ws) {
        if (repo.existsByWorkspace(ws)) return;
        repo.save(build(ws, "TODO", "할 일", "#94A3B8", StatusCategory.TODO, 0, true));
        repo.save(build(ws, "IN_PROGRESS", "진행 중", "#3070EB", StatusCategory.IN_PROGRESS, 1, false));
        repo.save(build(ws, "DONE", "완료", "#22B8A6", StatusCategory.DONE, 2, false));
    }

    private WorkflowStatus build(Workspace ws, String key, String label, String color, StatusCategory cat, int order, boolean def) {
        return WorkflowStatus.builder()
                .workspace(ws).statusKey(key).label(label).color(color)
                .category(cat).sortOrder(order).isDefault(def).build();
    }

    // ── 조회 / 카테고리 판정 ──────────────────────────────

    @Transactional
    public List<WorkflowStatus> list(Workspace ws) {
        if (!repo.existsByWorkspace(ws)) seedDefaults(ws);
        return repo.findByWorkspaceOrderBySortOrderAsc(ws);
    }

    /** 상태 key의 카테고리. 미정의 key는 미시작(TODO)로 안전 폴백. */
    @Transactional(readOnly = true)
    public StatusCategory categoryOf(Workspace ws, String statusKey) {
        if (statusKey == null) return StatusCategory.TODO;
        return repo.findByWorkspaceAndStatusKey(ws, statusKey)
                .map(WorkflowStatus::getCategory)
                .orElse(StatusCategory.TODO);
    }

    /** 완료 판정 — category==DONE. 완료율·자동보관·리마인더 등 모든 완료 파급의 단일 기준. */
    @Transactional(readOnly = true)
    public boolean isDone(Workspace ws, String statusKey) {
        return categoryOf(ws, statusKey) == StatusCategory.DONE;
    }

    /** 새 할 일이 받는 기본 상태 key. */
    @Transactional
    public String defaultStatusKey(Workspace ws) {
        return list(ws).stream().filter(WorkflowStatus::isDefault).findFirst()
                .map(WorkflowStatus::getStatusKey).orElse("TODO");
    }

    /** 이 key가 워크스페이스의 유효 상태인지. */
    @Transactional(readOnly = true)
    public boolean isValidKey(Workspace ws, String statusKey) {
        return statusKey != null && repo.findByWorkspaceAndStatusKey(ws, statusKey).isPresent();
    }

    // ── CRUD ──────────────────────────────────────────────

    @Transactional
    public WorkflowStatus create(Workspace ws, String label, String color, StatusCategory category) {
        if (label == null || label.trim().isEmpty()) throw new ApiException(400, "상태 이름을 입력해주세요.");
        if (category == null) throw new ApiException(400, "카테고리가 필요합니다.");
        list(ws); // 시드 보장
        int order = repo.findByWorkspace(ws).stream().mapToInt(WorkflowStatus::getSortOrder).max().orElse(-1) + 1;
        String key = "st_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        return repo.save(build(ws, key, label.trim(), color, category, order, false));
    }

    @Transactional
    public WorkflowStatus update(Workspace ws, Long id, String label, String color, StatusCategory category) {
        WorkflowStatus s = require(ws, id);
        if (label != null && !label.trim().isEmpty()) s.setLabel(label.trim());
        if (color != null) s.setColor(color);
        if (category != null && category != s.getCategory()) {
            // 카테고리 변경 → 그 상태의 할 일 완료여부가 바뀜(doneAt 백필/해제)
            s.setCategory(category);
            reconcileDoneAt(ws, s.getStatusKey(), category);
        }
        return s;
    }

    /** 삭제 + 그 상태의 할 일을 reassignToKey로 재배정(필수). 미시작·완료 카테고리 최소 1개 보장. */
    @Transactional
    public void delete(Workspace ws, Long id, String reassignToKey) {
        WorkflowStatus s = require(ws, id);
        List<WorkflowStatus> all = repo.findByWorkspace(ws);
        long sameCat = all.stream().filter(x -> x.getCategory() == s.getCategory()).count();
        if ((s.getCategory() == StatusCategory.TODO || s.getCategory() == StatusCategory.DONE) && sameCat <= 1) {
            throw new ApiException(400, "미시작·완료 카테고리는 최소 1개 상태가 있어야 해요.");
        }
        WorkflowStatus target = repo.findByWorkspaceAndStatusKey(ws, reassignToKey)
                .orElseThrow(() -> new ApiException(400, "재배정할 상태를 지정해주세요."));
        if (target.getId().equals(s.getId())) throw new ApiException(400, "자기 자신으로 재배정할 수 없어요.");
        // 그 상태의 할 일을 target으로 이동 + doneAt 정합
        todoRepository.reassignStatus(ws.getId(), s.getStatusKey(), target.getStatusKey());
        reconcileDoneAt(ws, target.getStatusKey(), target.getCategory());
        if (s.isDefault()) {
            // 기본 상태 삭제 시 target(또는 첫 TODO)을 기본으로
            WorkflowStatus newDefault = repo.findByWorkspaceAndStatusKey(ws, target.getStatusKey())
                    .filter(t -> t.getCategory() == StatusCategory.TODO).orElse(null);
            if (newDefault == null) {
                newDefault = repo.findByWorkspace(ws).stream()
                        .filter(x -> x.getCategory() == StatusCategory.TODO && !x.getId().equals(s.getId()))
                        .findFirst().orElse(null);
            }
            if (newDefault != null) newDefault.setDefault(true);
        }
        repo.delete(s);
    }

    @Transactional
    public void setDefault(Workspace ws, Long id) {
        WorkflowStatus s = require(ws, id);
        if (s.getCategory() != StatusCategory.TODO) throw new ApiException(400, "기본 상태는 미시작 카테고리만 지정할 수 있어요.");
        for (WorkflowStatus x : repo.findByWorkspace(ws)) x.setDefault(false);
        s.setDefault(true);
    }

    @Transactional
    public void reorder(Workspace ws, List<Long> orderedIds) {
        int i = 0;
        for (Long id : orderedIds) {
            WorkflowStatus s = repo.findByIdAndWorkspace(id, ws).orElse(null);
            if (s != null) s.setSortOrder(i++);
        }
    }

    // ── helpers ───────────────────────────────────────────

    private WorkflowStatus require(Workspace ws, Long id) {
        return repo.findByIdAndWorkspace(id, ws)
                .orElseThrow(() -> new ApiException(404, "상태를 찾을 수 없습니다."));
    }

    /** 어떤 상태 key로 옮겨진 할 일들의 doneAt을 카테고리에 맞게 정합. */
    private void reconcileDoneAt(Workspace ws, String statusKey, StatusCategory category) {
        if (category == StatusCategory.DONE) {
            todoRepository.setDoneAtForStatusIfNull(ws.getId(), statusKey);
        } else {
            todoRepository.clearDoneAtForStatus(ws.getId(), statusKey);
        }
    }
}
