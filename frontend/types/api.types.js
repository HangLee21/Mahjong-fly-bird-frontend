"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
class ApiError extends Error {
    constructor(code, message, statusCode) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
    }
}
exports.ApiError = ApiError;
