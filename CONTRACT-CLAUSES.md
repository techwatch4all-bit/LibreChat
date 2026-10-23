# Contract Clauses — Satchida AI Harness

Drafting-ready language for the Client Service Agreement and the End-User Terms. Written so
that operator access, data processing, and data-principal rights are **contractual from the
outset** rather than improvised at the moment access is needed.

> **Not legal advice.** Have an Indian advocate review before signature.

Related: `CONTROL-MODEL.md`, `CLIENT-PROPOSAL.md`, `DPDP-CHILDREN.md`, `LEGAL.md`.

---

## Preamble — Nature of This Agreement

This Agreement is a **software licence and support agreement**, not a service agreement.
Satchida (the Licensor) licenses software to the Client (the Licensee). The Licensor does
not operate the software, does not operate any hardware, does not store any end-user data,
and is not the service provider to any end user. The Client operates the software on the
Client's own hardware, for the Client's own users, under the Client's own terms of service.

The Licensor's only obligations are: (a) to deliver a working copy of the software,
(b) to maintain the remote licensing and heartbeat infrastructure, and (c) to provide
support as specified in this Agreement.

All obligations arising from the operation of the software — to users, to regulatory bodies,
to third parties — rest with the Client as the operator and, where applicable, the Data
Fiduciary under applicable Indian law.

---

## 1. Why blanket authorisation is the right structure

Access to client data is needed for reasons that are **routine and predictable**, not
exceptional:

| Trigger | Nature |
|---|---|
| Fault diagnosis and troubleshooting | Operational |
| **Erasure request from a data principal** | **Statutory** — DPDP Act s.12 |
| **Access / correction request** | **Statutory** — DPDP Act ss.11–12 |
| Recovery of data from the client's RAG store at the client's request | Contractual |
| Incident response | Contractual |

The last three are not discretionary. Under DPDP the data principal may exercise rights and
someone must actually execute them, and on our architecture that means touching the client's
store. **A support model that requires ad-hoc written authorisation per request cannot discharge
a statutory duty.** Blanket authorisation, bounded and logged, is both more lawful and more
practical than a per-request consent treadmill.

---

## 2. Parties and chain of obligation

```
Client (RWA / school / SME)  ── Service Agreement ──▶ Satchida
      │
      └── End users bound via EULA accepted at first login
```

The **Client** is the Data Fiduciary for end-user personal data. **Satchida is the Data
Processor.** End users are Data Principals who interact with the Service under the Client's terms
and ours.

The Client warrants it has the authority to bind its end users to these terms.

---

## 3. Clause — Support access (blanket authorisation)

> **3.1 Support Access.** The Client grants Satchida authorisation to access the Service
> instance, including its administrative interface and data stores, for the purposes of
> operating, maintaining, troubleshooting and supporting the Service, and for giving effect to a
> Data Principal's request under clause 5.
>
> **3.2 Disclosure.** The Client acknowledges that Satchida maintains a support administrator
> account on the Client's instance for these purposes. The account is disclosed to the Client at
> commissioning, including its identifier and its authority level. Satchida does not conceal it,
> and the Client may inspect it in its own database at any time.
>
> **3.3 Access Log.** Satchida shall maintain an append-only access log recording, for every
> administrative action: timestamp, the Satchida operator identity, the action, and the identifier
> of the object acted upon. Satchida shall provide a copy of that log to the Client at the end of
> every support engagement, and on request, whether or not any data was accessed.
>
> **3.4 Normal operation.** Satchida's expectation is that the support account is not used in
> normal operation. The absence of entries in the access log is the intended state, not a failure
> of logging.
>
> **3.5 No warrant.** Nothing in this clause permits Satchida to access data for its own purposes,
> for its own product development, or for any purpose unrelated to the Service or to a Data
> Principal request. Satchida will not use Client data to train any model.
>
> **3.6 On termination.** On termination, Satchida shall, within thirty (30) days, delete the
> support administrator account and return or securely destroy all Client data held by Satchida,
> and certify the same in writing.

---

## 4. Clause — Processing instructions

