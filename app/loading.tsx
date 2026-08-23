/** Route-level skeleton while the basket loads from the database. */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pb-12 pt-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[26px] font-bold leading-8">Basket</h1>
        <div className="shimmer h-3 w-24 rounded-full" />
      </div>
      <div className="mt-3 flex gap-1">
        <div className="shimmer h-8 w-20 rounded-full" />
        <div className="shimmer h-8 w-24 rounded-full" />
      </div>
      <div className="mt-4 h-[52px] rounded-full bg-card shadow-card" />
      {[0, 1].map((s) => (
        <section key={s} className="card mt-4 px-4 py-3">
          <div className="shimmer h-3 w-32 rounded-full" />
          {[0, 1, 2].map((r) => (
            <div key={r} className="flex gap-3 py-3">
              <div className="shimmer h-16 w-16 rounded-tile" />
              <div className="flex-1">
                <div className="shimmer h-3 w-3/4 rounded-full" />
                <div className="shimmer mt-2 h-3 w-1/4 rounded-full" />
              </div>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
