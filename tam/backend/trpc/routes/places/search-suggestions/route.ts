import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure } from '../../../create-context';
import { searchPlacesSuggestions } from '@/lib/places-search';

function getGoogleMapsApiKey(): string {
  return (
    process.env.GOOGLE_MAPS_API_KEY ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    ''
  );
}

export default publicProcedure
  .input(
    z.object({
      query: z.string().min(3).max(200),
      userLat: z.number(),
      userLng: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Places search is not configured (missing GOOGLE_MAPS_API_KEY).',
      });
    }
    try {
      return await searchPlacesSuggestions({
        query: input.query,
        userLat: input.userLat,
        userLng: input.userLng,
        apiKey,
      });
    } catch (e) {
      console.error('places.searchSuggestions', e);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not load place suggestions.',
      });
    }
  });
