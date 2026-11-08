const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');

const contentScript = readFileSync(require.resolve('../content.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

async function setup(t, buttonMarkup = '') {
  const dom = new JSDOM(`<p id="passage">A sufficiently long selected passage.</p>${buttonMarkup}`, {
    url: 'https://chatgpt.com/c/test',
    runScripts: 'outside-only'
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: async () => {} }
  });
  select(window, 'passage');
  window.eval(contentScript);
  await flush();
  return window;
}

function select(window, id) {
  const range = window.document.createRange();
  range.selectNodeContents(window.document.getElementById(id));
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
}

function assertThreadButton(button) {
  assert.equal(button.dataset.tangentHijacked, 'true');
  assert.equal(button.textContent.trim(), 'Open Thread');
}

test('current ChatGPT button opens a thread without invoking the main-chat action', async t => {
  const window = await setup(t);
  const button = window.document.createElement('button');
  // Current ChatGPT has no btn-secondary class.
  button.className = 'no-drag cursor-interaction items-center rounded-full';
  button.textContent = 'Ask ChatGPT';
  let nativeClicks = 0;
  button.addEventListener('click', () => nativeClicks++);
  window.document.body.appendChild(button);
  await flush();
  assertThreadButton(button);
  button.click();
  assert.equal(nativeClicks, 0);
  const iframe = window.document.querySelector('.thread-iframe');
  assert.ok(iframe);
  assert.equal(iframe.src, 'https://chatgpt.com/?temporary-chat=true#thread-opener-1');
  assert.equal(window.sessionStorage.getItem('claude-thread-opener-context-1'),
    'A sufficiently long selected passage.');
});

test('selection button present before initialization is detected', async t => {
  const window = await setup(t, '<button>Ask ChatGPT</button>');
  assertThreadButton(window.document.querySelector('button'));
});

test('legacy button nested in a newly inserted tooltip still works', async t => {
  const window = await setup(t);
  const tooltip = window.document.createElement('div');
  tooltip.innerHTML = '<button class="btn-secondary"><span>Ask ChatGPT</span></button>';
  window.document.body.appendChild(tooltip);
  await flush();
  assertThreadButton(tooltip.querySelector('button'));
});

test('text inserted into an existing button is detected', async t => {
  const window = await setup(t, '<button></button>');
  const button = window.document.querySelector('button');
  button.appendChild(window.document.createTextNode('Ask ChatGPT'));
  await flush();
  assertThreadButton(button);
});

test('character-data updates inside an existing button are detected', async t => {
  const window = await setup(t, '<button><span>Ask</span></button>');
  const button = window.document.querySelector('button');
  button.querySelector('span').firstChild.data = 'Ask ChatGPT';
  await flush();
  assertThreadButton(button);
});

test('unrelated buttons and selections below the configured minimum are ignored', async t => {
  const window = await setup(t);
  window.document.getElementById('passage').textContent = 'short';
  select(window, 'passage');
  const button = window.document.createElement('button');
  button.textContent = 'Ask ChatGPT';
  window.document.body.appendChild(button);
  await flush();
  assert.equal(button.dataset.tangentHijacked, undefined);
  window.document.getElementById('passage').textContent = 'Another sufficiently long passage.';
  select(window, 'passage');
  const unrelated = window.document.createElement('button');
  unrelated.textContent = 'Ask ChatGPT about pricing';
  window.document.body.appendChild(unrelated);
  await flush();
  assert.equal(unrelated.dataset.tangentHijacked, undefined);
});

test('a reused button captures the latest selected passage on click', async t => {
  const window = await setup(t);
  const button = window.document.createElement('button');
  button.className = 'btn-secondary';
  button.textContent = 'Ask ChatGPT';
  window.document.body.appendChild(button);
  await flush();
  assertThreadButton(button);
  const passage = window.document.createElement('p');
  passage.id = 'second';
  passage.textContent = 'A different passage selected later.';
  window.document.body.appendChild(passage);
  select(window, 'second');
  button.click();
  assert.equal(window.sessionStorage.getItem('claude-thread-opener-context-1'), passage.textContent);
});
