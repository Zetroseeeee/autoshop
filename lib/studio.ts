import { put } from "@vercel/blob";
import { sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "./db";
import { PAGE_HEADERS } from "./fetchPage";
import { GEMINI_IMAGE_MODELS, gemini, geminiConfigured } from "./gemini";
import { getItem, updateItem } from "./items";
import { studioUsage, type Item, type ItemCategory } from "./schema";

/**
 * Studio packshot pipeline (spec §7): source photo → Gemini image model →
 * PNG on Vercel Blob → studioImageUrl (+ optional AI-guessed back view).
 * Monthly cap enforced via studio_usage. Failures keep the original and bubble
 * up as a friendly Error message for a toast.
 */

export class StudioError extends Error {}

export function studioCap(): number {
  const n = Number(process.env.STUDIO_MONTHLY_CAP ?? 200);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 200;
}

export function backViewEnabled(): boolean {
  return process.env.BACK_VIEW === "true";
}

export function autoStudioEnabled(): boolean {
  return process.env.AUTO_STUDIO === "true";
}

export function studioConfigured(): boolean {
  return geminiConfigured() && Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function currentMonth(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function studioUsageThisMonth(): Promise<number> {
  const [row] = await db.select({ count: studioUsage.count }).from(studioUsage).where(sql`${studioUsage.month} = ${currentMonth()}`).limit(1);
  return row?.count ?? 0;
}

async function incrementUsage(): Promise<void> {
  await db
    .insert(studioUsage)
    .values({ month: currentMonth(), count: 1 })
    .onConflictDoUpdate({ target: studioUsage.month, set: { count: sql`${studioUsage.count} + 1` } });
}

// ---- prompt -----------------------------------------------------------------

const STYLE: Record<ItemCategory, string> = {
  jacket: "flat-lay or ghost-mannequin",
  top: "flat-lay or ghost-mannequin",
  trousers: "flat-lay or ghost-mannequin",
  shoes: "pair in three-quarter side profile",
  accessory: "front-on",
  other: "front-on",
};

export function studioPrompt(category: ItemCategory, view: "front" | "back" = "front"): string {
  const viewText = view === "front" ? "front view" : "back view — infer the back of the item consistently with what is visible in the source photo";
  return (
    `Professional e-commerce product photo of this exact item. Extract the product from the photo and re-shoot it as a clean studio packshot: ` +
    `centred, ${viewText}, ${STYLE[category]}, pure white seamless background (#FFFFFF), soft even studio lighting, subtle natural shadow beneath the item, ` +
    `no people, no hands, no text, no props, no watermark. Preserve the item's exact colours, materials, proportions, logos, stitching and details. Square 1:1 composition.`
  );
}

// ---- source image -------------------------------------------------------------

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

export async function downloadSourceImage(url: string, referer?: string): Promise<{ data: Buffer; mimeType: string }> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { ...PAGE_HEADERS, accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8", ...(referer ? { referer } : {}) },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new StudioError("Couldn't download the source image");
  }
  if (!res.ok) throw new StudioError(`Couldn't download the source image (${res.status})`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_SOURCE_BYTES) throw new StudioError("Source image is too large");
  const raw = Buffer.from(await res.arrayBuffer());
  if (raw.byteLength > MAX_SOURCE_BYTES) throw new StudioError("Source image is too large");
  if (raw.byteLength < 100) throw new StudioError("Source image is empty");
  // Normalise whatever the CDN sent (webp/avif/png/jpeg/gif) into a bounded JPEG the model accepts.
  try {
    const data = await sharp(raw, { animated: false })
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toBuffer();
    return { data, mimeType: "image/jpeg" };
  } catch {
    throw new StudioError("Source image format isn't supported");
  }
}

// ---- generation -----------------------------------------------------------------

export async function generatePackshot(source: { data: Buffer; mimeType: string }, prompt: string): Promise<Buffer> {
  let lastErr: unknown;
  for (const model of GEMINI_IMAGE_MODELS) {
    try {
      const res = await gemini().models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: source.mimeType, data: source.data.toString("base64") } }, { text: prompt }] }],
        config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
      });
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) {
        const reason = res.candidates?.[0]?.finishReason ?? res.promptFeedback?.blockReason ?? "no image returned";
        throw new StudioError(`The model returned no image (${reason})`);
      }
      const png = Buffer.from(part.inlineData.data, "base64");
      // Normalise to PNG regardless of what the model emitted.
      return await sharp(png).png().toBuffer();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // model renamed/retired → try the next id; anything else is final
      if (/not found|NOT_FOUND|is not supported|404/i.test(msg) && model !== GEMINI_IMAGE_MODELS[GEMINI_IMAGE_MODELS.length - 1]) {
        console.warn(`[studio] model ${model} unavailable, trying next`);
        continue;
      }
      break;
    }
  }
  if (lastErr instanceof StudioError) throw lastErr;
  throw new StudioError(`Image generation failed: ${apiErrorMessage(lastErr).slice(0, 160)}`);
}

/** The SDK throws with a JSON body as the message; pull out the human part. */
function apiErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const json = JSON.parse(raw.slice(raw.indexOf("{"))) as { error?: { message?: string; status?: string } };
    if (json.error?.message) return json.error.message;
  } catch {
    /* not JSON */
  }
  return raw;
}

async function saveToBlob(itemId: string, view: "front" | "back", png: Buffer): Promise<string> {
  const blob = await put(`studio/${itemId}/${view}-${Date.now()}.png`, png, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: false,
  });
  return blob.url;
}

export interface StudioOutcome {
  item: Item;
  /** set when generation was refused politely (cap, not configured, no image) */
  message?: string;
}

/** Generate (or regenerate) the studio packshot for an item. */
export async function generateStudio(itemId: string): Promise<StudioOutcome> {
  const item = await getItem(itemId);
  if (!item) throw new StudioError("Item not found");
  if (!studioConfigured()) return { item, message: "Studio photos need GEMINI_API_KEY and BLOB_READ_WRITE_TOKEN — see Settings" };
  if (!item.sourceImageUrl) return { item, message: "Add an image URL first, then try Studio photo" };

  const cap = studioCap();
  const used = await studioUsageThisMonth();
  const needed = backViewEnabled() ? 2 : 1;
  if (used + needed > cap) {
    return { item, message: `Studio cap reached — ${used} of ${cap} generations used this month. It resets on the 1st.` };
  }

  const source = await downloadSourceImage(item.sourceImageUrl, item.url);

  const front = await generatePackshot(source, studioPrompt(item.category, "front"));
  const frontUrl = await saveToBlob(item.id, "front", front);
  await incrementUsage();
  let updated = (await updateItem(item.id, { studioImageUrl: frontUrl })) ?? item;

  if (backViewEnabled()) {
    try {
      const back = await generatePackshot(source, studioPrompt(item.category, "back"));
      const backUrl = await saveToBlob(item.id, "back", back);
      await incrementUsage();
      updated = (await updateItem(item.id, { studioBackUrl: backUrl })) ?? updated;
    } catch (err) {
      // the front shot is already saved — the back view is best-effort
      console.warn("[studio] back view failed:", err instanceof Error ? err.message : err);
      return { item: updated, message: "Studio photo ready — the AI back view failed this time" };
    }
  }
  return { item: updated };
}
