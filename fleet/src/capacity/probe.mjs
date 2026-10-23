#!/usr/bin/env node
/**
 * Satchida tenant capacity probe.
 *
 * Measures a tenant PC's actual inference capacity and derives the fair-use
 * thresholds from it, rather than assuming a vendor table. Implements spec
 * section 5.1.
 *
 * Usage:
 *   node fleet/src/capacity/probe.mjs \
 *     --endpoint http://127.0.0.1:61075 \
 *     --model Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0 \
 *     --gguf  D:\path\to\model.gguf \
 *     [--kv-type q4_0] [--tenant-id tnt_x] [--ctx 16384] [--out report.json]
 *
 * Emits spec section 5.3. Contains no prompt content and no PII.
 */

import { writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readGgufGeometry, kvBytesPerToken, GgufError } from './gguf.mjs';
import { solveCapacity, gpuSecondsToTokens, DEFAULT_TARGET_PER_SEAT_TPS } from './model.mjs';

const execFileAsync = promisify(execFile);

const DEFAULT_ENDPOINT = 'http://127.0.0.1:8080';
const CONCURRENCY_POINTS = [1, 2, 4, 8];
const DECODE_TOKENS = 256;
const PREFILL_TARGET_TOKENS = 30000;
const REQUEST_TIMEOUT_MS = 600000;

/** Roughly 4.5 characters per token for English prose in llama.cpp tokenizers. */
const CHARS_PER_TOKEN = 4.5;

function parseArgs(argv) {
  const args = {
    endpoint: DEFAULT_ENDPOINT,
    model: null,
    gguf: null,
    kvType: 'q4_0',
    tenantId: null,
    ctx: 16384,
    out: null,
    concurrency: CONCURRENCY_POINTS,
    skipLoad: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`${flag} requires a value`);
      return argv[i];
    };
    switch (flag) {
      case '--endpoint': args.endpoint = next(); break;
      case '--model': args.model = next(); break;
      case '--gguf': args.gguf = next(); break;
      case '--kv-type': args.kvType = next(); break;
      case '--tenant-id': args.tenantId = next(); break;
      case '--ctx': args.ctx = Number(next()); break;
      case '--out': args.out = next(); break;
      case '--concurrency': args.concurrency = next().split(',').map(Number); break;
      case '--skip-load': args.skipLoad = true; break;
      case '--help': case '-h': args.help = true; break;
      default:
        throw new Error(`unknown flag ${flag}`);
    }
  }
  return args;
}

function usage() {
  return [
    'satchida-capacity-probe',
    '',
    '  --endpoint <url>     llama.cpp base URL (default ' + DEFAULT_ENDPOINT + ')',
    '  --model <id>         model id or alias as served by the endpoint',
    '  --gguf <path>        path to the GGUF file, for KV geometry',
    '  --kv-type <dtype>    KV cache dtype actually in use (default q4_0)',
    '  --tenant-id <id>     tenant identifier recorded in the report',
    '  --ctx <tokens>       nominal context per session (default 16384)',
    '  --concurrency <list> comma-separated points (default ' + CONCURRENCY_POINTS.join(',') + ')',
    '  --skip-load          geometry and VRAM only, no generation',
    '  --out <path>         write the JSON report here instead of stdout',
  ].join('\n');
}

/** VRAM total in bytes, via nvidia-smi. Throws when no NVIDIA GPU is present. */
export async function readVram() {
  let stdout;
  try {
    ({ stdout } = await execFileAsync('nvidia-smi', [
      '--query-gpu=name,memory.total,driver_version',
      '--format=csv,noheader,nounits',
    ], { timeout: 30000 }));
  } catch (error) {
    throw new Error(`cannot read GPU via nvidia-smi: ${error.message}`);
  }
  const line = String(stdout).trim().split('\n')[0];
  if (!line) throw new Error('nvidia-smi returned no GPU rows');
  const [name, totalMiB, driver] = line.split(',').map((part) => part.trim());
  const total = Number(totalMiB);
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error(`nvidia-smi reported an unusable memory.total: ${JSON.stringify(totalMiB)}`);
  }
  return { name, vram_total_bytes: Math.round(total * 1024 * 1024), vram_total_mib: total, driver_version: driver || null };
}

