---
name: taina-product-quality
description: Use for TAINA Knowledge Map implementation, code review, release readiness, security, browser QA, regression tests, and deployment decisions.
---

# TAINA Product Quality and Release

Protect customer data and founder credibility. A green unit-test suite is not a production release.

## Required preflight
- Inspect current branch, uncommitted changes, README, AUDIT, RELEASE-CHECKLIST, package.json, lockfile, and deploy workflow.
- Confirm target repo, branch, publish directory, and production environment.
- Keep product code, marketing site, and deployment configuration clearly separated.
- Never merge, deploy, rotate credentials, delete data, or change production settings without explicit user authorization.

## Quality gates
1. Pin exact dependency versions and commit a lockfile.
2. Perform clean install using lockfile.
3. Run TypeScript checks, unit tests, production build, npm audit, and full Playwright E2E.
4. Browser-test first run, persistence after reload, JSON backup/restore/merge, XLSX/CSV export, multi-tab locking, failure recovery, mobile viewport, and keyboard accessibility.
5. Verify CSP/security headers on the deployed build.
6. Check dependency/license notices and remove secrets from artifacts.
7. Verify all product claims in the landing page against the actual app.
8. Run a synthetic-data pilot and test user comprehension without developer help.

## Security boundaries
- Knowledge Map V1 stores data in browser IndexedDB and does not encrypt it at rest.
- Do not use personal, medical, customer, financial, or confidential business data in pilots.
- Do not place API keys or webhook secrets in client-side code or Git.
- Fail closed on data integrity errors; do not silently overwrite or reset a user's project.

## Release decision
Return PASS / BLOCKED / CONDITIONAL with evidence for each gate. State what was actually executed and what remains unverified. Never label a release production-ready while mandatory gates remain open.
