import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/adminAuth";
import { readConfig } from "@/lib/abConfig";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isAuthed()) {
    redirect("/admin/login");
  }
  const config = await readConfig();
  return <AdminDashboard initialConfig={config} />;
}
