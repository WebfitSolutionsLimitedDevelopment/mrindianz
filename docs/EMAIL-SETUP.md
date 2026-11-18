# Email (Resend) — enquiries, applications and acknowledgements

What the site sends once configured:

| Trigger | To | Contains |
|---|---|---|
| Contact form (any enquiry type, incl. sponsorship/partnership) | Organiser inbox(es) | Type, name, email, subject, full message. **Reply goes straight to the sender.** |
| Contact form | The sender | Acknowledgement |
| New application | Organiser inbox(es) | Reference only (privacy) + link to /admin/applications |
| New application | Applicant | Acknowledgement with reference |
| Admin → application → Send email | Applicant | Audition / offer / rejection templates |

Until configured, every email is recorded in Admin → Email as `not_configured` and nothing is sent; enquiries and applications are still saved and visible in the admin.

## Setup (about 15 minutes)

1. Create an account at resend.com → **Domains → Add domain** → `mrindianz.co.nz`.
2. Resend shows 3–4 DNS records (a DKIM `TXT` like `resend._domainkey`, and an `MX` + `TXT` (SPF) on a `send` sub-domain). Add each one in **myHost → DNS Manager → Add a new DNS record** exactly as shown (Host Name = the part before `.mrindianz.co.nz`). Click **Verify** in Resend; it usually turns green within minutes.
3. Recommended: also add a DMARC record — Host `_dmarc`, Type `TXT`, Value `v=DMARC1; p=none;`.
4. Resend → **API Keys → Create** (permission: Sending access, domain: mrindianz.co.nz). Copy it once.
5. Vercel → mrindianz → Settings → Environment Variables (tick **Production** and **Preview**):
   - `RESEND_API_KEY` = the key (type **Sensitive**)
   - `EMAIL_FROM` = `Mr. IndiaNZ <noreply@mrindianz.co.nz>`
   - `ADMIN_NOTIFICATION_EMAIL` = the inbox that should receive enquiries/applications (several allowed, comma separated)
   - `EMAIL_REPLY_TO` (optional) = where applicants' replies to acknowledgements should go (defaults to the first admin address)
6. Redeploy (Deployments → latest Production → ⋯ → Redeploy).
7. Test: submit the contact form on the live site → check the inbox and Admin → Email (status `sent`).

Note: the organiser inbox itself (e.g. a Gmail or Outlook address) does not need to be on the mrindianz.co.nz domain.
