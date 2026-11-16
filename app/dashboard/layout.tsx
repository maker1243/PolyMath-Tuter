import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = currentUser();
  if (!user) {
    redirect("/auth/login?next=/dashboard");
  }
  return <>{children}</>;
}
