/** Landing and onboarding paths reachable without a session. */
export const PUBLIC_EXACT_PATHS = new Set(['/', '/index']);

/** Prefixes for auth flows (sign-in, OTP, register, forgot-password). */
export const PUBLIC_ROUTE_PREFIXES = ['/auth/'];

export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const trimmed = pathname.replace(/\/$/, '');
  return trimmed || '/';
}

export function isPublicRoute(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  if (PUBLIC_EXACT_PATHS.has(normalized)) return true;
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isAuthRoute(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return normalized === '/auth' || normalized.startsWith('/auth/');
}