async function postJson(url, body, timeoutMs = REQUEST_TIMEOUT_MS) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${response.status} from ${url}: ${text.slice(0, 200)}`);
  }
  return response.json();
}

/** Synthetic filler used to build a known-size prompt. No user content is sent. */
function fillerPrompt(targetTokens, salt = '') {
  const unit = 'The quick brown fox jumps over the lazy dog. ';
  const repeats = Math.max(1, Math.ceil((targetTokens * CHARS_PER_TOKEN) / unit.length));
  return `${unit.repeat(repeats)}\n\nReply with the single word: ok. ${salt}`;
}

/**
 * Prefill rate, measured cold at a large context.
 *
 * The 10k-token rate measured earlier (19,391 tok/s) was a small-context kernel
 * efficiency artefact. 30k is the honest sustained figure, so that is what the
 * cost model uses.
 */
export async function measurePrefill(endpoint, model) {
  const prompt = fillerPrompt(PREFILL_TARGET_TOKENS);
  const started = process.hrtime.bigint();
  const result = await postJson(`${endpoint}/v1/chat/completions`, {
    model, messages: [{ role: 'user', content: prompt }], max_tokens: 16, stream: false, temperature: 0,
  });
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  const promptTokens = result?.usage?.prompt_tokens ?? 0;
  if (seconds <= 0 || promptTokens <= 0) return { prefill_tps: 0, prompt_tokens: promptTokens, seconds };
  return { prefill_tps: promptTokens / seconds, prompt_tokens: promptTokens, seconds: Number(seconds.toFixed(3)) };
}

/**
 * Decode rate at each concurrency point.
 *
 * Requests are genuinely simultaneous: they are all dispatched before any is
 * awaited. Sequentially awaiting them would measure single-stream speed repeatedly
 * and never observe the batching behaviour that decides how many seats a machine
 * can actually serve.
 */
export async function measureDecodeSweep(endpoint, model, points) {
  const prompt = fillerPrompt(2200);
  const body = JSON.stringify({
    model, messages: [{ role: 'user', content: `${prompt}\n\nExplain how a hardware write barrier works.` }],
    max_tokens: DECODE_TOKENS, stream: false, temperature: 0,
  });

  const perSeat = {};
  const aggregate = {};
  const errors = {};

  for (const n of points) {
    const started = process.hrtime.bigint();
    let responses;
    try {
      responses = await Promise.all(Array.from({ length: n }, () => fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })));
    } catch (error) {
      errors[String(n)] = error.message;
      continue;
    }
    const seconds = Number(process.hrtime.bigint() - started) / 1e9;

    let totalCompletion = 0;
    let ok = 0;
    for (const response of responses) {
      if (!response.ok) continue;
      const json = await response.json().catch(() => null);
      const completion = json?.usage?.completion_tokens ?? 0;
      if (completion > 0) {
        totalCompletion += completion;
        ok += 1;
      }
    }
    if (ok === 0 || seconds <= 0) {
      errors[String(n)] = 'no completions returned';
      continue;
    }
    perSeat[String(n)] = Number((totalCompletion / ok / seconds).toFixed(1));
    aggregate[String(n)] = Number((totalCompletion / seconds).toFixed(1));
    process.stderr.write(`  concurrency ${n}: ${aggregate[String(n)]} tok/s aggregate, ${perSeat[String(n)]} per seat\n`);
  }

  return { perSeat, aggregate, errors };
}

/**
 * Confirm prefix cache reuse is active.
 *
 * The whole cost model rests on cached input being cheap. Without it a long-context
 * user costs roughly what a short one does, and the tier thresholds in the spec are
 * wrong. A machine that fails this check is reported unverified rather than
 * silently mis-modelled.
 */
export async function verifyCacheReuse(endpoint, model) {
  const base = fillerPrompt(15000);
  const first = await postJson(`${endpoint}/v1/chat/completions`, {
    model, messages: [{ role: 'user', content: `${base}\n\nQ1` }], max_tokens: 8, stream: false, temperature: 0,
  });
  const second = await postJson(`${endpoint}/v1/chat/completions`, {
    model, messages: [{ role: 'user', content: `${base}\n\nQ2` }], max_tokens: 8, stream: false, temperature: 0,
  });
  const cachedFirst = first?.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  const cachedSecond = second?.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  return {
    cache_reuse_ok: cachedSecond > cachedFirst,
    first_cached_tokens: cachedFirst,
    second_cached_tokens: cachedSecond,
  };
}

export async function runProbe(options) {
  const report = {
    schema: 'satchida.capacity.probe.v1',
    tenant_id: options.tenantId,
    collected_at: Math.floor(Date.now() / 1000),
    gpu: null,
    model: null,
    runtime: {
      endpoint: options.endpoint,
      model_alias: options.model,
      kv_type: options.kvType,
      nominal_ctx_tokens: options.ctx,
    },
    throughput: { prefill_tps: 0, per_seat_tps: {}, aggregate_tps: {} },
    cache: null,
    derived: null,
    warnings: [],
  };

  report.gpu = await readVram();

  if (options.gguf) {
    const geometry = await readGgufGeometry(options.gguf);
    const kv = kvBytesPerToken(geometry, options.kvType);
    report.model = {
      id: options.model,
      path: options.gguf,
      architecture: geometry.architecture,
      block_count: geometry.block_count,
      head_count_kv: geometry.head_count_kv,
      head_dim: geometry.key_length,
      weights_bytes: geometry.file_size_bytes,
      kv_bytes_per_token: Math.round(kv.bytes_per_token),
      kv_dtype_bits: kv.bits,
    };
  } else {
    report.warnings.push('no --gguf supplied: KV geometry unknown, memory limit cannot be computed');
  }

  if (options.skipLoad) {
    report.warnings.push('--skip-load: throughput not measured, report is geometry only');
    return report;
  }

  process.stderr.write('measuring prefill...\n');
  try {
    const prefill = await measurePrefill(options.endpoint, options.model);
    report.throughput.prefill_tps = Number(prefill.prefill_tps.toFixed(0));
    report.throughput.prefill_detail = prefill;
  } catch (error) {
    report.warnings.push(`prefill measurement failed: ${error.message}`);
  }

  process.stderr.write(`measuring decode at concurrency ${options.concurrency.join(',')}...\n`);
  try {
    const sweep = await measureDecodeSweep(options.endpoint, options.model, options.concurrency);
    report.throughput.per_seat_tps = sweep.perSeat;
    report.throughput.aggregate_tps = sweep.aggregate;
    if (Object.keys(sweep.errors).length) report.warnings.push(`decode sweep errors: ${JSON.stringify(sweep.errors)}`);
  } catch (error) {
    report.warnings.push(`decode sweep failed: ${error.message}`);
  }

  process.stderr.write('checking prefix cache reuse...\n');
  try {
    report.cache = await verifyCacheReuse(options.endpoint, options.model);
    if (!report.cache.cache_reuse_ok) {
      report.warnings.push('prefix cache reuse is not active: fair-use thresholds will not be valid');
    }
  } catch (error) {
    report.warnings.push(`cache check failed: ${error.message}`);
  }

  if (report.model && Object.keys(report.throughput.per_seat_tps).length) {
    report.derived = solveCapacity({
      vramTotalBytes: report.gpu.vram_total_bytes,
      weightsBytes: report.model.weights_bytes,
      kvBytesPerToken: report.model.kv_bytes_per_token,
      ctxTokens: options.ctx,
      perSeatTpsByConcurrency: report.throughput.per_seat_tps,
      targetPerSeatTps: DEFAULT_TARGET_PER_SEAT_TPS,
    });
    const example = gpuSecondsToTokens(3600 / Math.max(report.derived.c_served, 1), {
      prefillTps: report.throughput.prefill_tps || 1,
      decodeTps: Math.max(...Object.values(report.throughput.aggregate_tps || { 1: 1 })),
    });
    report.derived.example_serious_allowance = example;
  } else {
    report.warnings.push('insufficient measurements to derive capacity');
  }

  return report;
}

const isMain = process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMain) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${usage()}\n`);
    process.exit(2);
  }
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    process.exit(0);
  }
  try {
    const report = await runProbe(options);
    const json = `${JSON.stringify(report, null, 2)}\n`;
    if (options.out) {
      await writeFile(options.out, json, 'utf8');
      process.stderr.write(`report written to ${options.out}\n`);
    } else {
      process.stdout.write(json);
    }
  } catch (error) {
    const kind = error instanceof GgufError ? 'gguf' : 'probe';
    process.stderr.write(`${kind} error: ${error.message}\n`);
    process.exit(1);
  }
}