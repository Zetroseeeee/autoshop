import { BasketScreen } from "@/components/BasketScreen";
import { ToastProvider } from "@/components/Toast";
import { listItems } from "@/lib/items";

export const dynamic = "force-dynamic";

export default async function BasketPage({ searchParams }: PageProps<"/">) {
  const { notice } = await searchParams;
  const items = await listItems();
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
