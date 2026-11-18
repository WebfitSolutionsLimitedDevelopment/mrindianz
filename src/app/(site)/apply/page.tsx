import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { ApplyForm } from "@/components/forms/apply-form";
import { getSettings } from "@/lib/content/repo";
import { getRegistrationState } from "@/lib/registration";
import { FEE_DISCLOSURE, PHOTO_GUIDANCE, STORY_GUIDANCE } from "@/lib/content/defaults";
import { formatNzDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Apply",
  description: "Apply free online for Mr. IndiaNZ 2027. Four short steps: your details, your story, photos and consent.",
  alternates: { canonical: "/apply" },
};

export default async function ApplyPage() {
  const [settings, reg] = await Promise.all([getSettings(), getRegistrationState()]);
  const { event, registration } = settings;

  return (
    <>
      <Section tone="dark" className="border-b border-line pb-10 sm:pb-12">
        <SectionHeading as="h1" eyebrow="Free application" title="Apply for Mr. IndiaNZ 2027"
          intro={<>Applying is free. No prior modelling or pageant experience is required. The form has four short steps.</>} />
        {reg.state === "open" && (
          <p className="text-sm text-mist">Applications close {formatNzDateTime(reg.closesAt)} (NZ time){!registration.datesApproved && " — proposed date, subject to confirmation"}.</p>
        )}
        {reg.state === "open" && reg.stagingOverride && (
          <p className="mt-4 border border-gold p-3 text-sm text-gold" role="note">
            Test environment: registration is open for testing even though eligibility, age policy or legal terms are still pending approval.
          </p>
        )}
      </Section>
      <Section tone="dark" className="pt-10 sm:pt-12">
        <div className="mx-auto max-w-4xl">
          {reg.state === "open" ? (
            <ApplyForm
              policy={{ minimumAge: registration.minimumAge, referenceDate: registration.ageReferenceDate, approved: registration.agePolicyApproved }}
              feeDisclosure={FEE_DISCLOSURE}
              storyGuidance={STORY_GUIDANCE}
              photoGuidance={PHOTO_GUIDANCE}
              rehearsalDisplay={event.rehearsalDisplay}
              finaleDisplay={event.finaleDisplay}
            />
          ) : reg.state === "closed" ? (
            <EmptyState title="Applications have closed" action={<ButtonLink href="/contestants" variant="secondary">Meet the contestants</ButtonLink>}>
              Thank you for your interest in Mr. IndiaNZ 2027.
            </EmptyState>
          ) : (
            <EmptyState title="Applications open soon" action={<ButtonLink href="/competition" variant="secondary">Read about the competition</ButtonLink>}>
              {reg.state === "not_yet_open"
                ? <>Applications are planned to open {formatNzDateTime(reg.opensAt, { hour: undefined, minute: undefined })}.</>
                : <>Applications will open once the official rules are confirmed. The proposed opening date is 15 December 2026.</>}
              <span className="mt-3 block">{FEE_DISCLOSURE}</span>
            </EmptyState>
          )}
        </div>
      </Section>
    </>
  );
}
