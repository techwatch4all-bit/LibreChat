#!/usr/bin/env node
/**
 * Educational corpus ingestion — Wikipedia / Wikibooks via the official MediaWiki API.
 *
 * WHY THIS EXISTS
 * ---------------
 * Part VII §2 identifies the licence-clean sources. This implements the one that
 * is unambiguously automatable today: Wikimedia's MediaWiki API is public,
 * documented, and explicitly permits commercial reuse with attribution.
 *
 * OpenStax is deliberately NOT scripted here. Its site is an SPA with no public
 * JSON endpoint (verified: /apps/api/v2/* returns the HTML shell; the asset CDN
 * requires exact object paths that are not discoverable from the shell). Guessing
 * paths and hammering them would be both fragile and rude. OpenStax is ingested
 * by an operator-supplied URL list instead — see --from-file.
 *
 * LICENCE — CC-BY-SA 4.0. Commercial reuse is permitted; attribution is
 * required and share-alike applies to derivative adaptations. Nothing here
 * redistributes the source: text is pulled, chunked and stored as a private
 * retrieval index for one tenant. Every chunk carries its licence and source URL
 * so a withdrawn page can be identified and purged.
 *
 * The NC sources (MIT OpenCourseWare, LibreTexts) are rejected by design —
 * see ARCHITECTURE.md Part VII §2. There is no flag to enable them.
 *
 * Usage:
 *   node scripts/ingest-educational-corpus.mjs --subject "Mathematics" --limit 5
 *   node scripts/ingest-educational-corpus.mjs --curriculum --dry-run
 *   node scripts/ingest-educational-corpus.mjs --from-file urls.txt
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';

config();

const API = 'https://en.wikipedia.org/w/api.php';
const WIKIBOOKS_API = 'https://en.wikibooks.org/w/api.php';
const USER_AGENT = 'Satchida-EducationalCorpus/1.0 (private RAG ingest; contact: operator)';

const LICENSE = 'CC-BY-SA-4.0';
const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

const DRY_RUN = process.argv.includes('--dry-run');
const FROM_FILE = process.argv.includes('--from-file');

/**
 * Grade band -> Wikimedia categories. Categories are the only structured
 * enumeration MediaWiki offers, and they map well enough to a curriculum.
 * Kept explicit rather than generated so a wrong guess is visible in review.
 */
const CURRICULUM = [
  {
    gradeBand: 'upper-secondary',
    subject: 'Mathematics',
    categories: ['Category:Mathematics', 'Category:Calculus', 'Category:Algebra', 'Category:Geometry'],
  },
  {
    gradeBand: 'upper-secondary',
    subject: 'Physics',
    categories: ['Category:Physics', 'Category:Mechanics', 'Category:Thermodynamics', 'Category:Optics'],
  },
  {
    gradeBand: 'upper-secondary',
    subject: 'Chemistry',
    categories: ['Category:Chemistry', 'Category:Organic_chemistry', 'Category:Inorganic_chemistry'],
  },
  {
    gradeBand: 'upper-secondary',
    subject: 'Biology',
    categories: ['Category:Biology', 'Category:Botany', 'Category:Zoology', 'Category:Genetics'],
  },
  {
    gradeBand: 'senior-secondary',
    subject: 'Computer science',
    categories: ['Category:Computer_science', 'Category:Algorithms', 'Category:Data_structures'],
  },
  {
    gradeBand: 'senior-secondary',
    subject: 'Statistics',
    categories: ['Category:Statistics'],
  },
  {
    gradeBand: 'vocational',
    subject: 'Accounting',
    categories: ['Category:Accounting'],
  },
  {
    gradeBand: 'vocational',
    subject: 'Mechanical engineering',
    categories: ['Category:Mechanical_engineering'],
  },
  {
    gradeBand: 'vocational',
    subject: 'Agriculture',
    categories: ['Category:Agriculture'],
  },
  {
    gradeBand: 'primary',
    subject: 'English',
    categories: ['Category:English_language'],
  },
];

/** NC sources. Present so a future edit that adds one fails loudly. */
const FORBIDDEN_SOURCES = ['opencourseware.mit.edu', 'libretexts.org'];

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/**
 * Minimum milliseconds between requests to a given API host.
 *
 * Wikimedia rate-limits anonymous clients hard (observed: HTTP 429 within three
 * rapid calls during development). Their guidance is sequential requests with a
 * descriptive User-Agent, which this does. Batching the API's `titles=` parameter
 * — 50 titles per call — is the real throughput win; the delay only paces those.
 */
