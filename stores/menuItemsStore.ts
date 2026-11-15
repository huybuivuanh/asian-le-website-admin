import { bizCol, bizDoc } from "@/lib/business";
import { create } from "zustand";
import {
  Timestamp,
  onSnapshot,
  type Unsubscribe,
  addDoc,
  updateDoc,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import { deleteImageByUrl, uploadImage } from "@/lib/image-upload";
import { KitchenType } from "@/types/enum";
import { itemNumberOf } from "@/lib/menu-item-number";

export type MenuItemInput = {
  name: string;
  /** null = no number (removes it on update). */
  itemNumber?: number | null;
  description?: string;
  price: number;
  imageFile: File | null;
  kitchenType: KitchenType;
  availability?: Availability;
  categoryIds?: string[];
  removeImage?: boolean;
};

interface MenuItemsState {
  items: MenuItem[];
  loading: boolean;
  error: string | null;
  /** Starts a live listener; returns a function that stops it. */
  listen: () => Unsubscribe;
  addMenuItem: (input: MenuItemInput) => Promise<void>;
  updateMenuItem: (id: string, input: MenuItemInput) => Promise<void>;
  reset: () => void;
}

export const useMenuItemsStore = create<MenuItemsState>((set, get) => ({
  items: [],
  loading: false,
  error: null,

  reset: () => {
    set({ items: [], loading: false, error: null });
  },

  listen: () => {
    set({ loading: true, error: null });
    return onSnapshot(
      bizCol("menuItems"),
      (snapshot) => {
        const items: MenuItem[] = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            name: (d.name as string) ?? "",
            itemNumber: itemNumberOf({ name: "", itemNumber: d.itemNumber }),
            description: d.description as string | undefined,
            price: (d.price as number) ?? 0,
            image: d.image as MenuItem["image"] | undefined,
            optionGroupIds: d.optionGroupIds as MenuItem["optionGroupIds"] | undefined,
            categoryIds: d.categoryIds as string[] | undefined,
            kitchenType: (d.kitchenType as KitchenType) ?? KitchenType.Other,
            availability: d.availability as MenuItem["availability"] | undefined,
            soldOutUntil: d.soldOutUntil instanceof Timestamp ? d.soldOutUntil.toDate() : undefined,
            createdAt: d.createdAt?.toDate?.() ?? new Date(),
          };
        });
        items.sort((a, b) => a.name.localeCompare(b.name));
        set({ items, loading: false, error: null });
      },
      (err) => set({ error: err.message || "Failed to fetch menu items", loading: false }),
    );
  },

  addMenuItem: async ({ name, itemNumber, description, price, imageFile, kitchenType, availability, categoryIds }) => {
    set({ error: null });
    try {
      let image: ImageItem | undefined;
      if (imageFile && imageFile.size > 0) {
        const url = await uploadImage("menuItems", imageFile);
        image = { name: imageFile.name, url };
      }

      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: (description ?? "").trim(),
        price: Number.isFinite(price) ? price : 0,
        kitchenType,
        createdAt: serverTimestamp(),
      };
      if (image) payload.image = image;
      if (itemNumber != null) payload.itemNumber = itemNumber;
      if (categoryIds?.length) payload.categoryIds = categoryIds;
      if (availability) payload.availability = availability;

      await addDoc(bizCol("menuItems"), payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add menu item";
      set({ error: message });
      throw err;
    }
  },

  updateMenuItem: async (id, { name, itemNumber, description, price, imageFile, removeImage, kitchenType, availability, categoryIds }) => {
    set({ error: null });
    try {
      const item = get().items.find((m) => m.id === id);
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: (description ?? "").trim(),
        price: Number.isFinite(price) ? price : 0,
        kitchenType,
        availability: availability ?? deleteField(),
        itemNumber: itemNumber ?? deleteField(),
      };
      if (categoryIds !== undefined) payload.categoryIds = categoryIds;

      if (removeImage && item?.image) {
        try { await deleteImageByUrl(item.image.url); } catch { /* ignore */ }
        payload.image = deleteField();
      } else if (imageFile && imageFile.size > 0) {
        if (item?.image) {
          try { await deleteImageByUrl(item.image.url); } catch { /* ignore */ }
        }
        const url = await uploadImage("menuItems", imageFile);
        payload.image = { name: imageFile.name, url };
      }

      await updateDoc(bizDoc("menuItems", id), payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update menu item";
      set({ error: message });
      throw err;
    }
  },

}));
