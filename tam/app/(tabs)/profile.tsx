import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Car,
  Bike,
  Shield,
  UserCircle,
  Edit3,
  LogOut,
  Trash2,
  HelpCircle,
  FileText,
  Hash,
} from 'lucide-react-native';
import { useAuthStore } from '@/store/auth-store';
import { StarRatingRow } from '@/components/StarRatingRow';
import { openPhoneDialer } from '@/lib/open-phone-dialer';

const PRIMARY = '#3498db';
const PLACEHOLDER_AVATAR =
  'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop';

type RowProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  onPress?: () => void;
  hint?: string;
};

function InfoRow({ icon, label, value, onPress, hint }: RowProps) {
  const content = (
    <>
      <View style={styles.rowIconWrap}>{icon}</View>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={onPress ? 2 : 4}>
          {value}
        </Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      {onPress ? <ChevronRight color="#94a3b8" size={20} strokeWidth={2.2} /> : null}
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity style={styles.infoRow} onPress={onPress} activeOpacity={0.65}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.infoRow}>{content}</View>;
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'Are you sure? This cannot be undone from the app. Contact support if you need help.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/auth/sign-in');
          },
        },
      ]
    );
  };

  const openTel = (raw: string) => {
    void openPhoneDialer(raw);
  };

  const openMail = (email: string) => {
    void Linking.openURL(`mailto:${encodeURIComponent(email)}`);
  };

  if (!user) return null;

  const avatarUri = user.profileImage?.startsWith('blob:') ? PLACEHOLDER_AVATAR : user.profileImage || PLACEHOLDER_AVATAR;
  const isDriver = user.type === 'driver';
  const hasRating = user.averageRating != null && user.averageRating > 0;
  const bioText = user.bio?.trim();
  const iceName = user.emergencyContactName?.trim();
  const icePhone = user.emergencyContactPhone?.trim();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={['#e8f4fc', '#f0f9ff', '#f8fafc']} style={styles.hero}>
          <View style={styles.heroTop}>
            {navigation.canGoBack() ? (
              <TouchableOpacity
                style={styles.heroBack}
                onPress={() => router.back()}
                hitSlop={12}
                accessibilityLabel="Back"
              >
                <ChevronLeft color="#0f172a" size={26} strokeWidth={2.2} />
              </TouchableOpacity>
            ) : (
              <View style={styles.heroBackPlaceholder} />
            )}
            <Text style={styles.heroTitle}>Profile</Text>
            <View style={styles.heroBackPlaceholder} />
          </View>

          <View style={styles.avatarRing}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} defaultSource={require('@/assets/images/icon.png')} />
          </View>
          <Text style={styles.displayName}>{user.username}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.roleBadge, isDriver ? styles.badgeDriver : styles.badgePassenger]}>
              <View style={styles.roleBadgeIcon}>
                {isDriver ? <Car color="#fff" size={14} strokeWidth={2.5} /> : <UserCircle color="#fff" size={14} strokeWidth={2.5} />}
              </View>
              <Text style={styles.roleBadgeText}>{isDriver ? 'Driver' : 'Passenger'}</Text>
            </View>
          </View>
          <View style={styles.ratingPill}>
            <StarRatingRow
              value={hasRating ? user.averageRating : undefined}
              ratingCount={hasRating ? user.ratingCount : undefined}
              size={20}
              showEmpty={!hasRating}
              emptyLabel="No ratings yet"
              showMaxHint
            />
          </View>
        </LinearGradient>

        <View style={styles.sheet}>
          <Text style={styles.sectionHeading}>Account</Text>
          <View style={styles.card}>
            <InfoRow
              icon={<Mail color={PRIMARY} size={20} strokeWidth={2.2} />}
              label="Email"
              value={user.email}
              onPress={() => openMail(user.email)}
              hint="Tap to open mail app"
            />
            <View style={styles.cardDivider} />
            <InfoRow
              icon={<Phone color={PRIMARY} size={20} strokeWidth={2.2} />}
              label="Phone"
              value={user.phone || '—'}
              onPress={user.phone ? () => openTel(user.phone) : undefined}
              hint={user.phone ? 'Tap to call' : undefined}
            />
            {isDriver && user.driverNumber ? (
              <>
                <View style={styles.cardDivider} />
                <InfoRow
                  icon={<Hash color={PRIMARY} size={20} strokeWidth={2.2} />}
                  label="Driver number"
                  value={user.driverNumber}
                  hint="Use this or email to sign in"
                />
              </>
            ) : null}
          </View>

          {isDriver ? (
            <>
              <Text style={styles.sectionHeading}>Vehicle</Text>
              <View style={styles.card}>
                <InfoRow
                  icon={
                    user.vehicleType === 'car' ? (
                      <Car color={PRIMARY} size={20} strokeWidth={2.2} />
                    ) : (
                      <Bike color={PRIMARY} size={20} strokeWidth={2.2} />
                    )
                  }
                  label="Type"
                  value={user.vehicleType === 'car' ? 'Taxi car' : 'Taxi moto'}
                />
                <View style={styles.cardDivider} />
                <InfoRow
                  icon={<FileText color={PRIMARY} size={20} strokeWidth={2.2} />}
                  label="Plate"
                  value={user.vehiclePlate?.trim() || '—'}
                />
                <View style={styles.cardDivider} />
                <InfoRow
                  icon={<Car color={PRIMARY} size={20} strokeWidth={2.2} />}
                  label="Model"
                  value={user.vehicleModel?.trim() || '—'}
                />
              </View>
            </>
          ) : null}

          <Text style={styles.sectionHeading}>About you</Text>
          <View style={styles.card}>
            <View style={styles.bioBlock}>
              <Text style={styles.rowLabel}>Bio</Text>
              <Text style={styles.bioText}>
                {bioText || 'Add a short bio in Edit profile — helps others recognize you.'}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionHeading}>Safety</Text>
          <View style={styles.card}>
            <InfoRow
              icon={<Shield color={PRIMARY} size={20} strokeWidth={2.2} />}
              label="Emergency contact"
              value={
                iceName || icePhone
                  ? [iceName, icePhone].filter(Boolean).join(' · ')
                  : 'Not set — add in Edit profile'
              }
            />
          </View>

          <Text style={styles.sectionHeading}>Support</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() =>
                Alert.alert(
                  'Help',
                  'For trip issues, use in-app chat with your driver. For account help, contact support by email from Edit profile.'
                )
              }
              activeOpacity={0.65}
            >
              <View style={styles.rowIconWrap}>
                <HelpCircle color={PRIMARY} size={20} strokeWidth={2.2} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowLabel}>Help & FAQ</Text>
                <Text style={styles.rowHint}>Safety, trips, and account</Text>
              </View>
              <ChevronRight color="#94a3b8" size={20} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.editCta} onPress={() => router.push('/profile/edit')} activeOpacity={0.88}>
            <Edit3 color="#fff" size={20} strokeWidth={2.2} style={styles.editCtaIcon} />
            <Text style={styles.editCtaText}>Edit profile</Text>
          </TouchableOpacity>

          <View style={styles.footerActions}>
            <TouchableOpacity style={[styles.footerBtn, styles.footerBtnSpaced]} onPress={handleLogout} activeOpacity={0.8}>
              <LogOut color="#475569" size={20} strokeWidth={2.2} style={styles.footerIcon} />
              <Text style={styles.footerBtnText}>Log out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerBtn} onPress={handleDeleteAccount} activeOpacity={0.8}>
              <Trash2 color="#dc2626" size={20} strokeWidth={2.2} style={styles.footerIcon} />
              <Text style={styles.footerDangerText}>Delete account</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.versionHint}>
            TAM · {Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'App'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  hero: {
    paddingBottom: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTop: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroBack: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBackPlaceholder: {
    width: 44,
    height: 44,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  avatarRing: {
    padding: 4,
    borderRadius: 64,
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 12,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#e2e8f0',
  },
  displayName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  badgeRow: {
    marginTop: 10,
    flexDirection: 'row',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  roleBadgeIcon: {
    marginRight: 6,
  },
  badgeDriver: {
    backgroundColor: '#16a34a',
  },
  badgePassenger: {
    backgroundColor: PRIMARY,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  ratingPill: {
    marginTop: 12,
    alignSelf: 'stretch',
    maxWidth: '100%',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sheet: {
    marginTop: -12,
    paddingHorizontal: 16,
  },
  sectionHeading: {
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e2e8f0',
    marginLeft: 56,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowIconWrap: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: {
    flex: 1,
    marginLeft: 8,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  rowValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 22,
  },
  rowHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  bioBlock: {
    padding: 16,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
  },
  editCta: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  editCtaIcon: {
    marginRight: 10,
  },
  editCtaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  footerActions: {
    marginTop: 20,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  footerBtnSpaced: {
    marginBottom: 12,
  },
  footerIcon: {
    marginRight: 10,
  },
  footerBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  footerDangerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc2626',
  },
  versionHint: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
});
