/**
 * Default website content and settings.
 *
 * Source of truth: "Mr. IndiaNZ 2027 — Website Development Designer Handover" (15 Nov 2026).
 * Anything marked `approved: false` / `approvalStatus: "pending_approval"` is proposed or draft
 * content from the brief and must be approved by the organiser (and legal, where noted)
 * before launch. These defaults are seeded into the CMS by `scripts/generate-content-sql.ts`
 * and are used as a fallback only if the database is unreachable.
 */

export type ApprovalStatus = "approved" | "pending_approval";

export interface EventSettings {
  name: string;
  shortDescription: string;
  tagline: string;
  taglineApproved: boolean;
  finaleDate: string; // ISO date (NZ local)
  finaleDisplay: string;
  venueName: string;
  venueAddress: string;
  venueShort: string;
  rehearsalStart: string;
  rehearsalEnd: string;
  rehearsalDisplay: string;
  organiser: string;
  applicationFeeDisplay: string;
  contestantFeeCents: number;
  contestantFeeCurrency: "NZD";
  /** GST treatment, due date, coverage and refund terms — not yet confirmed by organiser. */
  contestantFeeTermsApproved: boolean;
  countdownEnabled: boolean;
  timezone: "Pacific/Auckland";
}

export interface RegistrationSettings {
  /** Opening/closing are proposed targets from the brief. ISO timestamps with NZ offset. */
  opensAt: string;
  closesAt: string;
  datesApproved: boolean;
  /** Proposed: 18 on Grand Finale day. Only enforced once approved. */
  minimumAge: number;
  ageReferenceDate: string;
  agePolicyApproved: boolean;
  eligibilityApproved: boolean;
}

export interface Milestone {
  date: string;
  label: string;
  confirmed: boolean;
}

export interface ContactSettings {
  email: string | null;
  phone: string | null;
  socials: { instagram?: string; facebook?: string; tiktok?: string; youtube?: string };
}

export interface TicketSettings {
  url: string | null;
  note: string;
}

export interface LegalSettings {
  versions: {
    privacy: string;
    websiteTerms: string;
    contestantTerms: string;
    votingRules: string;
  };
  approved: {
    privacy: boolean;
    websiteTerms: boolean;
    contestantTerms: boolean;
    votingRules: boolean;
  };
}

export interface MediaItem { src: string; caption: string; alt: string }

/**
 * Photography. Mr. IndiaNZ has no approved photography yet, so every image slot is empty and the
 * site uses its designed stage backdrop. Add ONLY real, approved photographs of Mr. IndiaNZ (no
 * AI-generated or stock people) in Admin → Settings → Photography.
 */
export interface MediaSettings {
  heroImage: string | null;
  heroVideo: string | null;
  ctaImage: string | null;
  legacy: MediaItem[];
}

