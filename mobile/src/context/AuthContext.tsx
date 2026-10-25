import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import type {
  Session,
  User,
} from "@supabase/supabase-js";

import {
  supabase,
} from "../lib/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext =
  createContext<AuthContextValue>({
    session: null,
    user: null,
    loading: true,
    signOut: async () => {},
  });

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [
    session,
    setSession,
  ] =
    useState<Session | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  useEffect(() => {
    let active = true;

    async function initializeAuth() {
  console.log("AUTH: initialize started");

  try {
    const {
      data,
      error,
    } = await supabase.auth.getSession();

    console.log(
      "AUTH: session result",
      data.session
    );

    if (error) {
      console.log(
        "AUTH ERROR:",
        error
      );
    }

    if (!active) {
      return;
    }

    setSession(
      data.session
    );
  } catch (error) {
    console.log(
      "AUTH INIT ERROR:",
      error
    );
  } finally {
    console.log(
      "AUTH: loading false"
    );

    if (active) {
      setLoading(
        false
      );
    }
  }
}

    initializeAuth();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (
          _event,
          newSession
        ) => {
          if (!active) {
            return;
          }

          setSession(
            newSession
          );

          setLoading(
            false
          );
        }
      );

    return () => {
      active = false;

      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const {
      error,
    } =
      await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setSession(
      null
    );
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user:
          session?.user ??
          null,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(
    AuthContext
  );
}