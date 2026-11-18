"use client";
import { useMemo, useSyncExternalStore } from "react";

interface Receipt { reference: string; email: string; emailStatus: string }

const KEY = "minz-apply-receipt";
const subscribe = () => () => {};

export function ApplicationReceipt({ reference }: { reference: string }) {
  const raw = useSyncExternalStore(subscribe, () => {
    try { return sessionStorage.getItem(KEY); } catch { return null; }
  }, () => null);
  const receipt = useMemo<Receipt | null>(() => {
    try {
      const r = JSON.parse(raw ?? "null") as Receipt | null;
      return r && r.reference === reference ? r : null;
    } catch { return null; }
  }, [raw, reference]);

  const sent = receipt?.emailStatus === "sent" || receipt?.emailStatus === "already_sent";
  return (
    <div className="space-y-4 text-lg leading-relaxed text-espresso/90">
      <p>Thank you for applying to Mr. IndiaNZ 2027. Your application has been received.</p>
      {sent && receipt ? (
        <p>A confirmation email has been sent to <strong className="break-all text-espresso">{receipt.email}</strong>. Please check your inbox and spam folder.</p>
      ) : (
        <p className="text-stone">Please keep your application reference below. We were not able to confirm that an acknowledgement email was sent.</p>
      )}
      <p>Our team will contact shortlisted applicants regarding auditions.</p>
    </div>
  );
}
