import { create } from 'zustand';

export type ToastSeverity = 'error' | 'success' | 'info';
export type ToastAction = { label: string; onPress: () => void };
export type ToastItem = { id: number; message: string; severity: ToastSeverity; action?: ToastAction };

/** 전역 toast 상태 (기존 웹의 app-toast 스낵바와 동일 역할). */
export const useToastStore = create<{
  current: ToastItem | null;
  // 마운트된 ToastHost id 스택. 여러 개(루트 + 모달 내부)가 동시에 마운트되면
  // 마지막(최상단)만 렌더해 중복 토스트를 막는다. (투명 바텀시트는 루트가 비쳐 겹침)
  hosts: number[];
  show: (message: string, severity?: ToastSeverity, action?: ToastAction) => void;
  hide: () => void;
  registerHost: (id: number) => void;
  unregisterHost: (id: number) => void;
}>((set) => ({
  current: null,
  hosts: [],
  show: (message, severity = 'info', action) => set({ current: { id: Date.now(), message, severity, action } }),
  hide: () => set({ current: null }),
  registerHost: (id) => set((s) => ({ hosts: [...s.hosts, id] })),
  unregisterHost: (id) => set((s) => ({ hosts: s.hosts.filter((h) => h !== id) })),
}));

/** 어디서나 호출하는 간편 API: toast.error('...') / toast.success('...') / toast.info('...') */
export const toast = {
  error: (message: string) => useToastStore.getState().show(message, 'error'),
  success: (message: string) => useToastStore.getState().show(message, 'success'),
  info: (message: string) => useToastStore.getState().show(message, 'info'),
  /** 실행취소 액션이 달린 토스트 */
  action: (message: string, label: string, onPress: () => void, severity: ToastSeverity = 'success') =>
    useToastStore.getState().show(message, severity, { label, onPress }),
};
