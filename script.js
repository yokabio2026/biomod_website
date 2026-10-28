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

    // Teamページ：メンバーの写真をドラッグして動かせるようにする（該当ページだけ）
    initMemberDrag();
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

/* =====================================================================
   Teamページ：メンバー写真のドラッグ移動と「Reset layout」
   ===================================================================== */

function initMemberDrag() {
    const members = document.querySelectorAll('.member');
    const main = document.querySelector('main');
    if (members.length === 0 || !main) return;

    const resetBtn = document.getElementById('reset-layout-btn');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const LONG_PRESS_MS = 350;   // タッチ操作：この時間さわり続けたらドラッグ開始（スクロールとの区別）
    const MOUSE_THRESHOLD = 4;   // マウス：この距離(px)動いたらドラッグ開始
    const EDGE_SCROLL_ZONE = 80; // 画面の上下端からこの距離(px)以内で自動スクロール
    const EDGE_SCROLL_STEP = 12;

    const offsets = new Map();   // 各写真の「元の位置からのずれ」(px)
    members.forEach((el) => offsets.set(el, { x: 0, y: 0 }));
    let zTop = 10;
    let drag = null;
    let rafId = 0;

    /* ---- 写真どうしをつなぐDNA（SVG）。手描きの水彩風。
            絵の具を何層か重ねて、縁のにじみ・色の濃淡・筆のかすれを出す。
            写真を動かすと、のびたり縮んだりしてつながったままになる ---- */
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const DNA_PERIOD = 90;        // 元の並びのとき、らせん1回転ぶんの長さ(px)
    const DNA_AMPLITUDE = 28;     // らせんの振れ幅(px)
    const DNA_RUNGS_PER_TURN = 5; // 1回転あたりの横棒（塩基対）の数
    const DNA_RIBBON_WIDTH = 21;  // ストランド（リボン）の太さ(px)
    // 色：A=ピンク、B=青。base=薄い下塗り、mid=中間、deep=濃いところ、pale=絵の具が薄くなったところ
    const PALETTE = {
        A: { base: '#f393b1', mid: '#e46a90', deep: '#bd356a', pale: '#fcd3df' },
        B: { base: '#80b7ee', mid: '#4f93de', deep: '#2a60bb', pale: '#d2e6fb' }
    };

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'dna-links');
    svg.setAttribute('aria-hidden', 'true');
    // 塗りつぶし用（fill）・線用（stroke）のパスを作る。multiply は、重なったところが透けて混ざって見える水彩の効果
    function addPath(opts) {
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('fill', opts.fill || 'none');
        p.setAttribute('stroke', opts.stroke || 'none');
        if (opts.width) p.setAttribute('stroke-width', String(opts.width));
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('opacity', String(opts.opacity));
        if (opts.dash) p.setAttribute('stroke-dasharray', opts.dash);
        if (opts.multiply) p.style.mixBlendMode = 'multiply';
        if (opts.blur) p.style.filter = 'blur(' + opts.blur + 'px)';
        svg.appendChild(p);
        return p;
    }
    // 描く順番＝奥から手前。同じ層は、ピンクと青をまとめて描く
    const P = { A: {}, B: {} };
    const pathRungsA = addPath({ fill: PALETTE.A.mid, opacity: 0.8, multiply: true });
    const pathRungsB = addPath({ fill: PALETTE.B.mid, opacity: 0.8, multiply: true });
    [
        ['base', (c) => ({ fill: c.base, opacity: 0.62, multiply: true })],
        ['mid', (c) => ({ fill: c.mid, opacity: 0.5, multiply: true })],
        ['pale', (c) => ({ stroke: c.pale, width: 7, opacity: 0.5 })],
        ['deep', (c) => ({ stroke: c.deep, width: 10, opacity: 0.38, multiply: true, blur: 1.6 })],
        ['streak', (c) => ({ stroke: c.deep, width: 1.6, opacity: 0.32, multiply: true })],
        ['chalk', () => ({ stroke: '#ffffff', width: 1, opacity: 0.55, dash: '10 7 3 9 18 6' })]
    ].forEach((layer) => {
        ['A', 'B'].forEach((k) => { P[k][layer[0]] = addPath(layer[1](PALETTE[k])); });
    });
    main.insertBefore(svg, main.firstChild);

    // なめらかな乱数（手描きのゆらぎ用）。同じ入力には同じ値を返すので、動かしてもちらつかない
    function hash(i, seed) {
        const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
        return x - Math.floor(x);
    }
    function noise(x, seed) {
        const i = Math.floor(x);
        const f = x - i;
        const u = f * f * (3 - 2 * f);
        return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;   // 0〜1
    }

    let pairs = [];   // つなぐ写真の組（同じ行で、となりどうし）。l0 は元の並びでの中心間の距離

    function photoCenter(el) {
        const r = el.querySelector('img').getBoundingClientRect();
        const mr = main.getBoundingClientRect();
        return { x: r.left - mr.left + r.width / 2, y: r.top - mr.top + r.height / 2, r: r.width / 2 };
    }

    // 動かす前の位置から、「同じ行のとなりどうし」を調べる（画面の幅が変わるたびにやり直す）
    function computePairs() {
        measureHomes();
        pairs = [];
        const list = Array.from(members);
        for (let i = 0; i + 1 < list.length; i++) {
            const a = list[i];
            const b = list[i + 1];
            const oa = offsets.get(a);
            const ob = offsets.get(b);
            const ca = photoCenter(a);
            const cb = photoCenter(b);
            const ax = ca.x - oa.x, ay = ca.y - oa.y;
            const bx = cb.x - ob.x, by = cb.y - ob.y;
            if (Math.abs(ay - by) > 4 || bx <= ax) continue;   // 行が変わるところはつなげない
            pairs.push({ a: a, b: b, l0: Math.hypot(bx - ax, by - ay), seed: pairs.length + 1 });
        }
    }

    const fmt = (x, y) => x.toFixed(1) + ' ' + y.toFixed(1);

    function drawLinks() {
        const layers = ['base', 'mid', 'pale', 'deep', 'streak', 'chalk'];
        const d = { A: {}, B: {}, rungsA: '', rungsB: '' };
        ['A', 'B'].forEach((k) => layers.forEach((l) => { d[k][l] = ''; }));

        pairs.forEach((pair) => {
            const ca = photoCenter(pair.a);
            const cb = photoCenter(pair.b);
            const dx = cb.x - ca.x;
            const dy = cb.y - ca.y;
            const len = Math.hypot(dx, dy);
            if (len < 1) return;
            const ux = dx / len, uy = dy / len;
            const nx = -uy, ny = ux;
            const seed = pair.seed;
            const turns = Math.max(1.5, pair.l0 / DNA_PERIOD);   // 回転数は一定。のばすと間隔が広がる
            const amp = DNA_AMPLITUDE * Math.min(1.2, Math.max(0.55, pair.l0 / len)); // のばすと、すこし細くなる
            const s0 = ca.r * 0.4;            // 写真の下に隠れる部分も、すこし描く
            const s1 = len - cb.r * 0.4;
            if (s1 <= s0) return;
            const theta = (s) => (s / len) * turns * Math.PI * 2;
            const center = (s, sign) => {
                const w = sign * amp * Math.sin(theta(s));
                return [ca.x + ux * s + nx * w, ca.y + uy * s + ny * w];
            };
            // ゆらぎの座標：元の並びでの位置で決める（のばしても、模様が一緒にのびる）
            const noiseX = (s) => (s / len) * pair.l0;
            const steps = Math.min(300, Math.max(24, Math.ceil((s1 - s0) / 3)));

            [1, -1].forEach((sign) => {
                const key = sign === 1 ? 'A' : 'B';
                const sd = seed * 10 + (sign > 0 ? 1 : 2);
                // 筆の通り道：中心の点と、太さ（手前ほど太く、さらに手描きのむら）
                const mid = [];
                for (let i = 0; i <= steps; i++) {
                    const s = s0 + (s1 - s0) * (i / steps);
                    const c = center(s, sign);
                    const c2 = center(s + 1.5, sign);
                    let tx = c2[0] - c[0], ty = c2[1] - c[1];
                    const tl = Math.hypot(tx, ty) || 1;
                    tx /= tl; ty /= tl;
                    const x = noiseX(s);
                    const wob = 1 + 0.45 * (noise(x / 34, sd + 3) - 0.5);
                    const w = DNA_RIBBON_WIDTH * (0.78 + 0.3 * Math.abs(Math.cos(theta(s)))) * wob;
                    mid.push({ c: c, px: -ty, py: tx, w: w, x: x });
                }
                // 縁のゆらぎをつけた帯（層ごとに、太さとゆらぎの種を変えて、にじみを出す）
                const band = (scale, off, ampE) => {
                    const left = [];
                    const right = [];
                    mid.forEach((m) => {
                        const el = m.w * scale / 2 * (1 + ampE * (noise(m.x / 11, sd + 7 + off) - 0.5) + ampE * 0.45 * (noise(m.x / 3.2, sd + 9 + off) - 0.5));
                        const er = m.w * scale / 2 * (1 + ampE * (noise(m.x / 11, sd + 13 + off) - 0.5) + ampE * 0.45 * (noise(m.x / 3.2, sd + 15 + off) - 0.5));
                        left.push([m.c[0] + m.px * el, m.c[1] + m.py * el]);
                        right.push([m.c[0] - m.px * er, m.c[1] - m.py * er]);
                    });
                    let poly = 'M' + fmt(left[0][0], left[0][1]);
                    for (let i = 1; i < left.length; i++) poly += ' L' + fmt(left[i][0], left[i][1]);
                    for (let i = right.length - 1; i >= 0; i--) poly += ' L' + fmt(right[i][0], right[i][1]);
                    return poly + ' Z';
                };
                d[key].base += band(1.0, 0, 0.55);
                d[key].mid += band(0.8, 100, 0.7);

                // 帯の中心からずらした位置の点（lateral は太さに対する割合）
                const at = (m, lateral) => [m.c[0] + m.px * m.w * lateral, m.c[1] + m.py * m.w * lateral];

                // 濃いところ／薄いところ：場所によってむらがある
                let inDeep = false;
                let inPale = false;
                mid.forEach((m) => {
                    const dk = noise(m.x / 26, sd + 21);
                    const pl = noise(m.x / 20, sd + 31);
                    const shift = (noise(m.x / 30, sd + 41) - 0.5) * 0.45;
                    if (dk > 0.5) {
                        const p = at(m, shift);
                        d[key].deep += (inDeep ? ' L' : ' M') + fmt(p[0], p[1]);
                        inDeep = true;
                    } else {
                        inDeep = false;
                    }
                    if (pl < 0.3) {
                        const p = at(m, -shift);
                        d[key].pale += (inPale ? ' L' : ' M') + fmt(p[0], p[1]);
                        inPale = true;
                    } else {
                        inPale = false;
                    }
                });
                // 筆のかすれ：リボンに沿った細い線を、とぎれとぎれに引く
                [-0.3, 0.02, 0.28].forEach((off, n) => {
                    let inStreak = false;
                    mid.forEach((m) => {
                        if (noise(m.x / 16, sd + 51 + n * 5) > 0.45) {
                            const p = at(m, off + (noise(m.x / 40, sd + 61 + n) - 0.5) * 0.14);
                            d[key].streak += (inStreak ? ' L' : ' M') + fmt(p[0], p[1]);
                            inStreak = true;
                        } else {
                            inStreak = false;
                        }
                    });
                });
                // 縁の内側の、白いかすれた細い破線（両側）
                [-0.34, 0.34].forEach((off) => {
                    mid.forEach((m, i) => {
                        const p = at(m, off);
                        d[key].chalk += (i ? ' L' : ' M') + fmt(p[0], p[1]);
                    });
                });
            });

            // 横棒：片側はピンク、反対側は青。まん中で重なって混ざる。すこし斜めで、太さもばらばら
            const rungStep = Math.PI * 2 / DNA_RUNGS_PER_TURN;
            const th0 = theta(s0);
            const th1 = theta(s1);
            for (let th = Math.ceil(th0 / rungStep) * rungStep + rungStep / 2; th < th1; th += rungStep) {
                if (Math.abs(Math.sin(th)) < 0.3) continue;   // 交差のところは、リボンのうしろなので描かない
                const k = Math.round(th / rungStep);
                const s = (th / (turns * Math.PI * 2)) * len + (hash(k, seed) - 0.5) * 6;
                const p = center(s, 1);
                const q = center(s, -1);
                const rx = q[0] - p[0], ry = q[1] - p[1];
                const rl = Math.hypot(rx, ry) || 1;
                const rnx = -ry / rl, rny = rx / rl;
                const half = (6 + 4 * hash(k + 50, seed)) / 2;   // 横棒の太さの半分
                const j = (n) => (hash(k * 7 + n, seed) - 0.5) * 3;
                const mk = (a, b, n0) => {
                    // a から b へ向かう細長い四角形。角を少しずつずらして、手描きっぽくする
                    const c1 = [a[0] + rnx * (half + j(n0)), a[1] + rny * (half + j(n0 + 1))];
                    const c2 = [b[0] + rnx * (half + j(n0 + 2)), b[1] + rny * (half + j(n0 + 3))];
                    const c3 = [b[0] - rnx * (half + j(n0 + 4)), b[1] - rny * (half + j(n0 + 5))];
                    const c4 = [a[0] - rnx * (half + j(n0 + 6)), a[1] - rny * (half + j(n0 + 7))];
                    return 'M' + fmt(c1[0], c1[1]) + ' L' + fmt(c2[0], c2[1]) + ' L' + fmt(c3[0], c3[1]) + ' L' + fmt(c4[0], c4[1]) + ' Z';
                };
                const m1 = [p[0] + rx * 0.58, p[1] + ry * 0.58];
                const m2 = [p[0] + rx * 0.42, p[1] + ry * 0.42];
                d.rungsA += mk(p, m1, 0);
                d.rungsB += mk(q, m2, 10);
            }
        });
        pathRungsA.setAttribute('d', d.rungsA);
        pathRungsB.setAttribute('d', d.rungsB);
        ['A', 'B'].forEach((k) => layers.forEach((l) => P[k][l].setAttribute('d', d[k][l])));
    }

    // 元の位置に戻るアニメーションの間、毎フレームDNAを描き直す
    function animateLinks(ms) {
        const end = performance.now() + ms;
        (function tick() {
            drawLinks();
            if (performance.now() < end) requestAnimationFrame(tick);
        })();
    }

    /* ---- ぶつかったら、スライムのようにぷるんと押し出す（かんたんな物理シミュレーション） ----
            つかんでいる写真が、ほかの写真に当たると、相手は弾かれて少し滑り、ぷるぷる揺れて止まる */
    const GAP = 8;                      // 写真どうしのすきま(px)
    const PUSH_KICK = reduceMotion ? 0 : 16;      // めり込んだ量に応じて、弾き出す強さ
    const RESTITUTION = reduceMotion ? 0 : 0.8;   // 弾み具合
    const FRICTION = 5;                 // 弾かれたあとの減速（大きいほど早く止まる）
    const MAX_SPEED = 1500;             // 弾かれる速さの上限(px/秒)
    const JELLY_K = 260;                // ぷるぷるのバネの強さ
    const JELLY_C = 12;                 // ぷるぷるの減衰（小さいほど長く揺れる）
    const body = new Map();             // 写真ごとの、速さ(vx,vy)・ひしゃげ具合(def)・向き(ang)
    members.forEach((el) => body.set(el, { vx: 0, vy: 0, def: 0, defv: 0, ang: 0, px: 0, py: 0, mass: 1 }));
    const homes = new Map();            // 写真ごとの、元の位置（中心）
    const radii = new Map();            // 写真ごとの、円の半径
    let boundsCache = null;
    let simId = 0;
    let lastT = 0;

    function measureHomes() {
        members.forEach((el) => {
            const c = photoCenter(el);
            const o = offsets.get(el);
            homes.set(el, { x: c.x - o.x, y: c.y - o.y });
            radii.set(el, el.querySelector('img').offsetWidth / 2);
        });
        boundsCache = null;
    }

    // 写真が動かせる範囲（<main>の中）。offsets（元の位置からのずれ）で表す
    function memberBounds(el) {
        const o = offsets.get(el);
        const r = el.getBoundingClientRect();
        const mr = main.getBoundingClientRect();
        const baseLeft = r.left + window.scrollX - o.x;
        const baseTop = r.top + window.scrollY - o.y;
        return {
            minX: -baseLeft,
            maxX: document.documentElement.clientWidth - r.width - baseLeft,
            minY: mr.top + window.scrollY - baseTop,
            maxY: mr.bottom + window.scrollY - r.height - baseTop
        };
    }

    function getBounds() {
        if (!boundsCache) {
            boundsCache = new Map();
            members.forEach((el) => boundsCache.set(el, memberBounds(el)));
        }
        return boundsCache;
    }

    function isDragged(el) {
        return !!(drag && drag.active && drag.el === el);
    }

    function hit(b, nx, ny, strength) {
        // ぶつかった向きにつぶれて、そのあと、ぷるぷる揺れ戻る
        b.defv -= strength * 10;
        b.ang = Math.atan2(ny, nx);
    }

    function step(dt) {
        const list = Array.from(members);
        const bounds = getBounds();

        // 1) 移動（つかんでいる写真は、動かした速さを、ぶつけるときの勢いとして使う）
        list.forEach((el) => {
            const b = body.get(el);
            const o = offsets.get(el);
            if (isDragged(el)) {
                const nvx = (o.x - b.px) / dt;
                const nvy = (o.y - b.py) / dt;
                b.vx += (nvx - b.vx) * 0.35;
                b.vy += (nvy - b.vy) * 0.35;
            } else {
                o.x += b.vx * dt;
                o.y += b.vy * dt;
                const f = Math.exp(-FRICTION * dt);
                b.vx *= f;
                b.vy *= f;
            }
            b.px = o.x;
            b.py = o.y;
        });

        // 2) ぶつかり：重ならないように押し出し、弾き、ぷるんとさせる
        for (let pass = 0; pass < 3; pass++) {
            for (let i = 0; i < list.length; i++) {
                for (let j = i + 1; j < list.length; j++) {
                    const A = list[i];
                    const B = list[j];
                    const ka = isDragged(A);
                    const kb = isDragged(B);
                    if (ka && kb) continue;
                    const oa = offsets.get(A);
                    const ob = offsets.get(B);
                    const ha = homes.get(A);
                    const hb = homes.get(B);
                    let dx = (hb.x + ob.x) - (ha.x + oa.x);
                    let dy = (hb.y + ob.y) - (ha.y + oa.y);
                    let d = Math.hypot(dx, dy);
                    const min = radii.get(A) + radii.get(B) + GAP;
                    if (d >= min) continue;
                    if (d < 0.01) { dx = 1; dy = 0; d = 1; }
                    const nx = dx / d;
                    const ny = dy / d;
                    const pen = min - d;
                    const ba = body.get(A);
                    const bb = body.get(B);
                    const wa = ka ? 0 : 1 / ba.mass;   // 重いほど、動かされにくい
                    const wb = kb ? 0 : 1 / bb.mass;
                    const sum = wa + wb;
                    // 位置：めり込んだぶんを押し戻す
                    const corr = pen * 0.8;
                    oa.x -= nx * corr * wa / sum;
                    oa.y -= ny * corr * wa / sum;
                    ob.x += nx * corr * wb / sum;
                    ob.y += ny * corr * wb / sum;
                    // 速さ：近づいていたら跳ね返す
                    const rel = (bb.vx - ba.vx) * nx + (bb.vy - ba.vy) * ny;
                    if (rel < 0) {
                        const imp = -(1 + RESTITUTION) * rel / sum;
                        ba.vx -= nx * imp * wa;
                        ba.vy -= ny * imp * wa;
                        bb.vx += nx * imp * wb;
                        bb.vy += ny * imp * wb;
                    }
                    // めり込んだ量に応じて、さらに弾き出す
                    const kick = pen * PUSH_KICK / sum;
                    ba.vx -= nx * kick * wa;
                    ba.vy -= ny * kick * wa;
                    bb.vx += nx * kick * wb;
                    bb.vy += ny * kick * wb;
                    // ぷるん（両方がつぶれる）
                    if (!reduceMotion) {
                        const strength = Math.min(1, pen / 40 + Math.abs(rel) / 900);
                        hit(ba, nx, ny, strength);
                        hit(bb, -nx, -ny, strength);
                    }
                }
            }
        }

        // 3) 壁：ページの外には出さない。当たったら少し跳ね返る
        list.forEach((el) => {
            if (isDragged(el)) return;
            const b = body.get(el);
            const o = offsets.get(el);
            const bd = bounds.get(el);
            const nx0 = clamp(o.x, bd.minX, bd.maxX);
            const ny0 = clamp(o.y, bd.minY, bd.maxY);
            if (nx0 !== o.x) { b.vx = -b.vx * 0.5; if (!reduceMotion) hit(b, nx0 < o.x ? 1 : -1, 0, 0.3); }
            if (ny0 !== o.y) { b.vy = -b.vy * 0.5; if (!reduceMotion) hit(b, 0, ny0 < o.y ? 1 : -1, 0.3); }
            o.x = nx0;
            o.y = ny0;
        });

        // 4) 速さの上限と、ぷるぷる（バネ）
        list.forEach((el) => {
            const b = body.get(el);
            const sp = Math.hypot(b.vx, b.vy);
            if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vy *= MAX_SPEED / sp; }
            b.mass = 1 + (b.mass - 1) * Math.exp(-2 * dt);   // 離した直後の重さは、少しずつ元に戻る
            b.defv += (-JELLY_K * b.def - JELLY_C * b.defv) * dt;
            b.def = clamp(b.def + b.defv * dt, -0.4, 0.4);
            const img = el.querySelector('img');
            if (Math.abs(b.def) > 0.003 || Math.abs(b.defv) > 0.05) {
                const s = 1 + b.def;
                const deg = (b.ang * 180 / Math.PI).toFixed(1);
                img.style.transform = 'rotate(' + deg + 'deg) scale(' + s.toFixed(3) + ', ' + (1 / s).toFixed(3) + ') rotate(-' + deg + 'deg)';
            } else {
                b.def = 0;
                b.defv = 0;
                img.style.transform = '';
            }
            if (!isDragged(el)) applyTransform(el, false);
            else applyTransform(el, true);
        });
    }

    function simActive() {
        if (drag && drag.active) return true;
        let active = false;
        members.forEach((el) => {
            const b = body.get(el);
            if (Math.hypot(b.vx, b.vy) > 8 || Math.abs(b.def) > 0.003 || Math.abs(b.defv) > 0.05 || b.mass > 1.05) active = true;
        });
        return active;
    }

    function simLoop(now) {
        const dt = Math.min(0.033, (now - lastT) / 1000) || 0.016;
        lastT = now;
        step(dt);
        drawLinks();
        simId = simActive() ? requestAnimationFrame(simLoop) : 0;
    }

    function wake() {
        if (simId) return;
        lastT = performance.now();
        simId = requestAnimationFrame(simLoop);
    }

    function stopSim() {
        if (simId) cancelAnimationFrame(simId);
        simId = 0;
        members.forEach((el) => {
            const b = body.get(el);
            b.vx = 0; b.vy = 0; b.def = 0; b.defv = 0; b.mass = 1;
            el.querySelector('img').style.transform = '';
        });
        boundsCache = null;
    }

    function applyTransform(el, lifted) {
        const o = offsets.get(el);
        if (!o.x && !o.y && !lifted) {
            el.style.transform = '';
            return;
        }
        el.style.transform = 'translate(' + o.x + 'px, ' + o.y + 'px)' + (lifted ? ' scale(1.05)' : '');
    }

    function clamp(v, min, max) {
        return Math.min(Math.max(v, min), max);
    }

    // ドラッグ中の位置を更新する（画面が自動スクロールしても、ページ上の位置で計算する）
    function update() {
        const dx = (drag.cx + window.scrollX) - (drag.sx + drag.scx);
        const dy = (drag.cy + window.scrollY) - (drag.sy + drag.scy);
        const o = offsets.get(drag.el);
        o.x = clamp(drag.ox + dx, drag.minX, drag.maxX);
        o.y = clamp(drag.oy + dy, drag.minY, drag.maxY);
        applyTransform(drag.el, true);
        drawLinks();
        wake();
    }

    function autoScrollLoop() {
        if (!drag || !drag.active) return;
        if (drag.cy < EDGE_SCROLL_ZONE) {
            window.scrollBy(0, -EDGE_SCROLL_STEP);
        } else if (drag.cy > window.innerHeight - EDGE_SCROLL_ZONE) {
            window.scrollBy(0, EDGE_SCROLL_STEP);
        }
        update();
        rafId = requestAnimationFrame(autoScrollLoop);
    }

    function begin() {
        const el = drag.el;
        const o = offsets.get(el);
        const r = el.getBoundingClientRect();
        const mr = main.getBoundingClientRect();
        // ページ上での「元の位置」から、動かせる範囲（<main>の中）を求める
        const baseLeft = r.left + window.scrollX - o.x;
        const baseTop = r.top + window.scrollY - o.y;
        drag.minX = -baseLeft;
        drag.maxX = document.documentElement.clientWidth - r.width - baseLeft;
        drag.minY = mr.top + window.scrollY - baseTop;
        drag.maxY = mr.bottom + window.scrollY - r.height - baseTop;
        drag.active = true;
        const bd = body.get(el);
        bd.vx = 0; bd.vy = 0; bd.px = o.x; bd.py = o.y;
        boundsCache = null;
        el.classList.remove('is-returning');
        el.classList.add('is-dragging');
        el.style.zIndex = String(++zTop);
        try { el.setPointerCapture(drag.id); } catch (e) { /* 対応していなければ何もしない */ }
        rafId = requestAnimationFrame(autoScrollLoop);
    }

    function finish() {
        if (!drag) return;
        clearTimeout(drag.timer);
        cancelAnimationFrame(rafId);
        if (drag.active) {
            const rel = drag;
            drag.el.classList.remove('is-dragging');
            applyTransform(drag.el, false);
            drawLinks();
            const bd = body.get(rel.el);
            bd.vx *= 0.6; bd.vy *= 0.6;
            bd.mass = 6;
            drag = null;
            wake();
            return;
        }
        drag = null;
    }

    members.forEach((el) => {
        el.addEventListener('pointerdown', (e) => {
            if (drag) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            const o = offsets.get(el);
            drag = {
                el: el, id: e.pointerId, type: e.pointerType,
                sx: e.clientX, sy: e.clientY, scx: window.scrollX, scy: window.scrollY,
                cx: e.clientX, cy: e.clientY, ox: o.x, oy: o.y,
                active: false, timer: 0
            };
            if (e.pointerType === 'touch') {
                drag.timer = setTimeout(begin, LONG_PRESS_MS);
            }
        });
        // 長押しメニューや、画像のネイティブなドラッグを出さない
        el.addEventListener('contextmenu', (e) => { if (drag) e.preventDefault(); });
        el.addEventListener('dragstart', (e) => e.preventDefault());
    });

    window.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        drag.cx = e.clientX;
        drag.cy = e.clientY;
        if (!drag.active) {
            const moved = Math.hypot(drag.cx - drag.sx, drag.cy - drag.sy);
            if (drag.type === 'touch') {
                if (moved > 8) finish();   // 長押しの前に動いた＝スクロールのつもり
            } else if (moved > MOUSE_THRESHOLD) {
                begin();
            }
            return;
        }
        e.preventDefault();
        update();
    });
    window.addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) finish(); });
    window.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) finish(); });

    // ドラッグ中は、タッチ操作でページがスクロールしないようにする
    window.addEventListener('touchmove', (e) => {
        if (drag && drag.active) e.preventDefault();
    }, { passive: false });

    // 元の並びに戻す
    function resetLayout() {
        finish();
        stopSim();
        members.forEach((el) => {
            const o = offsets.get(el);
            if (!o.x && !o.y) return;
            o.x = 0;
            o.y = 0;
            if (reduceMotion) {
                el.style.transform = '';
                el.style.zIndex = '';
                drawLinks();
                return;
            }
            el.classList.add('is-returning');
            el.style.transform = '';
            setTimeout(() => {
                el.classList.remove('is-returning');
                el.style.zIndex = '';
            }, 800);
        });
        zTop = 10;
        if (!reduceMotion) animateLinks(900);
    }

    if (resetBtn) resetBtn.addEventListener('click', resetLayout);

    // 画面の幅が変わると並びも変わるので、そのときは位置をリセットする
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
        if (window.innerWidth === lastWidth) return;
        lastWidth = window.innerWidth;
        finish();
        stopSim();
        members.forEach((el) => {
            const o = offsets.get(el);
            o.x = 0;
            o.y = 0;
            el.style.transform = '';
            el.style.zIndex = '';
        });
        zTop = 10;
        computePairs();
        drawLinks();
    });

    // 最初の描画（画像や文字が読み込まれて、位置が決まったあとにもう一度描く）
    computePairs();
    drawLinks();
    window.addEventListener('load', () => {
        computePairs();
        drawLinks();
    });
}
