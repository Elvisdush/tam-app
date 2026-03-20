import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ImageBackground, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth-store';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{email: boolean; password: boolean}>({ email: false, password: false });
  const signIn = useAuthStore(state => state.signIn);
  
  const emailShake = useRef(new Animated.Value(0)).current;
  const passwordShake = useRef(new Animated.Value(0)).current;

  const shakeField = (animation: Animated.Value) => {
    Animated.sequence([
      Animated.timing(animation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleSignIn = async () => {
    if (email.trim() && password.trim()) {
      const success = await signIn(email, password);
      if (success) {
        router.replace('/home');
      } else {
        setErrors({ email: true, password: true });
        shakeField(emailShake);
        shakeField(passwordShake);
      }
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
            
            <Animated.View style={{ transform: [{ translateX: passwordShake }] }}>
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
            </Animated.View>
            
            <TouchableOpacity 
              style={styles.signInButton}
              onPress={handleSignIn}
            >
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
            
            <View style={styles.registerOptions}>
              <TouchableOpacity onPress={() => router.push('/auth/forgot-password')}>
                <Text style={styles.forgotPasswordText}>Forget Password</Text>
              </TouchableOpacity>
              
              <Text style={styles.divider}>|</Text>
              
              <TouchableOpacity onPress={() => router.push('/auth/register')}>
                <Text style={styles.registerText}>Register</Text>
              </TouchableOpacity>
            </View>
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
  input: {
    backgroundColor: 'white',
    width: '100%',
    padding: 15,
    borderRadius: 30,
    marginBottom: 15,
    fontSize: 16,
  },
  signInButton: {
    backgroundColor: '#333',
    paddingVertical: 15,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  signInText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  registerOptions: {
    flexDirection: 'row',
    marginTop: 20,
    alignItems: 'center',
  },
  registerText: {
    color: '#333',
    fontSize: 14,
  },
  forgotPasswordText: {
    color: '#ff4444',
    fontSize: 14,
  },
  divider: {
    marginHorizontal: 10,
    color: '#666',
  },
  errorInput: {
    borderWidth: 2,
    borderColor: '#ff4444',
  },
});