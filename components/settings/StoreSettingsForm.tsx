"use client";

import { useState } from "react";
import { DEFAULT_RESERVATION_DAY, useStoreSettingsStore } from "@/stores/storeSettingsStore";
import { dateToLocalKey } from "@/lib/orders-firestore";
import { Button } from "@/components/ui/Button";
import { RemoveButton } from "@/components/menu/RowParts";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type HolidayStatus = "upcoming" | "now" | "past";

const CANADA_TIMEZONES = [
  { value: "America/Vancouver", label: "Pacific Time — Vancouver, Victoria" },
  { value: "America/Edmonton", label: "Mountain Time — Edmonton, Calgary" },
  { value: "America/Regina", label: "Central Time (no DST) — Regina, Saskatoon" },
  { value: "America/Winnipeg", label: "Central Time — Winnipeg" },
  { value: "America/Toronto", label: "Eastern Time — Toronto, Ottawa" },
  { value: "America/Halifax", label: "Atlantic Time — Halifax, Moncton" },
  { value: "America/St_Johns", label: "Newfoundland Time — St. John's" },
] as const;

const DAY_LABELS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "13:00" → "1:00 p.m." */
function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time || "—";
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Strips a typed phone value down to at most 10 digits. Since the input's displayed
 * value always carries a literal "+1 " prefix, that has to be dropped first — otherwise
 * its "1" gets miscounted as a digit the user typed on every keystroke. Once 10 digits
 * are present, further typing is simply ignored (capped, not shifted) — dropping a
 * "country code" digit here would be wrong whenever the real number happens to start
 * with 1. Use {@link extractTenDigitPhoneFromPaste} for pasted values instead. */
function extractTenDigitPhone(raw: string): string {
  const withoutPrefix = raw.startsWith("+1") ? raw.slice(2) : raw;
  return withoutPrefix.replace(/\D/g, "").slice(0, 10);
}

/** Strips a leading "1" country code from a pasted full number (e.g. pasting
 * "+1 234-567-8901" or "12345678901"), then caps at 10 digits. */
