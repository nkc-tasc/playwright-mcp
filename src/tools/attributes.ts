/**
 * HTML属性取得ツール - .nth()禁止違反解決のための汎用機能
 * Structured Payload形式でレスポンスを統一
 */

import { z } from 'zod';
import { defineTool } from './tool.js';
import { buildPayload } from './utils/structuredPayload.js';

const getElementAttributes = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_get_element_attributes',
    title: 'Get element attributes',
    description: 'Extract element attributes using selector or ref',
    inputSchema: z.object({
      selector: z.string().optional().describe('CSS selector for backward compatibility'),
      ref: z.string().optional().describe('Element reference ID (e.g., "e15") - preferred method'),
      element: z.string().default('target-element').describe('Element description')
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    console.log('[DEBUG] browser_get_element_attributes started', params);
    const tab = context.currentTabOrDie();

    try {
      console.log('[DEBUG] In try block');
      // ✅ ref値優先の分岐処理（MDファイル準拠）
      if (params.ref) {
        console.log('[DEBUG] Using ref path:', params.ref);
        // 🆕 aria-ref直接アクセス（高精度）
        const snapshot = tab.snapshotOrDie();
        console.log('[DEBUG] Got snapshot');
        const locator = snapshot.refLocator({
          ref: params.ref,
          element: params.element,
        });
        console.log('[DEBUG] Got locator');

        const attributes = await locator.evaluate((el: Element, refValue: string) => ({
          // 必須属性：ロケータ生成用
          id: el.id || null,
          className: el.className || null,
          'data-testid': el.getAttribute('data-testid'),
          'data-test': el.getAttribute('data-test'),
          name: (el as any).name || el.getAttribute('name'),

          // セマンティック情報
          tagName: el.tagName.toLowerCase(),
          type: (el as any).type || null,
          placeholder: (el as any).placeholder || null,
          value: (el as any).value || null,
          textContent: el.textContent?.trim().slice(0, 100) || null,

          // アクセシビリティ情報
          role: el.getAttribute('role'),
          'aria-label': el.getAttribute('aria-label'),
          'aria-describedby': el.getAttribute('aria-describedby'),
          // bulkでは isVisible のみ保証、単発は広めに返すが互換のため残す

          // 追加情報
          href: (el as any).href || null,
          src: (el as any).src || null,
          // 可視性（スタイルも返す）
          isVisible: (() => {
            const he = el as HTMLElement;
            const cs = getComputedStyle(he);
            return !he.hidden && cs.display !== 'none' && cs.visibility !== 'hidden'
              && he.offsetParent !== null;
          })(),
          // 単発は詳細も返すが、クライアントは使わない前提
          styleDisplay: getComputedStyle(el as HTMLElement).display,
          styleVisibility: getComputedStyle(el as HTMLElement).visibility,

          // メタデータ
          extraction_method: 'mcp-aria-ref-direct',
          extraction_timestamp: Date.now(),
          ref: refValue
        }), params.ref, { timeout: 3000 });

        console.log('[DEBUG] Attributes extracted:', Object.keys(attributes).length);

        const payload = { attributes };
        return {
          code: [],
          content: [{ type: 'text', text: JSON.stringify(payload) }],
          data: payload,
          captureSnapshot: false,
          waitForNetwork: false,
        };
      } else if (params.selector) {
        // 既存のselector処理（後方互換性保持）
        const locator = tab.page.locator(params.selector);

        const attributes = await locator.evaluate((el: Element) => ({
          id: el.id || null,
          className: el.className || null,
          'data-testid': el.getAttribute('data-testid'),
          'data-test': el.getAttribute('data-test'),
          name: (el as any).name || el.getAttribute('name'),
          tagName: el.tagName.toLowerCase(),
          type: (el as any).type || null,
          placeholder: (el as any).placeholder || null,
          value: (el as any).value || null,
          textContent: el.textContent?.trim().slice(0, 100) || null,
          role: el.getAttribute('role'),
          'aria-label': el.getAttribute('aria-label'),
          // 単発のみ詳細
          href: (el as any).href || null,
          src: (el as any).src || null,
          isVisible: (() => {
            const he = el as HTMLElement;
            const cs = getComputedStyle(he);
            return !he.hidden && cs.display !== 'none' && cs.visibility !== 'hidden'
              && he.offsetParent !== null;
          })(),
          styleDisplay: getComputedStyle(el as HTMLElement).display,
          styleVisibility: getComputedStyle(el as HTMLElement).visibility,
          extraction_method: 'css-selector-legacy',
          extraction_timestamp: Date.now()
        }), { timeout: 3000 });

        const payload = { attributes };
        return {
          code: [],
          content: [{ type: 'text', text: JSON.stringify(payload) }],
          data: payload,
          captureSnapshot: false,
          waitForNetwork: false,
        };
      } else {
        throw new Error('Either ref or selector parameter is required');
      }

    } catch (error: any) {
      console.error('[ERROR] browser_get_element_attributes failed:', error);
      console.error('[ERROR] Stack:', error.stack);
      return {
        code: [],
        content: [{ type: 'text', text: `Element attributes extraction failed: ${error.message}` }],
        captureSnapshot: false,
        waitForNetwork: false
      };
    }
  },
});

const getBulkAttributes = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_get_bulk_attributes',
    title: 'Get HTML attributes of multiple elements',
    description: 'Extract HTML attributes from multiple elements at once using ref locators',
    inputSchema: z.object({
      refs: z.array(z.string()).min(1).describe('Array of element reference IDs'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();

    try {
      if (!tab.hasSnapshot()) {
        await tab.captureSnapshot({});
      }
      const snapshot = tab.snapshotOrDie();
      const results: Record<string, any> = {};

      for (const ref of params.refs) {
        try {
          const locator = snapshot.refLocator({ ref, element: `bulk-${ref}` });
          const attributes = await locator.evaluate((el: Element) => ({
            // bulkは isVisible のみを返す（混乱回避のため）
            isVisible: (() => {
              const he = el as HTMLElement;
              const cs = getComputedStyle(he);
              return !he.hidden && cs.display !== 'none' && cs.visibility !== 'hidden'
                && he.offsetParent !== null;
            })(),
          }), { timeout: 3000 });
          results[ref] = attributes;
        } catch (error: any) {
          results[ref] = { error: String(error?.message || error), ref };
        }
      }

      const payload = { attributes: results };
      return {
        code: [
          `// Bulk attributes extracted for ${params.refs.length} elements`,
          `console.log('Bulk results:', ${JSON.stringify(results)});`,
        ],
        content: [{ type: 'text', text: JSON.stringify(payload) }],
        data: payload,
        captureSnapshot: false,
        waitForNetwork: false,
      };
    } catch (error: any) {
      return {
        code: [],
        content: [{ type: 'text', text: `Bulk attributes extraction failed: ${error.message}` }],
        captureSnapshot: false,
        waitForNetwork: false,
      };
    }
  },
});

export default [
  getElementAttributes,
  getBulkAttributes
];
