import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ImportExport } from "@/components/ImportExport";
import { LockButton } from "@/components/LockButton";
import { ShortcutGuide } from "@/components/ShortcutGuide";
import { ToastProvider } from "@/components/Toast";
import { CheckIcon } from "@/components/icons";
import { redirect } from "next/navigation";
import { resolveAppUrl } from "@/lib/appUrl";
import { currentUser } from "@/lib/session";
import { autoStudioEnabled, backViewEnabled, studioCap, studioUsageThisMonth } from "@/lib/studio";

export const dynamic = "force-dynamic";

const ENV_KEYS = [
  ["DATABASE_URL", "Neon Postgres"],
  ["BLOB_READ_WRITE_TOKEN", "Vercel Blob (studio photos)"],
  ["GEMINI_API_KEY", "Gemini (studio photos + brand/category fallback)"],
  ["AUTH_SECRET", "Signs session cookies"],
  ["SCRAPER_API_KEY", "Scraping API for bot-walled stores (optional)"],
  ["APP_URL", "Public URL (optional — falls back to this page's own origin)"],
  ["CRON_SECRET", "Daily price check (optional)"],
] as const;

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const present = Object.fromEntries(ENV_KEYS.map(([k]) => [k, Boolean(process.env[k])])) as Record<(typeof ENV_KEYS)[number][0], boolean>;
  let used = 0;
  let usageError = false;
  try {
    used = await studioUsageThisMonth(user.id);
  } catch {
    usageError = true;
  }
  const cap = studioCap();
  const appUrl = await resolveAppUrl();

  return (
    <ToastProvider>
      <main className="mx-auto w-full max-w-[560px] px-4 pb-12 pt-5">
        <AppHeader title="Settings" />

        <section className="card px-5 py-4">
          <h2 className="text-[13px] font-semibold text-grey">Configuration</h2>
          <ul className="mt-2 divide-y divide-hairline">
            {ENV_KEYS.map(([key, label]) => (
              <li key={key} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[12px] font-semibold">{key}</p>
                  <p className="text-[12px] text-grey">{label}</p>
                </div>
                {present[key] ? (
                  <span className="chip chip-arrived">
                    <CheckIcon size={12} /> set
                  </span>
                ) : (
                  <span className="chip chip-grey">not set</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-grey-light">Only presence is shown — values never leave the server.</p>
        </section>

        <section className="card mt-3 px-5 py-4">
          <h2 className="text-[13px] font-semibold text-grey">Studio photos</h2>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-[15px] font-semibold">This month</span>
            <span className="tabular text-[15px] font-bold">
              {usageError ? "—" : used} / {cap}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-tile">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.round((used / cap) * 100))}%` }} />
          </div>
          <ul className="mt-3 space-y-1 text-[12px] text-grey">
            <li>Auto-generate after fetch (AUTO_STUDIO): {autoStudioEnabled() ? "on" : "off"}</li>
            <li>AI back views (BACK_VIEW): {backViewEnabled() ? "on — labelled “AI guess”" : "off"}</li>
            <li>Monthly cap (STUDIO_MONTHLY_CAP): {cap}</li>
          </ul>
        </section>

        <ImportExport />

        <ShortcutGuide appUrl={appUrl} token={user.quickAddToken} />

        <section className="card mt-3 px-5 py-4">
          <h2 className="text-[13px] font-semibold text-grey">Account</h2>
          <p className="mt-1 text-[15px] font-semibold">{user.email}</p>
          <p className="mt-1 text-[13px] text-grey">Your basket is private to this account. Signing out clears the session on this browser only.</p>
          <div className="mt-3">
            <LockButton />
          </div>
        </section>

        <p className="mt-6 text-center text-[12px] text-grey">
          <Link href="/" className="font-semibold text-ink" prefetch={false}>
            Back to basket
          </Link>
        </p>
      </main>
    </ToastProvider>
  );
}
