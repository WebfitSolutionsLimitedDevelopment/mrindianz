import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "dark" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-none font-semibold uppercase tracking-[0.16em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 text-center";
const variants: Record<Variant, string> = {
  primary: "bg-gold text-ink hover:bg-ivory border border-gold hover:border-ivory",
  secondary: "border border-ivory/70 text-ivory hover:bg-ivory hover:text-ink",
  ghost: "text-gold hover:text-ivory underline-offset-4 hover:underline px-0",
  dark: "bg-ink text-ivory hover:bg-charcoal-2 border border-ink",
  danger: "bg-danger-ink text-white hover:bg-red-800 border border-danger-ink",
};
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-4 text-[11px]",
  md: "min-h-11 px-6 text-xs",
  lg: "min-h-13 px-8 text-sm",
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
