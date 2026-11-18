/** The approved horizontal logo — used as supplied (cropped to its artwork bounds, not altered). */
export function Logo({ variant = "colour", className, priority = false }: { variant?: "colour" | "white"; className?: string; priority?: boolean }) {
  return (
    <picture>
      <source type="image/webp" srcSet={`/brand/logo-${variant}-600.webp 600w, /brand/logo-${variant}-1200.webp 1200w`} sizes="(min-width: 640px) 240px, 180px" />
      <img
        src={`/brand/logo-${variant}-600.png`}
        srcSet={`/brand/logo-${variant}-600.png 600w, /brand/logo-${variant}-1200.png 1200w`}
        sizes="(min-width: 640px) 240px, 180px"
        width={600}
        height={138}
        alt="Mr. IndiaNZ"
        className={className}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
      />
    </picture>
  );
}
