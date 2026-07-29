import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DPSProps, IBSCBSDps } from '../src/domain/dps';

test('IBSCBSDps tem os campos do DPS de tributação integral', () => {
  const ibs: IBSCBSDps = { finNFSe: '0', cIndOp: '000000', indDest: 0, cst: '000', cClassTrib: '000001' };
  const dps: Pick<DPSProps, 'ibsCbs'> = { ibsCbs: ibs };
  assert.equal(dps.ibsCbs?.cst, '000');
  assert.equal(dps.ibsCbs?.cClassTrib, '000001');
});
