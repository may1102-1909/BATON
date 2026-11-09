import test from 'node:test';
import assert from 'node:assert/strict';
import {redactData,redactString} from '../server/redact.js';
test('redaction removes assignments without retaining captured secret', () => {
  const secret='abcdefghijklmnopqrstuvwxyz1234567890';
  assert.ok(!redactString(`password=${secret}`).includes(secret));
  assert.deepEqual(redactData({nested:{api_key:secret}}),{nested:{api_key:'[REDACTED]'}});
  assert.equal(redactString('member@example.com'), '[REDACTED]');
});
test('evidence hashes survive, private keys and bearer credentials do not', () => {
  const sha='a'.repeat(40);
  assert.equal(redactString(sha),sha);
  assert.equal(redactString('-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----'),'[REDACTED]');
  assert.equal(redactString('Bearer example-secret-value'), '[REDACTED]');
});
