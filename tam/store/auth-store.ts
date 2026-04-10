import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ref,
  set as firebaseSet,
  get as firebaseGet,
  update as firebaseUpdate,
  onValue,
  remove,
} from 'firebase/database';
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
import { sendSignInOtpSms } from '@/lib/otp-sms';
import { maskPhoneForDisplay, normalizePhoneForSms } from '@/lib/phone';
import { signInWithGoogle, signInWithApple, signOutOAuth, OAuthUser, OAuthProvider } from '@/lib/oauth';
import { assignDriverNumberForNewUser, DRIVER_NUMBER_INDEX_PATH, normalizeDriverNumberInput } from '@/lib/driver-number';

/** Firebase Realtime Database rejects `undefined` in update(); omit those keys. */
function omitUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export type SignInOtpResult =
  | { ok: true; signInEmail: string; devOtpCode?: string }
  | { ok: false; error: string };
export type SignInOAuthResult = { ok: true; user: OAuthUser } | { ok: false; error: string };
export type RegisterResult =
  | { ok: true; driverNumber?: string }
  | { ok: false; error: string };

interface AuthState {
  user: User | null;
  users: User[];
  isAuthenticated: boolean;
  /** Not persisted — until OTP is verified or cleared. */
  pendingAuth: { email: string; phoneMasked: string } | null;
  pendingOtpExpiresAt: number | null;
  requestSignInOtp: (emailOrDriverNumber: string) => Promise<SignInOtpResult>;
  verifySignInOtp: (email: string, otp: string) => Promise<boolean>;
  resendSignInOtp: () => Promise<SignInOtpResult>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<SignInOAuthResult>;
  clearPendingAuth: () => void;
  register: (userData: Omit<User, 'id'>) => Promise<RegisterResult>;
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

      signInWithOAuth: async (provider) => {
        try {
          let oauthUser: OAuthUser | null = null;

          switch (provider) {
            case 'google':
              oauthUser = await signInWithGoogle();
              break;
            case 'apple':
              oauthUser = await signInWithApple();
              break;
            default:
              return { ok: false, error: 'unsupported_provider' };
          }

          if (!oauthUser) {
            return { ok: false, error: 'oauth_failed' };
          }

          // Check if user already exists in Firebase
          const usersRef = ref(database, 'users');
          const snapshot = await firebaseGet(usersRef);
          
          if (snapshot.exists()) {
            const data = snapshot.val() as Record<string, User>;
            const existingUser = Object.keys(data)
              .map((key) => ({ ...data[key], id: key }))
              .find((u) => 
                u.email === oauthUser.email || 
                (u.oauthProviders && u.oauthProviders.includes(`${provider}:${oauthUser.providerId}`))
              );

            if (existingUser) {
              // User exists, sign them in
              set({
                user: existingUser,
                isAuthenticated: true,
                pendingAuth: null,
                pendingOtpExpiresAt: null,
              });
              return { ok: true, user: oauthUser };
            }
          }

          // Create new user from OAuth data
          const userId = Date.now().toString();
          const newUser: User = {
            email: oauthUser.email,
            username: oauthUser.name || oauthUser.email.split('@')[0],
            phone: '', // OAuth users might not have phone initially
            type: 'passenger', // Default type
            profileImage: oauthUser.picture,
            oauthProviders: [`${provider}:${oauthUser.providerId}`],
            createdAt: new Date().toISOString(),
          };

          await firebaseSet(ref(database, `users/${userId}`), newUser);
          
          set({
            user: { ...newUser, id: userId },
            isAuthenticated: true,
            pendingAuth: null,
            pendingOtpExpiresAt: null,
          });

          get().loadUsers();
          return { ok: true, user: oauthUser };
        } catch (error) {
          console.error('OAuth sign-in error:', error);
          return { ok: false, error: 'unknown' };
        }
      },

