import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, ImageBackground, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Image, ScrollView, Animated, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/auth-store';

export default function RegisterDriverScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [vehicleImage, setVehicleImage] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<'car' | 'motorbike'>('motorbike');
  const [errors, setErrors] = useState<{[key: string]: boolean}>({});
  
  const register = useAuthStore(state => state.register);
  
  const shakeAnimations = {
    username: useRef(new Animated.Value(0)).current,
    email: useRef(new Animated.Value(0)).current,
    phone: useRef(new Animated.Value(0)).current,
    password: useRef(new Animated.Value(0)).current,
  };

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
      } else {
        setVehicleImage(result.assets[0].uri);
      }
    }
  };

  const shakeField = (fieldName: string) => {
    const animation = shakeAnimations[fieldName as keyof typeof shakeAnimations];
    Animated.sequence([
      Animated.timing(animation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleRegister = async () => {
    const newErrors: {[key: string]: boolean} = {};
    const emptyFields: string[] = [];
    
    if (!username.trim()) {
      newErrors.username = true;
      emptyFields.push('username');
    }
    if (!email.trim()) {
      newErrors.email = true;
      emptyFields.push('email');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = true;
        emptyFields.push('email');
        setErrors(newErrors);
        shakeField('email');
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
        return;
      }
    }
    if (!phone.trim()) {
      newErrors.phone = true;
      emptyFields.push('phone');
    }
    if (!password.trim()) {
      newErrors.password = true;
      emptyFields.push('password');
    }
    
    setErrors(newErrors);
    
    if (emptyFields.length > 0) {
      emptyFields.forEach(field => shakeField(field));
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }
    
    if (!profileImage || !vehicleImage) {
      Alert.alert('Missing Images', 'Please add both profile and vehicle photos.');
      return;
    }
    
    await register({
      username,
      email,
      phone,
      password,
      profileImage,
      vehicleImage,
      type: 'driver',
      vehicleType,
    });
    router.replace('/home');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="light" />
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1682686580391-615b1f28e6d1?q=80&w=1470&auto=format&fit=crop' }}
        style={styles.backgroundImage}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)']}
          style={styles.gradient}
        >
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ChevronLeft color="white" size={24} />
          </TouchableOpacity>
          
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.formContainer}>
              {!vehicleImage ? (
                <TouchableOpacity 
                  style={styles.photoContainer} 
                  onPress={() => pickImage('profile')}
                >
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.profileImage} />
                  ) : (
                    <View style={styles.addPhotoCircle}>
                      <Text style={styles.addPhotoText}>Add{'\n'}Photo of your{'\n'}face</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.photoContainer} 
                  onPress={() => pickImage('vehicle')}
                >
                  <Image source={{ uri: vehicleImage }} style={styles.profileImage} />
                  <Text style={styles.photoLabel}>Add Photo of your Bike</Text>
                </TouchableOpacity>
              )}
              
              {profileImage && !vehicleImage && (
                <TouchableOpacity 
                  style={styles.photoContainer} 
                  onPress={() => pickImage('vehicle')}
                >
                  <View style={styles.addPhotoCircle}>
                    <Text style={styles.addPhotoText}>Add{'\n'}Photo of your{'\n'}Bike</Text>
                  </View>
                </TouchableOpacity>
              )}
              
              <Animated.View style={{ transform: [{ translateX: shakeAnimations.username }] }}>
                <TextInput
                  style={[styles.input, errors.username && styles.errorInput]}
                  placeholder="User name"
                  placeholderTextColor={errors.username ? "#ff4444" : "#999"}
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    if (errors.username) {
                      setErrors(prev => ({ ...prev, username: false }));
                    }
                  }}
                />
                {errors.username && <Text style={styles.errorText}>User name is required</Text>}
              </Animated.View>
              
              <Animated.View style={{ transform: [{ translateX: shakeAnimations.email }] }}>
                <TextInput
                  style={[styles.input, errors.email && styles.errorInput]}
                  placeholder="Email"
                  placeholderTextColor={errors.email ? "#ff4444" : "#999"}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) {
                      setErrors(prev => ({ ...prev, email: false }));
                    }
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {errors.email && <Text style={styles.errorText}>Email is required</Text>}
              </Animated.View>
              
              <Animated.View style={{ transform: [{ translateX: shakeAnimations.phone }] }}>
                <TextInput
                  style={[styles.input, errors.phone && styles.errorInput]}
                  placeholder="Phone"
                  placeholderTextColor={errors.phone ? "#ff4444" : "#999"}
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    if (errors.phone) {
                      setErrors(prev => ({ ...prev, phone: false }));
                    }
                  }}
                  keyboardType="phone-pad"
                />
                {errors.phone && <Text style={styles.errorText}>Phone is required</Text>}
              </Animated.View>
              
              <Animated.View style={{ transform: [{ translateX: shakeAnimations.password }] }}>
                <TextInput
                  style={[styles.input, errors.password && styles.errorInput]}
                  placeholder="Password"
                  placeholderTextColor={errors.password ? "#ff4444" : "#999"}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) {
                      setErrors(prev => ({ ...prev, password: false }));
                    }
                  }}
                  secureTextEntry
                />
                {errors.password && <Text style={styles.errorText}>Password is required</Text>}
              </Animated.View>

              <Text style={styles.vehicleTypeLabel}>Your vehicle</Text>
              <View style={styles.vehicleTypeRow}>
                <TouchableOpacity
                  style={[styles.vehicleTypeChip, vehicleType === 'motorbike' && styles.vehicleTypeChipActive]}
                  onPress={() => setVehicleType('motorbike')}
                >
                  <Text style={[styles.vehicleTypeChipText, vehicleType === 'motorbike' && styles.vehicleTypeChipTextActive]}>
                    Taxi Moto
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.vehicleTypeChip, vehicleType === 'car' && styles.vehicleTypeChipActive]}
                  onPress={() => setVehicleType('car')}
                >
                  <Text style={[styles.vehicleTypeChipText, vehicleType === 'car' && styles.vehicleTypeChipTextActive]}>
                    Taxi Car
                  </Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity 
                style={styles.registerButton}
                onPress={handleRegister}
              >
                <Text style={styles.registerText}>Register</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </LinearGradient>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  formContainer: {
    width: '85%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  photoContainer: {
    marginBottom: 20,
    alignItems: 'center',
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
  },
  photoLabel: {
    marginTop: 5,
    fontSize: 14,
    color: '#333',
  },
  input: {
    backgroundColor: 'white',
    width: '100%',
    padding: 15,
    borderRadius: 30,
    marginBottom: 15,
    fontSize: 16,
  },
  registerButton: {
    backgroundColor: '#333',
    paddingVertical: 15,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#999',
  },
  registerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorInput: {
    borderWidth: 2,
    borderColor: '#ff4444',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 15,
  },
  vehicleTypeLabel: {
    alignSelf: 'flex-start',
    width: '100%',
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 16,
  },
  vehicleTypeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: 'white',
    alignItems: 'center',
  },
  vehicleTypeChipActive: {
    borderColor: '#3498db',
    backgroundColor: '#e8f4fd',
  },
  vehicleTypeChipText: {
    fontSize: 15,
    color: '#555',
    fontWeight: '600',
  },
  vehicleTypeChipTextActive: {
    color: '#3498db',
  },
});