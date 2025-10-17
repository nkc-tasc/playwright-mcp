/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { z } from 'zod';

import { defineTool } from './tool.js';
import * as javascript from '../javascript.js';
import { generateLocator } from './utils.js';

// Phase 1.5: Explicit snapshot result type definition for client reliability
export interface SnapshotResult {
  url: string;
  title: string;
  html?: string;
  accessibility_tree?: string;
  content?: Array<{ type: string; text: string }>;
}

const snapshot = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_snapshot',
    title: 'Page snapshot',
    description: 'Capture accessibility snapshot of the current page, this is better than screenshot',
  inputSchema: z.object({
      includeHidden: z.boolean().default(false),
      maxInteractiveRefs: z.number().min(50).max(300).default(120),
      timeBudgetMs: z.number().min(500).max(3000).default(1500)
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    // Ensure page exists
    await context.ensureTab();

    // Capture a fresh snapshot for internal state/locators
    const tab = context.currentTabOrDie();
    await tab.captureSnapshot({
      includeHidden: params.includeHidden,
      maxInteractiveRefs: params.maxInteractiveRefs,
      timeBudgetMs: params.timeBudgetMs,
    });

    // Get the accessibility tree with ref information
    const snapshot = tab.hasSnapshot() ? tab.snapshotOrDie() : null;
    console.log('[DEBUG] snapshot exists:', !!snapshot);
    console.log('[DEBUG] snapshot hasSnapshot():', tab.hasSnapshot());

    const accessibility_tree = snapshot ? snapshot.text() : '';
    console.log('[DEBUG] accessibility_tree length:', accessibility_tree.length);
    console.log('[DEBUG] accessibility_tree preview:', accessibility_tree.substring(0, 200));

    // Collect minimal, structured page state for clients to parse easily
    const payload = await tab.page.evaluate(() => ({
      html: document.documentElement?.outerHTML || '',
      url: location.href,
      title: document.title || ''
    }));

    // Enhanced payload with accessibility tree
    const enhancedPayload = {
      ...payload,
      accessibility_tree: accessibility_tree
    };

    return {
      code: [
        `// Enhanced page snapshot collected (html: ${String(payload.html?.length || 0)}, accessibility: ${String(accessibility_tree?.length || 0)})`,
      ],
      content: [{ type: 'text', text: JSON.stringify(enhancedPayload) }],
      data: enhancedPayload,
      // We capture snapshot for accessibility tree
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

export const baseElementSchema = z.object({
  element: z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: z.string().optional().describe('Exact target element reference from the page snapshot'),
  selector: z.string().optional().describe('CSS selector to target the element'),
});

export const elementSchema = baseElementSchema.refine(data => {
  // 🔧 P0緊急修正: undefinedや空文字列を適切に処理
  const hasRef = data.ref && typeof data.ref === 'string' && data.ref.trim().length > 0;
  const hasSelector = data.selector && typeof data.selector === 'string' && data.selector.trim().length > 0;
  return hasRef || hasSelector;
}, {
  message: "Either 'ref' or 'selector' must be provided as non-empty string",
});

const clickSchema = baseElementSchema.extend({
  doubleClick: z.boolean().optional().describe('Whether to perform a double click instead of a single click'),
  button: z.enum(['left', 'right', 'middle']).optional().describe('Button to click, defaults to left'),
}).refine(data => {
  // 🔧 同じvalidation
  const hasRef = data.ref && typeof data.ref === 'string' && data.ref.trim().length > 0;
  const hasSelector = data.selector && typeof data.selector === 'string' && data.selector.trim().length > 0;
  return hasRef || hasSelector;
}, {
  message: "Either 'ref' or 'selector' must be provided as non-empty string",
});

const click = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_click',
    title: 'Click',
    description: 'Perform click on a web page',
    inputSchema: clickSchema,
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();

    // Support both ref-based and selector-based element targeting
    const locator = params.selector
      ? tab.page.locator(params.selector)
      : params.ref
        ? tab.snapshotOrDie().refLocator({ ref: params.ref, element: params.element })
        : tab.page.locator(`[data-ref="${params.element}"]`); // fallback

    const button = params.button;
    const buttonAttr = button ? `{ button: '${button}' }` : '';

    const code: string[] = [];
    if (params.doubleClick) {
      code.push(`// Double click ${params.element}`);
      code.push(`await page.${await generateLocator(locator)}.dblclick(${buttonAttr});`);
    } else {
      code.push(`// Click ${params.element}`);
      code.push(`await page.${await generateLocator(locator)}.click(${buttonAttr});`);
    }

    return {
      code,
      action: () => params.doubleClick ? locator.dblclick({ button }) : locator.click({ button }),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

const drag = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_drag',
    title: 'Drag mouse',
    description: 'Perform drag and drop between two elements',
    inputSchema: z.object({
      startElement: z.string().describe('Human-readable source element description used to obtain the permission to interact with the element'),
      startRef: z.string().describe('Exact source element reference from the page snapshot'),
      endElement: z.string().describe('Human-readable target element description used to obtain the permission to interact with the element'),
      endRef: z.string().describe('Exact target element reference from the page snapshot'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const snapshot = context.currentTabOrDie().snapshotOrDie();
    const startLocator = snapshot.refLocator({ ref: params.startRef, element: params.startElement });
    const endLocator = snapshot.refLocator({ ref: params.endRef, element: params.endElement });

    const code = [
      `// Drag ${params.startElement} to ${params.endElement}`,
      `await page.${await generateLocator(startLocator)}.dragTo(page.${await generateLocator(endLocator)});`
    ];

    return {
      code,
      action: () => startLocator.dragTo(endLocator),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

const hover = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_hover',
    title: 'Hover mouse',
    description: 'Hover over element on page',
    inputSchema: elementSchema,
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();

    // Support both ref-based and selector-based element targeting
    const locator = params.selector
      ? tab.page.locator(params.selector)
      : params.ref
        ? tab.snapshotOrDie().refLocator({ ref: params.ref, element: params.element })
        : tab.page.locator(`[data-ref="${params.element}"]`); // fallback

    const code = [
      `// Hover over ${params.element}`,
      `await page.${await generateLocator(locator)}.hover();`
    ];

    return {
      code,
      action: () => locator.hover(),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

const selectOptionSchema = baseElementSchema.extend({
  values: z.array(z.string()).describe('Array of values to select in the dropdown. This can be a single value or multiple values.'),
});

const selectOption = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_select_option',
    title: 'Select option',
    description: 'Select an option in a dropdown',
    inputSchema: selectOptionSchema,
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();

    // Support both ref-based and selector-based element targeting
    const locator = params.selector
      ? tab.page.locator(params.selector)
      : params.ref
        ? tab.snapshotOrDie().refLocator({ ref: params.ref, element: params.element })
        : tab.page.locator(`[data-ref="${params.element}"]`); // fallback

    const code = [
      `// Select options [${params.values.join(', ')}] in ${params.element}`,
      `await page.${await generateLocator(locator)}.selectOption(${javascript.formatObject(params.values)});`
    ];

    return {
      code,
      action: () => locator.selectOption(params.values).then(() => {}),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

// Fill tool for text input
const fillSchema = baseElementSchema.extend({
  text: z.string().describe('Text to fill into the element'),
});

const fill = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_fill',
    title: 'Fill text',
    description: 'Fill text into an input field',
    inputSchema: fillSchema,
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();

    // Support both ref-based and selector-based element targeting
    const locator = params.selector
      ? tab.page.locator(params.selector)
      : params.ref
        ? tab.snapshotOrDie().refLocator({ ref: params.ref, element: params.element })
        : tab.page.locator(`[data-ref="${params.element}"]`); // fallback

    const code = [
      `// Fill "${params.text}" into ${params.element}`,
      `await page.${await generateLocator(locator)}.fill(${javascript.quote(params.text)});`
    ];

    return {
      code,
      action: () => locator.fill(params.text),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

// Check/uncheck tool for checkboxes
const checkSchema = baseElementSchema.extend({
  checked: z.boolean().describe('Whether to check (true) or uncheck (false) the checkbox'),
});

const check = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_check',
    title: 'Check/uncheck',
    description: 'Check or uncheck a checkbox',
    inputSchema: checkSchema,
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();

    // Support both ref-based and selector-based element targeting
    const locator = params.selector
      ? tab.page.locator(params.selector)
      : params.ref
        ? tab.snapshotOrDie().refLocator({ ref: params.ref, element: params.element })
        : tab.page.locator(`[data-ref="${params.element}"]`); // fallback

    const action = params.checked ? 'check' : 'uncheck';
    const code = [
      `// ${action} ${params.element}`,
      `await page.${await generateLocator(locator)}.${action}();`
    ];

    return {
      code,
      action: () => params.checked ? locator.check() : locator.uncheck(),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});


export default [
  snapshot,
  click,
  drag,
  hover,
  selectOption,
  fill,
  check,
];
