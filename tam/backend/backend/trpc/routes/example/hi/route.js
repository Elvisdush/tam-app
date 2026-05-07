"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const create_context_1 = require("../../../create-context");
exports.default = create_context_1.publicProcedure
    .input(zod_1.z.object({ name: zod_1.z.string() }))
    .mutation(({ input }) => {
    return {
        hello: input.name,
        date: new Date(),
    };
});
