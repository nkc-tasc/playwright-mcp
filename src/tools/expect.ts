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

/**
 * AI-First Expect Tool
 * Provides comprehensive assertion capabilities for AI-driven test generation
 */

// Core assertion type definitions
const assertionTypeSchema = z.enum([
  'toBeVisible',
  'toBeHidden',
  'toHaveText',
  'toContainText',
  'toHaveValue',
  'toHaveURL',
  'toBeEnabled',
  'toBeDisabled',
  'toBeChecked',
  'toBeUnchecked',
  'toHaveAttribute',
  'toHaveClass',
  'toHaveCSS',
  'toBeAttached',
  'toBeDetached',
  'toHaveCount',
  'toBeEmpty',
  'toBeEditable',
  'toBeReadonly',
  'toBeFocused',
  'toHaveScreenshot'
]);

// Element assertion - for element-based assertions
const elementAssertion = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_expect_element',
    title: 'Assert Element State',
    description: 'AI-powered element assertion for flexible test verification. Supports all major Playwright expect methods with intelligent selector resolution.',
    inputSchema: z.object({
      selector: z.string().describe('CSS selector, role selector, or text-based selector for the target element'),
      assertion: assertionTypeSchema.describe('The type of assertion to perform'),
      expected: z.union([z.string(), z.number(), z.boolean()]).optional().describe('Expected value for assertions that require comparison'),
      options: z.object({
        timeout: z.number().optional().default(5000).describe('Maximum time to wait for assertion in milliseconds'),
        ignoreCase: z.boolean().optional().default(false).describe('Case-insensitive matching for text assertions'),
        useInnerText: z.boolean().optional().default(false).describe('Use innerText instead of textContent for text assertions'),
        nth: z.number().optional().describe('Select nth element from selector matches (0-based)'),
      }).optional().default({}),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    const { selector, assertion, expected, options } = params;
    const { timeout = 5000, ignoreCase = false, useInnerText = false, nth } = options || {};

    // AI-driven intelligent locator resolution
    let locator = tab.page.locator(selector);
    
    // Handle nth selection if specified
    if (nth !== undefined) {
      locator = locator.nth(nth);
    }

    const code: string[] = [];
    const selectorStr = nth !== undefined ? `page.locator(${JSON.stringify(selector)}).nth(${nth})` : `page.locator(${JSON.stringify(selector)})`;

    try {
      switch (assertion) {
        case 'toBeVisible':
          code.push(`await expect(${selectorStr}).toBeVisible({ timeout: ${timeout} });`);
          await locator.waitFor({ state: 'visible', timeout });
          break;

        case 'toBeHidden':
          code.push(`await expect(${selectorStr}).toBeHidden({ timeout: ${timeout} });`);
          await locator.waitFor({ state: 'hidden', timeout });
          break;

        case 'toHaveText':
          if (!expected) throw new Error('Expected text value is required for toHaveText assertion');
          const textOptions = ignoreCase ? '{ ignoreCase: true }' : '';
          code.push(`await expect(${selectorStr}).toHaveText(${JSON.stringify(expected)}${textOptions ? `, ${textOptions}` : ''});`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const actualText = useInnerText ? await locator.innerText() : await locator.textContent();
          if (ignoreCase ? actualText?.toLowerCase() !== String(expected).toLowerCase() : actualText !== expected) {
            throw new Error(`Expected text "${expected}", but got "${actualText}"`);
          }
          break;

        case 'toContainText':
          if (!expected) throw new Error('Expected text value is required for toContainText assertion');
          const containOptions = ignoreCase ? '{ ignoreCase: true }' : '';
          code.push(`await expect(${selectorStr}).toContainText(${JSON.stringify(expected)}${containOptions ? `, ${containOptions}` : ''});`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const containText = useInnerText ? await locator.innerText() : await locator.textContent();
          const matchText = ignoreCase ? containText?.toLowerCase().includes(String(expected).toLowerCase()) : containText?.includes(String(expected));
          if (!matchText) {
            throw new Error(`Expected text to contain "${expected}", but got "${containText}"`);
          }
          break;

        case 'toHaveValue':
          if (!expected) throw new Error('Expected value is required for toHaveValue assertion');
          code.push(`await expect(${selectorStr}).toHaveValue(${JSON.stringify(expected)});`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const actualValue = await locator.inputValue();
          if (actualValue !== expected) {
            throw new Error(`Expected value "${expected}", but got "${actualValue}"`);
          }
          break;

        case 'toBeEnabled':
          code.push(`await expect(${selectorStr}).toBeEnabled({ timeout: ${timeout} });`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const isEnabled = await locator.isEnabled();
          if (!isEnabled) {
            throw new Error('Expected element to be enabled, but it is disabled');
          }
          break;

        case 'toBeDisabled':
          code.push(`await expect(${selectorStr}).toBeDisabled({ timeout: ${timeout} });`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const isDisabled = await locator.isDisabled();
          if (!isDisabled) {
            throw new Error('Expected element to be disabled, but it is enabled');
          }
          break;

        case 'toBeChecked':
          code.push(`await expect(${selectorStr}).toBeChecked({ timeout: ${timeout} });`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const isChecked = await locator.isChecked();
          if (!isChecked) {
            throw new Error('Expected element to be checked, but it is unchecked');
          }
          break;

        case 'toBeUnchecked':
          code.push(`await expect(${selectorStr}).not.toBeChecked({ timeout: ${timeout} });`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const isUnchecked = !(await locator.isChecked());
          if (!isUnchecked) {
            throw new Error('Expected element to be unchecked, but it is checked');
          }
          break;

        case 'toHaveAttribute':
          if (!expected) throw new Error('Expected attribute value is required for toHaveAttribute assertion');
          const [attrName, attrValue] = String(expected).split('=', 2);
          if (attrValue) {
            code.push(`await expect(${selectorStr}).toHaveAttribute(${JSON.stringify(attrName)}, ${JSON.stringify(attrValue)});`);
            await locator.waitFor({ state: 'attached', timeout: 1000 });
            const actualAttrValue = await locator.getAttribute(attrName);
            if (actualAttrValue !== attrValue) {
              throw new Error(`Expected attribute "${attrName}" to have value "${attrValue}", but got "${actualAttrValue}"`);
            }
          } else {
            code.push(`await expect(${selectorStr}).toHaveAttribute(${JSON.stringify(attrName)});`);
            await locator.waitFor({ state: 'attached', timeout: 1000 });
            const hasAttribute = await locator.getAttribute(attrName) !== null;
            if (!hasAttribute) {
              throw new Error(`Expected element to have attribute "${attrName}"`);
            }
          }
          break;

        case 'toHaveClass':
          if (!expected) throw new Error('Expected class name is required for toHaveClass assertion');
          code.push(`await expect(${selectorStr}).toHaveClass(${JSON.stringify(expected)});`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const className = await locator.getAttribute('class');
          const hasClass = className?.includes(String(expected));
          if (!hasClass) {
            throw new Error(`Expected element to have class "${expected}", but classes are "${className}"`);
          }
          break;

        case 'toHaveCount':
          if (expected === undefined) throw new Error('Expected count is required for toHaveCount assertion');
          code.push(`await expect(${selectorStr}).toHaveCount(${expected});`);
          const actualCount = await locator.count();
          if (actualCount !== Number(expected)) {
            throw new Error(`Expected ${expected} elements, but found ${actualCount}`);
          }
          break;

        case 'toBeAttached':
          code.push(`await expect(${selectorStr}).toBeAttached({ timeout: ${timeout} });`);
          await locator.waitFor({ state: 'attached', timeout });
          break;

        case 'toBeDetached':
          code.push(`await expect(${selectorStr}).toBeDetached({ timeout: ${timeout} });`);
          await locator.waitFor({ state: 'detached', timeout });
          break;

        case 'toBeEmpty':
          code.push(`await expect(${selectorStr}).toBeEmpty();`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const isEmpty = (await locator.textContent())?.trim() === '';
          if (!isEmpty) {
            throw new Error('Expected element to be empty');
          }
          break;

        case 'toBeEditable':
          code.push(`await expect(${selectorStr}).toBeEditable({ timeout: ${timeout} });`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const isEditable = await locator.isEditable();
          if (!isEditable) {
            throw new Error('Expected element to be editable');
          }
          break;

        case 'toBeReadonly':
          code.push(`await expect(${selectorStr}).not.toBeEditable({ timeout: ${timeout} });`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const isReadonly = !(await locator.isEditable());
          if (!isReadonly) {
            throw new Error('Expected element to be readonly');
          }
          break;

        case 'toBeFocused':
          code.push(`await expect(${selectorStr}).toBeFocused({ timeout: ${timeout} });`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const isFocused = await locator.evaluate((el) => el === document.activeElement);
          if (!isFocused) {
            throw new Error('Expected element to be focused');
          }
          break;

        default:
          throw new Error(`Unsupported assertion type: ${assertion}`);
      }

      return {
        code,
        captureSnapshot: true,
        waitForNetwork: false,
      };
    } catch (error) {
      throw new Error(`Assertion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

// Page assertion - for page-level assertions
const pageAssertion = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_expect_page',
    title: 'Assert Page State',
    description: 'AI-powered page-level assertions for URL, title, and page-wide conditions. Provides intelligent pattern matching and flexible verification.',
    inputSchema: z.object({
      assertion: z.enum(['toHaveURL', 'toHaveTitle', 'toHaveScreenshot']).describe('The type of page assertion to perform'),
      expected: z.union([z.string(), z.object({ pattern: z.string(), flags: z.string().optional() })]).describe('Expected value or regex pattern for assertion'),
      options: z.object({
        timeout: z.number().optional().default(30000).describe('Maximum time to wait for assertion in milliseconds'),
        ignoreCase: z.boolean().optional().default(false).describe('Case-insensitive matching'),
      }).optional().default({}),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    const { assertion, expected, options } = params;
    const { timeout = 30000 } = options || {};

    const code: string[] = [];

    try {
      switch (assertion) {
        case 'toHaveURL':
          if (typeof expected === 'object' && 'pattern' in expected) {
            const regex = new RegExp(expected.pattern, expected.flags);
            code.push(`await expect(page).toHaveURL(${regex}, { timeout: ${timeout} });`);
            
            // Wait for URL to match pattern
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
              const currentUrl = tab.page.url();
              if (regex.test(currentUrl)) {
                break;
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const finalUrl = tab.page.url();
            if (!regex.test(finalUrl)) {
              throw new Error(`Expected URL to match pattern ${expected.pattern}, but got "${finalUrl}"`);
            }
          } else {
            code.push(`await expect(page).toHaveURL(${JSON.stringify(expected)}, { timeout: ${timeout} });`);
            
            // Wait for URL to match
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
              const currentUrl = tab.page.url();
              if (currentUrl === expected || currentUrl.includes(String(expected))) {
                break;
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const finalUrl = tab.page.url();
            if (!finalUrl.includes(String(expected))) {
              throw new Error(`Expected URL to contain "${expected}", but got "${finalUrl}"`);
            }
          }
          break;

        case 'toHaveTitle':
          code.push(`await expect(page).toHaveTitle(${JSON.stringify(expected)}, { timeout: ${timeout} });`);
          
          // Wait for title to match
          const startTime = Date.now();
          let actualTitle = '';
          while (Date.now() - startTime < timeout) {
            actualTitle = await tab.page.title();
            if (actualTitle === expected || actualTitle.includes(String(expected))) {
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          actualTitle = await tab.page.title();
          if (!actualTitle.includes(String(expected))) {
            throw new Error(`Expected title to contain "${expected}", but got "${actualTitle}"`);
          }
          break;

        default:
          throw new Error(`Unsupported page assertion type: ${assertion}`);
      }

      return {
        code,
        captureSnapshot: true,
        waitForNetwork: true,
      };
    } catch (error) {
      throw new Error(`Page assertion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

export default [
  elementAssertion,
  pageAssertion,
];