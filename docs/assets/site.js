/* ================================================================
   Just Use Postgres 教程 · 共享脚本：侧边栏、目录、代码高亮、主题
   ================================================================ */
(function () {
  'use strict';

  // n：页面序号（body 的 data-chapter）；label：显示用的章号；f：文件名
  var CHAPTERS = [
    { n: 1,  label: '1',  f: 'ch01.html', t: '认识 Postgres',        d: '为什么是 Postgres，以及 10 分钟跑起第一个数据库', part: '第一部分 · 关系型数据库' },
    { n: 2,  label: '2',  f: 'ch02.html', t: '标准关系型数据库能力',  d: '库、模式、表、约束、事务、函数、触发器、视图与权限' },
    { n: 3,  label: '3',  f: 'ch03.html', t: '现代 SQL',             d: 'CTE、递归查询与窗口函数' },
    { n: 4,  label: '4',  f: 'ch04.html', t: '索引',                 d: 'EXPLAIN、B-tree、哈希、复合、覆盖、部分与表达式索引' },
    { n: 5,  label: '5',  f: 'ch05.html', t: 'Postgres 与 JSON',     d: 'JSONB 的存储、查询、修改与 GIN 索引', part: '第二部分 · 超越关系型' },
    { n: 6,  label: '6',  f: 'ch06.html', t: '全文搜索',             d: '词素、tsvector、tsquery、排序、高亮与索引' },
    { n: 7,  label: '7',  f: 'ch07.html', t: 'Postgres 扩展',        d: '扩展机制、安装使用与常用扩展地图', part: '第三部分 · 扩展与生态' },
    { n: 8,  label: '8',  f: 'ch08.html', t: '生成式 AI 与 pgvector', d: '向量嵌入、相似度搜索、IVFFlat/HNSW 与 RAG' },
    { n: 9,  label: '9',  f: 'ch09.html', t: '时间序列',             d: 'TimescaleDB 超表、time_bucket、连续聚合与 BRIN' },
    { n: 10, label: '10', f: 'ch10.html', t: '地理空间数据',         d: 'PostGIS、点线面、空间查询与 GiST 索引' },
    { n: 11, label: '11', f: 'ch11.html', t: '用 Postgres 做消息队列', d: 'SKIP LOCKED、LISTEN/NOTIFY 与 pgmq' },
    { n: 12, label: 'A',  f: 'appendix-a.html', t: '五个优化技巧',     d: '写出更高效的查询，设计更好的方案', part: '附录' },
    { n: 13, label: 'B',  f: 'appendix-b.html', t: '什么时候别用 Postgres', d: '知道边界，才能放心地“就用 Postgres”' },
    { n: 14, label: 'S1', f: 'topic-chinese-fts.html', t: '中文全文搜索',   d: 'zhparser 分词、自定义词典与 pg_trgm 的取舍', part: '补充专题（原书之外）' },
    { n: 15, label: 'S2', f: 'topic-sql.html',         t: '常用 SQL 补全',  d: 'UPSERT、数组/范围/枚举、锁与隔离级别' },
    { n: 16, label: 'S3', f: 'topic-rls.html',         t: '行级安全 RLS',   d: '在同一张表里隔离多个租户的数据' },
    { n: 17, label: 'S4', f: 'topic-vacuum.html',      t: 'VACUUM 与表膨胀', d: '死元组从哪来、怎么回收、怎么监控' },
    { n: 18, label: 'S5', f: 'topic-app.html',         t: '从应用连接 Postgres', d: '驱动、参数化查询、事务与 ORM' },
    { n: 19, label: 'S6', f: 'topic-backup.html',      t: '备份、恢复与升级', d: 'pg_dump、pg_restore 与大版本升级' },
    { n: 20, label: '练', f: 'playground.html', tag: '工具', t: 'SQL 练习场', d: '在浏览器里直接写 SQL，自带示例数据', part: '工具与速查' },
    { n: 21, label: '速', f: 'cheatsheet.html', tag: '工具', t: '速查表', d: 'psql 命令、常用语法、索引选择、运维查询' },
    { n: 22, label: '词', f: 'glossary.html', tag: '工具', t: '术语表', d: '中英对照的概念速查，附出处' }
  ];

  var cur = parseInt(document.body.dataset.chapter || '0', 10);

  function name(c) {
    if (c.tag) return c.tag;
    if (/^\d+$/.test(c.label)) return '第 ' + c.label + ' 章';
    if (/^S\d+$/.test(c.label)) return '专题 ' + c.label.slice(1);
    return '附录 ' + c.label;
  }

  /* ---------- 侧边栏 ---------- */
  var side = document.getElementById('sidebar');
  if (side) {
    var html = '<a class="brand" href="index.html"><span class="flame">&#128024;</span>' +
      '<span>Just Use Postgres<small>一个数据库，够你用很久</small></span></a>' +
      '<button type="button" class="search-btn"><span>&#128269; 搜索教程</span><kbd>/</kbd></button>';
    CHAPTERS.forEach(function (c) {
      if (c.part) html += '<div class="part">' + c.part + '</div>';
      html += '<a class="ch' + (c.n === cur ? ' active' : '') + '" href="' + c.f +
        '"><span class="n">' + c.label + '</span><span>' + c.t + '</span></a>';
    });
    html += '<div class="part">补充资料</div>' +
      '<a class="ch" href="https://github.com/dmagda/just-use-postgres-book"><span class="n">&#8599;</span><span>原书代码仓库</span></a>';
    side.innerHTML = html;
    var active = side.querySelector('a.ch.active');
    // 只滚动侧边栏自身，不能用 scrollIntoView（它会连带滚动整个页面）
    if (active) setTimeout(function () {
      var top = active.offsetTop - side.clientHeight / 2 + active.offsetHeight / 2;
      if (top > 0) side.scrollTop = top;
    }, 0);
  }

  /* ---------- 站内搜索：按 / 或 Ctrl+K 打开，search.js 按需加载 ---------- */
  window.JUP_CHAPTERS = CHAPTERS;
  var searchLoading = null;
  function openSearch() {
    document.body.classList.remove('nav-open');
    if (window.JUPSearch) return window.JUPSearch.open();
    if (!searchLoading) {
      searchLoading = document.createElement('script');
      searchLoading.src = 'assets/search.js';
      searchLoading.onload = function () { window.JUPSearch.open(); };
      document.body.appendChild(searchLoading);
    }
  }
  var sb = side && side.querySelector('.search-btn');
  if (sb) sb.onclick = openSearch;
  document.addEventListener('keydown', function (e) {
    var t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openSearch(); }
    else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); openSearch(); }
  });

  /* ---------- 移动端菜单 ---------- */
  var btn = document.createElement('button');
  btn.id = 'menu-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', '目录');
  btn.innerHTML = '&#9776;';
  btn.onclick = function () { document.body.classList.toggle('nav-open'); };
  document.body.appendChild(btn);
  document.addEventListener('click', function (e) {
    if (document.body.classList.contains('nav-open') &&
        side && !side.contains(e.target) && e.target !== btn) {
      document.body.classList.remove('nav-open');
    }
  });

  /* ---------- 主题切换 ---------- */
  var tbtn = document.createElement('button');
  tbtn.id = 'theme-btn';
  tbtn.type = 'button';
  tbtn.setAttribute('aria-label', '切换深浅色');
  tbtn.innerHTML = '&#9789;';
  tbtn.onclick = function () {
    var root = document.documentElement;
    var now = root.getAttribute('data-theme');
    var dark = now ? now === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'light' : 'dark');
    try { localStorage.setItem('pg-doc-theme', dark ? 'light' : 'dark'); } catch (e) {}
  };
  document.body.appendChild(tbtn);
  try {
    var saved = localStorage.getItem('pg-doc-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  } catch (e) {}

  /* ---------- 箭头 marker（全局一次） ---------- */
  var defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
  defs.setAttribute('style', 'position:absolute');
  // 注意：SVG marker 的内容不会从引用它的元素继承 color，
  // 所以这里直接用 CSS 变量填色，而不是 currentColor。
  function mk(id, color) {
    return '<marker id="' + id + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0,0 L10,5 L0,10 z" fill="var(' + color + ')"/></marker>';
  }
  defs.innerHTML = '<defs>' + mk('ar', '--fg-faint') + mk('ar-a', '--accent') +
    mk('ar-b', '--blue') + mk('ar-g', '--green') + mk('ar-r', '--red') + mk('ar-p', '--purple') + '</defs>';
  document.body.appendChild(defs);

  /* ---------- 章节内目录 ---------- */
  var main = document.querySelector('main');
  var slot = document.getElementById('chapter-toc');
  if (slot && main) {
    var hs = main.querySelectorAll('h2');
    if (hs.length > 2) {
      var t = '<div class="h">本章目录</div><ol>';
      hs.forEach(function (h, i) {
        if (!h.id) h.id = 'sec-' + (i + 1);
        t += '<li><a href="#' + h.id + '">' + h.textContent + '</a></li>';
      });
      slot.className = 'toc';
      slot.innerHTML = t + '</ol>';
    }
  }

  /* ---------- 代码块：语言标签 + 复制 + 高亮 ---------- */
  var SQL_KW = ('select|from|where|and|or|not|in|is|null|as|on|join|left|right|inner|outer|full|cross|lateral|' +
    'group|by|order|having|limit|offset|asc|desc|nulls|first|last|distinct|union|all|except|intersect|' +
    'insert|into|values|update|set|delete|returning|merge|using|when|matched|then|' +
    'create|alter|drop|table|schema|database|index|view|materialized|function|procedure|trigger|' +
    'extension|role|sequence|type|constraint|primary|key|foreign|references|unique|check|default|' +
    'exclude|cascade|restrict|if|exists|replace|add|column|rename|to|with|recursive|' +
    'case|else|end|begin|commit|rollback|transaction|declare|return|returns|query|language|' +
    'raise|exception|notice|grant|revoke|usage|connect|login|password|public|for|each|row|' +
    'before|after|execute|over|partition|window|range|rows|between|unbounded|preceding|following|current|' +
    'true|false|like|ilike|similar|any|some|explain|analyze|verbose|buffers|costs|vacuum|refresh|' +
    'concurrently|include|only|skip|locked|nowait|share|listen|notify|unlisten|perform|loop|' +
    'while|elsif|new|old|tablespace|filter|within|interval|at|zone|lock|copy|stdin|csv|header|' +
    'temporary|temp|unlogged|generated|always|stored|identity|collate|array|cast|show|system|' +
    'reset|no|data|of|do|instead|strict|immutable|stable|volatile|security|definer|setof|out|inout|' +
    'next|ties|fetch|asymmetric|symmetric|enable|disable|policy|owner|privileges|all').split('|');
  var SQL_TP = ('int|integer|bigint|smallint|serial|bigserial|smallserial|text|varchar|char|character|varying|' +
    'numeric|decimal|real|double|precision|float|float4|float8|boolean|bool|date|time|timestamp|' +
    'timestamptz|uuid|json|jsonb|bytea|tsvector|tsquery|vector|halfvec|geometry|geography|point|' +
    'polygon|regconfig|oid|record|trigger|void|int4|int8|money|inet|cidr|xml|hstore|ltree|' +
    'plpgsql|sql|btree|hash|gin|gist|spgist|brin|hnsw|ivfflat').split('|');

  var RE_SQL = new RegExp(
    '(\\/\\*[\\s\\S]*?\\*\\/|--[^\\n]*)' +                              // 1 注释
    '|(E?\'(?:\'\'|[^\'])*\')' +                                        // 2 字符串
    '|(\\$[A-Za-z_]*\\$|\\\\[a-zA-Z+?]+|::|->>|->|#>>|#>|@>|<@|<->|<=>|<#>|<\\+>|\\?\\||\\?&|@@|\\|\\|)' + // 3 运算符/元命令
    '|\\b(' + SQL_TP.join('|') + ')\\b' +                              // 4 类型
    '|\\b(' + SQL_KW.join('|') + ')\\b' +                              // 5 关键字
    '|\\b(\\d+(?:\\.\\d+)?)\\b' +                                       // 6 数字
    '|\\b([a-zA-Z_][\\w]*)(?=\\s*\\()',                                 // 7 函数调用
    'gi');

  var KW_JS = ('const|let|var|function|return|if|else|await|async|import|from|export|default|new|class|' +
    'for|while|of|in|try|catch|finally|throw|def|with|as|not|and|or|is|None|True|False|' +
    'null|undefined|true|false|this|lambda|print|elif|yield|pass').split('|');
  var RE_PY = new RegExp(
    '(#[^\\n]*|\\/\\/[^\\n]*)' +
    '|("""[\\s\\S]*?"""|f?"(?:\\\\[\\s\\S]|[^\\\\"\\n])*"|f?\'(?:\\\\[\\s\\S]|[^\\\\\'\\n])*\')' +
    '|\\b(' + KW_JS.join('|') + ')\\b' +
    '|\\b([A-Z][A-Za-z0-9_]*)\\b' +
    '|\\b(\\d+(?:\\.\\d+)?)\\b' +
    '|\\b([a-zA-Z_$][\\w$]*)(?=\\()',
    'g');

  var RE_SH = /(#[^\n]*)|('(?:\\[\s\S]|[^\\'])*'|"(?:\\[\s\S]|[^\\"])*")|\b(docker|psql|pip|python|curl|git|cd|mkdir|export|wget|unzip|brew|apt|npm)\b/g;

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function paint(src, re, classes) {
    var out = '', last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(src)) !== null) {
      out += esc(src.slice(last, m.index));
      for (var g = 1; g < m.length; g++) {
        if (m[g] !== undefined) { out += '<span class="' + classes[g - 1] + '">' + esc(m[g]) + '</span>'; break; }
      }
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    return out + esc(src.slice(last));
  }

  document.querySelectorAll('.code').forEach(function (box) {
    var pre = box.querySelector('pre');
    if (!pre) return;
    var isOut = box.classList.contains('out');
    var lang = box.dataset.lang || (isOut ? 'text' : '');
    var file = box.dataset.file || '';
    var bar = document.createElement('div');
    bar.className = 'bar';
    bar.innerHTML = '<span class="tag">' + esc(file || (isOut ? '输出' : lang) || 'code') + '</span>';
    var cp = document.createElement('button');
    cp.className = 'copy'; cp.type = 'button'; cp.textContent = '复制';
    cp.onclick = function () {
      var txt = pre.textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(txt);
      cp.textContent = '已复制'; setTimeout(function () { cp.textContent = '复制'; }, 1400);
    };
    bar.appendChild(cp);
    box.insertBefore(bar, pre);

    var code = pre.textContent.replace(/^\n/, '').replace(/\s+$/, '');
    if (isOut || lang === 'text') {
      pre.textContent = code;
    } else if (lang === 'bash' || lang === 'sh' || lang === 'shell' || lang === 'powershell') {
      pre.innerHTML = paint(code, RE_SH, ['tk-cm', 'tk-st', 'tk-kw']);
    } else if (lang === 'python' || lang === 'py' || lang === 'js' || lang === 'json') {
      pre.innerHTML = paint(code, RE_PY, ['tk-cm', 'tk-st', 'tk-kw', 'tk-tp', 'tk-nm', 'tk-fn']);
    } else {
      pre.innerHTML = paint(code, RE_SQL, ['tk-cm', 'tk-st', 'tk-op', 'tk-tp', 'tk-kw', 'tk-nm', 'tk-fn']);
    }
  });

  /* ---------- 可在浏览器里运行的代码块（data-run），按需加载 runner.js ---------- */
  if (document.querySelector('.code[data-run]')) {
    var rs = document.createElement('script');
    rs.type = 'module'; rs.src = 'assets/runner.js';
    document.body.appendChild(rs);
  }

  /* ---------- 上一章 / 下一章 ---------- */
  var pager = document.getElementById('pager');
  if (pager && cur) {
    var prev = CHAPTERS.find(function (c) { return c.n === cur - 1; });
    var next = CHAPTERS.find(function (c) { return c.n === cur + 1; });
    var h = '';
    h += prev ? '<a class="prev" href="' + prev.f + '"><span>&larr; 上一章</span>' + name(prev) + ' · ' + prev.t + '</a>'
              : '<a class="prev" href="index.html"><span>&larr; 返回</span>课程首页</a>';
    h += next ? '<a class="next" href="' + next.f + '"><span>下一章 &rarr;</span>' + name(next) + ' · ' + next.t + '</a>'
              : '<a class="next" href="index.html"><span>完成 &rarr;</span>回到课程首页</a>';
    pager.className = 'pager';
    pager.innerHTML = h;
  }

  /* ---------- 首页目录 ---------- */
  var grid = document.getElementById('toc-grid');
  if (grid) {
    var g = '';
    CHAPTERS.forEach(function (c) {
      g += '<a class="toc-card" href="' + c.f + '">' +
        '<div class="n">' + name(c) + '</div>' +
        '<div class="t">' + c.t + '</div>' +
        '<div class="d">' + c.d + '</div></a>';
    });
    grid.className = 'toc-grid';
    grid.innerHTML = g;
  }
})();
