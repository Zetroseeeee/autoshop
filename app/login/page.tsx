import { AuthForm } from "@/components/AuthForm";
import { safeNextPath } from "@/lib/auth";
import { currentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await currentUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-4 py-8">
      <AuthForm mode="login" next={safeNextPath(typeof next === "string" ? next : null)} />
    </main>
  );
}
