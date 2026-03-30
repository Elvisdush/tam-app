import { Alert, Linking } from 'react-native';

/**
 * Opens the system phone app with the given number.
 *
 * Avoid `Linking.canOpenURL('tel:…')` — on iOS it returns false unless `tel` is
 * declared in LSApplicationQueriesSchemes, which incorrectly blocks dialing.
 */
export async function openPhoneDialer(phoneRaw: string): Promise<void> {
  const cleaned = phoneRaw.replace(/[^\d+]/g, '');
  if (!cleaned) {
    Alert.alert('Phone', 'No phone number available.');
    return;
  }
  try {
    await Linking.openURL(`tel:${cleaned}`);
  } catch {
    Alert.alert('Phone', 'Could not open the phone app. Try dialing the number manually.');
  }
}
