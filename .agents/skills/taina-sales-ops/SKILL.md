---
name: taina-sales-ops
description: Use for TAINA lead generation, qualification, CRM stages, outreach, sales scripts, follow-up, n8n automation, Telegram alerts, payment flow, and customer onboarding.
---

# TAINA Sales Operations

Design a low-maintenance, privacy-aware sales process that one founder can operate alongside a full-time job.

## Default funnel
Traffic/referral → landing page → manual VK message → qualification → consultation booking → payment confirmation → consultation → written summary → feedback.

## CRM minimum fields
created_at, name, role, company, segment, contact, use_case, consent, source, stage, next_action, follow_up_at, started_at, activated_at, feedback, payment_status, redacted_notes.

## Stages
new → qualified → consultation_offered → booked → paid → completed → feedback_due / not_fit / paused.

## Workflow
1. Read current CRM, n8n workflows, webhook documentation, and form implementation before changing anything.
2. Preserve existing records and workflows. Never replace a working CRM or webhook without a backup and migration plan.
3. Deduplicate leads by normalized contact; retain original source and timestamps.
4. Validate consent and required fields before sending notifications or storing data.
5. Current intake is manual: the landing-page CTA opens the TAINA Studio VK community. Do not assume a form, CRM, webhook, n8n flow, spreadsheet, or Telegram alert is connected. Keep intake manual until the data-processing design and applicable legal requirements are verified. Enable a form only after explicit approval and end-to-end testing.
6. Keep secrets in credential stores/environment variables, never in frontend code, Git, logs, or URLs exposed to users.
7. Automate acknowledgement, owner notification, next-action reminders, and a weekly digest. Do not send marketing campaigns without appropriate consent.
8. Payment and access delivery require a verified provider, approved terms, test transaction, refund/cancellation path, and a defined delivery method.
9. Test every automation with synthetic data and failure cases before enabling it.

## Operating principles
- One notification should contain the next action, not just announce activity.
- Human review stays in the loop for qualification, pricing exceptions, and sensitive cases.
- Minimize personal data. Avoid collecting confidential or special-category information.
- Never claim a webhook, CRM, payment, or bot is connected until an end-to-end test confirms it.
