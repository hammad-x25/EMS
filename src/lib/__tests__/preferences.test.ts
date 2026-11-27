import { describe, expect, it } from "vitest";
import { WorkspacePreferencesPatchSchema, WorkspacePreferencesSchema } from "@/lib/preferences";

describe("workspace preferences", () => {
  it("accepts the supported accessibility settings", () => {
    expect(
      WorkspacePreferencesSchema.parse({
        fontSize: "lg",
        theme: "high-contrast",
        palettePos: "left",
        compactMode: true,
        hideTimer: false,
      }),
    ).toMatchObject({ theme: "high-contrast", palettePos: "left" });
  });

  it("requires a non-empty valid patch", () => {
    expect(() => WorkspacePreferencesPatchSchema.parse({})).toThrow();
    expect(() => WorkspacePreferencesPatchSchema.parse({ fontSize: "xl" })).toThrow();
    expect(WorkspacePreferencesPatchSchema.parse({ hideTimer: true })).toEqual({
      hideTimer: true,
    });
  });
});
