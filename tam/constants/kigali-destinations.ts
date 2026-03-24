/** District / city entries that count as Kigali City for passenger pricing & moto service area */
export const KIGALI_DESTINATION_IDS = new Set([
  'kigali-city',
  'gasabo',
  'kicukiro',
  'nyarugenge',
]);

export function isKigaliDestination(destinationId: string): boolean {
  return KIGALI_DESTINATION_IDS.has(destinationId);
}