> **4.1** Satchida processes personal data on the Client's instructions, including the
> configuration applied at the Client's direction.
>
> **4.2** Satchida engages no sub-processor for Client personal data without the Client's prior
> written consent. *(Note: model inference providers **are** sub-processors in the DPDP sense —
> see clause 4.4.)*
>
> **4.3** Satchida shall not transfer Client personal data outside India except where required by
> the Client's instruction for an inference route the Client has enabled.
>
> **4.4 Model providers as sub-processors.** Where the Client enables a mode that routes prompts
> to an external model provider, the Client is appointing that provider as a sub-processor and
> confirms it has satisfied itself as to the provider's data handling. Satchida shall publish the
> list of such providers and the configuration governing each route.
>
> **4.5 Breach notification.** Satchida shall notify the Client without undue delay, and in any
> event within seventy-two (72) hours, of becoming aware of a personal data breach within its
> possession or control, and shall provide the information required for the Client's own
> notification obligations.

---

## 5. Clause — Data Principal rights (the erasure path)

This is the clause that makes the technical erasure design contractually sound.

> **5.1** The Client may instruct Satchida to give effect to a Data Principal's request to access,
> correct or erase personal data. Satchida shall act within seven (7) days of instruction, or
> sooner where the Data Principal's request specifies.
>
> **5.2 Erasure scope.** On an erasure instruction, Satchida shall:
>   (a) delete the Data Principal's indexed document material from the RAG store under that
>       Data Principal's namespace;
>   (b) delete or irreversibly anonymise the Data Principal's records held by Satchida for billing
>       and entitlement, subject to clause 7;
>   (c) issue a written completion record identifying what was deleted, what was retained and the
>       statutory basis for each retention.
>
> **5.3** The Client retains custody of conversation content and may verify erasure directly in its
> own database. Satchida does not hold conversation content.
>
> **5.4** Satchida shall not require a separate instruction in order to comply with a statutory
> deadline arising from a Data Principal's complaint.

### Technical consequence

Clause 5.2(a) requires an authenticated administrative path in the RAG service that deletes by
namespace. That means the RAG service must expose a **namespaced bulk delete** authenticated by
Satchida's own credential, not by a client-issued JWT — because it operates across namespaces on
instruction rather than serving one user's request. Designed in `RAG-SERVICE.md`; implemented in
Milestone 3.

---

## 6. Clause — End User Terms (EULA), shown at first login

> **6.1** By creating an account and using the Service you accept these terms on behalf of the
> organisation operating it, and confirm that the organisation is authorised to bind you to them.
>
> **6.2 Data.** Conversations and files you submit are stored on the operating organisation's
> infrastructure. Depending on the mode you choose, content may be processed by third-party model
> infrastructure. You are responsible for what you submit.
>
> **6.3 Sensitive information.** Do not submit passwords, API keys, access tokens, financial or
> card details, government identifiers, medical information, or any confidential or regulated
> material, whether in a message, a document, or a link. A privacy-focused platform is not a
> channel for confidential secrets.
>
> **6.4 Suspension.** Access may be limited according to the plan or allocation of the operating
> organisation.
>
> **6.5 Deletion.** You may request deletion of your data from the operating organisation, who is
> the data custodian.

---

## 7. Retention schedule

| Record | Held by | Retention | Basis |
|---|---|---|---|
| Conversation content | **Client** | Per Client's policy | Client is custodian |
| Indexed document material (RAG) | **Client** | Per Client's policy | Client is custodian |
| Entitlement and plan records | Satchida | Term + 1 year | Contract |
| **Payment transaction record** | Satchida | **8 years** | Statutory — confirm exact period with a CA |
| **Support access log** | Satchida | **6 years**, then provided to Client | Warranty of the clause 3.3 promise |
| Operational logs | Satchida | 12 months | Security and incident response |

⚠️ **DPDP Rules 2025, rule 8(3)** requires personal data, associated traffic data and processing
logs to be retained for **a minimum of one year**. Nothing in this schedule goes below that for
records we hold.

---

## 8. Vocabulary for the support account — the `.invalid` question

The operator asked how an address that can neither receive mail nor be used for OAuth can be a
working administrator credential. Verified by execution:

