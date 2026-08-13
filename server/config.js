'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

// ------------------------------------------------------------
// .env 로더
//   dotenv 의존성을 두지 않으려고 최소 파서만 넣었다.
//   이미 프로세스에 있는 값(플랫폼 주입 환경변수)이 항상 우선한다.
// ------------------------------------------------------------
function loadEnvFile(file) {
    if (!fs.existsSync(file)) return;
    for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        if (!key || key in process.env) continue;
        let value = line.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
}

loadEnvFile(path.join(ROOT_DIR, '.env'));

// ------------------------------------------------------------
// BASE_PATH 정규화
//   허용 입력 : '', '/', 'app', '/app', '/app/'
//   결과      : '' 또는 '/app'   (앞 슬래시 있음, 뒤 슬래시 없음)
//   루트 서빙일 때 ''를 쓰는 이유는 BASE_PATH + '/foo' 가 그대로
//   '/foo' 가 되어 문자열 결합만으로 URL이 완성되기 때문이다.
// ------------------------------------------------------------
function normalizeBasePath(raw) {
    let value = String(raw == null ? '' : raw).trim();
    if (!value || value === '/') return '';
    if (!value.startsWith('/')) value = '/' + value;
    value = value.replace(/\/+$/, '');
    return value === '/' ? '' : value;
}

function normalizeOrigin(raw) {
    return String(raw == null ? '' : raw).trim().replace(/\/+$/, '');
}

function bool(raw, fallback) {
    if (raw == null || raw === '') return fallback;
    return /^(1|true|yes|on)$/i.test(String(raw).trim());
}

const BASE_PATH = normalizeBasePath(process.env.BASE_PATH);
const SITE_ORIGIN = normalizeOrigin(process.env.SITE_ORIGIN || 'http://localhost:' + (process.env.PORT || 3000));

module.exports = {
    ROOT_DIR,
    PUBLIC_DIR: path.join(ROOT_DIR, 'public'),

    PORT: Number(process.env.PORT || 3000),
    HOST: process.env.HOST || '0.0.0.0',
    IS_DEV: (process.env.NODE_ENV || 'development') !== 'production',

    BASE_PATH,
    SITE_ORIGIN,
    // 캐노니컬/OG/sitemap용 절대 주소. BASE_PATH가 비면 뒤에 '/'를 붙여 준다.
    SITE_URL: SITE_ORIGIN + (BASE_PATH || ''),

    SITE_NAME: process.env.SITE_NAME || 'dogu',
    CONTACT_EMAIL: process.env.CONTACT_EMAIL || 'hello@example.com',

    BUILD_ID: process.env.BUILD_ID || String(Date.now()),
    // localStorage 키 접두사. 비워두면 클라이언트가 BASE_PATH에서 유도한다.
    STORAGE_PREFIX: process.env.STORAGE_PREFIX || '',
    HIDE_UNFINISHED_PAGES: bool(process.env.HIDE_UNFINISHED_PAGES, true),

    normalizeBasePath
};
