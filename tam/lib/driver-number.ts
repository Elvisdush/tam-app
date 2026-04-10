import { ref, runTransaction, set } from 'firebase/database';
import { database } from '@/lib/firebase';

const COUNTER_PATH = 'counters/driverNumberSeq';
export const DRIVER_NUMBER_INDEX_PATH = 'driverNumberIndex';

/** RTDB may return counter as number or string */
function parseCounterValue(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return 100_000;
}

/**
 * Normalize user input to canonical driver number (e.g. D100001 or D-based-on-userId).
 */
export function normalizeDriverNumberInput(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!cleaned) return null;
  if (/^D\d{6,20}$/.test(cleaned)) return cleaned;
  if (/^\d{6,20}$/.test(cleaned)) return `D${cleaned}`;
  return null;
}

async function writeIndex(driverNumber: string, userId: string): Promise<void> {
  await set(ref(database, `${DRIVER_NUMBER_INDEX_PATH}/${driverNumber}`), userId);
}

/**
 * Allocate a driver number: try sequential counter + index; if that fails (rules, network),
 * fall back to D{userId} so registration always gets a unique value writable under users/ only.
 */
export async function assignDriverNumberForNewUser(userId: string): Promise<string> {
  const counterRef = ref(database, COUNTER_PATH);

  try {
    const outcome = await runTransaction(counterRef, (current: unknown) => {
      const n = parseCounterValue(current);
      return n + 1;
    });

    if (outcome.committed) {
      const num = parseCounterValue(outcome.snapshot.val());
      const driverNumber = `D${num}`;
      try {
        await writeIndex(driverNumber, userId);
      } catch {
        /* index path may be blocked by rules — sign-in still works via user.driverNumber scan */
      }
      return driverNumber;
    }
  } catch (e) {
    console.warn('[driver-number] Counter transaction unavailable, using id-based number:', e);
  }

  const fallback = `D${userId}`;
  try {
    await writeIndex(fallback, userId);
  } catch {
    /* optional */
  }
  return fallback;
}
