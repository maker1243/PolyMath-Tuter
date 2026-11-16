import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

export default async function QuizLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) {
    redirect("/auth/login?next=/quiz");
  }
  return <>{children}</>;
}
