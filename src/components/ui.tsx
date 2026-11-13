import Link from "next/link";
import { initial } from "@/lib/format";
import { BackIcon } from "./icons";

/** A simple page frame for the secondary screens: back link, title, content. */
export function Page({
  title, back, children,
}: { title: string; back?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-12 pt-4">
      <header className="mb-6 flex items-center gap-2">
        {back && (
          <Link
            href={back}
            aria-label="Back"
            className="-ml-2 flex h-12 w-12 items-center justify-center rounded-full text-ink active:bg-line"
          >
            <BackIcon className="h-6 w-6" />
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </header>
      {children}
    </main>
  );
}

export function Avatar({
  name, src, size = "md", active = false,
}: { name: string; src?: string | null; size?: "sm" | "md" | "lg"; active?: boolean }) {
  const dims = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-14 w-14 text-xl" }[size];
  const tone = active ? "bg-brand text-white" : "bg-brand-soft text-brand-ink";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${dims} shrink-0 rounded-full object-cover`} />
  ) : (
    <span aria-hidden className={`${dims} ${tone} flex shrink-0 items-center justify-center rounded-full font-semibold`}>
      {initial(name)}
    </span>
  );
}

export const fieldClass =
  "w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none";

export const primaryButton =
  "flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-4 text-lg font-semibold text-white transition active:scale-[0.98] active:bg-brand-ink disabled:opacity-50";

export const quietButton =
  "flex w-full items-center justify-center rounded-2xl px-5 py-3.5 font-medium text-muted active:bg-line";

export function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}
