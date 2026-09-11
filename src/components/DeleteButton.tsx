"use client";

import { useEffect, useState, useTransition } from "react";
import { deletePost } from "@/lib/actions";

/** Delete in two presses: the first arms it, the second (within a few seconds) deletes. */
export default function DeleteButton({ id }: { id: number }) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => (armed ? startTransition(() => deletePost(id)) : setArmed(true))}
      className={[
        "transition-colors duration-150 disabled:opacity-50",
        armed ? "font-semibold text-accent" : "hover:text-ink",
      ].join(" ")}
    >
      {pending ? "Deleting…" : armed ? "Confirm delete" : "Delete"}
    </button>
  );
}
