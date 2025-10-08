import { z } from 'zod';

import { defineTool } from './tool.js';

const SELECTOR = '[data-ref], [aria-ref]';

export const discoverInteractiveRefs = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_discover_interactive_refs',
    title: 'Discover interactive refs',
    description: 'Enumerate interactive elements with existing ref assignments',
    inputSchema: z.object({
      includeHidden: z.boolean().default(true),
      max: z.number().min(10).max(300).default(120),
      timeBudgetMs: z.number().min(300).max(3000).default(1500),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();

    try {
      if (!tab.hasSnapshot()) {
        try {
          await tab.captureSnapshot({
            includeHidden: params.includeHidden,
            maxInteractiveRefs: params.max,
            timeBudgetMs: params.timeBudgetMs,
          });
        } catch (captureError) {
          // Ignore snapshot capture failures (e.g., engines without snapshot support)
        }
      }

      const candidates = await tab.page.evaluate(({ selector, limit }) => {
        const elements = Array.from(document.querySelectorAll(selector));
        const out: any[] = [];
        for (const element of elements.slice(0, limit)) {
          const ariaRef = element.getAttribute('aria-ref');
          const dataRef = element.getAttribute('data-ref');
          const ref = ariaRef || dataRef;
          if (!ref) continue;
          const role = element.getAttribute('role');
          const attrs: any = {
            ref,
            refSource: ariaRef ? 'aria-ref' : 'data-ref',
            tag: element.tagName.toLowerCase(),
            role,
            text: element.textContent?.trim().slice(0, 120) || null,
            href: (element as any).href || null,
            visible: !(element as HTMLElement).hidden && (element as HTMLElement).offsetParent !== null,
          };
          const id = element.getAttribute('id');
          if (id) attrs.id = id;
          const dataTestId = element.getAttribute('data-testid');
          if (dataTestId) attrs['data-testid'] = dataTestId;
          const ariaLabel = element.getAttribute('aria-label');
          if (ariaLabel) attrs['aria-label'] = ariaLabel;
          out.push(attrs);
        }
        return out;
      }, { selector: SELECTOR, limit: params.max });

      const payload = { candidates };
      return {
        code: [],
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        data: payload,
        captureSnapshot: false,
        waitForNetwork: false,
      };
    } catch (error: any) {
      return {
        code: [],
        error: `Interactive ref discovery failed: ${error.message}`,
        result: { candidates: [] },
        captureSnapshot: false,
        waitForNetwork: false,
      };
    }
  },
});

export default [discoverInteractiveRefs];