      requestSignInOtp: async (emailOrDriverNumber) => {
        try {
          const raw = emailOrDriverNumber.trim();
          const usersRef = ref(database, 'users');

          let user: (User & { id: string }) | undefined;

          if (raw.includes('@')) {
            const trimmedEmail = raw.toLowerCase();
            const snapshot = await firebaseGet(usersRef);
            if (!snapshot.exists()) {
              return { ok: false, error: 'invalid_credentials' };
            }
            const data = snapshot.val() as Record<string, User & { password?: string }>;
            user = Object.keys(data)
              .map((key) => ({ ...data[key], id: key }))
              .find((u) => u.email?.trim().toLowerCase() === trimmedEmail);
          } else {
            const driverNumber = normalizeDriverNumberInput(raw);
            if (!driverNumber) {
              return { ok: false, error: 'invalid_credentials' };
            }
            const idxSnap = await firebaseGet(ref(database, `${DRIVER_NUMBER_INDEX_PATH}/${driverNumber}`));
            let userId: string | null = idxSnap.exists() ? String(idxSnap.val()) : null;
            if (!userId) {
              const snapAll = await firebaseGet(usersRef);
              if (snapAll.exists()) {
                const data = snapAll.val() as Record<string, User>;
                const id = Object.keys(data).find(
                  (key) =>
                    data[key].type === 'driver' &&
                    data[key].driverNumber?.trim().toUpperCase() === driverNumber
                );
                if (id) userId = id;
              }
            }
            if (!userId) {
              return { ok: false, error: 'invalid_credentials' };
            }
            const userSnap = await firebaseGet(ref(database, `users/${userId}`));
            if (!userSnap.exists()) {
              return { ok: false, error: 'invalid_credentials' };
            }
            const u = { ...userSnap.val(), id: userId } as User & { id: string };
            if (u.type !== 'driver') {
              return { ok: false, error: 'invalid_credentials' };
            }
            user = u;
          }

          if (!user) {
            return { ok: false, error: 'invalid_credentials' };
          }

          const trimmedEmail = user.email?.trim() ?? '';
          if (!trimmedEmail) {
            return { ok: false, error: 'invalid_credentials' };
          }

          const rawPhone = typeof user.phone === 'string' ? user.phone : '';
          if (!rawPhone.trim()) {
            return { ok: false, error: 'no_phone' };
          }

          const phoneE164 = normalizePhoneForSms(rawPhone);
          if (!phoneE164) {
            return { ok: false, error: 'invalid_phone' };
          }

          const phoneMasked = maskPhoneForDisplay(phoneE164);

          const code = generateSixDigitCode();
          const expiresAt = Date.now() + OTP_TTL_MS;
          await writeSignInOtp(trimmedEmail.toLowerCase(), { code, expiresAt, userId: user.id });

          const sent = await sendSignInOtpSms(phoneE164, code);
          set({
            pendingAuth: { email: trimmedEmail.toLowerCase(), phoneMasked },
            pendingOtpExpiresAt: expiresAt,
          });

          if (!sent) {
            if (__DEV__) {
              return { ok: true, signInEmail: trimmedEmail.toLowerCase(), devOtpCode: code };
            }
            await deleteSignInOtp(trimmedEmail.toLowerCase());
            set({ pendingAuth: null, pendingOtpExpiresAt: null });
            return { ok: false, error: 'sms_not_configured' };
          }

          return { ok: true, signInEmail: trimmedEmail.toLowerCase() };
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
        const userId = Date.now().toString();
        let driverNumber: string | undefined;
        const newUser: Omit<User, 'id'> = { ...userData };

        try {
          if (userData.type === 'driver') {
            driverNumber = await assignDriverNumberForNewUser(userId);
            newUser.driverNumber = driverNumber;
          }

          const payload = omitUndefined(newUser as Record<string, unknown>);
          await firebaseSet(ref(database, `users/${userId}`), payload);

          set({
            user: { ...newUser, id: userId } as User,
            isAuthenticated: true,
          });

          get().loadUsers();
          return { ok: true as const, driverNumber };
        } catch (error) {
          console.error('Error registering:', error);
          if (driverNumber) {
            await remove(ref(database, `${DRIVER_NUMBER_INDEX_PATH}/${driverNumber}`)).catch(() => {});
          }
          const message =
            error instanceof Error ? error.message : 'Could not save your account. Check your connection.';
          return { ok: false as const, error: message };
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
