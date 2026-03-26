import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import placesSearchSuggestions from "./routes/places/search-suggestions/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  places: createTRPCRouter({
    searchSuggestions: placesSearchSuggestions,
  }),
});

export type AppRouter = typeof appRouter;
