import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  router,
} from "expo-router";

import {
  useAuth,
} from "../context/AuthContext";

export default function AccountScreen() {
  const {
    user,
    signOut,
  } =
    useAuth();

  async function handleSignOut() {
    try {
      await signOut();

      router.replace(
        "/"
      );
    } catch (
      err: any
    ) {
      Alert.alert(
        "Could not log out",
        err?.message ||
          "Please try again."
      );
    }
  }

  function confirmSignOut() {
    Alert.alert(
      "Log out?",
      "You will need to log in again to use VINYLSCANNER.",
      [
        {
          text:
            "Cancel",

          style:
            "cancel",
        },

        {
          text:
            "Log out",

          style:
            "destructive",

          onPress:
            handleSignOut,
        },
      ]
    );
  }

  return (
    <SafeAreaView
      style={
        styles.screen
      }
    >
      <View
        style={
          styles.header
        }
      >
        <Pressable
          style={
            styles.circleButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Ionicons
            name="chevron-back"
            size={25}
            color="#171714"
          />
        </Pressable>

        <Text
          style={
            styles.headerTitle
          }
        >
          Account
        </Text>

        <View
          style={{
            width: 46,
          }}
        />
      </View>

      <View
        style={
          styles.content
        }
      >
        <View
          style={
            styles.avatar
          }
        >
          <Ionicons
            name="person"
            size={36}
            color="#FFFFFF"
          />
        </View>

        <Text
          style={
            styles.eyebrow
          }
        >
          YOUR ACCOUNT
        </Text>

        <Text
          style={
            styles.email
          }
        >
          {user?.email ||
            "Account"}
        </Text>

        <View
          style={
            styles.card
          }
        >
          <View
            style={
              styles.cardRow
            }
          >
            <View
              style={
                styles.iconBox
              }
            >
              <Ionicons
                name="mail-outline"
                size={21}
                color="#171714"
              />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.rowLabel
                }
              >
                EMAIL
              </Text>

              <Text
                style={
                  styles.rowValue
                }
              >
                {user?.email ||
                  "—"}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          style={
            styles.logoutButton
          }
          onPress={
            confirmSignOut
          }
        >
          <Ionicons
            name="log-out-outline"
            size={21}
            color="#812F2B"
          />

          <Text
            style={
              styles.logoutText
            }
          >
            Log out
          </Text>
        </Pressable>
      </View>
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

    header: {
      height: 68,

      paddingHorizontal:
        20,

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "space-between",
    },

    circleButton: {
      width: 46,
      height: 46,

      borderRadius: 23,

      backgroundColor:
        "#FFFFFF",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    headerTitle: {
      color:
        "#171714",

      fontSize: 17,

      fontWeight:
        "800",
    },

    content: {
      paddingHorizontal:
        22,

      paddingTop: 35,
    },

    avatar: {
      width: 78,
      height: 78,

      borderRadius: 27,

      backgroundColor:
        "#171714",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    eyebrow: {
      marginTop: 25,

      color:
        "#858179",

      fontSize: 10,

      fontWeight:
        "900",

      letterSpacing:
        1.2,
    },

    email: {
      marginTop: 5,

      color:
        "#171714",

      fontSize: 27,

      fontWeight:
        "900",
    },

    card: {
      marginTop: 30,

      padding: 18,

      borderRadius: 24,

      backgroundColor:
        "#FFFFFF",
    },

    cardRow: {
      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 14,
    },

    iconBox: {
      width: 48,
      height: 48,

      borderRadius: 16,

      backgroundColor:
        "#F1EFE9",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    rowLabel: {
      color:
        "#858179",

      fontSize: 9,

      fontWeight:
        "900",

      letterSpacing: 1,
    },

    rowValue: {
      marginTop: 4,

      color:
        "#171714",

      fontSize: 15,

      fontWeight:
        "700",
    },

    logoutButton: {
      height: 58,

      marginTop: 18,

      borderRadius: 20,

      backgroundColor:
        "#F1DEDA",

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap: 9,
    },

    logoutText: {
      color:
        "#812F2B",

      fontSize: 15,

      fontWeight:
        "800",
    },
  });