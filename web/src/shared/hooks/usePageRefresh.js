import { useEffect } from "react";
import { useLayout } from "../../layouts/LayoutContext";

/**
 * 모바일 pull-to-refresh 시 호출될 새로고침 함수를 Layout에 등록.
 * 페이지가 언마운트되면 자동으로 해제됨.
 */
export function usePageRefresh(fn) {
    const { setPageRefresh } = useLayout();
    useEffect(() => {
        setPageRefresh(fn);
        return () => setPageRefresh(null);
    }, [fn, setPageRefresh]);
}
