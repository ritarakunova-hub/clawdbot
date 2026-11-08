---
name: taina-sales-ops
description: Use for TAINA lead generation, qualification, CRM stages, outreach, sales scripts, follow-up, n8n automation, Telegram alerts, payment flow, and customer onboarding.
---

# TAINA Sales Operations

Design a low-maintenance, privacy-aware sales process that one founder can operate alongside a full-time job.

## Default funnel
Traffic/referral → landing page → application → qualification → guided pilot → activation → feedback → paid offer (only after release gate) → onboarding.

## CRM minimum fields
created_at, name, role, company, segment, contact, use_case, consent, source, stage, next_action, follow_up_at, started_at, activated_at, feedback, payment_status, redacted_notes.

## Stages
new → qualified → invited → started → activated → feedback_due → paid / not_fit / paused.

## Workflow
1. Read current CRM, n8n workflows, webhook documentation, and form implementation before changing anything.
2. Preserve existing records and workflows. Never replace a working CRM or webhook without a backup and migration plan.
3. Deduplicate leads by normalized contact; retain original source and timestamps.
4. Validate consent and required fields before sending notifications or storing data.
5. Use Netlify Forms as the initial intake, n8n for orchestration, Sheets as a lightweight interim CRM, and Telegram for actionable alerts only if these services are already connected and secure.
6. Keep secrets in credential stores/environment variables, never in frontend code, Git, logs, or URLs exposed to users.
7. Automate acknowledgement, owner notification, next-action reminders, and a weekly digest. Do not send marketing campaigns without appropriate consent.
8. Payment and access delivery require a verified provider, approved terms, test transaction, refund/cancellation path, and a defined delivery method.
9. Test every automation with synthetic data and failure cases before enabling it.

## Operating principles
- One notification should contain the next action, not just announce activity.
- Human review stays in the loop for qualification, pricing exceptions, and sensitive cases.
- Minimize personal data. Avoid collecting confidential or special-category information.
- Never claim a webhook, CRM, payment, or bot is connected until an end-to-end test confirms it.
