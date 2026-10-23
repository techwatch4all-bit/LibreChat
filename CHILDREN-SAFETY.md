# Children's Data, Safety & School Compliance

Law that applies when minors use the platform, what it requires of us, and the technical design
that satisfies it. Read with `LEGAL.md`, `Satchida_Legal.md` §2.4, `PRIVACY.md` §6.

> **Not legal advice.** Every provision below is quoted from primary source where verified. The
> school-facing obligations are extensive and must be reviewed by the school's own counsel.

**Blocked on:** DPDP Act **s.9 body text** — the Act PDF in `D:\Indian ACT` contains the
arrangement of sections but not the operative text, and the Rules are in Hindi. s.9 is the single
most important provision for this document. **Must be read before launch.**

---

## 1. Verified law

### 1.1 POCSO Act, 2012 — the most consequential provision for image generation

Source: `POCSO Act 2012.pdf`, primary text extracted. ✅

**s.2(d) — definition:**

> _"'child' means any person below the age of eighteen years_

**s.19(1) — reporting of offences:**

> _"Notwithstanding anything contained in the Code of Criminal Procedure, 1973, any person
> (including the child), who has apprehension that an offence under this Act is likely to be
> committed or has knowledge that such an offence has been committed, he shall provide such
> information to, — (a) the Special Juvenile Police Unit; or (b) the local police."_

**s.21 — punishment for failure to report or record a case.**

**s.2(da) — "child pornography" includes:**

> _"...any visual depiction of sexually explicit conduct involving a child which include
> photograph, video, digital or computer generated image indistinguishable from an actual child
> and image created, adapted, or modified, but appear to depict a child"_

#### Why this is significant for the image feature

**The definition expressly covers computer-generated images that appear to depict a child.** An
image-generation capability on a school platform therefore creates a live POCSO reporting duty.

This applies to **any person** — the school, its staff, and **us**. It is not a role-specific
obligation. Three consequences:

1. **We need a documented reporting procedure** naming who at Satchida is responsible, with
   contact details for the local police and the Special Juvenile Police Unit.
2. **We need a visible report mechanism** in the product for a user to flag content.
3. **Moderation must be enforced on generated images**, not only on text.

### 1.2 DPDP Act 2023, s.9 — children

Verified from the arrangement of sections: **"9. Processing of personal data of children"** is a
standalone section. **Body text not yet read** — open item, and the highest-priority one.

What is known: children require verifiable parental consent, and there is an age threshold below
which the child cannot consent for themselves. **Exact mechanism to be confirmed.**

### 1.3 Other Acts available and relevant

Present in `D:\Indian ACT`, **none yet read**:

| Act                                                  | Relevance                                                                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Right to Education Act 2009**                      | School's own obligations; an RTE school must explain AI policy                                                 |
| **POSH Act 2013**                                    | Schools must constitute a POSH Committee — engaged if girls use the platform                                   |
| **Child Labour Prohibition and Regulation Act 1986** | Applies to students under 14                                                                                   |
| **IT Act 2000, s.67A**                               | Publishing obscene material                                                                                    |
| **IT Act 2000, s.67C**                               | **Intermediary obligations — observe and remove obscene material. Directly engaged by user-generated images.** |
| **IT Act 2000, s.79**                                | Intermediary safe harbour, conditional on due observance of s.67C                                              |

⚠️ **IT Act s.67C is the one to watch.** Images generated on a client's server may be
"information" under the Act. If the platform is treated as an intermediary, due-observance duties
attach. In the on-premise model the client is closest to that role — but **this must be settled with
counsel before we offer image generation to any school.**

---

## 2. What this means commercially

**Image generation should not launch into schools until s.9 and s.67C are resolved.** It can
launch for adults, where POCSO's child-specific definition does not apply and the risk profile is
ordinary content moderation.

That is the recommendation, and it is reversible once counsel responds.

---

## 3. Technical design

### 3.0 Current implementation status (verified 2026-10-06)

This section records code/runtime evidence and supersedes any table below that reads as an already
implemented control.

- Automatic memory extraction is disabled in the active `librechat.yaml` (`memory.agent.enabled: false`).
  Manual memory features are separate; this does not establish local-only processing for every model path.
- `librechat.yaml` has no configured `messageFilter` PII patterns. `.env` has no configured
  `OPENAI_MODERATION`, `OPENAI_MODERATION_REVERSE_PROXY`, or `OPENAI_MODERATION_API_KEY` setting.
- Family/minor fields exist in the user schema, but audited chat, image, and generation paths do not
  enforce them. They are not currently a trusted child-policy boundary.
- No universal input-and-output child moderation path is wired. Existing moderation is opt-in,
  request-oriented, and does not cover every assistant/agent route or final generated output.
- Image uploads are not inspected by pixel content; generated image artifacts have no child-specific
  output moderation. Until those paths are screened, they must remain disabled for child accounts.

**Status:** local moderation, fail-closed child gating, configured PII redaction, image scanning, and
child account authorization are **not implemented/verified**. Do not describe these as active controls
or claim POCSO/DPDP compliance from the schema or design. School use remains blocked on a trusted child
identity path and actual local moderation coverage.

## 3. Technical design

### 3.1 Age gate and parental consent

| Requirement                     | Implementation                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Age declaration at registration | Capture and store; do not collect DOB as an identifier                                                                      |
| Parental consent for under-18s  | Consent flow with a verifiable token; consent recorded with timestamp and version                                           |
| No PII from minors              | Block free-text fields that invite personal data; **clients provision accounts, not end users** (`BUSINESS-PROPOSAL.md` §5) |
| Consent withdrawal              | One-click revocation that disables the account within 24 hours                                                              |
| Consent audit trail             | Who consented, when, to which version of the notice                                                                         |

