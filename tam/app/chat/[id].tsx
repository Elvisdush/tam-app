import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput, Image, KeyboardAvoidingView, Platform, Alert, Animated, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, Camera, Mic, Send, Play, Pause, MapPin, Navigation } from 'lucide-react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import { useChatStore } from '@/store/chat-store';
import { useLocationStore } from '@/store/location-store';
import * as ImagePicker from 'expo-image-picker';


export default function ChatScreen() {
  const { id, name, profileImage, from, to, price } = useLocalSearchParams();
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const recordingAnimation = useRef(new Animated.Value(1)).current;
  
  const user = useAuthStore(state => state.user);
  const users = useAuthStore(state => state.users);
  const { messages, sendMessage, deleteMessage, markAsRead } = useChatStore();
  const { shareLocation, startLocationTracking, stopLocationTracking, currentLocation, sharedLocations } = useLocationStore();
  
  // Use passed passenger data if available, otherwise fallback to users store
  const chatPartner = name && profileImage ? {
    id: id as string,
    username: name as string,
    profileImage: profileImage as string,
    from: from as string,
    to: to as string,
    price: price as string
  } : users.find(u => u.id === id);
  const chatMessages = messages.filter(m => 
    (m.senderId === user?.id && m.receiverId === id) ||
    (m.senderId === id && m.receiverId === user?.id)
  );

  const handleSendMessage = () => {
    if (message.trim() && user && id) {
      sendMessage({
        senderId: user.id,
        receiverId: id as string,
        content: message.trim(),
        timestamp: new Date().toISOString(),
        type: 'text'
      });
      setMessage('');
    }
  };

  const handleCameraPress = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && user && id) {
        sendMessage({
          senderId: user.id,
          receiverId: id as string,
          content: result.assets[0].uri,
          timestamp: new Date().toISOString(),
          type: 'image'
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleMicPressIn = () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Voice recording is not available on web');
      return;
    }
    
    setIsRecording(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(recordingAnimation, {
          toValue: 1.3,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(recordingAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handleMicPressOut = () => {
    if (Platform.OS === 'web') return;
    
    setIsRecording(false);
    recordingAnimation.stopAnimation();
    recordingAnimation.setValue(1);
    
    // Simulate sending voice message
    if (user && id) {
      sendMessage({
        senderId: user.id,
        receiverId: id as string,
        content: 'voice_message_' + Date.now(),
        timestamp: new Date().toISOString(),
        type: 'voice',
        duration: Math.floor(Math.random() * 30) + 5
      });
    }
  };

  const handleMessageLongPress = (messageId: string, senderId: string) => {
    Alert.alert(
      'Message Options',
      'Choose an action',
      [
        { text: 'Reply', onPress: () => console.log('Reply to message:', messageId) },
        ...(senderId === user?.id ? [{
          text: 'Delete',
          style: 'destructive' as const,
          onPress: () => deleteMessage(messageId)
        }] : []),
        { text: 'Cancel', style: 'cancel' as const }
      ]
    );
  };

  const handleVoicePlayPause = (messageId: string) => {
    if (playingVoiceId === messageId) {
      setPlayingVoiceId(null);
    } else {
      setPlayingVoiceId(messageId);
      // Simulate voice playback duration
      setTimeout(() => {
        setPlayingVoiceId(null);
      }, 3000);
    }
  };

  const handleShareLocation = async () => {
    try {
      const locationLink = await shareLocation(id as string, user?.id);
      if (locationLink && user) {
        // Send location message
        sendMessage({
          senderId: user.id,
          receiverId: id as string,
          content: locationLink,
          timestamp: new Date().toISOString(),
          type: 'location',
          location: currentLocation ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            address: currentLocation.address
          } : undefined
        });

        // Share the link
        if (Platform.OS === 'web') {
          await navigator.clipboard.writeText(locationLink);
          Alert.alert('Success', 'Location link copied to clipboard!');
        } else {
          await Share.share({
            message: `Here's my location: ${locationLink}`,
            title: 'My Location'
          });
        }
      } else {
        Alert.alert('Error', 'Could not get your location. Please check permissions.');
      }
    } catch (error) {
      console.log('Share location error:', error);
      Alert.alert('Error', 'Failed to share location');
    }
  };

  const handleLocationPress = async (locationMessage: any) => {
    if (locationMessage.location) {
      // Start tracking both sender and receiver locations for real-time updates
      startLocationTracking();
      
      // Navigate to map with location data
      router.push({
        pathname: '/(tabs)/map',
        params: {
          showLocation: 'true',
          latitude: locationMessage.location.latitude.toString(),
          longitude: locationMessage.location.longitude.toString(),
          senderId: locationMessage.senderId,
          address: locationMessage.location.address || 'Shared Location'
        }
      });
    } else {
      // Try to parse location from deep link
      const url = locationMessage.content;
      if (url.includes('lat=') && url.includes('lng=')) {
        const latMatch = url.match(/lat=([^&]+)/);
        const lngMatch = url.match(/lng=([^&]+)/);
        if (latMatch && lngMatch) {
          // Start tracking for real-time updates
          startLocationTracking();
          
          router.push({
            pathname: '/(tabs)/map',
            params: {
              showLocation: 'true',
              latitude: latMatch[1],
              longitude: lngMatch[1],
              senderId: locationMessage.senderId,
              address: 'Shared Location'
            }
          });
        }
      }
    }
  };

  useEffect(() => {
    // Start location tracking when chat opens for location sharing
    startLocationTracking();
    
    // Mark messages as read when chat opens
    if (user && id) {
      markAsRead(id as string, user.id);
    }
    
    return () => {
      // Keep location tracking active for shared locations
      // Only stop if no active shared locations
      const hasActiveSharedLocations = sharedLocations.some(loc => loc.isActive);
      if (!hasActiveSharedLocations) {
        stopLocationTracking();
      }
    };
  }, [sharedLocations, user, id, markAsRead, startLocationTracking, stopLocationTracking]);

  const renderMessage = ({ item }: { item: any }) => {
    const isMyMessage = item.senderId === user?.id;
    const isPlaying = playingVoiceId === item.id;
    
    return (
      <TouchableOpacity
        style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer]}
        onLongPress={() => handleMessageLongPress(item.id, item.senderId)}
        delayLongPress={500}
      >
        {!isMyMessage && (
          <Image 
            source={{ uri: chatPartner?.profileImage?.startsWith('blob:') ? 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop' : (chatPartner?.profileImage || 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop') }} 
            style={styles.messageAvatar}
            defaultSource={require('@/assets/images/icon.png')}
          />
        )}
        <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble]}>
          {item.type === 'image' ? (
            <Image 
              source={{ uri: item.content?.startsWith('blob:') ? 'https://images.unsplash.com/photo-1682686580391-615b1f28e6d1?q=80&w=1470&auto=format&fit=crop' : item.content }} 
              style={styles.messageImage}
              defaultSource={require('@/assets/images/icon.png')}
            />
          ) : item.type === 'location' ? (
            <TouchableOpacity 
              style={styles.locationMessageContainer}
              onPress={() => handleLocationPress(item)}
            >
              <MapPin color={isMyMessage ? "white" : "#007AFF"} size={20} />
              <View style={styles.locationTextContainer}>
                <Text style={[styles.locationTitle, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>
                  {item.location?.address || 'Shared Location'}
                </Text>
                <Text style={[styles.locationSubtitle, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>
                  Tap to view on map
                </Text>
              </View>
              <Navigation color={isMyMessage ? "white" : "#007AFF"} size={16} />
            </TouchableOpacity>
          ) : item.type === 'voice' ? (
            <View style={styles.voiceMessageContainer}>
              <TouchableOpacity 
                style={styles.voicePlayButton}
                onPress={() => handleVoicePlayPause(item.id)}
              >
                {isPlaying ? (
                  <Pause color={isMyMessage ? "white" : "#333"} size={16} />
                ) : (
                  <Play color={isMyMessage ? "white" : "#333"} size={16} />
                )}
              </TouchableOpacity>
              <View style={styles.voiceWaveform}>
                {[...Array(8)].map((_, i) => (
                  <View 
                    key={i} 
                    style={[
                      styles.waveformBar,
                      { 
                        height: Math.random() * 20 + 10,
                        backgroundColor: isMyMessage ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.3)'
                      }
                    ]} 
                  />
                ))}
              </View>
              <Text style={[styles.voiceDuration, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>
                {item.duration}s
              </Text>
            </View>
          ) : (
            <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>
              {item.content}
            </Text>
          )}
          <Text style={[styles.messageTime, isMyMessage ? styles.myMessageTime : styles.otherMessageTime]}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

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
        
        <Image 
          source={{ uri: chatPartner?.profileImage?.startsWith('blob:') ? 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop' : (chatPartner?.profileImage || 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop') }} 
          style={styles.headerAvatar}
          defaultSource={require('@/assets/images/icon.png')}
        />
        
        <Text style={styles.headerName}>{chatPartner?.username || 'Unknown User'}</Text>
        
        <TouchableOpacity 
          style={styles.shareLocationButton}
          onPress={handleShareLocation}
        >
          <Svg width="28" height="28" viewBox="0 0 24 24">
            <Circle cx="6" cy="6" r="3" fill="#007AFF" />
            <Circle cx="18" cy="18" r="3" fill="#007AFF" />
            <Path 
              d="M 8.5 7.5 Q 12 10 15.5 16.5" 
              fill="none" 
              stroke="#007AFF" 
              strokeWidth="2" 
              strokeLinecap="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        data={chatMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Recording Indicator */}
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <Animated.View style={[styles.recordingDot, { transform: [{ scale: recordingAnimation }] }]} />
          <Text style={styles.recordingText}>Recording...</Text>
        </View>
      )}

      {/* Input Area */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.inputIcon} onPress={handleCameraPress}>
            <Camera color="#666" size={24} />
          </TouchableOpacity>
          
          <TextInput
            style={styles.textInput}
            placeholder="Message..."
            placeholderTextColor="#999"
            value={message}
            onChangeText={setMessage}
            multiline
          />
          
          <TouchableOpacity 
            style={[styles.inputIcon, isRecording && styles.recordingIcon]}
            onPressIn={handleMicPressIn}
            onPressOut={handleMicPressOut}
          >
            <Mic color={isRecording ? "#ff4444" : "#666"} size={24} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.sendButton}
            onPress={handleSendMessage}
          >
            <Send color="white" size={20} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  shareLocationButton: {
    padding: 6,
    borderRadius: 20,
    marginLeft: 10,
  },

  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 15,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'flex-end',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  myMessageBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 5,
  },
  otherMessageBubble: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: '#333',
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 10,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    paddingVertical: 10,
    marginHorizontal: 20,
    borderRadius: 20,
    marginBottom: 10,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff4444',
    marginRight: 8,
  },
  recordingText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 15,
    gap: 10,
  },
  inputIcon: {
    padding: 8,
    borderRadius: 20,
  },
  recordingIcon: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120,
  },
  voicePlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: 20,
    marginRight: 8,
  },
  waveformBar: {
    width: 2,
    borderRadius: 1,
    marginHorizontal: 1,
  },
  voiceDuration: {
    fontSize: 12,
    fontWeight: '500',
  },
  locationMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
    paddingVertical: 5,
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  locationSubtitle: {
    fontSize: 12,
    opacity: 0.8,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: '#999',
  },
})