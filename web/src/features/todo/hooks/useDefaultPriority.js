import { useEffect, useState } from "react";
import { getMySettings } from "../../settings/api/settingsApi.js";

let cachedPriority = null;
let fetchPromise = null;

function loadPriority() {
    if (cachedPriority) return Promise.resolve(cachedPriority);
    if (!fetchPromise) {
        fetchPromise = getMySettings()
            .then((res) => {
                cachedPriority = res.data?.defaultPriority ?? "MEDIUM";
                return cachedPriority;
            })
            .catch(() => "MEDIUM")
            .finally(() => { fetchPromise = null; });
    }
    return fetchPromise;
}

export function invalidateDefaultPriority() {
    cachedPriority = null;
}

export function useDefaultPriority() {
    const [defaultPriority, setDefaultPriority] = useState(cachedPriority ?? "MEDIUM");

    useEffect(() => {
        let mounted = true;
        loadPriority().then((p) => { if (mounted) setDefaultPriority(p); });
        return () => { mounted = false; };
    }, []);

    return defaultPriority;
}
