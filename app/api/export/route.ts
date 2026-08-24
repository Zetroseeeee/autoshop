import { listItems } from "@/lib/items";
import { requireUser } from "@/lib/session";
import { errorResponse } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** JSON export of the signed-in user's items (download). */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  try {
    const items = await listItems(auth.user.id);
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