const REQUEST_DELAY_MS = Number(argValue('--delay-ms', '250'));
const lastRequestAt = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(host, params) {
  const url = new URL(host);
  for (const [k, v] of Object.entries({ format: 'json', formatversion: '2', ...params })) {
    url.searchParams.set(k, String(v));
  }

  const previous = lastRequestAt.get(host) ?? 0;
  const wait = previous + REQUEST_DELAY_MS - Date.now();
  if (wait > 0) {
    await sleep(wait);
  }

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  lastRequestAt.set(host, Date.now());

  if (response.status === 429) {
    /* Back off rather than fail. Wikimedia returns Retry-After on throttle. */
    const retryAfter = Number(response.headers.get('retry-after') ?? '5');
    await sleep(Math.max(retryAfter, 2) * 1000);
    return api(host, params);
  }
  if (!response.ok) {
    throw new Error(`${host} -> HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.error) {
    throw new Error(`${host} -> ${payload.error.code}: ${payload.error.info}`);
  }
  return payload;
}

/** Page titles directly in a category (one level, non-subcategory). */
async function categoryMembers(category, limit) {
  const payload = await api(API, {
    action: 'query',
    list: 'categorymembers',
    cmtitle: category,
    cmlimit: limit,
    cmtype: 'page',
  });
  return (payload.query?.categorymembers ?? []).map((m) => m.title);
}

/**
 * Fetch the FULL plain-text extract of one page.
 *
 * WHY ONE PAGE PER REQUEST
 * ------------------------
 * MediaWiki's `exlimit` documentation: "Multiple extracts can only be returned
 * if `exintro` is set to true." Batching 50 titles with `exlimit=max` therefore
 * returns an extract for exactly ONE page and empty strings for the rest —
 * observed during development: 1 of 6 titles came back populated. Setting
 * `exintro=1` would batch, but returns only the lead section, which is useless
 * for retrieval — a RAG built on intros retrieves introductions.
 *
 * So full text means one request per page. The 250 ms delay and 429 backoff in
 * `api()` keep that polite, and a full category harvest is a background job.
 *
 * @returns {{ extract: string, pageId: number, title: string } | null}
 */
async function fetchExtract(title, host = API) {
  const payload = await api(host, {
    action: 'query',
    titles: title,
    prop: 'extracts|info',
    explaintext: 1,
    redirects: 1,
  });
  const page = (payload.query?.pages ?? [])[0];
  if (!page || page.missing !== undefined || !page.extract) {
    return null;
  }
  return { extract: page.extract, pageId: page.pageid, title: page.title };
}

function urlFor(host, title) {
  const project = host.includes('wikibooks') ? 'wikibooks' : 'wiki';
  return `https://en.${project}.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

async function* harvest({ subject, limit, gradeBand, useWikibooks }) {
  const host = useWikibooks ? WIKIBOOKS_API : API;
  const groups = subject
    ? [{ gradeBand: gradeBand ?? 'unspecified', subject, categories: [`Category:${subject.replace(/ /g, '_')}`] }]
    : CURRICULUM;

  for (const group of groups) {
    for (const category of group.categories) {
      let titles = [];
      try {
        titles = await categoryMembers(category, limit);
      } catch (error) {
        console.warn(`  ! ${category}: ${error.message}`);
        continue;
      }
      for (const title of titles) {
        yield { category, title, gradeBand: group.gradeBand, subject: group.subject, host };
      }
    }
  }
}

async function main() {
  const ragUrl = process.env.RAG_API_URL ?? 'http://127.0.0.1:8010';
  const limit = Number(argValue('--limit', '5'));
  const token = process.env.SATCHIDA_RAG_TOKEN;

  let targets = [];

  if (FROM_FILE) {
    /* Operator-supplied URL list. This is how OpenStax enters: we do not guess
       asset paths or scrape the SPA. */
    const file = argValue('--from-file', 'urls.txt');
    targets = fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((line) => {
        const [source, ...rest] = line.split(/\s+/);
        return {
          title: rest.join(' ') || source,
          category: 'operator-supplied',
          gradeBand: argValue('--grade-band', 'unspecified'),
          subject: argValue('--subject', 'unspecified'),
          sourceUrl: source,
        };
      });
    const blocked = targets.filter((t) =>
      FORBIDDEN_SOURCES.some((f) => (t.sourceUrl ?? '').includes(f)),
    );
    if (blocked.length) {
      throw new Error(
        `Refusing ${blocked.length} non-commercial source(s): ${FORBIDDEN_SOURCES.join(', ')}. See ARCHITECTURE.md Part VII §2.`,
      );
    }
  } else {
    const subject = argValue('--subject', null);
    const useWikibooks = process.argv.includes('--wikibooks');
    for await (const item of harvest({
      subject,
      limit,
      gradeBand: argValue('--grade-band', null),
      useWikibooks,
    })) {
      targets.push(item);
    }
  }

  console.log(`targets: ${targets.length}`);
  console.log(`rag service: ${ragUrl}`);
  console.log(`licence: ${LICENSE}`);

  if (DRY_RUN) {
    for (const t of targets.slice(0, 20)) {
      console.log(`  [${t.gradeBand}/${t.subject}] ${t.title}`);
    }
    console.log(`\n(dry run — nothing ingested)`);
    return;
  }

  if (!token) {
    console.error(
      'SATCHIDA_RAG_TOKEN is required to authenticate against the RAG service.\n' +
        'Mint one with: node -e "..." (see rag-service/src/auth.mjs). Never printed, never stored.',
    );
    process.exit(1);
  }

  let ingested = 0;
  let skipped = 0;
  const failures = [];

  /* Group by API host so each host is fetched in one batched pass. */
  const byHost = new Map();
  for (const target of targets) {
    const key = target.host ?? API;
    if (!byHost.has(key)) byHost.set(key, []);
    byHost.get(key).push(target);
  }

  for (const [host, group] of byHost) {
    for (const target of group) {
      let record = null;
      try {
        record = await fetchExtract(target.title, host);
      } catch (error) {
        failures.push({ title: target.title, error: error.message });
        console.warn(`  FAIL ${target.title}: ${error.message}`);
        continue;
      }
      if (!record || record.extract.trim().length < 200) {
        skipped += 1;
        continue;
      }
      const text = record.extract;
      const info = { pageId: record.pageId, title: record.title };

      try {
        const sourceUrl = target.sourceUrl ?? urlFor(host, info.title);

      /* Provenance travels with the document so a licence change or a withdrawn
         page is traceable to exactly what must be purged. */
      const fileId = `edu-${(info?.pageId ?? target.title).toString().replace(/\W+/g, '-')}`;
      const header = [
        `# ${info?.title ?? target.title}`,
        '',
        `- Subject: ${target.subject}`,
        `- Grade band: ${target.gradeBand}`,
        `- Category: ${target.category}`,
        `- Source: ${sourceUrl}`,
        `- Licence: ${LICENSE} (${LICENSE_URL})`,
        '',
        '---',
        '',
      ].join('\n');

      /*
       * The RAG service accepts multipart/form-data with `file_id` and `file`
       * (rag-service/src/routes.mjs readUpload). Posting raw text returns 501/502
       * because there is no multipart body to parse. Provenance travels inside
       * the document body rather than as a separate field the service does not
       * model, so a stored chunk always carries its licence with it.
       */
      const form = new FormData();
      form.append('file_id', fileId);
      form.append(
        'file',
        new Blob([header + text], { type: 'text/plain' }),
        `${(info?.title ?? target.title).replace(/[^\w.-]+/g, '_')}.txt`,
      );

      const response = await fetch(`${ragUrl}/text`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!response.ok) {
        throw new Error(`rag /text HTTP ${response.status}`);
      }
      const result = await response.json();
      ingested += 1;
      console.log(`  OK   ${target.subject.padEnd(22)} ${target.title.slice(0, 46)} -> ${result.chunks ?? '?'} chunks`);
      } catch (error) {
        failures.push({ title: target.title, error: error.message });
        console.warn(`  FAIL ${target.title}: ${error.message}`);
      }
    }
  }

  console.log(`\ningested ${ingested}, skipped ${skipped}, failed ${failures.length}`);
  if (failures.length) {
    console.log('failures:');
    for (const f of failures.slice(0, 10)) console.log(`  ${f.title}: ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
