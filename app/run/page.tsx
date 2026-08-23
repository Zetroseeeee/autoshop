import { RunScreen } from "@/components/RunScreen";
import { ToastProvider } from "@/components/Toast";
import { listItems } from "@/lib/items";

export const dynamic = "force-dynamic";

export default async function RunPage() {
  const items = await listItems();
  return (
    <ToastProvider>
      <RunScreen initialItems={items} />
    </ToastProvider>
  );
}
