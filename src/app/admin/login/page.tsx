import { AdminLoginView } from "@/admin/views/AdminLoginView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Sign In • Namma Info",
  description: "Sign in with administrator credentials.",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return <AdminLoginView />;
}
