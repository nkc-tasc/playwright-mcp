/**
 * HTML属性取得ツール - .nth()禁止違反解決のための汎用機能
 */

import { z } from 'zod';
import { defineTool } from './tool.js';

const getElementAttributes = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_get_element_attributes',
    title: 'Get HTML attributes of an element',
    description: 'Extract actual HTML attributes (id, name, type, class, etc.) from a specific element by ref ID',
    inputSchema: z.object({
      ref: z.string().describe('Element reference ID (e.g., "e15")'),
      description: z.string().optional().describe('Human-readable description of the element')
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    
    try {
      // JavaScript実行でHTML属性を取得
      const attributes = await tab.page.evaluate((refId) => {
        // refIDから要素を特定するロジック
        // 通常はdata-ref属性やアクセシビリティツリーから要素を見つける
        const elements = Array.from(document.querySelectorAll('*'));
        
        // アクセシビリティツリーから要素を特定
        let targetElement = null;
        
        // 複数の方法で要素を特定
        for (const element of elements) {
          // data-ref属性での検索
          if (element.getAttribute('data-ref') === refId) {
            targetElement = element;
            break;
          }
          
          // aria-describedby属性での検索  
          if (element.getAttribute('aria-describedby') === refId) {
            targetElement = element;
            break;
          }
        }
        
        // フォールバック: DOM順序での特定（refIDの数値部分を使用）
        if (!targetElement) {
          const refNum = parseInt(refId.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(refNum) && refNum >= 0 && refNum < elements.length) {
            targetElement = elements[refNum];
          }
        }
        
        if (!targetElement) {
          return { error: `Element with ref ${refId} not found` };
        }
        
        // HTML属性を全て取得
        const attrs: Record<string, string> = {};
        
        // 標準的な属性
        const standardAttrs = [
          'id', 'name', 'type', 'class', 'placeholder', 'value',
          'href', 'src', 'alt', 'title', 'role', 'aria-label',
          'data-testid', 'data-test', 'data-cy', 'data-automation',
          'autocomplete', 'required', 'disabled', 'readonly'
        ];
        
        // 標準属性の取得
        for (const attr of standardAttrs) {
          const value = targetElement.getAttribute(attr);
          if (value !== null) {
            attrs[attr] = value;
          }
        }
        
        // カスタムdata-*属性の取得
        for (const attr of targetElement.getAttributeNames()) {
          if (attr.startsWith('data-') && !attrs[attr]) {
            attrs[attr] = targetElement.getAttribute(attr) || '';
          }
        }
        
        // 要素の基本情報も含める
        const elementInfo = {
          tagName: targetElement.tagName.toLowerCase(),
          textContent: targetElement.textContent?.trim() || '',
          innerHTML: targetElement.innerHTML.substring(0, 200), // 先頭200文字のみ
          attributes: attrs
        };
        
        return elementInfo;
        
      }, params.ref);
      
      return {
        code: [
          `// HTML属性取得: ${params.ref}`,
          `const elementAttributes = await page.evaluate((refId) => {`,
          `  // 要素特定と属性取得ロジック`,
          `  // ... (実装詳細は省略)`,
          `}, '${params.ref}');`
        ],
        result: attributes,
        captureSnapshot: false,
        waitForNetwork: false
      };
      
    } catch (error: any) {
      return {
        code: [`// 属性取得エラー: ${params.ref}`],
        error: `HTML属性取得失敗: ${error.message}`,
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
    description: 'Extract HTML attributes from multiple elements at once for performance',
    inputSchema: z.object({
      refs: z.array(z.string()).describe('Array of element reference IDs'),
      description: z.string().optional().describe('Description of the bulk operation')
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    
    try {
      const bulkAttributes = await tab.page.evaluate((refIds) => {
        const elements = Array.from(document.querySelectorAll('*'));
        const results: Record<string, any> = {};
        
        for (const refId of refIds) {
          let targetElement = null;
          
          // 要素特定ロジック（上記と同様）
          for (const element of elements) {
            if (element.getAttribute('data-ref') === refId) {
              targetElement = element;
              break;
            }
          }
          
          // フォールバック
          if (!targetElement) {
            const refNum = parseInt(refId.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(refNum) && refNum >= 0 && refNum < elements.length) {
              targetElement = elements[refNum];
            }
          }
          
          if (targetElement) {
            const attrs: Record<string, string> = {};
            
            // 属性取得（上記と同じロジック）
            const standardAttrs = [
              'id', 'name', 'type', 'class', 'placeholder', 'value',
              'href', 'src', 'alt', 'title', 'role', 'aria-label',
              'data-testid', 'data-test', 'data-cy'
            ];
            
            for (const attr of standardAttrs) {
              const value = targetElement.getAttribute(attr);
              if (value !== null) {
                attrs[attr] = value;
              }
            }
            
            results[refId] = {
              tagName: targetElement.tagName.toLowerCase(),
              textContent: targetElement.textContent?.trim() || '',
              attributes: attrs
            };
          } else {
            results[refId] = { error: `Element ${refId} not found` };
          }
        }
        
        return results;
        
      }, params.refs);
      
      return {
        code: [
          `// 一括属性取得: ${params.refs.join(', ')}`,
          `const bulkAttributes = await page.evaluate((refIds) => {`,
          `  // 複数要素の属性を一括取得`,
          `  // ... (実装詳細は省略)`,
          `}, ${JSON.stringify(params.refs)});`
        ],
        result: bulkAttributes,
        captureSnapshot: false,
        waitForNetwork: false
      };
      
    } catch (error: any) {
      return {
        code: [`// 一括属性取得エラー`],
        error: `一括属性取得失敗: ${error.message}`,
        captureSnapshot: false,
        waitForNetwork: false
      };
    }
  },
});

export default [
  getElementAttributes,
  getBulkAttributes
];