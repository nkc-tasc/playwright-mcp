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

// Enhanced session state management for page change detection
type PageState = {
  url: string;
  title: string;
  elemCount: number;
  domStructureHash: string;
  formElementCount: number;
  linkElementCount: number;
  headingCount: number;
};

// Tab-based session state storage using WeakMap for proper context isolation
const sessionStates = new WeakMap<any, PageState>();

// Utility functions for numerical feature-based change detection

async function collectPageState(page: any): Promise<PageState> {
  return await page.evaluate(() => {
    const url = window.location.href;
    const title = document.title;
    const elemCount = document.querySelectorAll('*').length;
    
    // Calculate DOM structure hash (simplified)
    const structuralElements = ['nav', 'header', 'footer', 'main', 'section', 'article', 'aside'];
    const structureSignature = structuralElements
      .map(tag => document.querySelectorAll(tag).length)
      .join('-');
    const domStructureHash = btoa(structureSignature).substring(0, 16);
    
    // Count specific element types for more precise detection
    const formElementCount = document.querySelectorAll('form, input, textarea, select, button[type="submit"]').length;
    const linkElementCount = document.querySelectorAll('a[href], area[href]').length;
    const headingCount = document.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
    
    return {
      url,
      title,
      elemCount,
      domStructureHash,
      formElementCount,
      linkElementCount,
      headingCount
    };
  });
}

function calculateUrlChangeScore(previousUrl: string, currentUrl: string): number {
  if (!previousUrl || !currentUrl) return 1.0;
  
  try {
    const prev = new URL(previousUrl);
    const curr = new URL(currentUrl);
    
    // Different domains = complete change
    if (prev.hostname !== curr.hostname) return 1.0;
    
    // Same URL = no change
    if (previousUrl === currentUrl) return 0.0;
    
    // Path change analysis
    const prevParts = prev.pathname.split('/').filter(p => p);
    const currParts = curr.pathname.split('/').filter(p => p);
    
    // Calculate path similarity (Jaccard similarity)
    const allParts = new Set([...prevParts, ...currParts]);
    const commonParts = new Set(prevParts.filter(p => currParts.includes(p)));
    
    if (allParts.size === 0) return 0.0;
    const pathSimilarity = commonParts.size / allParts.size;
    
    // Higher path difference = higher change score
    const pathChangeScore = 1 - pathSimilarity;
    
    // Query string changes have lower impact
    const queryChanged = prev.search !== curr.search ? 0.3 : 0.0;
    const hashChanged = prev.hash !== curr.hash ? 0.1 : 0.0;
    
    return Math.min(1.0, pathChangeScore + queryChanged + hashChanged);
  } catch {
    // Fallback for invalid URLs
    return previousUrl === currentUrl ? 0.0 : 1.0;
  }
}

function calculateNumericalChanges(previous: PageState | null, current: PageState) {
  if (!previous) {
    // First call - everything is considered changed
    return {
      url: 1.0,
      title: 1.0,
      elem: 1.0,
      domStructure: 1.0,
      formElements: 1.0,
      linkElements: 1.0,
    };
  }
  
  // URL change with sophisticated scoring
  const urlScore = calculateUrlChangeScore(previous.url, current.url);
  
  // Title change (binary but could be enhanced with similarity)
  const titleScore = previous.title !== current.title ? 1.0 : 0.0;
  
  // Element count change (relative change with ceiling)
  const elemCountChange = previous.elemCount === 0 
    ? 1.0 
    : Math.min(1.0, Math.abs(current.elemCount - previous.elemCount) / previous.elemCount);
  
  // DOM structure change (hash-based)
  const domStructureScore = previous.domStructureHash !== current.domStructureHash ? 1.0 : 0.0;
  
  // Form elements change (relative change)
  const formElementsScore = previous.formElementCount === 0 && current.formElementCount === 0 
    ? 0.0 
    : (previous.formElementCount === 0 
      ? (current.formElementCount > 0 ? 1.0 : 0.0)
      : Math.min(1.0, Math.abs(current.formElementCount - previous.formElementCount) / previous.formElementCount));
  
  // Link elements change (relative change) 
  const linkElementsScore = previous.linkElementCount === 0 && current.linkElementCount === 0
    ? 0.0
    : (previous.linkElementCount === 0
      ? (current.linkElementCount > 0 ? 1.0 : 0.0)
      : Math.min(1.0, Math.abs(current.linkElementCount - previous.linkElementCount) / previous.linkElementCount));
  
  return {
    url: urlScore,
    title: titleScore,
    elem: elemCountChange,
    domStructure: domStructureScore,
    formElements: formElementsScore,
    linkElements: linkElementsScore,
  };
}

