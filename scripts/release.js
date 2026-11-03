#!/usr/bin/env node
/**
 * Publica a próxima versão sem editar o package.json à mão.
 *
 *   npm run release            → patch (1.3.0 → 1.3.1)
 *   npm run release -- minor   → 1.3.0 → 1.4.0
 *   npm run release -- major   → 1.3.0 → 2.0.0
 *
 * Só sobe a versão se a atual JÁ estiver publicada no npm. Assim, se o publish
 * falhar no meio (login vencido, rede), rodar de novo publica a MESMA versão em
 * vez de pular uma. Não cria commit nem tag (--no-git-tag-version).
 */
const { execSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const tipo = process.argv[2] ?? 'patch';
if (!['patch', 'minor', 'major'].includes(tipo)) {
  console.error(`Tipo inválido: "${tipo}". Use patch, minor ou major.`);
  process.exit(1);
}

const REGISTRY = 'https://registry.npmjs.org';
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const pkgPath = join(__dirname, '..', 'package.json');
const lerPkg = () => JSON.parse(readFileSync(pkgPath, 'utf-8'));

// Falha cedo com mensagem clara: sem login, o npm responde 404 no PUT e confunde.
try {
  execSync(`npm whoami --registry=${REGISTRY}`, { stdio: 'pipe' });
} catch {
  console.error('Não autenticado no npm (token vencido ou ausente). Rode: npm login');
  process.exit(1);
}

const { name, version } = lerPkg();
let publicadas = [];
try {
  publicadas = JSON.parse(execSync(`npm view ${name} versions --json --registry=${REGISTRY}`, { stdio: 'pipe' }).toString());
} catch {
  publicadas = []; // pacote ainda não publicado
}
if (!Array.isArray(publicadas)) publicadas = [publicadas];

if (publicadas.includes(version)) {
  run(`npm version ${tipo} --no-git-tag-version`);
} else {
  console.log(`${name}@${version} ainda não foi publicada: publicando esta mesma versão.`);
}

const alvo = lerPkg().version;
console.log(`Publicando ${name}@${alvo}...`);
try {
  run('npm run publish:all');
} catch {
  console.error(
    `\nFalhou ao publicar ${name}@${alvo}. O motivo é a linha "npm error" acima.\n` +
      'E409 "previously staged version": o npm queimou esse número (bug npm/cli#9889);\n' +
      `suba a versão (npm version patch --no-git-tag-version) e rode de novo.`
  );
  process.exit(1);
}
