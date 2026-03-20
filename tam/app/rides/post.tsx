import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Localization from 'expo-localization';
import { useRideStore } from '@/store/ride-store';
import { useAuthStore } from '@/store/auth-store';
import { useLocationStore } from '@/store/location-store';
import { TransportTypeSelector } from '@/components/TransportTypeSelector';

export default function PostRideScreen() {
  const user = useAuthStore(state => state.user);
  const addRide = useRideStore(state => state.addRide);
  const lastSearchParams = useRideStore(state => state.lastSearchParams);
  const currentLocation = useLocationStore(state => state.currentLocation);
  const startLocationTracking = useLocationStore(state => state.startLocationTracking);
  
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [price, setPrice] = useState('');
  const [transportType, setTransportType] = useState<'car' | 'motorbike'>('motorbike');
  const [pricePlaceholder, setPricePlaceholder] = useState<string>('Price');
  
  useEffect(() => {
    if (lastSearchParams) {
      setFrom(lastSearchParams.from);
      setTo(lastSearchParams.to);
      setTransportType(lastSearchParams.transportType);
      if (lastSearchParams.price) {
        setPrice(lastSearchParams.price.toString());
      }
    }
  }, [lastSearchParams]);

  useEffect(() => {
    startLocationTracking();
  }, [startLocationTracking]);

  useEffect(() => {
    const getCurrencyAndLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          const geocode = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          
          if (geocode.length > 0) {
            const country = geocode[0].country;
            
            if (country === 'Rwanda') {
              setPricePlaceholder('Price (RWF)');
            } else {
              const locale = Localization.getLocales()[0];
              const currencyCode = locale?.currencyCode || '';
              if (currencyCode) {
                setPricePlaceholder(`Price (${currencyCode})`);
              } else {
                setPricePlaceholder('Price');
              }
            }
          } else {
            setPricePlaceholder('Price');
          }
        } else {
          const locale = Localization.getLocales()[0];
          const currencyCode = locale?.currencyCode || '';
          if (currencyCode) {
            setPricePlaceholder(`Price (${currencyCode})`);
          } else {
            setPricePlaceholder('Price');
          }
        }
      } catch (error) {
        console.log('Error getting location or currency:', error);
        setPricePlaceholder('Price');
      }
    };
    
    getCurrencyAndLocation();
  }, []);
  
  const handlePost = () => {
    if (from && to && price) {
      const rideData: Parameters<typeof addRide>[0] = {
        from,
        to,
        price: Number(price),
        transportType,
        driverId: user?.type === 'driver' ? user.id : null,
        passengerId: user?.type === 'passenger' ? user.id : null,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      if (currentLocation) {
        rideData.pickupLocation = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          address: from,
        };
      }
      addRide(rideData);
      router.replace('/home');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <ChevronLeft color="#333" size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Post a Ride</Text>
          </View>
          
          <View style={styles.formContainer}>
            <TransportTypeSelector
              selected={transportType}
              onSelect={setTransportType}
            />
            
            <TextInput
              style={styles.input}
              placeholder="From"
              placeholderTextColor="#999"
              value={from}
              onChangeText={setFrom}
            />
            
            <TextInput
              style={styles.input}
              placeholder="To"
              placeholderTextColor="#999"
              value={to}
              onChangeText={setTo}
            />
            
            <TextInput
              style={styles.input}
              placeholder={pricePlaceholder}
              placeholderTextColor="#999"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
            />
            
            <TouchableOpacity 
              style={styles.postButton}
              onPress={handlePost}
            >
              <Text style={styles.postButtonText}>Post a Ride</Text>
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  formContainer: {
    padding: 20,
  },
  input: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 30,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  postButton: {
    backgroundColor: '#333',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 10,
  },
  postButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});