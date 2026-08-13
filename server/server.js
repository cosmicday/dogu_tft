'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const config = require('./config');
const { BASE_PATH, PUBLIC_DIR, BUILD_ID, IS_DEV } = config;
const { connectMongo } = require('./db');
const { startStaticJobs } = require('./tftdata');
const { router: apiRouter, startRiotJobs } = require('./api');

const app = express();
app.disable('x-powered-by');
app.set('etag', 'strong');
app.set('trust proxy', 1);   // Railway/Cloudflare 프록시 뒤에서 동작

// ============================================================
// [1] 공통 보안 헤더
// ============================================================
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// ============================================================
// [2] 앱 셸(index.html) 렌더링 — dogu_template 그대로
// ============================================================
const SHELL_FILE = path.join(PUBLIC_DIR, 'index.html');
let shellCache = null;

function renderAppShell() {
    if (shellCache && !IS_DEV) return shellCache;

    const clientConfig = {
        basePath: BASE_PATH,
        buildId: BUILD_ID,
        siteName: config.SITE_NAME,
        siteUrl: config.SITE_URL,
        contactEmail: config.CONTACT_EMAIL,
        hideUnfinishedPages: config.HIDE_UNFINISHED_PAGES,
        storagePrefix: config.STORAGE_PREFIX
    };

    const configJson = JSON.stringify(clientConfig)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e');

    const html = fs.readFileSync(SHELL_FILE, 'utf8')
        .split('%APP_CONFIG%').join(configJson)
        .split('%BASE%').join(BASE_PATH)
        .split('%V%').join(encodeURIComponent(BUILD_ID))
        .split('%SITE_NAME%').join(config.SITE_NAME)
        .split('%SITE_URL%').join(config.SITE_URL)
        .split('%SITE_ORIGIN%').join(config.SITE_ORIGIN)
        .split('%CONTACT_EMAIL%').join(config.CONTACT_EMAIL);

    shellCache = html;
    return html;
}

function sendAppShell(req, res) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.type('html').send(renderAppShell());
}

// ============================================================
// [3] BASE_PATH 하위 라우터
// ============================================================
const router = express.Router();

router.get('/healthz', (req, res) => {
    res.json({ ok: true, basePath: BASE_PATH || '/', buildId: BUILD_ID, uptime: process.uptime() });
});

router.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(
        'User-agent: *\n' +
        'Allow: ' + (BASE_PATH || '') + '/\n' +
        'Sitemap: ' + config.SITE_URL + '/sitemap.xml\n'
    );
});

router.get('/sitemap.xml', (req, res) => {
    const paths = ['/', '/ranking', '/stats', '/terms', '/privacy'];
    const urls = paths
        .map(p => '  <url><loc>' + config.SITE_URL + (p === '/' ? '/' : p) + '</loc></url>')
        .join('\n');
    res.type('application/xml').send(
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n'
    );
});

// TFT 서비스 API
router.use('/api', apiRouter);

router.get(['/', '/index.html'], sendAppShell);

router.use(express.static(PUBLIC_DIR, {
    index: false,
    setHeaders(res) {
        const versioned = res.req && res.req.query && res.req.query.v;
        res.setHeader('Cache-Control', versioned
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=300');
    }
}));

// SPA 폴백
router.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (path.extname(req.path)) {
        return res.status(404).type('text/plain').send('Not Found');
    }
    sendAppShell(req, res);
});

app.use(BASE_PATH || '/', router);

// ============================================================
// [4] BASE_PATH 바깥으로 들어온 요청
// ============================================================
if (BASE_PATH) {
    app.get('/', (req, res) => res.redirect(302, BASE_PATH + '/'));
    app.use((req, res) => res.status(404).type('text/plain').send('Not Found'));
}

// ============================================================
// [5] 부트스트랩
//   Mongo는 선택 사항 — 연결 실패해도 서버는 뜬다.
//   정적 데이터(CDragon)와 랭킹 갱신은 백그라운드로 돈다.
// ============================================================
async function bootstrap() {
    await connectMongo();

    app.listen(config.PORT, config.HOST, () => {
        console.log('[' + config.SITE_NAME + '] listening on http://' + config.HOST + ':' + config.PORT + (BASE_PATH || '') + '/');
        console.log('  BASE_PATH : ' + (BASE_PATH || '(root)'));
        console.log('  BUILD_ID  : ' + BUILD_ID);
        console.log('  SITE_URL  : ' + config.SITE_URL);
    });

    // 리슨을 막지 않도록 뒤에서 기동한다
    startStaticJobs().then(() => startRiotJobs())
        .catch(err => console.error('[System] 백그라운드 작업 기동 실패:', err.message));
}

bootstrap();

module.exports = app;
