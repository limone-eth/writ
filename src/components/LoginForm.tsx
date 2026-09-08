"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { login, type LoginState } from "@/lib/actions";

export default function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction} className="w-full max-w-[19rem] rise">
      <h1 className="text-[15px] font-bold tracking-tight text-ink">
        {process.env.NEXT_PUBLIC_SITE_NAME || "writ"}
      </h1>
      <p className="mt-1 text-[13px] text-ink-faint">Only the author gets in.</p>

      <input
        type="password"
        name="password"
        autoFocus
        autoComplete="current-password"
        placeholder="Password"
        aria-label="Password"
        className="mt-6 h-11 w-full rounded-lg border border-rule bg-raised px-3.5 text-[15px] text-ink placeholder:text-ink-faint transition-colors focus:border-ink-faint"
      />

      {state.error && (
        <p role="alert" className="mt-2 text-[13px] text-accent">
          {state.error}
        </p>
      )}

      <Submit />

      <Link
        href="/"
        className="mt-4 block text-center text-[13px] text-ink-faint transition-colors hover:text-ink"
      >
        Back to the blog
      </Link>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-3 h-11 w-full rounded-lg bg-ink text-[14px] font-semibold text-paper transition-[transform,opacity] duration-150 ease-snap hover:opacity-90 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100"
    >
      {pending ? "Checking…" : "Enter"}
    </button>
  );
}
