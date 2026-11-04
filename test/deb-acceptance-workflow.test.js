'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/deb-acceptance.yml'), 'utf8');
const smoke = fs.readFileSync(path.join(__dirname, '../scripts/xvfb-smoke.sh'), 'utf8');

test('Ubuntu package acceptance is restricted to the canonical trusted branch', () => {
    assert.match(workflow, /branches:\s*\[feat\/stable-update-hardening\]/);
    assert.match(workflow, /github\.repository == 'UdayaSri0\/whatsapp-electron-main'/);
    assert.match(workflow, /github\.ref == 'refs\/heads\/feat\/stable-update-hardening'/);
});

test('Ubuntu package acceptance is read-only and does not expose or publish credentials', () => {
    assert.match(workflow, /permissions:\s*\n\s+contents: read/);
    assert.match(workflow, /persist-credentials: false/);
    assert.doesNotMatch(workflow, /secrets\.|upload-artifact|contents:\s*write|gh release/);
});

test('Xvfb acceptance keeps Electron sandboxing enabled', () => {
    assert.doesNotMatch(smoke, /--no-sandbox/);
    assert.match(smoke, /alt\+h/);
    assert.match(smoke, /Personal: PASS/);
    assert.match(smoke, /Business: PASS/);
    assert.match(smoke, /WM_CLASS/);
    assert.match(smoke, /getactivewindow/);
    assert.match(smoke, /tesseract/);
    assert.match(smoke, /tee "\$results_file"/);
    assert.doesNotMatch(smoke, /RESULT_FILE=|chgrp whatsapp-acceptance/);
});
