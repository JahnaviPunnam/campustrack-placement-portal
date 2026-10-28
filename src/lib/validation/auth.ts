import { z } from "zod";
import { BRANCHES, GRADUATION_YEARS } from "@/lib/constants";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number");

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password: passwordSchema,
    confirmPassword: z.string(),
    rollNumber: z
      .string()
      .trim()
      .min(3, "Roll number is required")
      .max(24)
      .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and dashes only"),
    branch: z.enum(BRANCHES),
    graduationYear: z.coerce
      .number()
      .int()
      .refine((year) => GRADUATION_YEARS.includes(year), "Select a valid graduation year"),
    cgpa: z.coerce.number().min(0).max(10).optional(),
    backlogs: z.coerce.number().int().min(0).max(30).default(0),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
