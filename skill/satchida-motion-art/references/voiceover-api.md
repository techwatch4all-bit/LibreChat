# Volcengine Doubao voice cloning 2.0 · interface details and field notes

Historical interface notes from 2026-09-13; the query section updated 2026-09-18. New users configure first per capabilities.md; service limits are whatever the live response says at call time. Official docs: Volcengine docs center, "Doubao Speech" library (LibraryID 6561).

## Auth

Legacy console (APP ID + Access Token):

```
X-Api-App-Id:      {APPID}
X-Api-Access-Key:  {Access Token}
X-Api-Resource-Id: volc.megatts.voiceclone   # train / query
                   seed-icl-2.0              # synthesis
X-Api-Request-Id:  {uuid}
Content-Type:      application/json
```

The new console uses `X-Api-Key` (from API Key management). Officially, the legacy scheme will be phased out gradually.

## Three endpoints

| Purpose | Path |
|---|---|
| Train a voice | `POST /api/v3/tts/voice_clone` |
| Query status | `POST /api/v3/tts/get_voice` |
| Synthesize | `POST /api/v3/tts/unidirectional` (HTTP chunked streaming) |

Host is always `https://openspeech.bytedance.com`.

### Training

```json
{
  "speaker_id": "S_xxxxxxxx",
  "audio": { "data": "<base64>", "format": "wav" },
  "source": 2,
  "language": 0,
  "model_type": 5
}
```

- **`model_type: 5` is cloning 2.0.** Omitting it or passing another value trains 1.0.
- **The request body is a single `audio` object, not an `audios` array.** The v1 interface used an array; v3 changed —
  sending an array errors with `45000000 add unmapped key audios`.
- Optional: `text` (the reference audio's transcript; the server runs WER and returns `45001109` when it diverges too much),
  `enable_audio_denoise` (denoising, costs similarity),
  `disable_volume_normalization` (disable volume normalization; synthesized volume stays closer to the reference).
- Returned `status`: 0 NotFound / 1 Training / 2 Success / 3 Failed / 4 Active.
  **Both 2 and 4 can synthesize directly.**
- The response's `speaker_status` is an array containing both 1.0 and 2.0 entries;
  the `model_type: 5` entry is 2.0, each carrying a one-hour `demo_audio` audition link.

### Query (field-tested 2026-09-18)

v3 `get_voice` takes the singular body `{"speaker_id":"S_xxxxxxxx"}`, not a `speaker_ids` array. Query slots one by one, and HTTP errors must be raised explicitly — never treated as "voice does not exist". `koubo.py voices` was fixed accordingly.

### Synthesis

```json
{
  "user": { "uid": "koubo" },
  "req_params": {
    "text": "...",
    "speaker": "S_xxxxxxxx",
    "model": "seed-tts-2.0-expressive",
    "tone_fidelity": true,
    "audio_params": { "format": "wav", "sample_rate": 48000, "speech_rate": -20 }
  }
}
```

The response is streamed, one JSON per line, audio arriving base64-chunked in the `data` field; concatenate for the complete file.

## Two counter-intuitive parameter placements

1. **`speech_rate` must go inside `audio_params`.** At the `req_params` top level it is **silently ignored** —
   no error, HTTP 200, normal audio, but the speech rate never moves.
   Field test: `audio_params.speech_rate = -50` took the same sentence from 10.36s to 21.53s (exactly 2×).
   Range `[-50, 100]`, default 0, 100 = 2.0× speed, -50 = 0.5× speed, linear.
   Also silently ignored: `speed_ratio` (at any layer) — that is a different product line's parameter name.

2. **`tone_fidelity` goes at the `req_params` top level**, not inside `audio_params`. Effective only for 2.0 voices.

## Sample rates

`sample_rate` supports `[8000, 16000, 22050, 24000, 32000, 44100, 48000]`, **default only 24000**.
When pasting back into a 48k edit project, pass 48000 explicitly or it sounds muffled.
`ogg_opus` supports only 48000. For streaming, the official recommendation is pcm, not wav.

## Other limits

- The reference-audio **10MB cap counts the raw file, not base64** (a 9.16MB wav passed in the field test).
  Supported: wav / mp3 / ogg / m4a / aac / pcm; pcm is 24k mono only.
- Synthesis text should stay under ~300 characters per call (about 60 seconds of audio); split long texts yourself and stitch.
- Each voice slot allows 15 training runs, and may be re-trained repeatedly.
- The "voice upgrade" endpoint (`/api/v3/tts/upgrade_voice`) only migrates V1→V3 —
  **it cannot append reference audio to an existing voice**. To change reference audio, retrain the same slot.

## Common error codes

| Code | Meaning | What to do |
|---|---|---|
| `45000000` | request body field wrong | look for the unmapped key in the message |
| `45001122` | `no speaker detected` | no human voice in the reference audio. Check mean level first; below -36dB it is mostly noise floor |
| `45001109` | `WERError` | the `text` you sent does not match the audio; drop text or fix it |
| `45000030` | `resource not granted` | the service behind this Resource-Id is not enabled |

## Network

`openspeech.bytedance.com` is a mainland-China endpoint. If the machine runs a SOCKS proxy,
**passing `proxies=None` to requests is not enough** — it still reads `ALL_PROXY` from the environment,
manifesting as intermittent `SSL: UNEXPECTED_EOF_WHILE_READING`.
Affected environments can set `bindings.volcengine.trust_env=false`; the default follows the environment proxy and is not forced off for all users.

## On "how long should the reference audio be"

In past listening tests, a longer clean narration reference resembled the original voice better than thirty seconds. That is one voice's experience, not a universal default for all voices; trust the user's own sample auditions and the service's current limits.

One graded duration test was run on this side (nested sampling at 15/30/60/120/200/400 seconds, 3 syntheses per grade),
comparing fundamental-frequency median and spectral centroid against the real voice; per-grade differences (1.7%~8.5%) and the
standard deviations across three runs of the same grade (1.7~9.5) were the same order of magnitude — **on these two metrics the grades are indistinguishable**.

But that is not a rebuttal — those two metrics cover only pitch and brightness,
**not at all prosody, pauses, breaths, or tone**, which are precisely the main ingredients of "sounds like the person".
Metrics finding no difference is not evidence of no difference. Trust your ears.
