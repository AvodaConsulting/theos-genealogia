#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');
const skillName = 'notebooklm-mcp-bridge';
const sourceSkillDir = path.join(repoRoot, '.codex', 'skills', skillName);

const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const targetSkillsDir = path.join(codexHome, 'skills');
const targetSkillDir = path.join(targetSkillsDir, skillName);

if (!fs.existsSync(sourceSkillDir)) {
  // eslint-disable-next-line no-console
  console.error(`Source skill folder not found: ${sourceSkillDir}`);
  process.exit(1);
}

fs.mkdirSync(targetSkillsDir, { recursive: true });

if (fs.existsSync(targetSkillDir)) {
  const stat = fs.lstatSync(targetSkillDir);
  if (stat.isSymbolicLink()) {
    fs.unlinkSync(targetSkillDir);
  } else {
    // eslint-disable-next-line no-console
    console.error(
      `Target exists and is not a symlink: ${targetSkillDir}\nRemove it manually, then rerun installer.`,
    );
    process.exit(1);
  }
}

fs.symlinkSync(sourceSkillDir, targetSkillDir, 'dir');

// eslint-disable-next-line no-console
console.log(`Installed skill "${skillName}" -> ${targetSkillDir}`);
