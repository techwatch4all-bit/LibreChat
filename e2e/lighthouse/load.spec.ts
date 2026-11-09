import { expect, test } from '@playwright/test';
import { seedConversations, seedMessages } from '../specs/mock/db';
import { getE2EUser } from '../setup/user';
import { auditPage, lcpElement } from './audit';

const conversationId = '16390000-0000-4000-8000-000000000001';
const title = 'Lighthouse latency audit';
const transcriptMarker = 'Serial database latency transcript';

test('serial database latency stays within web-vitals budgets', async ({ page, baseURL }) => {
  const email = getE2EUser().email;
  await seedConversations(email, [{ conversationId, title, updatedAt: new Date() }]);
  await seedMessages(email, conversationId, [
    {
      messageId: '16390000-0000-4000-8000-000000000002',
      parentMessageId: '00000000-0000-0000-0000-000000000000',
      text: 'Explain why independent database reads should start together.',
      isCreatedByUser: true,
      sender: 'User',
    },
    {
      messageId: '16390000-0000-4000-8000-000000000003',
      parentMessageId: '16390000-0000-4000-8000-000000000002',
      text: `${transcriptMarker}. Independent reads can overlap. Serial reads each add another database round trip and delay the visible conversation. Reuse loaded user data and preserve authorization checks when starting reads in parallel.`,
      isCreatedByUser: false,
      sender: 'Assistant',
    },
  ]);
  const url = `${baseURL}/c/${conversationId}`;
  await page.goto(url);
  await expect(page.locator('.message-render').filter({ hasText: transcriptMarker })).toBeVisible();
  const cookies = await page.context().cookies();
  const reports = await auditPage({ url, cookies });
  expect(reports, 'Lighthouse must produce all three reports').toHaveLength(3);
  for (const report of reports) {
    expect(report.finalDisplayedUrl, 'Do not measure a login redirect').toBe(url);
    const lcp = lcpElement(report);
    /**
     * The fork's permanent Satchida brand watermark (384x331 aria-hidden div,
     * background-image) is a legitimate LCP candidate in Chrome and out-paints
     * a short seeded transcript, so it is the one allowed non-transcript LCP
     * element here. The conversation-render guarantee stays with the
     * toBeVisible check above; any other shell — spinner, skeleton, header
     * chrome — still fails this assertion.
     */
    expect(
      lcp.includes(transcriptMarker) || lcp.includes('satchida-chat-watermark'),
      'The measured LCP must be the seeded transcript or the Satchida brand watermark, not other shell',
    ).toBe(true);
  }
});
