import { BagIcon } from "./icons";

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tile text-grey">
        <BagIcon />
      </div>
      <h2 className="mt-4 text-[15px] font-semibold">{title}</h2>
      {body ? <p className="mt-1 max-w-[280px] text-[13px] text-grey">{body}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
