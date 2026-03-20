import React from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useRideStore } from '@/store/ride-store';
import { RideCard } from '@/components/RideCard';

export default function RidesListScreen() {
  const searchResults = useRideStore(state => state.searchResults);
  
  const handlePostRide = () => {
    router.push('/rides/post');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ChevronLeft color="#333" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Posted</Text>
      </View>
      
      {searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <RideCard ride={item} />
          )}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No rides found for this route</Text>
        </View>
      )}
      
      <TouchableOpacity 
        style={styles.postButton}
        onPress={handlePostRide}
      >
        <Text style={styles.postButtonText}>Post a Ride</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
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
  listContent: {
    padding: 15,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  postButton: {
    backgroundColor: '#333',
    margin: 20,
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
  },
  postButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})