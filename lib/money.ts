/** Money helpers. Prices are stored in minor units (pence/cents). */

export const HOME_CURRENCY = "GBP";

export function formatMinor(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor == null) return "";
  const cur = (currency ?? HOME_CURRENCY).toUpperCase();
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(minor / 100);
  } catch {
    return `${cur} ${(minor / 100).toFixed(2)}`;
  }
}

/** "£12.99" / "12,99" / "1,299.00" → 129900 style minor units; null when unparseable. */
export function parsePriceInput(input: string): number | null {
  const amount = parseAmount(input);
  if (amount == null) return null;
  return Math.round(amount * 100);
}

/** Parse a human price string into a major-unit number. Handles £/€/$ and EU decimal commas. */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  let s = String(input).trim();
  if (!s) return null;
  // keep digits, separators; drop currency symbols/codes/words
  s = s.replace(/[^\d.,\-\s]/g, "").trim();
  const m = s.match(/-?\d[\d.,\s]*/);
  if (!m) return null;
  s = m[0].replace(/\s/g, "");
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // the later separator is the decimal separator
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const decimals = s.length - lastComma - 1;
    // "45,99" → decimal comma; "1,299" → thousands
    s = decimals === 2 || decimals === 1 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot >= 0) {
    const decimals = s.length - lastDot - 1;
    // "1.299" (three digits) is almost always a thousands separator
    if (decimals === 3 && s.split(".").length === 2) s = s.replace(".", "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const SYMBOLS: Array<[RegExp, string]> = [
  [/US\$|USD/, "USD"],
  [/CA\$|CAD/, "CAD"],
  [/A\$|AUD/, "AUD"],
  [/NZ\$|NZD/, "NZD"],
  [/HK\$|HKD/, "HKD"],
  [/£|GBP/, "GBP"],
  [/€|EUR/, "EUR"],
  [/¥|JPY/, "JPY"],
  [/₩|KRW/, "KRW"],
  [/CHF/, "CHF"],
  [/SEK/, "SEK"],
  [/NOK/, "NOK"],
  [/DKK/, "DKK"],
  [/PLN|zł/, "PLN"],
  [/CZK|Kč/, "CZK"],
  [/₹|INR/, "INR"],
  [/\$/, "USD"],
];

/** Guess an ISO currency code from a price string like "£45.00" or "45,00 €". */
export function currencyFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const [re, code] of SYMBOLS) if (re.test(text)) return code;
  return null;
}

export function isValidCurrency(code: string | null | undefined): code is string {
  return !!code && /^[A-Z]{3}$/.test(code);
}

/** Sanity rule from the spec: price must be > 0 and < 100,000 (major units). */
export function saneAmount(amount: number | null | undefined): amount is number {
  return amount != null && Number.isFinite(amount) && amount > 0 && amount < 100_000;
}

/** Totals helper: sum of qty × price for GBP-priced items. */
export function gbpTotalMinor(items: Array<{ priceMinor: number | null; currency: string | null; qty: number }>): number {
  return items.reduce((sum, it) => {
    if (it.priceMinor == null) return sum;
    if ((it.currency ?? HOME_CURRENCY).toUpperCase() !== HOME_CURRENCY) return sum;
    return sum + it.priceMinor * it.qty;
  }, 0);
}
