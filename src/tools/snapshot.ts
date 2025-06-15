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

const snapshot = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_snapshot',
    title: 'Page snapshot',
    description: 'Capture accessibility snapshot of the current page, this is better than screenshot',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async context => {
    await context.ensureTab();

    return {
      code: [`// <internal code to capture accessibility snapshot>`],
      captureSnapshot: true,
      waitForNetwork: false,
    };
  },
});

const elementSchema = z.object({
  element: z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: z.string().describe('Exact target element reference from the page snapshot'),
});

const click = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_click',
    title: 'Click',
    description: 'Perform click on a web page',
    inputSchema: elementSchema,
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    const locator = tab.snapshotOrDie().refLocator(params.ref);

    const code = [
      `// Click ${params.element}`,
      `await page.${await generateLocator(locator)}.click();`
    ];

    return {
      code,
      action: () => locator.click(),
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
    const startLocator = snapshot.refLocator(params.startRef);
    const endLocator = snapshot.refLocator(params.endRef);

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
    const snapshot = context.currentTabOrDie().snapshotOrDie();
    const locator = snapshot.refLocator(params.ref);

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

const typeSchema = elementSchema.extend({
  text: z.string().describe('Text to type into the element'),
  submit: z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
  slowly: z.boolean().optional().describe('Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.'),
});

const type = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_type',
    title: 'Type text',
    description: 'Type text into editable element',
    inputSchema: typeSchema,
    type: 'destructive',
  },

  handle: async (context, params) => {
    const snapshot = context.currentTabOrDie().snapshotOrDie();
    const locator = snapshot.refLocator(params.ref);

    const code: string[] = [];
    const steps: (() => Promise<void>)[] = [];

    if (params.slowly) {
      code.push(`// Press "${params.text}" sequentially into "${params.element}"`);
      code.push(`await page.${await generateLocator(locator)}.pressSequentially(${javascript.quote(params.text)});`);
      steps.push(() => locator.pressSequentially(params.text));
    } else {
      code.push(`// Fill "${params.text}" into "${params.element}"`);
      code.push(`await page.${await generateLocator(locator)}.fill(${javascript.quote(params.text)});`);
      steps.push(() => locator.fill(params.text));
    }

    if (params.submit) {
      code.push(`// Submit text`);
      code.push(`await page.${await generateLocator(locator)}.press('Enter');`);
      steps.push(() => locator.press('Enter'));
    }

    return {
      code,
      action: () => steps.reduce((acc, step) => acc.then(step), Promise.resolve()),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

const selectOptionSchema = elementSchema.extend({
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
    const snapshot = context.currentTabOrDie().snapshotOrDie();
    const locator = snapshot.refLocator(params.ref);

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

/**
 * Fill ツール：Playwright の page.fill() を使って入力フィールドに文字列を一括入力
 */
const browserFillSchema = elementSchema.extend({
  value: z.string().describe('入力する文字列'),
});

const browserFill = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_fill',
    title: 'Fill',
    description: '指定した要素に文字列を一括で入力します',
    inputSchema: browserFillSchema,
    type: 'destructive',
  },
  handle: async (context, params) => {
    const snapshot = context.currentTabOrDie().snapshotOrDie();
    const locator = snapshot.refLocator(params.ref);
    const code = [
      `// Fill "${params.value}" into ${params.element}`,
      `await page.${await generateLocator(locator)}.fill(${javascript.formatObject(params.value)});`
    ];
    return {
      code,
      action: () => locator.fill(params.value).then(() => {}),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

/**
 * Check ツール：Playwright の page.check() を使ってチェックボックス／ラジオを確実にチェック
 */
const browserCheckSchema = elementSchema;

const browserCheck = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_check',
    title: 'Check',
    description: '指定したチェックボックスまたはラジオボタンをチェックします',
    inputSchema: browserCheckSchema,
    type: 'destructive',
  },
  handle: async (context, params) => {
    const snapshot = context.currentTabOrDie().snapshotOrDie();
    const locator = snapshot.refLocator(params.ref);
    const code = [
      `// Check ${params.element}`,
      `await page.${await generateLocator(locator)}.check();`
    ];
    return {
      code,
      action: () => locator.check().then(() => {}),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

// browser_type は browserFill の後方互換 alias
/** @deprecated Remove in July 2025 - use browser_fill instead */
const browserType = {
  ...browserFill,
  schema: {
    ...browserFill.schema,
    name: 'browser_type',
    title: 'Type text (deprecated - use browser_fill)',
    description: 'DEPRECATED: Use browser_fill instead. Type text into element',
  }
};

export default [
  snapshot,
  click,
  drag,
  hover,
  type,
  selectOption,
  browserFill,
  browserCheck,
  browserType, // 🔄 後方互換 alias
];
