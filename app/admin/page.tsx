import { redirect } from "next/navigation";
import { isAuthed, sessionUsername } from "@/lib/adminAuth";
import { readConfig } from "@/lib/abConfig";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isAuthed()) {
    redirect("/admin/login");
  }
  const config = await readConfig();
  const username = sessionUsername() ?? "";
  return <AdminDashboard initialConfig={config} username={username} />;
}
