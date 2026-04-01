import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, set as firebaseSet, get as firebaseGet, update as firebaseUpdate, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import { User } from '@/types/user';
import { useOnlineDriversStore } from '@/store/online-drivers-store';
import {
  generateSixDigitCode,
  writeSignInOtp,
  readSignInOtp,
  deleteSignInOtp,
  OTP_TTL_MS,
} from '@/lib/otp-signin';
import { sendSignInOtpEmail } from '@/lib/otp-email';

/** Firebase Realtime Database rejects `undefined` in update(); omit those keys. */
function omitUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export type SignInOtpResult = { ok: true; devOtpCode?: string } | { ok: false; error: string };

interface AuthState {
  user: User | null;
  users: User[];
  isAuthenticated: boolean;
  /** Not persisted — email only until OTP is verified or cleared. */
  pendingAuth: { email: string } | null;
  pendingOtpExpiresAt: number | null;
  requestSignInOtp: (email: string) => Promise<SignInOtpResult>;
  verifySignInOtp: (email: string, otp: string) => Promise<boolean>;
  resendSignInOtp: () => Promise<SignInOtpResult>;
  clearPendingAuth: () => void;
  register: (userData: Omit<User, 'id'>) => Promise<void>;
  updateUser: (userData: User) => Promise<boolean>;
  logout: () => void;
  loadUsers: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      users: [],
      isAuthenticated: false,
      pendingAuth: null,
      pendingOtpExpiresAt: null,

      clearPendingAuth: () => set({ pendingAuth: null, pendingOtpExpiresAt: null }),

      requestSignInOtp: async (email) => {
        try {
          const trimmedEmail = email.trim();
          const usersRef = ref(database, 'users');
          const snapshot = await firebaseGet(usersRef);

          if (!snapshot.exists()) {
            return { ok: false, error: 'invalid_credentials' };
          }
          const data = snapshot.val() as Record<string, User & { password?: string }>;
          const user = Object.keys(data)
            .map((key) => ({ ...data[key], id: key }))
            .find((u) => u.email === trimmedEmail);

          if (!user) {
            return { ok: false, error: 'invalid_credentials' };
          }

          const code = generateSixDigitCode();
          const expiresAt = Date.now() + OTP_TTL_MS;
          await writeSignInOtp(trimmedEmail, { code, expiresAt, userId: user.id });

          const sent = await sendSignInOtpEmail(trimmedEmail, code);
          set({
            pendingAuth: { email: trimmedEmail },
            pendingOtpExpiresAt: expiresAt,
          });

          if (!sent) {
            if (__DEV__) {
              return { ok: true, devOtpCode: code };
            }
            await deleteSignInOtp(trimmedEmail);
            set({ pendingAuth: null, pendingOtpExpiresAt: null });
            return { ok: false, error: 'email_not_configured' };
          }

          return { ok: true };
        } catch (error) {
          console.error('Error requesting sign-in OTP:', error);
          return { ok: false, error: 'unknown' };
        }
      },

      resendSignInOtp: async () => {
        const pending = get().pendingAuth;
        if (!pending) {
          return { ok: false, error: 'no_pending' };
        }
        return get().requestSignInOtp(pending.email);
      },

      verifySignInOtp: async (email, otp) => {
        try {
          const trimmed = email.trim();
          const pending = get().pendingAuth;
          if (!pending || pending.email.toLowerCase() !== trimmed.toLowerCase()) {
            return false;
          }

          const record = await readSignInOtp(trimmed);
          if (!record) {
            return false;
          }
          if (Date.now() > record.expiresAt) {
            await deleteSignInOtp(trimmed);
            return false;
          }
          if (record.code !== otp.trim()) {
            return false;
          }

          const userSnap = await firebaseGet(ref(database, `users/${record.userId}`));
          if (!userSnap.exists()) {
            await deleteSignInOtp(trimmed);
            return false;
          }

          const u = { ...userSnap.val(), id: record.userId } as User;
          await deleteSignInOtp(trimmed);
          set({
            user: u,
            isAuthenticated: true,
            pendingAuth: null,
            pendingOtpExpiresAt: null,
          });
          return true;
        } catch (error) {
          console.error('Error verifying sign-in OTP:', error);
          return false;
        }
      },

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
          const { id, ...rest } = userData;
          const dataToUpdate = omitUndefined(rest as Record<string, unknown>);
          await firebaseUpdate(ref(database, `users/${id}`), dataToUpdate);

          set({ user: userData });

          get().loadUsers();
          return true;
        } catch (error) {
          console.error('Error updating user:', error);
          return false;
        }
      },
      
      logout: () => {
        const u = get().user;
        if (u?.type === 'driver') {
          void useOnlineDriversStore.getState().clearMyPresence(u.id);
        }
        set({
          user: null,
          isAuthenticated: false,
          pendingAuth: null,
          pendingOtpExpiresAt: null,
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
