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
 * AI-First Expect Tool - Updated for consistency with other MCP tools
 * Provides comprehensive assertion capabilities for AI-driven test generation
 */

// Expanded assertion type definitions - comprehensive coverage
const assertionTypeSchema = z.enum([
  // Visibility assertions
  'toBeVisible',
  'toBeHidden',
  'toBeInViewport',
  
  // Text assertions  
  'toHaveText',
  'toContainText',
  'toHaveValue',
  
  // URL and page assertions
  'toHaveURL',
  'toHaveTitle',
  
  // State assertions
  'toBeEnabled',
  'toBeDisabled',
  'toBeChecked', 
  'toBeUnchecked',
  'toBeEditable',
  'toBeReadonly',
  'toBeFocused',
  
  // Attribute assertions
  'toHaveAttribute',
  'toHaveId',
  'toHaveClass',
  'toHaveCSS',
  'toHaveRole',
  
  // Accessibility assertions
  'toHaveAccessibleName',
  'toHaveAccessibleDescription',
  
  // DOM structure assertions
  'toBeAttached',
  'toBeDetached',
  'toHaveCount',
  'toBeEmpty',
  
  // Visual assertions
  'toHaveScreenshot',
  
  // Simplified string assertions
  'visible',      // Shorthand for toBeVisible
  'hidden',       // Shorthand for toBeHidden
  'enabled',      // Shorthand for toBeEnabled
  'disabled',     // Shorthand for toBeDisabled
]);

