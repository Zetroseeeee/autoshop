import { BasketScreen } from "@/components/BasketScreen";
import { ToastProvider } from "@/components/Toast";
import { listItems } from "@/lib/items";
import { currentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BasketPage({ searchParams }: PageProps<"/">) {
  const { notice } = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/login");
  const items = await listItems(user.id);
  return (
    <ToastProvider>
      <BasketScreen
        initialItems={items}
        studioEnabled={Boolean(process.env.GEMINI_API_KEY && process.env.BLOB_READ_WRITE_TOKEN)}
        notice={typeof notice === "string" ? notice : null}
      />
    </ToastProvider>
  );
}
