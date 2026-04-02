# Canva Integration Submission — Questionnaire Answers
# Ticket: APPS-38331
# Integration ID: OC-AZyXCQ9tzUut | Client ID: OC-AZyXCQ9tzUut

---

## Developer Overview

**Company or developer name:** ONEST Health Pty Ltd

**Technical contact details:** ryan@onesthealth.com

**User contact details:** ryan@onesthealth.com

**Terms of Service URL:** https://www.performcreative.io/terms

**Privacy Policy URL:** https://www.performcreative.io/privacy

---

## Integration Overview

**Integration overview (~100 words):**
Perform Creative is an AI-powered ad creative platform for direct-to-consumer brands. It analyses competitor ads, generates static ad briefs, and produces AI-generated image variations using product photography and brand guidelines. Once creatives are approved internally, they are uploaded to the connected user's Canva account as editable designs — enabling the brand team to fine-tune copy, adjust layouts, and export final assets for paid media campaigns. The integration is designed for marketing teams that want AI to handle ideation and generation, while keeping final creative control in Canva.

**Integration functionality:**
1. User connects their Canva account via OAuth (PKCE flow)
2. Platform generates AI ad variations from competitor analysis and product briefs
3. Approved images are uploaded to the user's Canva account as assets (asset:write)
4. A Canva design is created from the uploaded asset at the correct ad dimensions (design:content:write)
5. User receives an edit link to open the design directly in Canva
6. Optionally: brand template autofill flow populates a pre-built Canva template with AI-generated headlines, benefits, CTA, and product/background images
7. When the user exports the final design from Canva, a webhook event (design:export:completed) is sent to our endpoint and the exported asset is stored back in the platform

**Integration testing:**
Step 1: Visit https://www.performcreative.io and log in with the test account:
- Username: support@canva.com
- Password: support@canva.com

Step 2: Go to Settings → click "Connect Canva" → complete the OAuth flow using a Canva test account

Step 3: Navigate to the Iterate Winners page → open any existing completed pipeline run

Step 4: On a generated variation, click "Upload to Canva" — this uploads the image and creates a Canva design in your connected account

Step 5: Click "Edit in Canva" to verify the design opens correctly in Canva's editor

---

## Scope Rationale

| Scope | Rationale |
|---|---|
| asset:write | Upload AI-generated ad images to the user's Canva account as assets |
| asset:read | Poll the asset upload job status until the upload completes |
| design:content:write | Create a Canva design from the uploaded asset at specified dimensions |
| brandtemplate:content:read | Read brand template field definitions to populate autofill jobs |
| brandtemplate:meta:read | Access brand template metadata required for the autofill API |
| profile:read | Verify the connected user identity after OAuth token exchange |
| All others | n/a |

---

## Security Practices

**Data retention policy:**
Canva OAuth tokens are stored in our database and used solely to perform design operations on behalf of the user. Tokens are retained until the user disconnects Canva via the Settings page or requests account deletion.

**Data archival/removal policy:**
When a user disconnects Canva, their access token, refresh token, and expiry are immediately cleared from the database. Full account deletion removes all associated data within 30 days.

**Data storage policy:**
Canva tokens are stored encrypted in a managed MySQL database hosted on DigitalOcean (Sydney region). No Canva data is stored beyond OAuth tokens.

**How is your data hosted?**
Cloud (DigitalOcean App Platform + DigitalOcean Managed MySQL)

**Date of last pen test:** (leave blank)

**How can users contact you with security issues?**
ryan@onesthealth.com — or via the vulnerability disclosure page at https://www.performcreative.io/security

**Normal traffic levels:**
< 10 requests/second average, < 50 requests/second peak

**Does your integration respect Canva APIs and developers terms?** → Yes

**OWASP top 10 reviewed?** → Yes

**Revokes OAuth tokens within 30 days of disconnect?** → Yes

**Encryption at rest for client secrets?** → Yes (secrets stored in environment variables on DigitalOcean, not in the database)

**SSO?** → No

**SAML?** → No

**Dedicated security team?** → No

**Vulnerability disclosure / bug bounty?** → Yes — https://www.performcreative.io/security

**Third-party connections required?** → Yes (DigitalOcean for hosting/database, Canva API)

**Do you own the redirect/webhook domain?** → Yes (performcreative.io)

**Verify webhook signatures?** → Yes (HMAC-SHA256 via x-canva-signature header, endpoint: POST /api/canva/webhook)