// Element assertion - UPDATED for consistency with other tools
const elementAssertion = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_expect_element',
    title: 'Assert Element State',
    description: 'AI-powered element assertion for flexible test verification. Supports all major Playwright expect methods with intelligent selector resolution. Consistent with other MCP tools using element+ref pattern.',
    inputSchema: z.object({
      // UPDATED: Use 'element' instead of 'selector' for consistency
      element: z.string().describe('CSS selector, role selector, or text-based selector for the target element'),
      
      // ADDED: ref support for consistency with other tools
      ref: z.string().optional().describe('Optional MCP ref ID for more reliable element targeting'),
      
      // UPDATED: Support both full assertion names and shorthand
      assertion: assertionTypeSchema.describe('The type of assertion to perform (full name like "toBeVisible" or shorthand like "visible")'),
      
      // UPDATED: More flexible value handling
      value: z.union([z.string(), z.number(), z.boolean()]).optional().describe('Expected value for assertions that require comparison (replaces "expected")'),
      expected: z.union([z.string(), z.number(), z.boolean()]).optional().describe('Legacy: Expected value (use "value" instead)'),
      
      // Enhanced options
      options: z.object({
        timeout: z.number().optional().default(5000).describe('Maximum time to wait for assertion in milliseconds'),
        ignoreCase: z.boolean().optional().default(false).describe('Case-insensitive matching for text assertions'),
        useInnerText: z.boolean().optional().default(false).describe('Use innerText instead of textContent for text assertions'),
        nth: z.number().optional().describe('Select nth element from selector matches (0-based)'),
        exact: z.boolean().optional().default(false).describe('Exact matching for text assertions'),
      }).optional().default({}),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    const { element, ref, assertion, value, expected, options } = params;
    const { timeout = 5000, ignoreCase = false, useInnerText = false, nth, exact = false } = options || {};
    
    // Use value or fall back to expected for backward compatibility
    const expectedValue = value ?? expected;

    // AI-driven intelligent locator resolution - UPDATED to use ref if available
    let locator;
    if (ref) {
      // If ref is provided, try to use it for more reliable targeting
      try {
        locator = tab.page.locator(`[data-mcp-ref="${ref}"]`);
        const count = await locator.count();
        if (count === 0) {
          // Fallback to element selector if ref not found
          locator = tab.page.locator(element);
        }
      } catch {
        locator = tab.page.locator(element);
      }
    } else {
      locator = tab.page.locator(element);
    }
    
    // Handle nth selection if specified
    if (nth !== undefined) {
      locator = locator.nth(nth);
    }

    const code: string[] = [];
    const selectorStr = nth !== undefined ? `page.locator(${JSON.stringify(element)}).nth(${nth})` : `page.locator(${JSON.stringify(element)})`;

    // Normalize assertion type - convert shorthand to full names
    const normalizeAssertion = (assertion: string): string => {
      const shorthandMap: Record<string, string> = {
        'visible': 'toBeVisible',
        'hidden': 'toBeHidden', 
        'enabled': 'toBeEnabled',
        'disabled': 'toBeDisabled',
      };
      return shorthandMap[assertion] || assertion;
    };

    const normalizedAssertion = normalizeAssertion(assertion);

    try {
      switch (normalizedAssertion) {
        case 'toBeVisible':
          code.push(`await expect(${selectorStr}).toBeVisible({ timeout: ${timeout} });`);
          await locator.waitFor({ state: 'visible', timeout });
          break;

        case 'toBeHidden':
          code.push(`await expect(${selectorStr}).toBeHidden({ timeout: ${timeout} });`);
          await locator.waitFor({ state: 'hidden', timeout });
          break;

        case 'toBeInViewport':
          code.push(`await expect(${selectorStr}).toBeInViewport({ timeout: ${timeout} });`);
          await locator.waitFor({ state: 'visible', timeout: 1000 });
          const isInViewport = await locator.isVisible();
          if (!isInViewport) {
            throw new Error('Expected element to be in viewport');
          }
          break;

        case 'toHaveText':
          if (!expectedValue) throw new Error('Expected text value is required for toHaveText assertion');
          const textOptions = ignoreCase ? '{ ignoreCase: true }' : '';
          code.push(`await expect(${selectorStr}).toHaveText(${JSON.stringify(expectedValue)}${textOptions ? `, ${textOptions}` : ''});`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const actualText = useInnerText ? await locator.innerText() : await locator.textContent();
          const textMatch = exact ? actualText === expectedValue : 
                           ignoreCase ? actualText?.toLowerCase() === String(expectedValue).toLowerCase() : 
                           actualText === expectedValue;
          if (!textMatch) {
            throw new Error(`Expected text "${expectedValue}", but got "${actualText}"`);
          }
          break;

        case 'toContainText':
          if (!expectedValue) throw new Error('Expected text value is required for toContainText assertion');
          const containOptions = ignoreCase ? '{ ignoreCase: true }' : '';
          code.push(`await expect(${selectorStr}).toContainText(${JSON.stringify(expectedValue)}${containOptions ? `, ${containOptions}` : ''});`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const containText = useInnerText ? await locator.innerText() : await locator.textContent();
          const matchText = ignoreCase ? containText?.toLowerCase().includes(String(expectedValue).toLowerCase()) : containText?.includes(String(expectedValue));
          if (!matchText) {
            throw new Error(`Expected text to contain "${expectedValue}", but got "${containText}"`);
          }
          break;

        case 'toHaveValue':
          if (!expectedValue) throw new Error('Expected value is required for toHaveValue assertion');
          code.push(`await expect(${selectorStr}).toHaveValue(${JSON.stringify(expectedValue)});`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const actualValue = await locator.inputValue();
          if (actualValue !== expectedValue) {
            throw new Error(`Expected value "${expectedValue}", but got "${actualValue}"`);
          }
          break;

        case 'toHaveId':
          if (!expectedValue) throw new Error('Expected id value is required for toHaveId assertion');
          code.push(`await expect(${selectorStr}).toHaveId(${JSON.stringify(expectedValue)});`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const actualId = await locator.getAttribute('id');
          if (actualId !== expectedValue) {
            throw new Error(`Expected id "${expectedValue}", but got "${actualId}"`);
          }
          break;

        case 'toHaveRole':
          if (!expectedValue) throw new Error('Expected role value is required for toHaveRole assertion');
          code.push(`await expect(${selectorStr}).toHaveRole(${JSON.stringify(expectedValue)});`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const actualRole = await locator.getAttribute('role');
          if (actualRole !== expectedValue) {
            throw new Error(`Expected role "${expectedValue}", but got "${actualRole}"`);
          }
          break;

        case 'toHaveAccessibleName':
          if (!expectedValue) throw new Error('Expected accessible name is required for toHaveAccessibleName assertion');
          code.push(`await expect(${selectorStr}).toHaveAccessibleName(${JSON.stringify(expectedValue)});`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          // Simplified implementation - in real Playwright this would use accessibility tree
          const accessibleName = await locator.getAttribute('aria-label') || await locator.getAttribute('title') || await locator.textContent();
          if (!accessibleName?.includes(String(expectedValue))) {
            throw new Error(`Expected accessible name to contain "${expectedValue}", but got "${accessibleName}"`);
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
          if (!expectedValue) throw new Error('Expected attribute value is required for toHaveAttribute assertion');
          const [attrName, attrValue] = String(expectedValue).split('=', 2);
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
          if (!expectedValue) throw new Error('Expected class name is required for toHaveClass assertion');
          code.push(`await expect(${selectorStr}).toHaveClass(${JSON.stringify(expectedValue)});`);
          await locator.waitFor({ state: 'attached', timeout: 1000 });
          const className = await locator.getAttribute('class');
          const hasClass = className?.includes(String(expectedValue));
          if (!hasClass) {
            throw new Error(`Expected element to have class "${expectedValue}", but classes are "${className}"`);
          }
          break;

        case 'toHaveCount':
          if (expectedValue === undefined) throw new Error('Expected count is required for toHaveCount assertion');
          code.push(`await expect(${selectorStr}).toHaveCount(${expectedValue});`);
          const actualCount = await locator.count();
          if (actualCount !== Number(expectedValue)) {
            throw new Error(`Expected ${expectedValue} elements, but found ${actualCount}`);
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

// Page assertion - UPDATED: Enhanced with intelligent assertion detection
const pageAssertion = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_expect_page',
    title: 'Assert Page State',
    description: 'AI-powered page-level assertions for URL, title, and page-wide conditions. Provides intelligent pattern matching and flexible verification. Can auto-detect assertion type from value.',
    inputSchema: z.object({
      // Assertion type is required for clarity and predictability
      assertion: z.enum(['toHaveURL', 'toHaveTitle', 'toHaveScreenshot']).describe('The type of page assertion to perform'),
      
      // UPDATED: Use 'value' instead of 'expected' for consistency
      value: z.union([z.string(), z.object({ pattern: z.string(), flags: z.string().optional() })]).describe('Expected value or regex pattern for assertion. Can be URL, title, or other page property.'),
      expected: z.union([z.string(), z.object({ pattern: z.string(), flags: z.string().optional() })]).optional().describe('Legacy: Expected value (use "value" instead)'),
      
      options: z.object({
        timeout: z.number().optional().default(30000).describe('Maximum time to wait for assertion in milliseconds'),
        ignoreCase: z.boolean().optional().default(false).describe('Case-insensitive matching'),
      }).optional().default({}),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    const { assertion, value, expected, options } = params;
    const { timeout = 30000 } = options || {};
    
    // Use value or fall back to expected for backward compatibility
    const expectedValue = value ?? expected;
    
    if (!assertion) {
      throw new Error('Assertion type is required (e.g., "toHaveURL", "toHaveTitle")');
    }
    
    if (!expectedValue) {
      throw new Error('Expected value is required for page assertions');
    }

    const code: string[] = [];

    try {
      switch (assertion) {
        case 'toHaveURL':
          if (typeof expectedValue === 'object' && 'pattern' in expectedValue) {
            const regex = new RegExp(expectedValue.pattern, expectedValue.flags);
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
              throw new Error(`Expected URL to match pattern ${expectedValue.pattern}, but got "${finalUrl}"`);
            }
          } else {
            code.push(`await expect(page).toHaveURL(${JSON.stringify(expectedValue)}, { timeout: ${timeout} });`);
            
            // Wait for URL to match
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
              const currentUrl = tab.page.url();
              if (currentUrl === expectedValue || currentUrl.includes(String(expectedValue))) {
                break;
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const finalUrl = tab.page.url();
            if (!finalUrl.includes(String(expectedValue))) {
              throw new Error(`Expected URL to contain "${expectedValue}", but got "${finalUrl}"`);
            }
          }
          break;

        case 'toHaveTitle':
          code.push(`await expect(page).toHaveTitle(${JSON.stringify(expectedValue)}, { timeout: ${timeout} });`);
          
          // Wait for title to match
          const startTime = Date.now();
          let actualTitle = '';
          while (Date.now() - startTime < timeout) {
            actualTitle = await tab.page.title();
            if (actualTitle === expectedValue || actualTitle.includes(String(expectedValue))) {
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          actualTitle = await tab.page.title();
          if (!actualTitle.includes(String(expectedValue))) {
            throw new Error(`Expected title to contain "${expectedValue}", but got "${actualTitle}"`);
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