import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import { useRideStore } from '@/store/ride-store';
import { TransportTypeSelector } from '@/components/TransportTypeSelector';
import { useLocationStore } from '@/store/location-store';
import NativeMapView from '@/components/NativeMapView';

export default function HomeScreen() {
  const user = useAuthStore(state => state.user);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [price, setPrice] = useState('');
  const [transportType, setTransportType] = useState<'car' | 'motorbike'>('motorbike');
  
  const searchRides = useRideStore(state => state.searchRides);
  const getNearbyAvailableDrivers = useRideStore(state => state.getNearbyAvailableDrivers);
  const { currentLocation, startLocationTracking } = useLocationStore();
  const rides = useRideStore(state => state.rides);
  
  useEffect(() => {
    startLocationTracking();
  }, [startLocationTracking]);

  const nearbyCounts = useMemo(() => {
    if (!currentLocation) return null;
    const { moto, car } = getNearbyAvailableDrivers(
      currentLocation.latitude,
      currentLocation.longitude
    );
    return { moto: moto.length, car: car.length };
  }, [currentLocation, rides, getNearbyAvailableDrivers]);
  
  const handleSearch = () => {
    if (from && to) {
      searchRides(from, to, user?.type === 'passenger' ? Number(price) : undefined, transportType);
      router.push('/rides');
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
      <View style={styles.mapPreview}>
        <NativeMapView currentLocation={currentLocation} />
      </View>
      
      <View style={styles.searchContainer}>
        {user?.type === 'passenger' && (
          <>
            <Text style={styles.sectionLabel}>Who&apos;s nearby?</Text>
            <TransportTypeSelector
              selected={transportType}
              onSelect={setTransportType}
              nearbyCounts={nearbyCounts ?? undefined}
            />
          </>
        )}
        
        <TextInput
          style={styles.input}
          placeholder="From"
          placeholderTextColor="#999"
          value={from}
          onChangeText={setFrom}
        />
        
        <TextInput
          style={styles.input}
          placeholder="To?"
          placeholderTextColor="#999"
          value={to}
          onChangeText={setTo}
        />
        
        {user?.type === 'passenger' && (
          <TextInput
            style={styles.input}
            placeholder="RWF"
            placeholderTextColor="#999"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
        )}
        
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={handleSearch}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
        
        {user?.type === 'driver' && (
          <TouchableOpacity 
            style={styles.nearbyButton}
            onPress={() => router.push('/nearby')}
          >
            <Text style={styles.nearbyButtonText}>Near By</Text>
          </TouchableOpacity>
        )}
      </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  mapPreview: {
    flex: 1,
    width: '100%',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  searchContainer: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 30,
    marginBottom: 10,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#333',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 5,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  nearbyButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 10,
  },
  nearbyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3498db',
  },
  tabIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
});