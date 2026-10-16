import { useMemo } from "react";
import { haversineKm } from "../constants/recruitmentConfig";
import { getDueText } from "../utils/recruitmentUtils";

function matchSearch(item, q) {
    if (!q) return true;
    if (item.title?.toLowerCase().includes(q)) return true;
    if (item.summary?.toLowerCase().includes(q)) return true;
    const tags = item.tags || [];
    if (tags.some((t) => t.toLowerCase().includes(q))) return true;
    const roles = item.roles || [];
    return roles.some((r) => {
        const name = typeof r === "string" ? r : (r.name || "");
        return name.toLowerCase().includes(q);
    });
}

function matchLocation(item, filter, userLocation, nearbyKm) {
    if (filter === "all") return true;
    if (filter === "online") return !item.hasLocation;
    if (filter === "offline") return Boolean(item.hasLocation);
    if (filter === "nearby") {
        if (!item.hasLocation || !item.locationLat || !item.locationLng) return false;
        if (!userLocation) return Boolean(item.hasLocation);
        return haversineKm(userLocation.lat, userLocation.lng, item.locationLat, item.locationLng) <= nearbyKm;
    }
    return true;
}

/**
 * items 배열을 검색·필터·정렬해서 반환한다.
 * desktop: catF, sortBy 사용 / mobile: tab, appStatusFilter 사용
 */
export default function useRecruitmentFilter(items, {
    search = "",
    filter = "all",
    nearbyKm = 5,
    userLocation = null,
    catF = "전체",
    sortBy = "latest",
    tab = "browse",
    appStatusFilter = "all",
} = {}) {
    return useMemo(() => {
        const q = search.trim().toLowerCase();

        const result = items.filter((item) => {
            if (!matchSearch(item, q)) return false;

            if (tab === "applied") {
                return appStatusFilter === "all" ||
                    item.appliedStatus?.toLowerCase() === appStatusFilter;
            }

            if (catF !== "전체" && item.typeLabel !== catF) return false;

            return matchLocation(item, filter, userLocation, nearbyKm);
        });

        if (sortBy === "deadline") {
            return [...result].sort((a, b) => {
                const aNum = parseInt(String(getDueText(a, { fallback: "" })).replace(/\D/g, ""), 10) || 999;
                const bNum = parseInt(String(getDueText(b, { fallback: "" })).replace(/\D/g, ""), 10) || 999;
                return aNum - bNum;
            });
        }

        if (sortBy === "members") {
            return [...result].sort((a, b) => {
                const aSlots = (a.maxMembers ?? a.total ?? 0) - (a.currentMembers ?? a.current ?? 0);
                const bSlots = (b.maxMembers ?? b.total ?? 0) - (b.currentMembers ?? b.current ?? 0);
                return aSlots - bSlots;
            });
        }

        return result;
    }, [items, search, filter, nearbyKm, userLocation, catF, sortBy, tab, appStatusFilter]);
}
