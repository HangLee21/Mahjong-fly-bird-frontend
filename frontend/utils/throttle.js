"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.throttle = throttle;
function throttle(fn, wait) {
    let last = 0;
    return function throttled(...args) {
        const now = Date.now();
        if (now - last >= wait) {
            last = now;
            fn.apply(this, args);
        }
    };
}
