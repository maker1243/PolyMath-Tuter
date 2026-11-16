import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

export default function StudyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = currentUser();
  if (!user) {
    redirect("/auth/login?next=/study");
  }
  return <>{children}</>;
}
