#!/usr/bin/env node
/**
 * Converts the raw parser output (scripts/cml-parse.js -> docs/cml_data.json:
 * name / parent / annotation / alias / conditions[{kind, code}] / count /
 * category) into the shape docs/CML_Rule_Explorer.html renders:
 *
 *   { id, api, name, parent, category,
 *     attributes[], rules[], messages[], preferences[], dependencies[] }
 *
 * The explorer's plain-English text ("cond", "conclusion", "title", "text")
 * was authored by hand, so it cannot be regenerated from CML. Instead the
 * previously embedded model is used as a lookup: a condition whose CML is
 * unchanged keeps its existing description (matched on whitespace-normalised
 * code). New or edited conditions get a mechanical fallback description built
 * from the CML itself, so the page always renders.
 */
const SECTION_BY_KIND = {
  rule: 'rules',
  message: 'messages',
  preference: 'preferences',
  require: 'dependencies',
  constraint: 'dependencies',
};

const KIND_RE = /\b(message|require|preference|rule|constraint)\s*\(/;

/** Statement text starting at the call itself (drops leading `//` notes). */
function callOnly(code) {
  const m = KIND_RE.exec(code || '');
  return m ? code.slice(m.index) : code || '';
}

function normKey(code) {
  return callOnly(code).replace(/\s+/g, '');
}

/** Split on top-level `sep`, ignoring separators inside quotes/()/[]/{}. */
function splitTopLevel(str, sep) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (depth === 0 && str.startsWith(sep, i)) {
      parts.push(str.slice(start, i).trim());
      start = i + sep.length;
      i += sep.length - 1;
    }
  }
  parts.push(str.slice(start).trim());
  return parts;
}

/** Arguments of `kind( ... );` as raw strings. */
function callArgs(code) {
  const call = callOnly(code);
  const open = call.indexOf('(');
  const close = call.lastIndexOf(')');
  if (open < 0 || close <= open) return [];
  return splitTopLevel(call.slice(open + 1, close), ',');
}

const unquote = (s) => {
  const t = String(s ?? '').trim();
  return /^".*"$/s.test(t) ? t.slice(1, -1).replace(/\\"/g, '"') : t;
};

/** Mechanical description for a condition with no hand-written text. */
function fallbackItem(cond) {
  const code = cond.code;
  const cml = callOnly(code);
  const args = callArgs(code);
  const when = (expr) => `When: ${String(expr || '').replace(/\s+/g, ' ').trim()}`;

  switch (cond.kind) {
    case 'rule': {
      const action = unquote(args[1]);
      const detail = args.slice(2).map(unquote).filter(Boolean).join(' ');
      return {
        action: ['hide', 'disable', 'show'].includes(action) ? action : 'hide',
        title: detail || 'Rule',
        cond: when(args[0]),
        cml,
        note: '',
      };
    }
    case 'message':
      return {
        severity: ['error', 'warning', 'info'].includes(unquote(args[2])) ? unquote(args[2]) : 'error',
        cond: when(args[0]),
        text: unquote(args[1]),
        cml,
      };
    case 'preference': {
      const inner = args.join(',');
      const arrow = splitTopLevel(inner, '->');
      return {
        cond: when(arrow[0]),
        conclusion: arrow.length > 1 ? `\u2192 ${arrow.slice(1).join(' -> ').replace(/\s+/g, ' ').trim()}` : '',
        cml,
      };
    }
    default:
      return {
        cond: when(args[0]),
        conclusion: args.length > 1 ? `Then: ${args.slice(1).join(', ').replace(/\s+/g, ' ').trim()}` : '',
        cml,
      };
  }
}

/** Queue previous items by normalised CML so duplicates are consumed in order. */
function indexPrevious(prevType) {
  const byKey = new Map();
  if (!prevType) return byKey;
  ['rules', 'messages', 'preferences', 'dependencies'].forEach((sec) => {
    (prevType[sec] || []).forEach((it) => {
      if (!it.cml) return;
      const key = `${sec}:${normKey(it.cml)}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(it);
    });
  });
  return byKey;
}

const humanize = (name) =>
  name
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * @param {Array} types     parseCml() output, with `category` set
 * @param {Array} previous  previously embedded explorer model (may be empty
 *                          or an old/broken shape; anything unusable is ignored)
 * @returns {{ data: Array, stats: {reused:number, generated:number} }}
 */
function buildExplorerData(types, previous) {
  const prevById = new Map(
    (Array.isArray(previous) ? previous : [])
      .filter((p) => p && p.id && Array.isArray(p.rules))
      .map((p) => [p.id, p])
  );
  const stats = { reused: 0, generated: 0 };

  const data = types.map((t) => {
    const prev = prevById.get(t.name);
    const queues = indexPrevious(prev);
    const out = {
      id: t.name,
      api: t.name,
      name: prev ? prev.name : humanize(t.name),
      parent: t.parent || '',
      category: t.category || 'Other',
      attributes: prev && Array.isArray(prev.attributes) ? prev.attributes : [],
      rules: [],
      messages: [],
      preferences: [],
      dependencies: [],
    };
    (t.conditions || []).forEach((cond) => {
      const sec = SECTION_BY_KIND[cond.kind];
      if (!sec) return;
      const queue = queues.get(`${sec}:${normKey(cond.code)}`);
      if (queue && queue.length) {
        out[sec].push(queue.shift());
        stats.reused++;
      } else {
        out[sec].push(fallbackItem(cond));
        stats.generated++;
      }
    });
    return out;
  });
  return { data, stats };
}

/** Embedded `const DATA = [...]` from an explorer HTML string, or []. */
function readEmbeddedData(html) {
  const m = /const DATA = (\[.*?\]);\s*\n/s.exec(html);
  if (!m) return [];
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    return [];
  }
}

module.exports = { buildExplorerData, readEmbeddedData, normKey, fallbackItem, splitTopLevel };

if (require.main === module) {
  const fs = require('fs');
  const [dataJson, htmlFile] = process.argv.slice(2);
  if (!dataJson || !htmlFile) {
    console.error('Usage: node scripts/cml-explorer-model.js <cml_data.json> <explorer.html>   (rewrites DATA in place)');
    process.exit(1);
  }
  const types = JSON.parse(fs.readFileSync(dataJson, 'utf8'));
  const html = fs.readFileSync(htmlFile, 'utf8');
  const { data, stats } = buildExplorerData(types, readEmbeddedData(html));
  fs.writeFileSync(htmlFile, html.replace(/const DATA = \[.*?\];\s*\n/s, () => `const DATA = ${JSON.stringify(data)};\n`));
  console.log(`Embedded ${data.length} types (${stats.reused} reused descriptions, ${stats.generated} generated)`);
}
