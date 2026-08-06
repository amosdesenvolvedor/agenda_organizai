import { forwardRef } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../lib/utils";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
}

export function IconButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50",
        className
      )}
      {...props}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-500",
          className
        )}
        {...props}
      />
    );
  }
);

export function Card({ className, children, ...props }: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return <section className={cn("rounded-lg border border-slate-200 bg-white shadow-soft", className)} {...props}>{children}</section>;
}

export function Badge({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700", className)}>
      {children}
    </span>
  );
}
