import { describe, it, expect } from "vitest";
import vi from "../vi.js";
import en from "../en.js";

// Khóa regression cho bug menu avatar hiện raw key layout.profile/layout.settings.
function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined),
    obj,
  );
}

const REQUIRED_KEYS = [
  "layout.profile",
  "layout.settings",
  "layout.account",
  "layout.logout",
  "userSettings.title",
  "userSettings.loading",
  "userSettings.displayName",
  "userSettings.language",
  "userSettings.theme",
  "userSettings.themeLight",
  "userSettings.themeDark",
  "userSettings.whaleThreshold",
  "userSettings.saving",
  "userSettings.save",
  "userSettings.saveError",
  "userSettings.saveSuccess",
  "userSettings.avatarUrl",
  "userSettings.avatarHint",
  "userSettings.passwordTitle",
  "userSettings.currentPassword",
  "userSettings.newPassword",
  "userSettings.newPasswordConfirm",
  "userSettings.passwordMismatch",
  "userSettings.passwordSaving",
  "userSettings.passwordSave",
  "userSettings.passwordSuccess",
];

describe.each([
  ["vi", vi],
  ["en", en],
])("layout/userSettings keys (%s)", (_locale, dict) => {
  it.each(REQUIRED_KEYS)("%s tồn tại và khác rỗng", (key) => {
    const value = getPath(dict, key);
    expect(typeof value).toBe("string");
    expect((value as string).length).toBeGreaterThan(0);
    expect(value).not.toBe(key);
  });
});
