document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('search-toggle-btn');
    const searchOverlay = document.getElementById('search-overlay');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    // 検索対象となるサイト内の全ページ
    const PAGES = [
        'index.html',
        'project.html',
        'design.html',
        'simulation.html',
        'experiment.html',
        'future.html',
        'elsi.html',
        'team.html'
    ];

    // 検索結果に表示するページ名（リンク先の目印用）
    const PAGE_LABELS = {
        'index.html': 'Home',
        'project.html': 'Project',
        'design.html': 'Design',
        'simulation.html': 'Simulation',
        'experiment.html': 'Experiment',
        'future.html': 'Future',
        'elsi.html': 'ELSI',
        'team.html': 'Team'
    };

    // { page, text } の形で各ページの<main>内テキストを保持する検索用インデックス
    let searchIndex = [];
    let indexReady = false;

    // file:// で直接開いている場合、fetch()でのページ読み込みがブラウザに
    // ブロックされるため、その旨をユーザーに伝えるためのフラグ
    const isFileProtocol = location.protocol === 'file:';

    // 各ページを取得し、<main>タグ内のテキストのみを抽出してインデックスを構築する
    async function buildSearchIndex() {
        const results = await Promise.all(PAGES.map(async (page) => {
            try {
                const res = await fetch(page);
                if (!res.ok) return [];
                const html = await res.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const main = doc.querySelector('main');
                if (!main) return [];

                // 見出しや段落、リストなど、意味のあるテキストブロック単位で抽出
                const blocks = main.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption');
                const entries = [];
                blocks.forEach((el) => {
                    const text = el.textContent.replace(/\s+/g, ' ').trim();
                    if (text) entries.push({ page, text });
                });
                return entries;
            } catch (err) {
                console.error(`検索インデックスの構築に失敗しました: ${page}`, err);
                return [];
            }
        }));

        searchIndex = results.flat();
        indexReady = true;
    }

    buildSearchIndex();

    // マッチ箇所を中心に前後を切り出した、元のページに実在する文字列そのままの window を返す
    function getSnippetWindow(text, escapedQuery, radius = 40) {
        const matchRegex = new RegExp(escapedQuery, 'i');
        const idx = text.search(matchRegex);
        if (idx === -1) return null;

        const matchText = text.match(matchRegex)[0];
        const start = Math.max(0, idx - radius);
        const end = Math.min(text.length, idx + matchText.length + radius);

        return {
            raw: text.slice(start, end),
            truncatedStart: start > 0,
            truncatedEnd: end < text.length
        };
    }

    // window を表示用に整形し、検索ワードをハイライトしたHTMLスニペットを作る
    function buildHighlightedSnippet(snippetWindow, escapedQuery) {
        let snippet = snippetWindow.raw;
        if (snippetWindow.truncatedStart) snippet = '…' + snippet;
        if (snippetWindow.truncatedEnd) snippet = snippet + '…';

        const highlightRegex = new RegExp(`(${escapedQuery})`, 'gi');
        return snippet.replace(highlightRegex, '<span class="highlight">$1</span>');
    }

    // Text Fragments（#:~:text=...）を使い、該当箇所まで自動スクロールするリンク先URLを作る
    function buildTextFragmentUrl(page, snippetWindow) {
        const fragmentText = encodeURIComponent(snippetWindow.raw.trim());
        return `${page}#:~:text=${fragmentText}`;
    }

    // 検索アイコンクリックで検索バーを開閉
    searchBtn.addEventListener('click', () => {
        searchOverlay.classList.toggle('hidden');
        if (!searchOverlay.classList.contains('hidden')) {
            // スクロール位置を維持したままフォーカスを当てる
            searchInput.focus({ preventScroll: true });
        }
    });

    // 検索窓に文字が入力されるたびに実行
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        searchResults.innerHTML = ''; // 結果を一旦クリア

        if (query === '') return;

        if (!indexReady) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'search-result-item';
            loadingDiv.textContent = 'Preparing search...';
            searchResults.appendChild(loadingDiv);
            return;
        }

        // file:// で開いている場合はページ間のfetchが常に失敗するため、
        // 原因が分かるメッセージを表示して案内する
        if (isFileProtocol && searchIndex.length === 0) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'search-result-item';
            warningDiv.textContent = 'Search doesn\'t work when this page is opened directly as a file. Please view the site through a web server (e.g. a local server or a hosted URL) for search to work.';
            searchResults.appendChild(warningDiv);
            return;
        }

        // 大文字小文字を区別せず、検索ワードをキャッチする正規表現
        // 特殊文字のエスケープ処理
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matchRegex = new RegExp(escapedQuery, 'i');

        // サイト内の全ページから検索ワードを含む文章を抽出
        const matches = searchIndex.filter((entry) => matchRegex.test(entry.text));

        if (matches.length > 0) {
            matches.forEach(({ page, text }) => {
                const snippetWindow = getSnippetWindow(text, escapedQuery);
                if (!snippetWindow) return;

                const snippetHtml = buildHighlightedSnippet(snippetWindow, escapedQuery);
                const pageLabel = PAGE_LABELS[page] || page;

                // 結果全体をリンク化し、クリックで該当箇所までスクロールして遷移できるようにする
                const resultLink = document.createElement('a');
                resultLink.href = buildTextFragmentUrl(page, snippetWindow);
                resultLink.className = 'search-result-item';
                resultLink.innerHTML = `<span class="search-result-page">${pageLabel}</span>${snippetHtml}`;
                searchResults.appendChild(resultLink);
            });
        } else {
            const noResultDiv = document.createElement('div');
            noResultDiv.className = 'search-result-item';
            noResultDiv.textContent = 'No results found.';
            searchResults.appendChild(noResultDiv);
        }
    });

    // マウスに追従するDNA二重螺旋のカーソルエフェクトを開始する
    initDnaCursor();
});

