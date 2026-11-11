/* ページの左に、項目別にジャンプできる目次（サイドバー）を出す。
   ・見出し（h2.section-title と h3.sub-title）から、自動で作る。ページのHTMLに、目次の中身を書く必要はない
   ・いま読んでいる項目を、目次の中で色つきで示す（スクロールに合わせて、切り替わる）
   ・項目を押すと、その見出しまで、なめらかに移動する。いちばん下の「↑」で、ページの先頭へ
   ・大見出しの下に小見出しがあるときは、大見出しの左の「›」で、小見出しを、折りたたんだり、開いたりできる。目次の上の「⋮」から、「Expand all（すべて開く）」「Collapse all（すべて閉じる）」もできる
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
    var nav = document.createElement('nav');
    nav.className = 'toc';
    nav.setAttribute('aria-label', 'Page contents');
    var list = document.createElement('ul');
    nav.appendChild(list);

    var links = [];   // { a, row, li, head, level, parent, sub, fold }
    var lastTop = null;   // いちばん最近の、大きな項目（小見出しは、この下に入る）
    function setFold(item, fold) {
        item.li.classList.toggle('is-folded', fold);
        item.fold.setAttribute('aria-expanded', fold ? 'false' : 'true');
    }
    function setAllFold(fold) {
        links.forEach(function (it) { if (it.sub) setFold(it, fold); });
    }
    function addItem(text, href, level, head) {
        var li = document.createElement('li');
        li.className = 'toc-l' + level;
        var row = document.createElement('div');
        row.className = 'toc-row';
        var a = document.createElement('a');
        a.href = href;
        a.textContent = text;
        row.appendChild(a);
        li.appendChild(row);
        var item = { a: a, row: row, li: li, head: head, level: level, parent: null, sub: null, fold: null };
        if (level === 2 && lastTop) {
            if (!lastTop.sub) {
                // 最初の小見出しが来たとき、親の大きな項目に、小見出しの入れ物と、折りたたみの「›」を、つける
                var wrap = document.createElement('div');   // 高さを、なめらかに変えるための包み（CSSで動かす）
                wrap.className = 'toc-sub-wrap';
                lastTop.sub = document.createElement('ul');
                lastTop.sub.className = 'toc-sub';
                wrap.appendChild(lastTop.sub);
                lastTop.li.appendChild(wrap);
                var fold = document.createElement('button');
                fold.type = 'button';
                fold.className = 'toc-fold';
                fold.setAttribute('aria-expanded', 'true');
                fold.setAttribute('aria-label', 'Show or hide sub-items');
                fold.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
                lastTop.fold = fold;
                lastTop.row.insertBefore(fold, lastTop.row.firstChild);
                (function (t) { fold.addEventListener('click', function () { setFold(t, !t.li.classList.contains('is-folded')); }); })(lastTop);
            }
            item.parent = lastTop;
            lastTop.sub.appendChild(li);
        } else {
            list.appendChild(li);
            if (level === 1) lastTop = item;
        }
        // 大きな項目の名前を押したときは、閉じていても、開く（移動先の小見出しが見えるように）
        a.addEventListener('click', function () { if (item.sub) setFold(item, false); });
        links.push(item);
    }
    // 目次には、上の大きな帯（ページのタイトル）は入れない。大見出し・小見出しだけ。ページの先頭へは、いちばん下の「↑」で戻れる
    heads.forEach(function (h) {
        addItem(h.textContent.trim(), '#' + ensureId(h), h.tagName === 'H2' ? 1 : 2, h);
    });

    /* ---- 目次の上：「⋮」から、すべて開く／すべて閉じる（折りたためる項目があるときだけ） ---- */
    var tools = null;
    var menu = null;
    var menuBtn = null;
    if (links.some(function (it) { return it.sub; })) {
        tools = document.createElement('div');
        tools.className = 'toc-tools';
        menuBtn = document.createElement('button');
        menuBtn.type = 'button';
        menuBtn.className = 'toc-menu-btn';
        menuBtn.setAttribute('aria-label', 'Contents menu');
        menuBtn.setAttribute('aria-haspopup', 'menu');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
        menu = document.createElement('div');
        menu.className = 'toc-menu';
        menu.setAttribute('role', 'menu');
        menu.hidden = true;
        var chev = 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
        [
            { label: 'Expand all', fold: false, icon: '<svg viewBox="0 0 24 24" width="16" height="16" ' + chev + '><path d="M6 5l6 6 6-6"/><path d="M6 12l6 6 6-6"/></svg>' },
            { label: 'Collapse all', fold: true, icon: '<svg viewBox="0 0 24 24" width="16" height="16" ' + chev + '><path d="M6 12l6-6 6 6"/><path d="M6 19l6-6 6 6"/></svg>' }
        ].forEach(function (m) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'toc-menu-item';
            b.setAttribute('role', 'menuitem');
            b.innerHTML = m.icon + '<span>' + m.label + '</span>';
            b.addEventListener('click', function () { setAllFold(m.fold); closeMenu(); });
            menu.appendChild(b);
        });
        tools.appendChild(menuBtn);
        tools.appendChild(menu);
        menuBtn.addEventListener('click', function () {
            var open = menu.hidden;
            menu.hidden = !open;
            menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        document.addEventListener('click', function (e) { if (!tools.contains(e.target)) closeMenu(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
    }
    function closeMenu() {
        if (!tools) return;
        menu.hidden = true;
        menuBtn.setAttribute('aria-expanded', 'false');
    }

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
    if (tools) side.appendChild(tools);
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
            ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg>'
            : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
        if (remember) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* 保存できなくても、何もしない */ } }
    }
    /* ボタンの縦の位置：ページの先頭では、上の大きな帯（タイトル）にかぶらないよう、目次のすぐ横（帯の下）に置く。
       スクロールしたら、画面の上から、BTN_TOP の位置に、固定される */
    var BTN_TOP = 91;      // 固定されるときの、画面の上からの距離(px)。目次の上の「⋮」と、高さ（真ん中）がそろう値
    var BTN_GAP = 7;       // 目次の上はしから、ボタンまでの距離(px)。同じく、「⋮」と、高さがそろう値
    function placeCollapse() {
        collapse.style.top = Math.max(BTN_TOP, layout.getBoundingClientRect().top + BTN_GAP) + 'px';
    }
    window.addEventListener('scroll', placeCollapse, { passive: true });
    window.addEventListener('resize', placeCollapse);
    window.addEventListener('load', placeCollapse);

    var saved = false;
    try { saved = localStorage.getItem(KEY) === '1'; } catch (e) { /* 読めなくても、開いた状態で始める */ }
    setCollapsed(saved, false);
    collapse.addEventListener('click', function () { setCollapsed(!layout.classList.contains('is-collapsed'), true); });
    placeCollapse();

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
        if (links[idx].parent) setFold(links[idx].parent, false);   // 閉じている大きな項目の中の、小見出しを読み始めたら、その項目を開く（選ばれた項目が、見えるように）
        // 親（大見出し）を探す：小見出しが選ばれているときは、その親も、薄く示す
        var parent = -1;
        for (var p = idx; p >= 0; p--) { if (links[p].level === 1) { parent = p; break; } }
        links.forEach(function (it, k) {
            var active = k === idx;
            it.a.classList.toggle('is-active', active);
            it.li.classList.toggle('is-parent', !active && k === parent && links[idx].level === 2);
            it.row.classList.toggle('is-current', active);
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
