import "react-native-url-polyfill/auto";

import {
  AppState,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createClient,
} from "@supabase/supabase-js";

const supabaseUrl =
  process.env
    .EXPO_PUBLIC_SUPABASE_URL;

const supabaseKey =
  process.env
    .EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL is missing."
  );
}

if (!supabaseKey) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing."
  );
}

export const supabase =
  createClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        storage:
          AsyncStorage,

        autoRefreshToken:
          true,

        persistSession:
          true,

        detectSessionInUrl:
          false,
      },
    }
  );

AppState.addEventListener(
  "change",
  (state) => {
    if (
      state ===
      "active"
    ) {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  }
);