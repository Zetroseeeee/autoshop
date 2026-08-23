import { GoogleGenAI, Type } from "@google/genai";
import { ITEM_CATEGORIES, type ItemCategory } from "./schema";

/**
 * Gemini client + the one small text task (Tier 4: brand & category only).
 * Model ids verified against ai.google.dev/gemini-api/docs/models on 2026-08-23:
 * the brief's gemini-2.5-flash-image is now legacy; gemini-3.1-flash-image is the
 * recommended Nano Banana model. Change these two constants if Google renames again.
 */
export const GEMINI_IMAGE_MODELS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"] as const;
export const GEMINI_TEXT_MODEL = "gemini-3.5-flash-lite";

let client: GoogleGenAI | null = null;

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function gemini(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export interface TextFallbackInput {
  name?: string;
  brand?: string;
  url: string;
  slug: string;
}

/**
 * Ask Gemini for brand + category from the text we already have. It is never
 * asked about price or images, and an unknown brand stays unknown.
 */
export async function inferBrandCategory(input: TextFallbackInput): Promise<{ brand?: string; category?: ItemCategory } | null> {
  if (!geminiConfigured()) return null;
  const res = await gemini().models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents: [
      "You classify online clothing/footwear/accessory listings for a shopping basket.",
      "Using ONLY the text below, return the brand name (null if it is not stated or clearly implied by a well-known product name) and the best category.",
      "Do not guess prices, images or anything else.",
      "",
      `Listing title: ${input.name ?? "(unknown)"}`,
      `Known brand: ${input.brand ?? "(unknown)"}`,
      `URL: ${input.url}`,
      `URL slug words: ${input.slug || "(none)"}`,
    ].join("\n"),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          brand: { type: Type.STRING, nullable: true },
          category: { type: Type.STRING, enum: [...ITEM_CATEGORIES] },
        },
        required: ["category"],
      },
      temperature: 0,
      maxOutputTokens: 120,
    },
  });
  const text = res.text;
  if (!text) return null;
  let parsed: { brand?: string | null; category?: string };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    return null;
  }
  const category = ITEM_CATEGORIES.includes(parsed.category as ItemCategory) ? (parsed.category as ItemCategory) : undefined;
  const brand = typeof parsed.brand === "string" && parsed.brand.trim() && parsed.brand.trim().length <= 60 ? parsed.brand.trim() : undefined;
  return { brand, category };
}