/* =====================================================================
   DNA二重螺旋カーソルエフェクト（Canvas 2D）
   ===================================================================== */

// 螺旋1つ分の基本寸法（メイン用）。残像はscaleで縮小して使う
const HELIX_LENGTH = 28;   // 長さ(px)
const HELIX_WIDTH = 10;    // 幅(px)
const HELIX_TURNS = 1.5;   // 回転数（小さくても線が詰まらず形が読める程度に抑える）
const HELIX_RUNGS = 4;     // 塩基対（横棒）の本数
const HELIX_STEPS = 36;    // ストランドを折れ線で近似する分割数
const HELIX_BASE_PHASE = Math.PI / 4; // 端が交差点にぴったり重ならないようにする基準位相

// メインを小さくしても、残像の実寸（従来の長さ44px基準）は変えないための補正倍率
const PARTICLE_SIZE_FACTOR = 44 / HELIX_LENGTH;

// canvasのdevicePixelRatio。shadowBlurは変換の影響を受けないため、描画側で掛ける
let dnaCanvasDpr = 1;

/**
 * 二重螺旋を1つ描画する（メインと残像で共通）。
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x, y   螺旋の中心座標（CSS px）
 * @param {number} angle  螺旋の長さ方向の向き（ラジアン）
 * @param {number} scale  拡大率（1 = 長さ28px × 幅10px）
 * @param {string|string[]} color 単色、または[始点側, 終点側]のグラデーション
 * @param {number} alpha  不透明度 0〜1
 * @param {number} [phase] ストランドの位相（ゆっくり変えると螺旋が回って見える）
 * @param {number} [glow]  グローの強さ（shadowBlur）
 * @param {number} [lineWidthPx] ストランドの線幅を画面上のpxで固定する（省略時はscaleに応じた幅）
 */
