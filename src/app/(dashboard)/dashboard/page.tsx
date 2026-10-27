import { redirect } from "next/navigation";

// /dashboard → /dashboard/home
export default function DashboardIndex() {
  redirect("/dashboard/home");
}
