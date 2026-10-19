/* ================================================================
   Just Use Postgres 教程 · 浏览器内运行 SQL（基于 PGlite）
   带 data-run 属性的 SQL 代码块会多出“运行”按钮。
   同一页面共享一个内存数据库；运行某个代码块前，会先自动运行它前面还没运行过的代码块。
   ================================================================ */

const PGLITE_VERSION = '0.5.8';
const CDN = 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@' + PGLITE_VERSION + '/dist/';

/* ---------- 结果格式化：尽量和 psql 的输出保持一致 ---------- */

// 数值类型右对齐（int2/int4/int8/oid/float4/float8/numeric）
const NUMERIC_OIDS = new Set([20, 21, 23, 26, 700, 701, 1700]);
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

function displayWidth(s) {
  let w = 0;
  for (const ch of s) w += WIDE.test(ch) || ch.codePointAt(0) > 0x1F000 ? 2 : 1;
  return w;
}

function pad(s, w, right) {
  const gap = ' '.repeat(Math.max(0, w - displayWidth(s)));
  return right ? gap + s : s + gap;
}

// 类型解析器都已关闭，值通常就是 Postgres 的文本形式；个别情况（新建类型的数组等）兜底处理
function text(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 't' : 'f';
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return '{' + v.map(text).join(',') + '}';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function formatResult(res) {
  const names = res.fields.map(f => f.name);
  const right = res.fields.map(f => NUMERIC_OIDS.has(f.dataTypeID));
  const rows = res.rows.map(r => names.map((n, i) => text(Array.isArray(r) ? r[i] : r[n]).replace(/\n/g, ' ')));
  const widths = names.map((n, i) => Math.max(displayWidth(n), ...rows.map(r => displayWidth(r[i]))));
  const head = names.map((n, i) => {
    const extra = widths[i] - displayWidth(n);
    const left = Math.floor(extra / 2);
    return ' '.repeat(left) + n + ' '.repeat(extra - left);
  });
  const lines = [' ' + head.join(' | ') + ' ', widths.map(w => '-'.repeat(w + 2)).join('+')];
  for (const r of rows) lines.push(' ' + r.map((v, i) => pad(v, widths[i], right[i])).join(' | ') + ' ');
  lines.push('(' + rows.length + (rows.length === 1 ? ' row)' : ' rows)'));
  return lines.join('\n').replace(/ +$/gm, '');
}

export function formatError(e) {
  let s = 'ERROR:  ' + e.message;
  if (e.detail) s += '\nDETAIL:  ' + e.detail;
  if (e.hint) s += '\nHINT:  ' + e.hint;
  return s;
}

// psql 的元命令（\c、\d …）不是 SQL，浏览器里无法执行
export function stripMeta(sql) {
  const skipped = [];
  const kept = sql.split('\n').filter(line => {
    if (/^\s*\\/.test(line)) { skipped.push(line.trim()); return false; }
    return true;
  });
  return { sql: kept.join('\n'), skipped };
}

// 按分号切分语句，跳过字符串、带引号的标识符、注释和 $$ … $$ 里的分号
export function splitStatements(sql) {
  const out = [];
  let start = 0, i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i], d = sql[i + 1];
    if (c === '-' && d === '-') { const e = sql.indexOf('\n', i); i = e < 0 ? n : e; continue; }
    if (c === '/' && d === '*') { const e = sql.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === "'" || c === '"') {
      const backslash = c === "'" && /[eE]/.test(sql[i - 1] || '');
      i++;
      while (i < n) {
        if (backslash && sql[i] === '\\') { i += 2; continue; }
        if (sql[i] === c) { if (sql[i + 1] === c) { i += 2; continue; } break; }
        i++;
      }
      i++; continue;
    }
    if (c === '$') {
      const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (m) { const e = sql.indexOf(m[0], i + m[0].length); i = e < 0 ? n : e + m[0].length; continue; }
    }
    if (c === ';') { out.push(sql.slice(start, i + 1)); start = i + 1; }
    i++;
  }
  out.push(sql.slice(start));
  // 只剩注释和空白的片段不算语句
  return out.filter(s => s.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, '').trim());
}

/* ---------- 数据库 ---------- */

let dbPromise = null;

async function createDb() {
  const mod = await import(CDN + 'index.js');
  // 关闭类型转换，拿到和 psql 一样的文本值
  for (const k of Object.keys(mod.types.parsers)) delete mod.types.parsers[k];
  const extensions = {};
  for (const name of (document.body.dataset.pgliteExt || '').split(',').map(s => s.trim()).filter(Boolean)) {
    const m = await import(CDN + 'contrib/' + name + '.js');
    extensions[name] = m[name];
  }
  const db = await mod.PGlite.create({ extensions });
  if (db.parsers) for (const k of Object.keys(db.parsers)) delete db.parsers[k];
  await db.exec("SET TimeZone = 'UTC'");
  return db;
}

// init：新建数据库后立刻执行的 SQL（练习场用它导入示例数据）
export function getDb(init) {
  if (!dbPromise) dbPromise = createDb().then(async db => {
    if (init) await db.exec(init);
    return db;
  }).catch(e => { dbPromise = null; throw e; });
  return dbPromise;
}

