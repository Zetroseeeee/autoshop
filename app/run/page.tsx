import { RunScreen } from "@/components/RunScreen";
import { ToastProvider } from "@/components/Toast";
import { listItems } from "@/lib/items";
import { currentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RunPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const items = await listItems(user.id);
  return (
    <ToastProvider>
      <RunScreen initialItems={items} />
    </ToastProvider>
  );
}
