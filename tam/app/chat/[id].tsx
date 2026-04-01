import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  Alert,
  Animated,
  Share,
  Keyboard,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Camera, Mic, Send, Play, Pause, MapPin, Navigation } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import { useChatStore } from '@/store/chat-store';
import { useLocationStore } from '@/store/location-store';
import * as ImagePicker from 'expo-image-picker';
import type { Audio } from 'expo-av';
import {
  requestMicPermission,
  startRecordingSession,
  finishRecordingToPayload,
  playVoicePayload,
  stopPlayback,
  isVoiceM4aPayload,
  MAX_VOICE_RECORDING_MS,
} from '@/lib/chat-voice';

const PRIMARY = '#3498db';
const PRIMARY_DARK = '#2980b9';
const BG = '#EEF2F7';
const BUBBLE_OTHER = '#FFFFFF';

export default function ChatScreen() {
  const { id: idParam, name, profileImage, from, to, price } = useLocalSearchParams();
  const chatPartnerId = useMemo(() => {
    if (typeof idParam === 'string') return idParam;
    if (Array.isArray(idParam)) return idParam[0] ?? '';
    return '';
  }, [idParam]);
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const recordingAnimation = useRef(new Animated.Value(1)).current;
  const recordingLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const holdingMicRef = useRef(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartMsRef = useRef(0);
  const maxRecordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const user = useAuthStore(state => state.user);
  const users = useAuthStore(state => state.users);
  const { messages, sendMessage, deleteMessage, markAsRead } = useChatStore();
  const { shareLocation, startLocationTracking, stopLocationTracking, currentLocation, sharedLocations } = useLocationStore();
  
  // Use passed passenger data if available, otherwise fallback to users store
  const chatPartner = name && profileImage ? {
    id: chatPartnerId,
    username: name as string,
    profileImage: profileImage as string,
    from: from as string,
    to: to as string,
    price: price as string
  } : users.find(u => u.id === chatPartnerId);
  const chatMessages = messages.filter(m =>
    (m.senderId === user?.id && m.receiverId === chatPartnerId) ||
    (m.senderId === chatPartnerId && m.receiverId === user?.id)
  );

  /** Prefer live user row from Firebase — persisted session can miss or stale `type`. */
  const resolvedMe = useMemo(() => {
    if (!user?.id) return null;
    const fromList = users.find((u) => u.id === user.id);
    return fromList ?? user;
  }, [user, users]);

  const isDriver = resolvedMe?.type === 'driver';
  const driverSentCount = useMemo(
    () => chatMessages.filter((m) => m.senderId === user?.id).length,
    [chatMessages, user?.id]
  );

  const handleSendMessage = async () => {
    if (message.trim() && user && chatPartnerId) {
      const ok = await sendMessage({
        senderId: user.id,
        receiverId: chatPartnerId,
        content: message.trim(),
        timestamp: new Date().toISOString(),
        type: 'text'
      });
      if (ok) setMessage('');
      else Alert.alert('Message', 'Could not send. Check your connection and try again.');
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

      if (!result.canceled && user && chatPartnerId) {
        const ok = await sendMessage({
          senderId: user.id,
          receiverId: chatPartnerId,
          content: result.assets[0].uri,
          timestamp: new Date().toISOString(),
          type: 'image'
        });
        if (!ok) Alert.alert('Photo', 'Could not send. Check your connection and try again.');
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const stopRecordingAnimation = () => {
    recordingLoopRef.current?.stop();
    recordingLoopRef.current = null;
    recordingAnimation.stopAnimation();
    recordingAnimation.setValue(1);
  };

  const startRecordingAnimation = () => {
    stopRecordingAnimation();
    const loop = Animated.loop(
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
    );
    recordingLoopRef.current = loop;
    loop.start();
  };

  const clearMaxRecordingTimeout = () => {
    if (maxRecordingTimeoutRef.current) {
      clearTimeout(maxRecordingTimeoutRef.current);
      maxRecordingTimeoutRef.current = null;
    }
  };

  const finalizeActiveRecording = () => {
    if (Platform.OS === 'web') return;
    clearMaxRecordingTimeout();
    holdingMicRef.current = false;
    setIsRecording(false);
    stopRecordingAnimation();

    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec || !user || !chatPartnerId) return;

    void (async () => {
      const startedAt = recordingStartMsRef.current;
      const result = await finishRecordingToPayload(rec, startedAt);
      if (!result) {
        Alert.alert('Voice message', 'Recording was too short or could not be saved.');
        return;
      }
      const ok = await sendMessage({
        senderId: user.id,
        receiverId: chatPartnerId,
        content: result.payload,
        timestamp: new Date().toISOString(),
        type: 'voice',
        duration: result.durationSec,
      });
      if (!ok) {
        Alert.alert('Voice message', 'Could not send. Check your connection and try again.');
      }
    })();
  };

  const handleMicPressIn = () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Voice recording is not available on web');
      return;
    }
    if (!chatPartnerId) {
      Alert.alert('Chat', 'Missing chat partner. Go back and open the conversation again.');
      return;
    }

    clearMaxRecordingTimeout();
    Keyboard.dismiss();
    textInputRef.current?.blur();
    holdingMicRef.current = true;

    void (async () => {
      const ok = await requestMicPermission();
      if (!ok) {
        holdingMicRef.current = false;
        Alert.alert('Microphone', 'Please allow microphone access to send voice messages.');
        return;
      }
      if (!holdingMicRef.current) return;

      try {
        const recording = await startRecordingSession();
        if (!holdingMicRef.current) {
          try {
            await recording.stopAndUnloadAsync();
          } catch {
            // ignore
          }
          return;
        }
        recordingRef.current = recording;
        recordingStartMsRef.current = Date.now();
        setIsRecording(true);
        startRecordingAnimation();
        clearMaxRecordingTimeout();
        maxRecordingTimeoutRef.current = setTimeout(() => {
          maxRecordingTimeoutRef.current = null;
          if (recordingRef.current) {
            finalizeActiveRecording();
          }
        }, MAX_VOICE_RECORDING_MS);
      } catch {
        holdingMicRef.current = false;
        Alert.alert('Recording', 'Could not start recording. Try again.');
      }
    })();
  };

  const handleMicPressOut = () => {
    finalizeActiveRecording();
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

  const handleVoicePlayPause = async (messageId: string, content: string, durationSec?: number) => {
    if (playingVoiceId === messageId) {
      await stopPlayback();
      setPlayingVoiceId(null);
      return;
    }

    if (isVoiceM4aPayload(content)) {
      await stopPlayback();
      setPlayingVoiceId(messageId);
      try {
        await playVoicePayload(content, () => setPlayingVoiceId(null));
      } catch {
        setPlayingVoiceId(null);
        Alert.alert('Playback', 'Could not play this voice message.');
      }
      return;
    }

    // Legacy placeholder messages (no audio blob)
    setPlayingVoiceId(messageId);
    const ms = Math.min(MAX_VOICE_RECORDING_MS, Math.max(1000, (durationSec ?? 3) * 1000));
    setTimeout(() => setPlayingVoiceId(null), ms);
  };

  const handleShareLocation = async () => {
    try {
      const locationLink = await shareLocation(chatPartnerId, user?.id);
      if (locationLink && user) {
        // Send location message
        const ok = await sendMessage({
          senderId: user.id,
          receiverId: chatPartnerId,
          content: locationLink,
          timestamp: new Date().toISOString(),
          type: 'location',
          location: currentLocation ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            address: currentLocation.address
          } : undefined
        });
        if (!ok) {
          Alert.alert('Error', 'Could not send the location message. Check your connection.');
          return;
        }

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
    if (user && chatPartnerId) {
      markAsRead(chatPartnerId, user.id);
    }
    
    return () => {
      if (maxRecordingTimeoutRef.current) {
        clearTimeout(maxRecordingTimeoutRef.current);
        maxRecordingTimeoutRef.current = null;
      }
      void stopPlayback();
      const rec = recordingRef.current;
      if (rec) {
        recordingRef.current = null;
        void rec.stopAndUnloadAsync().catch(() => {});
      }
      holdingMicRef.current = false;
      // Keep location tracking active for shared locations
      // Only stop if no active shared locations
      const hasActiveSharedLocations = sharedLocations.some(loc => loc.isActive);
      if (!hasActiveSharedLocations) {
        stopLocationTracking();
      }
    };
  }, [sharedLocations, user, chatPartnerId, markAsRead, startLocationTracking, stopLocationTracking]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: { endCoordinates: { height: number } }) => {
      setKeyboardHeight(e.endCoordinates.height);
    };
    const onHide = () => setKeyboardHeight(0);

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  useEffect(() => {
    if (keyboardHeight <= 0) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 120);
    return () => clearTimeout(t);
  }, [keyboardHeight]);

  const renderMessage = ({ item }: { item: any }) => {
    const isMyMessage = item.senderId === user?.id;
    const driverOutgoing = isDriver && isMyMessage;
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
              <Text
                style={[
                  styles.locationTitle,
                  isMyMessage ? styles.myMessageText : styles.otherMessageText,
                  driverOutgoing && styles.driverSentLocationTitle,
                ]}
              >
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
            <TouchableOpacity
              style={styles.voicePlayButton}
              onPress={() => handleVoicePlayPause(item.id, item.content, item.duration)}
            >
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
            <Text
              style={[
                styles.voiceDuration,
                isMyMessage ? styles.myMessageText : styles.otherMessageText,
                driverOutgoing && styles.driverSentVoiceMeta,
              ]}
            >
              {item.duration}s
            </Text>
          </View>
        ) : (
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText,
              driverOutgoing && styles.driverSentMessageText,
            ]}
          >
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
              style={[
                styles.messageBubble,
                styles.myMessageBubble,
                driverOutgoing && styles.driverMyBubble,
              ]}
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

  const safeBottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 6 : 10);
  /** Manual offset from Keyboard events — avoids relying on KeyboardAvoidingView / window resize. */
  const composerBottomPad =
    keyboardHeight > 0 ? keyboardHeight + 10 : safeBottomPad;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerName} numberOfLines={1}>
              {chatPartner?.username || 'Unknown User'}
            </Text>
            {isDriver ? (
              <View style={styles.driverBadge}>
                <Text style={styles.driverBadgeText}>Driver</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.headerSubtitle} numberOfLines={2}>
            {isDriver
              ? `You sent ${driverSentCount} message${driverSentCount === 1 ? '' : 's'} in this chat`
              : 'In-app messages'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.shareLocationButton}
          onPress={handleShareLocation}
          accessibilityLabel="Share location"
        >
          <MapPin color={PRIMARY} size={22} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {isDriver ? (
        <View
          style={styles.driverSentStrip}
          accessibilityLabel={`Your messages sent: ${driverSentCount}`}
        >
          <Text style={styles.driverSentStripLabel}>Your messages sent</Text>
          <View style={styles.driverSentStripPill}>
            <Text style={styles.driverSentStripCount}>{driverSentCount}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.keyboardAvoiding}>
        <FlatList
          ref={listRef}
          data={chatMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        />

        {isRecording && (
          <View style={styles.recordingIndicator}>
            <Animated.View style={[styles.recordingDot, { transform: [{ scale: recordingAnimation }] }]} />
            <Text style={styles.recordingText}>Recording…</Text>
          </View>
        )}

        <View style={[styles.inputContainer, { paddingBottom: composerBottomPad }]}>
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.inputIcon} onPress={handleCameraPress} hitSlop={8}>
              <Camera color="#64748b" size={24} />
            </TouchableOpacity>

            <TextInput
              ref={textInputRef}
              style={styles.textInput}
              placeholder="Message"
              placeholderTextColor="#94a3b8"
              value={message}
              onChangeText={setMessage}
              multiline
              {...(Platform.OS === 'android' ? { textAlignVertical: 'center' as const } : {})}
            />

            <Pressable
              style={[styles.inputIcon, isRecording && styles.recordingIcon]}
              onPressIn={handleMicPressIn}
              onPressOut={handleMicPressOut}
              hitSlop={12}
              pressRetentionOffset={{ top: 32, bottom: 48, left: 32, right: 32 }}
            >
              <Mic color={isRecording ? '#ef4444' : '#64748b'} size={24} />
            </Pressable>

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
        </View>
      </View>
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
  keyboardAvoiding: {
    flex: 1,
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  headerName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  driverBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  driverBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  driverSentStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#eff6ff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#bfdbfe',
  },
  driverSentStripLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e40af',
  },
  driverSentStripPill: {
    minWidth: 40,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverSentStripCount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
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
  driverMyBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(255,255,255,0.95)',
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
  /** Driver’s own bubbles: stronger emphasis on outgoing copy */
  driverSentMessageText: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  driverSentLocationTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  driverSentVoiceMeta: {
    fontSize: 15,
    fontWeight: '800',
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