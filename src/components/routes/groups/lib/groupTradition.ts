import type { TraditionOption } from "@/components/routes/traditions/api/traditionsApi";
import type { GroupTraditionDTO } from "../api/groupsApi";

/** Radix Select items cannot carry an empty value, so "none" needs its own. */
export const NO_TRADITION = "__none__";

export function traditionLabel(tradition: GroupTraditionDTO): string {
  return tradition.name?.trim() || tradition.code;
}

/**
 * The picker's options. A group's current tradition is kept even when the
 * list lacks it (the list failed to load, or the tradition was renamed), so a
 * saved value never shows as blank.
 */
export function traditionPickerOptions(
  options: TraditionOption[],
  current?: GroupTraditionDTO | null,
): TraditionOption[] {
  if (!current || options.some((option) => option.code === current.code)) {
    return options;
  }
  return [...options, { code: current.code, name: traditionLabel(current) }];
}

/** The `tradition_code` a save sends for the form value: null clears it. */
export function traditionCodeForSave(value?: string): string | null {
  const code = value?.trim();
  return code || null;
}
