import { chromium } from 'playwright';
import { PageSnapshot } from './lib/pageSnapshot.js';

async function testAttributeExtraction() {
  console.log('🔧 属性抽出テスト開始');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // テスト用のHTMLページを作成
  await page.setContent(`
    <html>
      <body>
        <button class="btn btn-primary" id="login-button" data-test="login">ログイン</button>
        <input type="email" name="email" placeholder="メールアドレス" required>
        <a href="/signup" class="nav-link">会員登録</a>
      </body>
    </html>
  `);
  
  // PageSnapshotを使って属性情報を取得
  const snapshot = await PageSnapshot.create(page);
  const snapshotText = snapshot.text();
  
  console.log('📄 スナップショット結果:');
  console.log(snapshotText);
  
  // 属性情報が含まれているかチェック
  const hasAttributes = snapshotText.includes('class:') || 
                       snapshotText.includes('id:') || 
                       snapshotText.includes('data-test:');
  
  console.log(`✅ 属性情報検出: ${hasAttributes ? '成功' : '失敗'}`);
  
  await browser.close();
  return hasAttributes;
}

testAttributeExtraction().catch(console.error);