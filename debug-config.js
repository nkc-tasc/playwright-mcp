#!/usr/bin/env node
/**
 * Debug configuration merging logic for MCP server
 */

import { resolveCLIConfig, configFromCLIOptions } from './lib/config.js';
import { contextFactory } from './lib/browserContextFactory.js';

async function debugConfig() {
  console.log('=== MCP Server Configuration Debug ===');
  
  // Simulate CLI options as they would be passed
  const cliOptions = {
    config: 'mcp-config.json',
    port: 17777,
    headless: true,
    isolated: true,
    browser: 'chromium',
    sandbox: false
  };
  
  console.log('\n1. CLI Options:');
  console.log(JSON.stringify(cliOptions, null, 2));
  
  // Get config from CLI options only
  const cliConfig = configFromCLIOptions(cliOptions);
  console.log('\n2. Config from CLI Options:');
  console.log(JSON.stringify(cliConfig, null, 2));
  
  // Resolve full config (includes file, env, and CLI)
  const fullConfig = await resolveCLIConfig(cliOptions);
  console.log('\n3. Final Resolved Config:');
  console.log(JSON.stringify(fullConfig, null, 2));
  
  // Check which context factory would be used
  const factory = contextFactory(fullConfig.browser);
  console.log('\n4. Selected Context Factory:');
  console.log(`Factory Name: ${factory.constructor.name}`);
  console.log(`Browser Config:`, JSON.stringify(fullConfig.browser, null, 2));
  
  console.log('\n=== Debug Complete ===');
}

debugConfig().catch(console.error);