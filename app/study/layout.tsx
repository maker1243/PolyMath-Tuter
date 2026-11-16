import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

export default async function StudyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) {
    redirect("/auth/login?next=/study");
  }
  return <>{children}</>;
}
