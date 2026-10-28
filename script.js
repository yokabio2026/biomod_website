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

    /* ---- 調整できる数値 ----
       ブラウザのコンソールで、たとえば  teamPhysics.springK = 12  のように書き換えても、すぐ反映される */
    const T = {
        springK: 8,            // DNAのバネ定数：大きいほど強く引き寄せる
        springK2: 0.012,       // のびるほど、引く力が少しずつ強くなる度合い
        springC: 1.0,          // DNAの減衰係数：大きいほど、揺れが早くおさまる
        springDeadzone: 0.5,   // このくらいののびには力をかけない（初期配置で勝手に動かないように）
        springBrake: 10,       // 自然長より近づいたとき、近づく勢いだけを弱めるブレーキ（押し返しはしない）
        maxPull: 2400,         // 引く力（加速度）の上限
        gap: 8,                // 写真どうしのすきま(px)
        restitution: reduceMotion ? 0 : 0.35,   // 弾み具合（中くらい）
        maxSubstep: 1 / 180,   // 【安定化】1回の計算の時間刻みの上限(秒)。速く動くほど、細かく分けて計算する（最大6回）。高速でも、すり抜けない
        solverIterations: 16,  // 【安定化】めり込みを解く反復の回数（写真どうしの判定と、壁の判定を、交互に繰り返す）
        dragStepFrac: 0.3,     // 【ドラッグ】つかんでいる写真が、1回の計算で進める距離の上限（半径に対する割合）。小さいほど、相手を飛ばしすぎず、すり抜けにくい
        dragInvMass: 0.06,     // 【ドラッグ】つかんでいる写真の「動かされやすさ」。小さいほど、相手を押しのけ、自分は動かされにくい
        bounceMinSpeed: 20,    // これより遅い接触は、弾まずに、そっと押すだけ(px/秒)
        collisionBoost: 1.45,  // 【衝突の強さ】動いている写真どうしが、ぶつかった瞬間の勢いの伝わり方の倍率（1で、ブーストなし）。1回の衝突につき、1度だけ適用
        collisionBoostRamp: 160, // 【衝突の強さ】ぶつかった速さが、この値(px/秒)ぶん遅いほうから速くなるにつれて、ブーストが0→最大に増える（弱い衝突は、控えめのまま）
        hoverScale: 0.04,      // 【ホバー】カーソルを重ねたときの、拡大（4%）。ほかの写真や壁に近いときは、重ならないよう、自動で小さくする
        hoverMove: 12,         // 【ホバー】カーソルの方向へ追従する、最大の距離(px)。ほかの写真や壁に近い向きは、重ならないよう、自動で制限する
        hoverK: 170,           // 【ホバー】追従のバネの強さ（大きいほど、すばやく追いつく）
        hoverC: 12,            // 【ホバー】追従の減衰（小さいほど、離れたときに、ぷるぷるが長く続く）
        dnaHoverMax: 10,       // 【DNAのホバー】カーソルを重ねたとき、DNAがカーソルの方向へ曲がる量(px)。見た目だけ
        dnaHoverK: 260,        // 【DNAのホバー】追従のバネの強さ
        dnaHoverC: 14,         // 【DNAのホバー】追従の減衰（約0.4秒で、ぷるんと元に戻る）
        dnaGradA: '#A48BEA',       // 【DNAのホバー】重ねている間の、グラデーションの色1（紫）。DNAの長さ方向に、紫 → 青 → ピンク → 紫… と、なめらかにつながる
        dnaGradB: '#69AFF2',       // 【DNAのホバー】色2（青）
        dnaGradC: '#EE85B7',       // 【DNAのホバー】色3（ピンク）
        dnaGradVividA: '#8A5CF0',  // 【DNAの引っ張り】引っ張るほど、各色が、この色（少し鮮やかな紫）へ近づく
        dnaGradVividB: '#3E9BF0',  // 【DNAの引っ張り】少し鮮やかな青
        dnaGradVividC: '#EB5FA3',  // 【DNAの引っ張り】少し鮮やかなピンク
        dnaGradPeriod: 4,          // 【DNAのホバー】グラデーションが、1周して元の位置に戻る時間(秒)。色は、流れ続ける
        dnaThick: 1.85,            // 【DNAのホバー】触れた付近の、線の太さの倍率（約1.7〜2倍）。2本の主鎖・横棒とも。ふだんの太さは、変わらない
        dnaThickRadius: 150,       // 【DNAのホバー】太さが、ゆるやかにふだんへ戻るまでの、長さ方向の広がり(px)。変わる速さは、dnaHoverIn / dnaHoverOut と同じ
        dnaBulge: 0,               // 【DNAのホバー】触れた付近の、二重らせんの「幅」の増え方（0 = 広げない。0.2 で約1.2倍）。線の太さとは、別
        dnaBulgeRadius: 110,       // 【DNAのホバー】らせんの幅が広がる場合の、長さ方向の広がり(px)
        dnaBulgeFollow: 0.08,      // 【DNAのホバー】カーソルを動かしたとき、膨らみが、少し遅れて追いかける時間(秒)。大きいほど、遅れる
        dnaBulgeK: 260,            // 【DNAのホバー】膨らみの「ぷにっ」のバネの強さ
        dnaBulgeC: 14,             // 【DNAのホバー】膨らみの減衰（小さいほど、ぷるぷるが長い）
        dnaHoverOpacity: 0.95,     // 【DNAのホバー】重ねている間の、手前側の線の不透明度（ふだんは 0.6）。奥側・横棒も、同じ割合で上げる
        dnaHoverIn: 0.2,           // 【DNAのホバー】ふだんの色から、ホバーの色へ変わるまでの時間(秒)
        dnaHoverOut: 0.3,          // 【DNAのホバー】離したあと、ふだんの色へ戻るまでの時間(秒)
        idleScale: 0.035,      // 【待機】写真の、待機中の伸び縮みの大きさ（約3.5%）
        idlePos: 3,            // 【待機】写真の見た目の位置の揺れ(px)。ほかの写真・壁に近いときは、自動で小さくする
        idlePulseMin: 6,       // 【待機】ときどき、少し大きく「ぷるん」と動く間隔の下限(秒)
        idlePulseMax: 9,       // 【待機】その間隔の上限(秒)。写真ごとに、ずらす
        idlePulseKick: 1.1,    // 【待機】「ぷるん」の大きさ（約5%）
        idlePulseK: 240,       // 【待機】「ぷるん」のバネの強さ
        idlePulseC: 7,         // 【待機】「ぷるん」の減衰（約1秒で収まる）
        idleDnaAmp: 6.5,       // 【待機】DNAの中央付近が、待機中に揺れる大きさ(px)
        idleQuietMs: 300,      // 【待機】衝突・発射・ドラッグなどが収まってから、待機に入るまでの時間(ミリ秒)
        idleTauIn: 0.8,        // 【待機】待機に入るときの、なめらかさ(秒)。大きいほど、ゆっくり入る
        idleTauOut: 0.25,      // 【待機】操作が始まったときに、待機を止めるなめらかさ(秒)
        idleDnaFps: 30,        // 【待機】DNAを描き直す回数（毎秒）。軽くするため、写真より少なくする
        freeTime: 0.5,         // 【衝突後】ぶつかったあと、DNAに引き戻されにくくなる時間(秒)
        springRelief: 0.8,     // 【衝突後】ぶつかった直後に、DNAの引き寄せを弱める割合（0〜1）
        frictionBase: 1.3,     // 【減衰】動いている写真の減速（ゆっくり動くとき）。小さいほど、長く滑る（以前は1.6）
        frictionQuad: 0.006,   // 【減衰】速く動くほど、強く減速する度合い（小さいほど、遠くまで滑る。以前は0.009）
        maxSpeed: 4400,        // 写真の速さの上限(px/秒)。これを超えると、物理が不安定になるので、必ず頭打ちにする
        wallRestitution: 0.85, // 【壁】壁での弾み具合。1に近いほど、勢いを保って跳ね返る（以前は0.4）。1以上にはしない（加速してしまう）
        jellyK: 300,           // ぷるぷるのバネの強さ
        jellyC: 13,            // ぷるぷるの減衰（約0.4秒でほぼ止まる）
        jellyMax: 0.12,        // つぶれる量の上限（12%）
        squashMax: 0.09,       // 【押しつけ】壁や写真に押しつけられている間の、つぶれ量の上限（9%）
        squashRange: 120,      // 【押しつけ】この距離(px)ぶん押しつけると、つぶれ量が上限になる（小さいほど、少し押しただけで大きくつぶれる）
        squashK: 260,          // 【押しつけ】つぶれ・復元のバネの強さ（大きいほど、速く戻る）
        squashC: 11,           // 【押しつけ】つぶれ・復元の減衰（小さいほど、ぷるぷるが長く続く。今は2〜3回揺れる）
        pairSquash: 0.5,       // 【押しつけ】写真どうしを押しつけたときの、つぶれ方の割合（壁を1としたとき）
        jellyHit: 1.6,         // 最大の勢いでぶつかったときの、つぶれの強さ（弱い衝突は、この値に比例）
        jellyStrongBoost: 0.95,// 強い衝突ほど、さらに大きくつぶす度合い（0で、衝突の強さに比例するだけ。弱い衝突には、ほとんど効かない）
        pluckMax: 330,         // DNAをつまんで引っ張れる最大の距離(px)。（以前は220。約1.5倍）
        pluckK: 10,            // 引っ張ってたまる弾性エネルギー ½·k·（のび）² の、バネ定数
        pluckGain: 1.2,        // たまったエネルギーを、写真の勢いに変える倍率（反発倍率）
        pluckAlong: 0.45,      // DNAに沿った向きに引いても、距離の何割を「のび」として扱うか（のびなしでも弾けるように）
        pluckGrabMin: 0.12,    // 【DNAをつかむ】つかめる位置の端の余白（0〜1）。端に近すぎると、接続点が外れるので、この割合だけ内側に制限する
        pluckBias: 0.25,       // 【力の配分】いちばん端をつかんだときの、左右の力の偏り（±25%）。0で、左右同じ。左右の合計は、いつも一定
        hitPad: 26,            // 【DNAをつかむ】DNAの操作領域（透明）の余白(px)。らせんの幅＋この値が、操作領域の太さ
        pluckInward: 0.25,     // 弾くとき、両端の写真に「おたがいへ向かう成分」をどのくらい混ぜるか
        pluckMaxSpeed: 5000,   // 【発射の速さ】DNAを弾いたときの、写真の速さの上限(px/秒)。なめらかに頭打ちになる
        pluckLaunchScale: 2.3, // 【発射の速さ】最大まで引いたときの、発射速度の倍率。軽い引っ張りには、ほとんど効かない（強く引くほど、急に増える非線形のカーブ）
        pluckLaunchExp: 2.6,   // 【発射の速さ】上の倍率が、引いた距離の割合に対して、どれだけ急に効くか（大きいほど、強く引いたときだけ効く）
        pluckBoost: 0.45,      // 【発射の速さ】強く引くほど、さらに速くする度合い（0で、引いた距離に比例するだけ）
        pluckFullFrac: 0.7,    // 最大距離の何割まで引いたら「最大パワー」とみなすか（色の濃さ・震えの基準）
        pluckShakeStart: 0.9,  // パワーがこの割合を超えたら、DNAがごく小さく震えはじめる
        pluckShakeAmp: 1.4,    // 震えの大きさ(px)
        pluckSnapK: 800,       // 離したあと、DNAが元に戻るバネの強さ（大きいほど速く戻る）
        pluckSnapC: 11,        // 離したあと、DNAの揺れの減衰（小さいほど、ぷるぷるが長く続く）
        glideTime: 0.8,        // 【減衰】弾かれた直後に、滑りやすくなる時間(秒)
        glideAmount: 0.8,      // 【減衰】弾かれた直後に、減速が弱まる割合
        springRamp: 1.0        // 【DNAの引き戻し抑制】弾いたあと、DNAの引き寄せが元の強さに戻るまでの時間(秒)
    };
    window.teamPhysics = T;

    const offsets = new Map();   // 各写真の「元の位置からのずれ」(px)
    members.forEach((el) => offsets.set(el, { x: 0, y: 0 }));
    // ホバーの見た目の状態（x, y: 見た目だけのずれ(px)、s: 拡大ぶん、tx/ty: 追従の目標、inside: カーソルが重なっているか）
    const hover = new Map();
    members.forEach((el) => hover.set(el, { x: 0, y: 0, s: 0, vx: 0, vy: 0, vs: 0, tx: 0, ty: 0, ts: 0, inside: false }));
    // 写真が属するセクション（Team Member / Mentor / Faculty Mentor）。DNAでつなぐ組を決めるのに使う。
    // 動ける範囲は、セクションごとではなく、3つのセクション全体をまとめた共通の領域（areaRect）
    const groupOf = new Map();
    members.forEach((el) => groupOf.set(el, el.closest('.content-section') || main));
    const body = new Map();      // 写真ごとの、速さ・ひしゃげ具合・重さ
    members.forEach((el) => body.set(el, { vx: 0, vy: 0, def: 0, defv: 0, ang: 0, px: 0, py: 0, mass: 1, glide: 0, free: 0, sx: 0, sy: 0,
        cx: 0, cy: 0, cvx: 0, cvy: 0, pmx: 0, pmy: 0 }));   // cx,cy: 押しつけによるつぶれ量（横・縦）／ pmx,pmy: そのフレームの押しつけの強さ(px)
    Array.from(members).forEach((el, i) => {
        const b = body.get(el);
        b.idleW = 0;                                  // 待機の重み（0〜1）。操作中は0へ、なめらかに下がる
        b.idlePhase = (i * 2.399) % (Math.PI * 2);     // 位相：写真ごとに、ずらす
        b.idlePeriod = 2 + ((i * 37) % 100) / 100;      // 周期：2〜3秒。写真ごとに、ずらす
        b.pu = 0;                                       // 「ぷるん」の大きさと速さ（バネ）
        b.puv = 0;
        b.nextPulse = performance.now() + (2 + ((i * 29) % 100) / 100 * 7) * 1000;   // 最初の「ぷるん」：写真ごとに、ずらす
        b.idleV = null;                                 // いまの待機の変形 [横, 縦, 横ずれ, 縦ずれ]
        b.idleTx = 0;
        b.idleTy = 0;
    });
    const homes = new Map();     // 写真ごとの、元の位置（中心）
    const radii = new Map();     // 写真ごとの、円の半径
    let zTop = 10;
    let drag = null;
    let rafId = 0;
    let resetting = false;       // 「元の位置に戻す」アニメーション中は、物理を止める
    let resetTimer = 0;
    let pluck = null;            // いま、DNAをつまんで引っ張っている操作
    let hitEls = [];             // DNAをつまむための、透明な操作判定領域
    let boundsCache = null;
    let contactNow = new Set();  // いま触れている写真の組（衝突を「新しい衝突」かどうか見分けるため）
    let simId = 0;
    let lastT = 0;
    let pairs = [];              // DNAでつなぐ写真の組（同じ行で、となりどうし）。l0 は元の並びでの中心間の距離

    /* ---- 写真どうしをつなぐDNA（SVG）。細い紫の線画。写真より奥に描く ---- */
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const DNA_PERIOD = 90;        // 元の並びのとき、らせん1回転ぶんの長さ(px)
    const DNA_AMPLITUDE = 22;     // らせんの振れ幅(px)
    const DNA_EXTRA_TURNS = 1;    // 写真のあいだに見える部分に、追加する二重らせんの周期（節）の数
    const DNA_RUNGS_PER_TURN = 5; // 1回転あたりの横棒（塩基対）の数
    const DNA_COLOR = '#7a3fd1';  // ストランド（サイトの紫）
    const DNA_COLOR_MAX = '#2b1055';       // 最大パワーのときの、サイトのテーマカラーの濃い紫
    const DNA_RUNG_COLOR_MAX = '#4b2e8c';
    const DNA_RUNG_COLOR = '#a98bea';
    const THICK_LEVELS = 8;       // ホバー中の、線の太さの段階の数（段の差は、約0.1px。つなぎ目は見えない）

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'dna-links');
    svg.setAttribute('aria-hidden', 'true');
    function addPath(color, width, opacity) {
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', color);
        p.setAttribute('stroke-width', String(width));
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('stroke-opacity', String(opacity));
        svg.appendChild(p);
        return p;
    }
    // 描く順番＝奥から手前。奥側のストランド → 横棒 → 手前側のストランド
    const pathBack = addPath(DNA_COLOR, 1.4, 0.28);
    const pathRungs = addPath(DNA_RUNG_COLOR, 1.1, 0.5);
    const pathFront = addPath(DNA_COLOR, 1.8, 0.6);
    // 色の混ぜ合わせ（t=0 で c1、t=1 で c2）
    function mixColor(c1, c2, t) {
        const p = (c, i) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
        const ch = (i) => Math.round(p(c1, i) + (p(c2, i) - p(c1, i)) * t).toString(16).padStart(2, '0');
        return '#' + ch(0) + ch(1) + ch(2);
    }
    const defs = document.createElementNS(SVG_NS, 'defs');   // ホバー中のDNAの、流れるグラデーションを置く
    svg.appendChild(defs);
    let gradSeq = 0;
    // 紫 → 青 → ピンク → 紫 と、1周して元の色に戻る、繰り返しのグラデーション。つなぎ目が目立たない
    function makeGradient() {
        const lg = document.createElementNS(SVG_NS, 'linearGradient');
        lg.setAttribute('id', 'dna-grad-' + (gradSeq++));
        lg.setAttribute('gradientUnits', 'userSpaceOnUse');
        lg.setAttribute('spreadMethod', 'repeat');
        const stops = [0, 1 / 3, 2 / 3, 1].map((o) => {
            const s = document.createElementNS(SVG_NS, 'stop');
            s.setAttribute('offset', o.toFixed(4));
            lg.appendChild(s);
            return s;
        });
        defs.appendChild(lg);
        return { el: lg, stops: stops, ref: 'url(#' + lg.getAttribute('id') + ')' };
    }
    main.insertBefore(svg, main.firstChild);

    function photoCenter(el) {
        const r = el.querySelector('img').getBoundingClientRect();
        const mr = main.getBoundingClientRect();
        const hv = hover.get(el);   // ホバー・待機による見た目のずれは、DNAの接続位置には、含めない
        const bi = body.get(el);
        return { x: r.left - mr.left + r.width / 2 - hv.x - bi.idleTx, y: r.top - mr.top + r.height / 2 - hv.y - bi.idleTy, r: r.width / 2 };
    }

    // 写真ごとの元の位置と半径を測る（画面の幅が変わるたびにやり直す）
    function measureHomes() {
        members.forEach((el) => {
            const c = photoCenter(el);
            const o = offsets.get(el);
            homes.set(el, { x: c.x - o.x, y: c.y - o.y });
            radii.set(el, el.querySelector('img').offsetWidth / 2);
        });
        boundsCache = null;
    }

    // 動かす前の位置から、「同じ行のとなりどうし」を調べる。バネの自然長は、このときの距離
    function computePairs() {
        measureHomes();
        hitEls.forEach((h) => h.remove());
        hitEls = [];
        pairs = [];
        const list = Array.from(members);
        for (let i = 0; i + 1 < list.length; i++) {
            const a = list[i];
            const b = list[i + 1];
            if (groupOf.get(a) !== groupOf.get(b)) continue;
            const ha = homes.get(a);
            const hb = homes.get(b);
            if (Math.abs(ha.y - hb.y) > 4 || hb.x <= ha.x) continue;   // 行が変わるところはつなげない
            const l0 = Math.hypot(hb.x - ha.x, hb.y - ha.y);
            // 写真のあいだに見える部分（円と円のすきま）に、もとの量＋DNA_EXTRA_TURNS 節ぶんのらせんが入るようにする
            const visible = Math.max(40, l0 - radii.get(a) - radii.get(b));
            const turns = l0 / DNA_PERIOD + DNA_EXTRA_TURNS * (l0 / visible);
            pairs.push({ a: a, b: b, l0: l0, turns: turns, pluck: null, releasedAt: 0, hit: null, hp: null, glow: 0, hovG: 0, glowT: 0, wasHot: false, gAxis: null,
                bul: { u: 0.5, w: 0, v: 0 },   // 膨らみ：位置(u)・大きさ(w)・速さ(v)。見た目だけ
                hov: { u: 0.5, dx: 0, dy: 0, vx: 0, vy: 0, tx: 0, ty: 0, inside: false },
                idleW: 0, idlePhase: pairs.length * 1.7 + 0.9, idlePeriod: 2 + ((pairs.length * 53) % 100) / 100 });
        }
        // DNAをつまむための、透明な操作判定領域（見た目は変えない）。写真より奥にあるので、重なる所では写真が優先される
        pairs.forEach((pair) => {
            // つまんでいる間だけ使う、色が変わるパス（そのDNAだけに適用する）
            // 線の太さの段階ごとに、1本ずつ持つ（段階 k の太さは、更新のたびに決める）
            const lvPaths = (color, width, opacity) => Array.from({ length: THICK_LEVELS }, () => addPath(color, width, opacity));
            pair.hp = { back: lvPaths(DNA_COLOR, 1.4, 0.28), rungs: lvPaths(DNA_RUNG_COLOR, 1.1, 0.5), front: lvPaths(DNA_COLOR, 1.8, 0.6) };
            hitEls.push(...pair.hp.back, ...pair.hp.rungs, ...pair.hp.front);
            pair.gs = makeGradient();   // 線用
            pair.gr = makeGradient();   // 横棒用（ふだんの色が、線と少しちがうため、別に持つ）
            hitEls.push(pair.gs.el, pair.gr.el);
            const h = document.createElementNS(SVG_NS, 'path');
            h.setAttribute('class', 'dna-hit');
            h.setAttribute('fill', 'none');
            h.setAttribute('stroke', 'transparent');
            h.setAttribute('stroke-width', '30');
            h.setAttribute('stroke-linecap', 'round');
            h.setAttribute('stroke-linejoin', 'round');
            h.style.pointerEvents = 'stroke';
            h.style.cursor = 'grab';
            h.addEventListener('pointerdown', (e) => startPluck(pair, e));
            // ホバー（マウスがある端末だけ）：DNAに重ねると、重ねた付近が、カーソルの方向へ、わずかに曲がる
            if (hoverCapable && !reduceMotion) {
                const aim = (e) => { if (e.pointerType === 'mouse') dnaHoverAim(pair, e); };
                h.addEventListener('pointerenter', aim);
                h.addEventListener('pointermove', aim);
                h.addEventListener('pointerleave', (e) => {
                    if (e.pointerType !== 'mouse') return;
                    pair.hov.inside = false;
                    wakeHover();
                });
            }
            svg.appendChild(h);
            hitEls.push(h);
            pair.hit = h;
        });
    }

    const fmt = (x, y) => x.toFixed(1) + ' ' + y.toFixed(1);

    // 2つの写真の中心をむすぶDNAの中心線を、点の列で返す。
    // つまんでいるときは、つまんだ点を通る曲線（二次ベジェ）になる
    function centerline(pair, ca, cb, shake) {
        // つまんでいる（または、離したあとの揺れの）ときは、そちらの形。そうでなければ、ホバーの、わずかな曲がり
        let pk = pair.pluck || pair.hov;
        if (!pair.pluck) {
            // 待機のゆらぎ：ホバーの曲がりに、足す（重みが0のときは、何もしない）
            const idle = idleDisp(pair, ca, cb);
            if (idle) {
                const hv = pair.hov;
                const hovering = Math.abs(hv.dx) + Math.abs(hv.dy) > 0.3;
                pk = { u: hovering ? hv.u : 0.5, dx: hv.dx + idle[0], dy: hv.dy + idle[1] };
            }
        }
        if (!pk || Math.abs(pk.dx) + Math.abs(pk.dy) < 0.3) return [[ca.x, ca.y], [cb.x, cb.y]];
        const u = pk.u;
        // 震え：つまんだ点だけを、ごく小さく揺らす（両端の写真の位置は動かさない）
        const now = performance.now();
        const a = T.pluckShakeAmp * shake;
        const jx = a * (Math.sin(now * 0.071) + 0.6 * Math.sin(now * 0.131));
        const jy = a * (Math.cos(now * 0.083) + 0.6 * Math.sin(now * 0.117));
        const gx = ca.x + (cb.x - ca.x) * u + pk.dx + jx;
        const gy = ca.y + (cb.y - ca.y) * u + pk.dy + jy;
        // つかんだ点 G を、いちばん曲がる（chordから、いちばん離れる）場所にする。
        // 左の写真 A → G → 右の写真 B を、なめらかにつなぐ曲線（エルミート補間を、前半・後半に分けて使う）。
        // G での向きは、A→B の向きにそろえるので、G が山のてっぺんになる。つかむ位置によって、曲がる場所が左右に移る
        const cdx = cb.x - ca.x;
        const cdy = cb.y - ca.y;
        const cl = Math.hypot(cdx, cdy) || 1;
        const ux = cdx / cl;
        const uy = cdy / cl;
        const pts = [];
        const n = 24;   // 前半・後半、それぞれの分割数
        const hermite = (px, py, qx, qy, m0x, m0y, m1x, m1y, from) => {
            for (let i = from; i <= n; i++) {
                const s = i / n;
                const s2 = s * s;
                const s3 = s2 * s;
                const h00 = 2 * s3 - 3 * s2 + 1;
                const h10 = s3 - 2 * s2 + s;
                const h01 = -2 * s3 + 3 * s2;
                const h11 = s3 - s2;
                pts.push([h00 * px + h10 * m0x + h01 * qx + h11 * m1x, h00 * py + h10 * m0y + h01 * qy + h11 * m1y]);
            }
        };
        const l1 = Math.hypot(gx - ca.x, gy - ca.y);
        const l2 = Math.hypot(cb.x - gx, cb.y - gy);
        // 前半：A → G（Aでは G の向き、G では A→B の向き）
        hermite(ca.x, ca.y, gx, gy, gx - ca.x, gy - ca.y, ux * l1, uy * l1, 0);
        // 後半：G → B（G では A→B の向き、B では B へ向かう向き）
        hermite(gx, gy, cb.x, cb.y, ux * l2, uy * l2, cb.x - gx, cb.y - gy, 1);
        return pts;
    }

    function drawLinks() {
        const out = {
            n: { back: '', rungs: '', front: '' },   // ふだんのDNA
            h: null
        };
        pairs.forEach((pair) => {
            const ca = photoCenter(pair.a);
            const cb = photoCenter(pair.b);
            // 引っ張りのパワー（0〜1）。最大距離の pluckFullFrac 割で 1。つまんでいるDNAだけ、色の濃さと震えが変わる
            const pk0 = pair.pluck;
            const pluckPower = pk0 && pk0.held ? clamp(Math.hypot(pk0.dx, pk0.dy) / (T.pluckMax * T.pluckFullFrac), 0, 1) : 0;
            // 色は、2段階：①ホバー（重ねている間、つかんでいる間）= ふだんの薄紫 → #8650BD。②引っ張り = その色から、引いた距離に応じて、さらに濃く
            // つかんだ瞬間に、ホバーの色が薄く戻らないよう、つかんでいる間も、ホバーの色のまま保つ
            const power = pluckPower;
            const hovTarget = (pair.hov && pair.hov.inside) || (pk0 && pk0.held) ? 1 : 0;
            const nowMs = performance.now();
            const dtg = pair.glowT ? Math.min(0.1, (nowMs - pair.glowT) / 1000) : 0;
            pair.glowT = nowMs;
            pair.glow += (power - pair.glow) * (1 - Math.exp(-dtg * 10));   // 色は、なめらかに変える
            if (power === 0 && pair.glow < 0.015) pair.glow = 0;
            // 約95%変わるまでの時間が、dnaHoverIn / dnaHoverOut 秒になるように（時定数 = 時間 / 3）
            pair.hovG += (hovTarget - pair.hovG) * (1 - Math.exp(-dtg * 3 / (hovTarget ? T.dnaHoverIn : T.dnaHoverOut)));
            if (hovTarget === 0 && pair.hovG < 0.01) pair.hovG = 0;
            // 触れた付近の膨らみ：位置は少し遅れて追いかけ、大きさは「ぷにっ」とバネで変わる。つかんでいる間は、つかんだ位置で保つ
            const bl = pair.bul;
            const uT = pk0 ? pk0.u : pair.hov.u;
            if (reduceMotion) {
                bl.w = hovTarget; bl.v = 0; bl.u = uT;
            } else {
                if (bl.w < 0.01 && hovTarget && Math.abs(bl.v) < 0.05) bl.u = uT;   // 触れた位置から、膨らみ始める
                else bl.u += (uT - bl.u) * (1 - Math.exp(-dtg / T.dnaBulgeFollow));
                const ds = Math.min(dtg, 0.05);
                bl.v += (-T.dnaBulgeK * (bl.w - hovTarget) - T.dnaBulgeC * bl.v) * ds;
                bl.w = clamp(bl.w + bl.v * ds, 0, 1.3);
                if (!hovTarget && bl.w < 0.005 && Math.abs(bl.v) < 0.05) { bl.w = 0; bl.v = 0; }
            }
            // グラデーションの向きと流れ：DNAの軸に沿って、1周ぶん(gl)の長さで繰り返し、時間とともに、ずれていく
            {
                const gx = cb.x - ca.x;
                const gy = cb.y - ca.y;
                const gd = Math.hypot(gx, gy) || 1;
                const gl = Math.max(160, gd);
                const ph = reduceMotion ? 0 : (nowMs / 1000 / T.dnaGradPeriod) % 1;
                const ux = gx / gd;
                const uy = gy / gd;
                pair.gAxis = [ca.x + ux * ph * gl, ca.y + uy * ph * gl, ca.x + ux * (ph + 1) * gl, ca.y + uy * (ph + 1) * gl];
            }
            const hot = pair.glow > 0 || pair.hovG > 0 || bl.w > 0;
            const shake = power > T.pluckShakeStart ? (power - T.pluckShakeStart) / (1 - T.pluckShakeStart) : 0;
            const pts = centerline(pair, ca, cb, shake);
            // 中心線の長さ（弧長）。のびるほど長くなる
            const cum = [0];
            for (let i = 1; i < pts.length; i++) {
                cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
            }
            const len = cum[cum.length - 1];
            if (len < 1) return;
            // 操作判定領域も、曲がったDNAに沿わせる
            pair.hit.setAttribute('d', 'M' + pts.map((p) => fmt(p[0], p[1])).join(' L'));
            const pk = pair.pluck;
            // ホバー中のDNAは、線の太さごとに、THICK_LEVELS 本ずつのパスに分けて描く（太さは、パスごとに1つしか決められないため）。
            // ふだんのDNAは、今までどおり、太さが1種類のパスにまとめる
            const hotB = hot ? { back: Array(THICK_LEVELS).fill(''), rungs: Array(THICK_LEVELS).fill(''), front: Array(THICK_LEVELS).fill('') } : null;
            const put = (kind, lv, str) => { if (hotB) hotB[kind][lv] += str; else out.n[kind] += str; };
            pair.hotStrings = hotB;
            // 弧長 s の位置の、点と向き
            const pointAt = (s) => {
                let i = 1;
                while (i < cum.length - 1 && cum[i] < s) i++;
                const seg = cum[i] - cum[i - 1] || 1;
                const f = clamp((s - cum[i - 1]) / seg, 0, 1);
                const tx = (pts[i][0] - pts[i - 1][0]) / seg;
                const ty = (pts[i][1] - pts[i - 1][1]) / seg;
                return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f, tx, ty];
            };
            const turns = pair.turns;   // 回転数は一定。のびると間隔が広がる
            const amp = DNA_AMPLITUDE * clamp(pair.l0 / len, 0.5, 1.15); // のびると、すこし細くなる
            // 操作領域（透明）の太さ：2本のらせんと、そのあいだ全体を含む。見えているDNAの幅に、いつも合わせる
            // 触れた付近だけ、らせんの幅が、なめらかに広がる（線の太さは変えない）。両端は、変わらない
            const bW = T.dnaBulge * bl.w;
            const bC = bl.u * len;
            const ampAt = (s) => {
                const d = Math.abs(s - bC);
                return bW < 0.0005 || d >= T.dnaBulgeRadius ? amp : amp * (1 + bW * 0.5 * (1 + Math.cos(Math.PI * d / T.dnaBulgeRadius)));
            };
            pair.hit.setAttribute('stroke-width', String(Math.round(2 * amp * (1 + Math.max(0, bW)) + T.hitPad)));
            const s0 = ca.r * 0.5;            // 写真の下に隠れる部分は描かない
            const s1 = len - cb.r * 0.5;
            if (s1 <= s0) return;
            const steps = Math.min(400, Math.max(16, Math.ceil((s1 - s0) / 4)));
            const theta = (s) => (s / len) * turns * Math.PI * 2;
            const strandPoint = (s, sign) => {
                const p = pointAt(s);
                const w = sign * ampAt(s) * Math.sin(theta(s));
                return [p[0] - p[3] * w, p[1] + p[2] * w];
            };
            // 線の太さの段階（0 = ふだん 〜 THICK_LEVELS-1 = 最大）：触れた付近が最も太く、なめらかに（余弦の形で）ふだんの太さへ戻る。
            // 写真とのつなぎ目の近くでは、不自然に太くならないよう、写真のふちから離れるにつれて、太くなる
            const thickC = bl.u * len;
            const lvAt = (s) => {
                if (!hotB || pair.hovG < 0.002) return 0;
                const d = Math.abs(s - thickC);
                if (d >= T.dnaThickRadius) return 0;
                const edge = clamp(Math.min(s - ca.r, len - cb.r - s) / 36, 0, 1);
                const k = pair.hovG * 0.5 * (1 + Math.cos(Math.PI * d / T.dnaThickRadius)) * edge;
                return Math.round(k * (THICK_LEVELS - 1));
            };
            // ストランドを、奥側・手前側、太さの段階ごとに分けて折れ線にする（つなぎ目は、丸い端でつなぐので、目立たない）
            [1, -1].forEach((sign) => {
                let curF = null;
                let curL = 0;
                let seg = '';
                for (let i = 0; i <= steps; i++) {
                    const s = s0 + (s1 - s0) * (i / steps);
                    const f = sign * Math.cos(theta(s)) >= 0;
                    const lv = lvAt(s);
                    const p = strandPoint(s, sign);
                    if (curF === null) {
                        curF = f;
                        curL = lv;
                        seg = 'M' + fmt(p[0], p[1]);
                    } else if (f !== curF || lv !== curL) {
                        seg += ' L' + fmt(p[0], p[1]);
                        put(curF ? 'front' : 'back', curL, seg);
                        curF = f;
                        curL = lv;
                        seg = 'M' + fmt(p[0], p[1]);
                    } else {
                        seg += ' L' + fmt(p[0], p[1]);
                    }
                }
                put(curF ? 'front' : 'back', curL, seg);
            });
            // 横棒
            const rungStep = Math.PI * 2 / DNA_RUNGS_PER_TURN;
            const th0 = theta(s0);
            const th1 = theta(s1);
            for (let th = Math.ceil(th0 / rungStep) * rungStep + rungStep / 2; th < th1; th += rungStep) {
                if (Math.abs(Math.sin(th)) < 0.25) continue;   // 交差のところは描かない
                const s = (th / (turns * Math.PI * 2)) * len;
                const p = strandPoint(s, 1);
                const q = strandPoint(s, -1);
                put('rungs', lvAt(s), 'M' + fmt(p[0], p[1]) + ' L' + fmt(q[0], q[1]));
            }
        });
        pairs.forEach((pair) => {
            const g = pair.glow;
            const hp = pair.hp;
            if (!hp) return;
            if ((g > 0 || pair.hovG > 0 || pair.bul.w > 0) && pair.hotStrings) {
                const s = pair.hotStrings;
                const hg = pair.hovG;
                // 色：ふだんの薄紫 →（ホバー hg）紫・青・ピンクのグラデーション →（引っ張り g）少し鮮やかに。
                // 引っ張りは、グラデーションを残したまま、鮮やかさと不透明度で表す（ホバーの色と、競合しない）。線の太さ・形は、変えない
                const grad = [T.dnaGradA, T.dnaGradB, T.dnaGradC];
                const vivid = [T.dnaGradVividA, T.dnaGradVividB, T.dnaGradVividC];
                const ax = pair.gAxis;
                [[pair.gs, DNA_COLOR], [pair.gr, DNA_RUNG_COLOR]].forEach((it) => {
                    const gd = it[0];
                    if (ax) {
                        gd.el.setAttribute('x1', ax[0].toFixed(1));
                        gd.el.setAttribute('y1', ax[1].toFixed(1));
                        gd.el.setAttribute('x2', ax[2].toFixed(1));
                        gd.el.setAttribute('y2', ax[3].toFixed(1));
                    }
                    gd.stops.forEach((st, i) => st.setAttribute('stop-color', mixColor(mixColor(it[1], grad[i % 3], hg), vivid[i % 3], g)));
                });
                const lerp = (a, b, t) => a + (b - a) * t;
                const op = (baseOp, hovOp, maxOp) => String(lerp(lerp(baseOp, hovOp, hg), maxOp, g));
                // 線の太さ：段階 k のパスの太さ = ふだんの太さ × (1 〜 dnaThick)。2本の主鎖（奥・手前）も横棒も、同じ倍率で、自然に太くなる
                const kinds = [
                    ['back', 1.4, pair.gs.ref, op(0.28, T.dnaHoverOpacity * 0.75, 0.85)],
                    ['rungs', 1.1, pair.gr.ref, op(0.5, T.dnaHoverOpacity * 0.85, 0.95)],
                    ['front', 1.8, pair.gs.ref, op(0.6, T.dnaHoverOpacity, 1)]
                ];
                kinds.forEach((kd) => {
                    for (let k = 0; k < THICK_LEVELS; k++) {
                        const el = hp[kd[0]][k];
                        const str = s[kd[0]][k];
                        if (!str) {
                            if (el.getAttribute('d')) el.setAttribute('d', '');
                            continue;
                        }
                        el.setAttribute('d', str);
                        el.setAttribute('stroke', kd[2]);
                        el.setAttribute('stroke-opacity', kd[3]);
                        el.setAttribute('stroke-width', (kd[1] * (1 + (T.dnaThick - 1) * k / (THICK_LEVELS - 1))).toFixed(2));
                    }
                });
                pair.wasHot = true;
            } else if (pair.wasHot) {
                ['back', 'rungs', 'front'].forEach((kind) => hp[kind].forEach((el) => el.setAttribute('d', '')));
                pair.wasHot = false;
            }
        });
        pathBack.setAttribute('d', out.n.back);
        pathRungs.setAttribute('d', out.n.rungs);
        pathFront.setAttribute('d', out.n.front);
    }

    // 元の位置に戻るアニメーションの間、毎フレームDNAを描き直す
    function animateLinks(ms) {
        const end = performance.now() + ms;
        (function tick() {
            drawLinks();
            if (performance.now() < end) requestAnimationFrame(tick);
        })();
    }

    function clamp(v, min, max) {
        return Math.min(Math.max(v, min), max);
    }

    /* ---- 物理：ぶつかったら、ゼリーのように軽く変形して弾く。DNAは、のびたときだけ引っ張るゴム ----
            ・押す速さに応じて、弾かれ方が変わる（ゆっくり→少しだけ、速く→大きく）
            ・ぶつかった瞬間に、ぶつかった向きへ5〜10%つぶれ、約0.4秒でぷるんと戻る
            ・DNAは、自然長（元の距離）よりのびたときだけ、バネとダンパーで引き寄せる */

    // 全員が動ける共通の領域＝3つのセクション全体（ページ上の座標）。ヘッダーやナビゲーションは含まない。
    // スクロールしても変わらない（ページ上の座標で持っているため）
    function areaRect() {
        let l = Infinity, r = -Infinity, tp = Infinity, b = -Infinity;
        new Set(groupOf.values()).forEach((g) => {
            const q = g.getBoundingClientRect();
            l = Math.min(l, q.left + window.scrollX);
            r = Math.max(r, q.right + window.scrollX);
            tp = Math.min(tp, q.top + window.scrollY);
            b = Math.max(b, q.bottom + window.scrollY);
        });
        return { l: l, r: r, t: tp, b: b };
    }

    // 写真が動かせる範囲＝共通の領域の中（写真全体＝円と名前が収まる範囲）。offsets（元の位置からのずれ）で表す
    function memberBounds(el) {
        const o = offsets.get(el);
        const r = el.getBoundingClientRect();
        const area = areaRect();
        const baseLeft = r.left + window.scrollX - o.x;
        const baseTop = r.top + window.scrollY - o.y;
        const regLeft = Math.max(0, area.l - 30);
        const regRight = Math.min(document.documentElement.clientWidth, area.r + 30);
        const regTop = area.t;
        const regBottom = area.b;
        return {
            minX: regLeft - baseLeft,
            maxX: regRight - r.width - baseLeft,
            minY: regTop - baseTop,
            maxY: regBottom - r.height - baseTop
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

    // ぶつかった向きにつぶれて、そのあと、ぷるぷる揺れ戻る
    function hit(b, nx, ny, strength) {
        // 弱い衝突は、これまでと同じ。強い衝突ほど、強さの2乗に応じて、さらにつぶす（最大で約11%。jellyMax の12%が上限。つぶれ量の最大は、約 jellyHit × (1 + jellyStrongBoost) ÷ 27 ）
        b.defv -= strength * T.jellyHit * (1 + T.jellyStrongBoost * strength * strength);
        b.ang = Math.atan2(ny, nx);
    }

    // DNAのバネ：のびたときだけ引く（縮んだときは押し返さない）。つかんでいる写真は動かさない
    function applySprings(dt) {
        pairs.forEach((pair) => {
            if (pair.pluck && pair.pluck.held) return;   // DNAをつまんでいる間は、写真どうしのバネは休む
            // 弾いた直後は、弾いた勢いを打ち消さないよう、バネを弱めて、springRamp 秒かけて元に戻す
            const springScale = pair.releasedAt ? clamp((performance.now() - pair.releasedAt) / (T.springRamp * 1000), 0, 1) : 1;
            const A = pair.a;
            const B = pair.b;
            const ka = isDragged(A);
            const kb = isDragged(B);
            if (ka && kb) return;
            const oa = offsets.get(A);
            const ob = offsets.get(B);
            const ha = homes.get(A);
            const hb = homes.get(B);
            const dx = (hb.x + ob.x) - (ha.x + oa.x);
            const dy = (hb.y + ob.y) - (ha.y + oa.y);
            const d = Math.hypot(dx, dy);
            const ext = d - pair.l0 - T.springDeadzone;
            if (d < 0.01) return;
            const nx = dx / d;
            const ny = dy / d;
            const ba = body.get(A);
            const bb = body.get(B);
            const wa = ka ? 0 : 1 / ba.mass;
            const wb = kb ? 0 : 1 / bb.mass;
            if (ext <= 0) {
                // 縮んでいる間は、DNAは押し返さない。ただし、近づく勢いだけは弱める（行きすぎを防ぐ）
                const approach = (bb.vx - ba.vx) * nx + (bb.vy - ba.vy) * ny;
                if (approach < 0 && !ka && !kb) {   // つかんでいる写真が近づいてくるときは、相手を押しのけない
                    const dv = -approach * Math.min(1, T.springBrake * dt);
                    ba.vx -= nx * dv * wa / (wa + wb);
                    ba.vy -= ny * dv * wa / (wa + wb);
                    bb.vx += nx * dv * wb / (wa + wb);
                    bb.vy += ny * dv * wb / (wa + wb);
                }
                return;
            }
            // 引く力：のびるほど少しずつ強くなる
            let pull = T.springK * ext + T.springK2 * ext * ext;
            // ダンパー：離れていく速さに応じてブレーキ（揺れを抑える）
            const rel = (bb.vx - ba.vx) * nx + (bb.vy - ba.vy) * ny;
            pull += T.springC * rel;
            const relief = 1 - T.springRelief * Math.max(ba.free, bb.free);   // ぶつかった直後は、引き寄せを弱める
            pull = clamp(pull, 0, T.maxPull) * springScale * relief;   // 押す方向には、決してはたらかせない
            ba.vx += nx * pull * wa * dt;
            ba.vy += ny * pull * wa * dt;
            bb.vx -= nx * pull * wb * dt;
            bb.vy -= ny * pull * wb * dt;
        });
    }

    // 離したあとの、DNAの中央が元に戻る動き（バネ・ダンパー）。勢いよく戻り、少しぷるぷる揺れて止まる
    function stepPlucks(dt) {
        pairs.forEach((pair) => {
            const pk = pair.pluck;
            if (!pk || pk.held) return;
            const sub = 2;   // 速く戻るので、細かく2回に分けて計算する（安定させるため）
            const h = dt / sub;
            for (let i = 0; i < sub; i++) {
                pk.vx += (-T.pluckSnapK * pk.dx - T.pluckSnapC * pk.vx) * h;
                pk.vy += (-T.pluckSnapK * pk.dy - T.pluckSnapC * pk.vy) * h;
                pk.dx += pk.vx * h;
                pk.dy += pk.vy * h;
            }
            if (Math.hypot(pk.dx, pk.dy) < 0.4 && Math.hypot(pk.vx, pk.vy) < 8) pair.pluck = null;
        });
    }

    /* ---- 位置の補正（めり込みを解く）。速さの計算とは分けて、毎回「めり込みゼロ」を目指す ----
            ・円どうしの中心間距離が、半径の合計＋すきま より短くならないようにする
            ・壁の判定と、写真どうしの判定を、同じ反復の中で一緒に解く（壁で動けない写真は、動かさない）
            ・つかんでいる写真は、目標の座標へ向かうが、実際の位置は、ほかの写真・壁にぶつからない範囲に収める */

    // 補正で動かしやすさ（質量の逆数）。壁で動けない写真は 0、つかんでいる写真は dragFactor
    function invMassOf(el, blocked, dragFactor) {
        if (blocked.has(el)) return 0;
        if (isDragged(el)) return dragFactor;
        return 1 / body.get(el).mass;
    }

    // 領域の外へ出ていたら戻す。戻した写真は blocked に入れる（その写真は、壁で動けないものとして扱う）
    function clampBody(el, bd, blocked) {
        const o = offsets.get(el);
        const cx = clamp(o.x, bd.minX, bd.maxX);
        const cy = clamp(o.y, bd.minY, bd.maxY);
        if (cx !== o.x || cy !== o.y) blocked.add(el);
        // 壁に押し戻した量＝壁への押しつけの強さ（見た目のつぶれにだけ使う）
        const bb = body.get(el);
        bb.pmx = Math.max(bb.pmx, Math.abs(cx - o.x));
        bb.pmy = Math.max(bb.pmy, Math.abs(cy - o.y));
        o.x = cx;
        o.y = cy;
    }

    // 2枚が重なっていたら、中心を結ぶ向きに、動かしやすさに応じて分けて、重なりをなくす
    function pushApart(A, B, blocked, dragFactor) {
        const oa = offsets.get(A);
        const ob = offsets.get(B);
        const ha = homes.get(A);
        const hb = homes.get(B);
        let dx = (hb.x + ob.x) - (ha.x + oa.x);
        let dy = (hb.y + ob.y) - (ha.y + oa.y);
        let d = Math.hypot(dx, dy);
        const min = radii.get(A) + radii.get(B) + T.gap;
        if (d >= min) return;
        if (d < 0.01) { dx = 1; dy = 0; d = 1; }
        const wa = invMassOf(A, blocked, dragFactor);
        const wb = invMassOf(B, blocked, dragFactor);
        const sum = wa + wb;
        if (sum === 0) return;
        const pen = min - d;
        const nx = dx / d;
        const ny = dy / d;
        // 写真どうしを押しつけた量＝押しつけの強さ（見た目のつぶれにだけ使う）
        const ba = body.get(A);
        const bb = body.get(B);
        const sq = T.pairSquash;
        ba.pmx = Math.max(ba.pmx, pen * Math.abs(nx) * sq);
        ba.pmy = Math.max(ba.pmy, pen * Math.abs(ny) * sq);
        bb.pmx = Math.max(bb.pmx, pen * Math.abs(nx) * sq);
        bb.pmy = Math.max(bb.pmy, pen * Math.abs(ny) * sq);
        oa.x -= nx * pen * wa / sum;
        oa.y -= ny * pen * wa / sum;
        ob.x += nx * pen * wb / sum;
        ob.y += ny * pen * wb / sum;
    }

    // 写真どうし・壁の判定を、n 回、交互に繰り返す。allowDrag が true の最初の6割は、つかんでいる写真も少しだけ押し戻される
    function runIterations(list, bounds, n, allowDrag) {
        let blocked = new Set();
        for (let it = 0; it < n; it++) {
            const dragFactor = allowDrag && it < n * 0.6 ? T.dragInvMass : 0;
            for (let i = 0; i < list.length; i++) {
                for (let j = i + 1; j < list.length; j++) {
                    if (isDragged(list[i]) && isDragged(list[j])) continue;
                    pushApart(list[i], list[j], blocked, dragFactor);
                }
            }
            const next = new Set();
            list.forEach((el) => clampBody(el, bounds.get(el), next));
            blocked = next;
        }
    }

    // いちばん深いめり込み(px)
    function maxPenetration(list) {
        let worst = 0;
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const oa = offsets.get(list[i]);
                const ob = offsets.get(list[j]);
                const ha = homes.get(list[i]);
                const hb = homes.get(list[j]);
                const d = Math.hypot((hb.x + ob.x) - (ha.x + oa.x), (hb.y + ob.y) - (ha.y + oa.y));
                worst = Math.max(worst, radii.get(list[i]) + radii.get(list[j]) + T.gap - d);
            }
        }
        return worst;
    }

    // つかんでいる写真を、ほかの写真・壁にぶつからない位置まで戻す（ほかの写真は動かさない）。
    // これ以上押せない（相手が壁などで動けない）ときは、つかんでいる写真が手前で止まる
    function projectDragged(list, bounds, dragEl) {
        const bd = bounds.get(dragEl);
        const od = offsets.get(dragEl);
        const hd = homes.get(dragEl);
        for (let it = 0; it < 12; it++) {
            list.forEach((other) => {
                if (other === dragEl) return;
                const oo = offsets.get(other);
                const ho = homes.get(other);
                let dx = (ho.x + oo.x) - (hd.x + od.x);
                let dy = (ho.y + oo.y) - (hd.y + od.y);
                let d = Math.hypot(dx, dy);
                const min = radii.get(dragEl) + radii.get(other) + T.gap;
                if (d >= min) return;
                if (d < 0.01) { dx = 1; dy = 0; d = 1; }
                od.x -= dx / d * (min - d);
                od.y -= dy / d * (min - d);
            });
            clampBody(dragEl, bd, new Set());
        }
    }

    function resolvePositions(list, bounds) {
        const dragEl = drag && drag.active ? drag.el : null;
        // A) 全員を、壁と写真どうしの判定を交互に何度も繰り返して解く
        runIterations(list, bounds, T.solverIterations, true);
        // B) まだ重なりが残っていたら、「つかんでいる写真を戻す」→「ほかの写真だけで解き直す」を、重なりがなくなるまで繰り返す
        for (let round = 0; round < 4; round++) {
            if (dragEl) projectDragged(list, bounds, dragEl);
            if (maxPenetration(list) < 0.3) break;
            runIterations(list, bounds, 10, false);
        }
        if (dragEl) projectDragged(list, bounds, dragEl);
    }

    // 壁で動けない向きかどうか（その写真に、(nx, ny) の向きの力を加えても、動けないか）
    function pinned(el, bounds, nx, ny) {
        const o = offsets.get(el);
        const bd = bounds.get(el);
        const e = 0.5;
        return (nx > 0.2 && o.x >= bd.maxX - e) || (nx < -0.2 && o.x <= bd.minX + e) ||
               (ny > 0.2 && o.y >= bd.maxY - e) || (ny < -0.2 && o.y <= bd.minY + e);
    }

    // 速さの計算（位置の補正とは別）：ぶつかった向きと相対速度から、跳ね返りと反動を求める
    function resolveVelocities(list, bounds) {
        const contactPrev = contactNow;
        contactNow = new Set();
        const boostedNow = new Set();
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
                const dx = (hb.x + ob.x) - (ha.x + oa.x);
                const dy = (hb.y + ob.y) - (ha.y + oa.y);
                const d = Math.hypot(dx, dy);
                const min = radii.get(A) + radii.get(B) + T.gap;
                if (d > min + 1 || d < 0.01) continue;   // 触れていない組は、何もしない
                const key = i * 32 + j;
                contactNow.add(key);
                const nx = dx / d;
                const ny = dy / d;
                const ba = body.get(A);
                const bb = body.get(B);
                // 壁に押し付けられて動けない写真には、速さも与えない（無理に押し込まない）
                const wa = ka || pinned(A, bounds, -nx, -ny) ? 0 : 1 / ba.mass;
                const wb = kb || pinned(B, bounds, nx, ny) ? 0 : 1 / bb.mass;
                const sum = wa + wb;
                if (sum === 0) continue;
                const rel = (bb.vx - ba.vx) * nx + (bb.vy - ba.vy) * ny;
                if (rel >= 0) continue;   // 離れていく向きなら、何もしない
                const e = -rel > T.bounceMinSpeed ? T.restitution : 0;
                // 衝突ブースト：動いている写真どうしが、新しくぶつかったときだけ、1度だけ。弱い衝突ほど控えめ
                let boost = 1;
                if (!ka && !kb && !contactPrev.has(key) && !boostedNow.has(key)) {
                    boost = 1 + (T.collisionBoost - 1) * clamp((-rel - T.bounceMinSpeed) / T.collisionBoostRamp, 0, 1);
                    boostedNow.add(key);
                    const f = clamp(-rel / 500, 0.4, 1);
                    ba.glide = Math.max(ba.glide, f);
                    bb.glide = Math.max(bb.glide, f);
                    ba.free = Math.max(ba.free, f);
                    bb.free = Math.max(bb.free, f);
                }
                const imp = -(1 + e) * rel / sum * boost;
                ba.vx -= nx * imp * wa;
                ba.vy -= ny * imp * wa;
                bb.vx += nx * imp * wb;
                bb.vy += ny * imp * wb;
                // ぷるん：ぶつかった瞬間だけ、速さに応じて両方がつぶれる
                if (!reduceMotion && -rel > 40) {
                    // 強さ（0〜1）：300px/秒までは、これまでと同じ（速さに比例）。それより強い衝突は、500px/秒で最大になる
                    const strength = clamp(-rel / 700 + Math.max(0, -rel - 300) / 600, 0, 1);
                    hit(ba, nx, ny, strength);
                    hit(bb, -nx, -ny, strength);
                }
            }
        }
        // 壁：当たったら、軽く変形して、柔らかく跳ね返る（ゆっくりなら、止まる）
        list.forEach((el) => {
            if (isDragged(el)) return;
            const b = body.get(el);
            const o = offsets.get(el);
            const bd = bounds.get(el);
            const e = 0.5;
            const hitWall = (axis, v, side) => {
                const sp = Math.abs(v);
                const nv = sp < T.bounceMinSpeed ? 0 : -v * T.wallRestitution;
                if (!reduceMotion && sp > 40) {
                    if (axis === 'x') hit(b, side, 0, Math.min(1, sp / 600));
                    else hit(b, 0, side, Math.min(1, sp / 600));
                }
                return nv;
            };
            if (o.x >= bd.maxX - e && b.vx > 0) b.vx = hitWall('x', b.vx, 1);
            else if (o.x <= bd.minX + e && b.vx < 0) b.vx = hitWall('x', b.vx, -1);
            if (o.y >= bd.maxY - e && b.vy > 0) b.vy = hitWall('y', b.vy, 1);
            else if (o.y <= bd.minY + e && b.vy < 0) b.vy = hitWall('y', b.vy, -1);
        });
    }

    // 固定の細かい時間刻み（サブステップ）で計算する。速く動いても、すり抜けないようにする
    function substep(h, bounds) {
        const list = Array.from(members);

        // 0) DNAのバネ（速さだけを変える。位置は、あとの補正で決める）
        stepPlucks(h);
        applySprings(h);

        // 1) 移動
        list.forEach((el) => {
            const b = body.get(el);
            const o = offsets.get(el);
            b.sx = o.x;
            b.sy = o.y;
            if (isDragged(el)) {
                // つかんでいる写真：目標の座標へ向かう。1回に進める距離は、半径の dragStepFrac 倍まで（一気に飛び越さないように）
                const mx = drag.tx - o.x;
                const my = drag.ty - o.y;
                const dist = Math.hypot(mx, my);
                const maxStep = radii.get(el) * T.dragStepFrac;
                const k = dist > maxStep ? maxStep / dist : 1;
                o.x += mx * k;
                o.y += my * k;
            } else {
                o.x += b.vx * h;
                o.y += b.vy * h;
                // ゆっくりのときは弱く、速いときは強く減速する（速く弾かれても、すぐ止まる）
                const sp = Math.hypot(b.vx, b.vy);
                const slip = 1 - T.glideAmount * b.glide;   // 弾かれた直後は、減速が弱い
                const f = Math.exp(-(T.frictionBase + T.frictionQuad * sp) * slip * h);
                b.vx *= f;
                b.vy *= f;
            }
        });

        // 2) 位置の補正：めり込みを、必ずなくす
        resolvePositions(list, bounds);

        // 3) つかんでいる写真の速さ：実際に動いた距離から求める（目標へ動けなかったぶんは、勢いにしない）
        if (drag && drag.active) {
            const b = body.get(drag.el);
            const o = offsets.get(drag.el);
            const nvx = (o.x - b.sx) / h;
            const nvy = (o.y - b.sy) / h;
            b.vx += (nvx - b.vx) * 0.35;
            b.vy += (nvy - b.vy) * 0.35;
        }

        // 4) 速さの計算：衝突の跳ね返り・反動・壁
        resolveVelocities(list, bounds);
    }

    function step(dt) {
        const list = Array.from(members);
        const bounds = getBounds();
        const n = clamp(Math.ceil(dt / T.maxSubstep), 1, 6);
        list.forEach((el) => { const b = body.get(el); b.pmx = 0; b.pmy = 0; });
        for (let s = 0; s < n; s++) substep(dt / n, bounds);
        // つかんでいる写真が、壁の向こうへ押しこもうとしているぶんも、押しつけの強さにする
        if (drag && drag.active) {
            const b = body.get(drag.el);
            b.pmx = Math.max(b.pmx, drag.overX);
            b.pmy = Math.max(b.pmy, drag.overY);
        }

        // 速さの上限と、ぷるぷる（バネ）。1フレームに1回
        list.forEach((el) => {
            const b = body.get(el);
            const sp = Math.hypot(b.vx, b.vy);
            if (sp > T.maxSpeed) { b.vx *= T.maxSpeed / sp; b.vy *= T.maxSpeed / sp; }
            b.mass = 1 + (b.mass - 1) * Math.exp(-2 * dt);   // 離した直後の重さは、少しずつ元に戻る
            b.glide *= Math.exp(-3 * dt / T.glideTime);
            b.free *= Math.exp(-dt / T.freeTime);
            b.defv += (-T.jellyK * b.def - T.jellyC * b.defv) * dt;
            b.def = clamp(b.def + b.defv * dt, -T.jellyMax, T.jellyMax);
            // 押しつけによるつぶれ：押しつけられている間は、少しつぶれた状態を保ち、離れると、バネでぷるぷる戻る
            // （見た目だけの変形。物理の位置・半径は変えないので、貫通防止には影響しない）
            const tx = reduceMotion ? 0 : clamp(b.pmx / T.squashRange, 0, 1) * T.squashMax;
            const ty = reduceMotion ? 0 : clamp(b.pmy / T.squashRange, 0, 1) * T.squashMax;
            b.cvx += (-T.squashK * (b.cx - tx) - T.squashC * b.cvx) * dt;
            b.cvy += (-T.squashK * (b.cy - ty) - T.squashC * b.cvy) * dt;
            b.cx = clamp(b.cx + b.cvx * dt, -T.squashMax * 0.6, T.squashMax * 1.15);   // 反対側へののびは、つぶれ量の6割まで
            b.cy = clamp(b.cy + b.cvy * dt, -T.squashMax * 0.6, T.squashMax * 1.15);
            const img = el.querySelector('img');
            const impactOn = Math.abs(b.def) > 0.003 || Math.abs(b.defv) > 0.05;
            const squashOn = Math.abs(b.cx) > 0.002 || Math.abs(b.cy) > 0.002 || Math.abs(b.cvx) > 0.05 || Math.abs(b.cvy) > 0.05;
            let tf = '';
            if (squashOn) {
                // つぶれた方向に、少しだけ反対側がふくらむ（縦と横の変形）
                const sx = 1 - b.cx + 0.4 * b.cy;
                const sy = 1 - b.cy + 0.4 * b.cx;
                tf += 'scale(' + sx.toFixed(3) + ', ' + sy.toFixed(3) + ') ';
            } else {
                b.cx = 0; b.cy = 0; b.cvx = 0; b.cvy = 0;
            }
            if (impactOn) {
                const s = 1 + b.def;
                const deg = (b.ang * 180 / Math.PI).toFixed(1);
                tf += 'rotate(' + deg + 'deg) scale(' + s.toFixed(3) + ', ' + (1 / s).toFixed(3) + ') rotate(-' + deg + 'deg)';
            } else {
                b.def = 0;
                b.defv = 0;
            }
            const iv = b.idleV;
            const idleStr = iv ? 'translate(' + iv[2].toFixed(2) + 'px, ' + iv[3].toFixed(2) + 'px) scale(' + iv[0].toFixed(4) + ', ' + iv[1].toFixed(4) + ') ' : '';
            img.style.transform = (idleStr + tf).trim();
            applyTransform(el, isDragged(el));
        });
    }

    // まだ動いているか（速さ・ぷるぷる・DNAののび）。すべて落ち着いたら、物理を止める
    function simActive() {
        if (drag && drag.active) return true;
        let active = false;
        members.forEach((el) => {
            const b = body.get(el);
            if (Math.hypot(b.vx, b.vy) > 6 || Math.abs(b.def) > 0.003 || Math.abs(b.defv) > 0.05 || b.mass > 1.05 ||
                Math.abs(b.cx) > 0.002 || Math.abs(b.cy) > 0.002 || Math.abs(b.cvx) > 0.05 || Math.abs(b.cvy) > 0.05 || b.pmx > 0.5 || b.pmy > 0.5) active = true;
        });
        if (!active) {
            pairs.forEach((pair) => {
                const oa = offsets.get(pair.a);
                const ob = offsets.get(pair.b);
                const ha = homes.get(pair.a);
                const hb = homes.get(pair.b);
                const d = Math.hypot((hb.x + ob.x) - (ha.x + oa.x), (hb.y + ob.y) - (ha.y + oa.y));
                if (d - pair.l0 > 1) active = true;
            });
        }
        if (!active && pairs.some((p) => (p.pluck && !p.pluck.held) || p.glow > 0.02)) active = true;
        return active;
    }

    function simLoop(now) {
        const dt = Math.min(0.033, (now - lastT) / 1000) || 0.016;
        lastT = now;
        lastSimAt = now;
        step(dt);
        drawLinks();
        simId = simActive() ? requestAnimationFrame(simLoop) : 0;
    }

    function wake() {
        if (simId || resetting) return;
        lastT = performance.now();
        simId = requestAnimationFrame(simLoop);
    }

    // 物理を止めて、全員の速さ・ぷるぷる・重さをゼロに戻す
    function stopSim() {
        if (simId) cancelAnimationFrame(simId);
        simId = 0;
        members.forEach((el) => {
            const b = body.get(el);
            b.vx = 0; b.vy = 0; b.def = 0; b.defv = 0; b.mass = 1; b.glide = 0; b.free = 0;
            b.cx = 0; b.cy = 0; b.cvx = 0; b.cvy = 0; b.pmx = 0; b.pmy = 0;
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

    /* ---- ドラッグ ---- */

    // ドラッグ中の「目標の座標」を更新する（画面が自動スクロールしても、ページ上の位置で計算する）。
    // 写真の実際の位置は、物理の計算（step）が、ほかの写真・壁にぶつからない範囲で更新する
    function update() {
        const dx = (drag.cx + window.scrollX) - (drag.sx + drag.scx);
        const dy = (drag.cy + window.scrollY) - (drag.sy + drag.scy);
        const rx = drag.ox + dx;
        const ry = drag.oy + dy;
        drag.tx = clamp(rx, drag.minX, drag.maxX);
        drag.ty = clamp(ry, drag.minY, drag.maxY);
        // つかんだまま壁に当たったときも、勢いに応じて軽くつぶれる
        const b = body.get(drag.el);
        const wallX = rx !== drag.tx;
        const wallY = ry !== drag.ty;
        if (!reduceMotion) {
            if (wallX && !drag.wallX && Math.abs(b.vx) > 60) hit(b, rx > drag.tx ? 1 : -1, 0, Math.min(1, Math.abs(b.vx) / 700));
            if (wallY && !drag.wallY && Math.abs(b.vy) > 60) hit(b, 0, ry > drag.ty ? 1 : -1, Math.min(1, Math.abs(b.vy) / 700));
        }
        drag.wallX = wallX;
        drag.wallY = wallY;
        drag.overX = Math.abs(rx - drag.tx);   // 壁の向こうへ押しこもうとしている距離＝壁への押しつけの強さ
        drag.overY = Math.abs(ry - drag.ty);
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
        const bd = memberBounds(el);
        drag.minX = bd.minX;
        drag.maxX = bd.maxX;
        drag.minY = bd.minY;
        drag.maxY = bd.maxY;
        drag.wallX = false;
        drag.wallY = false;
        drag.tx = o.x;
        drag.ty = o.y;
        drag.overX = 0;
        drag.overY = 0;
        drag.active = true;
        const b = body.get(el);
        b.vx = 0; b.vy = 0; b.px = o.x; b.py = o.y;
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
            const released = drag;
            drag.el.classList.remove('is-dragging');
            applyTransform(drag.el, false);
            drawLinks();
            const b = body.get(released.el);
            b.vx *= 0.85; b.vy *= 0.85;   // 離したあと、動かしていた速さに応じて、少し滑る
            b.mass = 6;                   // 離した直後は重くして、置いた場所にとどまりやすくする
            drag = null;
            wake();
            return;
        }
        drag = null;
    }

    members.forEach((el) => {
        el.addEventListener('pointerdown', (e) => {
            if (drag || pluck || resetting) return;
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

    /* ---- DNAをつまんで引っ張る（ゴムパチンコ） ----
            ・DNAの途中をつまんで引っ張ると、つまんだ点を通るように曲がってのびる（両端は写真につながったまま）
            ・引っ張った距離に応じて、弾性エネルギー ½·k·（のび）² がたまる
            ・離すと、DNAがすばやく元に戻って少し揺れ、たまったエネルギーが両端の写真の勢いになる
              （向きは、引っ張った向きの反対。おたがいへ向かう成分も少し混ぜる） */

    function mainPoint(cx, cy) {
        const mr = main.getBoundingClientRect();
        return { x: cx - mr.left, y: cy - mr.top };
    }

    function startPluck(pair, e) {
        if (drag || pluck || resetting) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const ca = photoCenter(pair.a);
        const cb = photoCenter(pair.b);
        const pt = mainPoint(e.clientX, e.clientY);
        const vx = cb.x - ca.x;
        const vy = cb.y - ca.y;
        // つまんだ位置が、見えているDNA（左の写真の縁〜右の写真の縁）の、どのあたりか。f: 0＝左（接続元）、0.5＝中央、1＝右（接続先）
        // 端に近すぎると接続点が外れるので、pluckGrabMin の割合だけ内側に制限する
        const dist = Math.hypot(vx, vy) || 1;
        const visible = Math.max(10, dist - ca.r - cb.r);
        const proj = ((pt.x - ca.x) * vx + (pt.y - ca.y) * vy) / dist;   // 左の写真の中心から、つまんだ位置までの距離
        const f = clamp((proj - ca.r) / visible, T.pluckGrabMin, 1 - T.pluckGrabMin);
        const u = (ca.r + f * visible) / dist;   // 中心どうしを結ぶ線上での割合。曲がる場所は、ここ
        pluck = {
            pair: pair, id: e.pointerId, type: e.pointerType,
            x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
            sx0: window.scrollX, sy0: window.scrollY,
            u: u, f: f, baseX: 0, baseY: 0, active: false, timer: 0
        };
        if (e.pointerType === 'touch') {
            pluck.timer = setTimeout(beginPluck, LONG_PRESS_MS);
        }
        if (e.pointerType !== 'touch') e.preventDefault();
    }

    let pluckTickId = 0;
    // つまんでいる間は、指を止めていても、色の変化と震えが続くように、毎フレーム描き直す
    function pluckTick() {
        if (pluckTickId) return;
        const loop = () => {
            if (pluck && pluck.active) {
                drawLinks();
                pluckTickId = requestAnimationFrame(loop);
            } else {
                pluckTickId = 0;
            }
        };
        pluckTickId = requestAnimationFrame(loop);
    }

    function beginPluck() {
        if (!pluck) return;
        const pair = pluck.pair;
        const prev = pair.pluck;   // 揺れている最中につままれたときは、いまの形から続ける
        const idleNow = idleDisp(pair, photoCenter(pair.a), photoCenter(pair.b)) || [0, 0];
        pair.idleW = 0;   // 待機のゆらぎは、引っ張りに引き継いだので、止める
        pair.pluck = {
            u: prev ? prev.u : pluck.u,
            f: prev ? prev.f : pluck.f,
            dx: prev ? prev.dx : pair.hov.dx + idleNow[0], dy: prev ? prev.dy : pair.hov.dy + idleNow[1],   // ホバー・待機で曲がっていたぶんから始める（跳ねない）
            vx: 0, vy: 0, held: true
        };
        // ホバーの曲がりは、引っ張りに引き継いだので、リセットする
        pair.hov.dx = 0; pair.hov.dy = 0; pair.hov.vx = 0; pair.hov.vy = 0; pair.hov.tx = 0; pair.hov.ty = 0; pair.hov.inside = false;
        pluck.u = pair.pluck.u;
        pluck.baseX = pair.pluck.dx;
        pluck.baseY = pair.pluck.dy;
        pluck.x0 = pluck.x;
        pluck.y0 = pluck.y;
        pluck.sx0 = window.scrollX;
        pluck.sy0 = window.scrollY;
        pluck.active = true;
        try { pair.hit.setPointerCapture(pluck.id); } catch (e) { /* 対応していなければ何もしない */ }
        pair.hit.style.cursor = 'grabbing';
        drawLinks();
        pluckTick();
    }

    function updatePluck() {
        const pk = pluck.pair.pluck;
        // ページがスクロールしても、ページ上の位置で計算する
        const rx = pluck.baseX + (pluck.x - pluck.x0) + (window.scrollX - pluck.sx0);
        const ry = pluck.baseY + (pluck.y - pluck.y0) + (window.scrollY - pluck.sy0);
        const len = Math.hypot(rx, ry);
        // 遠くへ引くほど、引きにくくなる（ゴムの手ごたえ）。最大でも pluckMax まで
        const eff = len > 0 ? T.pluckMax * (1 - Math.exp(-len / T.pluckMax)) : 0;
        pk.dx = len > 0 ? rx / len * eff : 0;
        pk.dy = len > 0 ? ry / len * eff : 0;
        drawLinks();
    }

    // 離したとき：たまった弾性エネルギーを、両端の写真の勢いに変える
    function launch(pair) {
        const pk = pair.pluck;
        const m = Math.hypot(pk.dx, pk.dy);
        if (m < 4) return;
        const A = pair.a;
        const B = pair.b;
        const ca = photoCenter(A);
        const cb = photoCenter(B);
        const gx = ca.x + (cb.x - ca.x) * pk.u + pk.dx;
        const gy = ca.y + (cb.y - ca.y) * pk.u + pk.dy;
        // いまのDNAの長さ（A→つまんだ点→B）が、自然長よりどれだけのびているか
        const arc = Math.hypot(gx - ca.x, gy - ca.y) + Math.hypot(cb.x - gx, cb.y - gy);
        const ext = Math.max(0, arc - pair.l0, T.pluckAlong * m);   // 引いた距離に応じたのび
        if (ext < 1) return;
        const energy = 0.5 * T.pluckK * ext * ext;
        const power = clamp(m / (T.pluckMax * T.pluckFullFrac), 0, 1);   // 引いた距離の割合
        const fx = -pk.dx / m;   // 引っ張った向きの、反対
        const fy = -pk.dy / m;
        // つかんだ位置による力の偏り：左をつかむと、左の写真（A）がやや強く、右をつかむと、右の写真（B）がやや強く。中央は同じ
        // f は、pluckGrabMin 〜 1 - pluckGrabMin の範囲。いちばん端（f = pluckGrabMin）で、ちょうど ±pluckBias になるよう、なめらかに（直線的に）変える。
        // 左右の重みは (1 + bias, 1 - bias) なので、合計は、つかむ位置に関係なく、いつも一定
        const bias = T.pluckBias * clamp((1 - 2 * pk.f) / (1 - 2 * T.pluckGrabMin), -1, 1);
        [[A, ca, cb, 1 + bias], [B, cb, ca, 1 - bias]].forEach((it) => {
            const b = body.get(it[0]);
            let ix = it[2].x - it[1].x;
            let iy = it[2].y - it[1].y;
            const il = Math.hypot(ix, iy) || 1;
            ix /= il;
            iy /= il;
            let dx = fx + ix * T.pluckInward;
            let dy = fy + iy * T.pluckInward;
            const dl = Math.hypot(dx, dy) || 1;
            dx /= dl;
            dy /= dl;
            // 速さ = √(2E / 質量) × 反発倍率。上限つき
            // 軽い引っ張りでは、これまでと同じ（ほぼ比例）。強く引くほど伸びて、上限 pluckMaxSpeed に、なめらかに近づく
            // さらに、引いた距離の割合（0〜1）の2乗に応じて増やす：軽い引っ張りはほぼ変わらず、強く引くほど速くなる
            // 発射速度の倍率：軽い引っ張りでは、ほぼ1。最大まで引くと、pluckLaunchScale 倍（power の pluckLaunchExp 乗で、なめらかに増える）
            const launchScale = 1 + (T.pluckLaunchScale - 1) * Math.pow(power, T.pluckLaunchExp);
            const raw = Math.sqrt(2 * energy / b.mass) * T.pluckGain * (1 + T.pluckBoost * power * power) * launchScale * it[3];
            const speed = T.pluckMaxSpeed * Math.tanh(raw / T.pluckMaxSpeed);
            b.vx += dx * speed;
            b.vy += dy * speed;
            b.glide = 1;   // 弾かれた直後は、すこし滑りやすくする
            if (!reduceMotion) hit(b, dx, dy, Math.min(1, speed / 1500) * 0.5);
        });
    }

    function finishPluck(release) {
        if (!pluck) return;
        clearTimeout(pluck.timer);
        const p = pluck;
        pluck = null;
        p.pair.hit.style.cursor = 'grab';
        wakeHover();   // 色が、ふだんの色へ戻るまで、描き直す
        if (!p.active) return;
        const pair = p.pair;
        pair.pluck.held = false;
        if (!release) {
            pair.pluck = null;
            pair.glow = 0;
            drawLinks();
            return;
        }
        launch(pair);
        pair.releasedAt = performance.now();
        wake();
    }

    window.addEventListener('pointermove', (e) => {
        if (!pluck || e.pointerId !== pluck.id) return;
        pluck.x = e.clientX;
        pluck.y = e.clientY;
        if (!pluck.active) {
            const moved = Math.hypot(pluck.x - pluck.x0, pluck.y - pluck.y0);
            if (pluck.type === 'touch') {
                if (moved > 8) finishPluck(false);   // 長押しの前に動いた＝スクロールのつもり
            } else if (moved > 3) {
                beginPluck();
            }
            return;
        }
        e.preventDefault();
        updatePluck();
    });
    window.addEventListener('pointerup', (e) => { if (pluck && e.pointerId === pluck.id) finishPluck(true); });
    window.addEventListener('pointercancel', (e) => { if (pluck && e.pointerId === pluck.id) finishPluck(false); });
    window.addEventListener('touchmove', (e) => {
        if (pluck && pluck.active) e.preventDefault();
    }, { passive: false });

    /* ---- ホバーアニメーション：カーソルを重ねると、ふわっと浮いて、カーソルの動きに柔らかく追従する ----
            ・見た目だけ。物理の位置・速さ・半径は、まったく変えない
            ・写真の画像(img)の、個別の変形プロパティ（translate・scale）を使う。
              スライム風の変形は transform を使っているので、おたがいに、競合しない
            ・マウスがある端末だけ。スマホなどのタッチ端末では、動かさない
            ・ドラッグ中・DNAをつまんでいる間は、ホバーの演出を止める（ずれは、バネで、なめらかに戻る） */
    const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let hoverRaf = 0;
    let hoverLast = 0;

    function hoverSuppressed() {
        return !!((drag && drag.active) || (pluck && pluck.active) || resetting);
    }

    function hoverApply(el, h) {
        const img = el.querySelector('img');
        if (Math.abs(h.x) < 0.01 && Math.abs(h.y) < 0.01 && Math.abs(h.s) < 0.0002 && !h.inside) {
            img.style.translate = '';
            img.style.scale = '';
            return;
        }
        img.style.translate = h.x.toFixed(2) + 'px ' + h.y.toFixed(2) + 'px';
        img.style.scale = (1 + h.s).toFixed(4);
    }

    function hoverTick(now) {
        const dt = Math.min(0.033, (now - hoverLast) / 1000) || 0.016;
        hoverLast = now;
        const off = hoverSuppressed();
        let active = false;
        members.forEach((el) => {
            const h = hover.get(el);
            const on = h.inside && !off;
            const tx = on ? h.tx : 0;
            const ty = on ? h.ty : 0;
            const ts = on ? h.ts : 0;
            // バネ：目標へ、少し遅れて追従する。離れると、ぷるんと揺れながら元に戻る
            h.vx += (-T.hoverK * (h.x - tx) - T.hoverC * h.vx) * dt;
            h.vy += (-T.hoverK * (h.y - ty) - T.hoverC * h.vy) * dt;
            h.vs += (-T.hoverK * (h.s - ts) - T.hoverC * h.vs) * dt;
            h.x += h.vx * dt;
            h.y += h.vy * dt;
            h.s += h.vs * dt;
            el.classList.toggle('is-hover', on);
            const moving = Math.abs(h.x - tx) > 0.02 || Math.abs(h.y - ty) > 0.02 || Math.abs(h.s - ts) > 0.0002 ||
                Math.abs(h.vx) > 0.05 || Math.abs(h.vy) > 0.05 || Math.abs(h.vs) > 0.002;
            if (!moving && !on) { h.x = 0; h.y = 0; h.s = 0; h.vx = 0; h.vy = 0; h.vs = 0; }
            hoverApply(el, h);
            if (moving || on) active = true;
        });
        // DNAのホバー：バネで、少し遅れて追従し、離すと、ぷるんと戻る。つかんでいる間・ドラッグ中は、止める
        let dnaMoving = false;
        pairs.forEach((pair) => {
            const v = pair.hov;
            const on = v.inside && !off && !pair.pluck;
            const tx = on ? v.tx : 0;
            const ty = on ? v.ty : 0;
            v.vx += (-T.dnaHoverK * (v.dx - tx) - T.dnaHoverC * v.vx) * dt;
            v.vy += (-T.dnaHoverK * (v.dy - ty) - T.dnaHoverC * v.vy) * dt;
            v.dx += v.vx * dt;
            v.dy += v.vy * dt;
            const moving = Math.abs(v.dx - tx) > 0.03 || Math.abs(v.dy - ty) > 0.03 || Math.abs(v.vx) > 0.1 || Math.abs(v.vy) > 0.1;
            if (!moving && !on) { v.dx = 0; v.dy = 0; v.vx = 0; v.vy = 0; }
            if (moving || on || pair.glow > 0.02 || pair.hovG > 0.005 || pair.bul.w > 0.003 || Math.abs(pair.bul.v) > 0.05) dnaMoving = true;
        });
        if (dnaMoving) { drawLinks(); active = true; }
        hoverRaf = active ? requestAnimationFrame(hoverTick) : 0;
    }

    // DNAにカーソルが重なったとき、重なった付近が、カーソルの方向（DNAに直角な向き）へ、わずかに曲がるよう、目標を決める
    function dnaHoverAim(pair, e) {
        const v = pair.hov;
        v.inside = true;
        if (pair.pluck) { wakeHover(); return; }   // つかんでいる間（と、離したあとの揺れ）は、ホバーの曲がりを使わない
        const ca = photoCenter(pair.a);
        const cb = photoCenter(pair.b);
        const pt = mainPoint(e.clientX, e.clientY);
        const vx = cb.x - ca.x;
        const vy = cb.y - ca.y;
        const dist = Math.hypot(vx, vy) || 1;
        const visible = Math.max(10, dist - ca.r - cb.r);
        const proj = ((pt.x - ca.x) * vx + (pt.y - ca.y) * vy) / dist;
        const f = clamp((proj - ca.r) / visible, T.pluckGrabMin, 1 - T.pluckGrabMin);
        const u = (ca.r + f * visible) / dist;
        // DNAに直角な向き（法線）と、カーソルが、DNAの線からどれだけはなれているか
        const nx = -vy / dist;
        const ny = vx / dist;
        const off = (pt.x - (ca.x + vx * u)) * nx + (pt.y - (ca.y + vy * u)) * ny;
        const amt = clamp(off * 0.5, -T.dnaHoverMax, T.dnaHoverMax);   // カーソルがDNAの線から20pxはなれていれば、約10px
        v.u = u;
        v.tx = nx * amt;
        v.ty = ny * amt;
        wakeHover();
    }

    function wakeHover() {
        if (hoverRaf) return;
        hoverLast = performance.now();
        hoverRaf = requestAnimationFrame(hoverTick);
    }

    // カーソルの位置から、追従の目標を決める。
    // ほかの写真に近いときは、拡大と、その向きへの追従を、重ならない範囲に制限する。壁際では、領域の外へ出ない範囲に制限する
    function hoverAim(el, e) {
        const h = hover.get(el);
        const img = el.querySelector('img');
        const r = img.getBoundingClientRect();
        const Ri = img.offsetWidth / 2;
        // ホバーで動いているぶんを引いて、「本来の中心」を求める（目標が、自分の動きに引っ張られないように）
        const bi = body.get(el);
        const cx = r.left + r.width / 2 - h.x - bi.idleTx;
        const cy = r.top + r.height / 2 - h.y - bi.idleTy;
        let vx = (e.clientX - cx) / Ri;
        let vy = (e.clientY - cy) / Ri;
        const len = Math.hypot(vx, vy);
        if (len > 1) { vx /= len; vy /= len; }
        let tx = vx * T.hoverMove;
        let ty = vy * T.hoverMove;
        const margin = 2;   // ほかの写真・壁との、最低限のすきま(px)
        const hi = homes.get(el);
        const oi = offsets.get(el);
        const ci = [hi.x + oi.x, hi.y + oi.y];   // 物理上の中心（ホバーのずれを含まない）

        // 1) ほかの写真に重ならないよう、拡大を小さくする
        let ts = T.hoverScale;
        const near = [];
        members.forEach((other) => {
            if (other === el) return;
            const ho = homes.get(other);
            const oo = offsets.get(other);
            const dx = ho.x + oo.x - ci[0];
            const dy = ho.y + oo.y - ci[1];
            const d = Math.hypot(dx, dy);
            const Rj = radii.get(other);
            if (d > Ri * (1 + T.hoverScale) + Rj + T.hoverMove + 10) return;   // 遠い写真は、関係ない
            near.push([dx / d, dy / d, d, Rj]);
            ts = Math.min(ts, Math.max(0, (d - Rj - margin) / Ri - 1));
        });

        // 2) 壁際：拡大ぶんも含めて、領域の外へ出ないようにする
        const bd = getBounds().get(el);
        const m = margin + Ri * ts;
        tx = clamp(tx, -Math.max(0, oi.x - bd.minX - m), Math.max(0, bd.maxX - oi.x - m));
        ty = clamp(ty, -Math.max(0, oi.y - bd.minY - m), Math.max(0, bd.maxY - oi.y - m));

        // 3) ほかの写真の方向への追従は、重ならない（すきま margin が残る）範囲までに制限する
        near.forEach((q) => {
            const slack = Math.max(0, q[2] - Ri * (1 + ts) - q[3] - margin);   // その写真の方向へ、動ける余裕
            const proj = tx * q[0] + ty * q[1];
            if (proj > slack) { tx -= (proj - slack) * q[0]; ty -= (proj - slack) * q[1]; }
        });
        h.tx = tx;
        h.ty = ty;
        h.ts = ts;
    }

    if (hoverCapable) {
        members.forEach((el) => {
            const img = el.querySelector('img');
            const h = hover.get(el);
            const enter = (e) => {
                if (e.pointerType !== 'mouse') return;
                h.inside = true;
                if (reduceMotion) {
                    // 簡略化：少し拡大して、影をつけるだけ（追従・バネは、なし）
                    if (!hoverSuppressed()) { el.classList.add('is-hover'); img.style.scale = String(1 + T.hoverScale); }
                    return;
                }
                hoverAim(el, e);
                wakeHover();
            };
            img.addEventListener('pointerenter', enter);
            img.addEventListener('pointermove', (e) => {
                if (e.pointerType !== 'mouse') return;
                if (!h.inside) h.inside = true;
                if (reduceMotion) return;
                hoverAim(el, e);
                wakeHover();
            });
            img.addEventListener('pointerleave', (e) => {
                if (e.pointerType !== 'mouse') return;
                h.inside = false;
                if (reduceMotion) { el.classList.remove('is-hover'); img.style.scale = ''; return; }
                wakeHover();
            });
        });
        // ドラッグやDNA操作を終えたとき、カーソルが写真の上にあれば、ホバーを再開する
        window.addEventListener('pointerup', (e) => {
            if (e.pointerType !== 'mouse') return;
            const under = document.elementFromPoint(e.clientX, e.clientY);
            members.forEach((el) => {
                const h = hover.get(el);
                h.inside = under === el.querySelector('img');
                if (h.inside && !reduceMotion) hoverAim(el, e);
            });
            if (reduceMotion) {
                members.forEach((el) => {
                    const on = hover.get(el).inside;
                    el.classList.toggle('is-hover', on);
                    el.querySelector('img').style.scale = on ? String(1 + T.hoverScale) : '';
                });
            } else {
                wakeHover();
            }
        });
        // ドラッグやDNA操作を始めたときは、ホバーの演出を止める（バネで、なめらかに戻る）
        window.addEventListener('pointerdown', () => { if (!reduceMotion) wakeHover(); });
    }

    /* ---- 待機アニメーション：操作していないときにも、写真とDNAが、ほんの少し、ゆらゆら動く ----
            ・写真：スライムのように、ゆっくり伸び縮みする（変形量 約1〜2%、周期 3〜5秒。写真ごとに、周期と位相をずらす）。中心は、動かさない
            ・DNA：中央付近が、2〜4pxほど、ゆっくり揺れる（両端は、写真の接続位置に固定。写真ごとに、揺れのタイミングを変える）
            ・見た目だけ。物理の位置・速さには、触れない。写真に力も、加えない
            ・ホバー・ドラッグ・DNAをつまむ・衝突・発射・マスコットでの復元のあいだは、重みを0へ、なめらかに下げる。
              それらが収まってから、少し待って、なめらかに戻す
            ・画面の外にある写真・DNAは、更新しない。ページが隠れている間・prefers-reduced-motion のときは、止める */
    const visibleMembers = new Set();
    let idleRaf = 0;
    let idleLast = 0;
    let idleDnaLast = 0;
    let idleDnaDrawn = false;
    let lastSimAt = 0;

    function idleSuppressed() {
        return !!((drag && drag.active) || (pluck && pluck.active) || resetting);
    }

    // 待機中の、写真の見た目の変形：[横の倍率, 縦の倍率, 横のずれ(px), 縦のずれ(px)]。
    // 重みがほぼ0で、ぷるんも収まっているときは null。少し不規則に見えるよう、周期のちがう2つの波を足す
    function idleVals(b, now, limit) {
        if (b.idleW < 0.001 && Math.abs(b.pu) < 0.001 && Math.abs(b.puv) < 0.01) return null;
        const t = now / 1000;
        const w = b.idleW * limit;   // limit：ほかの写真・壁に近いときは、控えめにする（0〜1）
        const P = b.idlePeriod;
        const ph = b.idlePhase;
        const wave = (k, off) => 0.7 * Math.sin(t * Math.PI * 2 / (P * k) + ph * k + off)
            + 0.3 * Math.sin(t * Math.PI * 2 / (P * k * 1.73) + ph * 2.1 + off + 1);
        const a = T.idleScale * w;
        return [
            1 + a * wave(1, 0) + b.pu * limit,
            1 + a * 0.8 * wave(1.31, 1.1) - b.pu * 0.8 * limit,
            T.idlePos * w * wave(1.17, 2.3) + b.pu * 20 * limit,
            T.idlePos * w * wave(0.89, 4.1) - b.pu * 40 * limit
        ];
    }

    // 写真が、ほかの写真・壁に近いほど、待機の動きを小さくする（重ならない・はみ出さない）。1なら、そのまま
    function idleLimit(el, bounds) {
        const R = radii.get(el);
        const o = offsets.get(el);
        const h = homes.get(el);
        const cx = h.x + o.x;
        const cy = h.y + o.y;
        let gap = 1e9;
        members.forEach((other) => {
            if (other === el) return;
            const ho = homes.get(other);
            const oo = offsets.get(other);
            gap = Math.min(gap, Math.hypot(ho.x + oo.x - cx, ho.y + oo.y - cy) - R - radii.get(other));
        });
        // 伸び縮み・ぷるん・ずれに、必要な余裕（px）
        const need = R * (T.idleScale + 0.07) + T.idlePos + 2;
        const allowNeighbor = Math.max(0, (gap - 2) / 2);   // おたがいにふくらむので、半分ずつ
        const bd = bounds.get(el);
        const slack = Math.min(o.x - bd.minX, bd.maxX - o.x, o.y - bd.minY, bd.maxY - o.y);
        return Math.min(1, allowNeighbor / need, Math.max(0, slack - 2) / need);
    }

    // DNAの、待機中の、中央付近のゆらぎ（DNAに直角な向きの、ずれ）。柔らかいゴム紐のように、少し不規則に揺れる。重みがほぼ0なら null
    function idleDisp(pair, ca, cb) {
        if (pair.idleW < 0.001) return null;
        const vx = cb.x - ca.x;
        const vy = cb.y - ca.y;
        const len = Math.hypot(vx, vy) || 1;
        const t = performance.now() / 1000;
        const P = pair.idlePeriod;
        const s = 0.7 * Math.sin(t * Math.PI * 2 / P + pair.idlePhase) + 0.3 * Math.sin(t * Math.PI * 2 / (P * 1.61) + pair.idlePhase * 2.3 + 1);
        const a = T.idleDnaAmp * pair.idleW * s;
        return [-vy / len * a, vx / len * a];
    }

    function idleTick(now) {
        idleRaf = 0;
        if (reduceMotion || document.hidden || visibleMembers.size === 0) return;   // 止める（見えたら、また、始める）
        const dt = Math.min(0.1, (now - idleLast) / 1000) || 0.016;
        idleLast = now;
        // 物理・ホバー・ドラッグなどが収まって、少したってから、待機に入る
        const quiet = !idleSuppressed() && !simId && (now - lastSimAt > T.idleQuietMs);
        const bounds = getBounds();
        members.forEach((el) => {
            if (!visibleMembers.has(el)) return;
            const b = body.get(el);
            const on = quiet && !hover.get(el).inside;
            const tau = on ? T.idleTauIn : T.idleTauOut;
            b.idleW += ((on ? 1 : 0) - b.idleW) * (1 - Math.exp(-dt / tau));
            if (b.idleW < 0.002 && !on) b.idleW = 0;
            // ときどき、少し大きく「ぷるん」：バネで、自然に収まる。待機に入っている間だけ、きっかけを与える
            b.puv += (-T.idlePulseK * b.pu - T.idlePulseC * b.puv) * dt;
            b.pu += b.puv * dt;
            if (now >= b.nextPulse) {
                if (on && b.idleW > 0.8) b.puv += (Math.random() < 0.5 ? -1 : 1) * T.idlePulseKick;
                b.nextPulse = now + (T.idlePulseMin + Math.random() * (T.idlePulseMax - T.idlePulseMin)) * 1000;
            }
            const vals = idleVals(b, now, idleLimit(el, bounds));
            b.idleV = vals;
            b.idleTx = vals ? vals[2] : 0;   // 見た目のずれ。DNAの接続位置・ホバーの計算からは、引いて考える
            b.idleTy = vals ? vals[3] : 0;
            if (!vals) { b.pu = 0; b.puv = 0; }
            if (!simId) {
                // 物理の計算が止まっている間だけ、ここで、変形を書く（動いている間は、step が、同じ値を含めて書く）
                el.querySelector('img').style.transform = vals
                    ? 'translate(' + vals[2].toFixed(2) + 'px, ' + vals[3].toFixed(2) + 'px) scale(' + vals[0].toFixed(4) + ', ' + vals[1].toFixed(4) + ')'
                    : '';
            }
        });
        let anyDna = false;
        pairs.forEach((pair) => {
            const hv = pair.hov;
            const on = quiet && !hv.inside && !pair.pluck && Math.abs(hv.dx) + Math.abs(hv.dy) < 0.5 && pair.glow < 0.02 && pair.hovG < 0.02 && pair.bul.w < 0.01;
            const tau = on ? T.idleTauIn : T.idleTauOut;
            pair.idleW += ((on ? 1 : 0) - pair.idleW) * (1 - Math.exp(-dt / tau));
            if (pair.idleW < 0.002 && !on) pair.idleW = 0;
            if (pair.idleW > 0) anyDna = true;
        });
        // DNAの描き直しは、軽くするため、毎秒 idleDnaFps 回まで。動いているときの物理の描画とは、別
        if ((anyDna || idleDnaDrawn) && !simId && now - idleDnaLast > 1000 / T.idleDnaFps) {
            idleDnaLast = now;
            drawLinks();
            idleDnaDrawn = anyDna;
        }
        idleRaf = requestAnimationFrame(idleTick);
    }

    function wakeIdle() {
        if (idleRaf || reduceMotion || document.hidden || visibleMembers.size === 0) return;
        idleLast = performance.now();
        idleRaf = requestAnimationFrame(idleTick);
    }

    if (!reduceMotion) {
        // 最初に見えている写真を、すぐに調べる。そのあとは、見え方が変わるたびに、IntersectionObserver で更新する
        const vh = window.innerHeight;
        members.forEach((el) => {
            const q = el.getBoundingClientRect();
            if (q.bottom > -100 && q.top < vh + 100) visibleMembers.add(el);
        });
        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((en) => { if (en.isIntersecting) visibleMembers.add(en.target); else visibleMembers.delete(en.target); });
                wakeIdle();
            }, { rootMargin: '100px' });
            members.forEach((el) => io.observe(el));
        }
        document.addEventListener('visibilitychange', wakeIdle);
        wakeIdle();
    }

    /* ---- 元の並びに戻す ---- */
    function resetLayout() {
        finish();
        finishPluck(false);
        pairs.forEach((p) => { p.pluck = null; p.glow = 0; p.hovG = 0; p.bul.w = 0; p.bul.v = 0; });
        stopSim();               // 物理をいったん止める（速さもゼロにする）
        resetting = true;
        clearTimeout(resetTimer);
        members.forEach((el) => {
            const o = offsets.get(el);
            if (!o.x && !o.y) return;
            o.x = 0;
            o.y = 0;
            if (reduceMotion) {
                el.style.transform = '';
                el.style.zIndex = '';
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
        // 並び終わったら、速さをゼロにして、物理を再開できる状態にする
        resetTimer = setTimeout(() => {
            resetting = false;
            stopSim();
            drawLinks();
        }, reduceMotion ? 0 : 900);
    }

    if (resetBtn) resetBtn.addEventListener('click', resetLayout);

    // 画面の幅が変わると並びも変わるので、そのときは位置をリセットする
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
        if (window.innerWidth === lastWidth) return;
        lastWidth = window.innerWidth;
        finish();
        finishPluck(false);
        stopSim();
        clearTimeout(resetTimer);
        resetting = false;
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
