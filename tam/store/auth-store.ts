import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, set as firebaseSet, get as firebaseGet, update as firebaseUpdate, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import { User } from '@/types/user';
import { useOnlineDriversStore } from '@/store/online-drivers-store';

interface AuthState {
  user: User | null;
  users: User[];
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  register: (userData: Omit<User, 'id'>) => Promise<void>;
  updateUser: (userData: User) => Promise<void>;
  logout: () => void;
  loadUsers: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      users: [],
      isAuthenticated: false,
      
      loadUsers: () => {
        const usersRef = ref(database, 'users');
        onValue(usersRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const usersArray = Object.keys(data).map(key => ({
              ...data[key],
              id: key
            }));
            set({ users: usersArray });
          }
        });
      },
      
      signIn: async (email, password) => {
        try {
          const usersRef = ref(database, 'users');
          const snapshot = await firebaseGet(usersRef);
          
          if (snapshot.exists()) {
            const data = snapshot.val();
            const user = Object.keys(data).map(key => ({ ...data[key], id: key }))
              .find(u => u.email === email && u.password === password);
            
            if (user) {
              set({ user, isAuthenticated: true });
              return true;
            }
          }
          return false;
        } catch (error) {
          console.error('Error signing in:', error);
          return false;
        }
      },
      
      register: async (userData) => {
        try {
          const userId = Date.now().toString();
          const newUser = {
            ...userData,
          };
          
          await firebaseSet(ref(database, `users/${userId}`), newUser);
          
          set({
            user: { ...newUser, id: userId },
            isAuthenticated: true,
          });
          
          get().loadUsers();
        } catch (error) {
          console.error('Error registering:', error);
        }
      },
      
      updateUser: async (userData) => {
        try {
          const { id, ...dataToUpdate } = userData;
          await firebaseUpdate(ref(database, `users/${id}`), dataToUpdate);
          
          set(state => ({
            user: userData,
          }));
          
          get().loadUsers();
        } catch (error) {
          console.error('Error updating user:', error);
        }
      },
      
      logout: () => {
        const u = get().user;
        if (u?.type === 'driver') {
          void useOnlineDriversStore.getState().clearMyPresence(u.id);
        }
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
