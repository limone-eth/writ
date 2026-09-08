import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await isAuthed()) redirect("/admin");
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <LoginForm />
    </main>
  );
}
