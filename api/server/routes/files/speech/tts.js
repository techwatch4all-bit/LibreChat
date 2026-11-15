const multer = require('multer');
const express = require('express');
const {
  inspectContent,
  extractStoredMessageContent,
  contentFilterBlockResponse,
  restoreTenantContextFromReq,
} = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const { CacheKeys, hasActivePiiFields } = require('librechat-data-provider');
const { getVoices, streamAudio, textToSpeech } = require('~/server/services/Files/Audio');
const { getLogStores } = require('~/cache');

const router = express.Router();
const upload = multer();

router.post(
  '/manual',
  upload.none(),
  restoreTenantContextFromReq,
  (req, res, next) => {
    const filters = req.config?.filters;
    if (!hasActivePiiFields(filters?.messages?.pii, ['text'])) {
      next();
      return;
    }

    const finding = inspectContent(extractStoredMessageContent({ text: req.body?.input }), {
      filters,
    });
    if (finding == null) {
      next();
      return;
    }

    res.status(400).json(contentFilterBlockResponse(finding));
  },
  async (req, res) => {
    await textToSpeech(req, res);
  },
);

const logDebugMessage = (req, message) =>
  logger.debug(`[streamAudio] user: ${req?.user?.id ?? 'UNDEFINED_USER'} | ${message}`);

// TODO: test caching
router.post('/', async (req, res) => {
  try {
    const audioRunsCache = getLogStores(CacheKeys.AUDIO_RUNS);
    const audioRun = await audioRunsCache.get(req.body.runId);
    logDebugMessage(req, 'start stream audio');
    if (audioRun) {
      logDebugMessage(req, 'stream audio already running');
      return res.status(401).json({ error: 'Audio stream already running' });
    }
    audioRunsCache.set(req.body.runId, true);
    await streamAudio(req, res);
    logDebugMessage(req, 'end stream audio');
    res.status(200).end();
  } catch (error) {
    logger.error(`[streamAudio] user: ${req.user.id} | Failed to stream audio: ${error}`);
    res.status(500).json({ error: 'Failed to stream audio' });
  }
});

router.get('/voices', async (req, res) => {
  await getVoices(req, res);
});

router.post('/explain', express.json(), async (req, res) => {
  try {
    const { query = '', response = '' } = req.body || {};
    const promptText = `You are a warm, clear, engaging master teacher explaining a topic to a student.
Summarize the core essence of the question and the explanation in 2 to 3 conversational spoken sentences.
Start naturally with something like: "You asked about [topic]..." and explain the core insight clearly as if speaking in person.
DO NOT use bullet points, emoji names, markdown formatting, filenames, checklists, or robotic phrasing.

Student Question: "${query}"
Detailed Content:
${response.slice(0, 3000)}`;

    const http = require('http');
    const payload = JSON.stringify({
      model: 'Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0',
      messages: [
        { role: 'system', content: 'You are a warm, human master tutor speaking directly to your student.' },
        { role: 'user', content: promptText }
      ],
      max_tokens: 180,
      temperature: 0.5
    });

    const llmReq = http.request({
      hostname: '127.0.0.1',
      port: 8080,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (llmRes) => {
      let body = '';
      llmRes.on('data', chunk => body += chunk);
      llmRes.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const speech = parsed.choices?.[0]?.message?.content?.trim() || '';
          res.json({ ok: true, explanation: speech });
        } catch (e) {
          res.status(500).json({ ok: false, error: 'Failed to parse LLM response' });
        }
      });
    });

    llmReq.on('error', (err) => {
      logger.error('Explain LLM request error:', err);
      res.status(500).json({ ok: false, error: err.message });
    });

    llmReq.setTimeout(8000, () => {
      llmReq.destroy();
      res.status(504).json({ ok: false, error: 'Explain LLM timeout' });
    });

    llmReq.write(payload);
    llmReq.end();
  } catch (err) {
    logger.error('TTS explain route error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
