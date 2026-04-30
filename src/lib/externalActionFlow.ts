
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type PendingExternalAction = {
  id: string;
  destinationLabel: string;
  message?: string;
  startedAt: string;
};

const STORAGE_KEY = "blackbook.pending_external_action";

async function getStorageItem(key: string) {
  if (Platform.OS === "web") {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  }

  return AsyncStorage.getItem(key);
}

async function setStorageItem(key: string, value: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, value);
    }
    return;
  }

  await AsyncStorage.setItem(key, value);
}

async function removeStorageItem(key: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
    return;
  }

  await AsyncStorage.removeItem(key);
}

export async function getPendingExternalAction() {
  const raw = await getStorageItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PendingExternalAction;
  } catch {
    await removeStorageItem(STORAGE_KEY);
    return null;
  }
}

export async function setPendingExternalAction(action: Omit<PendingExternalAction, "id" | "startedAt">) {
  const payload: PendingExternalAction = {
    id: `${Date.now()}`,
    startedAt: new Date().toISOString(),
    ...action,
  };

  await setStorageItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export async function clearPendingExternalAction() {
  await removeStorageItem(STORAGE_KEY);
}
