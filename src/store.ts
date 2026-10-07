import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { sample } from './sample'
import type { ResumeFile } from './schema'
type Store = {
  file: ResumeFile | null
  mode: 'edit' | 'tailor'
  dirty: boolean
  backupUpToDate: boolean
  setMode: (m: 'edit' | 'tailor') => void
  mutate: (fn: (f: ResumeFile) => void) => void
  load: (f: ResumeFile, fromBackup?: boolean) => void
  importResume: (f: ResumeFile) => void
  newFile: () => void
  setSaved: () => void
}
export const useStore = create<Store>((set, get) => ({
  file: null,
  mode: 'edit',
  dirty: false,
  backupUpToDate: false,
  setMode: (mode) => set({ mode }),
  mutate: (fn) => {
    const f = get().file
    if (!f) return
    const copy = structuredClone(f)
    fn(copy)
    set({ file: copy, dirty: true })
  },
  load: (file, fromBackup = false) => set({ file, dirty: false, backupUpToDate: fromBackup }),
  importResume: (file) => set({ file, dirty: true, backupUpToDate: false }),
  newFile: () => {
    const id = nanoid()
    set({
      file: {
        ...structuredClone(sample),
        master: { profile: { name: '', email: '', links: [] }, sections: [] },
        variants: [{ id, name: 'Default', excluded: [] }],
        activeVariantId: id,
      },
      dirty: true,
      backupUpToDate: false,
    })
  },
  setSaved: () => set({ dirty: false, backupUpToDate: true }),
}))
export const visible = (file: ResumeFile) => {
  const variant = file.variants.find((v) => v.id === file.activeVariantId) ?? file.variants[0]
  const excluded = new Set(variant?.excluded ?? [])
  return {
    ...file.master,
    sections: file.master.sections
      .filter((s) => !excluded.has(s.id))
      .map((s) => ({
        ...s,
        items: s.items
          .filter((i) => !excluded.has(i.id))
          .map((i) => ({
            ...i,
            bullets: i.bullets.filter((b) => !excluded.has(b.id)),
          })),
      }))
      .filter((s) => s.items.some((i) => i.heading || i.bullets.some((b) => b.text.trim()))),
  }
}
