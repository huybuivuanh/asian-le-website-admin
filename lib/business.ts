// The business this admin manages. All data lives under businesses/{businessId}/…
// in the shared asianlepos Firebase project. The id comes from the signed-in admin's
// `businessId` custom claim (set by AuthProvider after sign-in).
import { collection, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

let currentBusinessId: string | null = null;

export function setBusinessId(id: string | null) {
  currentBusinessId = id;
}

export function getBusinessId(): string {
  if (!currentBusinessId) throw new Error("No business selected. Sign out and sign in again.");
  return currentBusinessId;
}

/** Admins only: the business an account may manage here, or null. */
export function adminBusinessFromClaims(claims: Record<string, unknown>): string | null {
  const { businessId, role } = claims;
  return role === "admin" && typeof businessId === "string" && businessId ? businessId : null;
}

// Everything this app edits is the website's menu. In the shared project the POS has its
// own `categories` / `menuItems` / … in the same business, so the website's are stored with
// a `web` prefix. Translating here covers every caller, including ones that pass the
// collection name at runtime (linkedWrites, batch-update).
const WEB_MENU_COLLECTIONS: Record<string, string> = {
  categories: "webCategories",
  menuItems: "webMenuItems",
  optionGroups: "webOptionGroups",
  options: "webOptions",
};
const stored = (name: string) => WEB_MENU_COLLECTIONS[name] ?? name;

/** A collection inside the current business, e.g. bizCol("gallery"). */
export function bizCol(name: string) {
  return collection(db, "businesses", getBusinessId(), stored(name));
}

/** A doc inside the current business, e.g. bizDoc("settings", "store"). */
export function bizDoc(name: string, id: string) {
  return doc(db, "businesses", getBusinessId(), stored(name), id);
}
