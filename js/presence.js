// ═══════════════════════════════════════════════════════
//  GLITZ OF HORIZON — PRESENCE (ONLINE STATUS + NEARBY DISCOVERY)
//  js/presence.js
//
//  Single source of truth for presence/{uid}. Two things share this
//  one doc on purpose:
//    - General "online" status (lastSeen) — used by the friendlist's
//      green-light indicator, and previously duplicated inline inside
//      profile.html as its own initPresence(). That duplicate should
//      call markOnline() here instead now — same doc, one schema.
//    - "Looking for a local match" status + lat/lng — used by the
//      Friendly tab's nearby-discovery list.
//  Every write here uses merge:true specifically so these two halves
//  never clobber each other.
//
//  Reality check on "8 meters": phone GPS accuracy is commonly
//  5–20m outdoors and worse indoors, so treat the distance shown
//  as an estimate, not a precise measurement. The UI buckets it
//  rather than promising exact meters.
// ═══════════════════════════════════════════════════════

import { auth, db } from "./firebase.config.js";
import {
    doc, setDoc, getDoc, getDocs,
    collection, query, where, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const LOOKING_STALE_MS = 3 * 60 * 1000;  // "looking" older than this is ignored as stale
const ONLINE_STALE_MS  = 2 * 60 * 1000;  // general "online" light goes gray after this
let watchId = null;
let refreshTimer = null;

function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('Geolocation not supported on this device/browser.')); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            (err) => reject(new Error('Location permission denied or unavailable.')),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
        );
    });
}

export const Presence = {

    // ── GENERAL ONLINE STATUS ────────────────────────────
    // Meant to replace profile.html's inline initPresence() duplicate —
    // same doc, same fields, just one canonical place for the logic.
    // Call once on page load, on any page where the person is "using
    // the app" (profile, world, friends, settings) — not just battle.
    markOnline: async function(userData) {
        const user = auth.currentUser;
        if (!user) return;
        const title = getCombatTitle(
            userData.infantryUsage || 0, userData.archerUsage || 0,
            userData.horsemanUsage || 0, userData.spearUsage || 0
        );
        const presenceRef = doc(db, 'presence', user.uid);
        await setDoc(presenceRef, {
            uid: user.uid, username: userData.username, title,
            score: userData.totalDamageDealt || 0,
            lastSeen: serverTimestamp(),
        }, { merge: true });

        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(async () => {
            try { await setDoc(presenceRef, { lastSeen: serverTimestamp() }, { merge: true }); }
            catch (e) { console.warn('[presence] online ping failed', e); }
        }, 30000);
    },

    // Reads one user's presence doc and says whether their last ping
    // was recent enough to show a green light. Used by the friendlist.
    isRecentlyOnline: async function(uid) {
        try {
            const snap = await getDoc(doc(db, 'presence', uid));
            if (!snap.exists()) return false;
            const data = snap.data();
            const lastMs = data.lastSeen && data.lastSeen.toMillis ? data.lastSeen.toMillis() : 0;
            return (Date.now() - lastMs) <= ONLINE_STALE_MS;
        } catch (e) { return false; }
    },

    // ── START/STOP "looking for a local match" ───────────
    // merge:true on every write here — this doc is shared with
    // markOnline()'s fields (uid/username/title/score/lastSeen) and
    // must never blow those away.
    startLooking: async function(username) {
        const user = auth.currentUser;
        if (!user) throw new Error('Not signed in.');
        const coords = await getCurrentPosition();
        await setDoc(doc(db, 'presence', user.uid), {
            username, lat: coords.latitude, lng: coords.longitude,
            status: 'looking', updatedAt: serverTimestamp(), lastSeen: serverTimestamp(),
        }, { merge: true });
        // Refresh position + timestamp periodically so we drop off
        // other people's lists automatically if the tab is closed
        // (LOOKING_STALE_MS filter on the reading side).
        refreshTimer = setInterval(async () => {
            try {
                const c = await getCurrentPosition();
                await setDoc(doc(db, 'presence', user.uid), {
                    username, lat: c.latitude, lng: c.longitude,
                    status: 'looking', updatedAt: serverTimestamp(), lastSeen: serverTimestamp(),
                }, { merge: true });
            } catch (e) { console.warn('[presence] refresh failed', e); }
        }, 30000);
    },

    // Marks not-looking-for-a-local-match anymore, but deliberately does
    // NOT delete the doc — profile.html's general online-status (and the
    // friendlist's green light) depend on this same doc persisting.
    stopLooking: async function() {
        if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
        const user = auth.currentUser;
        if (!user) return;
        try {
            await setDoc(doc(db, 'presence', user.uid), { status: 'idle' }, { merge: true });
        } catch (e) { /* fine if doc doesn't exist yet */ }
    },

    // ── FIND NEARBY ───────────────────────────────────────
    // One-shot fetch (not a live listener) — call again to refresh
    // the list. Returns [{ uid, username, distanceM }], sorted nearest first.
    findNearby: async function() {
        const user = auth.currentUser;
        if (!user) throw new Error('Not signed in.');
        const myCoords = await getCurrentPosition();

        const q = query(collection(db, 'presence'), where('status', '==', 'looking'));
        const snap = await getDocs(q);
        const now = Date.now();
        const results = [];
        snap.forEach((d) => {
            if (d.id === user.uid) return;
            const data = d.data();
            const updatedMs = data.updatedAt && data.updatedAt.toMillis ? data.updatedAt.toMillis() : 0;
            if (now - updatedMs > LOOKING_STALE_MS) return; // stale — they've likely left
            const distanceM = haversineMeters(myCoords.latitude, myCoords.longitude, data.lat, data.lng);
            results.push({ uid: d.id, username: data.username, distanceM });
        });
        results.sort((a, b) => a.distanceM - b.distanceM);
        return results;
    },

    // Human-friendly bucket instead of a false-precision exact meter count.
    formatDistance: function(distanceM) {
        if (distanceM < 15) return 'Very close (~<15m)';
        if (distanceM < 50) return `Nearby (~${Math.round(distanceM)}m)`;
        if (distanceM < 500) return `~${Math.round(distanceM)}m away`;
        if (distanceM < 1000) return `~${Math.round(distanceM / 10) * 10}m away`;
        return `~${(distanceM / 1000).toFixed(1)}km away`;
    },
};

/*
─────────────────────────────────────────────────────────
FIRESTORE SECURITY RULES — draft, apply in Firebase console
alongside the `matches` rules from match.sync.js. Anyone signed
in can read who's "looking" (needed for nearby discovery), but
only write their own presence doc.
─────────────────────────────────────────────────────────

match /presence/{uid} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.uid == uid;
}
*/
