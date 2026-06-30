import { create } from 'zustand'

type CommandCenterState = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useCommandCenter = create<CommandCenterState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
}))
