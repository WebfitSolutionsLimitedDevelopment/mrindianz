/**
 * Default transactional email templates. Stored in public.email_templates and editable in /admin/email.
 * Placeholders use {{name}} syntax and are HTML-escaped when rendered.
 * Never include uploaded photos, DOB or private story answers in emails.
 */
export interface EmailTemplateDefault {
  key: string;
  name: string;
  subject: string;
  body: string;
  description: string;
}

export const EMAIL_TEMPLATE_DEFAULTS: EmailTemplateDefault[] = [
  {
    key: "application_received",
    name: "Application received",
    description: "Sent to the applicant after a successful submission.",
    subject: "Your Mr. IndiaNZ 2027 application has been received ({{reference}})",
    body: "Kia ora {{first_name}},\n\nThank you for applying to Mr. IndiaNZ 2027. Your application has been received.\n\nYour application reference is {{reference}}.\n\nOur team will contact shortlisted applicants regarding auditions. Please check your inbox and spam folder.\n\nApplying is free. If you are selected as an official contestant and accept the invitation, a NZD $350 contestant participation fee will apply. Full payment, withdrawal and refund terms will be provided before acceptance.\n\nNgā mihi,\nThe Mr. IndiaNZ team",
  },
  {
    key: "application_shortlisted",
    name: "Application shortlisted",
    description: "Optional notification when an application is shortlisted.",
    subject: "Mr. IndiaNZ 2027 — you have been shortlisted",
    body: "Kia ora {{first_name}},\n\nCongratulations — your application ({{reference}}) has been shortlisted for Mr. IndiaNZ 2027.\n\nWe will be in touch shortly with audition details.\n\nNgā mihi,\nThe Mr. IndiaNZ team",
  },
  {
    key: "audition_invitation",
    name: "Audition invitation",
    description: "Invitation to the audition/screening weekend. Edit date, time and venue before sending.",
    subject: "Mr. IndiaNZ 2027 — audition invitation",
    body: "Kia ora {{first_name}},\n\nWe are delighted to invite you to audition for Mr. IndiaNZ 2027.\n\nDate and time: {{audition_details}}\n\nPlease reply to confirm your attendance. If you applied for Mr. Talent, please be prepared to present your talent.\n\nNgā mihi,\nThe Mr. IndiaNZ team",
  },
  {
    key: "selection_offer",
    name: "Selection offer",
    description: "Official contestant offer. Must link to the approved contestant agreement.",
    subject: "Mr. IndiaNZ 2027 — official contestant offer",
    body: "Kia ora {{first_name}},\n\nCongratulations! We are pleased to offer you an official place as a contestant in Mr. IndiaNZ 2027.\n\nPlease review the contestant agreement, including payment, withdrawal and refund terms, before accepting: {{site_url}}/contestant-terms\n\nThe NZD $350 contestant participation fee is payable only after you accept this offer.\n\n{{offer_details}}\n\nNgā mihi,\nThe Mr. IndiaNZ team",
  },
  {
    key: "application_unsuccessful",
    name: "Unsuccessful application",
    description: "Rejection template for unsuccessful applicants.",
    subject: "Your Mr. IndiaNZ 2027 application",
    body: "Kia ora {{first_name}},\n\nThank you for applying to Mr. IndiaNZ 2027 and for sharing your story with us.\n\nAfter careful consideration, we are unable to offer you a place in this year's competition. We received many strong applications and this decision was not easy.\n\nWe hope you will stay connected with Mr. IndiaNZ and consider applying again in future.\n\nNgā mihi,\nThe Mr. IndiaNZ team",
  },
  {
    key: "acceptance_confirmation",
    name: "Acceptance confirmation",
    description: "Confirms the applicant accepted the offer.",
    subject: "Mr. IndiaNZ 2027 — acceptance received",
    body: "Kia ora {{first_name}},\n\nThank you for accepting your place in Mr. IndiaNZ 2027. Fee payment instructions will follow separately.\n\nNgā mihi,\nThe Mr. IndiaNZ team",
  },
  {
    key: "contestant_fee_instructions",
    name: "Contestant fee instructions",
    description: "Secure payment link for the NZD $350 fee. Disabled until fee/GST/refund terms are approved.",
    subject: "Mr. IndiaNZ 2027 — contestant fee",
    body: "Kia ora {{first_name}},\n\nPlease pay your NZD $350 contestant participation fee using this secure link: {{payment_link}}\n\nPayment due: {{due_date}}\n\nNgā mihi,\nThe Mr. IndiaNZ team",
  },
  {
    key: "contestant_confirmation",
    name: "Contestant confirmation",
    description: "Sent once the contestant is confirmed.",
    subject: "Welcome to Mr. IndiaNZ 2027",
    body: "Kia ora {{first_name}},\n\nYour place in Mr. IndiaNZ 2027 is confirmed. Onboarding information and the rehearsal schedule will follow.\n\nCompulsory rehearsals: Saturday 20 and Sunday 21 March 2027.\nGrand Finale: Saturday 3 April 2027, The Cloud, Auckland.\n\nNgā mihi,\nThe Mr. IndiaNZ team",
  },
  {
    key: "voting_receipt",
    name: "Voting payment receipt",
    description: "Sent after a verified People's Choice payment.",
    subject: "Your People's Choice votes for {{contestant_name}} ({{order_ref}})",
    body: "Kia ora {{supporter_name}},\n\nThank you for supporting {{contestant_name}} in the Mr. IndiaNZ 2027 People's Choice Award.\n\nOrder reference: {{order_ref}}\nPackage: {{package_name}} × {{quantity}}\nVotes credited: {{votes}}\nAmount paid: {{amount}}\n\nThe People's Choice Award is separate from the main Mr. IndiaNZ title.\n\nNgā mihi,\nThe Mr. IndiaNZ team",
  },
  {
    key: "voting_payment_failed",
    name: "Failed payment",
    description: "Sent when a voting payment fails or expires.",
    subject: "Your People's Choice payment was not completed",
    body: "Kia ora {{supporter_name}},\n\nYour payment for order {{order_ref}} was not completed, so no votes were credited and you have not been charged.\n\nYou can try again at {{site_url}}/peoples-choice\n\nNgā mihi,\nThe Mr. IndiaNZ team",
  },
  {
    key: "refund_confirmation",
    name: "Refund confirmation",
    description: "Sent when a voting payment is refunded.",
    subject: "Refund processed for order {{order_ref}}",
    body: "Kia ora {{supporter_name}},\n\nA refund of {{amount}} has been processed for order {{order_ref}}. The associated votes have been removed from the leaderboard.\n\nNgā mihi,\nThe Mr. IndiaNZ team",
  },
  {
    key: "contact_acknowledgement",
    name: "Contact acknowledgement",
    description: "Sent after the contact form is submitted.",
    subject: "We have received your message",
    body: "Kia ora {{name}},\n\nThank you for contacting Mr. IndiaNZ. We have received your message about \"{{subject}}\" and will reply as soon as possible.\n\nNgā mihi,\nThe Mr. IndiaNZ team",
  },
  {
    key: "admin_contact_enquiry",
    name: "New enquiry (to organiser)",
    description: "Sent to the organiser inbox for every contact form enquiry. Reply directly to answer the sender.",
    subject: "[Mr. IndiaNZ enquiry] {{enquiry_type}}: {{subject}}",
    body: "New enquiry from the Mr. IndiaNZ website.\n\nType: {{enquiry_type}}\nName: {{name}}\nEmail: {{email}}\nSubject: {{subject}}\n\nMessage:\n{{message}}\n\nReply to this email to respond directly to {{name}}. All enquiries are also listed at {{site_url}}/admin/messages",
  },
  {
    key: "admin_notification",
    name: "Admin notification",
    description: "Internal notification. Contains no applicant personal details beyond a reference.",
    subject: "[Mr. IndiaNZ] {{event}}",
    body: "{{event}}\n\nReference: {{reference}}\n{{details}}\n\nFor privacy, applicant details are not included in this email. Sign in to review: {{site_url}}/admin/applications",
  },
];
