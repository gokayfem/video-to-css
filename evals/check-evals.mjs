#!/usr/bin/env node
// Validates evals/cases/*/case.json + prompt.md. Dependency-free; makes no model calls.
// Usage: node evals/check-evals.mjs   (exit 1 on any error)
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const EVALS = dirname(fileURLToPath(import.meta.url));
const CASES = join(EVALS, 'cases');
const KINDS = ['positive', 'near-miss'];
const TYPES = ['harness', 'review', 'process'];
const ARMS = ['both', 'with-only'];
const POSITIVE_OUTCOMES = ['structural', 'appearance', 'temporal', 'editability', 'review'];
const FORBIDDEN = [/fixtures\/synthetic/i, /generator/i];
const errors = [];
const rows = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isPosNum = (v) => typeof v === 'number' && v > 0;

if (!existsSync(join(EVALS, 'README.md'))) errors.push('evals/README.md missing');
const dirs = existsSync(CASES) ? readdirSync(CASES).filter((d) => statSync(join(CASES, d)).isDirectory()).sort() : [];
if (dirs.length === 0) errors.push('no case folders under evals/cases');

for (const dir of dirs) {
  const base = join(CASES, dir);
  const casePath = join(base, 'case.json');
  const promptPath = join(base, 'prompt.md');
  if (!existsSync(casePath)) { err(dir, 'case.json missing'); continue; }
  if (!existsSync(promptPath)) err(dir, 'prompt.md missing');
  const rawCase = readFileSync(casePath, 'utf8');
  const rawPrompt = existsSync(promptPath) ? readFileSync(promptPath, 'utf8') : '';
  let c;
  try { c = JSON.parse(rawCase); } catch (e) { err(dir, `case.json invalid JSON: ${e.message}`); continue; }

  for (const re of FORBIDDEN) {
    if (re.test(rawCase)) err(dir, `case.json references forbidden source ${re}`);
    if (re.test(rawPrompt)) err(dir, `prompt.md references forbidden source ${re}`);
  }
  if (rawPrompt && !rawPrompt.includes('{{CLIP}}')) err(dir, 'prompt.md lacks {{CLIP}} placeholder');

  if (c.id !== dir) err(dir, `id "${c.id}" must equal folder name`);
  if (!KINDS.includes(c.kind)) err(dir, `kind must be one of ${KINDS.join('|')}`);
  if (!isStr(c.status)) err(dir, 'status missing (use "UNRUN" until a run exists)');

  const r = c.reference;
  if (!r || typeof r !== 'object') err(dir, 'reference missing');
  else {
    if (r.required !== true) err(dir, 'reference.required must be true');
    if (r.clip !== null) err(dir, 'reference.clip must be null (clips are supplied at run time)');
    if (!isStr(r.source)) err(dir, 'reference.source missing (synthetic/external)');
    if (!isStr(r.description)) err(dir, 'reference.description missing');
    if (r.duration_s === undefined) err(dir, 'reference.duration_s missing');
    if (!Array.isArray(r.size) || r.size.length !== 2 || !r.size.every(isPosNum)) err(dir, 'reference.size must be [w, h]');
  }

  const b = c.budget;
  if (!b || !isPosNum(b.wall_time_min) || !isPosNum(b.tool_calls) || !isPosNum(b.tokens)) err(dir, 'budget needs positive wall_time_min, tool_calls, tokens');

  const gs = Array.isArray(c.graders) ? c.graders : [];
  if (gs.length === 0) err(dir, 'graders list empty');
  const seen = new Set();
  let scored = 0, proc = 0;
  for (const g of gs) {
    const gid = `${dir}/${g.id ?? '?'}`;
    if (!isStr(g.id)) err(gid, 'grader id missing');
    else if (seen.has(g.id)) err(gid, 'duplicate grader id');
    seen.add(g.id);
    if (!TYPES.includes(g.type)) err(gid, `type must be one of ${TYPES.join('|')}`);
    if (!ARMS.includes(g.arm)) err(gid, `arm must be one of ${ARMS.join('|')}`);
    if (!isStr(g.pass)) err(gid, 'pass condition missing');
    if (g.type === 'process') {
      proc++;
      if (g.arm !== 'with-only') err(gid, 'process graders must be arm: with-only');
      if (!isStr(g.check)) err(gid, 'process grader needs a check description');
    } else {
      if (g.arm !== 'both') err(gid, `${g.type} graders must be arm: both (outcome graders apply to both arms)`);
      scored++;
    }
    if (g.type === 'harness' && !isStr(g.command)) err(gid, 'harness grader needs a command');
    if (g.type === 'review') {
      if (!isStr(g.rubric)) err(gid, 'review grader needs a rubric path');
      else if (!existsSync(join(EVALS, g.rubric))) err(gid, `rubric not found: evals/${g.rubric}`);
    }
  }
  if (c.kind === 'positive') {
    const outs = new Set(gs.filter((g) => g.arm === 'both').map((g) => g.outcome));
    for (const o of POSITIVE_OUTCOMES) if (!outs.has(o)) err(dir, `positive case lacks a "${o}" outcome grader`);
  }
  if (c.kind === 'near-miss' && !gs.some((g) => g.type === 'review' && /scope-honesty/.test(g.rubric ?? ''))) {
    err(dir, 'near-miss case needs a scope-honesty review grader');
  }
  rows.push({ case: dir, kind: c.kind, status: c.status, scored, process: proc, clip: r ? `${r.duration_s}s ${r.size?.join('x')} ${r.source}` : '?' });
}

console.log('case                       kind       status  scored  process(with-only)  reference');
for (const x of rows) {
  console.log(`${x.case.padEnd(26)} ${String(x.kind).padEnd(10)} ${String(x.status).padEnd(7)} ${String(x.scored).padEnd(7)} ${String(x.process).padEnd(19)} ${x.clip}`);
}
if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log(`\nOK: ${rows.length} case(s) valid. No eval has been run; all cases UNRUN.`);
