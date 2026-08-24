"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "./icons";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${isSignup ? "signup" : "login"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card px-6 pb-6 pt-8">
      <div className="text-center">
        <h1 className="text-[26px] font-bold leading-8">Basket</h1>
        <p className="mt-1 text-[13px] text-grey">{isSignup ? "Create your account" : "Sign in to your basket"}</p>
      </div>

      <form className="mt-6 flex flex-col gap-3" onSubmit={submit}>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-grey">Email</span>
          <input
            className="field"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-grey">Password</span>
          <input
            className="field"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignup ? "At least 8 characters" : "Your password"}
          />
        </label>

        <p className={`h-5 text-center text-[13px] font-medium text-red ${error ? "" : "invisible"}`} aria-live="polite">
          {error ?? " "}
        </p>

        <button type="submit" className="btn-primary" disabled={busy || !email || !password}>
          {busy ? <Spinner /> : null}
          {isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-[13px] text-grey">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-semibold text-ink" prefetch={false}>
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
