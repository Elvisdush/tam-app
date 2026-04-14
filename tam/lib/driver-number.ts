import { ref, runTransaction, set } from 'firebase/database';
import { database } from '@/lib/firebase';

export const DRIVER_NUMBER_INDEX_PATH = 'driverNumberIndex';
const COUNTER_ROOT = 'counters/driverNumberSeqByYear';

/** RTDB may return counter as number or string */
function parseCounterValue(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return 0;
}

/**
 * Normalize user input for driver sign-in:
 * - new format: YYYYNNN... (e.g. 2026001)
 * - legacy format: D100001 / D-based ids
 */
export function normalizeDriverNumberInput(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!cleaned) return null;
  if (/^D\d{6,20}$/.test(cleaned)) return cleaned; // legacy
  if (/^\d{7,20}$/.test(cleaned)) return cleaned; // current year-prefixed numeric id
  return null;
}

/** Show canonical numeric driver number as YYYY-XXX for readability. */
export function formatDriverNumberForDisplay(driverNumber: string | null | undefined): string {
  if (!driverNumber) return '';
  const n = driverNumber.trim().toUpperCase();
  if (/^D\d{6,20}$/.test(n)) return n; // legacy values stay as-is
  if (/^\d{7,20}$/.test(n)) {
    const year = n.slice(0, 4);
    const seq = n.slice(4);
    return `${year}-${seq}`;
  }
  return n;
}

async function writeIndex(driverNumber: string, userId: string): Promise<void> {
  await set(ref(database, `${DRIVER_NUMBER_INDEX_PATH}/${driverNumber}`), userId);
}

/**
 * Allocate a driver number in current-year format: YYYY001, YYYY002, ...
 * If counter/index fails (rules/network), fall back to YYYY{userId}.
 */
export async function assignDriverNumberForNewUser(userId: string): Promise<string> {
  const year = new Date().getFullYear();
  const counterRef = ref(database, `${COUNTER_ROOT}/${year}`);

  try {
    const outcome = await runTransaction(counterRef, (current: unknown) => {
      const n = parseCounterValue(current);
      return n + 1;
    });

    if (outcome.committed) {
      const num = parseCounterValue(outcome.snapshot.val());
      const driverNumber = `${year}${String(num).padStart(3, '0')}`;
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

  const fallback = `${year}${String(userId).replace(/\D/g, '') || userId}`;
  try {
    await writeIndex(fallback, userId);
  } catch {
    /* optional */
  }
  return fallback;
}
