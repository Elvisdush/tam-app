import React from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, Alert } from 'react-native';
import { Car, Bike } from 'lucide-react-native';
import { Ride } from '@/types/ride';
import { useAuthStore } from '@/store/auth-store';
import { useRideStore } from '@/store/ride-store';
import { router } from 'expo-router';
import { formatPostedAgo } from '@/lib/format-time';

interface RideCardProps {
  ride: Ride;
}

export function RideCard({ ride }: RideCardProps) {
  const user = useAuthStore((state) => state.user);
  const users = useAuthStore((state) => state.users);
  const acceptRide = useRideStore((state) => state.acceptRide);

  const partnerId = user?.type === 'driver' ? ride.passengerId : ride.driverId;
  const rideUser = users.find((u) => u.id === partnerId);

  const isOwnListing =
    (user?.type === 'passenger' && ride.passengerId === user.id) ||
    (user?.type === 'driver' && ride.driverId === user.id);

  const isPending = ride.status === 'pending' || ride.status === 'scheduled';

  const handleAccept = () => {
    if (!isPending || isOwnListing) return;
    const actionLabel = user?.type === 'driver' ? 'accept this passenger request' : 'book this driver';
    Alert.alert('Confirm', `Are you sure you want to ${actionLabel}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () => {
          acceptRide(ride.firebaseKey ?? ride.id);
          router.push({
            pathname: '/rides/track',
            params: { rideId: String(ride.firebaseKey ?? ride.id) },
          });
        },
      },
    ]);
  };

  const transportLabel = ride.transportType === 'car' ? 'Taxi car' : 'Taxi moto';

  return (
    <View style={styles.card}>
      <Image
        source={{
          uri:
            rideUser?.profileImage ||
            'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop',
        }}
        style={styles.avatar}
      />

      <View style={styles.middle}>
        <View style={styles.titleRow}>
          <Text style={styles.username} numberOfLines={1}>
            {isOwnListing ? 'Your post' : rideUser?.username ?? 'User'}
          </Text>
          <View style={[styles.modeBadge, ride.transportType === 'car' ? styles.modeCar : styles.modeMoto]}>
            {ride.transportType === 'car' ? (
              <Car color="#fff" size={12} style={styles.modeBadgeIcon} />
            ) : (
              <Bike color="#fff" size={12} style={styles.modeBadgeIcon} />
            )}
            <Text style={styles.modeBadgeText}>{transportLabel}</Text>
          </View>
        </View>

        <Text style={styles.route} numberOfLines={2}>
          <Text style={styles.routeStrong}>{ride.from}</Text>
          {' → '}
          <Text style={styles.routeStrong}>{ride.to}</Text>
        </Text>

        <View style={styles.metaRow}>
          {ride.price > 0 && (
            <Text style={[styles.price, styles.metaPrice]}>{Number(ride.price).toLocaleString()} RWF</Text>
          )}
          <Text style={styles.posted}>{formatPostedAgo(ride.createdAt)}</Text>
        </View>

        {ride.status !== 'pending' && ride.status !== 'scheduled' && (
          <Text style={styles.statusTag}>Status: {ride.status}</Text>
        )}
        {ride.status === 'scheduled' && ride.scheduledPickupAt && (
          <Text style={styles.statusTag}>Pickup: {new Date(ride.scheduledPickupAt).toLocaleString()}</Text>
        )}
      </View>

      <View style={styles.actionCol}>
        {!isOwnListing && isPending && (
          <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.85}>
            <Text style={styles.acceptBtnText}>{user?.type === 'driver' ? 'Accept' : 'Book'}</Text>
          </TouchableOpacity>
        )}
        {isOwnListing && (
          <Text style={styles.ownHint}>Your listing</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    backgroundColor: '#e2e8f0',
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  username: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flexShrink: 1,
    marginRight: 8,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  modeBadgeIcon: {
    marginRight: 4,
  },
  modeCar: {
    backgroundColor: '#16a34a',
  },
  modeMoto: {
    backgroundColor: '#ea580c',
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  route: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 6,
  },
  routeStrong: {
    fontWeight: '600',
    color: '#334155',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563eb',
  },
  metaPrice: {
    marginRight: 10,
  },
  posted: {
    fontSize: 12,
    color: '#94a3b8',
  },
  statusTag: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
  },
  actionCol: {
    justifyContent: 'center',
    minWidth: 88,
    alignItems: 'flex-end',
  },
  acceptBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  acceptBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  ownHint: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
});