export interface SiteSettings {
  event: EventSettings;
  registration: RegistrationSettings;
  milestones: Milestone[];
  contact: ContactSettings;
  tickets: TicketSettings;
  legal: LegalSettings;
  announcement: { enabled: boolean; text: string; href: string | null };
  media: MediaSettings;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  event: {
    name: "Mr. IndiaNZ 2027",
    shortDescription:
      "The inaugural male pageant celebrating Kiwi-Indian style, culture, confidence, heritage and individuality.",
    tagline: "Celebrating Kiwi-Indian Style, Culture and Charisma",
    taglineApproved: false,
    finaleDate: "2027-04-03",
    finaleDisplay: "Saturday 3 April 2027",
    venueName: "The Cloud",
    venueAddress: "Queens Wharf, 89 Quay Street, Auckland, New Zealand",
    venueShort: "The Cloud, Auckland",
    rehearsalStart: "2027-03-20",
    rehearsalEnd: "2027-03-21",
    rehearsalDisplay: "Saturday 20 and Sunday 21 March 2027",
    organiser: "Rhythm House Events & Films",
    applicationFeeDisplay: "Free",
    contestantFeeCents: 35000,
    contestantFeeCurrency: "NZD",
    contestantFeeTermsApproved: false,
    countdownEnabled: true,
    timezone: "Pacific/Auckland",
  },
  registration: {
    opensAt: "2026-12-15T00:00:00+13:00",
    closesAt: "2027-01-31T23:59:59+13:00",
    datesApproved: false,
    minimumAge: 18,
    ageReferenceDate: "2027-04-03",
    agePolicyApproved: false,
    eligibilityApproved: false,
  },
  milestones: [
    { date: "2026-12-15", label: "Public registration opens (target)", confirmed: false },
    { date: "2027-01-31", label: "Applications close (suggested)", confirmed: false },
    { date: "2027-02-06", label: "Auditions / screening weekend, 6–7 February (suggested)", confirmed: false },
    { date: "2027-02-12", label: "Finalist selection and offers (suggested)", confirmed: false },
    { date: "2027-03-20", label: "Compulsory rehearsal weekend, 20–21 March", confirmed: true },
    { date: "2027-04-03", label: "Grand Finale — The Cloud, Auckland", confirmed: true },
  ],
  contact: { email: null, phone: null, socials: {} },
  tickets: {
    url: null,
    note: "Ticketing partner to be confirmed. Ticket details will be published here.",
  },
  legal: {
    versions: {
      privacy: "draft-2026-11-18",
      websiteTerms: "draft-2026-11-18",
      contestantTerms: "draft-2026-11-18",
      votingRules: "draft-2026-11",
    },
    approved: { privacy: false, websiteTerms: false, contestantTerms: false, votingRules: false },
  },
  announcement: { enabled: false, text: "", href: null },
  media: {
    heroImage: null,
    heroVideo: null,
    ctaImage: null,
    legacy: [],
  },
};

export interface SectionContent {
  title: string;
  body: string; // plain text, paragraphs separated by blank lines
  items?: { title: string; body: string }[];
}

export interface SectionDefault {
  page: string;
  key: string;
  sortOrder: number;
  approvalStatus: ApprovalStatus;
  content: SectionContent;
}

export const FEE_DISCLOSURE =
  "Applying for Mr. IndiaNZ 2027 is free. If you are selected as an official contestant and accept the invitation, a NZD $350 contestant participation fee will apply. No payment is required when submitting this application. Full payment, withdrawal and refund terms will be provided before acceptance.";

export const STORY_GUIDANCE =
  "We want to hear from you in your own words. Prior modelling or stage experience is not necessary. Focus on your motivation, individuality, cultural connections and what you hope to contribute.";

export const PHOTO_GUIDANCE =
  "Natural lighting, recent images, no heavy filters. Professional photography is not required — applications are not assessed on the quality or cost of photography.";

export const PAGES: { slug: string; title: string; metaDescription: string }[] = [
  { slug: "home", title: "Mr. IndiaNZ 2027", metaDescription: "The inaugural Mr. IndiaNZ pageant — Saturday 3 April 2027 at The Cloud, Auckland. Apply free online." },
  { slug: "about", title: "About Mr. IndiaNZ", metaDescription: "A new national platform celebrating the confidence, character, cultural heritage and individuality of Kiwi-Indian men." },
  { slug: "competition", title: "The Competition", metaDescription: "Rounds, eligibility, auditions, judging, rehearsals, contestant fee and awards for Mr. IndiaNZ 2027." },
];

