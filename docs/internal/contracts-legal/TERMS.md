# Terms of Service & End-User Agreement — Satchida

**Version 1.0 · 2026-10-04 · must be accepted at first login.**

> **Not legal advice.** Have an Indian advocate review before launch.

---

## 1. Acceptance

By creating an account you accept these terms on behalf of the organisation operating the
service, and you confirm that organisation is authorised to bind you to them.

**Acceptance is recorded** with the terms version, timestamp, and the account. Continuing to
use the service without accepting is not permitted.

---

## 2. Who you are and what we are

- The **Operator** of the platform is the organisation that provisioned your account.
- **Satchida** supplies the software. Where Satchida also operates a hosted service, Satchida
  acts as the merchant and the billing party.
- Your account is a **service account**. It is not tied to your legal identity unless the
  Operator chooses to link it.

---

## 3. Acceptable use — strict

The following are prohibited, without exception, and may result in immediate suspension and
referral to law enforcement:

1. **Terrorism, violence, or incitement** of any kind.
2. **Child sexual exploitation material**, or any attempt to generate, request, possess, share,
   or distribute it — including AI-generated imagery of a sexual nature involving a minor.
3. **Non-consensual sexual content**, including synthetic intimate imagery of a real person.
4. **Harassment, threats, or intimidation** directed at any person.
5. **Self-harm content** that encourages, instructs, or glorifies self-harm.
6. **Instructions or facilitation of weapons, explosives, narcotics, or violence.**
7. **Fraud, impersonation, or identity misuse**, including pretending to be another person,
   an employee of a client organisation, or a government official.
8. **Abuse of the platform itself** — attempts to breach the licence, bypass seat or credit
   limits, scrape or resell the service, or interfere with other users.
9. **Infringement of others' rights** — privacy, intellectual property, or reputation.
10. **Uploading another person's data** without their authorisation.
11. **Evading the safeguards** described in this document.

**Generating content that is illegal, or that attempts to depict a child in any sexual or
abusive context, is prohibited even in a private conversation.** Filters are a safety
assistance, not a limit of this clause.

---

## 4. Content you submit — you are responsible

You must not submit passwords, API keys, access tokens, private keys, bank or card details,
government identifiers, medical records, or any confidential or regulated material — whether in
a message, a document, a link, or an upload.

A privacy-focused platform is **not** a channel for confidential secrets. You remain
responsible for what you submit and for obtaining any permissions required before submitting
content that belongs to someone else.

---

## 5. Credits — images and tokens

Credits are denominated **only in images and tokens**. No monetary value is charged, displayed,
or recoverable against them.

| Rule | Detail |
|---|---|
| **Non-transferable (between accounts)** | Credits are attached to the account under which they were issued and cannot be gifted, sold, or moved to any other account. On a Family Plan, all usage profiles share the credit balance of the single Family Account — this constitutes access to a shared account entitlement, not a transfer between accounts. Family credits cannot be moved to any account outside the Family Plan. |
| **Non-refundable** | Once credited, a credit cannot be refunded, converted, or withdrawn |
| **No cash value** | Credits are not redeemable for money and hold no monetary value |
| **12-month validity** | Each grant expires 12 months from the date it was issued |
| **Countdown shown** | The interface displays days remaining until your next reset |
| **Consumption order** | The credit expiring soonest is used first, so value is not silently wasted |

Credits reset to zero when the term ends. The service does not carry a debt forward unless the
Operator's plan states otherwise.

---

## 6. Privacy

- Your conversations and uploads are stored on infrastructure controlled by the **Operator**,
  not by Satchida, where the service is deployed on the Operator's own hardware.
- **Your identity is never disclosed to any model provider.** No provider is told your name,
  email address, or account details.
- **Your prompts are never used to train any model**, by Satchida or by any provider.
- The **Operator** is the data custodian for your conversations. Requests concerning access,
  correction, or erasure should be directed to the Operator.
- Satchida holds only what is needed to operate the service: a pseudonymous account reference,
  your plan, and a payment record. Satchida does not hold your conversation content on an
  Operator-run deployment.
- **Model and provider identity are not disclosed** in the interface. This is deliberate.

## 7. Security

- Traffic is encrypted in transit; the platform is reached over HTTPS.
- Credentials and tokens are stored using industry-standard protection; **API keys are never
  stored on the device where the platform runs**, and are never exposed to any model.
- Access to data is logged, time-bounded, and auditable by the Operator.
- No system is perfectly secure. Do not rely on the service for the storage of the only copy of
  anything critical.

## 8. Availability

We aim for high availability but do not guarantee uninterrupted service. Maintenance, hardware
failure, and third-party dependencies can cause interruption. You should keep your own backups
of anything you cannot afford to lose.

## 9. Changes

Material changes to these terms will be notified in the product before they take effect. Your
continued use after that notice constitutes acceptance. The terms version is recorded against
your account.

## 10. Liability

To the extent permitted by law, liability for indirect or consequential loss is excluded, and
aggregate liability is limited to the amount you paid for the service in the preceding twelve
months. Nothing in these terms excludes liability that cannot lawfully be excluded, including
for deliberate misuse or breach of section 3.

## 11. Termination

You may delete your account at any time, which removes your personal data from the Operator's
systems subject to the Operator's retention obligations. The Operator may suspend an account
for breach of section 3 or non-payment.

## 12. Governing law

These terms are governed by the laws of India. The courts at Bengaluru, Karnataka have
exclusive jurisdiction, subject to any mandatory consumer protection provisions applicable to you.

---

## Implementation note

| Requirement | Where it is enforced |
|---|---|
| Acceptance recorded with version + timestamp | Account record, `termsAcceptedAt`, `termsVersion` |
| Section 3 prohibitions | Content safety filter + enforcement policy |
| Section 5 non-transferability | `fleet/src/credits.mjs` → `guardTransfer()` — fails closed, enforced in code |
| Section 5 no monetary value | `display()` returns `currency: null`; no rupee field exists in the schema |
| Section 5 expiry + countdown | `EXPIRY_DAYS = 365`; `display().resetsInDays` |
| Section 6 no identity to providers | Gateway strips identity before upstream call |
