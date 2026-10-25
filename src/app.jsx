import {
  useState,
} from "react";

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  router,
} from "expo-router";

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  supabase,
} from "../lib/supabase";

type AuthMode =
  | "login"
  | "signup";

function TurntableLogo() {
  return (
    <View
      style={
        styles.turntableLogo
      }
    >
      <View
        style={
          styles.record
        }
      >
        <View
          style={
            styles.recordLabel
          }
        >
          <View
            style={
              styles.recordHole
            }
          />
        </View>
      </View>

      <View
        style={
          styles.tonearmBase
        }
      />

      <View
        style={
          styles.tonearm
        }
      />

      <View
        style={
          styles.control
        }
      />
    </View>
  );
}

export default function LoginScreen() {
  const [
    mode,
    setMode,
  ] =
    useState<AuthMode>(
      "login"
    );

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  function switchMode(
    nextMode: AuthMode
  ) {
    setMode(
      nextMode
    );

    setError("");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  async function login() {
    const cleanEmail =
      email
        .trim()
        .toLowerCase();

    if (
      !cleanEmail ||
      !password
    ) {
      setError(
        "Enter your email and password."
      );

      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const {
        error:
          loginError,
      } =
        await supabase.auth.signInWithPassword(
          {
            email:
              cleanEmail,

            password,
          }
        );

      if (
        loginError
      ) {
        throw loginError;
      }

      router.replace(
        "/scanner"
      );
    } catch (
      err: any
    ) {
      setError(
        err?.message ||
          "Could not log in."
      );
    } finally {
      setLoading(false);
    }
  }

  async function createAccount() {
    const cleanEmail =
      email
        .trim()
        .toLowerCase();

    if (
      !cleanEmail
    ) {
      setError(
        "Enter your email."
      );

      return;
    }

    if (
      password.length <
      8
    ) {
      setError(
        "Password must be at least 8 characters."
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        "Passwords do not match."
      );

      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const {
        data,
        error:
          signUpError,
      } =
        await supabase.auth.signUp(
          {
            email:
              cleanEmail,

            password,
          }
        );

      if (
        signUpError
      ) {
        throw signUpError;
      }

      if (
        data.session
      ) {
        router.replace(
          "/scanner"
        );

        return;
      }

      setMessage(
        "Account created. Check your email to confirm your account, then log in."
      );

      setMode(
        "login"
      );

      setPassword("");
      setConfirmPassword("");
    } catch (
      err: any
    ) {
      setError(
        err?.message ||
          "Could not create account."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView
      style={
        styles.screen
      }
    >
      <KeyboardAvoidingView
        style={{
          flex: 1,
        }}
        behavior={
          Platform.OS ===
          "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={
              styles.logoSection
            }
          >
            <TurntableLogo />

            <Text
              style={
                styles.brand
              }
            >
              VINYLSCANNER
            </Text>
          </View>

          <View
            style={
              styles.authCard
            }
          >
            <Text
              style={
                styles.eyebrow
              }
            >
              {mode ===
              "login"
                ? "WELCOME BACK"
                : "GET STARTED"}
            </Text>

            <Text
              style={
                styles.title
              }
            >
              {mode ===
              "login"
                ? "Log in"
                : "Create account"}
            </Text>

            <Text
              style={
                styles.label
              }
            >
              EMAIL
            </Text>

            <View
              style={
                styles.inputWrap
              }
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color="#77746D"
              />

              <TextInput
                value={
                  email
                }
                onChangeText={
                  setEmail
                }
                placeholder="you@example.com"
                placeholderTextColor="#AAA69D"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={
                  false
                }
                style={
                  styles.input
                }
              />
            </View>

            <Text
              style={
                styles.labelSpaced
              }
            >
              PASSWORD
            </Text>

            <View
              style={
                styles.inputWrap
              }
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#77746D"
              />

              <TextInput
                value={
                  password
                }
                onChangeText={
                  setPassword
                }
                placeholder="••••••••"
                placeholderTextColor="#AAA69D"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={
                  false
                }
                style={
                  styles.input
                }
              />
            </View>

            {mode ===
            "signup" ? (
              <>
                <Text
                  style={
                    styles.labelSpaced
                  }
                >
                  CONFIRM PASSWORD
                </Text>

                <View
                  style={
                    styles.inputWrap
                  }
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#77746D"
                  />

                  <TextInput
                    value={
                      confirmPassword
                    }
                    onChangeText={
                      setConfirmPassword
                    }
                    placeholder="••••••••"
                    placeholderTextColor="#AAA69D"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={
                      false
                    }
                    style={
                      styles.input
                    }
                  />
                </View>
              </>
            ) : null}

            {error ? (
              <View
                style={
                  styles.errorBox
                }
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color="#7D3732"
                />

                <Text
                  style={
                    styles.errorText
                  }
                >
                  {error}
                </Text>
              </View>
            ) : null}

            {message ? (
              <View
                style={
                  styles.messageBox
                }
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#315C34"
                />

                <Text
                  style={
                    styles.messageText
                  }
                >
                  {message}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[
                styles.primaryButton,

                loading &&
                  styles.disabledButton,
              ]}
              disabled={
                loading
              }
              onPress={
                mode ===
                "login"
                  ? login
                  : createAccount
              }
            >
              {loading ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  {mode ===
                  "login"
                    ? "Log in"
                    : "Create account"}
                </Text>
              )}
            </Pressable>

            <View
              style={
                styles.switchRow
              }
            >
              <Text
                style={
                  styles.switchText
                }
              >
                {mode ===
                "login"
                  ? "Don't have an account?"
                  : "Already have an account?"}
              </Text>

              <Pressable
                onPress={() =>
                  switchMode(
                    mode ===
                    "login"
                      ? "signup"
                      : "login"
                  )
                }
              >
                <Text
                  style={
                    styles.switchButton
                  }
                >
                  {mode ===
                  "login"
                    ? "Create one"
                    : "Log in"}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,

      backgroundColor:
        "#F8F6F0",
    },

    content: {
      flexGrow: 1,

      justifyContent:
        "center",

      paddingHorizontal:
        22,

      paddingVertical:
        35,
    },

    logoSection: {
      alignItems:
        "center",

      marginBottom:
        32,
    },

    brand: {
      marginTop: 13,

      color:
        "#171714",

      fontSize: 17,

      fontWeight:
        "900",

      letterSpacing:
        1.3,
    },

    turntableLogo: {
      width: 72,
      height: 60,

      borderWidth: 2,

      borderColor:
        "#171714",

      borderRadius: 16,

      position:
        "relative",
    },

    record: {
      position:
        "absolute",

      width: 43,
      height: 43,

      borderRadius:
        22,

      backgroundColor:
        "#171714",

      left: 8,
      top: 8,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    recordLabel: {
      width: 15,
      height: 15,

      borderRadius:
        8,

      backgroundColor:
        "#F8F6F0",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    recordHole: {
      width: 4,
      height: 4,

      borderRadius: 2,

      backgroundColor:
        "#171714",
    },

    tonearmBase: {
      position:
        "absolute",

      right: 8,
      top: 9,

      width: 8,
      height: 8,

      borderRadius: 4,

      backgroundColor:
        "#171714",
    },

    tonearm: {
      position:
        "absolute",

      right: 12,
      top: 15,

      width: 3,
      height: 29,

      borderRadius: 2,

      backgroundColor:
        "#171714",

      transform: [
        {
          rotate:
            "25deg",
        },
      ],
    },

    control: {
      position:
        "absolute",

      right: 8,
      bottom: 8,

      width: 6,
      height: 6,

      borderRadius: 3,

      backgroundColor:
        "#171714",
    },

    authCard: {
      backgroundColor:
        "#FFFFFF",

      borderRadius: 30,

      padding: 23,
    },

    eyebrow: {
      color:
        "#858179",

      fontSize: 10,

      fontWeight:
        "900",

      letterSpacing:
        1.2,
    },

    title: {
      marginTop: 5,

      marginBottom:
        28,

      color:
        "#171714",

      fontSize: 35,

      lineHeight: 40,

      fontWeight:
        "900",
    },

    label: {
      marginBottom: 8,

      color:
        "#77746D",

      fontSize: 10,

      fontWeight:
        "900",

      letterSpacing: 1,
    },

    labelSpaced: {
      marginTop: 19,

      marginBottom: 8,

      color:
        "#77746D",

      fontSize: 10,

      fontWeight:
        "900",

      letterSpacing: 1,
    },

    inputWrap: {
      height: 60,

      borderRadius: 18,

      paddingHorizontal:
        16,

      backgroundColor:
        "#F3F1EB",

      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 10,
    },

    input: {
      flex: 1,

      height: "100%",

      color:
        "#171714",

      fontSize: 16,
    },

    primaryButton: {
      marginTop: 24,

      height: 60,

      borderRadius: 20,

      backgroundColor:
        "#171714",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    disabledButton: {
      opacity: 0.55,
    },

    primaryButtonText: {
      color:
        "#FFFFFF",

      fontSize: 15,

      fontWeight:
        "800",
    },

    errorBox: {
      marginTop: 16,

      padding: 13,

      borderRadius: 15,

      backgroundColor:
        "#F1DEDA",

      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 8,
    },

    errorText: {
      flex: 1,

      color:
        "#7D3732",

      fontSize: 13,
    },

    messageBox: {
      marginTop: 16,

      padding: 13,

      borderRadius: 15,

      backgroundColor:
        "#E4ECE1",

      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 8,
    },

    messageText: {
      flex: 1,

      color:
        "#315C34",

      fontSize: 13,
    },

    switchRow: {
      marginTop: 22,

      flexDirection:
        "row",

      justifyContent:
        "center",

      alignItems:
        "center",

      gap: 5,
    },

    switchText: {
      color:
        "#77746D",

      fontSize: 13,
    },

    switchButton: {
      color:
        "#171714",

      fontSize: 13,

      fontWeight:
        "900",
    },
  });