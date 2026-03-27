import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput, Image, KeyboardAvoidingView, Platform, Alert, Animated, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Camera, Mic, Send, Play, Pause, MapPin, Navigation } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import { useChatStore } from '@/store/chat-store';
import { useLocationStore } from '@/store/location-store';
import * as ImagePicker from 'expo-image-picker';

const PRIMARY = '#3498db';
const PRIMARY_DARK = '#2980b9';
const BG = '#EEF2F7';
const BUBBLE_OTHER = '#FFFFFF';

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
    const partnerUri = chatPartner?.profileImage?.startsWith('blob:')
      ? 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop'
      : chatPartner?.profileImage ||
        'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop';

    const bubbleContent = (
      <>
        {item.type === 'image' ? (
          <Image
            source={{
              uri: item.content?.startsWith('blob:')
                ? 'https://images.unsplash.com/photo-1682686580391-615b1f28e6d1?q=80&w=1470&auto=format&fit=crop'
                : item.content,
            }}
            style={styles.messageImage}
            defaultSource={require('@/assets/images/icon.png')}
          />
        ) : item.type === 'location' ? (
          <TouchableOpacity
            style={styles.locationMessageContainer}
            onPress={() => handleLocationPress(item)}
            activeOpacity={0.8}
          >
            <MapPin color={isMyMessage ? '#fff' : PRIMARY} size={20} />
            <View style={styles.locationTextContainer}>
              <Text style={[styles.locationTitle, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>
                {item.location?.address || 'Shared Location'}
              </Text>
              <Text style={[styles.locationSubtitle, isMyMessage ? styles.myMessageSub : styles.otherMessageSub]}>
                Tap to view on map
              </Text>
            </View>
            <Navigation color={isMyMessage ? '#fff' : PRIMARY} size={16} />
          </TouchableOpacity>
        ) : item.type === 'voice' ? (
          <View style={styles.voiceMessageContainer}>
            <TouchableOpacity style={styles.voicePlayButton} onPress={() => handleVoicePlayPause(item.id)}>
              {isPlaying ? (
                <Pause color={isMyMessage ? '#fff' : '#334155'} size={16} />
              ) : (
                <Play color={isMyMessage ? '#fff' : '#334155'} size={16} />
              )}
            </TouchableOpacity>
            <View style={styles.voiceWaveform}>
              {[...Array(8)].map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveformBar,
                    {
                      height: (i % 4) * 4 + 10,
                      backgroundColor: isMyMessage ? 'rgba(255,255,255,0.75)' : 'rgba(51,65,85,0.35)',
                    },
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
      </>
    );

    return (
      <View style={[styles.messageRow, isMyMessage ? styles.messageRowMine : styles.messageRowTheirs]}>
        {!isMyMessage && (
          <Image
            source={{ uri: partnerUri }}
            style={styles.messageAvatar}
            defaultSource={require('@/assets/images/icon.png')}
          />
        )}
        <TouchableOpacity
          activeOpacity={0.92}
          onLongPress={() => handleMessageLongPress(item.id, item.senderId)}
          delayLongPress={500}
          style={styles.messageTouchable}
        >
          {isMyMessage ? (
            <LinearGradient
              colors={[PRIMARY, PRIMARY_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.messageBubble, styles.myMessageBubble]}
            >
              {bubbleContent}
            </LinearGradient>
          ) : (
            <View style={[styles.messageBubble, styles.otherMessageBubble]}>{bubbleContent}</View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const headerUri = chatPartner?.profileImage?.startsWith('blob:')
    ? 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop'
    : chatPartner?.profileImage ||
      'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft color="#0f172a" size={26} />
        </TouchableOpacity>

        <Image
          source={{ uri: headerUri }}
          style={styles.headerAvatar}
          defaultSource={require('@/assets/images/icon.png')}
        />

        <View style={styles.headerTextBlock}>
          <Text style={styles.headerName} numberOfLines={1}>
            {chatPartner?.username || 'Unknown User'}
          </Text>
          <Text style={styles.headerSubtitle}>In-app messages</Text>
        </View>

        <TouchableOpacity
          style={styles.shareLocationButton}
          onPress={handleShareLocation}
          accessibilityLabel="Share location"
        >
          <MapPin color={PRIMARY} size={22} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={chatMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      />

      {isRecording && (
        <View style={styles.recordingIndicator}>
          <Animated.View style={[styles.recordingDot, { transform: [{ scale: recordingAnimation }] }]} />
          <Text style={styles.recordingText}>Recording…</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.inputIcon} onPress={handleCameraPress} hitSlop={8}>
            <Camera color="#64748b" size={24} />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Message"
            placeholderTextColor="#94a3b8"
            value={message}
            onChangeText={setMessage}
            multiline
          />

          <TouchableOpacity
            style={[styles.inputIcon, isRecording && styles.recordingIcon]}
            onPressIn={handleMicPressIn}
            onPressOut={handleMicPressOut}
          >
            <Mic color={isRecording ? '#ef4444' : '#64748b'} size={24} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSendMessage} activeOpacity={0.85}>
            <LinearGradient
              colors={[PRIMARY, PRIMARY_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendButton}
            >
              <Send color="#fff" size={20} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const bubbleShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      }
    : { elevation: 2 };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      default: { elevation: 2 },
    }),
  },
  backButton: {
    marginRight: 4,
    padding: 4,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#e0f2fe',
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
  },
  shareLocationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  messageRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowTheirs: {
    justifyContent: 'flex-start',
  },
  messageTouchable: {
    maxWidth: '82%',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  myMessageBubble: {
    borderBottomRightRadius: 6,
  },
  otherMessageBubble: {
    backgroundColor: BUBBLE_OTHER,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...bubbleShadow,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#0f172a',
  },
  myMessageSub: {
    color: 'rgba(255,255,255,0.85)',
  },
  otherMessageSub: {
    color: '#64748b',
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingVertical: 10,
    marginHorizontal: 20,
    borderRadius: 24,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  recordingText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    paddingBottom: Platform.OS === 'ios' ? 4 : 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputIcon: {
    padding: 8,
    borderRadius: 22,
  },
  recordingIcon: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 120,
    marginHorizontal: 4,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
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
    height: 22,
    marginRight: 8,
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
    marginHorizontal: 1,
  },
  voiceDuration: {
    fontSize: 12,
    fontWeight: '600',
  },
  locationMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
    paddingVertical: 4,
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
  },
  messageTime: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: '500',
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  otherMessageTime: {
    color: '#94a3b8',
  },
})