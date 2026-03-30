import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, push, set as firebaseSet, get as firebaseGet, remove, onValue, query, orderByChild } from 'firebase/database';
import { database } from '@/lib/firebase';

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'voice' | 'location';
  duration?: number;
  read?: boolean;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

interface ChatState {
  messages: ChatMessage[];
  sendMessage: (message: Omit<ChatMessage, 'id'>) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<void>;
  markAsRead: (userId: string, currentUserId: string) => void;
  getUnreadCount: (currentUserId: string) => number;
  loadMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      
      loadMessages: () => {
        const messagesRef = ref(database, 'messages');
        onValue(messagesRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const messagesArray = Object.keys(data).map(key => ({
              ...data[key],
              id: key
            }));
            set({ messages: messagesArray });
          } else {
            set({ messages: [] });
          }
        });
      },
      
      sendMessage: async (message) => {
        try {
          const messagesRef = ref(database, 'messages');
          const newMessageRef = push(messagesRef);

          await firebaseSet(newMessageRef, {
            ...message,
            read: false,
          });

          get().loadMessages();
          return true;
        } catch (error) {
          console.error('Error sending message:', error);
          return false;
        }
      },
      
      deleteMessage: async (messageId) => {
        try {
          await remove(ref(database, `messages/${messageId}`));
          get().loadMessages();
        } catch (error) {
          console.error('Error deleting message:', error);
        }
      },
      
      markAsRead: (userId, currentUserId) => {
        set(state => ({
          messages: state.messages.map(msg => 
            msg.senderId === userId && msg.receiverId === currentUserId
              ? { ...msg, read: true }
              : msg
          ),
        }));
      },
      
      getUnreadCount: (currentUserId) => {
        const state = get();
        return state.messages.filter((msg: ChatMessage) => 
          msg.receiverId === currentUserId && !msg.read
        ).length;
      },
    }),
    {
      name: 'chat-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: () => ({}),
    }
  )
);
