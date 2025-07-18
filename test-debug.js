import playwright from 'playwright';
import { PageSnapshot } from './lib/pageSnapshot.js';

async function testPageSnapshot() {
    console.log('Starting test...');
    
    // ブラウザを起動
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // ホテルサイトに移動
    console.log('Navigating to hotel site...');
    await page.goto('https://hotel-example-site.takeyaqa.dev/ja/');
    
    // 少し待機
    console.log('Waiting for page load...');
    await page.waitForTimeout(3000);
    
    // PageSnapshotでスナップショットを取得
    console.log('Creating snapshot...');
    const snapshot = await PageSnapshot.create(page);
    
    console.log('=== Snapshot Result ===');
    console.log(snapshot.text());
    
    await browser.close();
    console.log('Test completed');
}

testPageSnapshot().catch(console.error);