function drawHelix(ctx, x, y, angle, scale, color, alpha, phase = 0, glow = 8, lineWidthPx = null) {
    const half = HELIX_LENGTH / 2;
    const amp = HELIX_WIDTH / 2;

    // 線幅は画面上でメイン約2px。小さい残像でも1px台は確保する
    const screenLineWidth = lineWidthPx !== null ? lineWidthPx : (scale >= 1 ? 2 * scale : 1 + scale);
    const lineWidth = screenLineWidth / scale;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let strokeStyle = color;
    let glowColor = color;
    if (Array.isArray(color)) {
        const gradient = ctx.createLinearGradient(-half, 0, half, 0);
        gradient.addColorStop(0, color[0]);
        gradient.addColorStop(1, color[color.length - 1]);
        strokeStyle = gradient;
        glowColor = color[color.length - 1];
    }

    // 2本のストランド：位相を180°ずらしたsin波。
    // 奥行き（cos成分）が手前側の区間と奥側の区間に分けて、螺旋らしく見せる
    const phaseAt = (t) => Math.PI * 2 * HELIX_TURNS * t + HELIX_BASE_PHASE + phase;
    const frontStrands = new Path2D();
    const backStrands = new Path2D();
    for (let s = 0; s < 2; s++) {
        const sign = s === 0 ? 1 : -1;
        let prevX = 0;
        let prevY = 0;
        for (let i = 0; i <= HELIX_STEPS; i++) {
            const t = i / HELIX_STEPS;
            const px = -half + t * HELIX_LENGTH;
            const py = sign * amp * Math.sin(phaseAt(t));
            if (i > 0) {
                const midT = t - 0.5 / HELIX_STEPS;
                const isFront = sign * Math.cos(phaseAt(midT)) > 0;
                const target = isFront ? frontStrands : backStrands;
                target.moveTo(prevX, prevY);
                target.lineTo(px, py);
            }
            prevX = px;
            prevY = py;
        }
    }

    // 塩基対：2本のストランドを結ぶ横棒
    const rungs = new Path2D();
    for (let r = 0; r < HELIX_RUNGS; r++) {
        const t = (r + 0.5) / HELIX_RUNGS;
        const px = -half + t * HELIX_LENGTH;
        const py = amp * Math.sin(phaseAt(t));
        rungs.moveTo(px, py);
        rungs.lineTo(px, -py);
    }

    ctx.strokeStyle = strokeStyle;

    // 奥のストランド → 横棒 → 手前のストランドの順に重ねて描く
    const strokeAll = () => {
        ctx.globalAlpha = alpha * 0.45;
        ctx.lineWidth = lineWidth;
        ctx.stroke(backStrands);
        ctx.globalAlpha = alpha * 0.75;
        ctx.lineWidth = lineWidth * 0.65;
        ctx.stroke(rungs);
        ctx.globalAlpha = alpha;
        ctx.lineWidth = lineWidth;
        ctx.stroke(frontStrands);
    };

    // 1回目：グロー付きで描く
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glow * dnaCanvasDpr;
    strokeAll();

    // 2回目：グローなしでくっきりした線を重ね、光で形がつぶれないようにする
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    strokeAll();

    ctx.restore();
}

