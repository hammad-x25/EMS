import { Role } from "@prisma/client";
import { z } from "zod";

export const PasswordSchema = z
  .string()
  .min(12, "Password must contain at least 12 characters")
  .max(128, "Password must not exceed 128 characters")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol");

export const LoginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const CreateUserSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  name: z.string().trim().min(2).max(100),
  password: PasswordSchema,
  role: z.nativeEnum(Role),
  studentId: z.string().trim().min(2).max(50).optional().nullable(),
});

export const UpdateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    role: z.nativeEnum(Role).optional(),
    studentId: z.string().trim().min(2).max(50).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const ResetPasswordSchema = z.object({ password: PasswordSchema });

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required").max(128),
    newPassword: PasswordSchema,
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ["newPassword"],
    message: "New password must be different from your current password",
  });

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
