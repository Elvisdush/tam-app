import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useLocationStore } from '@/store/location-store';
import { useRideStore } from '@/store/ride-store';
import { useAuthStore } from '@/store/auth-store';
import NativeMapViewNearby from '@/components/NativeMapViewNearby';


interface NearbyPassenger {
  id: string;
  rideId: string;
  name: string;
  profileImage: string;
  from: string;
  to: string;
  price: string;
  distance: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};



export default function NearbyScreen() {
  const [selectedPassenger, setSelectedPassenger] = useState<NearbyPassenger | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [nearbyPassengers, setNearbyPassengers] = useState<NearbyPassenger[]>([]);
  const { currentLocation, startLocationTracking } = useLocationStore();
  const { rides, loadRides, acceptRide } = useRideStore();
  const user = useAuthStore(state => state.user);
  
  useEffect(() => {
    startLocationTracking();
    loadRides();
  }, []);
  
  useEffect(() => {
    const now = new Date().getTime();
    const thirtyMinutes = 30 * 60 * 1000;
    
    const activePassengerRides = rides.filter(ride => {
      const createdAt = new Date(ride.createdAt).getTime();
      const isExpired = (now - createdAt) > thirtyMinutes;
      
      if (isExpired) return false;
      
      if (user?.type === 'driver') {
        return ride.passengerId !== null && ride.passengerId !== undefined;
      }
      
      return false;
    });
    
    if (currentLocation && activePassengerRides.length > 0) {
        const passengersWithDistance = activePassengerRides.map(ride => {
          const rideLocation = ride.pickupLocation
            ? { latitude: ride.pickupLocation.latitude, longitude: ride.pickupLocation.longitude }
            : {
                latitude: currentLocation.latitude + (Math.random() - 0.5) * 0.02,
                longitude: currentLocation.longitude + (Math.random() - 0.5) * 0.02,
              };
        
        const distance = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          rideLocation.latitude,
          rideLocation.longitude
        );
        
        return {
          id: ride.id?.toString() || Math.random().toString(),
          rideId: ride.firebaseKey ?? String(ride.id),
          name: ride.passengerName || 'Passenger',
          profileImage: ride.passengerProfileImage || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=1374&auto=format&fit=crop',
          from: ride.from,
          to: ride.to,
          price: `${ride.price} RWF`,
          distance: `${distance.toFixed(1)} km`,
          location: rideLocation
        };
      }).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
      
      setNearbyPassengers(passengersWithDistance);
    } else {
      setNearbyPassengers([]);
    }
  }, [currentLocation, rides, user]);
  
  const handlePassengerPress = (passenger: NearbyPassenger) => {
    setSelectedPassenger(passenger);
    setShowModal(true);
  };
  
  const handleTakePassenger = () => {
    if (selectedPassenger) {
      setShowModal(false);
      const rideId = selectedPassenger.rideId;
      acceptRide(rideId);
      router.push({
        pathname: '/rides/track',
        params: { rideId },
      });
    }
  };
  
  const renderPassengerItem = ({ item }: { item: NearbyPassenger }) => (
    <TouchableOpacity 
      style={styles.passengerItem}
      onPress={() => handlePassengerPress(item)}
    >
      <Image source={{ uri: item.profileImage }} style={styles.passengerAvatar} />
      <View style={styles.passengerInfo}>
        <Text style={styles.passengerName}>{item.name}</Text>
        <Text style={styles.passengerLocation}>Near {item.from}</Text>
      </View>
      <View style={styles.distanceContainer}>
        <Text style={styles.distance}>{item.distance}</Text>
        <View style={styles.arrow}>
          <Text style={styles.arrowText}>→</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ChevronLeft color="#333" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Near By Passengers</Text>
      </View>
      
      {/* Map View */}
      <View style={styles.mapContainer}>
        <NativeMapViewNearby
          currentLocation={currentLocation}
          passengers={nearbyPassengers}
          onPassengerPress={handlePassengerPress}
        />
        
        {/* Home button */}
        <TouchableOpacity style={styles.homeButton}>
          <View style={styles.homeIcon} />
        </TouchableOpacity>
      </View>
      
      {/* Passenger List */}
      <View style={styles.passengerList}>
        {nearbyPassengers.length > 0 ? (
          <FlatList
            data={nearbyPassengers}
            keyExtractor={(item) => item.id}
            renderItem={renderPassengerItem}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No nearby passengers</Text>
          </View>
        )}
      </View>
      
      {/* Passenger Details Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedPassenger && (
              <>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setShowModal(false)}
                >
                  <X color="#666" size={24} />
                </TouchableOpacity>
                
                <Image 
                  source={{ uri: selectedPassenger.profileImage }} 
                  style={styles.modalAvatar} 
                />
                
                <Text style={styles.modalName}>{selectedPassenger.name}</Text>
                
                <View style={styles.tripDetails}>
                  <Text style={styles.tripLabel}>From: <Text style={styles.tripValue}>{selectedPassenger.from}</Text></Text>
                  <Text style={styles.tripLabel}>To: <Text style={styles.tripValue}>{selectedPassenger.to}</Text></Text>
                  <Text style={styles.tripLabel}>Paying: <Text style={styles.tripValue}>{selectedPassenger.price}</Text></Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.takePassengerButton}
                  onPress={handleTakePassenger}
                >
                  <Text style={styles.takePassengerText}>Taking passenger</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    fontWeight: '600',
    color: '#333',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  homeButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#B19CD9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  homeIcon: {
    width: 20,
    height: 20,
    backgroundColor: 'white',
  },
  passengerList: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: 300,
  },
  passengerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  passengerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  passengerLocation: {
    fontSize: 14,
    color: '#666',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distance: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  arrow: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 16,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '85%',
    maxWidth: 350,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    left: 15,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 20,
  },
  modalName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  tripDetails: {
    alignSelf: 'stretch',
    marginBottom: 30,
  },
  tripLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  tripValue: {
    fontWeight: '600',
    color: '#333',
  },
  takePassengerButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  takePassengerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});