"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  User,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { adminBusinessFromClaims, setBusinessId } from "@/lib/business";
import { auth } from "@/lib/firebase";
import { listenToAllStores, resetAllStores } from "@/stores/allStores";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const NO_ACCESS_MESSAGE = "This account isn't an admin of a business.";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Stops the live store listeners; set while someone is signed in. */
  const stopListeningRef = useRef<(() => void) | null>(null);

  const stopListening = useCallback(() => {
    stopListeningRef.current?.();
    stopListeningRef.current = null;
  }, []);

  useEffect(() => {
    // Only admins of a business get in; their claim sets the business for every path.
    // The claim check is async; only the latest auth event counts.
    let latest = 0;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const run = ++latest;
      let businessId: string | null = null;
      if (user) {
        try {
          businessId = adminBusinessFromClaims((await user.getIdTokenResult()).claims);
        } catch {
          businessId = null;
        }
        if (run !== latest) return;
        if (!businessId) {
          setError(NO_ACCESS_MESSAGE);
          await signOut(auth); // fires again with null
          return;
        }
      }
      setBusinessId(businessId);
      setUser(user);
      setLoading(false);

      stopListening();
      if (user) {
        // Live listeners keep every store in sync for as long as staff are signed in.
        stopListeningRef.current = listenToAllStores();
      } else {
        resetAllStores();
      }
    });
    return () => {
      unsubscribe();
      stopListening();
    };
  }, [stopListening]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      if (!adminBusinessFromClaims((await user.getIdTokenResult()).claims)) {
        await signOut(auth);
        setError(NO_ACCESS_MESSAGE);
        throw new Error(NO_ACCESS_MESSAGE);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === NO_ACCESS_MESSAGE) throw err;
      let message = "Login failed. Please try again.";
      if (err && typeof err === "object" && "code" in err) {
        const code = (err as { code: string }).code;
        if (code === "auth/invalid-email") message = "Invalid email address.";
        else if (code === "auth/user-not-found")
          message = "No account with this email.";
        else if (code === "auth/wrong-password")
          message = "Incorrect password.";
        else if (code === "auth/invalid-credential")
          message = "Invalid email or password.";
        else if (code === "auth/too-many-requests")
          message = "Too many attempts. Try again later.";
      }
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    // Stop listening before signing out, or the listeners would hit permission errors.
    stopListening();
    await signOut(auth);
    resetAllStores();
  }, [stopListening]);

  const clearError = useCallback(() => setError(null), []);

  const value: AuthContextValue = {
    user,
    loading,
    login,
    logout,
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx == null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