```
Support account login → HTTP 200, valid JWT
MX lookup for .invalid → ENOTFOUND  (RFC 2606 reserved, never resolvable)
```

The email address is **not** a mailbox. It is an **identifier**. LibreChat needs a string in the
email field to key the login; nothing more is implied. The account authenticates with
**email + password**, which is why `.invalid` works perfectly well.

Using `.invalid` is deliberate, and gives three properties:

| Property | Why it matters |
|---|---|
| **Provably no mailbox** | No shared mailbox exists to be intercepted, forwarded, or compromised |
| **Provably not an OAuth identity** | No Google account can exist for `*.invalid`, so the account cannot be silently taken over by a social-login path |
| **Provably cannot be reset by a stranger** | Password reset would have nowhere to deliver |

The account is created with `emailVerified: true` set directly, because there is no mailbox to
verify against — which is correct for a vendor account, not a workaround. Combined with
`ALLOW_PASSWORD_RESET=false`, no reset flow can be initiated for it at all.

**Each client gets a distinct address** — `satchida-support@school-mum.invalid` versus
`satchida-support@acme-blr.invalid` — so access to one deployment never reaches another.

---

## 9. Open drafting points for counsel

1. Confirm the 8-year payment-record retention period
2. Confirm whether model inference providers must be listed as sub-processors in the agreement
   body or may be published by reference
3. Confirm IT Act s.70B nodal-contact obligations where the Client is a school
4. Confirm the access-log retention period adequately evidences the clause 3.4 promise
5. Confirm the EULA suffices to bind end users, or whether co-signed guardian consent is required
   for users under 18
6. Confirm data localisation position where the Client enables a cloud inference route

---

## 10. Disclaimer of Warranties and Limitation of Liability

> **10.1 As-Is licence.** The software is licensed **"as is"**, without warranty of any kind,
> express or implied. To the maximum extent permitted by applicable law, the Licensor
> expressly disclaims all warranties including, without limitation, warranties of
> merchantability, fitness for a particular purpose, title, and non-infringement.

> **10.2 No service warranty.** The Licensor does not warrant that the software will be
> uninterrupted, error-free, or free of harmful components. The Client accepts full
> responsibility for the consequences of operating the software on its infrastructure.

> **10.3 Complete exclusion of liability.** To the maximum extent permitted by applicable
> law, the Licensor shall have **no liability whatsoever** to the Client or any third party
> for any loss or damage of any kind arising out of or in connection with this Agreement or
> the use or inability to use the software, including but not limited to:
> (a) loss of profits, revenue, or anticipated savings;
> (b) loss of business, contracts, or commercial opportunity;
> (c) loss, corruption, or destruction of data;
> (d) loss of goodwill or reputation;
> (e) claims by the Client's users, employees, regulators, or any third party;
> (f) regulatory fines or penalties arising from the Client's operation of the software;
> (g) any indirect, consequential, special, incidental, or punitive damage.

> **10.4 Statutory backstop.** Where applicable law does not permit complete exclusion of
> liability — and only to that extent — the Licensor's aggregate liability shall not exceed
> the total licence fees paid by the Client in the **three (3) calendar months immediately
> preceding the specific event** giving rise to the claim. This is a statutory minimum
> fallback, not an acknowledgement of liability.

> **10.5 Client indemnity.** The Client shall indemnify, defend, and hold harmless the
> Licensor and its representatives from and against any and all claims, liabilities, losses,
> damages, costs, and expenses (including legal fees on a full indemnity basis) arising from:
> (a) the Client's operation of the software;
> (b) any claim by an end user or third party relating to the Client's service;
> (c) the Client's failure to comply with applicable law, including POCSO, DPDP, IT Act,
>     GST, and any other regulatory obligation;
> (d) the Client's failure to comply with Schedule A of this Agreement;
> (e) any data breach, privacy violation, or regulatory penalty arising at the Client's site;
> (f) any claim relating to the Client's terms of service or EULA with its users.

> **10.6 No privity with end users.** End users of the software have no contractual
> relationship with the Licensor. Any claim an end user may have is solely against the
> Client as operator. The Licensor is not a party to, and accepts no obligation under, any
> agreement between the Client and its users.

