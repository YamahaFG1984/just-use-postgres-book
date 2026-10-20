/* ================================================================
   Just Use Postgres 教程 · 站内搜索
   第一次打开搜索时，抓取全部页面、按小节建立索引（只在浏览器里做，不需要构建步骤）。
   由 site.js 按需加载，页面列表来自 window.JUP_CHAPTERS。
   ================================================================ */
(function () {
  'use strict';

  var CH = window.JUP_CHAPTERS || [];
  var index = null, loading = null;
  var modal, input, list, hint, items = [], sel = 0;

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // 把一页拆成小节：h2 开始一个新小节，h3 也单独成一节（链接到所属 h2 的锚点）
  function parse(c, html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var main = doc.querySelector('main');
    if (!main) return [];
    main.querySelectorAll('svg, script, #pager, #chapter-toc, .chapter-eyebrow').forEach(function (e) { e.remove(); });
    var out = [], h2 = { id: '', title: '' };
    var sec = { c: c, id: '', title: c.t, text: '' };
    Array.prototype.forEach.call(main.children, function (el) {
      var tag = el.tagName;
      if (tag === 'H1') return;
      if (tag === 'H2' || tag === 'H3') {
        if (norm(sec.text)) out.push(sec);
        var t = norm(el.textContent);
        if (tag === 'H2') h2 = { id: el.id || '', title: t };
        sec = { c: c, id: el.id || h2.id, title: tag === 'H2' ? t : h2.title + ' › ' + t, text: '' };
        return;
      }
      sec.text += ' ' + el.textContent;
    });
    if (norm(sec.text)) out.push(sec);
    out.forEach(function (s) { s.text = norm(s.text); s.hay = (s.title + ' ' + s.text).toLowerCase(); });
    return out;
  }

  function build() {
    if (!loading) {
      loading = Promise.all(CH.map(function (c) {
        return fetch(c.f).then(function (r) {
          if (!r.ok) throw new Error(r.status);
          return r.text();
        }).then(function (h) { return parse(c, h); });
      })).then(function (arr) {
        index = [].concat.apply([], arr);
        return index;
      }).catch(function (e) { loading = null; throw e; });
    }
    return loading;
  }

  function count(hay, term) {
    var n = 0, i = hay.indexOf(term);
    while (i >= 0 && n < 20) { n++; i = hay.indexOf(term, i + term.length); }
    return n;
  }

  function mark(s, terms) {
    var re = new RegExp('(' + terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'gi');
    return esc(s).replace(re, '<mark>$1</mark>');
  }

  function snippet(text, terms) {
    var low = text.toLowerCase(), at = -1;
    terms.forEach(function (t) { var i = low.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; });
    if (at < 0) return text.slice(0, 90);
    var start = Math.max(0, at - 36);
    return (start ? '…' : '') + text.slice(start, start + 110) + (start + 110 < text.length ? '…' : '');
  }

  function search(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    var res = [];
    index.forEach(function (s) {
      var tl = s.title.toLowerCase(), score = 0;
      for (var i = 0; i < terms.length; i++) {
        var n = count(s.hay, terms[i]);
        if (!n) return;                                  // 每个词都必须出现
        score += n + (tl.indexOf(terms[i]) >= 0 ? 20 : 0);
      }
      res.push({ s: s, score: score });
    });
    res.sort(function (a, b) { return b.score - a.score; });
    return res.slice(0, 40).map(function (r) { return r.s; });
  }

  function label(c) {
    if (c.tag) return c.tag;
    if (/^\d+$/.test(c.label)) return '第 ' + c.label + ' 章';
    if (/^S\d+$/.test(c.label)) return '专题 ' + c.label.slice(1);
    return '附录 ' + c.label;
  }

  function render() {
    var q = input.value.trim();
    if (!q) { list.innerHTML = ''; hint.textContent = '输入关键词，比如：窗口函数、GIN、SKIP LOCKED、jsonb_set'; items = []; return; }
    if (!index) { hint.textContent = '正在建立索引……'; return; }
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    var res = search(q);
    hint.textContent = res.length ? '找到 ' + res.length + (res.length === 40 ? '+' : '') + ' 处　↑↓ 选择　Enter 打开　Esc 关闭' : '没有找到“' + q + '”，换个关键词试试';
    list.innerHTML = res.map(function (s, i) {
      return '<li><a href="' + s.c.f + (s.id ? '#' + s.id : '') + '" data-i="' + i + '">' +
        '<span class="sr-where">' + esc(label(s.c) + ' · ' + s.c.t) + '</span>' +
        '<span class="sr-title">' + mark(s.title, terms) + '</span>' +
        '<span class="sr-snip">' + mark(snippet(s.text, terms), terms) + '</span></a></li>';
    }).join('');
    items = Array.prototype.slice.call(list.querySelectorAll('a'));
    sel = 0; highlight();
  }

  function highlight() {
    items.forEach(function (a, i) { a.classList.toggle('sel', i === sel); });
    if (items[sel]) items[sel].scrollIntoView({ block: 'nearest' });
  }

  function close() { modal.classList.remove('open'); document.body.classList.remove('search-open'); }

  function create() {
    modal = document.createElement('div');
    modal.id = 'search-modal';
    modal.innerHTML = '<div class="sm-box" role="dialog" aria-label="站内搜索">' +
      '<input type="search" placeholder="搜索整个教程……" aria-label="搜索关键词" autocomplete="off">' +
      '<div class="sm-hint"></div><ul class="sm-list"></ul></div>';
    document.body.appendChild(modal);
    input = modal.querySelector('input');
    list = modal.querySelector('.sm-list');
    hint = modal.querySelector('.sm-hint');
    modal.addEventListener('click', function (e) {
      if (e.target === modal) close();
      var a = e.target.closest && e.target.closest('a');
      if (a) close();   // 同页锚点跳转时也要关掉弹窗
    });
    input.addEventListener('input', render);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (sel < items.length - 1) { sel++; highlight(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (sel > 0) { sel--; highlight(); } }
      else if (e.key === 'Enter' && items[sel]) { e.preventDefault(); close(); location.href = items[sel].href; }
    });
  }

  function open() {
    if (!modal) create();
    modal.classList.add('open');
    document.body.classList.add('search-open');
    input.focus(); input.select();
    render();
    if (!index) {
      build().then(render).catch(function () {
        hint.textContent = '无法读取页面。搜索需要通过网址访问（GitHub Pages，或在 docs 目录运行 python3 -m http.server），直接双击打开 html 文件时不可用。';
      });
    }
  }

  window.JUPSearch = { open: open };
})();
