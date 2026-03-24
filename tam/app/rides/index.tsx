import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, Search, MapPin, Car, Bike } from 'lucide-react-native';
import { router } from 'expo-router';
import { useRideStore } from '@/store/ride-store';
import { RideCard } from '@/components/RideCard';
import type { Ride } from '@/types/ride';

export default function RidesListScreen() {
  const searchResults = useRideStore((state) => state.searchResults);
  const lastSearchParams = useRideStore((state) => state.lastSearchParams);
  const searchRides = useRideStore((state) => state.searchRides);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (lastSearchParams) {
      searchRides(
        lastSearchParams.from,
        lastSearchParams.to,
        lastSearchParams.price,
        lastSearchParams.transportType
      );
    }
    setTimeout(() => setRefreshing(false), 400);
  }, [lastSearchParams, searchRides]);

  const handlePostRide = () => {
    router.push('/rides/post');
  };

  const goEditSearch = () => {
    router.push('/home');
  };

  const keyExtractor = useCallback((item: Ride) => String(item.firebaseKey ?? item.id), []);

  const transportLabel =
    lastSearchParams?.transportType === 'car' ? 'Taxi car' : 'Taxi moto';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft color="#0f172a" size={24} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Posted rides</Text>
          <Text style={styles.headerSubtitle}>Matches for your search</Text>
        </View>
      </View>

      {lastSearchParams ? (
        <View style={styles.searchCard}>
          <View style={styles.searchCardRow}>
            <Search color="#64748b" size={18} style={styles.searchCardIcon} />
            <Text style={styles.searchCardTitle}>Your search</Text>
          </View>
          <View style={styles.routeLine}>
            <MapPin color="#2563eb" size={16} style={styles.routeLineIcon} />
            <Text style={styles.routeText} numberOfLines={2}>
              {lastSearchParams.from} → {lastSearchParams.to}
            </Text>
          </View>
          <View style={styles.searchMeta}>
            <View style={styles.modePill}>
              {lastSearchParams.transportType === 'car' ? (
                <Car color="#16a34a" size={14} style={styles.modePillIcon} />
              ) : (
                <Bike color="#ea580c" size={14} style={styles.modePillIcon} />
              )}
              <Text style={styles.modePillText}>{transportLabel}</Text>
            </View>
            {lastSearchParams.price != null && lastSearchParams.price > 0 && (
              <Text style={styles.priceHint}>
                Near {Number(lastSearchParams.price).toLocaleString()} RWF
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.editSearchBtn} onPress={goEditSearch} activeOpacity={0.85}>
            <Text style={styles.editSearchText}>Edit search on Home</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.noSearchBanner}>
          <Text style={styles.noSearchText}>
            No search yet. Use Home to set From, destination, vehicle type and price — then open Posted
            again.
          </Text>
          <TouchableOpacity style={styles.editSearchBtn} onPress={goEditSearch}>
            <Text style={styles.editSearchText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.listWrap}>
        {lastSearchParams && searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            keyExtractor={keyExtractor}
            renderItem={({ item }) => <RideCard ride={item} />}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />
        ) : lastSearchParams ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No rides match</Text>
            <Text style={styles.emptyBody}>
              Try widening your From/To text, switching taxi car / moto, or posting your own ride.
            </Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={goEditSearch}>
              <Text style={styles.secondaryBtnText}>Adjust search</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <TouchableOpacity style={styles.postButton} onPress={handlePostRide} activeOpacity={0.9}>
        <Text style={styles.postButtonText}>Post a ride</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    marginRight: 8,
    padding: 4,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  searchCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchCardIcon: {
    marginRight: 8,
  },
  searchCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  routeLineIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  routeText: {
    flex: 1,
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
    fontWeight: '500',
  },
  searchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: 12,
  },
  modePillIcon: {
    marginRight: 6,
  },
  modePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  priceHint: {
    fontSize: 13,
    color: '#64748b',
  },
  editSearchBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  editSearchText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563eb',
  },
  noSearchBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  noSearchText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
    marginBottom: 10,
  },
  listWrap: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  secondaryBtn: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  postButton: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#0f172a',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  postButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});
