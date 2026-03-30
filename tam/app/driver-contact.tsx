import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Phone, Mail } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth-store';
import { DEMO_DRIVER_EMAIL, DEMO_DRIVER_PHONE } from '@/lib/demo-nearby-drivers';
import { openPhoneDialer } from '@/lib/open-phone-dialer';

const PRIMARY = '#3498db';

/**
 * Prefer Gmail app when installed; otherwise `mailto:` (opens default mail app).
 */
async function openGmailOrMailto(email: string) {
  const trimmed = email.trim();
  if (!trimmed) {
    Alert.alert('Email', 'No email address available.');
    return;
  }

  const gmailCompose = `googlegmail://co?to=${encodeURIComponent(trimmed)}`;
  const mailto = `mailto:${encodeURIComponent(trimmed)}`;

  try {
    if (await Linking.canOpenURL(gmailCompose)) {
      await Linking.openURL(gmailCompose);
      return;
    }
  } catch {
    // fall through
  }

  try {
    if (await Linking.canOpenURL(mailto)) {
      await Linking.openURL(mailto);
      return;
    }
  } catch {
    // fall through
  }

  if (Platform.OS === 'web') {
    const webGmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(trimmed)}`;
    await Linking.openURL(webGmail);
    return;
  }

  Alert.alert('Email', 'Could not open Gmail or a mail app. Try again after installing Gmail.');
}

export default function DriverContactScreen() {
  const { userId, isDemo, name } = useLocalSearchParams<{
    userId?: string;
    isDemo?: string;
    name?: string;
  }>();
  const users = useAuthStore((s) => s.users);

  const { phone, email, displayName } = useMemo(() => {
    const demo = isDemo === '1' || isDemo === 'true';
    const uid = typeof userId === 'string' ? userId : '';
    const profile = uid ? users.find((u) => u.id === uid) : undefined;
    const phoneResolved =
      profile?.phone?.trim() || (demo ? DEMO_DRIVER_PHONE : '');
    const emailResolved =
      profile?.email?.trim() || (demo ? DEMO_DRIVER_EMAIL : '');
    const displayName =
      (typeof name === 'string' && name.trim()) ||
      profile?.username?.trim() ||
      'Driver';
    return { phone: phoneResolved, email: emailResolved, displayName };
  }, [userId, isDemo, name, users]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft color="#0f172a" size={28} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact driver</Text>
        <View style={styles.backPlaceholder} />
      </View>

      <Text style={styles.subtitle} numberOfLines={2}>
        {displayName}
      </Text>
      <Text style={styles.hint}>Tap below to call or send an email</Text>

      <View style={styles.cards}>
        <TouchableOpacity
          style={[styles.card, styles.cardSpacing, !phone && styles.cardDisabled]}
          onPress={() => (phone ? void openPhoneDialer(phone) : undefined)}
          disabled={!phone}
          activeOpacity={0.85}
        >
          <View style={[styles.iconCircle, styles.iconCirclePhone]}>
            <Phone color="#fff" size={28} strokeWidth={2.2} />
          </View>
          <Text style={styles.cardLabel}>Phone</Text>
          <Text style={styles.cardValue}>{phone || 'Not available'}</Text>
          <Text style={styles.cardAction}>Open phone app</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, !email && styles.cardDisabled]}
          onPress={() => (email ? openGmailOrMailto(email) : undefined)}
          disabled={!email}
          activeOpacity={0.85}
        >
          <View style={[styles.iconCircle, styles.iconCircleMail]}>
            <Mail color="#fff" size={28} strokeWidth={2.2} />
          </View>
          <Text style={styles.cardLabel}>Email</Text>
          <Text style={styles.cardValue} numberOfLines={2}>
            {email || 'Not available'}
          </Text>
          <Text style={styles.cardAction}>Open Gmail or mail</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footerNote}>
        Gmail opens if installed; otherwise your default email app. Phone opens your dialer.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  backPlaceholder: {
    width: 44,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 8,
    paddingHorizontal: 20,
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  hint: {
    marginTop: 8,
    paddingHorizontal: 24,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  cards: {
    paddingHorizontal: 20,
  },
  cardSpacing: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconCirclePhone: {
    backgroundColor: '#16a34a',
  },
  iconCircleMail: {
    backgroundColor: PRIMARY,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardAction: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY,
  },
  footerNote: {
    marginTop: 28,
    paddingHorizontal: 28,
    fontSize: 12,
    lineHeight: 18,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