function initDnaCursor() {
    // 動きを減らす設定、またはタッチ主体の端末ではエフェクトを無効にする
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

    const MAIN_COLOR = ['#4a7dff', '#7fd8ff']; // 後ろ側が青、進行方向側がシアン
    const MAIN_FOLLOW = 0.5;                   // 位置のlerp係数（カーソルからほとんど遅れない）
    const ANGLE_FOLLOW = 0.15;                 // 向きのlerp係数
    const MAIN_SCALE = 0.9;                    // メイン螺旋の大きさ（基本寸法の90%）。線幅は2pxのまま
    const MAIN_LINE_WIDTH = 2;                 // メイン螺旋の線幅(px)
    const MAIN_CENTER_RATIO = 0.3;             // 中心 = マウス座標 − 進行方向 × 螺旋の長さ × 0.3
    const MAIN_LENGTH = HELIX_LENGTH * MAIN_SCALE; // メイン螺旋の実際の長さ(px)
    const IDLE_ANGLE = (-35 * Math.PI) / 180;  // 停止中の待機角度（カーソルの左下に斜めで待機）
    const IDLE_DELAY = 150;                    // 停止とみなすまでの時間(ms)
    const SPAWN_DISTANCE_MIN = 40;             // 残像を出す移動距離(px)の最小
    const SPAWN_DISTANCE_MAX = 60;             // 同・最大
    const MAX_PARTICLES = 150;
    const PARTICLE_MAX_ALPHA = 0.7;            // 残像の最大不透明度（控えめな明るさ）
    const HELIX_LIFE_MIN = 900;                // 残像の寿命(ms)：0.9〜1.3秒
    const HELIX_LIFE_MAX = 1300;
    const HELIX_FADE_IN = 100;                 // 生成直後に0→最大へ光る時間(ms)
    const PURPLE_FROM = [0x6a, 0x8c, 0xff];    // #6a8cff
    const PURPLE_TO = [0x9b, 0x6b, 0xff];      // #9b6bff

    // キラキラした光の粒（スパーク）の設定
    const SPARK_COUNT_MIN = 1;                 // 残像の螺旋1つにつき1〜2個
    const SPARK_COUNT_MAX = 2;
    const SPARK_SCATTER = 15;                  // 生成地点からの散らし幅(±px)
    const SPARK_TRAIL_DISTANCE = 40;           // メイン螺旋の後端から1個出す移動距離(px)
    const SPARK_BIG_DIAMETER = 2.2;            // この直径以上を「大きめの粒」とみなす(px)
    const SPARK_LIFE_MIN = 800;                // 寿命(ms)：0.8〜1.5秒
    const SPARK_LIFE_MAX = 1500;
    const SPARK_FADE_IN = 40;                  // 生成直後に0→最大へ出現する時間(ms)
    const MAX_SPARKS = 200;                    // スパークの上限（超えたら古いものから削除）

    const canvas = document.createElement('canvas');
    canvas.className = 'dna-cursor-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let viewW = 0;
    let viewH = 0;
    function resizeCanvas() {
        dnaCanvasDpr = window.devicePixelRatio || 1;
        viewW = window.innerWidth;
        viewH = window.innerHeight;
        canvas.width = Math.round(viewW * dnaCanvasDpr);
        canvas.height = Math.round(viewH * dnaCanvasDpr);
        ctx.setTransform(dnaCanvasDpr, 0, 0, dnaCanvasDpr, 0, 0);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // メイン螺旋の状態
    const main = { x: 0, y: 0, angle: IDLE_ANGLE, targetAngle: IDLE_ANGLE, alpha: 0 };
    let hasMoved = false;
    let pointerInside = true;
    let mouseX = 0;
    let mouseY = 0;
    let lastMoveTime = 0;
    let lastSpawnX = 0;
    let lastSpawnY = 0;
    let lastSparkX = 0;
    let lastSparkY = 0;
    let lastDirX = 0;
    let lastDirY = 0;
    let nextSpawnDistance = 0;

    const particles = []; // 残像の螺旋（古い順）
    const sparks = [];    // キラキラした光の粒（古い順）

    function randomRange(min, max) {
        return min + Math.random() * (max - min);
    }

    function mixColor(t) {
        const c = PURPLE_FROM.map((from, i) => Math.round(from + (PURPLE_TO[i] - from) * t));
        return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }

    // 2つの色（#rrggbb）の間のランダムな色
    function mixHex(from, to, t) {
        const a = parseInt(from.slice(1), 16);
        const b = parseInt(to.slice(1), 16);
        const channel = (shift) => {
            const fromC = (a >> shift) & 255;
            const toC = (b >> shift) & 255;
            return Math.round(fromC + (toC - fromC) * t);
        };
        return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
    }

    // 光の粒の不透明度：sin波で0.6〜1.0を明滅させて瞬きを表現する。
    // 螺旋と同じく寿命の最後の20%までは維持し、最後だけ0へ落とす
    function sparkAlpha(s, ageMs) {
        const hold = ageMs / s.life < 0.8 ? 1 : 1 - (ageMs / s.life - 0.8) / 0.2;
        const fadeIn = Math.min(1, ageMs / SPARK_FADE_IN);
        const blink = 0.8 + 0.2 * Math.sin((ageMs / 1000) * s.twinkleSpeed + s.twinklePhase);
        return blink * hold * fadeIn;
    }

    // 螺旋の残像用の不透明度：最初の0.1秒で0→最大に光り、寿命の最後の20%まではほぼ維持し、
    // 最後だけ0へ落とす（消えるのは主に縮小で表現する）。
    // 維持している間はsin波で±10%だけ明滅させる（最大でもPARTICLE_MAX_ALPHAを超えない）
    function helixAlpha(ageMs, life, twinklePhase) {
        if (ageMs < HELIX_FADE_IN) return PARTICLE_MAX_ALPHA * (ageMs / HELIX_FADE_IN);
        const t = ageMs / life;
        const hold = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
        const twinkle = 1 + 0.1 * Math.sin(ageMs * 0.05 + twinklePhase);
        return (PARTICLE_MAX_ALPHA / 1.1) * hold * twinkle;
    }

    function addParticle(p) {
        particles.push(p);
        while (particles.length > MAX_PARTICLES) particles.shift();
    }

    // 小さな螺旋の残像を1つ生成し、そのまわりにスパークも散らす
    function spawnHelix(x, y, direction, now) {
        // 位置：進行方向と垂直に±8pxずらして、一直線に並びすぎないようにする
        const perp = direction + Math.PI / 2;
        const offset = randomRange(-8, 8);
        const px = x + Math.cos(perp) * offset;
        const py = y + Math.sin(perp) * offset;

        const drift = randomRange(0.1, 0.3);            // 0.1〜0.3 px/frame
        const driftDir = Math.random() * Math.PI * 2;
        const color = mixColor(Math.random());
        addParticle({
            type: 'helix',
            x: px,
            y: py,
            angle: direction + randomRange(-35, 35) * Math.PI / 180, // 進行方向±35°
            baseScale: randomRange(0.2, 0.5) * PARTICLE_SIZE_FACTOR,
            color,
            phase: Math.random() * Math.PI * 2,
            twinklePhase: Math.random() * Math.PI * 2,
            vx: Math.cos(driftDir) * drift,
            vy: Math.sin(driftDir) * drift,
            born: now,
            life: randomRange(HELIX_LIFE_MIN, HELIX_LIFE_MAX)
        });
        spawnSparks(px, py, now, color); // 光の粒は、この螺旋と同じ色にする
    }

    // 光の粒を1つ、(x, y) の周囲±15pxにランダムに散らして生成する（色は近くの螺旋と同じ）
    function spawnSpark(x, y, now, color) {
        // 直径1〜3px。ほとんどは小さく、たまに大きめの粒が混ざる（乱数を3乗して小さい側に偏らせる）
        const diameter = 1 + 2 * Math.pow(Math.random(), 3);
        const isBig = diameter >= SPARK_BIG_DIAMETER;
        const speed = randomRange(0.05, 0.2);           // ほぼその場で、ごくわずかに漂う(px/frame)
        const driftDir = Math.random() * Math.PI * 2;
        sparks.push({
            x: x + randomRange(-SPARK_SCATTER, SPARK_SCATTER),
            y: y + randomRange(-SPARK_SCATTER, SPARK_SCATTER),
            radius: diameter / 2,
            glow: isBig ? randomRange(6, 8) : randomRange(2, 3), // 大きめの粒だけしっかり光らせる
            color,
            twinkleSpeed: (Math.PI * 2) / randomRange(0.2, 0.5), // 明滅の周期 0.2〜0.5秒（rad/s）
            twinklePhase: Math.random() * Math.PI * 2,
            vx: Math.cos(driftDir) * speed,
            vy: Math.sin(driftDir) * speed,
            born: now,
            life: randomRange(SPARK_LIFE_MIN, SPARK_LIFE_MAX)
        });
        // 上限を超えたら古いものから削除する
        while (sparks.length > MAX_SPARKS) sparks.shift();
    }

    // 残像の螺旋1つにつき、その周囲に1〜2個の光の粒を、その螺旋と同じ色で生成する
    function spawnSparks(x, y, now, color) {
        const count = SPARK_COUNT_MIN + Math.floor(Math.random() * (SPARK_COUNT_MAX - SPARK_COUNT_MIN + 1));
        for (let i = 0; i < count; i++) spawnSpark(x, y, now, color);
    }

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        pointerInside = true;

        lastMoveTime = performance.now();

        if (!hasMoved) {
            // 最初の移動では、メイン螺旋を目標位置（前端がカーソル先端に重なる位置）へ即座に配置する
            hasMoved = true;
            const reach = MAIN_LENGTH * MAIN_CENTER_RATIO;
            main.x = mouseX - Math.cos(main.angle) * reach;
            main.y = mouseY - Math.sin(main.angle) * reach;
            lastSpawnX = lastSparkX = main.x;
            lastSpawnY = lastSparkY = main.y;
            lastDirX = mouseX;
            lastDirY = mouseY;
            nextSpawnDistance = randomRange(SPAWN_DISTANCE_MIN, SPAWN_DISTANCE_MAX);
            return;
        }

        // 進行方向（メイン螺旋の向き）：ある程度動いたときだけ更新して向きのブレを防ぐ
        const ddx = mouseX - lastDirX;
        const ddy = mouseY - lastDirY;
        if (Math.hypot(ddx, ddy) >= 4) {
            main.targetAngle = Math.atan2(ddy, ddx);
            lastDirX = mouseX;
            lastDirY = mouseY;
        }
    });

    // メイン螺旋が一定距離動くたびに、その後端（尻尾側）から残像を生成する。
    // 「カーソル → メイン螺旋 → 残像の列」が一直線の軌跡になる
    function spawnFromMainTail(now) {
        let dx = main.x - lastSpawnX;
        let dy = main.y - lastSpawnY;
        let dist = Math.hypot(dx, dy);
        if (dist > 400) {
            // 大きなジャンプでは生成せず、基準点だけ更新する
            lastSpawnX = main.x;
            lastSpawnY = main.y;
            return;
        }
        const travelAngle = Math.atan2(dy, dx);
        // 進行方向と逆向きに、螺旋の長さの半分だけずらした位置が後端
        const tailX = -Math.cos(main.angle) * (MAIN_LENGTH / 2);
        const tailY = -Math.sin(main.angle) * (MAIN_LENGTH / 2);
        // 40〜60pxごとに1つ。間隔は毎回ランダムにして、まばらに並べる
        while (dist >= nextSpawnDistance) {
            lastSpawnX += (dx / dist) * nextSpawnDistance;
            lastSpawnY += (dy / dist) * nextSpawnDistance;
            spawnHelix(lastSpawnX + tailX, lastSpawnY + tailY, travelAngle, now);
            nextSpawnDistance = randomRange(SPAWN_DISTANCE_MIN, SPAWN_DISTANCE_MAX);
            dx = main.x - lastSpawnX;
            dy = main.y - lastSpawnY;
            dist = Math.hypot(dx, dy);
        }
    }

    // メイン螺旋の後端から、移動距離40pxごとに光の粒を1個ずつ、メイン螺旋と同じ色（青〜シアン）で生成する
    function spawnTailSparks(now) {
        let dx = main.x - lastSparkX;
        let dy = main.y - lastSparkY;
        let dist = Math.hypot(dx, dy);
        if (dist > 400) {
            lastSparkX = main.x;
            lastSparkY = main.y;
            return;
        }
        const tailX = -Math.cos(main.angle) * (MAIN_LENGTH / 2);
        const tailY = -Math.sin(main.angle) * (MAIN_LENGTH / 2);
        while (dist >= SPARK_TRAIL_DISTANCE) {
            lastSparkX += (dx / dist) * SPARK_TRAIL_DISTANCE;
            lastSparkY += (dy / dist) * SPARK_TRAIL_DISTANCE;
            spawnSpark(lastSparkX + tailX, lastSparkY + tailY, now,
                mixHex(MAIN_COLOR[0], MAIN_COLOR[1], Math.random()));
            dx = main.x - lastSparkX;
            dy = main.y - lastSparkY;
            dist = Math.hypot(dx, dy);
        }
    }

    document.documentElement.addEventListener('mouseleave', () => { pointerInside = false; });
    document.documentElement.addEventListener('mouseenter', () => { pointerInside = true; });

    function shortestAngleDiff(from, to) {
        let diff = (to - from) % (Math.PI * 2);
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;
        return diff;
    }

    let lastTime = performance.now();
    function frame(now) {
        const dt = Math.min(now - lastTime, 50);
        lastTime = now;
        const frames = dt / (1000 / 60); // 60fps換算のフレーム数
        ctx.clearRect(0, 0, viewW, viewH);

        // 光の粒：螺旋の背面に、ほぼその場で漂わせながら描く。
        // 形を保ったまま（円のまま）ease-inで1→0へ縮小し、shadowBlurも縮小率に比例させる
        for (let i = sparks.length - 1; i >= 0; i--) {
            if (now - sparks[i].born >= sparks[i].life) sparks.splice(i, 1);
        }
        for (const s of sparks) {
            const ageMs = now - s.born;
            const age = ageMs / s.life;
            s.x += s.vx * frames;
            s.y += s.vy * frames;
            const shrink = 1 - age * age;
            const radius = s.radius * shrink;
            if (radius > 0.02) {
                ctx.save();
                ctx.globalAlpha = sparkAlpha(s, ageMs);
                ctx.fillStyle = s.color;
                ctx.shadowColor = s.color;
                ctx.shadowBlur = s.glow * shrink * dnaCanvasDpr;
                ctx.beginPath();
                ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        // 残像の螺旋：更新しながら古い順に描画（新しいものが手前）
        for (let i = particles.length - 1; i >= 0; i--) {
            if (now - particles[i].born >= particles[i].life) particles.splice(i, 1);
        }
        for (const p of particles) {
            const ageMs = now - p.born;
            const age = ageMs / p.life;
            p.x += p.vx * frames;
            p.y += p.vy * frames;
            // 形を保ったまま、ease-in（最初はゆっくり・最後に速く）で1→0へ縮小する。
            // 線幅とshadowBlurも縮小率に比例させ、小さくなっても光の塊にならないようにする
            const shrink = 1 - age * age;
            const scale = p.baseScale * shrink;
            if (scale > 0.005) {
                drawHelix(ctx, p.x, p.y, p.angle, scale, p.color,
                    helixAlpha(ageMs, p.life, p.twinklePhase),
                    p.phase, 3 * shrink, (1 + p.baseScale) * shrink);
            }
        }

        // メイン螺旋：前端がカーソル先端に重なるようにlerpで追従する。
        // 止まっているときも、斜め（約-35°）の向きで前端をカーソル先端に重ねて待機する
        if (hasMoved) {
            if (now - lastMoveTime > IDLE_DELAY) main.targetAngle = IDLE_ANGLE;

            const follow = 1 - Math.pow(1 - MAIN_FOLLOW, frames);
            const angleFollow = 1 - Math.pow(1 - ANGLE_FOLLOW, frames);
            main.angle += shortestAngleDiff(main.angle, main.targetAngle) * angleFollow;

            // 中心 = マウス座標 − 進行方向ベクトル × 螺旋の長さ × 0.3
            const reach = MAIN_LENGTH * MAIN_CENTER_RATIO;
            main.x += (mouseX - Math.cos(main.angle) * reach - main.x) * follow;
            main.y += (mouseY - Math.sin(main.angle) * reach - main.y) * follow;
            main.alpha += ((pointerInside ? 1 : 0) - main.alpha) * Math.min(1, 0.15 * frames);

            // マウスではなく、追従しているメイン螺旋の移動距離で残像を生成する
            spawnFromMainTail(now);
            spawnTailSparks(now);

            if (main.alpha > 0.01) {
                // 位相をゆっくり進めて、螺旋がゆっくり回っているように見せる
                drawHelix(ctx, main.x, main.y, main.angle, MAIN_SCALE, MAIN_COLOR, main.alpha, now * 0.0015, 8, MAIN_LINE_WIDTH);
            }
        }

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
