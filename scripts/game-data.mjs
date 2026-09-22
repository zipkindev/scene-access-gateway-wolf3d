#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const runtimeRoot = path.join(repositoryRoot, 'runtime');
const manifest = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'manifests', 'supported-data.json'), 'utf8'));

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function variants(value) {
  const requested = String(value || 'ALL').toUpperCase();
  if (requested === 'ALL') return Object.keys(manifest);
  if (!Object.hasOwn(manifest, requested)) throw new Error(`unsupported dataset: ${requested}`);
  return [requested];
}

function verifyFile(file, expected) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size !== expected.bytes || digest(file) !== expected.sha256) {
    throw new Error(`unsupported or corrupt game data: ${path.basename(file)}`);
  }
}

function sourceIndex(directory) {
  return new Map(fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => [entry.name.toUpperCase(), path.join(directory, entry.name)]));
}

function verifySelected(selected) {
  for (const variant of selected) {
    for (const [name, expected] of Object.entries(manifest[variant])) {
      const destination = path.join(runtimeRoot, name);
      if (!fs.existsSync(destination)) throw new Error(`missing imported game data: ${name}`);
      verifyFile(destination, expected);
      console.log(`verified ${name}`);
    }
  }
}

function importSelected(sourceDirectory, selected) {
  const available = sourceIndex(sourceDirectory);
  for (const variant of selected) {
    for (const [name, expected] of Object.entries(manifest[variant])) {
      const source = available.get(name.toUpperCase());
      if (!source) throw new Error(`source directory is missing ${name}`);
      verifyFile(source, expected);
    }
  }
  for (const variant of selected) {
    for (const [name, expected] of Object.entries(manifest[variant])) {
      const source = available.get(name.toUpperCase());
      const destination = path.join(runtimeRoot, name);
      if (fs.existsSync(destination)) {
        verifyFile(destination, expected);
        console.log(`kept verified ${name}`);
        continue;
      }
      const temporary = `${destination}.partial-${process.pid}`;
      fs.copyFileSync(source, temporary, fs.constants.COPYFILE_EXCL);
      verifyFile(temporary, expected);
      fs.chmodSync(temporary, 0o644);
      fs.renameSync(temporary, destination);
      console.log(`imported ${name}`);
    }
  }
}

try {
  const [command, argument, variant] = process.argv.slice(2);
  if (command === 'verify') verifySelected(variants(argument));
  else if (command === 'import') {
    if (!argument) throw new Error('import requires a source directory');
    const sourceDirectory = path.resolve(argument);
    if (!fs.statSync(sourceDirectory).isDirectory()) throw new Error('source path is not a directory');
    importSelected(sourceDirectory, variants(variant));
  } else throw new Error('usage: game-data.mjs import <source-directory> [WL6|SOD|ALL] | verify [WL6|SOD|ALL]');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
