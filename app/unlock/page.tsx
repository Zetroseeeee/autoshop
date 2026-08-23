import { Keypad } from "@/components/Keypad";
import { safeNextPath } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UnlockPage({ searchParams }: PageProps<"/unlock">) {
  const { next } = await searchParams;
  const target = safeNextPath(typeof next === "string" ? next : null);
  const configured = Boolean(process.env.ACCESS_CODE);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-4 py-8">
      <Keypad next={target} configured={configured} />
    </main>
  );
}
