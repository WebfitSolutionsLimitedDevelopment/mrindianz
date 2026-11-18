import { cn } from "@/lib/cn";

/**
 * Theatrical stage backdrop: moving spotlight beams, drifting gold dust and a floor glow.
 * Pure CSS (no stock imagery). Respects prefers-reduced-motion via global CSS.
 * If `image` is provided (organiser-approved photo), it is shown under a cinematic grade instead.
 */
export function StageBackdrop({ image, video, className, intensity = "full" }: { image?: string | null; video?: string | null; className?: string; intensity?: "full" | "soft" }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden bg-ink", className)}>
      {video ? (
        <video className="absolute inset-0 h-full w-full object-cover opacity-70" src={video} autoPlay muted loop playsInline poster={image ?? undefined} />
      ) : image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" fetchPriority="high" />
      ) : null}

      {!image && !video && (
        <>
          {/* back curtain warmth */}
          <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,#2a1d0c_0%,#0a0908_60%)]" />
          {/* spotlight beams */}
          <div className="absolute -top-24 left-[18%] h-[130%] w-[22rem] origin-top animate-beam bg-[linear-gradient(180deg,rgba(245,196,90,.32),rgba(245,196,90,0)_75%)] blur-2xl [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)]" />
          <div className="absolute -top-24 right-[16%] h-[130%] w-[22rem] origin-top animate-beam bg-[linear-gradient(180deg,rgba(255,240,210,.22),rgba(255,240,210,0)_75%)] blur-2xl [animation-delay:-4s] [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)]" />
          {intensity === "full" && (
            <div className="absolute -top-24 left-1/2 h-[120%] w-[28rem] -translate-x-1/2 origin-top bg-[linear-gradient(180deg,rgba(245,196,90,.18),rgba(245,196,90,0)_70%)] blur-3xl [clip-path:polygon(40%_0,60%_0,100%_100%,0_100%)]" />
          )}
          {/* gold dust */}
          <div className="absolute inset-x-0 top-0 h-[200%] animate-drift opacity-70 [background-image:radial-gradient(1.5px_1.5px_at_12%_18%,#f5c45a,transparent),radial-gradient(1px_1px_at_27%_62%,#fff2cf,transparent),radial-gradient(1.5px_1.5px_at_44%_33%,#e3ad3c,transparent),radial-gradient(1px_1px_at_61%_78%,#f5c45a,transparent),radial-gradient(2px_2px_at_73%_22%,#f7d17a,transparent),radial-gradient(1px_1px_at_86%_55%,#fff2cf,transparent),radial-gradient(1.5px_1.5px_at_93%_8%,#e3ad3c,transparent)] [background-size:520px_520px]" />
          {/* stage floor glow */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(60%_60%_at_50%_100%,rgba(227,173,60,.22),transparent_70%)]" />
        </>
      )}
      {/* cinematic grade + vignette */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,9,8,.55)_0%,rgba(10,9,8,.15)_35%,rgba(10,9,8,.55)_75%,#0a0908_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_40%,transparent_55%,rgba(0,0,0,.65)_100%)]" />
      <div className="grain absolute inset-0" />
    </div>
  );
}

/** The koru from the approved logo, used as a decorative watermark. */
export function KoruMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/koru.png" alt="" aria-hidden className={cn("pointer-events-none select-none", className)} />;
}
