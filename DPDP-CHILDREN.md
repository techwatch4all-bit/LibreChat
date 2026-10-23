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