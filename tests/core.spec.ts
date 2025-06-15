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

import { test, expect } from './fixtures.js';

test('browser_navigate', async ({ client, server }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// Navigate to ${server.HELLO_WORLD}
await page.goto('${server.HELLO_WORLD}');
\`\`\`

- Page URL: ${server.HELLO_WORLD}
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- generic [ref=e1]: Hello, world!
\`\`\`
`
  );
});

test('browser_click', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <button>Submit</button>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Submit button',
      ref: 'e2',
    },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// Click Submit button
await page.getByRole('button', { name: 'Submit' }).click();
\`\`\`

- Page URL: ${server.PREFIX}
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- button "Submit" [ref=e2]
\`\`\`
`);
});

test('browser_select_option', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <select>
      <option value="foo">Foo</option>
      <option value="bar">Bar</option>
    </select>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_select_option',
    arguments: {
      element: 'Select',
      ref: 'e2',
      values: ['bar'],
    },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// Select options [bar] in Select
await page.getByRole('combobox').selectOption(['bar']);
\`\`\`

- Page URL: ${server.PREFIX}
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- combobox [ref=e2]:
  - option "Foo"
  - option "Bar" [selected]
\`\`\`
`);
});

test('browser_select_option (multiple)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <select multiple>
      <option value="foo">Foo</option>
      <option value="bar">Bar</option>
      <option value="baz">Baz</option>
    </select>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_select_option',
    arguments: {
      element: 'Select',
      ref: 'e2',
      values: ['bar', 'baz'],
    },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// Select options [bar, baz] in Select
await page.getByRole('listbox').selectOption(['bar', 'baz']);
\`\`\`

- Page URL: ${server.PREFIX}
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- listbox [ref=e2]:
  - option "Foo" [ref=e3]
  - option "Bar" [selected] [ref=e4]
  - option "Baz" [selected] [ref=e5]
\`\`\`
`);
});

test('browser_type', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <input type='keypress' onkeypress="console.log('Key pressed:', event.key, ', Text:', event.target.value)"></input>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });
  await client.callTool({
    name: 'browser_type',
    arguments: {
      element: 'textbox',
      ref: 'e2',
      text: 'Hi!',
      submit: true,
    },
  });
  expect(await client.callTool({
    name: 'browser_console_messages',
  })).toHaveTextContent('[LOG] Key pressed: Enter , Text: Hi!');
});

test('browser_type (slowly)', async ({ client, server }) => {
  server.setContent('/', `
    <input type='text' onkeydown="console.log('Key pressed:', event.key, 'Text:', event.target.value)"></input>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });
  await client.callTool({
    name: 'browser_type',
    arguments: {
      element: 'textbox',
      ref: 'e2',
      text: 'Hi!',
      submit: true,
      slowly: true,
    },
  });
  expect(await client.callTool({
    name: 'browser_console_messages',
  })).toHaveTextContent([
    '[LOG] Key pressed: H Text: ',
    '[LOG] Key pressed: i Text: H',
    '[LOG] Key pressed: ! Text: Hi',
    '[LOG] Key pressed: Enter Text: Hi!',
  ].join('\n'));
});

test('browser_resize', async ({ client, server }) => {
  server.setContent('/', `
    <title>Resize Test</title>
    <body>
      <div id="size">Waiting for resize...</div>
      <script>new ResizeObserver(() => { document.getElementById("size").textContent = \`Window size: \${window.innerWidth}x\${window.innerHeight}\`; }).observe(document.body);
      </script>
    </body>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_resize',
    arguments: {
      width: 390,
      height: 780,
    },
  });
  expect(response).toContainTextContent(`- Ran Playwright code:
\`\`\`js
// Resize browser window to 390x780
await page.setViewportSize({ width: 390, height: 780 });
\`\`\``);
  await expect.poll(() => client.callTool({ name: 'browser_snapshot' })).toContainTextContent('Window size: 390x780');
});

test('browser_fill', async ({ client, server }) => {
  server.setContent('/', `
    <title>Fill Test</title>
    <input type="text" placeholder="Enter text here">
    <textarea placeholder="Enter text area content"></textarea>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_fill',
    arguments: {
      element: 'text input field',
      ref: 'e2',
      value: 'Hello World!',
    },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// Fill "Hello World!" into text input field
await page.getByRole('textbox', { name: 'Enter text here' }).fill('Hello World!');
\`\`\`

- Page URL: ${server.PREFIX}
- Page Title: Fill Test
- Page Snapshot
\`\`\`yaml
- generic [ref=e1]:
  - textbox "Enter text here" [ref=e2]: Hello World!
  - textbox "Enter text area content" [ref=e3]
\`\`\`
`);
});

test('browser_check', async ({ client, server }) => {
  server.setContent('/', `
    <title>Check Test</title>
    <input type="checkbox" name="option1" value="1" id="option1">
    <label for="option1">Option 1</label>
    <input type="radio" name="choice" value="a" id="choiceA">
    <label for="choiceA">Choice A</label>
    <input type="radio" name="choice" value="b" id="choiceB">
    <label for="choiceB">Choice B</label>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_check',
    arguments: {
      element: 'Option 1 checkbox',
      ref: 'e2',
    },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// Check Option 1 checkbox
await page.getByRole('checkbox', { name: 'Option' }).check();
\`\`\`

- Page URL: ${server.PREFIX}
- Page Title: Check Test
- Page Snapshot
\`\`\`yaml
- generic [ref=e1]:
  - checkbox "Option 1" [checked] [ref=e2]
  - generic [ref=e3]: Option 1
  - radio "Choice A" [ref=e4]
  - generic [ref=e5]: Choice A
  - radio "Choice B" [ref=e6]
  - generic [ref=e7]: Choice B
\`\`\`
`);
});
