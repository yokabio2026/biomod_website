/* ページの左に、項目別にジャンプできる目次（サイドバー）を出す。
   ・見出し（h2.section-title と h3.sub-title）から、自動で作る。ページのHTMLに、目次の中身を書く必要はない
   ・いま読んでいる項目を、目次の中で色つきで示す（スクロールに合わせて、切り替わる）
   ・項目を押すと、その見出しまで、なめらかに移動する。いちばん下の「↑」で、ページの先頭へ
   ・画面が広いとき：左に固定（スクロールしても、ついてくる）／狭いとき（スマホなど）：「Contents」ボタンで、横から開く
   使いかた：ページの </body> の前に、<script src="toc.js"></script> を足す（style.css のあとに toc.css も読み込む）。
   見出しが2つより少ないページには、出さない */
(function () {
    'use strict';

    var main = document.querySelector('main.content');
    if (!main) return;
    var heads = Array.prototype.slice.call(main.querySelectorAll('h2.section-title, h3.sub-title'));
    var sections = Array.prototype.slice.call(main.querySelectorAll(':scope > .content-section'));
    if (heads.length < 2 || !sections.length) return;

    var NAV_OFFSET = 140;   // 見出しが、画面の上からこの距離より上に来たら、「読んでいる項目」とみなす(px)
    var WIDE = window.matchMedia('(min-width: 1000px)');

    /* ---- 見出しに、移動先の id をつける（すでにあれば、そのまま使う） ---- */
    var used = {};
    Array.prototype.forEach.call(document.querySelectorAll('[id]'), function (e) { used[e.id] = true; });
    function slug(text) {
        var s = text.toLowerCase().replace(/[^a-z0-9぀-ヿ一-龯]+/g, '-').replace(/^-+|-+$/g, '');
        return s || 'section';
    }
    function ensureId(el) {
        if (el.id) return el.id;
        var base = slug(el.textContent);
        var id = base;
        var n = 2;
        while (used[id]) { id = base + '-' + n; n++; }
        used[id] = true;
        el.id = id;
        return id;
    }

    /* ---- 目次を作る ---- */
    var heroTitle = main.querySelector('.page-hero-header h1');
    var nav = document.createElement('nav');
    nav.className = 'toc';
    nav.setAttribute('aria-label', 'Page contents');
    var list = document.createElement('ul');
    nav.appendChild(list);

    var links = [];   // { a, head, level }
    function addItem(text, href, level, head) {
        var li = document.createElement('li');
        li.className = 'toc-l' + level;
        var a = document.createElement('a');
        a.href = href;
        a.textContent = text;
        li.appendChild(a);
        list.appendChild(li);
        links.push({ a: a, head: head, level: level, li: li });
    }
    // いちばん上：ページのタイトル（先頭へ）
    if (heroTitle) {
        ensureId(heroTitle);
        addItem(heroTitle.textContent.trim(), '#' + heroTitle.id, 1, heroTitle);
    }
    heads.forEach(function (h) {
        addItem(h.textContent.trim(), '#' + ensureId(h), h.tagName === 'H2' ? 1 : 2, h);
    });

    var top = document.createElement('a');
    top.className = 'toc-top';
    top.href = '#';
    top.setAttribute('aria-label', 'Back to top');
    top.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
    top.addEventListener('click', function (e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (window.history && history.replaceState) history.replaceState(null, '', location.pathname + location.search);   // 先頭に戻ったら、アドレスの #項目名 も消す
        closeDrawer();
    });

    /* ---- ページの並び：左に目次、右に本文（本文の見た目は、そのまま） ---- */
    var layout = document.createElement('div');
    layout.className = 'toc-layout';
    var side = document.createElement('aside');
    side.className = 'toc-side';
    side.appendChild(nav);
    side.appendChild(top);
    var body = document.createElement('div');
    body.className = 'toc-main';
    main.insertBefore(layout, sections[0]);
    layout.appendChild(side);
    layout.appendChild(body);
    sections.forEach(function (s) { body.appendChild(s); });

    /* ---- 狭い画面：「Contents」ボタンで、横から開く ---- */
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'toc-toggle';
    toggle.setAttribute('aria-label', 'Open contents');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg><span>Contents</span>';
    var backdrop = document.createElement('div');
    backdrop.className = 'toc-backdrop';
    document.body.appendChild(toggle);
    document.body.appendChild(backdrop);

    /* ---- 広い画面：1つのボタンで、目次を、閉じたり開いたりする ----
       ・左上（メニューバーの下）に、小さなボタン。目次が開いているときは「‹」（閉じる）、閉じているときは「☰」（開く）
       ・閉じると、本文が、画面いっぱいに広がる。開いたか閉じたかは、このブラウザに覚えておく（次に開いたときも、同じ状態）
       ・狭い画面（スマホなど）では、このボタンは出さない（「Contents」ボタンを使う） */
    var KEY = 'yokabio-toc-collapsed';
    var collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.className = 'toc-collapse';
    document.body.appendChild(collapse);

    function setCollapsed(on, remember) {
        layout.classList.toggle('is-collapsed', on);
        collapse.classList.toggle('is-collapsed', on);
        collapse.setAttribute('aria-expanded', on ? 'false' : 'true');
        collapse.setAttribute('aria-label', on ? 'Show contents' : 'Hide contents');
        collapse.setAttribute('data-tip', on ? 'Show contents' : 'Hide contents');   // 説明は、カーソルを重ねたときだけ、CSSで出す
        collapse.innerHTML = on
            ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>'
            : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
        if (remember) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* 保存できなくても、何もしない */ } }
    }
    var saved = false;
    try { saved = localStorage.getItem(KEY) === '1'; } catch (e) { /* 読めなくても、開いた状態で始める */ }
    setCollapsed(saved, false);
    collapse.addEventListener('click', function () { setCollapsed(!layout.classList.contains('is-collapsed'), true); });

    function openDrawer() {
        side.classList.add('is-open');
        backdrop.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
    }
    function closeDrawer() {
        side.classList.remove('is-open');
        backdrop.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
    }
    toggle.addEventListener('click', function () { if (side.classList.contains('is-open')) closeDrawer(); else openDrawer(); });
    backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a') && !WIDE.matches) closeDrawer(); });   // 項目を選んだら、閉じる

    /* ---- いま読んでいる項目を、目次の中で示す ---- */
    var current = -1;
    function update() {
        var idx = 0;
        for (var i = links.length - 1; i >= 0; i--) {
            if (links[i].head.getBoundingClientRect().top <= NAV_OFFSET) { idx = i; break; }
        }
        // ページの一番下まで来たら、最後の項目（最後の見出しが、基準に届かないことがあるため）
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) idx = links.length - 1;
        if (idx === current) return;
        current = idx;
        // 親（大見出し）を探す：小見出しが選ばれているときは、その親も、薄く示す
        var parent = -1;
        for (var p = idx; p >= 0; p--) { if (links[p].level === 1) { parent = p; break; } }
        links.forEach(function (it, k) {
            var active = k === idx;
            it.a.classList.toggle('is-active', active);
            it.li.classList.toggle('is-parent', !active && k === parent && links[idx].level === 2);
            if (active) it.a.setAttribute('aria-current', 'true'); else it.a.removeAttribute('aria-current');
        });
        // 目次が長くて、はみ出しているときは、選ばれた項目が見えるように、目次の中だけ動かす
        var a = links[idx].a;
        var sr = side.getBoundingClientRect();
        var ar = a.getBoundingClientRect();
        if (ar.top < sr.top + 8 || ar.bottom > sr.bottom - 56) side.scrollTop += ar.top - sr.top - 80;
    }
    var ticking = false;
    function onScroll() {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () { ticking = false; update(); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('load', update);
    update();
})();
