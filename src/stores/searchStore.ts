'use client';

import { create } from 'zustand';

interface SearchState {
  // Trigger to clear search - increments to signal clear
  clearTrigger: number;
  triggerClear: () => void;
}

export const useSearchStore = create<SearchState>()((set) => ({
  clearTrigger: 0,
  triggerClear: () => set((state) => ({ clearTrigger: state.clearTrigger + 1 })),
}));

// Selector for clear trigger
export const useClearSearchTrigger = () => useSearchStore((state) => state.clearTrigger);
export const useTriggerClearSearch = () => useSearchStore((state) => state.triggerClear);
