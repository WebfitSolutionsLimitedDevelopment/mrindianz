/**
 * DRAFT legal/policy text prepared for organiser and legal review. Not legal advice.
 * Items in [square brackets] must be confirmed by the organiser before publication.
 */
export interface LegalDoc {
  title: string;
  intro: string;
  sections: { heading: string; body: string }[];
}

export const PRIVACY: LegalDoc = {
  title: "Privacy statement",
  intro: "This statement explains how Rhythm House Events & Films (\"we\") collects, uses, stores and shares personal information through the Mr. IndiaNZ website, in line with the New Zealand Privacy Act 2020.",
  sections: [
    { heading: "Who we are", body: "Mr. IndiaNZ 2027 is organised by Rhythm House Events & Films. Contact for privacy matters: [privacy contact email to be confirmed]." },
    { heading: "What we collect from applicants", body: "When you apply we collect your name, preferred stage name, date of birth, email, mobile number, city and region, optional occupation and Instagram handle, your written answers, your photographs, an optional video link, your availability and your consent choices.\n\nWe collect this to assess your application, check eligibility, contact you about auditions and selection, and run the competition. Providing it is voluntary, but we cannot consider an application without the required information." },
    { heading: "Photographs", body: "Application photographs are stored privately and are only visible to authorised members of the selection team. They are not published. If you are selected, we will ask for your approval of the images and biography that appear on your public contestant profile." },
    { heading: "What we collect from People's Choice supporters", body: "When you purchase votes we collect your name, email, chosen contestant and package, and whether you want to appear as Anonymous. Payments are processed by Stripe; we never receive or store your full card details. Your email is never shown publicly." },
    { heading: "Contact form", body: "If you contact us we collect your name, email and message so we can respond." },
    { heading: "Who we share information with", body: "We use trusted service providers to operate the website: Supabase (database and file storage), Vercel (hosting), Stripe (payments) and Resend (email). They process information on our behalf. Some providers may store information outside New Zealand; we take reasonable steps to ensure it is protected. We do not sell personal information. We do not send applicant dates of birth, written answers or photographs to analytics or advertising providers." },
    { heading: "How long we keep it", body: "We keep application information for [retention period to be confirmed — e.g. 12 months after the Grand Finale] and then delete or anonymise it, unless you are selected as a contestant, in which case we keep it for the duration of your participation and as required by law. Financial records are kept as required by New Zealand tax law." },
    { heading: "Marketing", body: "We will only send you unrelated marketing, event news and announcements if you opt in. You can unsubscribe at any time." },
    { heading: "Your rights", body: "You can ask to access or correct your personal information, or ask us to delete your application, by contacting [privacy contact email to be confirmed]. If you are not satisfied with our response, you can complain to the Office of the Privacy Commissioner (privacy.org.nz)." },
    { heading: "Security", body: "We use encrypted connections, role-based access controls, private file storage and audit logging to protect your information." },
  ],
};

export const WEBSITE_TERMS: LegalDoc = {
  title: "Website terms",
  intro: "These terms apply to your use of www.mrindianz.co.nz.",
  sections: [
    { heading: "Use of the website", body: "You may use this website for lawful purposes. You must not attempt to interfere with the website, its security, or the People's Choice voting system." },
    { heading: "Content and intellectual property", body: "The Mr. IndiaNZ name, logo and website content belong to Rhythm House Events & Films or its licensors. You may not reproduce them without permission." },
    { heading: "Accuracy", body: "We aim to keep information accurate, but dates, policies and details may change. Information marked as proposed or draft is subject to confirmation." },
    { heading: "Links", body: "External links (including ticketing and partner websites) are provided for convenience. We are not responsible for third-party websites." },
    { heading: "Governing law", body: "These terms are governed by the laws of New Zealand." },
  ],
};

export const CONTESTANT_TERMS: LegalDoc = {
  title: "Contestant terms",
  intro: "This page summarises the key conditions of applying to and participating in Mr. IndiaNZ 2027. The full contestant agreement, including payment, withdrawal and refund terms, will be provided before any offer is accepted.",
  sections: [
    { heading: "Applying", body: "Applying is free. Submitting an application does not guarantee an audition or selection." },
    { heading: "Eligibility", body: "Proposed: open to men of Indian origin or heritage living in New Zealand, including members of the wider Indian diaspora, aged 18 or over on Grand Finale day (3 April 2027). Final eligibility definitions are subject to organiser and legal approval and will be published before applications open." },
    { heading: "Selection", body: "Shortlisted applicants are invited to an audition. Selection decisions are made by the organiser. Applications are not assessed on the quality or cost of professional photography." },
    { heading: "Contestant fee", body: "If you are selected as an official contestant and accept the invitation, a NZD $350 contestant participation fee will apply. No payment is required when submitting an application. [GST treatment, due date, what the fee covers, and the withdrawal/refund policy to be confirmed.]" },
    { heading: "Commitments", body: "Selected contestants must attend the compulsory rehearsal weekend on Saturday 20 and Sunday 21 March 2027 and the Grand Finale on Saturday 3 April 2027, along with other official obligations set out in the contestant agreement." },
    { heading: "Information and photographs", body: "You confirm that the information and photographs you submit are accurate and yours to submit. Application photographs are kept private. Public profile content is only published with your approval after selection." },
    { heading: "Conduct", body: "[Code of conduct to be confirmed in the contestant agreement.]" },
  ],
};

export const VOTING_RULES: LegalDoc = {
  title: "People's Choice voting rules",
  intro: "These rules govern paid People's Choice voting for Mr. IndiaNZ 2027. They are a draft pending organiser approval and will be finalised before voting opens.",
  sections: [
    { heading: "Separate award", body: "The People's Choice Award is separate from the main Mr. IndiaNZ title. People's Choice votes do not affect judging scores for the main title unless the organiser publishes different rules before voting opens." },
    { heading: "Voting period", body: "Voting is open only between the published start and end times (New Zealand time). Votes purchased outside the voting period are not accepted. The organiser may pause voting, for example to investigate suspected misuse." },
    { heading: "Packages and prices", body: "Votes are sold in packages with a fixed price and number of votes, shown in NZD before payment. [Final package prices, GST and any card processing fee are pending approval.] The price and vote count are always taken from our system, not from your browser." },
    { heading: "When votes count", body: "Votes are credited only after payment is verified by our payment provider. Pending, failed or cancelled payments do not count. Refunded or disputed payments have their votes removed." },
    { heading: "Multiple purchases", body: "Supporters may make more than one purchase and may support more than one contestant, subject to any limits published by the organiser." },
    { heading: "Public display", body: "The leaderboard shows verified net votes. You may choose to appear as Anonymous. Your email address and payment details are never shown publicly." },
    { heading: "Refunds", body: "[Refund policy to be confirmed.]" },
    { heading: "Integrity", body: "Attempts to manipulate voting, including fraudulent payments, automated purchases or interference with the website, are prohibited. The organiser may void affected votes. The organiser's decision on the final results is final, subject to these rules." },
    { heading: "Payments", body: "Payments are processed securely by Stripe. Card details are never entered on or stored by this website." },
  ],
};
