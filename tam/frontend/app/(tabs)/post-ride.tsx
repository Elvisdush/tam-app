import { Redirect } from 'expo-router';

/**
 * The tab only acts as an entry point — the real screen is the stack route `rides/post`.
 * Returning `null` here caused a blank page when the tab body rendered
 * (e.g. if `tabPress` + `router.push` did not run first).
 */
export default function PostRideTabShortcut() {
  return <Redirect href="/rides/post" />;
}
