package com.example.todo.dto;

import com.example.todo.entity.RecruitmentApplication;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.format.DateTimeFormatter;

@Getter
@NoArgsConstructor
public class RecruitmentApplicationDto {

    private Long id;
    private Long applicantId;
    private String applicantName;
    private String applicantAvatar;
    private String status;   // PENDING / ACCEPTED / REJECTED / CANCELLED
    private String message;
    private String appliedAt; // "MM/dd HH:mm"

    /** 지원자가 선택한 역할 — 기존 데이터에는 없으므로 null 가능. */
    private Long selectedRoleId;
    private String selectedRoleName;

    public RecruitmentApplicationDto(RecruitmentApplication app) {
        this.id = app.getId();
        if (app.getApplicant() != null) {
            this.applicantId   = app.getApplicant().getId();
            this.applicantName = app.getApplicant().getName();
            this.applicantAvatar = app.getApplicant().getProfileImageUrl();
        }
        this.status    = app.getStatus();
        this.message   = app.getMessage();
        this.appliedAt = app.getAppliedAt() != null
                ? app.getAppliedAt().format(DateTimeFormatter.ofPattern("MM/dd HH:mm"))
                : null;
        if (app.getSelectedRole() != null) {
            this.selectedRoleId = app.getSelectedRole().getId();
            this.selectedRoleName = app.getSelectedRole().getName();
        }
    }
}
