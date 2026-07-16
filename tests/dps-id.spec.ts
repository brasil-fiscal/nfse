import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarIdDps } from '../src/shared/helpers/dps-id';

test('gerarIdDps monta Id no formato DPS[0-9]{42} com CNPJ', () => {
  const id = gerarIdDps({
    codigoMunicipio: '3106200',
    tipoInscricao: 2,
    documento: '50516724000160',
    serie: 1,
    numeroDps: 1
  });
  assert.match(id, /^DPS[0-9]{42}$/);
  assert.equal(id, 'DPS3106200250516724000160' + '00001' + '000000000000001');
});

test('gerarIdDps faz padding de CPF (11) para 14 e usa tpInsc=1', () => {
  const id = gerarIdDps({
    codigoMunicipio: '3550308',
    tipoInscricao: 1,
    documento: '12345678909',
    serie: '2',
    numeroDps: '99'
  });
  assert.match(id, /^DPS[0-9]{42}$/);
  assert.equal(id, 'DPS3550308' + '1' + '00012345678909' + '00002' + '000000000000099');
});
