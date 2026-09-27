import { redirect } from "next/navigation";

// /dashboard → /dashboard/feed
export default function DashboardIndex() {
  redirect("/dashboard/feed");
}