> **10.7 Mutual acknowledgement.** The Client acknowledges that:
> (a) it has independently assessed the suitability of the software for its purposes;
> (b) the Licensor's pricing reflects the complete disclaimer of liability in this clause;
> (c) the Client is the operator and Data Fiduciary and accepts those responsibilities.

> **10.8 Exceptions.** Nothing in this clause excludes liability that applicable law
> expressly prohibits excluding, specifically: (a) death or personal injury caused by
> the Licensor's fraud or gross negligence; (b) fraud or fraudulent misrepresentation
> by the Licensor. These exceptions are narrow and do not expand the Licensor's liability
> beyond what the law mandates.

---


## 11. Schedule A — Child Safety and POCSO Compliance

*Applicable where the Client operates the Service on any site accessible to persons under 18.*

> **A.1 Operator responsibility.** The Client is the operator of the Service at its premises.
> The Client is therefore the primary point of contact for any safety concern raised by a user,
> a parent, or a guardian at its site.
>
> **A.2 Safeguarding lead.** Before enabling access for any user under 18, the Client shall
> designate a named safeguarding point of contact. That person's name and a contact route
> (email or internal form) shall be published within the Service interface. The Client shall
> keep this information current.
>
> **A.3 Compliance with applicable law.** The Client shall comply with all applicable law at
> its site as it relates to the protection of children, including — where the Service is used
> by or in relation to a child — the reporting obligations of the Protection of Children from
> Sexual Offences Act 2012 (POCSO), the provisions of the Digital Personal Data Protection
> Act 2023 relating to the processing of children's personal data (s.9), and the requirements
> of the Information Technology Act 2000 relevant to user-generated content.
>
> **A.4 Verifiable parental consent.** The Client shall obtain verifiable parental consent for
> each user account designated as under-18, consistent with DPDP Act 2023 s.9 and Rules
> Rule 10, before activating that account. A record of consent (who consented, when, to which
> version of the notice) shall be retained by the Client for the duration of the account plus
> one (1) year.
>
> **A.5 Image generation disabled by default.** Image generation for user accounts designated
> as under-18 is disabled in the software by default. The Client shall not enable it for such
> accounts without satisfying itself — and confirming to the Service Provider in writing —
> that the applicable legal, moderation, and safeguarding requirements have been met at its
> site.
>
> **A.6 Reporting facility.** The Service Provider makes available a technical reporting
> facility ("Report a concern") within the Service. A report submitted through that facility
> is routed to:
> (a) the Client's designated safeguarding lead (per A.2); and
> (b) the Service Provider's safety contact (published in the Service).
>
> Receipt of a report by the Service Provider does not substitute for, or discharge, the
> Client's own obligation to act under applicable law, including the reporting duty under
> POCSO s.19.
>
> **A.7 POSH Act.** Where the Client is a school or an establishment to which the Sexual
> Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act 2013 applies,
> the Client warrants that it has constituted the required committee and that the existence of
> this Service does not affect those obligations.
>
> **A.8 Indemnity.** The Client shall indemnify and hold harmless the Service Provider from
> and against any claim, liability, cost, or expense arising from the Client's failure to
> comply with this Schedule.

---

## 12. Schedule B — Mandatory Multi-Signatory Execution, Zero Liability Acknowledgment & Unconditional Indemnity Page

> **IMPORTANT LEGAL DIRECTIVE:**
> THIS SCHEDULE CONSTITUTES A DEDICATED, SEPARATE SIGNATURE PAGE. IT MUST BE PRINTED, SIGNED
> BY AUTHORIZED SIGNATORIES, OFFICIALLY STAMPED/SEALED, AND ATTACHED AS AN INTEGRAL COVENANT TO THE
> MASTER SOFTWARE LICENCE AGREEMENT. EXECUTION OF THIS PAGE CONSTITUTES DIRECT AND IRREVOCABLE ASSUMPTION
> OF ALL LEGAL, OPERATIONAL, AND STATUTORY RESPONSIBILITIES BY THE CLIENT.