**Do not collect a child's email.** The client provisions accounts using pseudonymous identifiers.
We hold no personal data about minors at all — which is the strongest available position, and it is
only possible because of the provisioning design in `BUSINESS-PROPOSAL.md` §5.

### 3.2 Content moderation

Both recommended models are permissively licensed and run **locally on the client's 16 GB card**:

| Model           | Licence    | Role                                                         |
| --------------- | ---------- | ------------------------------------------------------------ |
| **ShieldGemma** | Apache-2.0 | Text moderation — harassment, hate, sexual content, violence |
| **Llama Guard** | MIT        | Text moderation — category detection                         |

Architecture: **input moderation → model → output moderation**, on the client's hardware. Nothing
is sent to a third party for screening, which preserves the privacy claim.

**Verified in this repository:** `messageFilter` exists in `configSchema` with regex validation at
load time. That is a **PII-redaction** filter, not a content-safety filter — the two are different
and both are needed:

| Filter                     | Purpose                            | Source                           |
| -------------------------- | ---------------------------------- | -------------------------------- |
| `messageFilter` (built in) | Redact PII patterns before sending | LibreChat, verified              |
| Content moderation         | Block adult/harmful content        | ShieldGemma or Llama Guard, ours |

### 3.3 The sensitive-data guidance shown to minors

Different from the adult version, and shorter. A child should be told plainly:

> "Don't type your name, your address, your school roll number, anyone's phone number, or any
> photo of yourself or anyone else unless a teacher asks you to."

No legalese, no scrolling. This is the single highest-value safety feature for schools and the one
parents ask about first.

---

## 4. Reporting mechanism — mandatory design

POCSO s.19 obliges **any person** with knowledge or apprehension to report. We must make that
practically possible for a user.

**Required in the product:**

1. A **"Report a concern"** control available on every conversation, reachable by a child without
   navigating settings
2. Reports routed to a **named Satchida contact** with contact details published — and a published
   **local police / Special Juvenile Police Unit** reference
3. Reports concerning a child escalated **without delay**; suspected CSAM escalated **immediately**
4. Every report logged with timestamp, reporter type, and action taken

**Required of the client, in the contract:**

- The school is the first responder and its own escalation point
- The school names its safeguarding lead
- The school's obligations under POSH and POCSO are unaffected by our platform

---

## 5. Parental controls

What parents will actually ask for, and what we can honestly deliver:

| Ask                                 | Deliverable                                        | Honest status                                                         |
| ----------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| Filter adult content                | Local moderation, input and output                 | ❌ Not implemented/verified                                           |
| No ads, no upsell                   | We have none                                       | ✅ True                                                               |
| No data sold                        | We do not sell                                     | ✅ Policy statement; not a moderation control                         |
| See what my child asked             | Parent visibility, with age-appropriate framing    | ⚠️ Design decision — see below                                        |
| Time limits                         | Per-account usage windows                          | ❌ Not implemented/verified                                           |
| Human approval for image generation | Under-18 accounts: image generation off by default | ⚠️ Intended policy; no child enforcement hook yet                     |
| Data location                       | Stays on school hardware                           | ⚠️ Depends on configured routing; Privacy is intended to remain local |

**Parent visibility needs care.** It is genuinely useful and genuinely risky: a surveillance
feature on a child is a safeguarding tool in one household and a harm in another. Recommendation:

- **Off by default**
- Enabled only by a parent or the school, with the child informed
- Reports _categories and topics_, not a transcript — the tutor value is "revisions" and
  "struggling with algebra", not a transcript

That gives the safety benefit without building a monitoring product we would have to defend.

---

## 6. School compliance checklist

To be included in the school-facing pack:

- [ ] Signed parental consent for every account holder under 18
- [ ] POSH Committee constituted (existing school duty — our platform must not undermine it)
- [ ] School safeguarding lead named in the agreement
- [ ] Reporting procedure published, with local police / SJPU contacts
- [ ] Child Labour Act position confirmed for students under 14
- [ ] RTE policy disclosure — how AI is used in teaching
- [ ] **Image generation disabled for under-18 accounts until §2 is resolved**
- [ ] Retention policy agreed (parents should know what is kept, and for how long)
- [ ] Parent information sheet in the relevant language

---

## 7. Open items — must close before any school

| #   | Question                                                                          | Owner                                  |
| --- | --------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | **DPDP s.9 body text** — exact parental-consent mechanism and age threshold       | Read from primary source; then counsel |
| 2   | **DPDP Rules 2025** English version — s.9 obligations in rules                    | Retrieve; not in folder (Hindi only)   |
| 3   | **IT Act s.67C** — does user-generated imagery make the platform an intermediary? | Counsel                                |
| 4   | **RTE Act** — school obligations where AI is used in teaching                     | Counsel                                |
| 5   | **POSH Act** — interaction with the school's existing committee                   | Counsel                                |
| 6   | Is ShieldGemma or Llama Guard acceptable to a school's IT policy?                 | Pilot                                  |

**Until items 1–3 are closed, sell the platform to schools as text-and-voice only.** The core
product is unaffected; only image generation and any personalised minor-facing feature are held
back. That is a small concession made deliberately, and it is far cheaper than discovering a POCSO
obligation after launch.