export const SECTION_DEFAULTS: SectionDefault[] = [
  {
    page: "home",
    key: "about",
    sortOrder: 10,
    approvalStatus: "pending_approval",
    content: {
      title: "About Mr. IndiaNZ",
      body: "Mr. IndiaNZ is a new national platform celebrating the confidence, character, cultural heritage and individuality of Kiwi-Indian men. Building on the experience of the teams behind Miss IndiaNZ and Miss India South Pacific, the competition brings together Indian cultural expression, contemporary fashion, personality, talent and stage presentation.",
    },
  },
  {
    page: "home",
    key: "pillars",
    sortOrder: 20,
    approvalStatus: "pending_approval",
    content: {
      title: "Three pillars",
      body: "",
      items: [
        { title: "Culture and Heritage", body: "Regional identity, tradition and the stories that shape who you are." },
        { title: "Fashion and Personal Style", body: "Traditional, contemporary and Indo-Western menswear, worn your way." },
        { title: "Confidence and Charisma", body: "Communication, authenticity and presence on stage and off." },
      ],
    },
  },
  {
    page: "home",
    key: "why_enter",
    sortOrder: 30,
    approvalStatus: "pending_approval",
    content: {
      title: "Why enter?",
      body: "Discover your potential, celebrate your identity and take part in a professional stage experience. No prior modelling or pageant experience is required. We welcome applicants with diverse stories, interests and aspirations who are ready to represent Kiwi-Indian identity with confidence.",
    },
  },
  {
    page: "home",
    key: "journey",
    sortOrder: 40,
    approvalStatus: "pending_approval",
    content: {
      title: "Your journey",
      body: "Apply free online. Shortlisted entrants are invited to an audition. Successful applicants receive an official contestant offer and onboarding information. A NZD $350 participation fee is payable only after selection and acceptance. Finalists take part in preparation, workshops and the compulsory rehearsal weekend before the Grand Finale.",
      items: [
        { title: "Apply free online", body: "Complete the four-step application. No payment is required." },
        { title: "Audition", body: "Shortlisted entrants are invited to an audition." },
        { title: "Selection offer", body: "Successful applicants receive an official contestant offer and onboarding information." },
        { title: "Accept and confirm", body: "A NZD $350 participation fee is payable only after selection and acceptance." },
        { title: "Prepare", body: "Preparation, workshops and the compulsory rehearsal weekend." },
        { title: "Grand Finale", body: "Take the stage at The Cloud, Auckland." },
      ],
    },
  },
  {
    page: "home",
    key: "peoples_choice",
    sortOrder: 50,
    approvalStatus: "pending_approval",
    content: {
      title: "People's Choice",
      body: "Supporters will be able to back their favourite finalist through the People's Choice Award once finalists are announced. The People's Choice Award is separate from the main Mr. IndiaNZ title.",
    },
  },
  {
    page: "home",
    key: "organiser",
    sortOrder: 60,
    approvalStatus: "pending_approval",
    content: {
      title: "Presented by Rhythm House Events & Films",
      body: "Mr. IndiaNZ is produced by Rhythm House Events & Films, building on the experience of the teams behind Miss IndiaNZ and Miss India South Pacific.",
    },
  },
  {
    page: "about",
    key: "purpose",
    sortOrder: 10,
    approvalStatus: "pending_approval",
    content: {
      title: "Our purpose",
      body: "Mr. IndiaNZ is a new national platform celebrating the confidence, character, cultural heritage and individuality of Kiwi-Indian men. Building on the experience of the teams behind Miss IndiaNZ and Miss India South Pacific, the competition brings together Indian cultural expression, contemporary fashion, personality, talent and stage presentation.",
    },
  },
  {
    page: "about",
    key: "identity",
    sortOrder: 20,
    approvalStatus: "pending_approval",
    content: {
      title: "Kiwi-Indian identity",
      body: "Mr. IndiaNZ celebrates what it means to be Kiwi-Indian: the heritage carried from many regions of India and the wider diaspora, and the individuality, confidence and character of men who call Aotearoa New Zealand home.\n\nWe welcome applicants with diverse stories, interests and aspirations who are ready to represent Kiwi-Indian identity with confidence.",
    },
  },
  {
    page: "about",
    key: "legacy",
    sortOrder: 30,
    approvalStatus: "pending_approval",
    content: {
      title: "A legacy of Kiwi-Indian pageantry",
      body: "Mr. IndiaNZ builds on the experience of the teams behind Miss IndiaNZ and Miss India South Pacific, while establishing itself as its own credible, premium Kiwi-Indian competition.",
    },
  },
  {
    page: "about",
    key: "inaugural",
    sortOrder: 40,
    approvalStatus: "pending_approval",
    content: {
      title: "The inaugural competition",
      body: "The first Mr. IndiaNZ Grand Finale takes place on Saturday 3 April 2027 at The Cloud, Queens Wharf, Auckland. Selected contestants take part in preparation, workshops and a compulsory rehearsal weekend on 20–21 March 2027.",
    },
  },
  {
    page: "competition",
    key: "rounds",
    sortOrder: 10,
    approvalStatus: "pending_approval",
    content: {
      title: "Competition rounds",
      body: "The competition format is consistent with existing Miss IndiaNZ and Miss India South Pacific events.",
      items: [
        { title: "Round 1: Made in India", body: "Traditional Indian menswear and a short contestant introduction. Showcase regional identity and cultural expression." },
        { title: "Round 2: Kiwi Guy", body: "Modern, contemporary or Indo-Western menswear and runway presentation. Focus on individuality, style and confidence." },
        { title: "Round 3: Desi Gentleman", body: "Formal or Indian eveningwear and on-stage Q&A. Assessing communication, authenticity and presence." },
        { title: "Optional: Mr. Talent", body: "By audition only. A separate award that is not part of the main title score." },
        { title: "Finale", body: "Special awards, runners-up and the crowning of Mr. IndiaNZ 2027." },
      ],
    },
  },
  {
    page: "competition",
    key: "eligibility",
    sortOrder: 20,
    approvalStatus: "pending_approval",
    content: {
      title: "Eligibility (draft — pending organiser and legal approval)",
      body: "Final eligibility definitions will be confirmed before applications open.",
      items: [
        { title: "Who can apply", body: "Open to men of Indian origin or heritage living in New Zealand, including members of the wider Indian diaspora. Exact legal eligibility definitions are to be approved." },
        { title: "Age", body: "Proposed minimum age: 18 on Grand Finale day (3 April 2027). Final age policy to be confirmed." },
        { title: "Experience", body: "No prior pageant or modelling experience is necessary. There is no minimum height or physique requirement." },
        { title: "Availability", body: "Available for official obligations, including the 20–21 March 2027 rehearsal weekend and the 3 April 2027 Grand Finale." },
        { title: "Rules", body: "Participation is subject to acceptance of the official rules and contestant agreement." },
      ],
    },
  },
  {
    page: "competition",
    key: "auditions",
    sortOrder: 30,
    approvalStatus: "pending_approval",
    content: {
      title: "Auditions",
      body: "Shortlisted applicants are invited to an audition. The suggested audition and screening weekend is 6–7 February 2027, with finalist selection and offers targeted for 12 February 2027. Mr. Talent is assessed through audition.",
    },
  },
  {
    page: "competition",
    key: "judging",
    sortOrder: 40,
    approvalStatus: "pending_approval",
    content: {
      title: "Judging principles",
      body: "Each round focuses on a different quality: cultural expression in Made in India, individuality, style and confidence in Kiwi Guy, and communication, authenticity and presence in Desi Gentleman. Applications are not assessed on the quality or cost of professional photography.\n\nDetailed judging criteria will be published once approved by the organiser.",
    },
  },
  {
    page: "competition",
    key: "rehearsals",
    sortOrder: 50,
    approvalStatus: "approved",
    content: {
      title: "Compulsory rehearsals",
      body: "The rehearsal weekend is Saturday 20 and Sunday 21 March 2027 (the weekend before Easter). Attendance is compulsory for selected contestants. No compulsory rehearsal is planned over Easter weekend.",
    },
  },
  {
    page: "competition",
    key: "fee",
    sortOrder: 60,
    approvalStatus: "approved",
    content: { title: "Contestant fee", body: FEE_DISCLOSURE },
  },
  {
    page: "competition",
    key: "awards",
    sortOrder: 70,
    approvalStatus: "pending_approval",
    content: {
      title: "Awards",
      body: "The Grand Finale includes special awards, runners-up and the crowning of Mr. IndiaNZ 2027. The Mr. Talent award and the People's Choice Award are separate from the main title.",
    },
  },
  {
    page: "competition",
    key: "process",
    sortOrder: 80,
    approvalStatus: "pending_approval",
    content: {
      title: "Application process",
      body: "Check eligibility and key dates → complete the free application → receive an acknowledgement → shortlisted applicants are invited to audition → selection offer → accept conditions → pay the NZD $350 fee by secure link → receive onboarding information and the rehearsal schedule → participate.",
    },
  },
];

