/** iOS Shortcut instructions (spec §9.4). Rendered on /settings and mirrored in the README. */
export function ShortcutGuide({ appUrl, token }: { appUrl: string; token: string }) {
  const base = appUrl || "https://YOUR-APP.vercel.app";
  return (
    <section className="card mt-3 px-5 py-4">
      <h2 className="text-[13px] font-semibold text-grey">Add to Basket from the iPhone share sheet</h2>
      <p className="mt-1 text-[13px] text-grey">
        iOS Safari doesn&apos;t support PWA share targets, so a Shortcut does the job. It takes about two minutes to set up.
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13px] leading-5">
        <li>
          Open the <strong>Shortcuts</strong> app and tap <strong>+</strong> to create a new shortcut.
        </li>
        <li>
          Tap the shortcut name at the top → <strong>Rename</strong> → call it <strong>Add to Basket</strong>.
        </li>
        <li>
          Tap the <strong>ⓘ</strong> (info) button at the bottom, turn on <strong>Show in Share Sheet</strong>, then tap
          <strong> Share Sheet Types</strong> and keep only <strong>URLs</strong> and <strong>Safari web pages</strong> selected. Tap Done.
        </li>
        <li>
          Add the action <strong>Get URLs from Input</strong> (search “Get URLs”). Set its input to <strong>Shortcut Input</strong>.
        </li>
        <li>
          Add the action <strong>Text</strong> and paste exactly this — it already contains your personal token:
          <pre className="mt-1 overflow-x-auto rounded-[12px] bg-tile p-3 font-mono text-[11px] leading-4">{`${base}/api/quick-add?token=${token}&url=`}</pre>
          then tap at the end of the text and insert the variable <strong>URLs</strong> (from the previous action) so the link is appended.
        </li>
        <li>
          Add the action <strong>Get Contents of URL</strong>. Set its URL to the <strong>Text</strong> variable, expand <strong>Show More</strong>,
          set <strong>Method</strong> to <strong>GET</strong>, and add a header <code>Accept</code> = <code>application/json</code>.
        </li>
        <li>
          Add <strong>Show Notification</strong> with the text “Added to Basket” (optional, but nice).
        </li>
        <li>
          Done. In Safari (or any app), tap <strong>Share</strong> → <strong>Add to Basket</strong>. The item appears in your basket within a few seconds.
        </li>
      </ol>
      <p className="mt-3 text-[12px] text-grey">
        Prefer to see the basket straight away? Use <strong>Open URLs</strong> instead of <strong>Get Contents of URL</strong> in step 6 — the app adds the item and
        opens your basket.
      </p>
      <p className="mt-2 text-[12px] text-grey">
        Treat that link like a password — anyone holding it can add items to your basket (it cannot read or delete anything).
      </p>
      <p className="mt-2 text-[12px] text-grey">
        Install the app itself: Safari → Share → <strong>Add to Home Screen</strong>. On Android/desktop Chrome, use the browser&apos;s Install option and the
        share sheet works natively.
      </p>
    </section>
  );
}
