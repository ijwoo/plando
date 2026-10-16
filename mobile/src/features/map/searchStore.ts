import { create } from 'zustand';

export type Place = { name: string; address: string; lat: number; lng: number };

/** 지도 장소 검색 라우트 → 지도 화면으로 선택한 장소를 전달하는 일회성 채널. */
export const useMapSearchStore = create<{
  picked: Place | null;
  pick: (p: Place) => void;
  clear: () => void;
}>((set) => ({
  picked: null,
  pick: (p) => set({ picked: p }),
  clear: () => set({ picked: null }),
}));
