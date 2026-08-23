"use client";

import { EmptyState } from "@/components/EmptyState";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pb-12 pt-10">
      <EmptyState title="Something went wrong" body={error.message.includes("DATABASE_URL") ? "DATABASE_URL isn't configured." : "The basket couldn't be loaded."}>
        <button type="button" className="btn-secondary" onClick={reset}>
          Try again
        </button>
      </EmptyState>
    </main>
  );
}
