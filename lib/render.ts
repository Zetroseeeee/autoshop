import { MOBILE_UA, type FetchedPage } from "./fetchPage";

/**
 * Tier 2 — rendered fetch with playwright-core. On Vercel the bundled
 * @sparticuz/chromium binary is used; locally a system Chrome is auto-detected
 * (or CHROME_EXECUTABLE_PATH). Everything is imported lazily so a machine without
 * Chromium still runs the rest of the app. Any failure degrades to null.
 */
const LOCAL_CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

/**
 * Probe the filesystem without a statically analysable `fs` call: Next's output
 * tracer treats `existsSync(variable)` as "trace the whole project", which would
 * drag the entire repo into the Vercel function bundle.
 */
async function fileExists(path: string): Promise<boolean> {
  const fs = (await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ "node:" + "fs/promises")) as typeof import("node:fs/promises");
  return fs
    .access(path)
    .then(() => true)
    .catch(() => false);
}

async function resolveBrowser(): Promise<{ executablePath: string; args: string[] }> {
  const explicit = process.env.CHROME_EXECUTABLE_PATH;
  if (explicit && (await fileExists(explicit))) return { executablePath: explicit, args: [] };
  const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV);
  if (!serverless) {
    for (const p of LOCAL_CHROME) if (await fileExists(p)) return { executablePath: p, args: [] };
  }
  const { default: chromium } = await import("@sparticuz/chromium");
  chromium.setGraphicsMode = false; // no WebGL needed for scraping — skips swiftshader extraction
  return { executablePath: await chromium.executablePath(), args: chromium.args };
}

export interface RenderOptions {
  timeoutMs?: number;
  settleMs?: number;
}

export async function renderHtml(url: string, opts: RenderOptions = {}): Promise<FetchedPage | null> {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const settleMs = opts.settleMs ?? 2_000;
  let browser: import("playwright-core").Browser | undefined;
  try {
    const { chromium: pw } = await import("playwright-core");
    const { executablePath, args } = await resolveBrowser();
    browser = await pw.launch({
      executablePath,
      headless: true,
      args: [...args, "--disable-blink-features=AutomationControlled"],
      timeout: 15_000,
    });
    const context = await browser.newContext({
      userAgent: MOBILE_UA,
      locale: "en-GB",
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      extraHTTPHeaders: { "accept-language": "en-GB,en;q=0.9" },
    });
    const page = await context.newPage();
    // Skip heavy assets — we only need the DOM.
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "media" || type === "font") return route.abort();
      return route.continue();
    });
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForTimeout(settleMs);
    const html = await page.content();
    return { html, status: response?.status() ?? 200, finalUrl: page.url() };
  } catch (err) {
    console.warn("[render] degraded:", err instanceof Error ? err.message.split("\n")[0] : err);
    return null;
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
