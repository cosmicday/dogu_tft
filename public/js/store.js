/* ============================================================
   store.js — localStorage 래퍼

   · 키 접두사는 BASE_PATH에서 유도한다.
       BASE_PATH ''      → 접두사 없음   : 'favorites', 'recent'
       BASE_PATH '/app'  → 'app:'        : 'app:favorites', 'app:recent'
     localStorage는 경로가 아니라 오리진 단위로 공유되므로, 한 도메인의
     여러 하위 경로에 앱을 나눠 올리면 접두사가 없을 때 서로 덮어쓴다.
     명시적으로 고정하고 싶으면 서버에 STORAGE_PREFIX 환경변수를 준다.
   · createList()는 "최근 N개 유지" 목록(즐겨찾기·최근기록)을 위한 것.
   · 사파리 프라이빗 모드처럼 저장이 막힌 환경에서도 앱이 죽지 않도록
     모든 접근을 try/catch로 감싼다.
   ============================================================ */
(function (App) {
    'use strict';

    function derivePrefix() {
        var explicit = App.config.storagePrefix;
        if (explicit) return String(explicit).replace(/:+$/, '') + ':';
        if (!App.BASE_PATH) return '';
        return App.BASE_PATH.replace(/^\//, '').replace(/\//g, '_') + ':';
    }

    var PREFIX = derivePrefix();

    function key(name) {
        return PREFIX + name;
    }

    function read(name, fallback) {
        try {
            var raw = localStorage.getItem(key(name));
            if (raw == null) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    }

    function write(name, value) {
        try {
            localStorage.setItem(key(name), JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    }

    function remove(name) {
        try {
            localStorage.removeItem(key(name));
        } catch (e) { /* 무시 */ }
    }

    // 중복 없는 최신순 목록. identify()로 항목의 동일성을 판단한다.
    function createList(name, options) {
        var opts = options || {};
        var max = opts.max || 10;
        var identify = opts.identify || function (item) {
            return typeof item === 'string' ? item : JSON.stringify(item);
        };

        function all() {
            var list = read(name, []);
            return Array.isArray(list) ? list : [];
        }

        return {
            all: all,
            has: function (item) {
                var id = identify(item);
                return all().some(function (x) { return identify(x) === id; });
            },
            add: function (item) {
                var id = identify(item);
                var list = all().filter(function (x) { return identify(x) !== id; });
                list.unshift(item);
                if (list.length > max) list.length = max;
                write(name, list);
                return list;
            },
            remove: function (item) {
                var id = identify(item);
                var list = all().filter(function (x) { return identify(x) !== id; });
                write(name, list);
                return list;
            },
            toggle: function (item) {
                return this.has(item) ? this.remove(item) : this.add(item);
            },
            clear: function () {
                remove(name);
                return [];
            }
        };
    }

    App.storage = {
        prefix: PREFIX,
        read: read,
        write: write,
        remove: remove,
        createList: createList
    };
})(window.App);
