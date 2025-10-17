/**
 * Tests for browser_discover_interactive_refs tool
 * Ensures aria-ref augmented discovery captures hidden elements
 */

import { test, expect } from './fixtures.js';

test.describe('browser_discover_interactive_refs', () => {
  test('should return candidates with aria-ref source when hidden elements exist', async ({ client, server }, testInfo) => {
    test.skip(testInfo.project.name === 'webkit', 'WebKit snapshots are not available in MCP test harness yet.');
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    // Capture snapshot to populate ref assignments (including hidden elements)
    await client.callTool({
      name: 'browser_snapshot',
      arguments: { includeHidden: true }
    });

    await client.callTool({
      name: 'browser_evaluate',
      arguments: {
        function: `() => {
          const hiddenBtn = document.createElement('button');
          hiddenBtn.textContent = 'Hidden Ref';
          hiddenBtn.setAttribute('aria-ref', 'e-hidden');
          hiddenBtn.style.display = 'none';
          document.body.appendChild(hiddenBtn);

          const visibleLink = document.createElement('a');
          visibleLink.textContent = 'Visible Ref';
          visibleLink.setAttribute('href', '#');
          visibleLink.setAttribute('data-ref', 'e-visible');
          document.body.appendChild(visibleLink);
          return true;
        }`
      }
    });

    const response = await client.callTool({
      name: 'browser_discover_interactive_refs',
      arguments: {
        includeHidden: true,
        max: 50,
        timeBudgetMs: 1500,
      }
    });

    expect(response).toBeDefined();
    const content = ((response as any).content ?? []) as Array<{ text?: string }>;
    expect(content.length).toBeGreaterThan(0);
    const jsonEntry = content.find(entry => entry.text && entry.text.trim().startsWith('{'));
    const targetEntry = jsonEntry ?? content[content.length - 1];
    expect(targetEntry?.text).toBeDefined();

    const payload = targetEntry?.text ? JSON.parse(targetEntry.text) : { candidates: [] };
    const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((candidate: any) => candidate.refSource === 'aria-ref')).toBeTruthy();
    expect(candidates.some((candidate: any) => candidate.refSource === 'data-ref')).toBeTruthy();
  });
});
