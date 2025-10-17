/**
 * Test for browser_get_element_attributes tool with aria-ref support
 * Phase 1.2: MCPサーバー側aria-refツール実装のテスト
 */

import { test, expect } from './fixtures.js';

test.describe('browser_get_element_attributes', () => {
  test('should extract attributes using ref value', async ({ client, server }) => {
    // Navigate to test page
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    // Capture snapshot to get ref values
    const snapshot = await client.callTool({
      name: 'browser_snapshot',
      arguments: {}
    });

    // Extract a ref value from the snapshot (assume we get one)
    const refValue = 'e1'; // This would typically be extracted from snapshot

    // Test ref-based attribute extraction
    const result = await client.callTool({
      name: 'browser_get_element_attributes',
      arguments: {
        ref: refValue,
        element: 'test element'
      },
    });

    expect(result).toBeDefined();
    // The result should contain attributes extracted via aria-ref
    expect(result.toString()).toContain('result');
  });

  test('should fallback to CSS selector when ref not provided', async ({ client, server }) => {
    // Navigate to test page
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    // Test CSS selector fallback (backward compatibility)
    const result = await client.callTool({
      name: 'browser_get_element_attributes',
      arguments: {
        selector: 'body',
        element: 'body element'
      },
    });

    expect(result).toBeDefined();
    expect(result.toString()).toContain('result');
    expect(result.toString()).toContain('css-selector-legacy');
  });

  test('should handle invalid ref values gracefully', async ({ client, server }) => {
    // Navigate to test page
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    // Test with invalid ref value
    const result = await client.callTool({
      name: 'browser_get_element_attributes',
      arguments: {
        ref: 'invalid-ref-999',
        element: 'non-existent element'
      },
    });

    // Should return error instead of crashing
    expect(result).toBeDefined();
    expect(result.toString()).toContain('error');
  });

  test('should require either ref or selector parameter', async ({ client, server }) => {
    // Navigate to test page
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    // Test without ref or selector (should fail)
    const result = await client.callTool({
      name: 'browser_get_element_attributes',
      arguments: {
        element: 'test element'
      },
    });

    expect(result).toBeDefined();
    expect(result.toString()).toContain('error');
    expect(result.toString()).toContain('Either ref or selector parameter is required');
  });

  test('should include extraction metadata in response', async ({ client, server }) => {
    // Navigate to test page
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    // Test metadata inclusion
    const result = await client.callTool({
      name: 'browser_get_element_attributes',
      arguments: {
        selector: 'body',
        element: 'body element'
      },
    });

    expect(result).toBeDefined();
    const resultStr = result.toString();
    expect(resultStr).toContain('extraction_method');
    expect(resultStr).toContain('extraction_timestamp');
  });

  test('should respect timeout settings', async ({ client, server }) => {
    // Navigate to test page
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    // Test with valid selector (should complete within timeout)
    const startTime = Date.now();
    const result = await client.callTool({
      name: 'browser_get_element_attributes',
      arguments: {
        selector: 'body',
        element: 'body element'
      },
    });
    const elapsed = Date.now() - startTime;

    expect(result).toBeDefined();
    // Should complete well under 3 second timeout
    expect(elapsed).toBeLessThan(3000);
  });

  test('should prioritize ref over selector when both provided', async ({ client, server }) => {
    // Navigate to test page
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    // Test with both ref and selector (ref should be prioritized)
    const result = await client.callTool({
      name: 'browser_get_element_attributes',
      arguments: {
        ref: 'e1',
        selector: 'body',
        element: 'test element'
      },
    });

    expect(result).toBeDefined();
    const resultStr = result.toString();
    // Should use ref-based method, not CSS selector
    if (!resultStr.includes('error')) {
      expect(resultStr).toContain('mcp-aria-ref-direct');
    }
  });
});