export interface FaqDefault {
  question: string;
  answer: string;
  category: string;
  approvalStatus: ApprovalStatus;
}

export const FAQ_DEFAULTS: FaqDefault[] = [
  { category: "applying", approvalStatus: "approved", question: "Does it cost anything to apply?", answer: "No. Online applications are free. The $350 contestant fee is charged only if you are selected and accept an official place." },
  { category: "applying", approvalStatus: "approved", question: "Do I need modelling experience?", answer: "No. The competition welcomes first-time applicants." },
  { category: "applying", approvalStatus: "pending_approval", question: "Who is eligible?", answer: "The proposed eligibility is men of Indian origin or heritage living in New Zealand, including members of the wider Indian diaspora, aged 18 or over on Grand Finale day. Final eligibility definitions are being confirmed and will be published before applications open." },
  { category: "competition", approvalStatus: "approved", question: "When is rehearsal?", answer: "Saturday 20 and Sunday 21 March 2027. Attendance is compulsory for selected contestants." },
  { category: "competition", approvalStatus: "pending_approval", question: "What are the competition rounds?", answer: "Round 1: Made in India (traditional Indian menswear and a short introduction), Round 2: Kiwi Guy (modern, contemporary or Indo-Western menswear and runway), and Round 3: Desi Gentleman (formal or Indian eveningwear and on-stage Q&A)." },
  { category: "competition", approvalStatus: "approved", question: "Will I need outfits?", answer: "Contestants will receive detailed wardrobe guidance after selection. Anticipate traditional Indian, contemporary and formal menswear." },
  { category: "competition", approvalStatus: "approved", question: "Is the talent round mandatory?", answer: "No. The optional Mr. Talent award is assessed separately from the main title." },
  { category: "fees", approvalStatus: "approved", question: "When do I pay $350?", answer: "After official selection and acceptance, according to the published contestant agreement. Payment methods and refund terms will be supplied before acceptance." },
  { category: "applying", approvalStatus: "pending_approval", question: "How are contestants selected?", answer: "Applications are reviewed and shortlisted applicants are invited to an audition. Successful applicants then receive an official contestant offer. Suggested dates: auditions 6–7 February 2027 and finalist offers by 12 February 2027." },
  { category: "voting", approvalStatus: "pending_approval", question: "What is the People's Choice Award?", answer: "Supporters can back their favourite finalist by purchasing votes once People's Choice voting opens. The People's Choice Award is separate from the main Mr. IndiaNZ title." },
  { category: "voting", approvalStatus: "pending_approval", question: "How do voting packages work?", answer: "Each package provides a fixed number of votes for a fixed price, shown before you pay. Votes are credited only after your payment is verified. Final package prices are yet to be approved." },
  { category: "voting", approvalStatus: "pending_approval", question: "Is payment secure?", answer: "Payments will be processed by Stripe on a secure hosted checkout page. Card details are never entered on or stored by this website." },
  { category: "voting", approvalStatus: "pending_approval", question: "Can I get a refund on votes?", answer: "Refund terms for People's Choice votes are being finalised and will be published in the voting rules before voting opens. Refunded or disputed payments have their votes removed from the leaderboard." },
];

export const CANONICAL_REGIONS = [
  "Northland",
  "Auckland",
  "Waikato",
  "Bay of Plenty",
  "Gisborne",
  "Hawke's Bay",
  "Taranaki",
  "Manawatū-Whanganui",
  "Wellington",
  "Tasman",
  "Nelson",
  "Marlborough",
  "West Coast",
  "Canterbury",
  "Otago",
  "Southland",
  "Other",
] as const;
