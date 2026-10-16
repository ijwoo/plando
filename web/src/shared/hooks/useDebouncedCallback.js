import { useMemo, useRef } from "react";

export function useDebouncedCallback(fn, delay = 500) {
    const tRef = useRef(null);
    const fnRef = useRef(fn);
    const pendingArgsRef = useRef(null);
    fnRef.current = fn;

    return useMemo(() => {
        const debounced = (...args) => {
            pendingArgsRef.current = args;
            if (tRef.current) clearTimeout(tRef.current);
            tRef.current = setTimeout(() => {
                pendingArgsRef.current = null;
                fnRef.current(...args);
            }, delay);
        };

        debounced.flush = () => {
            if (tRef.current && pendingArgsRef.current) {
                clearTimeout(tRef.current);
                tRef.current = null;
                const args = pendingArgsRef.current;
                pendingArgsRef.current = null;
                fnRef.current(...args);
            }
        };

        debounced.cancel = () => {
            if (tRef.current) clearTimeout(tRef.current);
            tRef.current = null;
            pendingArgsRef.current = null;
        };

        return debounced;
    }, [delay]);
}