function extractTenDigitPhoneFromPaste(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/** Formats up to 10 NANP digits as "+1 (306) 764-7799", growing as digits are typed. */
function formatNanpPhone(digits: string): string {
  if (digits.length === 0) return "+1 ";
  if (digits.length <= 3) return `+1 (${digits}`;
  if (digits.length <= 6) return `+1 (${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const inputClass =
  "rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20";

/** A saved value in a box the same size as an input, so viewing and editing line up. */
function ValueBox({ value, className = "" }: { value: string; className?: string }) {
  return (
    <div
      className={`${inputClass} min-h-[2.375rem] break-words bg-foreground/[0.03] ${value ? "" : "text-foreground/40"} ${className}`}
    >
      {value || "—"}
    </div>
  );
}

/** One row per weekday: on/off switch + from/to times. Shared by Store Hours and
 * Reservation Hours. Without `onChange` the rows are read-only text. */
function WeeklyHoursRows({
  hours,
  onChange,
  toLabel = "to",
  closedLabel = "Closed",
}: {
  hours: WeeklyHours;
  onChange?: (key: DayKey, patch: Partial<DayHours>) => void;
  toLabel?: string;
  closedLabel?: string;
}) {
  return (
    <>
      {DAY_LABELS.map(({ key, label }, i) => {
        const day = hours[key];
        return (
          <div
            key={key}
            className={`flex min-h-[3.25rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 ${i > 0 ? "border-t border-foreground/8" : ""} ${!day.isOpen ? "bg-foreground/[0.015]" : ""}`}
          >
            <span className={`w-24 shrink-0 text-sm font-medium ${day.isOpen ? "text-foreground" : "text-foreground/35"}`}>
              {label}
            </span>

            {onChange && (
              <button
                type="button"
                role="switch"
                aria-checked={day.isOpen}
                aria-label={label}
                onClick={() => onChange(key, { isOpen: !day.isOpen })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-foreground/20 ${
                  day.isOpen ? "bg-green-500" : "bg-foreground/20"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    day.isOpen ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            )}

            {!day.isOpen ? (
              <span className="ml-auto text-sm text-foreground/30">{closedLabel}</span>
            ) : onChange ? (
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <input
                  type="time"
                  value={day.open}
                  aria-label={`${label} from`}
                  onChange={(e) => onChange(key, { open: e.target.value })}
                  className="rounded-lg border border-foreground/15 bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
                <span className="text-xs text-foreground/40">{toLabel}</span>
                <input
                  type="time"
                  value={day.close}
                  aria-label={`${label} ${toLabel}`}
                  onChange={(e) => onChange(key, { close: e.target.value })}
                  className="rounded-lg border border-foreground/15 bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
            ) : (
              <span className="ml-auto text-sm tabular-nums text-foreground">
                {formatTimeDisplay(day.open)}
                <span className="mx-2 text-xs text-foreground/40">{toLabel}</span>
                {formatTimeDisplay(day.close)}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

/**
 * Edit state for one card: `draft` is null while viewing. Edit copies the saved values
 * into the draft, Cancel throws it away, Save checks it and writes it.
 */
function useSectionEdit<T>({
  load,
  validate,
  save,
  failMessage,
}: {
  load: () => T;
  /** Returns an error message, or null if the draft can be saved. */
  validate?: (draft: T) => string | null;
  save: (draft: T) => Promise<void>;
  failMessage: string;
}) {
  const [draft, setDraft] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return {
    draft,
    /** Change the draft while editing (ignored while viewing). */
    update: (fn: (d: T) => T) => setDraft((d) => (d === null ? d : fn(d))),
    editing: draft !== null,
    saving,
    error,
    setError,
    start: () => {
      setDraft(load());
      setError(null);
    },
    cancel: () => {
      setDraft(null);
      setError(null);
    },
    save: async () => {
      if (draft === null) return;
      const problem = validate?.(draft) ?? null;
      if (problem) return setError(problem);
      setSaving(true);
      setError(null);
      try {
        await save(draft);
        setDraft(null);
      } catch {
        setError(failMessage);
      } finally {
        setSaving(false);
      }
    },
  };
}

type CardEdit = {
  editing: boolean;
  saving: boolean;
  error: string | null;
  start: () => void;
  cancel: () => void;
  save: () => Promise<void>;
};

/**
 * One card per settings section. It looks the same while viewing and editing; Edit in
 * the top-right corner swaps to Cancel + Save.
 */
function SettingsCard({
  title,
  description,
  edit,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  edit: CardEdit;
  children: React.ReactNode;
}) {
  return (
    <form
      className="rounded-xl border border-foreground/10 bg-background"
      onSubmit={(e) => {
        e.preventDefault();
        if (edit.editing && !edit.saving) void edit.save();
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-foreground/60">{description}</p>}
        </div>
        {edit.editing ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={edit.cancel} disabled={edit.saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={edit.saving}>
              {edit.saving ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={edit.start}>
            Edit
          </Button>
        )}
      </div>
      <div className="space-y-4 px-4 py-4 sm:px-5">
        {edit.error && (
          <p className="text-sm text-red-600" role="alert">
            {edit.error}
          </p>
        )}
        {children}
      </div>
    </form>
  );
}

/** Reservation hours to show/edit: the saved ones or, if never saved, 1 PM to 8 PM on the
 * days the store is open. */
function initialReservationHours(settings: StoreSettings): WeeklyHours {
  if (settings.reservationHours) return structuredClone(settings.reservationHours);
  const result = {} as WeeklyHours;
  for (const { key } of DAY_LABELS) {
    result[key] = { ...DEFAULT_RESERVATION_DAY, isOpen: settings.hours[key]?.isOpen ?? false };
  }
  return result;
}

/** Name of the first open day whose times are missing or out of order, or null. */
function badDay(hours: WeeklyHours, allowEqual: boolean): string | null {
  const found = DAY_LABELS.find(({ key }) => {
    const day = hours[key];
    if (!day.isOpen) return false;
    if (!day.open || !day.close) return true;
    return allowEqual ? day.open > day.close : day.open >= day.close;
  });
  return found?.label ?? null;
}

export function StoreSettingsForm() {
  // Settings are loaded once at login (AuthContext), so no fetch here.
  const { settings, loading, error } = useStoreSettingsStore();

  // Only before the first load: once settings exist, a re-fetch or a failed save keeps
  // the cards on screen (save errors show in each card).
  if (!settings && loading) {
    return <p className="text-foreground/50 text-sm">Loading settings…</p>;
  }
  if (!settings && error) {
    return <p className="text-red-500 text-sm" role="alert">{error}</p>;
  }
  if (!settings) {
    return <p className="text-foreground/50 text-sm">No settings found.</p>;
  }

  // Each card keeps its own draft, so saving one never touches unsaved edits in another.
  return (
    <div className="space-y-4">
      <StoreHoursCard settings={settings} />
      <ReservationHoursCard settings={settings} />
      <WaitTimeCard settings={settings} />
      <RestaurantPhoneCard settings={settings} />
      <HolidaysCard settings={settings} />
    </div>
  );
}

function StoreHoursCard({ settings }: { settings: StoreSettings }) {
  const updateSettings = useStoreSettingsStore((s) => s.updateSettings);
  const edit = useSectionEdit({
    load: () => ({ timezone: settings.timezone, hours: structuredClone(settings.hours) }),
    validate: (d) => {
      const day = badDay(d.hours, false);
      return day ? `${day}: the opening time must be before the closing time.` : null;
    },
    save: (d) => updateSettings({ hours: d.hours, timezone: d.timezone.trim() }),
    failMessage: "Failed to save hours.",
  });
  const timezoneLabel =
    CANADA_TIMEZONES.find((tz) => tz.value === settings.timezone)?.label ?? settings.timezone;

  return (
    <SettingsCard title="Store hours" description="When customers can place online orders." edit={edit}>
      <label className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="w-24 shrink-0 text-sm text-foreground/60">Timezone</span>
        {edit.draft ? (
          <select
            id="settings-timezone"
            value={edit.draft.timezone}
            autoFocus
            onChange={(e) => {
              const timezone = e.target.value;
              edit.update((d) => ({ ...d, timezone }));
            }}
            className={`${inputClass} min-w-0 flex-1`}
          >
            {CANADA_TIMEZONES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        ) : (
          <ValueBox value={timezoneLabel} className="min-w-0 flex-1" />
        )}
      </label>
      <div className="overflow-hidden rounded-lg border border-foreground/10">
        <WeeklyHoursRows
          hours={edit.draft?.hours ?? settings.hours}
          onChange={
            edit.draft
              ? (key, patch) =>
                  edit.update((d) => ({ ...d, hours: { ...d.hours, [key]: { ...d.hours[key], ...patch } } }))
              : undefined
          }
        />
      </div>
    </SettingsCard>
  );
}

function ReservationHoursCard({ settings }: { settings: StoreSettings }) {
  const updateSettings = useStoreSettingsStore((s) => s.updateSettings);
  const edit = useSectionEdit({
    load: () => initialReservationHours(settings),
    validate: (d) => {
      const day = badDay(d, true);
      return day ? `${day}: the first booking time must be before the last booking time.` : null;
    },
    save: (d) => updateSettings({ reservationHours: d }),
    failMessage: "Failed to save reservation hours.",
  });

  return (
    <SettingsCard
      title="Reservation hours"
      description="When customers can book a table on the website, from the first booking time to the last. Holidays and Pause Online Ordering also stop reservations."
      edit={edit}
    >
      {!settings.reservationHours && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Not saved yet. These are suggested hours; press Edit, then Save to use them.
        </p>
      )}
      <div className="overflow-hidden rounded-lg border border-foreground/10">
        <WeeklyHoursRows
          hours={edit.draft ?? initialReservationHours(settings)}
          onChange={
            edit.draft
              ? (key, patch) => edit.update((d) => ({ ...d, [key]: { ...d[key], ...patch } }))
              : undefined
          }
          toLabel="last booking"
          closedLabel="No reservations"
        />
      </div>
    </SettingsCard>
  );
}

function WaitTimeCard({ settings }: { settings: StoreSettings }) {
  const updateSettings = useStoreSettingsStore((s) => s.updateSettings);
  const edit = useSectionEdit({
    load: () => settings.waitTime ?? 0,
    save: (waitTime) => updateSettings({ waitTime }),
    failMessage: "Failed to save wait time.",
  });

  return (
    <SettingsCard
      title="Order wait time"
      description="Shown at checkout as &ldquo;Ready in about … min&rdquo; for ASAP orders."
      edit={edit}
    >
      <label className="flex items-center gap-3">
        <span className="w-24 shrink-0 text-sm text-foreground/60">Wait time</span>
        {edit.draft !== null ? (
          <input
            type="number"
            min={0}
            step={1}
            autoFocus
            value={edit.draft}
            onChange={(e) => {
              const minutes = Math.max(0, Number(e.target.value));
              edit.update(() => minutes);
            }}
            className={`${inputClass} w-28`}
          />
        ) : (
          <ValueBox value={String(settings.waitTime ?? 0)} className="w-28" />
        )}
        <span className="text-sm text-foreground/50">minutes</span>
      </label>
    </SettingsCard>
  );
}

function RestaurantPhoneCard({ settings }: { settings: StoreSettings }) {
  const updateSettings = useStoreSettingsStore((s) => s.updateSettings);
  const savedDigits = extractTenDigitPhone(settings.restaurantPhoneNumber ?? "");
  const edit = useSectionEdit({
    load: () => savedDigits,
    validate: (digits) =>
      digits.length === 10 ? null : "Enter a complete 10-digit phone number, e.g. +1 (306) 764-7799.",
    save: (digits) => updateSettings({ restaurantPhoneNumber: `+1${digits}` }),
    failMessage: "Failed to save restaurant phone number.",
  });

  return (
    <SettingsCard
      title="Restaurant phone"
      description="Called automatically if a new order sits unconfirmed for 15 seconds."
      edit={edit}
    >
      <label className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="w-24 shrink-0 text-sm text-foreground/60">Phone number</span>
        {edit.draft !== null ? (
          <input
            type="tel"
            inputMode="numeric"
            autoFocus
            value={formatNanpPhone(edit.draft)}
            onChange={(e) => {
              const digits = extractTenDigitPhone(e.target.value);
              edit.update(() => digits);
            }}
            onPaste={(e) => {
              e.preventDefault();
              const digits = extractTenDigitPhoneFromPaste(e.clipboardData.getData("text"));
              edit.update(() => digits);
            }}
            placeholder="+1 (306) 764-7799"
            className={`${inputClass} min-w-0 flex-1 placeholder:text-foreground/35`}
          />
        ) : (
          <ValueBox value={savedDigits ? formatNanpPhone(savedDigits) : ""} className="min-w-0 flex-1" />
        )}
      </label>
    </SettingsCard>
  );
}

function HolidaysCard({ settings }: { settings: StoreSettings }) {
  const updateSettings = useStoreSettingsStore((s) => s.updateSettings);
  // The "add a holiday" fields, shown while editing.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function clearTyped() {
    setFrom("");
    setTo("");
  }

  /** The holiday typed in the From/To fields, an error message, or null if none typed. */
  function typedHoliday(): Holiday | string | null {
    if (!from) return to ? 'Pick a "From" date.' : null;
    if (to && to < from) return '"To" date cannot be before "From" date.';
    return { id: crypto.randomUUID(), from, ...(to ? { to } : {}) };
  }

  const edit = useSectionEdit({
    load: () => structuredClone(settings.holidays ?? []),
    // A date still sitting in the From/To fields is added when Save is pressed.
    validate: () => {
      const typed = typedHoliday();
      return typeof typed === "string" ? typed : null;
    },
    save: async (list) => {
      const typed = typedHoliday();
      await updateSettings({ holidays: typed && typeof typed !== "string" ? [...list, typed] : list });
      clearTyped();
    },
    failMessage: "Failed to save holidays.",
  });

  function addTyped() {
    const typed = typedHoliday();
    if (typeof typed === "string") return edit.setError(typed);
    if (!typed) return;
    edit.setError(null);
    edit.update((list) => [...list, typed]);
    clearTyped();
  }

  // Upcoming (and current) holidays first, soonest first; past ones after, most
  // recent first. "YYYY-MM-DD" strings compare correctly as text.
  const todayKey = dateToLocalKey(new Date());
  const holidays = (edit.draft ?? settings.holidays ?? [])
    .map((h) => {
      const end = h.to ?? h.from;
      const status: HolidayStatus = end < todayKey ? "past" : h.from <= todayKey ? "now" : "upcoming";
      return { ...h, status };
    })
    .sort((a, b) => {
      if ((a.status === "past") !== (b.status === "past")) return a.status === "past" ? 1 : -1;
      return a.status === "past" ? b.from.localeCompare(a.from) : a.from.localeCompare(b.from);
    });

  return (
    <SettingsCard
      title="Holidays"
      description="Days the restaurant is closed. Online orders and reservations are off on these days."
      edit={{
        ...edit,
        cancel: () => {
          clearTyped();
          edit.cancel();
        },
      }}
    >
      {edit.editing && (
        <div className="flex flex-col gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4 sm:flex-row sm:items-end sm:gap-3">
          <label className="flex-1">
            <span className="mb-1.5 block text-xs font-medium text-foreground/60">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </label>
          <span className="text-sm text-foreground/40 sm:pb-2.5">to</span>
          <label className="flex-1">
            <span className="mb-1.5 block text-xs font-medium text-foreground/60">
              To <span className="text-foreground/40">(optional)</span>
            </span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </label>
          <Button variant="secondary" onClick={addTyped} disabled={!from || edit.saving}>
            + Add
          </Button>
        </div>
      )}

      {holidays.length === 0 ? (
        <p className="text-sm text-foreground/50">No holidays added yet.</p>
      ) : (
        <ul className="divide-y divide-foreground/10 overflow-hidden rounded-lg border border-foreground/10">
          {holidays.map((h) => (
            <li
              key={h.id}
              className={`flex min-h-10 items-center justify-between gap-4 px-3 py-2 ${
                h.status === "past" ? "bg-foreground/[0.015]" : ""
              }`}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className={`text-sm font-medium ${h.status === "past" ? "text-foreground/40" : "text-foreground"}`}>
                  {h.to ? `${formatDateDisplay(h.from)} – ${formatDateDisplay(h.to)}` : formatDateDisplay(h.from)}
                </p>
                {h.status === "now" && (
                  <span className="rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    Now
                  </span>
                )}
                {h.status === "past" && (
                  <span className="rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-xs font-medium text-foreground/50">
                    Past
                  </span>
                )}
              </div>
              {edit.editing && (
                <RemoveButton
                  onClick={() => edit.update((list) => list.filter((x) => x.id !== h.id))}
                  label={`Remove holiday ${formatDateDisplay(h.from)}`}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  );
}
