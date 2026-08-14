// ═══════════════════════════════════════════════════════
//  GLITZ OF HORIZON — FIREBASE CONFIG
//  js/firebase.config.js
//  Import file ini di semua HTML yang butuh Firebase
//  Gunakan: <script type="module" src="js/firebase.config.js">
// ═══════════════════════════════════════════════════════

import { initializeApp }          from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut,
         signInWithEmailAndPassword, createUserWithEmailAndPassword,
         updateProfile, signInWithRedirect, getRedirectResult,
         signInAnonymously,
         GoogleAuthProvider, FacebookAuthProvider }
                                   from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
// CHANGED: signInWithPopup -> signInWithRedirect + getRedirectResult.
// WHY: This app runs inside a Capacitor Android WebView (see capacitor.config.json)
// and is tested on mobile browsers. signInWithPopup relies on a popup window
// passing a message back to the opener tab -- WebViews and many mobile browsers
// block or lose that message silently, so the login button just hangs forever
// with no error. signInWithRedirect avoids the popup entirely: it navigates
// away to Google/Facebook and back, so it always resolves one way or another.
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
         addDoc, collection, query, orderBy, where, limit, getDocs,
         onSnapshot, serverTimestamp, increment }
                                   from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// ─────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyAp9xtIX74D6Heihn6O-7muB0a6mbQno7Y",
  authDomain:        "glittz-of-horizon.firebaseapp.com",
  projectId:         "glittz-of-horizon",
  storageBucket:     "glittz-of-horizon.firebasestorage.app",
  messagingSenderId: "862322605914",
  appId:             "1:862322605914:web:6f2c26e083dee7857d3d63"
};

// ─────────────────────────────────────────────────────
//  INIT — hanya sekali, semua file pakai ini
// ─────────────────────────────────────────────────────
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─────────────────────────────────────────────────────
//  USER DEFAULT SCHEMA
//  Field lengkap saat pertama kali user dibuat
//  Tambah field baru di sini — otomatis tersync
// ─────────────────────────────────────────────────────
const DEFAULT_USER = {
  username:           "Commander",
  avatarId:           "male_infantry",
  wins:               0,
  losses:             0,
  totalDamageDealt:   0,
  totalTurnsTaken:    0,
  avgTurnToWin:       0,
  maxDamagePerTurn:   0,
  infantryUsage:      0,
  archerUsage:        0,
  horsemanUsage:      0,
  spearUsage:         0,
  battlesPlayedToday: 0,
  lastPlayedDate:     "",
  loginStreak:        0,
  lastLoginDate:      "",
  isSpecialUser:      false,
  // Milestone meters (Settings > unlock clan assessment)
  banditBattlesCount:    0,
  pvpLocalBattlesCount:  0,
  pvpLocalWins:          0,
  pvpLocalLosses:        0,
  clanAssessmentDone:    false,
  clanUnitType:          "",
  // Set manually to true in the Firebase console for admin accounts —
  // no in-app way to grant this, on purpose. Gates the World Feed
  // composer.
  isAdmin:               false,
};

// ─────────────────────────────────────────────────────
//  ENSURE USER DOC
//  Satu-satunya tempat yang boleh MEMBUAT dokumen users/{uid}.
//  Dipanggil oleh register/login email & login sosial di bawah,
//  jadi skema DEFAULT_USER selalu konsisten dari manapun user masuk.
// ─────────────────────────────────────────────────────
async function ensureUserDoc(user, usernameOverride) {
  const userRef = doc(db, "users", user.uid);
  const snap    = await getDoc(userRef);
  if (!snap.exists()) {
    const userData = {
      ...DEFAULT_USER,
      username: usernameOverride || user.displayName || "Commander",
    };
    await setDoc(userRef, userData);
    return userData;
  }
  // Merge biar field baru yang ditambah ke DEFAULT_USER nanti otomatis kesync
  return { ...DEFAULT_USER, ...snap.data() };
}