function calculateWeightedScore(components: any, weights: any): number {
  return (
    weights.url * components.url +
    weights.title * components.title +
    weights.elem * components.elem +
    weights.domStructure * components.domStructure +
    weights.formElements * components.formElements +
    weights.linkElements * components.linkElements
  );
}

function determineChangeType(components: any): string {
  if (components.url > 0.7) return 'navigation';
  if (components.domStructure > 0.5 || components.formElements > 0.5) return 'structural';
  if (components.title > 0 || components.elem > 0.3) return 'content';
  return 'none';
}

// Enhanced default weights for numerical feature-based change detection
const DEFAULT_WEIGHTS = {
  url: 0.4,
  title: 0.15, 
  elem: 0.15,
  domStructure: 0.2,
  formElements: 0.05,
  linkElements: 0.05,
};

const detectPageChangeSchema = z.object({
  threshold: z.number().optional().default(0.30).describe('Threshold for significant change detection (0.0-1.0)'),
  weights: z.object({
    url: z.number().optional().describe('Weight for URL changes'),
    title: z.number().optional().describe('Weight for title changes'),
    elem: z.number().optional().describe('Weight for element count changes'),
    domStructure: z.number().optional().describe('Weight for DOM structure changes'),
    formElements: z.number().optional().describe('Weight for form element changes'),
    linkElements: z.number().optional().describe('Weight for link element changes'),
  }).optional().describe('Weights for different change types'),
  seed: z.boolean().optional().default(false).describe('Initialize state without detection (returns false)'),
});

const detectPageChange = defineTool({
  capability: 'core',
  schema: {
    name: 'detect_page_change',
    title: 'Detect page changes',
    description: 'Detect significant page state changes for PageObject splitting',
    inputSchema: detectPageChangeSchema,
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    const page = tab.page;
    
    // Get enhanced current page state with numerical features
    const current = await collectPageState(page);

    // Use tab object as WeakMap key for proper context isolation
    const previous = sessionStates.get(tab) ?? null;

    // Handle seed mode - update state without detection
    if (params.seed || previous === null) {
      sessionStates.set(tab, current);
      
      // Debug logging for seed mode
      console.log(`[DEBUG] detect_page_change: Seed mode - state updated for ${current.url}`);
      
      // Return non-significant change for seed calls
      return {
        code: [
          '// Page change detection - seed mode',
          `// State initialized for: ${current.url}`,
        ],
        captureSnapshot: false,
        waitForNetwork: false,
        resultOverride: {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              significant_change: false,
              score: 0.0,
              change_type: 'seed',
              components: {},
              current: {
                url: current.url,
                title: current.title,
                elemCount: current.elemCount,
              },
              previous: null,
              timestamp: new Date().toISOString(),
            }, null, 2),
          }],
        },
      };
    }

    // Calculate numerical feature-based change components
    const changeComponents = calculateNumericalChanges(previous, current);

    // Apply enhanced weights (use provided weights or defaults)
    const weights = { ...DEFAULT_WEIGHTS, ...params.weights };
    const score = calculateWeightedScore(changeComponents, weights);

    // Determine change significance
    const significant_change = score >= params.threshold;
    const change_type = determineChangeType(changeComponents);

    // Debug logging for normal detection
    console.log(`[DEBUG] detect_page_change: Score=${score.toFixed(3)}, Significant=${significant_change}, Type=${change_type}`);
    console.log(`[DEBUG] detect_page_change: URL ${previous?.url} → ${current.url}`);
    console.log(`[DEBUG] detect_page_change: Components`, changeComponents);

    // Update session state
    sessionStates.set(tab, current);

    // Prepare result data
    const result = {
      significant_change,
      score,
      change_type,
      components: changeComponents,
      current: {
        url: current.url,
        title: current.title,
        elemCount: current.elemCount,
      },
      previous: previous ? {
        url: previous.url,
        title: previous.title,
        elemCount: previous.elemCount,
      } : null,
      timestamp: new Date().toISOString(),
    };

    return {
      code: [
        '// Page change detection completed',
        `// Change detected: ${significant_change} (score: ${score.toFixed(3)})`,
        `// Change type: ${change_type}`,
      ],
      captureSnapshot: false,
      waitForNetwork: false,
      resultOverride: {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      },
    };
  },
});

export default [detectPageChange];