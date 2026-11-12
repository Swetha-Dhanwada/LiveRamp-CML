#!/usr/bin/env node
/**
 * UAT1 vs Prod comparison of the LiveRampConstraints CML.
 *
 * Compares docs/uat1/cml_data.json (UAT1) with docs/prod/cml_data.json (Prod) and
 * writes a self-contained report, docs/CML_UAT1_vs_Prod.html. Conditions are
 * compared by kind + whitespace-normalised CML (leading `//` notes ignored),
 * so reordering or reformatting is not reported as a difference.
 *
 * Usage: node scripts/cml-diff.js
 */
const fs = require('fs');
const path = require('path');
const { normKey } = require('./cml-explorer-model');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function bag(type) {
  const m = new Map();
  (type.conditions || []).forEach((c) => {
    const key = `${c.kind}:${normKey(c.code)}`;
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(c);
  });
  return m;
}

/** Multiset difference: entries of `a` not matched by an entry in `b`. */
function minus(a, b) {
  const out = [];
  a.forEach((list, key) => {
    const extra = list.length - (b.get(key) ? b.get(key).length : 0);
    for (let i = 0; i < extra; i++) out.push(list[list.length - 1 - i]);
  });
  return out;
}

function compareTypes(uat, prod) {
  const u = new Map(uat.map((t) => [t.name, t]));
  const p = new Map(prod.map((t) => [t.name, t]));
  const onlyUat = [...u.keys()].filter((n) => !p.has(n)).sort();
  const onlyProd = [...p.keys()].filter((n) => !u.has(n)).sort();
  const changed = [];
  [...u.keys()]
    .filter((n) => p.has(n))
    .sort()
    .forEach((name) => {
      const bu = bag(u.get(name));
      const bp = bag(p.get(name));
      const inUatOnly = minus(bu, bp);
      const inProdOnly = minus(bp, bu);
      const parentDiff = (u.get(name).parent || '') !== (p.get(name).parent || '');
      if (inUatOnly.length || inProdOnly.length || parentDiff) {
        changed.push({
          name,
          category: u.get(name).category,
          parentDiff: parentDiff ? [u.get(name).parent || '(none)', p.get(name).parent || '(none)'] : null,
          inUatOnly,
          inProdOnly,
        });
      }
    });
  return { onlyUat, onlyProd, changed, same: u.size - onlyUat.length - changed.length };
}

function condList(title, cls, conds) {
  if (!conds.length) return '';
  return `<div class="grp ${cls}"><h4>${esc(title)} (${conds.length})</h4>${conds
    .map((c) => `<div class="cond"><span class="k">${esc(c.kind)}</span><pre>${esc(c.code)}</pre></div>`)
    .join('')}</div>`;
}

function buildDiffHtml(uat, prod, generated) {
  const d = compareTypes(uat, prod);
  const totalU = d.changed.reduce((n, t) => n + t.inUatOnly.length, 0);
  const totalP = d.changed.reduce((n, t) => n + t.inProdOnly.length, 0);
  const rows = d.changed
    .map(
      (t) => `<details class="type"><summary><b>${esc(t.name)}</b> <span class="cat">${esc(t.category)}</span>
        <span class="pill u">${t.inUatOnly.length} only in UAT1</span><span class="pill p">${t.inProdOnly.length} only in Prod</span>
        ${t.parentDiff ? `<span class="pill w">parent: ${esc(t.parentDiff[0])} \u2192 ${esc(t.parentDiff[1])}</span>` : ''}</summary>
        ${condList('Only in UAT1 (not yet in Prod)', 'u', t.inUatOnly)}${condList('Only in Prod (not in UAT1)', 'p', t.inProdOnly)}</details>`
    )
    .join('');
  const typeList = (title, names) =>
    names.length
      ? `<section><h3>${esc(title)} (${names.length})</h3><p>${names.map((n) => `<code>${esc(n)}</code>`).join(' ')}</p></section>`
      : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>CML differences: UAT1 vs Prod</title>
<style>
body{font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;background:#EEF2F3;color:#11242B}
header{padding:24px 32px;background:#fff;border-bottom:1px solid #D5DEE1}
h1{margin:0 0 6px;font-size:24px} main{padding:20px 32px;max-width:1100px}
nav a{color:#0B6B78;margin-right:14px}
.sum{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}
.stat{background:#fff;border:1px solid #D5DEE1;border-radius:10px;padding:10px 16px}.stat b{display:block;font-size:22px}
details.type{background:#fff;border:1px solid #D5DEE1;border-radius:10px;margin:10px 0;padding:10px 14px}
summary{cursor:pointer}.cat{color:#5A6E76;margin:0 8px}
.pill{border-radius:999px;padding:2px 10px;margin-right:6px;font-size:12px}
.pill.u{background:#FBEBCB;color:#8F5300}.pill.p{background:#DCEFF1;color:#0B6B78}.pill.w{background:#F7DDDD;color:#A33A3A}
.grp{margin:12px 0}.grp h4{margin:0 0 6px}.grp.u h4{color:#8F5300}.grp.p h4{color:#0B6B78}
.cond{display:flex;gap:8px;margin:6px 0}.k{flex:none;font:12px monospace;background:#E6ECEE;border-radius:4px;padding:2px 6px;height:fit-content}
pre{margin:0;white-space:pre-wrap;word-break:break-word;font:12px/1.45 ui-monospace,Menlo,monospace}
code{background:#E6ECEE;border-radius:4px;padding:1px 6px;margin-right:4px}
</style></head><body>
<header><h1>CML differences: UAT1 vs Prod</h1>
<nav><a href="uat1/CML_Rule_Explorer.html">UAT1 explorer</a><a href="prod/CML_Rule_Explorer.html">Prod explorer</a></nav>
<p>Expression Set <code>LiveRampConstraints</code>. Generated ${esc(generated)}. Conditions are matched on their CML text, ignoring whitespace and leading comments.</p></header>
<main>
<div class="sum">
<div class="stat"><b>${uat.length}</b>UAT1 types</div><div class="stat"><b>${prod.length}</b>Prod types</div>
<div class="stat"><b>${d.same}</b>identical types</div><div class="stat"><b>${d.changed.length}</b>types that differ</div>
<div class="stat"><b>${totalU}</b>conditions only in UAT1</div><div class="stat"><b>${totalP}</b>conditions only in Prod</div>
</div>
${typeList('Types only in UAT1', d.onlyUat)}${typeList('Types only in Prod', d.onlyProd)}
<section><h3>Types with different conditions (${d.changed.length})</h3>${rows || '<p>None. UAT1 and Prod match.</p>'}</section>
</main></body></html>
`;
}

module.exports = { compareTypes, buildDiffHtml };

if (require.main === module) {
  const docs = path.resolve(__dirname, '..', 'docs');
  const uatFile = path.join(docs, 'uat1', 'cml_data.json');
  const prodFile = path.join(docs, 'prod', 'cml_data.json');
  if (!fs.existsSync(uatFile) || !fs.existsSync(prodFile)) {
    console.error('Need both docs/uat1/cml_data.json and docs/prod/cml_data.json');
    process.exit(1);
  }
  const html = buildDiffHtml(
    JSON.parse(fs.readFileSync(uatFile, 'utf8')),
    JSON.parse(fs.readFileSync(prodFile, 'utf8')),
    new Date().toISOString().slice(0, 10)
  );
  fs.writeFileSync(path.join(docs, 'CML_UAT1_vs_Prod.html'), html);
  console.log('Wrote docs/CML_UAT1_vs_Prod.html');
}