// ─────────────────────────────────────────────────────
//  AUTH ACTIONS — email & sosial
//  Dipanggil dari login-signup.html. Kalau nanti pindah ke
//  Capacitor (APK) dan signInWithPopup diganti plugin native,
//  CUKUP UBAH DI SINI SAJA — semua halaman ikut kepakai otomatis.
// ─────────────────────────────────────────────────────
async function registerWithEmail(username, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: username });
  await ensureUserDoc(cred.user, username);
  return cred.user;
}

async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ─────────────────────────────────────────────────────
//  QUICK PLAY — anonymous auth, no form to fill out.
//  NOT currently wired to any UI button — registration is kept
//  mandatory on purpose (stats that matter, rematch/add-friend,
//  the "make an account, meet me in local PvP" invite loop, and
//  milestones all depend on a persistent identity). Left here
//  dormant in case a future "try before you register" demo path
//  is wanted — safe to delete if not.
// ─────────────────────────────────────────────────────
async function quickPlayGuest() {
  const cred = await signInAnonymously(auth);
  const guestName = "Commander" + Math.floor(1000 + Math.random() * 9000);
  await ensureUserDoc(cred.user, guestName);
  return cred.user;
}

function loginWithGoogle() {
  // No "await" on the result here — signInWithRedirect navigates the whole
  // page away immediately. The actual sign-in result is picked up later by
  // checkRedirectResult() below, after the browser comes back from Google.
  return signInWithRedirect(auth, new GoogleAuthProvider());
}

function loginWithFacebook() {
  return signInWithRedirect(auth, new FacebookAuthProvider());
}

// ─────────────────────────────────────────────────────
//  CHECK REDIRECT RESULT
//  Call this once on page load of login-signup.html.
//  When the browser comes back from the Google/Facebook redirect,
//  this picks up the signed-in user and makes sure their users/{uid}
//  doc exists, exactly like the old popup flow did.
// ─────────────────────────────────────────────────────
async function checkRedirectResult() {
  const result = await getRedirectResult(auth);
  if (result && result.user) {
    await ensureUserDoc(result.user);
  }
  return result ? result.user : null;
}

// ─────────────────────────────────────────────────────
//  GENERIC COLLECTION HELPER
//  Untuk tabel/collection baru di masa depan (fitur advance
//  lain-lain) — supaya tidak perlu import "collection" manual
//  lagi di tiap file, cukup: col("namaTabelBaru")
// ─────────────────────────────────────────────────────
function col(name) {
  return collection(db, name);
}

// ─────────────────────────────────────────────────────
//  AUTH GUARD
//  Panggil di setiap halaman yang butuh login
//
//  Cara pakai:
//    requireAuth((user, userData) => {
//      // user      = Firebase Auth user object
//      // userData  = Firestore dokumen data
//      // lakukan render / logic di sini
//    });
//
//  Kalau tidak login → otomatis redirect ke login
// ─────────────────────────────────────────────────────
async function requireAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login-signup.html";
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const snap    = await getDoc(userRef);

    let userData;
    if (snap.exists()) {
      // Merge dengan DEFAULT_USER agar field baru tidak hilang
      userData = { ...DEFAULT_USER, ...snap.data() };
    } else {
      userData = {
        ...DEFAULT_USER,
        username: user.displayName || "Commander",
      };
      await setDoc(userRef, userData);
    }

    // Login streak update
    const today     = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (userData.lastLoginDate !== today) {
      const streak = userData.lastLoginDate === yesterday
        ? (userData.loginStreak || 0) + 1
        : 1;
      await updateDoc(userRef, {
        lastLoginDate: today,
        loginStreak:   streak,
      });
      userData.lastLoginDate = today;
      userData.loginStreak   = streak;
    }

    callback(user, userData, userRef);
  });
}

