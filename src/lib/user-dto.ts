import { Role, User } from "@prisma/client";

export type UserDto = {
  id: string;
  email: string;
  name: string;
  role: Role;
  studentId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function toUserDto(user: Pick<User, "id" | "email" | "name" | "role" | "studentId" | "isActive" | "createdAt" | "updatedAt">): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    studentId: user.studentId,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
