---
name: indian-bare-act-research
description: Use when answering a question about Indian law, a statute, a section number, or a legal definition — grounds every answer in the official Bare Act PDFs in D:\Indian ACT and cites the Act, section and source, never reciting from memory.
when-to-use: Trigger for any query naming an Act (POCSO, BNS, BNSS, IT Act, DPDP, CPC, CrPC, Consumer Protection, Companies), asking "what does section X say", defining a legal term, or asking about procedure in India.
allowed-tools:
  - fetch_webpage
user-invocable: true
always-apply: false
---

# Indian Bare Act Research

Answer Indian legal questions from the primary source, not from recall.

## Corpus

`D:\Indian ACT` holds 165 official Government of India Bare Act PDFs from India Code /
the Legislative Department, plus `CATALOG_OF_ACTS.md` as the index.

Every answer must trace to a file in that directory. A section number you state without having
read the PDF is a guess, and section numbering is exactly the thing people get wrong.

## Method

1. **Identify the Act by name and year**, not by description. "The child protection law" is
   POCSO Act, 2012. "The new criminal law" is Bharatiya Nyaya Sanhita, 2023 (BNS). "The new
   criminal procedure law" is Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS). These replaced the
   Indian Penal Code and the Code of Criminal Procedure on 1 July 2024 — do not cite the old codes
   as current law for conduct after that date.
2. **Confirm the file exists** before relying on it:
   ```bash
   ls "/d/Indian ACT" | grep -i "<act name>"
   ```
   If the Act is not in the corpus, say so plainly rather than answering from memory.
3. **Extract the text** rather than paraphrasing from recollection:
   ```bash
   pdftotext -layout "/d/Indian ACT/POCSO Act 2012.pdf" - | grep -n -A 8 "19\. reporting"
   ```
   `pdftotext` is available in this environment. Use `-layout` for anything with a table or a
   numbered list.
4. **Quote the operative words** when the answer turns on a definition or a duty. A
   definitional answer is worth nothing without the defining text.

## Citation format

State the Act with its year and the section, then the source:

> POCSO Act 2012, s.2(d): *"'child' means any person below the age of eighteen years."*
> Source: `D:\Indian ACT\POCSO Act 2012.pdf`

## What this corpus does not contain

- **No commentary, case law, or procedural rules.** The PDFs are bare statutes. If asked what the
  courts have held, or what the practical procedure is, say that the corpus does not answer it.
- **No body text for some provisions.** Some files carry only the arrangement of sections. If a
  search returns a section heading with no text under it, the operative language is not in this
  copy. Report that gap — do not fill it from memory.
- **Amendments are not consolidated.** A PDF reflects its print date. Check the year in the title
  against the question's time period.

## Accuracy rules

- Never invent a section number. If the section cannot be found, say it cannot be found.
- "Section 19 of POCSO" is a reporting duty on *any person* with apprehension of an offence —
  not a role-specific obligation. Getting the *scope* wrong is as serious as getting the number
  wrong.
- This is research assistance, not legal advice. Say so once, briefly, when the user appears to be
  deciding a real course of action.