import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/auth-store';

export default function EditProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState(user?.bio?.trim() || '');
  const [emergencyContactName, setEmergencyContactName] = useState(user?.emergencyContactName?.trim() || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(user?.emergencyContactPhone?.trim() || '');
  const [profileImage, setProfileImage] = useState<string | null>(user?.profileImage || null);
  const [vehicleImage, setVehicleImage] = useState<string | null>(user?.vehicleImage || null);
  const [vehicleType, setVehicleType] = useState<'car' | 'motorbike'>(user?.vehicleType ?? 'motorbike');
  const [vehiclePlate, setVehiclePlate] = useState(user?.vehiclePlate?.trim() || '');
  const [vehicleModel, setVehicleModel] = useState(user?.vehicleModel?.trim() || '');
  const [saving, setSaving] = useState(false);

  const pickImage = async (type: 'profile' | 'vehicle') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      if (type === 'profile') {
        setProfileImage(result.assets[0].uri);
      } else if (type === 'vehicle' && user?.type === 'driver') {
        setVehicleImage(result.assets[0].uri);
      }
    }
  };

  const handleSaveChanges = async () => {
    if (!user || !username?.trim() || !email?.trim() || !phone?.trim()) {
      Alert.alert('Profile', 'Please fill in your name, email, and phone.');
      return;
    }
    setSaving(true);
    try {
      const ok = await updateUser({
        ...user,
        username: username.trim(),
        email: email.trim(),
        phone: phone.trim(),
        profileImage: profileImage || '',
        bio: bio.trim(),
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        ...(user.type === 'driver'
          ? {
              vehicleType,
              vehiclePlate: vehiclePlate.trim(),
              vehicleModel: vehicleModel.trim(),
              ...(vehicleImage ? { vehicleImage } : {}),
            }
          : {}),
      });
      if (ok) {
        router.back();
      } else {
        Alert.alert(
          'Could not save',
          'Your changes could not be saved. Check your connection and try again.'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const isDriver = user.type === 'driver';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient colors={['#e8f4fc', '#f8fafc']} style={styles.hero}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={12}>
              <ChevronLeft color="#0f172a" size={26} strokeWidth={2.2} />
            </TouchableOpacity>
            <Text style={styles.heroTitle}>Edit profile</Text>
            <Text style={styles.heroSubtitle}>Update how you appear in the app</Text>
          </LinearGradient>

          <View style={styles.formWrap}>
            {isDriver && user.driverNumber ? (
              <View style={styles.driverIdBanner}>
                <Text style={styles.driverIdLabel}>Driver number (sign in with this or email)</Text>
                <Text style={styles.driverIdValue}>{user.driverNumber}</Text>
              </View>
            ) : null}
            <View style={styles.avatarRow}>
              <TouchableOpacity style={styles.photoTouch} onPress={() => pickImage('profile')} activeOpacity={0.85}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profileImage} />
                ) : (
                  <View style={styles.addPhotoCircle}>
                    <Text style={styles.addPhotoText}>Add{'\n'}photo</Text>
                  </View>
                )}
              </TouchableOpacity>
              {isDriver && (
                <TouchableOpacity
                  style={[styles.photoTouch, styles.photoTouchSecond]}
                  onPress={() => pickImage('vehicle')}
                  activeOpacity={0.85}
                >
                  {vehicleImage ? (
                    <Image source={{ uri: vehicleImage }} style={styles.vehicleImage} />
                  ) : (
                    <View style={[styles.addPhotoCircle, styles.vehicleCircle]}>
                      <Text style={styles.addPhotoText}>Vehicle{'\n'}photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.fieldLabel}>Display name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor="#94a3b8"
              value={username}
              onChangeText={setUsername}
            />

            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              placeholderTextColor="#94a3b8"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>Bio (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="A short line about you"
              placeholderTextColor="#94a3b8"
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={280}
            />

            <Text style={styles.sectionTitle}>Emergency contact (optional)</Text>
            <Text style={styles.sectionHint}>Someone we can reach if something goes wrong on a trip.</Text>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor="#94a3b8"
              value={emergencyContactName}
              onChangeText={setEmergencyContactName}
            />
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              placeholderTextColor="#94a3b8"
              value={emergencyContactPhone}
              onChangeText={setEmergencyContactPhone}
              keyboardType="phone-pad"
            />

            {isDriver && (
              <>
                <Text style={styles.sectionTitle}>Vehicle</Text>
                <View style={styles.vehicleTypeRow}>
                  <TouchableOpacity
                    style={[styles.typeChip, vehicleType === 'motorbike' && styles.typeChipOn]}
                    onPress={() => setVehicleType('motorbike')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.typeChipText, vehicleType === 'motorbike' && styles.typeChipTextOn]}>Taxi moto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeChip, vehicleType === 'car' && styles.typeChipOn]}
                    onPress={() => setVehicleType('car')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.typeChipText, vehicleType === 'car' && styles.typeChipTextOn]}>Taxi car</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.fieldLabel}>License plate</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. RAA 123 A"
                  placeholderTextColor="#94a3b8"
                  value={vehiclePlate}
                  onChangeText={setVehiclePlate}
                  autoCapitalize="characters"
                />
                <Text style={styles.fieldLabel}>Make / model</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Toyota Corolla"
                  placeholderTextColor="#94a3b8"
                  value={vehicleModel}
                  onChangeText={setVehicleModel}
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSaveChanges}
              activeOpacity={0.88}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save changes</Text>
              )}
            </TouchableOpacity>

            {!isDriver && (
              <TouchableOpacity
                style={styles.secondaryLink}
                onPress={() => router.push('/auth/register?role=driver')}
              >
                <Text style={styles.secondaryLinkText}>Register as driver</Text>
              </TouchableOpacity>
            )}

            <View style={styles.bottomSpacer} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    padding: 4,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  formWrap: {
    marginTop: 8,
    paddingHorizontal: 20,
  },
  driverIdBanner: {
    backgroundColor: '#ecfdf5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  driverIdLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  driverIdValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#065f46',
    letterSpacing: 1,
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  photoTouch: {},
  photoTouchSecond: {
    marginLeft: 16,
  },
  addPhotoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  vehicleCircle: {
    borderColor: '#bbf7d0',
  },
  addPhotoText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  profileImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  vehicleImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: '#bbf7d0',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#fff',
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 14,
    fontSize: 16,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionHint: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 18,
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  typeChipOn: {
    borderColor: '#3498db',
    backgroundColor: '#eff6ff',
  },
  typeChipText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
  },
  typeChipTextOn: {
    color: '#1d4ed8',
  },
  saveButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 16,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '800',
  },
  saveButtonDisabled: {
    opacity: 0.75,
  },
  secondaryLink: {
    marginTop: 18,
    alignItems: 'center',
  },
  secondaryLinkText: {
    color: '#3498db',
    fontSize: 15,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 24,
  },
});
