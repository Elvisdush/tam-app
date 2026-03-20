import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ImageBackground, Animated, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft } from 'lucide-react-native';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{email: boolean; phone: boolean}>({ email: false, phone: false });
  
  const emailShake = useRef(new Animated.Value(0)).current;
  const phoneShake = useRef(new Animated.Value(0)).current;

  const shakeField = (animation: Animated.Value) => {
    Animated.sequence([
      Animated.timing(animation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleVerify = () => {
    const newErrors = {
      email: !email.trim(),
      phone: !phone.trim()
    };
    
    setErrors(newErrors);
    
    if (newErrors.email) {
      shakeField(emailShake);
    }
    if (newErrors.phone) {
      shakeField(phoneShake);
    }
    
    if (!newErrors.email && !newErrors.phone) {
      Alert.alert('Verification', 'Verification code sent to your email and phone.');
    }
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
          
          <View style={styles.formContainer}>
            <Text style={styles.title}>Forgot Password</Text>
            
            <Animated.View style={{ transform: [{ translateX: emailShake }] }}>
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
            </Animated.View>
            
            <Animated.View style={{ transform: [{ translateX: phoneShake }] }}>
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
            </Animated.View>
            
            <TouchableOpacity 
              style={styles.verifyButton}
              onPress={handleVerify}
            >
              <Text style={styles.verifyText}>Verify</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.backToSignIn}
              onPress={() => router.push('/auth/sign-in')}
            >
              <Text style={styles.backToSignInText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
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
    justifyContent: 'center',
    alignItems: 'center',
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'white',
    width: '100%',
    padding: 15,
    borderRadius: 30,
    marginBottom: 15,
    fontSize: 16,
  },
  verifyButton: {
    backgroundColor: '#333',
    paddingVertical: 15,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  verifyText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backToSignIn: {
    marginTop: 20,
  },
  backToSignInText: {
    color: '#333',
    fontSize: 14,
  },
  errorInput: {
    borderWidth: 2,
    borderColor: '#ff4444',
  },
});
