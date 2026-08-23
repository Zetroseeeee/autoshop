import { listItems } from "@/lib/items";
import { errorResponse } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** JSON export of every item (download). */
export async function GET() {
  try {
    const items = await listItems();
    const body = JSON.stringify({ app: "basket", version: 1, exportedAt: new Date().toISOString(), items }, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="basket-${date}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
