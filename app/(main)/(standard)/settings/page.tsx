"use client";

import { StoreSettingsForm } from "@/components/settings/StoreSettingsForm";
import { MenuPageHeader } from "@/components/menu/MenuPageHeader";

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl">
      <MenuPageHeader title="Settings" />
      <StoreSettingsForm />
    </div>
  );
}
