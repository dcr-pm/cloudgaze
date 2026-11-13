"use client";

/** A brief message above the quick-add bar, with an optional Undo. */
export function Notice({
  notice, onUndo, raised = true,
}: { notice: { text: string; undoId?: string } | null; onUndo: (id: string) => void; raised?: boolean }) {
  if (!notice) return null;
  return (
    <div className={`pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 ${raised ? "bottom-24" : "bottom-6"}`}>
      <div role="status" className="rise pointer-events-auto flex items-center gap-4 rounded-full bg-ink px-5 py-3 text-white shadow-lg">
        <span>{notice.text}</span>
        {notice.undoId && (
          <button type="button" className="font-semibold text-brand-soft underline" onClick={() => onUndo(notice.undoId!)}>
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
