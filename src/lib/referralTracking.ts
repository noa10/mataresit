const PENDING_REFERRAL_CODE_STORAGE_KEY = "gamification:pending-referral-code";
const REFERRAL_REDEMPTION_ATTEMPT_PREFIX = "gamification:referral-redeem-attempt";

const memoryStorage = {
  localStorage: new Map<string, string>(),
  sessionStorage: new Map<string, string>(),
};

const getStorage = (storageKey: "localStorage" | "sessionStorage") => {
  const fallback = memoryStorage[storageKey];

  const readFromNativeStorage = (key: string) => {
    try {
      return globalThis[storageKey]?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };

  try {
    const storage = globalThis[storageKey];
    if (storage) {
      return {
        getItem: (key: string) => readFromNativeStorage(key) ?? fallback.get(key) ?? null,
        removeItem: (key: string) => {
          fallback.delete(key);
          storage.removeItem(key);
        },
        setItem: (key: string, value: string) => {
          fallback.set(key, value);
          storage.setItem(key, value);
        },
      };
    }
  } catch {
    // Fall through to the in-memory store when Storage is unavailable.
  }

  return {
    getItem: (key: string) => fallback.get(key) ?? null,
    removeItem: (key: string) => {
      fallback.delete(key);
    },
    setItem: (key: string, value: string) => {
      fallback.set(key, value);
    },
  };
};

export const normalizeReferralCode = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase() ?? "";
  return normalized.length > 0 ? normalized : null;
};

export const captureReferralCodeFromSearch = (search: string) => {
  const referralCode = normalizeReferralCode(new URLSearchParams(search).get("ref"));
  if (!referralCode) return null;

  getStorage("localStorage").setItem(PENDING_REFERRAL_CODE_STORAGE_KEY, referralCode);
  return referralCode;
};

export const getPendingReferralCode = () =>
  normalizeReferralCode(getStorage("localStorage").getItem(PENDING_REFERRAL_CODE_STORAGE_KEY));

export const clearPendingReferralCode = () => {
  getStorage("localStorage").removeItem(PENDING_REFERRAL_CODE_STORAGE_KEY);
};

const getAttemptKey = (userId: string, referralCode: string) =>
  `${REFERRAL_REDEMPTION_ATTEMPT_PREFIX}:${userId}:${referralCode}`;

export const hasAttemptedReferralRedemption = (userId: string, referralCode: string) =>
  getStorage("sessionStorage").getItem(getAttemptKey(userId, referralCode)) === "attempted";

export const markReferralRedemptionAttempt = (userId: string, referralCode: string) => {
  getStorage("sessionStorage").setItem(getAttemptKey(userId, referralCode), "attempted");
};

export const clearReferralRedemptionAttempt = (userId: string, referralCode: string) => {
  getStorage("sessionStorage").removeItem(getAttemptKey(userId, referralCode));
};