import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ComponentProps } from "react";

/** Pill buttons — Miss India South Pacific style, in Mr. IndiaNZ gold/black/ivory. */
type Variant = "primary" | "secondary" | "outline" | "ghost" | "dark" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold uppercase tracking-[0.14em] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50 text-center";
const variants: Record<Variant, string> = {
  primary: "bg-gradient-to-b from-gold-bright to-gold text-ink shadow-[0_10px_30px_-10px_rgba(227,173,60,.65)] hover:shadow-[0_14px_36px_-10px_rgba(227,173,60,.85)] hover:-translate-y-0.5",
  secondary: "border border-white/40 text-white backdrop-blur-sm hover:bg-white hover:text-ink",
  outline: "border border-espresso/25 text-espresso hover:border-espresso hover:bg-espresso hover:text-ivory",
  ghost: "text-gold-ink hover:text-espresso underline-offset-4 hover:underline px-0",
  dark: "bg-ink text-ivory hover:bg-charcoal-2",
  danger: "bg-danger-ink text-white hover:bg-red-800",
};
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-5 text-[11px]",
  md: "min-h-11 px-7 text-xs",
  lg: "min-h-13 px-9 text-[13px]",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], variant === "ghost" ? "min-h-0" : sizes[size], className);
}

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
