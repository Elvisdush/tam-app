import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { useChatStore } from '@/store/chat-store';
import { useAuthStore } from '@/store/auth-store';

function formatConversationTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor(
    (startOfToday.getTime() - startOfMsg.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function MessagesScreen() {
  const messages = useChatStore((state) => state.messages);
  const user = useAuthStore((state) => state.user);
  const users = useAuthStore((state) => state.users);

  const conversationList = useMemo(() => {
    if (!user) return [];

    const conversations = new Map<
      string,
      {
        id: string;
        username: string;
        avatar: string | undefined;
        lastMessage: string;
        timestamp: string;
      }
    >();

    messages.forEach((message) => {
      const otherUserId = message.senderId === user.id ? message.receiverId : message.senderId;
      const existingConv = conversations.get(otherUserId);

      if (!existingConv || new Date(message.timestamp) > new Date(existingConv.timestamp)) {
        const otherUser = users.find((u) => u.id === otherUserId);
        if (otherUser) {
          conversations.set(otherUserId, {
            id: otherUserId,
            username: otherUser.username,
            avatar: otherUser.profileImage,
            lastMessage:
              message.type === 'text'
                ? message.content
                : message.type === 'voice'
                  ? 'Voice message'
                  : message.type === 'image'
                    ? 'Photo'
                    : message.type === 'location'
                      ? 'Location'
                      : message.content,
            timestamp: message.timestamp,
          });
        }
      }
    });

    return Array.from(conversations.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [messages, user, users]);

  const handleMessagePress = (userId: string) => {
    router.push(`/chat/${userId}`);
  };

  const defaultAvatar =
    'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#F8FAFC', '#EFF6FF', '#F8FAFC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBg}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>Chats with drivers and passengers</Text>
        </View>

        {conversationList.length === 0 ? (
          <View style={styles.emptyWrap}>
            <LinearGradient
              colors={['#3498db22', '#2980b911']}
              style={styles.emptyIconRing}
            >
              <MessageCircle size={48} color="#3498db" strokeWidth={1.5} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyBody}>
              When you message someone from a ride or profile, it will show up here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={conversationList}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const uri = item.avatar?.startsWith('blob:') ? defaultAvatar : item.avatar || defaultAvatar;
              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => handleMessagePress(item.id.toString())}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatarWrap}>
                    <Image source={{ uri }} style={styles.avatar} defaultSource={require('@/assets/images/icon.png')} />
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardTop}>
                      <Text style={styles.username} numberOfLines={1}>
                        {item.username}
                      </Text>
                      <Text style={styles.time}>{formatConversationTime(item.timestamp)}</Text>
                    </View>
                    <Text style={styles.lastMessage} numberOfLines={2}>
                      {item.lastMessage}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const cardShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      }
    : { elevation: 3 };

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  gradientBg: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...cardShadow,
  },
  avatarWrap: {
    marginRight: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#e0f2fe',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  username: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
  },
  time: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  lastMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyIconRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#64748b',
    textAlign: 'center',
  },
});
