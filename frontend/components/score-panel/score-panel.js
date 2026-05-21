"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const format_1 = require("../../utils/format");
Component({
    properties: {
        result: { type: Object },
    },
    methods: {
        formatScore: format_1.formatScore,
    },
});
