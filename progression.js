/**
 * Pocket Table Tennis - local progression and paddle skins.
 *
 * This is intentionally dependency-free and side-effect free so it can be
 * unit-tested from the browser and reused by the single-file game. The module
 * owns the persistence contract; the game owns presentation and match flow.
 *
 * Storage schema (localStorage key `wtt-progress-v1`):
 *   {
 *     version: 1,
 *     wins: 0,
 *     losses: 0,
 *     currentStreak: 0,
 *     bestStreak: 0,
 *     selectedSkin: 'classic'
 *   }
 */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'wtt-progress-v1';
  const SCHEMA_VERSION = 1;
  const DEFAULT_SKIN_ID = 'classic';

  const CLASSIC_BACKHAND = [
    [0, '#94a3b8'],
    [0.30, '#1e293b'],
    [0.78, '#0f172a'],
    [1, '#020408']
  ];

  const SKINS = [
    {
      id: 'classic',
      name: 'Classic',
      unlockWins: 0,
      palette: {
        forehand: [
          [0, '#fb7185'],
          [0.28, '#e11d48'],
          [0.75, '#9f1239'],
          [1, '#4c0519']
        ],
        backhand: CLASSIC_BACKHAND,
        handle: [
          [0, '#5c2d16'],
          [0.22, '#9a5b32'],
          [0.50, '#d4945a'],
          [0.78, '#9a5b32'],
          [1, '#431e0d']
        ],
        edge: 'rgba(255, 225, 205, 0.58)'
      },
      swatch: {
        forehand: '#e11d48',
        backhand: '#1e293b',
        wood: '#d4945a',
        woodDark: '#5c2d16'
      }
    },
    {
      id: 'ink',
      name: 'Ink',
      unlockWins: 2,
      palette: {
        forehand: [
          [0, '#93c5fd'],
          [0.30, '#2563eb'],
          [0.78, '#1e3a8a'],
          [1, '#0b1220']
        ],
        backhand: CLASSIC_BACKHAND,
        handle: [
          [0, '#1f2937'],
          [0.22, '#475569'],
          [0.50, '#94a3b8'],
          [0.78, '#475569'],
          [1, '#0b1220']
        ],
        edge: 'rgba(219, 234, 254, 0.60)'
      },
      swatch: {
        forehand: '#2563eb',
        backhand: '#1e293b',
        wood: '#94a3b8',
        woodDark: '#1f2937'
      }
    },
    {
      id: 'sage',
      name: 'Sage',
      unlockWins: 4,
      palette: {
        forehand: [
          [0, '#d9f99d'],
          [0.30, '#65a30d'],
          [0.78, '#3f6212'],
          [1, '#1a2e05']
        ],
        backhand: CLASSIC_BACKHAND,
        handle: [
          [0, '#3f2d1c'],
          [0.22, '#7c5a3a'],
          [0.50, '#c29663'],
          [0.78, '#7c5a3a'],
          [1, '#2a1c10']
        ],
        edge: 'rgba(236, 252, 203, 0.58)'
      },
      swatch: {
        forehand: '#65a30d',
        backhand: '#1e293b',
        wood: '#c29663',
        woodDark: '#3f2d1c'
      }
    },
    {
      id: 'rust',
      name: 'Rust',
      unlockWins: 7,
      palette: {
        forehand: [
          [0, '#fdba74'],
          [0.30, '#c2410c'],
          [0.78, '#7c2d12'],
          [1, '#2c0b03']
        ],
        backhand: [
          [0, '#94a3b8'],
          [0.30, '#334155'],
          [0.78, '#111827'],
          [1, '#020408']
        ],
        handle: [
          [0, '#2f1b10'],
          [0.22, '#6b3f24'],
          [0.50, '#b0703f'],
          [0.78, '#6b3f24'],
          [1, '#1f1109']
        ],
        edge: 'rgba(254, 215, 170, 0.60)'
      },
      swatch: {
        forehand: '#c2410c',
        backhand: '#334155',
        wood: '#b0703f',
        woodDark: '#2f1b10'
      }
    },
    {
      id: 'gold',
      name: 'Gold',
      unlockWins: 12,
      palette: {
        forehand: [
          [0, '#fef3c7'],
          [0.30, '#f59e0b'],
          [0.78, '#b45309'],
          [1, '#451a03']
        ],
        backhand: CLASSIC_BACKHAND,
        handle: [
          [0, '#17120c'],
          [0.22, '#3f3120'],
          [0.50, '#c9a35a'],
          [0.78, '#3f3120'],
          [1, '#0b0805']
        ],
        edge: 'rgba(254, 243, 199, 0.62)'
      },
      swatch: {
        forehand: '#f59e0b',
        backhand: '#1e293b',
        wood: '#c9a35a',
        woodDark: '#17120c'
      }
    }
  ];

  function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.getOwnPropertyNames(value).forEach((key) => deepFreeze(value[key]));
      Object.freeze(value);
    }
    return value;
  }

  deepFreeze(SKINS);

  const SKIN_BY_ID = Object.create(null);
  SKINS.forEach((skin) => {
    SKIN_BY_ID[skin.id] = skin;
  });
  Object.freeze(SKIN_BY_ID);

  const DEFAULT_STATE = deepFreeze({
    version: SCHEMA_VERSION,
    wins: 0,
    losses: 0,
    currentStreak: 0,
    bestStreak: 0,
    selectedSkin: DEFAULT_SKIN_ID
  });

  function toCount(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return Math.min(Math.floor(number), Number.MAX_SAFE_INTEGER);
  }

  function getSkin(id) {
    return (typeof id === 'string' && SKIN_BY_ID[id]) || null;
  }

  function isUnlocked(skin, wins) {
    const target = skin && toCount(skin.unlockWins);
    return Boolean(skin) && toCount(wins) >= target;
  }

  function getNextSkin(wins) {
    const count = toCount(wins);
    for (let i = 0; i < SKINS.length; i++) {
      if (SKINS[i].unlockWins > count) return SKINS[i];
    }
    return null;
  }

  function unlockedSkins(wins) {
    const count = toCount(wins);
    return SKINS.filter((skin) => count >= skin.unlockWins);
  }

  function copyState(state) {
    return {
      version: SCHEMA_VERSION,
      wins: toCount(state.wins),
      losses: toCount(state.losses),
      currentStreak: toCount(state.currentStreak),
      bestStreak: toCount(state.bestStreak),
      selectedSkin: getSkin(state.selectedSkin) ? state.selectedSkin : DEFAULT_SKIN_ID
    };
  }

  /**
   * Accepts unknown/corrupt input and returns a playable schema-v1 state.
   * Locked or unknown selected skins fall back to Classic, matching the
   * rule that progress is the source of truth for unlocks.
   */
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return copyState(DEFAULT_STATE);
    }

    const wins = toCount(raw.wins);
    const currentStreak = toCount(raw.currentStreak);
    const bestStreak = Math.max(toCount(raw.bestStreak), currentStreak);
    let selectedSkin = getSkin(raw.selectedSkin) ? raw.selectedSkin : DEFAULT_SKIN_ID;
    if (!isUnlocked(getSkin(selectedSkin), wins)) selectedSkin = DEFAULT_SKIN_ID;

    return {
      version: SCHEMA_VERSION,
      wins,
      losses: toCount(raw.losses),
      currentStreak,
      bestStreak,
      selectedSkin
    };
  }

  function createStore(storage) {
    let state = null;

    function ensureLoaded() {
      if (state) return state;
      let raw = null;
      try {
        raw = storage && typeof storage.getItem === 'function'
          ? storage.getItem(STORAGE_KEY)
          : null;
      } catch (_) {
        raw = null;
      }

      if (typeof raw === 'string' && raw.length > 0) {
        try {
          state = sanitize(JSON.parse(raw));
        } catch (_) {
          state = copyState(DEFAULT_STATE);
        }
      } else {
        state = copyState(DEFAULT_STATE);
      }
      return state;
    }

    function persist() {
      try {
        if (storage && typeof storage.setItem === 'function') {
          storage.setItem(STORAGE_KEY, JSON.stringify(state));
        }
      } catch (_) {
        // Private mode / quota failures keep the in-memory session usable.
      }
    }

    function recordMatch(won) {
      ensureLoaded();
      const previousWins = state.wins;
      const isWin = won === true;
      const currentStreak = isWin ? state.currentStreak + 1 : 0;

      state = {
        version: SCHEMA_VERSION,
        wins: previousWins + (isWin ? 1 : 0),
        losses: state.losses + (isWin ? 0 : 1),
        currentStreak,
        bestStreak: isWin ? Math.max(state.bestStreak, currentStreak) : state.bestStreak,
        selectedSkin: state.selectedSkin
      };
      persist();

      const newlyUnlocked = SKINS.filter(
        (skin) => skin.unlockWins > previousWins && skin.unlockWins <= state.wins
      );

      return {
        won: isWin,
        state: copyState(state),
        newlyUnlocked,
        nextSkin: getNextSkin(state.wins),
        skins: unlockedSkins(state.wins)
      };
    }

    function selectSkin(id) {
      ensureLoaded();
      const skin = getSkin(id);
      if (!skin) {
        return { ok: false, reason: 'unknown', state: copyState(state), skin: null };
      }
      if (!isUnlocked(skin, state.wins)) {
        return { ok: false, reason: 'locked', state: copyState(state), skin };
      }

      state = {
        version: SCHEMA_VERSION,
        wins: state.wins,
        losses: state.losses,
        currentStreak: state.currentStreak,
        bestStreak: state.bestStreak,
        selectedSkin: skin.id
      };
      persist();
      return { ok: true, reason: 'selected', state: copyState(state), skin };
    }

    return {
      getState() {
        ensureLoaded();
        return copyState(state);
      },
      recordMatch,
      selectSkin
    };
  }

  root.PocketProgression = Object.freeze({
    STORAGE_KEY,
    SCHEMA_VERSION,
    DEFAULT_SKIN_ID,
    SKINS,
    DEFAULT_STATE,
    getSkin,
    getNextSkin,
    isUnlocked,
    unlockedSkins,
    sanitize,
    createStore
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
