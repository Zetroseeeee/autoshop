"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LockButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/unlock", { method: "DELETE" }).catch(() => undefined);
        router.replace("/unlock");
        router.refresh();
      }}
    >
      Lock this device
    </button>
  );
}
