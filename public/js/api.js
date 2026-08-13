/* ============================================================
   api.js — fetch 래퍼

   · 경로는 항상 App.api()를 통과하므로 BASE_PATH가 자동으로 붙는다.
   · 타임아웃(AbortController), JSON 파싱, 에러 정규화를 한곳에서 처리.
   · 429를 받으면 잠금 시각을 기록해 그 사이의 호출을 조기 차단한다.
     (백엔드 레이트리밋에 클라이언트가 계속 부딪히는 것을 막는 패턴)
   ============================================================ */
(function (App) {
    'use strict';

    var rateLimitUnlockAt = 0;

    function ApiError(message, status, payload) {
        var err = new Error(message);
        err.name = 'ApiError';
        err.status = status || 0;
        err.payload = payload || null;
        return err;
    }

    function isRateLimited() {
        return Date.now() < rateLimitUnlockAt;
    }

    function request(path, options) {
        var opts = options || {};
        var timeout = opts.timeout == null ? 10000 : opts.timeout;

        if (isRateLimited()) {
            var wait = Math.ceil((rateLimitUnlockAt - Date.now()) / 1000);
            return Promise.reject(ApiError('요청이 많아 잠시 제한되었습니다. ' + wait + '초 후 다시 시도해 주세요.', 429));
        }

        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, timeout);

        var init = {
            method: opts.method || 'GET',
            headers: Object.assign({ 'Accept': 'application/json' }, opts.headers || {}),
            signal: controller.signal
        };
        if (opts.body !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(opts.body);
        }

        return fetch(App.api(path), init).then(function (res) {
            clearTimeout(timer);

            if (res.status === 429) {
                var retryAfter = Number(res.headers.get('Retry-After')) || 30;
                rateLimitUnlockAt = Date.now() + retryAfter * 1000;
                throw ApiError('요청이 많아 잠시 제한되었습니다. ' + retryAfter + '초 후 다시 시도해 주세요.', 429);
            }

            return res.text().then(function (text) {
                var data = null;
                if (text) {
                    try { data = JSON.parse(text); } catch (e) { data = text; }
                }
                if (!res.ok) {
                    var message = (data && data.message) || ('요청에 실패했습니다. (' + res.status + ')');
                    throw ApiError(message, res.status, data);
                }
                return data;
            });
        }, function (err) {
            clearTimeout(timer);
            if (err && err.name === 'AbortError') {
                throw ApiError('응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.', 0);
            }
            throw ApiError('네트워크에 연결할 수 없습니다.', 0);
        });
    }

    App.request = request;
    App.api.get = function (path, options) {
        return request(path, Object.assign({}, options, { method: 'GET' }));
    };
    App.api.post = function (path, body, options) {
        return request(path, Object.assign({}, options, { method: 'POST', body: body }));
    };
    App.api.isRateLimited = isRateLimited;
})(window.App);
