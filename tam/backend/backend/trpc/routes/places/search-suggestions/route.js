"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const server_1 = require("@trpc/server");
const create_context_1 = require("../../../create-context");
const places_search_1 = require("../../../../../frontend/lib/places-search");
function getGoogleMapsApiKey() {
    return (process.env.GOOGLE_MAPS_API_KEY ??
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
        '');
}
exports.default = create_context_1.publicProcedure
    .input(zod_1.z.object({
    query: zod_1.z.string().min(3).max(200),
    userLat: zod_1.z.number(),
    userLng: zod_1.z.number(),
}))
    .mutation(async ({ input }) => {
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
        throw new server_1.TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Places search is not configured (missing GOOGLE_MAPS_API_KEY).',
        });
    }
    try {
        return await (0, places_search_1.searchPlacesSuggestions)({
            query: input.query,
            userLat: input.userLat,
            userLng: input.userLng,
            apiKey,
        });
    }
    catch (e) {
        console.error('places.searchSuggestions', e);
        throw new server_1.TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Could not load place suggestions.',
        });
    }
});
