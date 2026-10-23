#!/usr/bin/env node
/**
 * Satchida child-safety gate — UserPromptSubmit.
 *
 * This is a NARROW gate, and narrow on purpose. Satchida's own product depends
 * on being able to discuss POCSO, DPDP, safeguarding policy and school
 * compliance — that discussion is the legal research feature, not an abuse.
 * A keyword blocklist that fires on the word "child" would break the product.
 *
 * So this blocks exactly one thing: a request whose stated intent is sexual
 * content involving a minor. It does not fire on law, policy, safeguarding,
 * incident reporting, moderation or research.
 *
 * It is a backstop, not the primary control. Real enforcement is layered:
 * provider-side filters, ShieldGemma moderation, and the recorded parental
 * consent gate on image generation for under-18 accounts.
 *
 * Contract: exit 2 + stderr blocks the submission with that reason.
 */

import fs from 'node:fs';

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

const payload = readStdin();
const prompt = String(payload.prompt ?? '').toLowerCase();

if (prompt.length === 0) {
  process.stdout.write('{}');
  process.exit(0);
}

/**
 * Two conditions must both hold: a sexual-content term AND an indication that
 * a minor is involved. Requiring both is what keeps legal and safeguarding
 * discussion working.
 */
const SEXUAL = [
  'sexual',
  'sexually',
  'erotic',
  'pornograph',
  'porno',
  'nsfw',
  'explicit sex',
  'sexualised',
  'sexualized',
  'undress',
  'nude',
  'naked',
];

const MINOR = [
  'child',
  'children',
  'minor',
  'minors',
  'underage',
  'under 18',
  'under-18',
  'u18',
  'teen',
  'teenager',
  'toddler',
  'infant',
  'preteen',
  'schoolgirl',
  'schoolboy',
  'loli',
  'shota',
  'cp',
];

const hasSexual = SEXUAL.some((term) => prompt.includes(term));
const hasMinor = MINOR.some((term) => prompt.includes(term));

if (hasSexual && hasMinor) {
  process.stderr.write(
    "I can't help with that. This request pairs sexual content with minors, and that's an absolute limit regardless of how the request is framed — fictional, hypothetical, or hypothetical framing doesn't change it.\n\nIf you're doing legitimate work here — POCSO compliance, DPDP child-data policy, safeguarding procedure, content moderation, or incident reporting — tell me which and I'll help properly. Those are core to what this platform is for.",
  );
  process.exit(2);
}

process.stdout.write('{}');
process.exit(0);