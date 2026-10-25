import { supabase } from "../lib/supabase";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
  CameraView,
  useCameraPermissions,
} from "expo-camera";

import * as ImagePicker from "expo-image-picker";

import {
  File,
} from "expo-file-system";

import {
  fetch as expoFetch,
} from "expo/fetch";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  router,
} from "expo-router";

// ======================================================
// CONFIG
// ======================================================

const API_URL =
  "http://172.16.1.215:3001";

const HISTORY_KEY =
  "vinylscanner_history_v2";

const COLLECTION_KEY =
  "vinylscanner_collection_v1";

// ======================================================
// TYPES
// ======================================================

type Grade =
  | "M"
  | "NM"
  | "VG+"
  | "VG"
  | "G+"
  | "G";

const GRADES: Grade[] = [
  "M",
  "NM",
  "VG+",
  "VG",
  "G+",
  "G",
];

type PricingResult = {
  currency?: string;
  estimatedPrice?: number;
  typicalLow?: number;
  typicalHigh?: number;
  listingsUsed?: number;
};

type PressingMatch = {
  level?:
    | "barcode"
    | "likely"
    | "exact";

  reason?: string;
};

type DiscogsResult = {
  year?: number | string;
  country?: string | null;
  genres?: string[];
  styles?: string[];
  labels?: string[];
  catnos?: string[];
  barcodes?: string[];
  matrixRunouts?: string[];
  discogsUrl?: string;
  coverImage?: string | null;
  releaseId?: number;
  masterId?: number | null;
  candidateCount?: number | null;
  pressingMatch?: PressingMatch | null;
};

type IdentifyResult = {
  success?: boolean;
  identified: boolean;
  artist?: string | null;
  album?: string | null;
  coverImage?: string | null;
  pricing?: PricingResult | null;
  discogs?: DiscogsResult | null;
  error?: string;
};

type ConditionPricing = {
  currency: string;
  estimatedPrice: number;
  typicalLow: number;
  typicalHigh: number;
  listingsUsed: number;
  outliersRemoved?: number;
  exactConditionMatches: number;
  totalGradedListings: number;
  vinylGrade: Grade;
  sleeveGrade: Grade;

  scope:
    | "barcode_catalog"
    | "catalog_release"
    | "year_country"
    | "album_only";

  scopeLabel: string;
  scopeStrength?: number;

  confidence:
    | "low"
    | "medium"
    | "high";

  highGradeGuardApplied?: boolean;
  note?: string;
};

type HistoryItem = {
  id: string;
  scannedAt: number;
  askingPrice?: number;
  vinylGrade?: Grade;
  sleeveGrade?: Grade;
  conditionPricing?: ConditionPricing | null;
  result: IdentifyResult;
};

type CollectionItem = {
  id: string;
  addedAt: number;
  vinylGrade?: Grade;
  sleeveGrade?: Grade;
  conditionPricing?: ConditionPricing | null;
  result: IdentifyResult;
};

type DealResult = {
  label: string;
  message: string;

  type:
    | "great"
    | "good"
    | "fair"
    | "overpriced";
};

type AppView =
  | "camera"
  | "preview"
  | "manual"
  | "barcode"
  | "exact"
  | "history"
  | "collection"
  | "result";

// ======================================================
// HELPERS
// ======================================================

function resultIdentity(
  data: IdentifyResult
) {
  const releaseId =
    data.discogs?.releaseId;

  if (releaseId) {
    return `release:${releaseId}`;
  }

  const artist =
    String(
      data.artist || ""
    )
      .trim()
      .toLowerCase();

  const album =
    String(
      data.album || ""
    )
      .trim()
      .toLowerCase();

  return `${artist}::${album}`;
}

// ======================================================
// LOGO
// ======================================================

function TurntableLogo({
  dark = false,
}: {
  dark?: boolean;
}) {
  const main =
    dark
      ? "#171714"
      : "#FFFFFF";

  const secondary =
    dark
      ? "#F8F6F0"
      : "#202020";

  return (
    <View
      style={[
        styles.turntableLogo,
        {
          borderColor:
            main,
        },
      ]}
    >
      <View
        style={
          styles.turntablePlatter
        }
      >
        <View
          style={[
            styles.turntableRecord,
            {
              backgroundColor:
                main,
            },
          ]}
        >
          <View
            style={[
              styles.turntableLabel,
              {
                backgroundColor:
                  secondary,
              },
            ]}
          >
            <View
              style={[
                styles.turntableHole,
                {
                  backgroundColor:
                    main,
                },
              ]}
            />
          </View>
        </View>
      </View>

      <View
        style={[
          styles.tonearmBase,
          {
            backgroundColor:
              main,
          },
        ]}
      />

      <View
        style={[
          styles.tonearm,
          {
            backgroundColor:
              main,
          },
        ]}
      />

      <View
        style={[
          styles.turntableControl,
          {
            backgroundColor:
              main,
          },
        ]}
      />
    </View>
  );
}

// ======================================================
// CONDITION SELECTOR
// ======================================================

function ConditionSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Grade | null;
  onChange:
    (grade: Grade) => void;
}) {
  return (
    <View
      style={
        styles.conditionSelector
      }
    >
      <Text
        style={
          styles.conditionSelectorLabel
        }
      >
        {label}
      </Text>

      <View
        style={
          styles.gradeRow
        }
      >
        {GRADES.map(
          (grade) => {
            const selected =
              value ===
              grade;

            return (
              <Pressable
                key={
                  grade
                }
                style={[
                  styles.gradeButton,

                  selected &&
                    styles.gradeButtonSelected,
                ]}
                onPress={() =>
                  onChange(
                    grade
                  )
                }
              >
                <Text
                  style={[
                    styles.gradeButtonText,

                    selected &&
                      styles.gradeButtonTextSelected,
                  ]}
                >
                  {grade}
                </Text>
              </Pressable>
            );
          }
        )}
      </View>
    </View>
  );
}

// ======================================================
// APP
// ======================================================

