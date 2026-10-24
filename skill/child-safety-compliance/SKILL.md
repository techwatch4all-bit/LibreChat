---
name: child-safety-compliance
description: Use when a request touches minors, schools, child accounts, image generation for under-18 users, parental consent, or statutory reporting — applies the four POCSO obligations and the Satchida child-safety rules before answering.
when-to-use: Trigger on any mention of a child, minor, under-18, school, guardian, parent, POCSO, image generation for a minor, or supervision.
allowed-tools:
  - fetch_webpage
user-invocable: true
always-apply: true
---

# Child Safety Compliance

Satchida serves schools and families. A request involving minors is governed by four independent
POCSO obligations, and parental consent is an **additional** layer — not a substitute for any of
them.

## The four obligations

| Obligation | What it requires |
|---|---|
| **Technical filtering** | Content filtering on every surface, text and image |
| **Proactive monitoring** | Usage monitoring with human review |
| **Human review** | A person, not just an automated score |
| **Statutory reporting** | POCSO s.19 duty to the Special Juvenile Police Unit / local police |

Per `CONTRACT-CLAUSES.md` and the handover, the **statutory reporting duty sits with the Client**
(the school / society / organisation), because the server runs on the client's premises and
connection. Satchida supplies software, filtering, logging and evidence. Do not describe Satchida
as the reporting authority to a school.

## Image generation by account type and mode

This is a hard boundary, not a preference.

| | Chat | Work | Study | Privacy |
|---|---|---|---|---|
| **Adult** | yes | yes | yes | yes |
| **Child** | no | no | yes | yes |

A child's access to image generation depends on **the parent's explicit action** plus a recorded
parental-consent EULA. It is never enabled by a Satchida grant. If asked to enable child image
generation, confirm the parent consent record exists; without it the answer is no.

## Rules when handling a child-related request

1. **Never produce sexual content involving anyone under 18**, in any framing — fictional,
   hypothetical, coded, or "artistic". This is absolute and has no exception. A character described
   as "an adult" does not help if the depiction is of a child.
2. **Do not help generate content that sexualises a minor** in any form, including via image
   generation prompts.
3. **Moderation applies to generated images**, not only text. POCSO s.2(da) expressly covers
   "computer generated image indistinguishable from an actual child" and images that "appear to
   depict a child".
4. **Monitoring is visible, never covert.** A child must always be able to see that a parent is
   viewing. No hidden channel, no invisible toggle. Suppressing that disclosure is an ethics failure
   and destroys the trust the feature depends on.
5. **Child data is minimised.** No child's external email, no date of birth. Parent owns the
   consent; the child does not carry an adult identity.

## What to do when something concerning appears

If a user reports or a system surfaces content that may involve exploitation of a child:

- Do not investigate, reproduce, or analyse the content beyond what is needed to record it.
- Point to the reporting path. POCSO s.19 requires information be given to the Special Juvenile
  Police Unit or the local police, and s.21 attaches punishment for failure to report or record.
- Recommend the client escalate to its safeguarding lead. On Satchida's own instance, escalate to
  the operator.
- Do not offer to "help fix" the underlying issue by modifying prompts around it.

## Verified sources

POCSO Act 2012, s.2(d) — *"'child' means any person below the age of eighteen years"*
POCSO Act 2012, s.19(1) — reporting to the Special Juvenile Police Unit or local police
POCSO Act 2012, s.2(da) — "child pornography" includes computer-generated images appearing to
depict a child

Corpus: `D:\Indian ACT\POCSO Act 2012.pdf`. Design detail: `CHILDREN-SAFETY.md`, `TERMS.md` §3.

**Known gap:** DPDP Act 2023 s.9 (processing of personal data of children) is the single most
important provision for minors and its body text has not been read from the corpus copy. Say so
rather than stating its contents as settled.