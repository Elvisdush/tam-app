"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appRouter = void 0;
const create_context_1 = require("./create-context");
const route_1 = require("./routes/example/hi/route");
const route_2 = require("./routes/places/search-suggestions/route");
exports.appRouter = (0, create_context_1.createTRPCRouter)({
    example: (0, create_context_1.createTRPCRouter)({
        hi: route_1.default,
    }),
    places: (0, create_context_1.createTRPCRouter)({
        searchSuggestions: route_2.default,
    }),
});
