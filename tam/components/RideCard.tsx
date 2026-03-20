import React from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, Alert } from 'react-native';
import { Ride } from '@/types/ride';
import { useAuthStore } from '@/store/auth-store';
import { useRideStore } from '@/store/ride-store';
import { router } from 'expo-router';

interface RideCardProps {
  ride: Ride;
}

export function RideCard({ ride }: RideCardProps) {
  const user = useAuthStore(state => state.user);
  const users = useAuthStore(state => state.users);
  const acceptRide = useRideStore(state => state.acceptRide);
  
  const rideUser = users.find(u => 
    user?.type === 'driver' ? u.id === ride.passengerId : u.id === ride.driverId
  );
  
  const handleAcceptRide = () => {
    Alert.alert(
      "Confirm",
      `Are you sure you want to ${user?.type === 'driver' ? 'accept this passenger' : 'book this ride'}?`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Confirm", 
          onPress: () => {
            acceptRide(ride.firebaseKey ?? ride.id);
            router.push({
              pathname: '/rides/track',
              params: { rideId: ride.firebaseKey ?? String(ride.id) },
            });
          }
        }
      ]
    );
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handleAcceptRide}>
      <Image 
        source={{ uri: rideUser?.profileImage || 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop' }} 
        style={styles.avatar} 
      />
      
      <View style={styles.content}>
        <Text style={styles.username}>{rideUser?.username || 'Unknown User'}</Text>
        <Text style={styles.route}>{ride.from} to {ride.to}</Text>
        {ride.price > 0 && (
          <Text style={styles.price}>{ride.price} RWF</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  content: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  route: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3498db',
  },
});