import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipBase64, gunzipBase64 } from '../src/shared/helpers/compression';

test('gzipBase64 seguido de gunzipBase64 preserva o conteúdo', () => {
  const xml = '<DPS><infDPS Id="DPS000000000000000000000000000000000000000001">x</infDPS></DPS>';
  const compressed = gzipBase64(xml);
  assert.notEqual(compressed, xml);
  assert.match(compressed, /^[A-Za-z0-9+/=]+$/); // base64
  assert.equal(gunzipBase64(compressed), xml);
});
