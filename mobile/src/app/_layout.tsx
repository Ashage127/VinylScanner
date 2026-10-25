import {
  ActivityIndicator,
  View,
} from "react-native";

import {
  Stack,
} from "expo-router";

import {
  SafeAreaProvider,
} from "react-native-safe-area-context";

import {
  AuthProvider,
  useAuth,
} from "../context/AuthContext";

function AppNavigator() {
  const {
    session,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F8F6F0",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator
          size="large"
          color="#171714"
        />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
  
    >
      <Stack.Protected
        guard={!session}
      >
        <Stack.Screen
          name="index"
        />
      </Stack.Protected>

      <Stack.Protected
        guard={!!session}
      >
        <Stack.Screen
          name="scanner"
        />

        <Stack.Screen
          name="account"
        />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}