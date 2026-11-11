export type Role = "admin" | "teacher" | "student";

export function homeForRole(role: Role | null | undefined) {
  switch (role) {
    case "admin":
      return "/admin";
    case "teacher":
      return "/teacher";
    case "student":
      return "/student";
    default:
      return "/login";
  }
}

export const roleLabel: Record<Role, string> = {
  admin: "Platform administrator",
  teacher: "teacher",
  student: "student",
};
