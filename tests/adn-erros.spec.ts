import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAdnErros } from '../src/shared/helpers/adn-response';
import { NFSeRejectError } from '../src/shared/errors/NFSeRejectError';

test('formato clássico erros[].Codigo/Descricao', () => {
  assert.deepEqual(parseAdnErros(JSON.stringify({ erros: [{ Codigo: 'E0500', Descricao: 'x' }] })), [
    { codigo: 'E0500', descricao: 'x', complemento: undefined }
  ]);
});

test('erro singular com chaves minúsculas (resposta de evento)', () => {
  const e = parseAdnErros(JSON.stringify({ tipoAmbiente: 1, erro: { codigo: 'E1235', descricao: 'Prazo de cancelamento expirado' } }));
  assert.equal(e[0].codigo, 'E1235');
  assert.equal(new NFSeRejectError(400, e).message, 'ADN rejeitou a DPS (HTTP 400): [E1235] Prazo de cancelamento expirado');
});

test('formato desconhecido: devolve o corpo cru em vez de lista vazia', () => {
  const e = parseAdnErros('{"foo":"bar"}');
  assert.equal(e[0].descricao, '{"foo":"bar"}');
});

test('ProblemDetails (title/detail)', () => {
  assert.equal(parseAdnErros(JSON.stringify({ title: 'Bad Request', status: 400 }))[0].descricao, 'Bad Request');
});

test('HTML de gateway e corpo vazio: lista vazia', () => {
  assert.deepEqual(parseAdnErros('<html>502</html>'), []);
  assert.deepEqual(parseAdnErros(''), []);
});