### PART I: BOLD B2B COVENANT & LIABILITY DISCLAIMER

**BY SIGNING BELOW, THE CLIENT / TENANT / SMB UNAMBIGUOUSLY ACKNOWLEDGES AND AGREES THAT:**

1. **PURE B2B ON-PREMISE / EDGE LICENCE:** THE SOFTWARE IS DELIVERED AS-IS ON A B2B COMMERCIAL BASIS. THE LICENSOR AND ITS BILLING AGENTS/PARTNERS (INCLUDING KUSHALKA TARA EDUCARE) DO NOT OWN, MANAGE, HOST, OR CONTROL THE CLIENT'S BARE-METAL/EDGE HARDWARE, CLIENT'S NETWORK, CLIENT'S USERS, CLIENT'S MINORS, OR CLIENT'S PERSISTED DATA.
2. **COMPLETE ZERO LIABILITY:** THE LICENSOR AND ITS AUTHORIZED BILLING PARTNERS BEAR **ABSOLUTELY ZERO LIABILITY** FOR ANY INTERRUPTION, DATA LOSS, REGULATORY ENQUIRY, HARDWARE DAMAGE, SYSTEM ANOMALY, INACCURATE MODEL OUTPUT, OR MISUSE OF THE SYSTEM BY ANY USER OR CHILD.
3. **FULL INDEMNIFICATION OF LICENSOR & BILLING AGENT:** THE CLIENT HEREBY FULLY, IRREVOCABLY, AND UNCONDITIONALLY INDEMNIFIES, DEFENDS, AND HOLDS FOREVER HARMLESS SATCHIDA (LICENSOR), ITS OPERATORS, AND KUSHALKA TARA EDUCARE (BILLING PARTNER) FROM ANY AND ALL COMPLAINTS, POLICE COMPLAINTS, POCSO/DPDP REGULATORY FINES, LITIGATION EXPENSES, COURT CLAIMS, ADVOCATE FEES, OR DEMANDS FILED BY PARENTS, RESIDENTS, EMPLOYEES, END USERS, ISPS, OR AUTHORITIES ARISING OUT OF THE CLIENT'S DEPLOYMENT AND USAGE.
4. **PARENT & TENANT OWNERSHIP:** ALL USAGE RULES, PARENTAL CONSENT VERIFICATION (DPDP §9), POCSO COMPLIANCE (§19), AND ACCESS PRIVILEGES ARE THE SOLE RESPONSIBILITY OF THE CLIENT AND THE ENROLLED PARENTS.

---

### PART II: MULTI-PARTY CLIENT SIGNATORIES & SEAL EXECUTION

*(Minimum of Two Designated Authorized Signatories Required for Educational Institutions / Housing Societies / SMBs, or Sole Proprietor / Managing Director for Enterprise)*

```text
====================================================================================================
FOR AND ON BEHALF OF THE CLIENT / TENANT:

Entity Name: ______________________________________________________________________________________
Registration / CIN / Society Reg No: ______________________________________________________________
Registered Office Address: ________________________________________________________________________

----------------------------------------------------------------------------------------------------
PRIMARY AUTHORIZED SIGNATORY                     SECONDARY AUTHORIZED SIGNATORY / WITNESS
(President / Secretary / Director / Principal)    (Treasurer / Joint Secretary / Head of IT / Trustee)

Signature: _____________________________________ Signature: _____________________________________

Full Name: ____________________________________  Full Name: ____________________________________

Designation: __________________________________  Designation: __________________________________

Contact Phone: ________________________________  Contact Phone: ________________________________

Official Email: _______________________________  Official Email: _______________________________

Date: _________________________________________  Date: _________________________________________


[ OFFICIAL ENTITY ROUND STAMP / CORPORATE SEAL ] [ OFFICIAL ENTITY ROUND STAMP / CORPORATE SEAL ]
________________________________________________ ________________________________________________
(Mandatory Impression)                           (Mandatory Impression)

====================================================================================================
FOR AND ON BEHALF OF SATCHIDA (LICENSOR):

Signature: _____________________________________ Date: _________________________________________
Operator Admin / Authorized Representative
====================================================================================================
```