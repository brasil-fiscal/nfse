import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAdnBaseUrl } from '../src/shared/constants/adn-urls';

test('produção aponta para sefin.nfse.gov.br', () => {
  assert.equal(getAdnBaseUrl('producao'), 'https://sefin.nfse.gov.br/SefinNacional');
});

test('homologação aponta para produção restrita', () => {
  assert.equal(
    getAdnBaseUrl('homologacao'),
    'https://sefin.producaorestrita.nfse.gov.br/SefinNacional'
  );
});
