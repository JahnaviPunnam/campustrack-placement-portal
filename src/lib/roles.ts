import type { Role } from "@/lib/constants";

export function roleHome(role: Role): string {
  switch (role) {
    case "STUDENT":
      return "/student";
    case "PLACEMENT_OFFICER":
      return "/officer";
    case "RECRUITER":
      return "/recruiter";
    default:
      return "/login";
  }
}

export function roleLabel(role: Role): string {
  switch (role) {
    case "STUDENT":
      return "Student";
    case "PLACEMENT_OFFICER":
      return "Placement officer";
    case "RECRUITER":
      return "Recruiter";
    default:
      return "User";
  }
}