export async function resetDb() {
  if (dbPromise) { try { (await dbPromise).close(); } catch (e) { /* 忽略 */ } }
  dbPromise = null;
}

export async function runSql(db, src) {
  const { sql, skipped } = stripMeta(src);
  const parts = [];
  if (skipped.length) parts.push('（已跳过 psql 命令：' + skipped.join('、') + '）');
  const t0 = performance.now();
  let errors = 0;
  // 和 psql 一样：一条语句出错，后面的语句照常执行
  for (const stmt of splitStatements(sql)) {
    try {
      const results = await db.exec(stmt, { rowMode: 'array' });   // 数组模式：重名的列（如两个 ?column?）不会互相覆盖
      for (const r of results) if (r.fields && r.fields.length) parts.push(formatResult(r));
    } catch (e) {
      errors++;
      parts.push(formatError(e));
    }
  }
  // 事务里出过错就会一直处于“已中止”状态，回滚掉，免得后面的代码块全部失败
  if (errors && db.isInTransaction && db.isInTransaction()) {
    await db.exec('ROLLBACK');
    parts.push('（事务中出错，已自动 ROLLBACK）');
  }
  const ms = Math.round(performance.now() - t0);
  parts.push(errors ? '完成，' + errors + ' 条语句出错，用时 ' + ms + ' ms' : '✓ 执行成功，用时 ' + ms + ' ms');
  return { ok: !errors, text: parts.join('\n\n') };
}

/* ---------- 页面接线 ---------- */

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function setup() {
  const boxes = Array.from(document.querySelectorAll('.code[data-run]'));
  if (!boxes.length) return;
  const done = new Set();
  let busy = false;

  function panelFor(box) {
    let p = box.nextElementSibling;
    if (p && p.classList.contains('run-out')) return p;
    p = document.createElement('div');
    p.className = 'code out run-out';
    p.innerHTML = '<div class="bar"><span class="tag">运行结果 · 浏览器内的 Postgres 18（PGlite）</span>' +
      '<span class="run-tools"><button type="button" class="copy reset">重置数据库</button>' +
      '<button type="button" class="copy close">收起</button></span></div><pre></pre>';
    p.querySelector('.close').onclick = () => p.remove();
    p.querySelector('.reset').onclick = reset;
    box.after(p);
    return p;
  }

  async function reset() {
    if (busy) return;
    await resetDb();
    done.clear();
    document.querySelectorAll('.run-out').forEach(p => p.remove());
  }

  async function run(box) {
    if (busy) return;
    busy = true;
    const idx = boxes.indexOf(box);
    const out = panelFor(box);
    const pre = out.querySelector('pre');
    const btn = box.querySelector('.run');
    btn.disabled = true;
    try {
      if (!dbPromise) pre.textContent = '正在下载浏览器版 Postgres（PGlite，首次约 10 MB，之后有缓存）……';
      const db = await getDb();
      // 先补跑前面没运行过的代码块（它们创建了这里要用的表）
      const before = boxes.slice(0, idx).filter(b => !done.has(b));
      if (before.length) {
        pre.textContent = '正在先运行本页前面的 ' + before.length + ' 个代码块……';
        for (const b of before) { await runSql(db, b.querySelector('pre').textContent); done.add(b); }
      }
      const r = await runSql(db, box.querySelector('pre').textContent);
      done.add(box);
      let note = before.length ? '（已先自动运行本页前面的 ' + before.length + ' 个代码块）\n\n' : '';
      pre.innerHTML = esc(note) + esc(r.text).replace(/^(ERROR:.*)$/gm, '<span class="run-err">$1</span>');
    } catch (e) {
      pre.textContent = '加载失败：' + (e && e.message ? e.message : e) + '\n请检查网络能否访问 cdn.jsdelivr.net。';
    } finally {
      btn.disabled = false;
      busy = false;
    }
  }

  boxes.forEach(box => {
    const bar = box.querySelector('.bar');
    const pre = box.querySelector('pre');
    if (!bar || !pre) return;
    const tools = document.createElement('span');
    tools.className = 'run-tools';
    const edit = document.createElement('button');
    edit.type = 'button'; edit.className = 'copy'; edit.textContent = '编辑';
    edit.title = '修改代码后再运行';
    edit.onclick = () => {
      const on = pre.getAttribute('contenteditable') === 'plaintext-only';
      if (on) { pre.removeAttribute('contenteditable'); edit.textContent = '编辑'; }
      else { pre.textContent = pre.textContent; pre.setAttribute('contenteditable', 'plaintext-only'); pre.focus(); edit.textContent = '完成'; }
    };
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'copy run'; btn.textContent = '▶ 运行';
    btn.title = '在浏览器里运行（PGlite）';
    btn.onclick = () => run(box);
    const copy = bar.querySelector('.copy');
    tools.appendChild(btn); tools.appendChild(edit);
    if (copy) tools.appendChild(copy);
    bar.appendChild(tools);
  });
}

if (typeof document !== 'undefined') setup();
