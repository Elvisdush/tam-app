import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/auth-store';

export default function EditProfileScreen() {
  const user = useAuthStore(state => state.user);
  const updateUser = useAuthStore(state => state.updateUser);
  
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileImage, setProfileImage] = useState<string | null>(user?.profileImage || null);
  const [vehicleImage, setVehicleImage] = useState<string | null>(user?.vehicleImage || null);
  
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
  
  const handleSaveChanges = () => {
    if (user && username && email && phone) {
      updateUser({
        ...user,
        username,
        email,
        phone,
        profileImage: profileImage || '',
        ...(user.type === 'driver' && vehicleImage ? { vehicleImage } : {}),
      });
      router.back();
    }
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1682686580391-615b1f28e6d1?q=80&w=1470&auto=format&fit=crop' }}
            style={styles.backgroundImage}
          />
          
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ChevronLeft color="white" size={24} />
          </TouchableOpacity>
          
          <View style={styles.formContainer}>
            <TouchableOpacity 
              style={styles.photoContainer} 
              onPress={() => pickImage('profile')}
            >
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.addPhotoCircle}>
                  <Text style={styles.addPhotoText}>Change{'\n'}Photo</Text>
                </View>
              )}
            </TouchableOpacity>
            
            {user.type === 'driver' && (
              <TouchableOpacity 
                style={styles.photoContainer} 
                onPress={() => pickImage('vehicle')}
              >
                {vehicleImage ? (
                  <Image source={{ uri: vehicleImage }} style={styles.vehicleImage} />
                ) : (
                  <View style={styles.addPhotoCircle}>
                    <Text style={styles.addPhotoText}>Change{'\n'}Vehicle Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            
            <TextInput
              style={styles.input}
              placeholder="User name"
              placeholderTextColor="#999"
              value={username}
              onChangeText={setUsername}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Change Phone Number"
              placeholderTextColor="#999"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleSaveChanges}
            >
              <Text style={styles.saveButtonText}>Save changes</Text>
            </TouchableOpacity>
            
            {user.type === 'passenger' && (
              <View style={styles.bottomOptions}>
                <TouchableOpacity onPress={() => router.push('/auth/register/driver')}>
                  <Text style={styles.registerRiderText}>Register as Rider</Text>
                </TouchableOpacity>
                
                <Text style={styles.divider}>|</Text>
                
                <TouchableOpacity>
                  <Text style={styles.contactText}>Contact us</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backgroundImage: {
    width: '100%',
    height: 200,
    position: 'absolute',
    top: 0,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  formContainer: {
    marginTop: 120,
    marginHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
  },
  photoContainer: {
    marginBottom: 20,
  },
  addPhotoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  addPhotoText: {
    color: '#333',
    fontSize: 14,
    textAlign: 'center',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  vehicleImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  input: {
    backgroundColor: 'white',
    width: '100%',
    padding: 15,
    borderRadius: 30,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  saveButton: {
    backgroundColor: '#333',
    paddingVertical: 15,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomOptions: {
    flexDirection: 'row',
    marginTop: 20,
    alignItems: 'center',
  },
  registerRiderText: {
    color: '#333',
    fontSize: 14,
  },
  divider: {
    marginHorizontal: 10,
    color: '#666',
  },
  contactText: {
    color: '#333',
    fontSize: 14,
  },
});