export default function VinylScannerScreen() {
  const cameraRef =
    useRef<any>(
      null
    );

  const barcodeBusyRef =
    useRef(
      false
    );

  const [
    permission,
    requestPermission,
  ] =
    useCameraPermissions();

  const [
    view,
    setView,
  ] =
    useState<AppView>(
      "camera"
    );

  const [
    menuOpen,
    setMenuOpen,
  ] =
    useState(
      false
    );

  const [
    cameraReady,
    setCameraReady,
  ] =
    useState(
      false
    );

  const [
    flashEnabled,
    setFlashEnabled,
  ] =
    useState(
      false
    );

  const [
    takingPhoto,
    setTakingPhoto,
  ] =
    useState(
      false
    );

  const [
    imageUri,
    setImageUri,
  ] =
    useState<
      string | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );

  const [
    result,
    setResult,
  ] =
    useState<
      IdentifyResult | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  const [
    manualAlbum,
    setManualAlbum,
  ] =
    useState(
      ""
    );

  const [
    manualArtist,
    setManualArtist,
  ] =
    useState(
      ""
    );

  // ======================================================
  // HISTORY
  // ======================================================

  const [
    history,
    setHistory,
  ] =
    useState<
      HistoryItem[]
    >([]);

  const [
    currentHistoryId,
    setCurrentHistoryId,
  ] =
    useState<
      string | null
    >(null);

  // ======================================================
  // COLLECTION
  // ======================================================

  const [
    collection,
    setCollection,
  ] =
    useState<
      CollectionItem[]
    >([]);

  const [
    currentCollectionId,
    setCurrentCollectionId,
  ] =
    useState<
      string | null
    >(null);

  // ======================================================
  // DEAL
  // ======================================================

  const [
    dealPriceInput,
    setDealPriceInput,
  ] =
    useState(
      ""
    );

  const [
    dealChecked,
    setDealChecked,
  ] =
    useState(
      false
    );

  // ======================================================
  // CONDITION
  // ======================================================

  const [
    vinylGrade,
    setVinylGrade,
  ] =
    useState<
      Grade | null
    >(null);

  const [
    sleeveGrade,
    setSleeveGrade,
  ] =
    useState<
      Grade | null
    >(null);

  const [
    conditionPricing,
    setConditionPricing,
  ] =
    useState<
      ConditionPricing | null
    >(null);

  const [
    conditionLoading,
    setConditionLoading,
  ] =
    useState(
      false
    );

  const [
    conditionError,
    setConditionError,
  ] =
    useState(
      ""
    );

  // ======================================================
  // BARCODE
  // ======================================================

  const [
    barcodeLocked,
    setBarcodeLocked,
  ] =
    useState(
      false
    );

  const [
    scannedBarcode,
    setScannedBarcode,
  ] =
    useState(
      ""
    );

  // ======================================================
  // EXACT PRESSING
  // ======================================================

  const [
    exactBarcode,
    setExactBarcode,
  ] =
    useState(
      ""
    );

  const [
    exactCatno,
    setExactCatno,
  ] =
    useState(
      ""
    );

  const [
    exactMatrix,
    setExactMatrix,
  ] =
    useState(
      ""
    );

  const [
    exactLoading,
    setExactLoading,
  ] =
    useState(
      false
    );

  const [
    exactError,
    setExactError,
  ] =
    useState(
      ""
    );

  // ======================================================
  // LOAD
  // ======================================================

  useEffect(() => {
    loadHistory();
    loadCollection();
  }, []);

  // ======================================================
  // MONEY
  // ======================================================

  function money(
  value?: number | null,
  currency = "USD"
) {
  if (value === undefined || value === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

  // ======================================================
  // HISTORY
  // ======================================================

async function loadHistory() {
  try {
    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setHistory([]);
      return;
    }

    const { data, error } = await supabase
      .from("record_history")
      .select("*")
      .eq("user_id", authData.user.id)
      .order("scanned_at", { ascending: false });

    if (error) {
      throw error;
    }

    const items: HistoryItem[] = (data ?? []).map((row) => ({
      id: row.id,
      scannedAt: new Date(row.scanned_at).getTime(),
      result: row.result,
      vinylGrade: row.vinyl_grade ?? undefined,
      sleeveGrade: row.sleeve_grade ?? undefined,
      conditionPricing: row.condition_pricing,
      askingPrice: row.asking_price ?? undefined,
    }));

    setHistory(items);
  } catch (error) {
    console.error("History loading failed:", error);
  }
}

async function saveToHistory(
  data: IdentifyResult
) {
  try {
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      throw new Error("You must be logged in.");
    }

    const { data: saved, error } = await supabase
      .from("record_history")
      .insert({
        user_id: authData.user.id,
        result: {
          ...data,
          coverImage:
            data.coverImage ||
            data.discogs?.coverImage ||
            null,
        },
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const item: HistoryItem = {
      id: saved.id,
      scannedAt: new Date(saved.scanned_at).getTime(),
      result: saved.result,
      vinylGrade: saved.vinyl_grade ?? undefined,
      sleeveGrade: saved.sleeve_grade ?? undefined,
      conditionPricing: saved.condition_pricing ?? null,
      askingPrice: saved.asking_price ?? undefined,
    };

    setHistory((previous) => [
      item,
      ...previous,
    ]);

    return saved.id;
  } catch (error) {
    console.error("History save error:", error);
    return null;
  }
}

  async function updateHistoryResult(
    id: string,
    data: IdentifyResult
  ) {
    try {
      const saved =
        await AsyncStorage.getItem(
          HISTORY_KEY
        );

      if (!saved) {
        return;
      }

      const parsed =
        JSON.parse(
          saved
        );

      if (
        !Array.isArray(
          parsed
        )
      ) {
        return;
      }

      const updated =
        parsed.map(
          (
            item: HistoryItem
          ) =>
            item.id === id
              ? {
                  ...item,

                  result:
                    data,

                  conditionPricing:
                    null,
                }
              : item
        );

      await AsyncStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(
          updated
        )
      );

      setHistory(
        updated
      );
    } catch (
      err
    ) {
      console.log(
        "History update error:",
        err
      );
    }
  }

  async function saveConditionToHistory(
    pricing:
      ConditionPricing
  ) {
    if (
      !currentHistoryId ||
      !vinylGrade ||
      !sleeveGrade
    ) {
      return;
    }

    try {
      const saved =
        await AsyncStorage.getItem(
          HISTORY_KEY
        );

      if (!saved) {
        return;
      }

      const parsed =
        JSON.parse(
          saved
        );

      if (
        !Array.isArray(
          parsed
        )
      ) {
        return;
      }

      const updated =
        parsed.map(
          (
            item: HistoryItem
          ) =>
            item.id ===
            currentHistoryId
              ? {
                  ...item,

                  vinylGrade,

                  sleeveGrade,

                  conditionPricing:
                    pricing,
                }
              : item
        );

      await AsyncStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(
          updated
        )
      );

      setHistory(
        updated
      );
    } catch (
      err
    ) {
      console.log(
        "History condition error:",
        err
      );
    }
  }

  async function saveDealToHistory(
    askingPrice: number
  ) {
    if (
      !currentHistoryId
    ) {
      return;
    }

    try {
      const saved =
        await AsyncStorage.getItem(
          HISTORY_KEY
        );

      if (!saved) {
        return;
      }

      const parsed =
        JSON.parse(
          saved
        );

      if (
        !Array.isArray(
          parsed
        )
      ) {
        return;
      }

      const updated =
        parsed.map(
          (
            item: HistoryItem
          ) =>
            item.id ===
            currentHistoryId
              ? {
                  ...item,
                  askingPrice,
                }
              : item
        );

      await AsyncStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(
          updated
        )
      );

      setHistory(
        updated
      );
    } catch (
      err
    ) {
      console.log(
        "History deal error:",
        err
      );
    }
  }

  async function removeHistoryItem(
    id: string
  ) {
    const updated =
      history.filter(
        (item) =>
          item.id !== id
      );

    await AsyncStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(
        updated
      )
    );

    setHistory(
      updated
    );
  }

  function confirmClearHistory() {
    Alert.alert(
      "Clear history?",
      "Remove all saved records from history?",
      [
        {
          text:
            "Cancel",

          style:
            "cancel",
        },

        {
          text:
            "Clear",

          style:
            "destructive",

          onPress:
            async () => {
              await AsyncStorage.removeItem(
                HISTORY_KEY
              );

              setHistory(
                []
              );
            },
        },
      ]
    );
  }

  async function openHistory() {
    setMenuOpen(
      false
    );

    await loadHistory();

    setView(
      "history"
    );
  }

  function openHistoryItem(
    item: HistoryItem
  ) {
    setImageUri(
      null
    );

    setResult(
      item.result
    );

    setCurrentHistoryId(
      item.id
    );

    const existingCollection =
      collection.find(
        (collectionItem) =>
          resultIdentity(
            collectionItem.result
          ) ===
          resultIdentity(
            item.result
          )
      );

    setCurrentCollectionId(
      existingCollection?.id ||
        null
    );

    setVinylGrade(
      item.vinylGrade ||
        null
    );

    setSleeveGrade(
      item.sleeveGrade ||
        null
    );

    setConditionPricing(
      item.conditionPricing ||
        null
    );

    setConditionError(
      ""
    );

    if (
      item.askingPrice !==
      undefined
    ) {
      setDealPriceInput(
        String(
          item.askingPrice
        )
      );

      setDealChecked(
        true
      );
    } else {
      setDealPriceInput(
        ""
      );

      setDealChecked(
        false
      );
    }

    setView(
      "result"
    );
  }

  // ======================================================
  // COLLECTION
  // ======================================================

  async function loadCollection() {
    try {
      const saved =
        await AsyncStorage.getItem(
          COLLECTION_KEY
        );

      if (!saved) {
        setCollection(
          []
        );

        return;
      }

      const parsed =
        JSON.parse(
          saved
        );

      if (
        Array.isArray(
          parsed
        )
      ) {
        setCollection(
          parsed
        );
      }
    } catch (
      err
    ) {
      console.log(
        "Collection load error:",
        err
      );
    }
  }

  async function writeCollection(
    updated:
      CollectionItem[]
  ) {
    await AsyncStorage.setItem(
      COLLECTION_KEY,
      JSON.stringify(
        updated
      )
    );

    setCollection(
      updated
    );
  }

  async function openCollection() {
    setMenuOpen(
      false
    );

    await loadCollection();

    setView(
      "collection"
    );
  }

  function openCollectionItem(
    item: CollectionItem
  ) {
    setImageUri(
      null
    );

    setResult(
      item.result
    );

    setCurrentHistoryId(
      null
    );

    setCurrentCollectionId(
      item.id
    );

    setVinylGrade(
      item.vinylGrade ||
        null
    );

    setSleeveGrade(
      item.sleeveGrade ||
        null
    );

    setConditionPricing(
      item.conditionPricing ||
        null
    );

    setConditionError(
      ""
    );

    resetDeal();

    setView(
      "result"
    );
  }

  async function addCurrentToCollection() {
    if (
      !result?.identified
    ) {
      return;
    }

    const identity =
      resultIdentity(
        result
      );

    const existing =
      collection.find(
        (item) =>
          resultIdentity(
            item.result
          ) ===
          identity
      );

    if (existing) {
      setCurrentCollectionId(
        existing.id
      );

      return;
    }

    const id =
      `collection-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const item:
      CollectionItem =
      {
        id,

        addedAt:
          Date.now(),

        vinylGrade:
          vinylGrade ||
          undefined,

        sleeveGrade:
          sleeveGrade ||
          undefined,

        conditionPricing:
          conditionPricing ||
          null,

        result: {
          ...result,

          coverImage:
            result.coverImage ||
            result.discogs
              ?.coverImage ||
            null,
        },
      };

    const updated =
      [
        item,
        ...collection,
      ];

    await writeCollection(
      updated
    );

    setCurrentCollectionId(
      id
    );
  }

  async function removeCollectionItem(
    id: string
  ) {
    const updated =
      collection.filter(
        (item) =>
          item.id !== id
      );

    await writeCollection(
      updated
    );

    if (
      currentCollectionId ===
      id
    ) {
      setCurrentCollectionId(
        null
      );
    }
  }

  function confirmRemoveCollectionItem(
    id: string
  ) {
    Alert.alert(
      "Remove from collection?",
      "This record will stay in History.",
      [
        {
          text:
            "Cancel",

          style:
            "cancel",
        },

        {
          text:
            "Remove",

          style:
            "destructive",

          onPress:
            () =>
              removeCollectionItem(
                id
              ),
        },
      ]
    );
  }

  async function updateCollectionItem(
    id: string,
    changes:
      Partial<CollectionItem>
  ) {
    const updated =
      collection.map(
        (item) =>
          item.id === id
            ? {
                ...item,
                ...changes,
              }
            : item
      );

    await writeCollection(
      updated
    );
  }

  async function toggleCurrentCollection() {
    if (!result) {
      return;
    }

    const identity =
      resultIdentity(
        result
      );

    const existing =
      collection.find(
        (item) =>
          item.id ===
            currentCollectionId ||
          resultIdentity(
            item.result
          ) ===
            identity
      );

    if (existing) {
      Alert.alert(
        "Remove from collection?",
        "This record will stay in History.",
        [
          {
            text:
              "Cancel",

            style:
              "cancel",
          },

          {
            text:
              "Remove",

            style:
              "destructive",

            onPress:
              () =>
                removeCollectionItem(
                  existing.id
                ),
          },
        ]
      );

      return;
    }

    await addCurrentToCollection();
  }

  async function saveConditionToCollection(
    pricing:
      ConditionPricing
  ) {
    if (
      !currentCollectionId ||
      !vinylGrade ||
      !sleeveGrade
    ) {
      return;
    }

    await updateCollectionItem(
      currentCollectionId,
      {
        vinylGrade,
        sleeveGrade,
        conditionPricing:
          pricing,
      }
    );
  }

  // ======================================================
  // RESET
  // ======================================================

  function resetCondition() {
    setVinylGrade(
      null
    );

    setSleeveGrade(
      null
    );

    setConditionPricing(
      null
    );

    setConditionError(
      ""
    );

    setConditionLoading(
      false
    );
  }

  function resetDeal() {
    setDealPriceInput(
      ""
    );

    setDealChecked(
      false
    );
  }

  function goToCamera() {
    setImageUri(
      null
    );

    setResult(
      null
    );

    setError(
      ""
    );

    setCurrentHistoryId(
      null
    );

    setCurrentCollectionId(
      null
    );

    resetCondition();
    resetDeal();

    barcodeBusyRef.current =
      false;

    setBarcodeLocked(
      false
    );

    setScannedBarcode(
      ""
    );

    setMenuOpen(
      false
    );

    setView(
      "camera"
    );
  }

  // ======================================================
  // CAMERA
  // ======================================================

  async function takePhoto() {
    if (
      !cameraRef.current ||
      !cameraReady ||
      takingPhoto
    ) {
      return;
    }

    try {
      setTakingPhoto(
        true
      );

      setError(
        ""
      );

      const photo =
        await cameraRef.current.takePictureAsync(
          {
            quality:
              0.9,
          }
        );

      if (
        !photo?.uri
      ) {
        throw new Error(
          "Camera did not return a photo."
        );
      }

      setImageUri(
        photo.uri
      );

      setResult(
        null
      );

      resetCondition();
      resetDeal();

      setView(
        "preview"
      );
    } catch (
      err: any
    ) {
      setError(
        err?.message ||
          "Could not take photo."
      );
    } finally {
      setTakingPhoto(
        false
      );
    }
  }

  // ======================================================
  // GALLERY
  // ======================================================

  async function chooseFromGallery() {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (
        !permissionResult.granted
      ) {
        return;
      }

      const picked =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes:
              ["images"],

            allowsEditing:
              true,

            aspect:
              [1, 1],

            quality:
              0.9,
          }
        );

      if (
        picked.canceled
      ) {
        return;
      }

      const asset =
        picked.assets[0];

      if (!asset?.uri) {
        return;
      }

      setImageUri(
        asset.uri
      );

      setResult(
        null
      );

      setCurrentHistoryId(
        null
      );

      setCurrentCollectionId(
        null
      );

      resetCondition();
      resetDeal();

      setView(
        "preview"
      );
    } catch (
      err
    ) {
      console.log(
        "Gallery error:",
        err
      );
    }
  }

  // ======================================================
  // IDENTIFY
  // ======================================================

  async function identifyRecord() {
    if (
      !imageUri
    ) {
      return;
    }

    try {
      setLoading(
        true
      );

      setError(
        ""
      );

      const file =
        new File(
          imageUri
        );

      const formData =
        new FormData();

      formData.append(
        "image",
        file
      );

      const response =
        await expoFetch(
          `${API_URL}/api/identify`,
          {
            method:
              "POST",

            body:
              formData,
          }
        );

      const raw =
        await response.text();

      const data =
        JSON.parse(
          raw
        ) as IdentifyResult;

      if (
        !response.ok ||
        !data.identified
      ) {
        throw new Error(
          data.error ||
            "Record could not be identified."
        );
      }

      setResult(
        data
      );

      const historyId =
        await saveToHistory(
          data
        );

      setCurrentHistoryId(
        historyId
      );

      const existingCollection =
        collection.find(
          (item) =>
            resultIdentity(
              item.result
            ) ===
            resultIdentity(
              data
            )
        );

      setCurrentCollectionId(
        existingCollection?.id ||
          null
      );

      resetCondition();
      resetDeal();

      setView(
        "result"
      );
    } catch (
      err: any
    ) {
      setError(
        err?.message ||
          "Identification failed."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  // ======================================================
  // MANUAL
  // ======================================================

  async function manualLookup() {
    const album =
      manualAlbum.trim();

    const artist =
      manualArtist.trim();

    if (!album) {
      setError(
        "Enter an album."
      );

      return;
    }

    try {
      setLoading(
        true
      );

      setError(
        ""
      );

      const response =
        await expoFetch(
          `${API_URL}/api/manual`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                album,
                artist,
              }),
          }
        );

      const data =
        JSON.parse(
          await response.text()
        ) as IdentifyResult;

      if (
        !response.ok ||
        !data.identified
      ) {
        throw new Error(
          data.error ||
            "Record not found."
        );
      }

      setImageUri(
        null
      );

      setResult(
        data
      );

      const historyId =
        await saveToHistory(
          data
        );

      setCurrentHistoryId(
        historyId
      );

      const existingCollection =
        collection.find(
          (item) =>
            resultIdentity(
              item.result
            ) ===
            resultIdentity(
              data
            )
        );

      setCurrentCollectionId(
        existingCollection?.id ||
          null
      );

      setManualAlbum(
        ""
      );

      setManualArtist(
        ""
      );

      resetCondition();
      resetDeal();

      setView(
        "result"
      );
    } catch (
      err: any
    ) {
      setError(
        err?.message ||
          "Search failed."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  // ======================================================
  // BARCODE
  // ======================================================

  function openBarcodeScanner() {
    barcodeBusyRef.current =
      false;

    setBarcodeLocked(
      false
    );

    setScannedBarcode(
      ""
    );

    setError(
      ""
    );

    setMenuOpen(
      false
    );

    setView(
      "barcode"
    );
  }

  async function handleBarcodeScanned(
    event: {
      data: string;
    }
  ) {
    if (
      barcodeBusyRef.current
    ) {
      return;
    }

    const barcode =
      String(
        event.data || ""
      )
        .replace(
          /[^0-9]/g,
          ""
        )
        .trim();

    if (!barcode) {
      return;
    }

    barcodeBusyRef.current =
      true;

    setBarcodeLocked(
      true
    );

    setScannedBarcode(
      barcode
    );

    setLoading(
      true
    );

    setError(
      ""
    );

    try {
      const response =
        await expoFetch(
          `${API_URL}/api/barcode`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                barcode,
              }),
          }
        );

      const data =
        JSON.parse(
          await response.text()
        ) as IdentifyResult;

      if (
        !response.ok ||
        !data.identified
      ) {
        throw new Error(
          data.error ||
            "Barcode not found."
        );
      }

      setImageUri(
        null
      );

      setResult(
        data
      );

      const historyId =
        await saveToHistory(
          data
        );

      setCurrentHistoryId(
        historyId
      );

      const existingCollection =
        collection.find(
          (item) =>
            resultIdentity(
              item.result
            ) ===
            resultIdentity(
              data
            )
        );

      setCurrentCollectionId(
        existingCollection?.id ||
          null
      );

      resetCondition();
      resetDeal();

      setView(
        "result"
      );
    } catch (
      err: any
    ) {
      setError(
        err?.message ||
          "Barcode search failed."
      );

      barcodeBusyRef.current =
        false;

      setBarcodeLocked(
        false
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  // ======================================================
  // EXACT PRESSING
  // ======================================================

  function openExactPressing() {
    setExactBarcode(
      result?.discogs
        ?.barcodes?.[0] ||
        scannedBarcode ||
        ""
    );

    setExactCatno(
      result?.discogs
        ?.catnos?.[0] ||
        ""
    );

    setExactMatrix(
      ""
    );

    setExactError(
      ""
    );

    setView(
      "exact"
    );
  }

  async function exactPressingSearch() {
    if (
      !result?.album
    ) {
      return;
    }

    if (
      !exactBarcode.trim() &&
      !exactCatno.trim() &&
      !exactMatrix.trim()
    ) {
      setExactError(
        "Enter barcode, catalog number or matrix/runout."
      );

      return;
    }

    try {
      setExactLoading(
        true
      );

      setExactError(
        ""
      );

      const response =
        await expoFetch(
          `${API_URL}/api/exact-pressing`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                artist:
                  result.artist ||
                  "",

                album:
                  result.album,

                barcode:
                  exactBarcode.trim(),

                catno:
                  exactCatno.trim(),

                matrix:
                  exactMatrix.trim(),
              }),
          }
        );

      const data =
        JSON.parse(
          await response.text()
        ) as IdentifyResult;

      if (
        !response.ok ||
        !data.identified
      ) {
        throw new Error(
          data.error ||
            "Pressing not found."
        );
      }

      setResult(
        data
      );

      setConditionPricing(
        null
      );

      setConditionError(
        ""
      );

      setDealChecked(
        false
      );

      if (
        currentHistoryId
      ) {
        await updateHistoryResult(
          currentHistoryId,
          data
        );
      }

      if (
        currentCollectionId
      ) {
        await updateCollectionItem(
          currentCollectionId,
          {
            result:
              data,

            conditionPricing:
              null,
          }
        );
      }

      setView(
        "result"
      );
    } catch (
      err: any
    ) {
      setExactError(
        err?.message ||
          "Pressing search failed."
      );
    } finally {
      setExactLoading(
        false
      );
    }
  }

  // ======================================================
  // CONDITION
  // ======================================================

  function changeVinylGrade(
    grade: Grade
  ) {
    setVinylGrade(
      grade
    );

    setConditionPricing(
      null
    );

    setConditionError(
      ""
    );

    setDealChecked(
      false
    );
  }

  function changeSleeveGrade(
    grade: Grade
  ) {
    setSleeveGrade(
      grade
    );

    setConditionPricing(
      null
    );

    setConditionError(
      ""
    );

    setDealChecked(
      false
    );
  }

  async function checkConditionValue() {
    if (
      !vinylGrade ||
      !sleeveGrade
    ) {
      setConditionError(
        "Choose both vinyl and sleeve condition."
      );

      return;
    }

    if (
      !result?.artist ||
      !result?.album
    ) {
      return;
    }

    try {
      setConditionLoading(
        true
      );

      setConditionError(
        ""
      );

      const response =
        await expoFetch(
          `${API_URL}/api/condition-value`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                artist:
                  result.artist,

                album:
                  result.album,

                vinylGrade,

                sleeveGrade,

                discogs:
                  result.discogs ||
                  {},
              }),
          }
        );

      const data =
        JSON.parse(
          await response.text()
        );

      if (
        !response.ok ||
        !data.pricing
      ) {
        throw new Error(
          data.error ||
            "Condition value unavailable."
        );
      }

      setConditionPricing(
        data.pricing
      );

      setDealChecked(
        false
      );

      await saveConditionToHistory(
        data.pricing
      );

      await saveConditionToCollection(
        data.pricing
      );
    } catch (
      err: any
    ) {
      setConditionPricing(
        null
      );

      setConditionError(
        err?.message ||
          "Condition value unavailable."
      );
    } finally {
      setConditionLoading(
        false
      );
    }
  }

  // ======================================================
  // DEAL
  // ======================================================

  function parseDealPrice() {
    const value =
      Number(
        dealPriceInput
          .trim()
          .replace(
            ",",
            "."
          )
          .replace(
            /[^0-9.]/g,
            ""
          )
      );

    if (
      !Number.isFinite(
        value
      ) ||
      value <= 0
    ) {
      return null;
    }

    return value;
  }

  function getDealResult(
    asking: number,
    estimate: number,
    currency: string
  ): DealResult {
    const ratio =
      asking /
      estimate;

    const difference =
      estimate -
      asking;

    let message = "";

    if (
      Math.abs(
        difference
      ) < 0.01
    ) {
      message =
        "Matches estimated value";
    } else if (
      difference > 0
    ) {
      message =
        `${money(
          difference,
          currency
        )} below estimated value`;
    } else {
      message =
        `${money(
          Math.abs(
            difference
          ),
          currency
        )} above estimated value`;
    }

    if (
      ratio <= 0.65
    ) {
      return {
        label:
          "GREAT DEAL",

        message,

        type:
          "great",
      };
    }

    if (
      ratio <= 0.85
    ) {
      return {
        label:
          "GOOD DEAL",

        message,

        type:
          "good",
      };
    }

    if (
      ratio <= 1.15
    ) {
      return {
        label:
          "FAIR PRICE",

        message,

        type:
          "fair",
      };
    }

    return {
      label:
        "OVERPRICED",

      message,

      type:
        "overpriced",
    };
  }

  async function checkDeal() {
    const asking =
      parseDealPrice();

    const estimate =
      conditionPricing
        ?.estimatedPrice ??
      result?.pricing
        ?.estimatedPrice;

    if (
      asking === null ||
      estimate ===
        undefined
    ) {
      return;
    }

    setDealChecked(
      true
    );

    await saveDealToHistory(
      asking
    );
  }

  // ======================================================
  // DISCOGS
  // ======================================================

  async function openDiscogs() {
    let url =
      result?.discogs
        ?.discogsUrl;

    if (
      !url &&
      result?.discogs
        ?.releaseId
    ) {
      url =
        `https://www.discogs.com/release/${result.discogs.releaseId}`;
    }

    if (!url) {
      return;
    }

    if (
      !url.startsWith(
        "http"
      )
    ) {
      url =
        `https://www.discogs.com${url}`;
    }

    await Linking.openURL(
      url
    );
  }

  // ======================================================
  // MENU
  // ======================================================

  function AppMenu() {
    return (
      <Modal
        visible={
          menuOpen
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setMenuOpen(
            false
          )
        }
      >
        <View
          style={
            styles.menuBackdrop
          }
        >
          <Pressable
            style={
              StyleSheet.absoluteFill
            }
            onPress={() =>
              setMenuOpen(
                false
              )
            }
          />

          <SafeAreaView
            style={
              styles.menuDrawer
            }
          >
            <View
              style={
                styles.menuHeader
              }
            >
              <TurntableLogo
                dark
              />

              <Text
                style={
                  styles.menuBrand
                }
              >
                VINYLSCANNER
              </Text>
            </View>

            <View
              style={
                styles.menuItems
              }
            >
              <Pressable
                style={
                  styles.menuItem
                }
                onPress={
                  goToCamera
                }
              >
                <Ionicons
                  name="scan-outline"
                  size={23}
                  color="#171714"
                />

                <Text
                  style={
                    styles.menuItemText
                  }
                >
                  Scan
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.menuItem
                }
                onPress={
                  openBarcodeScanner
                }
              >
                <Ionicons
                  name="barcode-outline"
                  size={23}
                  color="#171714"
                />

                <Text
                  style={
                    styles.menuItemText
                  }
                >
                  Barcode
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.menuItem
                }
                onPress={
                  openCollection
                }
              >
                <Ionicons
                  name="albums-outline"
                  size={23}
                  color="#171714"
                />

                <Text
                  style={
                    styles.menuItemText
                  }
                >
                  Collection
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.menuItem
                }
                onPress={
                  openHistory
                }
              >
                <Ionicons
                  name="time-outline"
                  size={23}
                  color="#171714"
                />

                <Text
                  style={
                    styles.menuItemText
                  }
                >
                  History
                </Text>
              </Pressable>

              <View
                style={
                  styles.menuDivider
                }
              />

              <Pressable
                style={
                  styles.menuItem
                }
                onPress={() => {
                  setMenuOpen(
                    false
                  );

                  router.push(
                    "/account"
                  );
                }}
              >
                <Ionicons
                  name="person-outline"
                  size={23}
                  color="#171714"
                />

                <Text
                  style={
                    styles.menuItemText
                  }
                >
                  Account
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    );
  }

  // ======================================================
  // COLLECTION VIEW
  // ======================================================

  if (
    view ===
    "collection"
  ) {
    const totalValue =
      collection.reduce(
        (
          total,
          item
        ) => {
          const currency =
            item.conditionPricing
              ?.currency ||
            item.result
              .pricing
              ?.currency ||
            "EUR";

          if (
            currency !==
            "EUR"
          ) {
            return total;
          }

          const value =
            item.conditionPricing
              ?.estimatedPrice ??
            item.result
              .pricing
              ?.estimatedPrice ??
            0;

          return (
            total +
            value
          );
        },
        0
      );

    return (
      <SafeAreaView
        style={
          styles.lightScreen
        }
      >
        <AppMenu />

        <View
          style={[
            styles.lightHeader,
            styles.pageHorizontal,
          ]}
        >
          <Pressable
            style={
              styles.lightCircleButton
            }
            onPress={() =>
              setMenuOpen(
                true
              )
            }
          >
            <Ionicons
              name="menu"
              size={27}
              color="#171714"
            />
          </Pressable>

          <Text
            style={
              styles.lightHeaderTitle
            }
          >
            Collection
          </Text>

          <View
            style={
              styles.headerPlaceholder
            }
          />
        </View>

        {!collection.length ? (
          <View
            style={
              styles.emptyCollection
            }
          >
            <View
              style={
                styles.emptyCollectionIcon
              }
            >
              <Ionicons
                name="albums-outline"
                size={40}
                color="#171714"
              />
            </View>

            <Text
              style={
                styles.emptyCollectionTitle
              }
            >
              Your collection is empty
            </Text>

            <Text
              style={
                styles.emptyCollectionText
              }
            >
              Add records from the result screen.
            </Text>

            <Pressable
              style={
                styles.emptyCollectionButton
              }
              onPress={
                goToCamera
              }
            >
              <Text
                style={
                  styles.emptyCollectionButtonText
                }
              >
                Scan a record
              </Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={
              styles.collectionList
            }
            showsVerticalScrollIndicator={
              false
            }
          >
            <Text
              style={
                styles.collectionEyebrow
              }
            >
              MY COLLECTION
            </Text>

            <View
              style={
                styles.collectionSummary
              }
            >
              <View>
                <Text
                  style={
                    styles.collectionSummaryValue
                  }
                >
                  {collection.length}
                </Text>

                <Text
                  style={
                    styles.collectionSummaryLabel
                  }
                >
                  {collection.length ===
                  1
                    ? "RECORD"
                    : "RECORDS"}
                </Text>
              </View>

              <View
                style={
                  styles.collectionSummaryDivider
                }
              />

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.collectionSummaryValue
                  }
                >
                  {money(
                    totalValue,
                    "EUR"
                  )}
                </Text>

                <Text
                  style={
                    styles.collectionSummaryLabel
                  }
                >
                  ESTIMATED VALUE
                </Text>
              </View>
            </View>

            {collection.map(
              (item) => {
                const cover =
                  item.result
                    .coverImage ||
                  item.result
                    .discogs
                    ?.coverImage;

                const value =
                  item
                    .conditionPricing
                    ?.estimatedPrice ??
                  item.result
                    .pricing
                    ?.estimatedPrice;

                const currency =
                  item
                    .conditionPricing
                    ?.currency ||
                  item.result
                    .pricing
                    ?.currency ||
                  "EUR";

                const exact =
                  item.result
                    .discogs
                    ?.pressingMatch
                    ?.level ===
                  "exact";

                return (
                  <Pressable
                    key={
                      item.id
                    }
                    style={
                      styles.collectionCard
                    }
                    onPress={() =>
                      openCollectionItem(
                        item
                      )
                    }
                  >
                    {cover ? (
                      <Image
                        source={{
                          uri:
                            cover,
                        }}
                        style={
                          styles.collectionCover
                        }
                      />
                    ) : (
                      <View
                        style={
                          styles.collectionCoverPlaceholder
                        }
                      >
                        <Ionicons
                          name="disc-outline"
                          size={34}
                          color="#77746D"
                        />
                      </View>
                    )}

                    <View
                      style={
                        styles.collectionInfo
                      }
                    >
                      <Text
                        style={
                          styles.collectionArtist
                        }
                        numberOfLines={1}
                      >
                        {item.result.artist}
                      </Text>

                      <Text
                        style={
                          styles.collectionAlbum
                        }
                        numberOfLines={2}
                      >
                        {item.result.album}
                      </Text>

                      {item.vinylGrade &&
                      item.sleeveGrade ? (
                        <Text
                          style={
                            styles.collectionCondition
                          }
                        >
                          {item.vinylGrade} vinyl · {item.sleeveGrade} sleeve
                        </Text>
                      ) : null}

                      {exact ? (
                        <Text
                          style={
                            styles.collectionExact
                          }
                        >
                          EXACT PRESSING
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={
                        styles.collectionRight
                      }
                    >
                      <Text
                        style={
                          styles.collectionPrice
                        }
                      >
                        {money(
                          value,
                          currency
                        )}
                      </Text>

                      <Pressable
                        style={
                          styles.collectionDelete
                        }
                        onPress={(
                          event
                        ) => {
                          event.stopPropagation();

                          confirmRemoveCollectionItem(
                            item.id
                          );
                        }}
                      >
                        <Ionicons
                          name="close"
                          size={17}
                          color="#77746D"
                        />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              }
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ======================================================
  // HISTORY VIEW
  // ======================================================

  if (
    view ===
    "history"
  ) {
    return (
      <SafeAreaView
        style={
          styles.lightScreen
        }
      >
        <AppMenu />

        <View
          style={[
            styles.lightHeader,
            styles.pageHorizontal,
          ]}
        >
          <Pressable
            style={
              styles.lightCircleButton
            }
            onPress={() =>
              setMenuOpen(
                true
              )
            }
          >
            <Ionicons
              name="menu"
              size={27}
              color="#171714"
            />
          </Pressable>

          <Text
            style={
              styles.lightHeaderTitle
            }
          >
            History
          </Text>

          {history.length ? (
            <Pressable
              style={
                styles.lightCircleButton
              }
              onPress={
                confirmClearHistory
              }
            >
              <Ionicons
                name="trash-outline"
                size={21}
                color="#171714"
              />
            </Pressable>
          ) : (
            <View
              style={
                styles.headerPlaceholder
              }
            />
          )}
        </View>

        {!history.length ? (
          <View
            style={
              styles.emptyHistory
            }
          >
            <Ionicons
              name="albums-outline"
              size={50}
              color="#77746D"
            />

            <Text
              style={
                styles.emptyHistoryTitle
              }
            >
              No records yet
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={
              styles.historyList
            }
            showsVerticalScrollIndicator={
              false
            }
          >
            <Text
              style={
                styles.historyEyebrow
              }
            >
              RECENT RECORDS
            </Text>

            <Text
              style={
                styles.historyCount
              }
            >
              {history.length}{" "}
              {history.length ===
              1
                ? "record"
                : "records"}
            </Text>

            {history.map(
              (item) => {
                const cover =
                  item.result
                    .coverImage ||
                  item.result
                    .discogs
                    ?.coverImage;

                const value =
                  item
                    .conditionPricing
                    ?.estimatedPrice ??
                  item.result
                    .pricing
                    ?.estimatedPrice;

                const currency =
                  item
                    .conditionPricing
                    ?.currency ||
                  item.result
                    .pricing
                    ?.currency ||
                  "EUR";

                return (
                  <Pressable
                    key={
                      item.id
                    }
                    style={
                      styles.historyCard
                    }
                    onPress={() =>
                      openHistoryItem(
                        item
                      )
                    }
                  >
                    {cover ? (
                      <Image
                        source={{
                          uri:
                            cover,
                        }}
                        style={
                          styles.historyCover
                        }
                      />
                    ) : (
                      <View
                        style={
                          styles.historyCoverPlaceholder
                        }
                      >
                        <Ionicons
                          name="disc-outline"
                          size={32}
                          color="#77746D"
                        />
                      </View>
                    )}

                    <View
                      style={
                        styles.historyInfo
                      }
                    >
                      <Text
                        style={
                          styles.historyArtist
                        }
                        numberOfLines={1}
                      >
                        {item.result.artist}
                      </Text>

                      <Text
                        style={
                          styles.historyAlbum
                        }
                        numberOfLines={2}
                      >
                        {item.result.album}
                      </Text>

                      {item.vinylGrade &&
                      item.sleeveGrade ? (
                        <Text
                          style={
                            styles.historyCondition
                          }
                        >
                          {item.vinylGrade} vinyl · {item.sleeveGrade} sleeve
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={
                        styles.historyRight
                      }
                    >
                      <Text
                        style={
                          styles.historyPrice
                        }
                      >
                        {money(
                          value,
                          currency
                        )}
                      </Text>

                      <Pressable
                        style={
                          styles.historyDelete
                        }
                        onPress={(
                          event
                        ) => {
                          event.stopPropagation();

                          removeHistoryItem(
                            item.id
                          );
                        }}
                      >
                        <Ionicons
                          name="close"
                          size={17}
                          color="#77746D"
                        />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              }
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ======================================================
  // BARCODE VIEW
  // ======================================================

  if (
    view ===
    "barcode"
  ) {
    return (
      <View
        style={
          styles.darkScreen
        }
      >
        <CameraView
          style={
            StyleSheet.absoluteFill
          }
          facing="back"
          enableTorch={
            flashEnabled
          }
          barcodeScannerSettings={{
            barcodeTypes: [
              "ean13",
              "ean8",
              "upc_a",
              "upc_e",
            ],
          }}
          onBarcodeScanned={
            barcodeLocked
              ? undefined
              : handleBarcodeScanned
          }
        />

        <SafeAreaView
          style={{
            flex: 1,
          }}
        >
          <View
            style={
              styles.darkHeader
            }
          >
            <Pressable
              style={
                styles.darkCircleButton
              }
              onPress={
                goToCamera
              }
            >
              <Ionicons
                name="chevron-back"
                size={26}
                color="#FFFFFF"
              />
            </Pressable>

            <Text
              style={
                styles.darkHeaderTitle
              }
            >
              Scan barcode
            </Text>

            <Pressable
              style={
                styles.darkCircleButton
              }
              onPress={() =>
                setFlashEnabled(
                  (
                    value
                  ) =>
                    !value
                )
              }
            >
              <Ionicons
                name={
                  flashEnabled
                    ? "flash"
                    : "flash-off"
                }
                size={24}
                color="#FFFFFF"
              />
            </Pressable>
          </View>

          <View
            style={
              styles.barcodeCenter
            }
          >
            <View
              style={
                styles.barcodeFrame
              }
            >
              <View
                style={
                  styles.barcodeLine
                }
              />
            </View>

            <Text
              style={
                styles.barcodeHelp
              }
            >
              Align the barcode inside the frame
            </Text>

            {loading ? (
              <ActivityIndicator
                style={{
                  marginTop:
                    25,
                }}
                size="large"
                color="#FFFFFF"
              />
            ) : null}

            {error ? (
              <View
                style={
                  styles.barcodeError
                }
              >
                <Text>
                  {error}
                </Text>

                <Pressable
                  style={
                    styles.smallDarkButton
                  }
                  onPress={() => {
                    setError(
                      ""
                    );

                    setBarcodeLocked(
                      false
                    );

                    barcodeBusyRef.current =
                      false;
                  }}
                >
                  <Text
                    style={
                      styles.smallDarkButtonText
                    }
                  >
                    Scan again
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ======================================================
  // EXACT PRESSING VIEW
  // ======================================================

  if (
    view ===
    "exact"
  ) {
    return (
      <SafeAreaView
        style={
          styles.lightScreen
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.page
          }
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={
              styles.lightHeader
            }
          >
            <Pressable
              style={
                styles.lightCircleButton
              }
              onPress={() =>
                setView(
                  "result"
                )
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
                styles.lightHeaderTitle
              }
            >
              Exact pressing
            </Text>

            <View
              style={
                styles.headerPlaceholder
              }
            />
          </View>

          <Text
            style={
              styles.bigTitle
            }
          >
            Find your pressing
          </Text>

          <Text
            style={
              styles.bodyText
            }
          >
            Barcode and catalog number narrow the release down. Matrix/runout gives the strongest match.
          </Text>

          <Text
            style={
              styles.inputLabel
            }
          >
            BARCODE
          </Text>

          <TextInput
            value={
              exactBarcode
            }
            onChangeText={
              setExactBarcode
            }
            keyboardType="number-pad"
            placeholder="602508..."
            placeholderTextColor="#AAA69D"
            style={
              styles.input
            }
          />

          <Text
            style={
              styles.inputLabelSpaced
            }
          >
            CATALOG NUMBER
          </Text>

          <TextInput
            value={
              exactCatno
            }
            onChangeText={
              setExactCatno
            }
            placeholder="GEF 24425"
            placeholderTextColor="#AAA69D"
            style={
              styles.input
            }
          />

          <Text
            style={
              styles.inputLabelSpaced
            }
          >
            MATRIX / RUNOUT
          </Text>

          <TextInput
            value={
              exactMatrix
            }
            onChangeText={
              setExactMatrix
            }
            placeholder="Enter etched or stamped code"
            placeholderTextColor="#AAA69D"
            style={
              styles.input
            }
          />

          <Pressable
            style={
              styles.primaryButton
            }
            onPress={
              exactPressingSearch
            }
          >
            {exactLoading ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Find pressing
              </Text>
            )}
          </Pressable>

          {exactError ? (
            <Text
              style={
                styles.errorText
              }
            >
              {exactError}
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ======================================================
  // MANUAL VIEW
  // ======================================================

  if (
    view ===
    "manual"
  ) {
    return (
      <SafeAreaView
        style={
          styles.lightScreen
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.page
          }
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={
              styles.lightHeader
            }
          >
            <Pressable
              style={
                styles.lightCircleButton
              }
              onPress={
                goToCamera
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
                styles.lightHeaderTitle
              }
            >
              Manual search
            </Text>

            <View
              style={
                styles.headerPlaceholder
              }
            />
          </View>

          <Text
            style={
              styles.bigTitle
            }
          >
            Search by album
          </Text>

          <Text
            style={
              styles.inputLabelFirst
            }
          >
            ALBUM
          </Text>

          <TextInput
            value={
              manualAlbum
            }
            onChangeText={
              setManualAlbum
            }
            placeholder="Nevermind"
            placeholderTextColor="#AAA69D"
            style={
              styles.input
            }
          />

          <Text
            style={
              styles.inputLabelSpaced
            }
          >
            ARTIST (OPTIONAL)
          </Text>

          <TextInput
            value={
              manualArtist
            }
            onChangeText={
              setManualArtist
            }
            placeholder="Nirvana"
            placeholderTextColor="#AAA69D"
            style={
              styles.input
            }
          />

          <Pressable
            style={
              styles.primaryButton
            }
            onPress={
              manualLookup
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
                Find record
              </Text>
            )}
          </Pressable>

          {error ? (
            <Text
              style={
                styles.errorText
              }
            >
              {error}
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ======================================================
  // RESULT VIEW
  // ======================================================

  if (
    view ===
      "result" &&
    result?.identified
  ) {
    const cover =
      imageUri ||
      result.coverImage ||
      result.discogs
        ?.coverImage;

    const marketCurrency =
      result.pricing
        ?.currency ||
      "EUR";

    const marketEstimate =
      result.pricing
        ?.estimatedPrice;

    const dealCurrency =
      conditionPricing
        ?.currency ||
      marketCurrency;

    const dealEstimate =
      conditionPricing
        ?.estimatedPrice ??
      marketEstimate;

    const asking =
      parseDealPrice();

    const deal =
      dealChecked &&
      asking !== null &&
      dealEstimate !==
        undefined
        ? getDealResult(
            asking,
            dealEstimate,
            dealCurrency
          )
        : null;

    const pressing =
      result.discogs
        ?.pressingMatch;

    const identity =
      resultIdentity(
        result
      );

    const collectionEntry =
      collection.find(
        (item) =>
          item.id ===
            currentCollectionId ||
          resultIdentity(
            item.result
          ) ===
            identity
      );

    const inCollection =
      Boolean(
        collectionEntry
      );

    return (
      <SafeAreaView
        style={
          styles.lightScreen
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
              styles.resultPage
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={
              false
            }
          >
            <View
              style={
                styles.lightHeader
              }
            >
              <Pressable
                style={
                  styles.lightCircleButton
                }
                onPress={
                  goToCamera
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
                  styles.lightHeaderTitle
                }
              >
                Result
              </Text>

              <Pressable
                style={
                  styles.lightCircleButton
                }
                onPress={
                  openCollection
                }
              >
                <Ionicons
                  name="albums-outline"
                  size={22}
                  color="#171714"
                />
              </Pressable>
            </View>

            {cover ? (
              <Image
                source={{
                  uri:
                    cover,
                }}
                style={
                  styles.resultCover
                }
              />
            ) : (
              <View
                style={
                  styles.noCover
                }
              >
                <Ionicons
                  name="disc-outline"
                  size={70}
                  color="#77746D"
                />
              </View>
            )}

            <Text
              style={
                styles.resultArtist
              }
            >
              {result.artist}
            </Text>

            <Text
              style={
                styles.resultAlbum
              }
            >
              {result.album}
            </Text>

            <View
              style={
                styles.valueCard
              }
            >
              <Text
                style={
                  styles.valueLabel
                }
              >
                MARKET ESTIMATE
              </Text>

              <Text
                style={
                  styles.valuePrice
                }
              >
                {money(
                  marketEstimate,
                  marketCurrency
                )}
              </Text>
            </View>

            <Pressable
              style={
                styles.scanAgainTopButton
              }
              onPress={
                goToCamera
              }
            >
              <Ionicons
                name="scan-outline"
                size={22}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.scanAgainTopText
                }
              >
                Scan another record
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.collectionActionButton,

                inCollection &&
                  styles.collectionActionButtonAdded,
              ]}
              onPress={
                toggleCurrentCollection
              }
            >
              <Ionicons
                name={
                  inCollection
                    ? "checkmark-circle"
                    : "add-circle-outline"
                }
                size={22}
                color={
                  inCollection
                    ? "#315C34"
                    : "#171714"
                }
              />

              <Text
                style={[
                  styles.collectionActionText,

                  inCollection &&
                    styles.collectionActionTextAdded,
                ]}
              >
                {inCollection
                  ? "In collection"
                  : "Add to collection"}
              </Text>
            </Pressable>

            {/* PRESSING */}

            <View
              style={
                styles.card
              }
            >
              <Text
                style={
                  styles.eyebrow
                }
              >
                PRESSING
              </Text>

              <Text
                style={
                  styles.cardTitle
                }
              >
                {pressing
                  ?.level ===
                "exact"
                  ? "Exact pressing match"
                  : pressing
                        ?.level ===
                      "likely"
                    ? "Likely pressing"
                    : pressing
                        ?.level ===
                      "barcode"
                      ? "Barcode match"
                      : "Find exact pressing"}
              </Text>

              {result.discogs
                ?.year ? (
                <Text
                  style={
                    styles.detailLine
                  }
                >
                  Year:{" "}
                  {
                    result
                      .discogs
                      .year
                  }
                </Text>
              ) : null}

              {result.discogs
                ?.country ? (
                <Text
                  style={
                    styles.detailLine
                  }
                >
                  Country:{" "}
                  {
                    result
                      .discogs
                      .country
                  }
                </Text>
              ) : null}

              {result.discogs
                ?.labels?.[0] ? (
                <Text
                  style={
                    styles.detailLine
                  }
                >
                  Label:{" "}
                  {
                    result
                      .discogs
                      .labels[0]
                  }
                </Text>
              ) : null}

              {result.discogs
                ?.catnos?.[0] ? (
                <Text
                  style={
                    styles.detailLine
                  }
                >
                  Catalog:{" "}
                  {
                    result
                      .discogs
                      .catnos[0]
                  }
                </Text>
              ) : null}

              <Pressable
                style={
                  styles.findPressingButton
                }
                onPress={
                  openExactPressing
                }
              >
                <Ionicons
                  name="finger-print-outline"
                  size={20}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.findPressingText
                  }
                >
                  {pressing
                    ?.level ===
                  "exact"
                    ? "Check another pressing"
                    : "Find exact pressing"}
                </Text>
              </Pressable>
            </View>

            {/* CONDITION */}

            <View
              style={
                styles.card
              }
            >
              <Text
                style={
                  styles.eyebrow
                }
              >
                CONDITION
              </Text>

              <Text
                style={
                  styles.cardTitle
                }
              >
                Value your copy
              </Text>

              <ConditionSelector
                label="VINYL"
                value={
                  vinylGrade
                }
                onChange={
                  changeVinylGrade
                }
              />

              <ConditionSelector
                label="SLEEVE"
                value={
                  sleeveGrade
                }
                onChange={
                  changeSleeveGrade
                }
              />

              <Pressable
                style={[
                  styles.conditionButton,

                  (!vinylGrade ||
                    !sleeveGrade ||
                    conditionLoading) &&
                    styles.disabledButton,
                ]}
                disabled={
                  !vinylGrade ||
                  !sleeveGrade ||
                  conditionLoading
                }
                onPress={
                  checkConditionValue
                }
              >
                {conditionLoading ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.conditionButtonText
                    }
                  >
                    Check condition value
                  </Text>
                )}
              </Pressable>

              {conditionError ? (
                <Text
                  style={
                    styles.errorText
                  }
                >
                  {conditionError}
                </Text>
              ) : null}

              {conditionPricing ? (
                <View
                  style={
                    styles.copyEstimate
                  }
                >
                  <Text
                    style={
                      styles.copyEstimateLabel
                    }
                  >
                    YOUR COPY ESTIMATE
                  </Text>

                  <Text
                    style={
                      styles.copyEstimatePrice
                    }
                  >
                    {money(
                      conditionPricing.estimatedPrice,
                      conditionPricing.currency
                    )}
                  </Text>

                  <Text
                    style={
                      styles.copyRange
                    }
                  >
                    {money(
                      conditionPricing.typicalLow,
                      conditionPricing.currency
                    )}
                    {" – "}
                    {money(
                      conditionPricing.typicalHigh,
                      conditionPricing.currency
                    )}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* DEAL */}

            {dealEstimate !==
            undefined ? (
              <View
                style={
                  styles.card
                }
              >
                <Text
                  style={
                    styles.eyebrow
                  }
                >
                  DEAL CHECK
                </Text>

                <Text
                  style={
                    styles.cardTitle
                  }
                >
                  Is it worth it?
                </Text>

                <View
                  style={
                    styles.dealRow
                  }
                >
                  <View
                    style={
                      styles.dealInputWrap
                    }
                  >
                    <Text
                      style={
                        styles.dealCurrency
                      }
                    >
                      {dealCurrency ===
                      "EUR"
                        ? "€"
                        : dealCurrency}
                    </Text>

                    <TextInput
                      value={
                        dealPriceInput
                      }
                      onChangeText={(
                        text
                      ) => {
                        setDealPriceInput(
                          text
                        );

                        setDealChecked(
                          false
                        );
                      }}
                      keyboardType="decimal-pad"
                      placeholder="12.00"
                      placeholderTextColor="#AAA69D"
                      style={
                        styles.dealInput
                      }
                    />
                  </View>

                  <Pressable
                    style={
                      styles.dealButton
                    }
                    onPress={
                      checkDeal
                    }
                  >
                    <Text
                      style={
                        styles.dealButtonText
                      }
                    >
                      Check
                    </Text>
                  </Pressable>
                </View>

                {deal ? (
                  <View
                    style={[
                      styles.dealResult,

                      deal.type ===
                        "great" &&
                        styles.dealGreat,

                      deal.type ===
                        "good" &&
                        styles.dealGood,

                      deal.type ===
                        "fair" &&
                        styles.dealFair,

                      deal.type ===
                        "overpriced" &&
                        styles.dealOverpriced,
                    ]}
                  >
                    <Text
                      style={
                        styles.dealResultTitle
                      }
                    >
                      {
                        deal.label
                      }
                    </Text>

                    <Text
                      style={
                        styles.dealResultMessage
                      }
                    >
                      {
                        deal.message
                      }
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {result.discogs
              ?.discogsUrl ||
            result.discogs
              ?.releaseId ? (
              <Pressable
                style={
                  styles.discogsButton
                }
                onPress={
                  openDiscogs
                }
              >
                <Text
                  style={
                    styles.discogsButtonText
                  }
                >
                  Open in Discogs
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ======================================================
  // PREVIEW
  // ======================================================

  if (
    view ===
      "preview" &&
    imageUri
  ) {
    return (
      <SafeAreaView
        style={
          styles.darkScreen
        }
      >
        <View
          style={
            styles.darkHeader
          }
        >
          <Pressable
            style={
              styles.darkCircleButton
            }
            onPress={
              goToCamera
            }
          >
            <Ionicons
              name="close"
              size={27}
              color="#FFFFFF"
            />
          </Pressable>

          <View
            style={
              styles.cameraBrand
            }
          >
            <TurntableLogo />

            <Text
              style={
                styles.cameraBrandText
              }
            >
              VINYLSCANNER
            </Text>
          </View>

          <View
            style={{
              width: 54,
            }}
          />
        </View>

        <View
          style={
            styles.previewWrap
          }
        >
          <Image
            source={{
              uri:
                imageUri,
            }}
            style={
              styles.previewImage
            }
          />

          {loading ? (
            <View
              style={
                styles.loadingOverlay
              }
            >
              <ActivityIndicator
                size="large"
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.loadingText
                }
              >
                Identifying record...
              </Text>
            </View>
          ) : null}
        </View>

        <View
          style={
            styles.previewControls
          }
        >
          <Pressable
            onPress={
              goToCamera
            }
          >
            <Text
              style={
                styles.previewControlText
              }
            >
              Retake
            </Text>
          </Pressable>

          <Pressable
            style={
              styles.identifyCircle
            }
            onPress={
              identifyRecord
            }
          >
            <Ionicons
              name="sparkles"
              size={27}
              color="#171714"
            />
          </Pressable>

          <Pressable
            onPress={
              chooseFromGallery
            }
          >
            <Text
              style={
                styles.previewControlText
              }
            >
              Gallery
            </Text>
          </Pressable>
        </View>

        {error ? (
          <Text
            style={
              styles.previewError
            }
          >
            {error}
          </Text>
        ) : null}
      </SafeAreaView>
    );
  }

  // ======================================================
  // CAMERA PERMISSION
  // ======================================================

  if (
    !permission
  ) {
    return (
      <View
        style={
          styles.darkScreen
        }
      />
    );
  }

  if (
    !permission.granted
  ) {
    return (
      <SafeAreaView
        style={
          styles.permissionScreen
        }
      >
        <TurntableLogo />

        <Text
          style={
            styles.permissionTitle
          }
        >
          Camera access
        </Text>

        <Pressable
          style={
            styles.permissionButton
          }
          onPress={
            requestPermission
          }
        >
          <Text
            style={
              styles.permissionButtonText
            }
          >
            Allow camera
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ======================================================
  // CAMERA
  // ======================================================

  return (
    <View
      style={
        styles.darkScreen
      }
    >
      <CameraView
        ref={
          cameraRef
        }
        style={
          StyleSheet.absoluteFill
        }
        facing="back"
        flash={
          flashEnabled
            ? "on"
            : "off"
        }
        onCameraReady={() =>
          setCameraReady(
            true
          )
        }
      />

      <SafeAreaView
        style={{
          flex: 1,
        }}
      >
        <AppMenu />

        <View
          style={
            styles.darkHeader
          }
        >
          <Pressable
            style={
              styles.darkCircleButton
            }
            onPress={() =>
              setMenuOpen(
                true
              )
            }
          >
            <Ionicons
              name="menu"
              size={28}
              color="#FFFFFF"
            />
          </Pressable>

          <View
            style={
              styles.cameraBrand
            }
          >
            <TurntableLogo />

            <Text
              style={
                styles.cameraBrandText
              }
            >
              VINYLSCANNER
            </Text>
          </View>

          <Pressable
            style={
              styles.darkCircleButton
            }
            onPress={() =>
              setFlashEnabled(
                (
                  value
                ) =>
                  !value
              )
            }
          >
            <Ionicons
              name={
                flashEnabled
                  ? "flash"
                  : "flash-off"
              }
              size={25}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        <View
          style={
            styles.cameraMiddle
          }
        >
          <View
            style={
              styles.scanFrame
            }
          />

          <Pressable
            style={
              styles.barcodeQuick
            }
            onPress={
              openBarcodeScanner
            }
          >
            <Ionicons
              name="barcode-outline"
              size={21}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.barcodeQuickText
              }
            >
              Scan barcode
            </Text>
          </Pressable>
        </View>

        <View
          style={
            styles.cameraControls
          }
        >
          <Pressable
            style={
              styles.sideControl
            }
            onPress={
              chooseFromGallery
            }
          >
            <Ionicons
              name="images-outline"
              size={30}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.sideControlText
              }
            >
              Gallery
            </Text>
          </Pressable>

          <Pressable
            style={
              styles.shutterOuter
            }
            disabled={
              !cameraReady ||
              takingPhoto
            }
            onPress={
              takePhoto
            }
          >
            <View
              style={
                styles.shutterInner
              }
            />
          </Pressable>

          <Pressable
            style={
              styles.sideControl
            }
            onPress={() => {
              setError(
                ""
              );

              setView(
                "manual"
              );
            }}
          >
            <Ionicons
              name="create-outline"
              size={30}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.sideControlText
              }
            >
              Manual
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ======================================================
// STYLES
// ======================================================

const styles =
  StyleSheet.create({
    darkScreen: {
      flex: 1,
      backgroundColor:
        "#000000",
    },

    lightScreen: {
      flex: 1,
      backgroundColor:
        "#F8F6F0",
    },

    page: {
      paddingHorizontal:
        22,
      paddingBottom:
        50,
    },

    pageHorizontal: {
      paddingHorizontal:
        20,
    },

    headerPlaceholder: {
      width: 46,
    },

    disabledButton: {
      opacity: 0.45,
    },

    // LOGO

    turntableLogo: {
      width: 48,
      height: 40,
      borderWidth: 1.4,
      borderRadius: 10,
      position:
        "relative",
    },

    turntablePlatter: {
      position:
        "absolute",
      left: 5,
      top: 5,
      width: 29,
      height: 29,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    turntableRecord: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    turntableLabel: {
      width: 10,
      height: 10,
      borderRadius: 5,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    turntableHole: {
      width: 3,
      height: 3,
      borderRadius: 2,
    },

    tonearmBase: {
      position:
        "absolute",
      right: 5,
      top: 6,
      width: 6,
      height: 6,
      borderRadius: 3,
    },

    tonearm: {
      position:
        "absolute",
      right: 8,
      top: 10,
      width: 2,
      height: 20,
      borderRadius: 2,
      transform: [
        {
          rotate:
            "24deg",
        },
      ],
    },

    turntableControl: {
      position:
        "absolute",
      right: 5,
      bottom: 5,
      width: 4,
      height: 4,
      borderRadius: 2,
    },

    // HEADER

    lightHeader: {
      height: 68,
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
    },

    lightCircleButton: {
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

    lightHeaderTitle: {
      fontSize: 17,
      fontWeight:
        "800",
      color:
        "#171714",
    },

    darkHeader: {
      height: 80,
      paddingHorizontal:
        20,
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
    },

    darkHeaderTitle: {
      color:
        "#FFFFFF",
      fontSize: 17,
      fontWeight:
        "800",
    },

    darkCircleButton: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor:
        "rgba(20,20,20,0.82)",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    // MENU

    menuBackdrop: {
      flex: 1,
      backgroundColor:
        "rgba(0,0,0,0.45)",
    },

    menuDrawer: {
      width: "78%",
      height: "100%",
      paddingHorizontal:
        24,
      backgroundColor:
        "#F8F6F0",
    },

    menuHeader: {
      marginTop: 20,
      height: 90,
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 12,
    },

    menuBrand: {
      fontWeight:
        "800",
      fontSize: 18,
      color:
        "#171714",
    },

    menuItems: {
      gap: 10,
    },

    menuItem: {
      height: 58,
      borderRadius: 18,
      backgroundColor:
        "#FFFFFF",
      paddingHorizontal:
        18,
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 14,
    },

    menuItemText: {
      fontSize: 16,
      fontWeight:
        "700",
      color:
        "#171714",
    },

    menuDivider: {
      height: 1,
      backgroundColor:
        "#DEDAD1",
      marginVertical: 6,
    },

    // CAMERA

    cameraBrand: {
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 9,
    },

    cameraBrandText: {
      color:
        "#FFFFFF",
      fontWeight:
        "800",
      fontSize: 17,
    },

    cameraMiddle: {
      flex: 1,
      paddingHorizontal:
        28,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    scanFrame: {
      width: "100%",
      maxWidth: 420,
      aspectRatio: 1,
      borderWidth: 3,
      borderColor:
        "rgba(255,255,255,0.75)",
      borderRadius: 32,
    },

    barcodeQuick: {
      marginTop: 22,
      borderRadius: 24,
      backgroundColor:
        "rgba(20,20,20,0.84)",
      paddingHorizontal:
        18,
      height: 46,
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 8,
    },

    barcodeQuickText: {
      color:
        "#FFFFFF",
      fontWeight:
        "700",
    },

    cameraControls: {
      height: 190,
      backgroundColor:
        "rgba(25,25,24,0.97)",
      borderTopLeftRadius:
        34,
      borderTopRightRadius:
        34,
      flexDirection:
        "row",
      justifyContent:
        "space-around",
      alignItems:
        "center",
    },

    sideControl: {
      width: 90,
      alignItems:
        "center",
    },

    sideControlText: {
      marginTop: 9,
      color:
        "#FFFFFF",
      fontWeight:
        "700",
    },

    shutterOuter: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 6,
      borderColor:
        "#FFFFFF",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    shutterInner: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor:
        "#FFFFFF",
    },

    // BARCODE

    barcodeCenter: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    barcodeFrame: {
      width: "82%",
      height: 180,
      borderWidth: 2,
      borderRadius: 24,
      borderColor:
        "#FFFFFF",
      justifyContent:
        "center",
    },

    barcodeLine: {
      height: 2,
      marginHorizontal:
        18,
      backgroundColor:
        "#FFFFFF",
    },

    barcodeHelp: {
      marginTop: 20,
      color:
        "#FFFFFF",
      fontWeight:
        "700",
    },

    barcodeError: {
      marginTop: 25,
      backgroundColor:
        "#FFFFFF",
      padding: 16,
      borderRadius: 18,
      width: "82%",
    },

    smallDarkButton: {
      marginTop: 12,
      backgroundColor:
        "#171714",
      borderRadius: 20,
      height: 42,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    smallDarkButtonText: {
      color:
        "#FFFFFF",
      fontWeight:
        "800",
    },

    // FORM

    bigTitle: {
      marginTop: 35,
      fontSize: 36,
      lineHeight: 40,
      fontWeight:
        "900",
      color:
        "#171714",
    },

    bodyText: {
      marginTop: 12,
      marginBottom: 30,
      color:
        "#77746D",
      lineHeight: 20,
    },

    inputLabelFirst: {
      marginTop: 34,
      marginBottom: 8,
      fontSize: 11,
      fontWeight:
        "800",
      letterSpacing: 1,
      color:
        "#77746D",
    },

    inputLabel: {
      marginBottom: 8,
      fontSize: 11,
      fontWeight:
        "800",
      letterSpacing: 1,
      color:
        "#77746D",
    },

    inputLabelSpaced: {
      marginTop: 20,
      marginBottom: 8,
      fontSize: 11,
      fontWeight:
        "800",
      letterSpacing: 1,
      color:
        "#77746D",
    },

    input: {
      height: 60,
      borderRadius: 18,
      backgroundColor:
        "#FFFFFF",
      paddingHorizontal:
        17,
      fontSize: 16,
      color:
        "#171714",
    },

    primaryButton: {
      height: 60,
      borderRadius: 20,
      backgroundColor:
        "#171714",
      alignItems:
        "center",
      justifyContent:
        "center",
      marginTop: 25,
    },

    primaryButtonText: {
      color:
        "#FFFFFF",
      fontWeight:
        "800",
    },

    errorText: {
      marginTop: 12,
      color:
        "#873B35",
    },

    // COLLECTION

    collectionList: {
      paddingHorizontal:
        20,
      paddingBottom:
        50,
    },

    collectionEyebrow: {
      marginTop: 8,
      fontSize: 11,
      fontWeight:
        "900",
      letterSpacing:
        1.2,
      color:
        "#858179",
    },

    collectionSummary: {
      marginTop: 12,
      marginBottom: 20,
      padding: 20,
      borderRadius: 24,
      backgroundColor:
        "#171714",
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 20,
    },

    collectionSummaryValue: {
      color:
        "#FFFFFF",
      fontSize: 28,
      fontWeight:
        "900",
    },

    collectionSummaryLabel: {
      marginTop: 4,
      color:
        "#A8A69F",
      fontSize: 9,
      fontWeight:
        "900",
      letterSpacing:
        0.9,
    },

    collectionSummaryDivider: {
      width: 1,
      height: 42,
      backgroundColor:
        "#454540",
    },

    collectionCard: {
      minHeight: 112,
      borderRadius: 22,
      padding: 10,
      marginBottom: 12,
      backgroundColor:
        "#FFFFFF",
      flexDirection:
        "row",
      alignItems:
        "center",
    },

    collectionCover: {
      width: 90,
      height: 90,
      borderRadius: 16,
      backgroundColor:
        "#E8E5DE",
    },

    collectionCoverPlaceholder: {
      width: 90,
      height: 90,
      borderRadius: 16,
      backgroundColor:
        "#EEECE6",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    collectionInfo: {
      flex: 1,
      marginLeft: 14,
    },

    collectionArtist: {
      color:
        "#77746D",
      fontSize: 11,
      fontWeight:
        "700",
    },

    collectionAlbum: {
      color:
        "#171714",
      fontSize: 17,
      fontWeight:
        "900",
      marginTop: 3,
    },

    collectionCondition: {
      marginTop: 6,
      color:
        "#65635D",
      fontSize: 10,
      fontWeight:
        "700",
    },

    collectionExact: {
      marginTop: 5,
      color:
        "#315C34",
      fontSize: 9,
      fontWeight:
        "900",
      letterSpacing:
        0.6,
    },

    collectionRight: {
      minWidth: 76,
      height: 90,
      alignItems:
        "flex-end",
      justifyContent:
        "space-between",
    },

    collectionPrice: {
      color:
        "#171714",
      fontWeight:
        "900",
      fontSize: 14,
    },

    collectionDelete: {
      width: 31,
      height: 31,
      borderRadius: 16,
      backgroundColor:
        "#EEECE6",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    emptyCollection: {
      flex: 1,
      paddingHorizontal:
        35,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    emptyCollectionIcon: {
      width: 78,
      height: 78,
      borderRadius: 25,
      backgroundColor:
        "#FFFFFF",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    emptyCollectionTitle: {
      marginTop: 20,
      color:
        "#171714",
      fontSize: 23,
      fontWeight:
        "900",
    },

    emptyCollectionText: {
      marginTop: 7,
      color:
        "#77746D",
      textAlign:
        "center",
    },

    emptyCollectionButton: {
      marginTop: 24,
      height: 54,
      borderRadius: 18,
      paddingHorizontal:
        24,
      backgroundColor:
        "#171714",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    emptyCollectionButtonText: {
      color:
        "#FFFFFF",
      fontWeight:
        "800",
    },

    collectionActionButton: {
      marginTop: 10,
      height: 58,
      borderRadius: 20,
      borderWidth: 1,
      borderColor:
        "#DEDAD1",
      backgroundColor:
        "#FFFFFF",
      flexDirection:
        "row",
      gap: 9,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    collectionActionButtonAdded: {
      backgroundColor:
        "#E4ECE1",
      borderColor:
        "#D2DFCE",
    },

    collectionActionText: {
      color:
        "#171714",
      fontSize: 15,
      fontWeight:
        "800",
    },

    collectionActionTextAdded: {
      color:
        "#315C34",
    },

    // HISTORY

    emptyHistory: {
      flex: 1,
      justifyContent:
        "center",
      alignItems:
        "center",
    },

    emptyHistoryTitle: {
      marginTop: 15,
      fontSize: 22,
      fontWeight:
        "800",
      color:
        "#171714",
    },

    historyList: {
      padding: 20,
      paddingBottom:
        50,
    },

    historyEyebrow: {
      fontSize: 11,
      fontWeight:
        "800",
      letterSpacing:
        1.3,
      color:
        "#858179",
    },

    historyCount: {
      fontSize: 32,
      fontWeight:
        "900",
      color:
        "#171714",
      marginTop: 5,
      marginBottom:
        20,
    },

    historyCard: {
      minHeight: 112,
      borderRadius: 22,
      padding: 10,
      marginBottom: 12,
      backgroundColor:
        "#FFFFFF",
      flexDirection:
        "row",
      alignItems:
        "center",
    },

    historyCover: {
      width: 90,
      height: 90,
      borderRadius: 16,
    },

    historyCoverPlaceholder: {
      width: 90,
      height: 90,
      borderRadius: 16,
      backgroundColor:
        "#EEECE6",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    historyInfo: {
      flex: 1,
      marginLeft: 14,
    },

    historyArtist: {
      color:
        "#77746D",
      fontSize: 11,
      fontWeight:
        "700",
    },

    historyAlbum: {
      color:
        "#171714",
      fontSize: 17,
      fontWeight:
        "800",
      marginTop: 3,
    },

    historyCondition: {
      marginTop: 6,
      color:
        "#65635D",
      fontSize: 10,
      fontWeight:
        "700",
    },

    historyRight: {
      alignItems:
        "flex-end",
      justifyContent:
        "space-between",
      height: 90,
    },

    historyPrice: {
      color:
        "#171714",
      fontWeight:
        "800",
    },

    historyDelete: {
      width: 31,
      height: 31,
      borderRadius: 16,
      backgroundColor:
        "#EEECE6",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    // RESULT

    resultPage: {
      paddingHorizontal:
        20,
      paddingBottom:
        50,
    },

    resultCover: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 28,
      backgroundColor:
        "#E8E5DE",
    },

    noCover: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 28,
      backgroundColor:
        "#E8E5DE",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    resultArtist: {
      marginTop: 24,
      fontSize: 15,
      fontWeight:
        "700",
      color:
        "#77746D",
    },

    resultAlbum: {
      marginTop: 4,
      fontSize: 36,
      lineHeight: 40,
      fontWeight:
        "900",
      color:
        "#171714",
    },

    valueCard: {
      marginTop: 22,
      backgroundColor:
        "#FFFFFF",
      borderRadius: 25,
      padding: 22,
    },

    valueLabel: {
      fontSize: 10,
      fontWeight:
        "900",
      letterSpacing: 1,
      color:
        "#77746D",
    },

    valuePrice: {
      marginTop: 7,
      fontSize: 42,
      fontWeight:
        "900",
      color:
        "#171714",
    },

    scanAgainTopButton: {
      marginTop: 14,
      height: 60,
      borderRadius: 20,
      backgroundColor:
        "#171714",
      flexDirection:
        "row",
      gap: 10,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    scanAgainTopText: {
      color:
        "#FFFFFF",
      fontSize: 15,
      fontWeight:
        "800",
    },

    card: {
      marginTop: 16,
      borderRadius: 25,
      backgroundColor:
        "#FFFFFF",
      padding: 20,
    },

    eyebrow: {
      fontSize: 10,
      fontWeight:
        "900",
      letterSpacing: 1,
      color:
        "#858179",
    },

    cardTitle: {
      marginTop: 4,
      fontSize: 21,
      fontWeight:
        "900",
      color:
        "#171714",
    },

    detailLine: {
      marginTop: 9,
      color:
        "#65635D",
      fontSize: 13,
    },

    findPressingButton: {
      height: 54,
      borderRadius: 17,
      backgroundColor:
        "#171714",
      marginTop: 18,
      flexDirection:
        "row",
      gap: 8,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    findPressingText: {
      color:
        "#FFFFFF",
      fontWeight:
        "800",
    },

    // CONDITION

    conditionSelector: {
      marginTop: 20,
    },

    conditionSelectorLabel: {
      marginBottom: 9,
      fontSize: 10,
      fontWeight:
        "900",
      letterSpacing: 1,
      color:
        "#77746D",
    },

    gradeRow: {
      flexDirection:
        "row",
      gap: 6,
    },

    gradeButton: {
      flex: 1,
      height: 44,
      borderRadius: 13,
      backgroundColor:
        "#F1EFE9",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    gradeButtonSelected: {
      backgroundColor:
        "#171714",
    },

    gradeButtonText: {
      fontSize: 12,
      fontWeight:
        "800",
      color:
        "#65635D",
    },

    gradeButtonTextSelected: {
      color:
        "#FFFFFF",
    },

    conditionButton: {
      marginTop: 22,
      height: 56,
      borderRadius: 18,
      backgroundColor:
        "#171714",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    conditionButtonText: {
      color:
        "#FFFFFF",
      fontWeight:
        "800",
    },

    copyEstimate: {
      marginTop: 16,
      padding: 18,
      borderRadius: 19,
      backgroundColor:
        "#E7ECE3",
    },

    copyEstimateLabel: {
      fontSize: 9,
      fontWeight:
        "900",
      letterSpacing: 1,
      color:
        "#5C6958",
    },

    copyEstimatePrice: {
      marginTop: 5,
      fontSize: 38,
      fontWeight:
        "900",
      color:
        "#243322",
    },

    copyRange: {
      marginTop: 3,
      color:
        "#5C6958",
      fontWeight:
        "600",
    },

    // DEAL

    dealRow: {
      marginTop: 20,
      flexDirection:
        "row",
      gap: 10,
    },

    dealInputWrap: {
      flex: 1,
      height: 60,
      borderRadius: 18,
      backgroundColor:
        "#F3F1EB",
      paddingHorizontal:
        15,
      flexDirection:
        "row",
      alignItems:
        "center",
    },

    dealCurrency: {
      fontSize: 20,
      fontWeight:
        "800",
    },

    dealInput: {
      flex: 1,
      marginLeft: 6,
      fontSize: 20,
      fontWeight:
        "800",
      color:
        "#171714",
    },

    dealButton: {
      height: 60,
      borderRadius: 18,
      backgroundColor:
        "#171714",
      paddingHorizontal:
        22,
      justifyContent:
        "center",
    },

    dealButtonText: {
      color:
        "#FFFFFF",
      fontWeight:
        "800",
    },

    dealResult: {
      marginTop: 15,
      padding: 16,
      borderRadius: 18,
    },

    dealGreat: {
      backgroundColor:
        "#DDE9D9",
    },

    dealGood: {
      backgroundColor:
        "#E7ECD8",
    },

    dealFair: {
      backgroundColor:
        "#EEE9DB",
    },

    dealOverpriced: {
      backgroundColor:
        "#F1DEDA",
    },

    dealResultTitle: {
      fontSize: 17,
      fontWeight:
        "900",
      marginBottom: 4,
      color:
        "#171714",
    },

    dealResultMessage: {
      color:
        "#55524C",
    },

    discogsButton: {
      marginTop: 18,
      height: 56,
      borderRadius: 18,
      backgroundColor:
        "#E9E6DF",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    discogsButtonText: {
      fontWeight:
        "800",
      color:
        "#171714",
    },

    // PREVIEW

    previewWrap: {
      flex: 1,
      marginHorizontal:
        16,
      borderRadius: 25,
      overflow:
        "hidden",
    },

    previewImage: {
      width: "100%",
      height: "100%",
      resizeMode:
        "contain",
    },

    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor:
        "rgba(0,0,0,0.7)",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    loadingText: {
      marginTop: 15,
      color:
        "#FFFFFF",
      fontWeight:
        "700",
    },

    previewControls: {
      height: 140,
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-around",
    },

    previewControlText: {
      color:
        "#FFFFFF",
      fontWeight:
        "700",
    },

    identifyCircle: {
      width: 82,
      height: 82,
      borderRadius: 41,
      backgroundColor:
        "#FFFFFF",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    previewError: {
      color:
        "#FFFFFF",
      textAlign:
        "center",
      padding: 12,
    },

    // PERMISSION

    permissionScreen: {
      flex: 1,
      backgroundColor:
        "#000000",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    permissionTitle: {
      marginTop: 20,
      color:
        "#FFFFFF",
      fontSize: 27,
      fontWeight:
        "800",
    },

    permissionButton: {
      marginTop: 25,
      height: 54,
      borderRadius: 27,
      backgroundColor:
        "#FFFFFF",
      paddingHorizontal:
        24,
      justifyContent:
        "center",
    },

    permissionButtonText: {
      fontWeight:
        "800",
      color:
        "#171714",
    },
  });