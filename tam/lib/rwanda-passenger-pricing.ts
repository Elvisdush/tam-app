import { RWANDA_DESTINATIONS, type RwandaDestination } from '@/constants/rwanda-destinations';
import { isKigaliDestination } from '@/constants/kigali-destinations';

/** Taxi car — Kigali City area */
export const MIN_PRICE_CAR_KIGALI_RWF = 6_000;
/** Taxi car — outside Kigali (other districts / cities) */
export const MIN_PRICE_CAR_OUTSIDE_KIGALI_RWF = 20_000;
/** Taxi moto — Kigali City area */
export const MIN_PRICE_MOTO_KIGALI_RWF = 700;
/** Taxi moto — outside Kigali (other districts / cities) */
export const MIN_PRICE_MOTO_OUTSIDE_KIGALI_RWF = 5_000;

export function destinationsForTransport(
  _transportType: 'car' | 'motorbike',
  all: RwandaDestination[] = RWANDA_DESTINATIONS
): RwandaDestination[] {
  return [...all];
}

export function minPriceRwfForDestination(
  transportType: 'car' | 'motorbike',
  destinationId: string | null | undefined
): number | null {
  if (!destinationId) return null;
  if (transportType === 'motorbike') {
    return isKigaliDestination(destinationId)
      ? MIN_PRICE_MOTO_KIGALI_RWF
      : MIN_PRICE_MOTO_OUTSIDE_KIGALI_RWF;
  }
  return isKigaliDestination(destinationId)
    ? MIN_PRICE_CAR_KIGALI_RWF
    : MIN_PRICE_CAR_OUTSIDE_KIGALI_RWF;
}

export function filterDestinationsByQuery(
  list: RwandaDestination[],
  query: string
): RwandaDestination[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((d) => {
    const hay = `${d.name} ${d.subtitle} ${d.search}`.toLowerCase();
    return hay.includes(q);
  });
}