// ─────────────────────────────────────────────────────
//  SAVE BATTLE RESULT
//  Dipanggil dari battle.html setelah match selesai
// ─────────────────────────────────────────────────────
async function saveBattleResult(userRef, userData, battleData) {
  const {
    isVictory, turns, pDmg, eDmg,
    kills, survived, lost, typeCount
  } = battleData;

  const today    = new Date().toDateString();
  const lastDate = userData.lastPlayedDate || "";
  const resetToday = lastDate !== today;

  // Avg turns to win — running average
  const prevWins   = userData.wins || 0;
  let newAvgTurn   = userData.avgTurnToWin || 0;
  if (isVictory && prevWins >= 0) {
    const wins   = prevWins + 1;
    newAvgTurn   = Math.round(((userData.avgTurnToWin || 0) * prevWins + turns) / wins);
  }

  const newMaxDmg = Math.max(userData.maxDamagePerTurn || 0, pDmg);

  await updateDoc(userRef, {
    wins:               isVictory ? increment(1) : increment(0),
    losses:             isVictory ? increment(0) : increment(1),
    totalDamageDealt:   increment(pDmg),
    totalTurnsTaken:    increment(turns),
    avgTurnToWin:       newAvgTurn,
    maxDamagePerTurn:   newMaxDmg,
    infantryUsage:      increment(typeCount.sword  || 0),
    archerUsage:        increment(typeCount.archer || 0),
    horsemanUsage:      increment(typeCount.horse  || 0),
    spearUsage:         increment(typeCount.spear  || 0),
    battlesPlayedToday: resetToday ? 1 : increment(1),
    lastPlayedDate:     today,
    banditBattlesCount: increment(1),
  });

  // Simpan ke match history subcollection
  const uid = userRef.id;
  await addDoc(collection(db, "users", uid, "matchHistory"), {
    result:    isVictory ? "win" : "loss",
    turns,
    pDmg,
    eDmg,
    kills,
    survived,
    lost,
    unitTypes: typeCount,
    mode:      "bandit",
    timestamp: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────────────
//  SAVE PVP-LOCAL BATTLE RESULT
//  Dipanggil dari battle.html (PvpFlow.showEndScreen) setelah
//  match Bluetooth/Wi-Fi lokal selesai. Terpisah dari
//  saveBattleResult (bandit) supaya statistik lawan-AI dan
//  lawan-manusia tidak tercampur — tapi keduanya menambah ke
//  milestone meter yang sama-sama dicek di Settings.
// ─────────────────────────────────────────────────────
async function savePvpLocalResult(userRef, battleData) {
  const { isVictory, turns, pDmg, eDmg } = battleData;

  await updateDoc(userRef, {
    pvpLocalBattlesCount: increment(1),
    pvpLocalWins:         isVictory ? increment(1) : increment(0),
    pvpLocalLosses:       isVictory ? increment(0) : increment(1),
  });

  const uid = userRef.id;
  await addDoc(collection(db, "users", uid, "matchHistory"), {
    result:    isVictory ? "win" : "loss",
    turns, pDmg, eDmg,
    mode:      "pvp_local",
    timestamp: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────────────
//  FRIENDLIST
//  users/{uid}/friends/{friendUid} — one-directional, like a
//  personal roster/bookmark rather than a mutual Facebook-style
//  friendship. Tapping "Add Friend" adds them to YOUR list; it
//  doesn't require their confirmation and doesn't add you to
//  theirs. Simplest model that matches "Add Friend" appearing
//  as a single-tap post-battle button.
// ─────────────────────────────────────────────────────
async function searchUsersByUsername(term) {
  if (!term) return [];
  // Firestore has no native substring search — this is the standard
  // prefix-match trick (range query on the field). Case-sensitive:
  // searching "bud" won't find "Budi". Fine for a small user base;
  // would need a search index (Algolia/Typesense) to do better later.
  const q = query(
    collection(db, "users"),
    orderBy("username"),
    where("username", ">=", term),
    where("username", "<=", term + "\uf8ff"),
    limit(20)
  );
  const snap = await getDocs(q);
  const results = [];
  snap.forEach((d) => results.push({ uid: d.id, ...d.data() }));
  return results;
}

async function addFriend(user, friendUid, friendName) {
  if (friendUid === user.uid) throw new Error("Can't add yourself.");
  await setDoc(doc(db, "users", user.uid, "friends", friendUid), {
    friendUid, friendName, addedAt: serverTimestamp(),
  });
}

async function removeFriend(user, friendUid) {
  await deleteDoc(doc(db, "users", user.uid, "friends", friendUid));
}

function listenFriends(user, callback) {
  const q = query(collection(db, "users", user.uid, "friends"), orderBy("addedAt", "desc"));
  return onSnapshot(q, (snap) => {
    const friends = [];
    snap.forEach((d) => friends.push(d.data()));
    callback(friends);
  });
}

// ─────────────────────────────────────────────────────
//  WORLD FEED
//  worldFeed/{postId} — two kinds of post:
//    'admin_post'    — text, written by isAdmin accounts only
//    'battle_report' — auto-posted when a PvP match finishes
//  worldFeed/{postId}/comments/{commentId} — any signed-in user
//
//  Battle reports use the matchId itself as the doc ID (not an
//  auto-id) so that if both players' clients try to post the
//  same finished match, the second write just merges over the
//  first instead of creating a duplicate card.
// ─────────────────────────────────────────────────────
async function postAdminMessage(user, userData, text) {
  if (!userData.isAdmin) throw new Error('Not an admin account.');
  await addDoc(collection(db, "worldFeed"), {
    type: "admin_post",
    authorUid: user.uid, authorName: userData.username, authorType: "admin",
    text,
    battleData: null,
    createdAt: serverTimestamp(),
    commentCount: 0,
  });
}

async function postBattleReport(matchId, report) {
  // report: { p1Name, p2Name, winnerName, turns, p1Dmg, p2Dmg, mode }
  await setDoc(doc(db, "worldFeed", matchId), {
    type: "battle_report",
    authorUid: null, authorName: null, authorType: "system",
    text: `${report.winnerName} won a battle against ${report.p1Name === report.winnerName ? report.p2Name : report.p1Name}!`,
    battleData: report,
    createdAt: serverTimestamp(),
    commentCount: 0,
  }, { merge: true });
}

async function addFeedComment(postId, user, userData, text) {
  await addDoc(collection(db, "worldFeed", postId, "comments"), {
    authorUid: user.uid, authorName: userData.username, text,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "worldFeed", postId), { commentCount: increment(1) });
}

// ─────────────────────────────────────────────────────
//  PRESENCE — update "online" status
// ─────────────────────────────────────────────────────
async function initPresence(user, userData) {
  const presenceRef = doc(db, "presence", user.uid);
  const title = getCombatTitle(
    userData.infantryUsage  || 0,
    userData.archerUsage    || 0,
    userData.horsemanUsage  || 0,
    userData.spearUsage     || 0
  );

  await setDoc(presenceRef, {
    uid:      user.uid,
    username: userData.username,
    title,
    score:    userData.totalDamageDealt || 0,
    lastSeen: serverTimestamp(),
  }, { merge: true });

  // Ping setiap 30 detik
  setInterval(async () => {
    await updateDoc(presenceRef, { lastSeen: serverTimestamp() });
  }, 30000);
}

// ─────────────────────────────────────────────────────
//  EXPORTS — expose ke file lain
// ─────────────────────────────────────────────────────
export {
  auth, db,
  doc, getDoc, setDoc, updateDoc, addDoc,
  collection, query, orderBy, limit, getDocs, onSnapshot,
  serverTimestamp, increment,
  signOut, onAuthStateChanged,
  requireAuth,
  saveBattleResult,
  savePvpLocalResult,
  postAdminMessage,
  postBattleReport,
  addFeedComment,
  searchUsersByUsername,
  addFriend,
  removeFriend,
  listenFriends,
  initPresence,
  DEFAULT_USER,
  // Auth actions (email + sosial) — satu pintu, satu skema
  ensureUserDoc,
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  loginWithFacebook,
  quickPlayGuest,
  checkRedirectResult,
  // Helper untuk tabel/collection baru di masa depan
  col,
};
