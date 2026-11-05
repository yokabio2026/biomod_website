/* 画像を、左右にめくれるようにする（スライダー）。
   ・使いかた：画像（<figure>）を、<div class="carousel"> の中に並べるだけ。このファイルが、ボタン・点・スワイプを、自動でつける
        <div class="carousel" aria-label="説明">
            <figure><img src="images/a.png" alt="説明"><figcaption>画像の説明（なくてもよい）</figcaption></figure>
            <figure><img src="images/b.png" alt="説明"><figcaption>…</figcaption></figure>
        </div>
   ・めくりかた：左右の矢印／下の点／スマホは指でスワイプ／パソコンはドラッグ／キーボードの ← →
   ・最後まで行くと、最初に戻る（ぐるぐる回る）
   ・画像の縦横の比は、data-ratio="16/9" のように、変えられる（省略すると 16/10。比がちがう画像は、中に収まるように表示する）
   ・画像が1枚だけのときは、矢印も点も出さない */
(function () {
    'use strict';

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function init(root) {
        var slides = Array.prototype.slice.call(root.children).filter(function (el) { return el.tagName === 'FIGURE' || el.tagName === 'IMG'; });
        if (!slides.length) return;
        var n = slides.length;
        var index = 0;

        /* ---- 組み立て：ステージ（画像が並ぶ窓）＋ 矢印 ＋ 点 ＋ 説明文 ---- */
        var stage = document.createElement('div');
        stage.className = 'carousel-stage';
        if (root.dataset.ratio) stage.style.setProperty('--carousel-ratio', root.dataset.ratio);
        var track = document.createElement('div');
        track.className = 'carousel-track';
        var captions = [];
        slides.forEach(function (el, i) {
            var slide = document.createElement('div');
            slide.className = 'carousel-slide';
            slide.setAttribute('role', 'group');
            slide.setAttribute('aria-roledescription', 'slide');
            slide.setAttribute('aria-label', (i + 1) + ' / ' + n);
            var img = el.tagName === 'IMG' ? el : el.querySelector('img');
            var cap = el.tagName === 'FIGURE' ? el.querySelector('figcaption') : null;
            captions.push(cap ? cap.innerHTML : '');
            if (img) { img.draggable = false; slide.appendChild(img); }
            track.appendChild(slide);
        });
        stage.appendChild(track);

        var captionBox = document.createElement('p');
        captionBox.className = 'carousel-caption';
        captionBox.setAttribute('aria-live', 'polite');

        var prev = null;
        var next = null;
        var dots = [];
        if (n > 1) {
            prev = button('carousel-btn carousel-prev', 'Previous image', '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4l-8 8 8 8"/></svg>');
            next = button('carousel-btn carousel-next', 'Next image', '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4l8 8-8 8"/></svg>');
            var dotBox = document.createElement('div');
            dotBox.className = 'carousel-dots';
            for (var i = 0; i < n; i++) {
                (function (k) {
                    var d = button('carousel-dot', 'Go to image ' + (k + 1), '');
                    d.addEventListener('click', function () { go(k); });
                    dotBox.appendChild(d);
                    dots.push(d);
                })(i);
            }
            stage.appendChild(prev);
            stage.appendChild(next);
            stage.appendChild(dotBox);
            prev.addEventListener('click', function () { go(index - 1); });
            next.addEventListener('click', function () { go(index + 1); });
        }

        root.textContent = '';
        root.classList.add('is-ready');
        root.setAttribute('role', 'region');
        root.setAttribute('aria-roledescription', 'carousel');
        root.tabIndex = 0;
        root.appendChild(stage);
        root.appendChild(captionBox);

        function button(cls, label, html) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = cls;
            b.setAttribute('aria-label', label);
            b.innerHTML = html;
            return b;
        }

        function render(animate) {
            track.classList.toggle('is-dragging', !animate);
            track.style.transform = 'translateX(' + (-index * 100) + '%)';
            dots.forEach(function (d, k) {
                d.classList.toggle('is-active', k === index);
                if (k === index) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
            });
            captionBox.innerHTML = captions[index];
            captionBox.hidden = !captions[index];
        }

        function go(i) {
            index = (i + n) % n;   // 最後の次は、最初
            render(true);
        }

        /* ---- スワイプ・ドラッグ ---- */
        var startX = 0;
        var startY = 0;
        var dx = 0;
        var dragging = false;
        var locked = false;   // 縦のスクロールだと分かったら、横めくりをやめる
        track.addEventListener('pointerdown', function (e) {
            if (n < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
            dragging = true;
            locked = false;
            startX = e.clientX;
            startY = e.clientY;
            dx = 0;
        });
        track.addEventListener('pointermove', function (e) {
            if (!dragging || locked) return;
            var mx = e.clientX - startX;
            var my = e.clientY - startY;
            if (Math.abs(my) > Math.abs(mx) && Math.abs(my) > 8 && Math.abs(dx) < 4) { locked = true; dragging = false; render(true); return; }
            dx = mx;
            if (Math.abs(dx) > 4) {
                try { track.setPointerCapture(e.pointerId); } catch (err) { /* 対応していなければ何もしない */ }
            }
            var w = stage.clientWidth || 1;
            track.classList.add('is-dragging');
            track.style.transform = 'translateX(calc(' + (-index * 100) + '% + ' + dx + 'px))';
            if (Math.abs(dx) > w) dx = dx > 0 ? w : -w;
        });
        function endDrag() {
            if (!dragging) return;
            dragging = false;
            var w = stage.clientWidth || 1;
            if (dx > Math.min(60, w * 0.15)) go(index - 1);
            else if (dx < -Math.min(60, w * 0.15)) go(index + 1);
            else render(true);
            dx = 0;
        }
        track.addEventListener('pointerup', endDrag);
        track.addEventListener('pointercancel', endDrag);
        track.addEventListener('pointerleave', function () { if (dragging && dx === 0) dragging = false; });

        /* ---- キーボード ---- */
        root.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowLeft') { go(index - 1); e.preventDefault(); }
            else if (e.key === 'ArrowRight') { go(index + 1); e.preventDefault(); }
        });

        render(false);
        if (reduce) track.classList.add('no-motion');
    }

    function initAll() {
        Array.prototype.forEach.call(document.querySelectorAll('.carousel'), function (c) { if (!c.classList.contains('is-ready')) init(c); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
    else initAll();
})();
