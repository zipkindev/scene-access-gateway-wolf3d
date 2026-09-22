'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const expected = Object.freeze({
  'integration/future-wolf3d-crt.js': 'f10310ef9dfb022fff945fe4abb391a0e58db564bfdc1520a557b0e5e4fff488',
  'runtime/index.html': 'eb1167bf7d99913fc3dd7f54d31468c01d14f8bdfefe8eaf39324c2f8618c1cf',
  'runtime/css/style.css': 'c49aaf832f6cbca8f0e8876e28277704225685e129586e5541ef0c8f5cd7cfb8',
  'runtime/js/game.js': '3263e04b44171f0f71d11bd0fad141e29aef999a1f454ea642447f7943bd80f7',
  'runtime/js/main.js': '48e174329dbcbe6e94eee2bd8cbc9462c0314de59b5972860bfce7d2bfb770f6',
});

const read = (file) => fs.readFileSync(path.join(root, file));
const text = (file) => read(file).toString('utf8');
const digest = (file) => crypto.createHash('sha256').update(read(file)).digest('hex');

test('tracked Wolf extension files exactly match the verified release 78 source', () => {
  for (const [file, sha256] of Object.entries(expected)) assert.equal(digest(file), sha256, file);
});

test('release 78 keeps the accepted compositor, filter sequence, labels, and score return', () => {
  const controller = text('integration/future-wolf3d-crt.js');
  const main = text('runtime/js/main.js');
  for (const marker of ['wolf-crt-compositor', 'drawLiveGame(progress)', 'prepareMask(progress)',
    'playRealStartup', 'playRealGameReveal', 'playRealShutdown', "buildTextPlate('WOLF 3D BOOT')",
    "buildTextPlate('SHUTTING DOWN')", "mode === 'on' ? .105 : .09", "event.data.type === 'uwolf-score-finished'"]) {
    assert.ok(controller.includes(marker), marker);
  }
  const filterOn = controller.indexOf("elapsed >= 1120) screen.classList.add('crt-filter-active')");
  const bootPixels = controller.indexOf('elapsed >= 1180');
  const filterOff = controller.indexOf("screen.classList.remove('crt-filter-active');",
    controller.indexOf('function playRealShutdown'));
  const lineRelease = controller.indexOf("drawScanlines(Math.min(1, (elapsed - 2050) / 1080), true)");
  assert.ok(filterOn >= 0 && filterOn < bootPixels);
  assert.ok(filterOff >= 0 && filterOff < lineRelease);
  assert.ok(main.includes("fetch('/api/arcade/scores', { method: 'POST'"));
  assert.ok(main.includes("$('wolfScoreEntry').showModal()"));
  assert.doesNotMatch(controller, /buildTextPlate\('(?:WOLF 3D CRT BOOT|CRT SHUTTING DOWN)'\)/);
});
