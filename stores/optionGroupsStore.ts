import { bizCol, bizDoc } from "@/lib/business";
import { create } from "zustand";
import {
  onSnapshot,
  type Unsubscribe,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

interface OptionGroupsState {
  optionGroups: OptionGroup[];
  loading: boolean;
  error: string | null;
  /** Starts a live listener; returns a function that stops it. */
  listen: () => Unsubscribe;
  addOptionGroup: (data: Omit<OptionGroup, "id" | "createdAt">) => Promise<string>;
  updateOptionGroup: (id: string, data: Record<string, unknown>) => Promise<void>;
  reset: () => void;
}

export const useOptionGroupsStore = create<OptionGroupsState>((set) => ({
  optionGroups: [],
  loading: false,
  error: null,

  reset: () => {
    set({ optionGroups: [], loading: false, error: null });
  },

  listen: () => {
    set({ loading: true, error: null });
    return onSnapshot(
      bizCol("optionGroups"),
      (snapshot) => {
        const optionGroups: OptionGroup[] = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            name: (d.name as string) ?? "",
            minSelection: (d.minSelection as number) ?? 0,
            maxSelection: (d.maxSelection as number) ?? 1,
            multipleOptionQuantity: (d.multipleOptionQuantity as boolean) ?? false,
            optionIds: d.optionIds as string[] | undefined,
            itemIds: d.itemIds as string[] | undefined,
            defaultOptionId: d.defaultOptionId as string | undefined,
            createdAt: d.createdAt?.toDate?.() ?? new Date(),
          };
        });
        optionGroups.sort((a, b) => a.name.localeCompare(b.name));
        set({ optionGroups, loading: false, error: null });
      },
      (err) => set({ error: err.message || "Failed to fetch option groups", loading: false }),
    );
  },

  addOptionGroup: async (data) => {
    set({ error: null });
    try {
      const ref = await addDoc(bizCol("optionGroups"), {
        ...data,
        createdAt: serverTimestamp(),
      });
      return ref.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add option group";
      set({ error: message });
      throw err;
    }
  },

  updateOptionGroup: async (id, data) => {
    set({ error: null });
    try {
      await updateDoc(bizDoc("optionGroups", id), data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update option group";
      set({ error: message });
      throw err;
    }
  },

}));
