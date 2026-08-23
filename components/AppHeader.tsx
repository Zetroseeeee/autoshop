"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GearIcon } from "./icons";

/** Title row + Basket / Checkout view chips. */
export function AppHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const pathname = usePathname();
  const onRun = pathname.startsWith("/run");
  const onBasket = pathname === "/";
  const onSettings = pathname.startsWith("/settings");
  return (
    <header className="mb-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-[26px] font-bold leading-8 tracking-[-0.01em]">{title}</h1>
        {right ? <div className="tabular text-right text-[13px] font-medium text-grey">{right}</div> : null}
      </div>
      <div className="mt-3 flex items-center gap-1">
        <Link href="/" className="view-chip" data-active={onBasket} prefetch={false}>
          Basket
        </Link>
        <Link href="/run" className="view-chip" data-active={onRun} prefetch={false}>
          Checkout
        </Link>
        <Link href="/settings" aria-label="Settings" className={`ml-auto flex h-9 w-9 items-center justify-center rounded-full hover:text-ink ${onSettings ? "bg-ink text-white hover:text-white" : "text-grey"}`} prefetch={false}>
          <GearIcon />
        </Link>
      </div>
    </header>
  );
}
