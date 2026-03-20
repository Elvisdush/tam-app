import React, { useEffect, useState, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Navigation, MapPin, Route, Clock, ArrowRight, X, Search, AlertCircle } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { useLocationStore } from '@/store/location-store';
import { useAuthStore } from '@/store/auth-store';
import NativeMapViewFull from '@/components/NativeMapViewFull';
import { getNearbyTrafficLights } from '@/constants/traffic-light-locations';
interface LocationSuggestion {
  name: string;
  address: string;
  distance: string;
  time: string;
  latitude: number;
  longitude: number;
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyCEmqLGnM67YcXjxkfbJaOICB3-dodxj4U';

/** Safely get string from route params (can be string | string[] | undefined) */
function safeParam(p: string | string[] | undefined): string {
  return typeof p === 'string' ? p : Array.isArray(p) ? (p[0] ?? '') : '';
}

export default function MapScreen() {
  const params = useLocalSearchParams();
  const { showLocation, latitude, longitude, senderId, address } = params;
  const addressStr = safeParam(address);
  const [showDirections, setShowDirections] = useState(false);
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const [isNavigationMode, setIsNavigationMode] = useState(false);
  
  const { 
    currentLocation, 
    startLocationTracking, 
    currentRoute, 
    isCalculatingRoute,
    calculateRoute,
    clearRoute
  } = useLocationStore();
  const user = useAuthStore(state => state.user);
  
  const sharedLat = latitude ? parseFloat(latitude as string) : null;
  const sharedLng = longitude ? parseFloat(longitude as string) : null;

  const nearbyTrafficLights = currentLocation
    ? getNearbyTrafficLights(currentLocation.latitude, currentLocation.longitude, 8)
    : [];
  
  useEffect(() => {
    const trackLocation = async () => {
      await startLocationTracking();
    };
    trackLocation();
    
    if (showLocation === 'true' && sharedLat && sharedLng && currentLocation) {
      const destination = {
        latitude: sharedLat,
        longitude: sharedLng,
        timestamp: new Date().toISOString(),
        address: addressStr
      };
      
      calculateRoute(currentLocation, destination).then((route) => {
        if (route) {
          setShowDirections(true);
        }
      });
      
      const interval = setInterval(() => {
        if (currentLocation) {
          calculateRoute(currentLocation, destination);
        }
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [showLocation, sharedLat, sharedLng, currentLocation, addressStr, calculateRoute, startLocationTracking]);
  
  useEffect(() => {
    return () => {
      if (showLocation !== 'true') {
        clearRoute();
      }
    };
  }, [showLocation, clearRoute]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (searchText.length < 3) {
      setSuggestions([]);
      setHasSearched(false);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }
    if (!currentLocation) {
      setSuggestions([]);
      setHasSearched(true);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      fetchLocationSuggestions(searchText);
      setHasSearched(true);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchText, currentLocation]);

  const fetchLocationSuggestions = async (query: string) => {
    if (!currentLocation) return;

    setIsLoadingSuggestions(true);
    try {
      // Places API (New) - Autocomplete
      const autocompleteResponse = await fetch(
        'https://places.googleapis.com/v1/places:autocomplete',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
            'X-Goog-FieldMask': 'suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.mainText',
          },
          body: JSON.stringify({
            input: query,
            locationBias: {
              circle: {
                center: {
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                },
                radius: 50000.0,
              },
            },
          }),
        }
      );

      const autocompleteData = await autocompleteResponse.json();

      if (!autocompleteData.suggestions || autocompleteData.suggestions.length === 0) {
        setSuggestions([]);
        return;
      }

      const placePredictions = autocompleteData.suggestions.filter(
        (s: any) => s.placePrediction && s.placePrediction.place
      );

      if (placePredictions.length === 0) {
        setSuggestions([]);
        return;
      }

      const suggestionsWithDetails = await Promise.all(
        placePredictions.slice(0, 5).map(async (item: any) => {
          try {
            const pred = item.placePrediction;
            const placeResource = pred.place; // "places/ChIJ..."
            const placeId = placeResource.startsWith('places/') ? placeResource.slice(7) : placeResource;

            // Place Details (New) - GET
            const detailsResponse = await fetch(
              `https://places.googleapis.com/v1/places/${placeId}`,
              {
                headers: {
                  'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                  'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,viewport',
                },
              }
            );

            const placeDetails = await detailsResponse.json();

            let destLat: number | null = null;
            let destLng: number | null = null;

            if (placeDetails.location) {
              destLat = placeDetails.location.latitude ?? placeDetails.location.lat ?? null;
              destLng = placeDetails.location.longitude ?? placeDetails.location.lng ?? null;
            }
            if ((destLat == null || destLng == null) && placeDetails.viewport) {
              const v = placeDetails.viewport;
              const low = v.low ?? v.southwest;
              const high = v.high ?? v.northeast;
              if (low && high) {
                destLat = (low.latitude + high.latitude) / 2;
                destLng = (low.longitude + high.longitude) / 2;
              }
            }
            if (destLat == null || destLng == null) return null;

            const distance = calculateDistance(
              currentLocation.latitude,
              currentLocation.longitude,
              destLat,
              destLng
            );
            const time = Math.ceil((distance / 40) * 60);
            const name = placeDetails.displayName?.text ?? pred.mainText?.text ?? pred.text?.text ?? 'Place';
            const address = placeDetails.formattedAddress ?? pred.text?.text ?? '';

            return {
              name,
              address,
              distance: `${distance.toFixed(1)} km`,
              time: `${time} min`,
              latitude: destLat,
              longitude: destLng,
            };
          } catch {
            return null;
          }
        })
      );

      setSuggestions(suggestionsWithDetails.filter((s): s is LocationSuggestion => s !== null));
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

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

  const handleSelectLocation = async (suggestion: LocationSuggestion) => {
    setSearchText(suggestion.name);
    setSuggestions([]);
    setIsFocused(false);
    Keyboard.dismiss();
    
    if (currentLocation) {
      const destination = {
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        timestamp: new Date().toISOString(),
        address: suggestion.address
      };
      
      setSelectedDestination(destination);
      
      const route = await calculateRoute(currentLocation, destination);
      if (route) {
        setShowDirections(true);
      } else {
        Alert.alert('Error', 'Could not calculate route. Please try again.');
      }
    }
  };

  const handleSearch = async () => {
    if (suggestions.length > 0) {
      handleSelectLocation(suggestions[0]);
    }
  };
  
  const handleGetDirections = async () => {
    if (sharedLat && sharedLng && currentLocation) {
      const destination = {
        latitude: sharedLat,
        longitude: sharedLng,
        timestamp: new Date().toISOString(),
        address: addressStr
      };
      
      const route = await calculateRoute(currentLocation, destination);
      if (route) {
        setShowDirections(true);
      } else {
        Alert.alert('Error', 'Could not calculate route. Please try again.');
      }
    } else if (!currentLocation) {
      Alert.alert('Location Required', 'Please enable location services to get directions.');
    }
  };
  
  const handleShowRouteDetails = () => {
    setShowRouteDetails(true);
  };
  
  const handleCloseRouteDetails = () => {
    setShowRouteDetails(false);
  };
  
  const handleStartNavigation = () => {
    setIsNavigationMode(true);
    setShowRouteDetails(false);
  };

  const handleReport = () => {
    Alert.alert(
      'Report',
      'What do you see?',
      [
        { text: 'Traffic', onPress: () => Alert.alert('Thanks', 'Report submitted') },
        { text: 'Accident', onPress: () => Alert.alert('Thanks', 'Report submitted') },
        { text: 'Hazard', onPress: () => Alert.alert('Thanks', 'Report submitted') },
        { text: 'Police', onPress: () => Alert.alert('Thanks', 'Report submitted') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const getEtaTime = () => {
    const now = new Date();
    if (currentRoute?.duration) {
      const match = currentRoute.duration.match(/(\d+)\s*min/);
      if (match) {
        now.setMinutes(now.getMinutes() + parseInt(match[1], 10));
      }
    }
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <TouchableWithoutFeedback onPress={() => {
        Keyboard.dismiss();
        setIsFocused(false);
      }}>
        <View style={styles.mapContainer}>
          <NativeMapViewFull
            currentLocation={currentLocation}
            sharedLat={selectedDestination?.latitude || sharedLat}
            sharedLng={selectedDestination?.longitude || sharedLng}
            address={selectedDestination?.address || addressStr}
            showLocation={showLocation === 'true' || !!selectedDestination}
            showDirections={showDirections}
            currentRoute={currentRoute}
            isNavigationMode={isNavigationMode}
            trafficLights={nearbyTrafficLights}
          />
        
        {showLocation === 'true' && sharedLat && sharedLng && (
          <View style={styles.locationInfoPanel}>
            <View style={styles.locationHeader}>
              <MapPin color="#007AFF" size={20} />
              <Text style={styles.locationTitle}>{addressStr || 'Shared Location'}</Text>
            </View>
            <Text style={styles.locationSubtitle}>
              Shared by {safeParam(senderId) === user?.id ? 'You' : 'Contact'}
            </Text>
            {isCalculatingRoute && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadingText}>Calculating route...</Text>
              </View>
            )}
            {showDirections && currentRoute && (
              <View style={styles.routeInfoContainer}>
                <View style={styles.routeInfo}>
                  <View style={styles.routeDetail}>
                    <Route color="#666" size={16} />
                    <Text style={styles.routeText}>{String(currentRoute.distance ?? '')}</Text>
                  </View>
                  <View style={styles.routeDetail}>
                    <Clock color="#666" size={16} />
                    <Text style={styles.routeText}>{String(currentRoute.duration ?? '')}</Text>
                  </View>
                </View>
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity 
                    style={styles.routeDetailsButton}
                    onPress={handleShowRouteDetails}
                  >
                    <Text style={styles.routeDetailsButtonText}>View Steps</Text>
                    <ArrowRight color="#007AFF" size={14} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.goButton}
                    onPress={handleStartNavigation}
                  >
                    <Navigation color="white" size={18} />
                    <Text style={styles.goButtonText}>Go</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {!showDirections && !isCalculatingRoute && (
              <TouchableOpacity style={styles.directionsButton} onPress={handleGetDirections}>
                <Navigation color="white" size={16} />
                <Text style={styles.directionsButtonText}>Get Directions</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Waze-style top search bar */}
        <View style={styles.topSearchBar}>
          <TextInput
            style={styles.wazeSearchInput}
            placeholder="Where to?"
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
            onFocus={() => setIsFocused(true)}
          />
          <TouchableOpacity style={styles.wazeSearchButton} onPress={handleSearch}>
            <Search color="white" size={20} />
          </TouchableOpacity>
        </View>

        {isFocused && (
          <View style={styles.wazeSuggestionsPanel}>
            <ScrollView style={styles.suggestionsList}>
              {isLoadingSuggestions ? (
                <View style={styles.suggestionEmptyState}>
                  <ActivityIndicator size="small" color="#33ccff" />
                  <Text style={styles.suggestionEmptyText}>Searching places...</Text>
                </View>
              ) : suggestions.length > 0 ? (
                suggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={`${suggestion.latitude}-${suggestion.longitude}-${index}`}
                    style={styles.suggestionItem}
                    onPress={() => handleSelectLocation(suggestion)}
                  >
                    <MapPin color="#33ccff" size={24} />
                    <View style={styles.suggestionContent}>
                      <Text style={styles.suggestionName}>{String(suggestion.name ?? '')}</Text>
                      <Text style={styles.suggestionAddress}>{String(suggestion.address ?? '')}</Text>
                    </View>
                    <Text style={styles.suggestionDistance}>{String(suggestion.distance ?? '')}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.suggestionEmptyState}>
                  <Text style={styles.suggestionEmptyText}>
                    {searchText.length < 3
                      ? 'Type at least 3 characters to search'
                      : !currentLocation
                        ? 'Enable location to search nearby places'
                        : 'No places found. Try a different search.'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* Waze-style bottom ETA panel */}
        {(showDirections || selectedDestination) && currentRoute && (
          <View style={styles.wazeEtaPanel}>
            <View style={styles.wazeEtaMain}>
              <Text style={styles.wazeEtaTime}>{String(getEtaTime())}</Text>
              <Text style={styles.wazeEtaLabel}>Arrival</Text>
            </View>
            <View style={styles.wazeEtaDivider} />
            <View style={styles.wazeEtaSecondary}>
              <View style={styles.wazeEtaRow}>
                <Clock color="#fff" size={18} />
                <Text style={styles.wazeEtaValue}>{String(currentRoute.duration ?? '')}</Text>
              </View>
              <View style={styles.wazeEtaRow}>
                <Route color="#fff" size={18} />
                <Text style={styles.wazeEtaValue}>{String(currentRoute.distance ?? '')}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.wazeGoButton} onPress={handleStartNavigation}>
              <Navigation color="#fff" size={22} />
              <Text style={styles.wazeGoText}>Start</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Waze-style report button - top right */}
        <TouchableOpacity style={styles.reportButton} onPress={handleReport} activeOpacity={0.8}>
          <AlertCircle color="#fff" size={24} />
        </TouchableOpacity>

        
        {showRouteDetails && currentRoute && (
          <View style={styles.routeDetailsModal}>
            <View style={styles.routeDetailsContent}>
              <View style={styles.routeDetailsHeader}>
                <Text style={styles.routeDetailsTitle}>Route Details</Text>
                <TouchableOpacity onPress={handleCloseRouteDetails}>
                  <X color="#666" size={24} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.routeSummary}>
                <View style={styles.routeSummaryItem}>
                  <Route color="#007AFF" size={20} />
                  <Text style={styles.routeSummaryText}>{String(currentRoute.distance ?? '')}</Text>
                </View>
                <View style={styles.routeSummaryItem}>
                  <Clock color="#007AFF" size={20} />
                  <Text style={styles.routeSummaryText}>{String(currentRoute.duration ?? '')}</Text>
                </View>
              </View>
              
              <ScrollView style={styles.routeStepsContainer}>
                {currentRoute.steps.map((step, index) => (
                  <View key={index} style={styles.routeStep}>
                    <View style={styles.routeStepNumber}>
                      <Text style={styles.routeStepNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.routeStepContent}>
                      <Text style={styles.routeStepInstruction}>{String(step.instruction ?? '')}</Text>
                      <View style={styles.routeStepDetails}>
                        <Text style={styles.routeStepDistance}>{String(step.distance ?? '')}</Text>
                        <Text style={styles.routeStepDuration}>• {String(step.duration ?? '')}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  topSearchBar: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  wazeSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 4,
  },
  wazeSearchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#33ccff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wazeSuggestionsPanel: {
    position: 'absolute',
    top: 115,
    left: 16,
    right: 16,
    maxHeight: 320,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  wazeEtaPanel: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  wazeEtaMain: {
    alignItems: 'center',
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.3)',
  },
  wazeEtaTime: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  wazeEtaLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  wazeEtaDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 16,
  },
  wazeEtaSecondary: {
    flex: 1,
    gap: 8,
  },
  wazeEtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wazeEtaValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  wazeGoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#33ccff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  wazeGoText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  reportButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  mapBackground: {
    flex: 1,
    backgroundColor: '#2c3e50',
    position: 'relative',
  },
  streetLine: {
    position: 'absolute',
    backgroundColor: '#4a5568',
    height: 2,
  },
  streetName: {
    position: 'absolute',
    fontSize: 11,
    color: '#a0aec0',
    fontWeight: '500' as const,
  },
  locationLabel: {
    position: 'absolute',
    alignItems: 'center',
  },
  locationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4299e1',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 10,
    color: '#e2e8f0',
    textAlign: 'center',
    fontWeight: '500' as const,
  },
  areaName: {
    fontSize: 16,
    color: '#e2e8f0',
    fontWeight: '600' as const,
  },
  userLocation: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userLocationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3182ce',
    borderWidth: 3,
    borderColor: 'white',
    zIndex: 2,
  },
  userLocationPulse: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(49, 130, 206, 0.3)',
    zIndex: 1,
  },
  compass: {
    position: 'absolute',
    bottom: 120,
    left: 20,
  },
  compassCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  compassArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#e53e3e',
  },
  navigationIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -30 }, { translateY: -40 }],
    alignItems: 'center',
  },
  navigationArrowContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  navigationArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 15,
    borderRightWidth: 15,
    borderBottomWidth: 30,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#007AFF',
  },
  navigationText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#007AFF',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  searchContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchInput: {
    color: 'white',
    fontSize: 16,
    paddingVertical: 8,
  },
  micButton: {
    position: 'absolute',
    right: 20,
    top: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionsContainer: {
    marginTop: 15,
    backgroundColor: 'white',
    borderRadius: 15,
    maxHeight: 300,
    overflow: 'hidden',
  },
  suggestionsList: {
    flex: 1,
  },
  suggestionItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  suggestionEmptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  suggestionEmptyText: {
    fontSize: 15,
    color: '#666',
  },
  suggestionContent: {
    flex: 1,
    marginLeft: 12,
  },
  suggestionName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 4,
  },
  suggestionAddress: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
  },
  suggestionMeta: {
    alignItems: 'flex-end',
  },
  suggestionDistance: {
    fontSize: 16,
    color: '#000',
    fontWeight: '400' as const,
  },
  suggestionTime: {
    fontSize: 12,
    color: '#999',
  },
  sharedLocation: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedLocationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ff4444',
    borderWidth: 3,
    borderColor: 'white',
    zIndex: 2,
  },
  destinationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00cc00',
    borderWidth: 3,
    borderColor: 'white',
    zIndex: 2,
  },
  sharedLocationLabel: {
    fontSize: 10,
    color: '#e2e8f0',
    fontWeight: '600' as const,
    marginTop: 4,
    textAlign: 'center',
  },
  routeLine: {
    position: 'absolute',
    top: '55%',
    left: '50%',
    width: 200,
    height: 2,
    backgroundColor: '#007AFF',
    transform: [{ rotate: '45deg' }],
    opacity: 0.8,
  },
  locationInfoPanel: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  locationSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  routeInfoContainer: {
    gap: 12,
  },
  routeInfo: {
    flexDirection: 'row',
    gap: 20,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  routeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  routeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500' as const,
  },
  directionsButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    gap: 8,
  },
  directionsButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  routeWaypoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: 'white',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  routeDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  routeDetailsButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600' as const,
  },
  goButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  goButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600' as const,
  },
  routeDetailsModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  routeDetailsContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingTop: 20,
  },
  routeDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  routeDetailsTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#333',
  },
  routeSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
  },
  routeSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeSummaryText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#333',
  },
  routeStepsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  routeStep: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  routeStepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  routeStepNumberText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  routeStepContent: {
    flex: 1,
  },
  routeStepInstruction: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  routeStepDetails: {
    flexDirection: 'row',
    gap: 10,
  },
  routeStepDistance: {
    fontSize: 14,
    color: '#666',
  },
  routeStepDuration: {
    fontSize: 14,
    color: '#666',
  },
});
