import { useState } from "react";
import { fetchApplications, reviewApplication } from "../api/recruitmentApi";
import { APP_EVENTS } from "../../../shared/constants/events.js";

function toast(message, severity = "success") {
    window.dispatchEvent(
        new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message, severity } })
    );
}

export default function useApplicants({ onReview } = {}) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [apps, setApps] = useState([]);
    const [appsLoading, setAppsLoading] = useState(false);
    const [reviewing, setReviewing] = useState(null);
    const [loadError, setLoadError] = useState(false);

    const openApplicants = (recruitmentId) => {
        setDialogOpen(true);
        setAppsLoading(true);
        setLoadError(false);
        fetchApplications(recruitmentId)
            .then((res) => setApps(res.data))
            .catch(() => {
                setLoadError(true);
                toast("신청자 목록을 불러오지 못했어요.", "error");
            })
            .finally(() => setAppsLoading(false));
    };

    const closeApplicants = () => setDialogOpen(false);

    const handleReviewApp = async (recruitmentId, appId, action) => {
        setReviewing(appId);
        try {
            const res = await reviewApplication(recruitmentId, appId, action);
            setApps((prev) =>
                prev.map((a) => (a.id === appId ? { ...a, status: res.data.status } : a))
            );
            const label = action === "accept" ? "수락" : "거절";
            toast(`${label} 처리됐어요.`, "success");
            if (onReview) onReview(recruitmentId);
        } catch (err) {
            const msg = err?.response?.data?.message
                || (action === "accept" ? "수락 처리에 실패했어요." : "거절 처리에 실패했어요.");
            toast(msg, "error");
        } finally {
            setReviewing(null);
        }
    };

    return {
        apps,
        appsLoading,
        loadError,
        reviewing,
        dialogOpen,
        openApplicants,
        closeApplicants,
        handleReviewApp,
    };
}
