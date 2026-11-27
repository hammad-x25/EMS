import { z } from "zod";
import { db } from "@/lib/db";

export const WorkspacePreferencesSchema = z.object({
  fontSize: z.enum(["sm", "md", "lg"]),
  theme: z.enum(["light", "dark", "high-contrast"]),
  palettePos: z.enum(["left", "right"]),
  compactMode: z.boolean(),
  hideTimer: z.boolean(),
});

export const WorkspacePreferencesPatchSchema = WorkspacePreferencesSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one preference must be supplied",
);

export type WorkspacePreferences = z.infer<typeof WorkspacePreferencesSchema>;

const defaultPreferences: WorkspacePreferences = {
  fontSize: "md",
  theme: "light",
  palettePos: "right",
  compactMode: false,
  hideTimer: false,
};

export async function getWorkspacePreferences(userId: string): Promise<WorkspacePreferences> {
  const preference = await db.userPreference.findUnique({ where: { userId } });
  if (!preference) return defaultPreferences;
  return WorkspacePreferencesSchema.parse(preference);
}

export async function updateWorkspacePreferences(
  userId: string,
  patch: z.infer<typeof WorkspacePreferencesPatchSchema>,
): Promise<WorkspacePreferences> {
  const preference = await db.userPreference.upsert({
    where: { userId },
    create: { userId, ...defaultPreferences, ...patch },
    update: patch,
  });
  return WorkspacePreferencesSchema.parse(preference);
}
