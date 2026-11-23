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

---

# Part II — DPDP 2023 Children's Data & Verifiable Consent

> *Consolidated from DPDP-CHILDREN.md to eliminate duplicate documentation.*

# DPDP 2023 — Children, Students & Schools

A working extract of the provisions that govern minors in India, focused on the questions an
education consultant actually gets asked. Everything here is from primary source:
`D:\Indian ACT\Digital Personal Data Protection Rules 2025.pdf` (G.S.R. 846(E), 13 Nov 2025) and
`The Digital Personal Data Protection Act 2023.pdf`.

> **Not legal advice.** Verify with counsel before advising a school.

---

## 1. Commencement — what is live and what is not

| Rules | In force |
|---|---|
| **1, 2, 17–21** | **13 Nov 2025 — now** |
| 4 (Consent Managers) | 13 Nov 2026 |
| 3, 5–16, 22–23 | **13 May 2027** |

⚠️ **Rule 10 (children's verifiable consent) does not commence until 13 May 2027.** Until then the
Act's own s.9 applies, which requires verifiable parental consent in substantially the same terms.
Practically, the position a school must design for is the May 2027 one — build to that now.

---

## 2. Rule 10 — verifiable consent for a child

### What it requires

> A Data Fiduciary shall adopt appropriate technical and organisational measures to ensure that
> **verifiable consent of the parent is obtained before the processing of any personal data of a
> child**, and shall observe due diligence for checking that the individual identifying herself as
> the parent is an adult who is identifiable…

**"Adult"** = completed eighteen years (rule 10(2)(a)).

### How the parent's identity may be established

Rule 10(1) offers **three routes**, and the parent must be verified through one of them:

> (a) reliable details of identity and age of the individual **available with the Data Fiduciary**; or
> (b) details of identity and age, **voluntarily provided** —
>     (i) by the individual; or
>     (ii) **through a virtual token mapped to such details, which is issued by an authorised entity.**

**"Authorised entity"** (rule 10(2)(b)) is:
- an entity **entrusted by law, or by the Central or State Government**, with issuing identity and
  age details or a virtual token mapped to them;
- a person appointed or permitted by such an entity; **and**
- **"details of identity and age or token made available and verified by a Digital Locker Service
  Provider."**

### The three worked illustrations in the Rule

| Case | Parent is a registered user? | What the school must do |
|---|---|---|
| **1** | Yes | Check it holds reliable identity and age details, and that the parent is an identifiable adult |
| **2** | No | Verify via an authorised-issued token — **the parent may voluntarily use a Digital Locker service provider** |
| **3** | Yes, opening for the child | As case 1, before processing the child's data |

**The common thread:** the check must happen *before* the child's data is processed, and the route
through a token is always something the parent **voluntarily** uses.

---

## 3. Your question: can a school mandate Aadhaar or APAAR?

**Short answer: no, and rule 10 is explicit about why.**

### Aadhaar

| Question | Answer |
|---|---|
| Is Aadhaar a recognised route? | **Yes, via Digital Locker** — a Digital Locker Service Provider is named as an "authorised entity" |
| Can it be *mandatory*? | **No.** Where the token route is used, rule 10 requires details "**voluntarily provided**" by the individual |
| Can it be the *only* route? | **No.** Rule 10 lists three routes (a), (b)(i) and (b)(ii). A school may not narrow this to Aadhaar alone |
| Can the school demand the parent's Aadhaar directly? | **No.** The route is a token from an authorised entity or details voluntarily provided — not raw Aadhaar collected by the school |

**The defensible design:** offer the Digital Locker route **and** a non-Government route (the
parent's own registered account, per illustration case 1). Making Digital Locker the *only* option
converts a voluntary route into a compulsory one and is not what rule 10 provides for.

### APAAR

**APAAR appears nowhere in rule 10.** It is not an "authorised entity" for the purposes of
verifiable consent under these Rules. A school may of course use APAAR for its own internal
records — that is a separate lawful-basis question under s.7 — but it cannot be presented to
parents as the mechanism by which verifiable parental consent is established under rule 10.

---

## 4. Your question: a school sending student data to a third party without consent

### Short answer: not permitted.

Two independent reasons, both from primary source:

### 4.1 There is no "legitimate interest" or "contractual necessity"

The DPDP Act recognises **consent** plus a short closed list of uses under s.7. It expressly does
**not** recognise contractual necessity or legitimate interests — a meaningful narrowing compared
to the GDPR. A commercial arrangement between a school and a vendor is not, by itself, a lawful
basis.

**Rule 3** compounds this: the notice must give *"an itemised description of such personal data"* and
*"the specified purpose or purposes of … such processing."* A general privacy policy does not
discharge this for a specific third-party disclosure.

### 4.2 Disclosure to a recipient is a disclosure to a third party

Whether the recipient is an education-technology vendor, an examination body, or a foreign
embassy, the analysis is the same: the school is disclosing children's personal data to a party
outside the Data Fiduciary relationship, with no consent, and on a basis that s.7 does not
recognise.

### 4.3 What *is* permitted

Rule 10's routes do not authorise onward disclosure. The only clean paths are:

| Disclosure | Permitted? |
|---|---|
| To a **Data Processor** under a written contract (hosting, storage, our platform) | ✅ Yes — with contractual limits and the processor's own obligations |
| Fulfilling an **obligation under Indian law** (s.7 legitimate use) | ✅ Yes |
| **Any other recipient, without parental consent** | ❌ **No** |

### 4.4 Cross-border adds a further question

Sending student data to a recipient **outside India** is additionally governed by **Act s.16**,
"Processing of personal data outside India". The operative text is **not extractable** from the
folder's Act PDF, so the current restriction position is unverified.

**Practical advice to a school: a US embassy request is not obviously a "legal obligation under any
law in force in India".** Treat an overseas government or agency request as one requiring explicit
parental consent and a documented lawful basis — and obtain specific counsel on s.16 before
responding.

---

## 5. Second Schedule — a closed list, not a general exemption

"Purposes for which provisions of sub-sections (1) and (3) of section 9 shall not apply". It is
**exhaustive**, and includes:

| Purpose | Restriction |
|---|---|
| Exercise of any power or performance of a function under Indian law | Restricted to what is necessary |
| Provision of a subsidy, benefit, service, certificate, licence or permit in the interests of a child | Restricted to what is necessary |
| Creating an account for communicating **by email only** | Use limited to email |
| Determination of a child's **real-time location** | In the interests of her safety |
| Preventing advertisement with a detrimental effect on a child | Advertisement must not be accessible |

**Anything outside this list requires full s.9 compliance.** An AI tutor is squarely outside it.

---

## 6. Rule 8 — retention, and why it constrains our purge design

**Rule 8(3):**
> a Data Fiduciary shall retain … such personal data, associated traffic data and other logs of the
> processing for a **minimum period of one year** from the date of such processing … after which the
> Data Fiduciary shall cause such personal data and logs to be erased

**Illustration 2** applies it to processors: a company using a cloud provider must ensure the
processor also retains for one year before erasure.

⚠️ **This corrects an earlier recommendation of mine.** `PRIVACY.md` and `ROI.md` argued for
deliberately short retention as a privacy and cost advantage. **A one-year statutory floor exists**
for personal data, traffic data and processing logs. The purge design must be:

- **Transaction, payment and processing logs → minimum one year**, then erase
- **Conversation content** → the position needs checking against the Third Schedule, which sets
  retention **by class of Data Fiduciary**; the first class listed is an e-commerce entity with
  ≥2 crore registered users at **three years from the Data Principal last approaching the entity**.
  A small operator is a different class and likely shorter — **verify the class that applies to us.**

---

## 7. Rule 6 — security safeguards

> "…appropriate data security measures, such as securing of personal data through **encryption,
> obfuscation, masking or the use of virtual tokens mapped to that personal data**"

**The Rules endorse tokenisation in their own words.** This validates `PRIVACY.md` §3.4 and
`LEGAL.md` §1: pseudonymisation is a recognised safeguard. Note carefully that tokenisation is a
*security measure* — it does **not** remove data from the Act's scope. Only irreversible
anonymisation does that.

---

## 8. Practical checklist for a school

- [ ] No student account without **verifiable parental consent** obtained and recorded first
- [ ] Parent verification offers **Digital Locker AND** a non-Government route
- [ ] **No Aadhaar or APAAR demanded as a condition of use**
- [ ] Notice itemises the data and each purpose, and links to withdraw, rights, and complaint
- [ ] Every vendor is engaged as a **Data Processor under a written contract**, not as an independent
  recipient
- [ ] **No student data to any third party without parental consent**, including examination bodies
      and foreign agencies
- [ ] Cross-border disclosures reviewed against **s.16** with counsel
- [ ] Image generation **disabled for under-18 accounts**
- [ ] Retention reflects the **one-year floor** in rule 8(3)
- [ ] Logs enable user deletion but not before the retention floor

---

## 9. Unverified

1. **Act s.17 operative text** — small-enterprise exemption threshold and its notification duty.
   Not extractable from the folder's Act PDF.
2. **Act s.9 operative text** — the parent-consent standard itself.
3. **Act s.16 operative text** — cross-border restrictions.
4. **Third Schedule, remaining classes** — the retention period applicable to an operator of our size.

All four are extraction failures on a single PDF, not research failures. A complete Bare Act text
would close all of them.