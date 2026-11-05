/* ページの一番下に、「Previous page」「Next page」のボタンを出す。
   ・順番は、上のメニュー（Home → Project → Design → Simulation → Experiment → Future → ELSI → Team）と同じ。
     メニューの並びを変えたり、ページを足したりすると、ボタンも自動で変わる（このファイルは、書き換えなくてよい）
   ・最初のページ（Home）には Previous を、最後のページ（Team）には Next を、出さない
   ・使いかた：ページの </body> の前に、<script src="page-nav.js"></script> を足す（page-nav.css も読み込む）。
     ボタンは、ページ（main）の、いちばん下に、自動で入る
   ・見本・練習用：<nav class="page-pager" data-pager-as="project.html"></nav> と書くと、その場所に、「Project ページのとき」のボタンを出せる
     （メニューにないページ＝sandbox などで、見本を見るときに使う） */
(function () {
    'use strict';

    var main = document.querySelector('main.content');
    var menu = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
    if (!main || !menu.length) return;

    function fileOf(href) {
        var f = (href || '').split('#')[0].split('?')[0].split('/').pop();
        return f || 'index.html';
    }

    var pages = menu.map(function (a) { return { href: a.getAttribute('href'), name: a.textContent.trim() }; });

    function arrow(dir) {
        return '<span class="pager-arrow" aria-hidden="true">' + (dir === 'prev' ? '&laquo;' : '&raquo;') + '</span>';
    }

    function fill(nav, current) {
        var i = -1;
        pages.forEach(function (p, k) { if (fileOf(p.href) === current) i = k; });
        if (i < 0) return;   // メニューにないページ：何も出さない
        nav.classList.add('page-pager');
        nav.setAttribute('aria-label', 'Page navigation');
        nav.textContent = '';
        if (i > 0) {
            var pv = pages[i - 1];
            var a = document.createElement('a');
            a.className = 'pager-btn pager-prev';
            a.href = pv.href;
            a.rel = 'prev';
            a.innerHTML = arrow('prev') + '<span class="pager-text"><small>Previous page</small><strong></strong></span>';
            a.querySelector('strong').textContent = pv.name;
            nav.appendChild(a);
        }
        if (i < pages.length - 1) {
            var nx = pages[i + 1];
            var b = document.createElement('a');
            b.className = 'pager-btn pager-next';
            b.href = nx.href;
            b.rel = 'next';
            b.innerHTML = '<span class="pager-text"><small>Next page</small><strong></strong></span>' + arrow('next');
            b.querySelector('strong').textContent = nx.name;
            nav.appendChild(b);
        }
    }

    var current = fileOf(location.pathname);
    var holders = Array.prototype.slice.call(main.querySelectorAll('.page-pager[data-pager-as]'));
    holders.forEach(function (h) { fill(h, fileOf(h.getAttribute('data-pager-as'))); });

    // 見本の置き場所が、ページの最後にない（＝ふつうのページ）ときは、いちばん下に、自動で入れる
    var last = main.lastElementChild;
    if (!(last && last.classList && last.classList.contains('page-pager'))) {
        var nav = document.createElement('nav');
        fill(nav, current);
        if (nav.classList.contains('page-pager')) main.appendChild(nav);
    }
})();
