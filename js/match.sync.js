// ═══════════════════════════════════════════════════════
//  GLITZ OF HORIZON — PVP MATCH SYNC
//  js/match.sync.js
//
//  Foundation layer for real-time PvP. No game server —
//  Firestore IS the server. Two roles per match: 'host' and
//  'guest'. Whoever's turn it is computes the result locally
//  (movement, RNG damage/accuracy/crit) and writes a resolved
//  ACTION doc. Both clients — host and guest — replay actions
//  strictly in `seq` order from Firestore. Nobody trusts local
//  prediction as final truth; the action log is truth.
//
//  Import: <script type="module" src="js/match.sync.js"></script>
//  or import { MatchSync } from "./js/match.sync.js" from
//  another module script (e.g. inside battle.html).
//
//  Firestore shape:
//    matches/{matchId}
//      code, status, hostUid, hostName, guestUid, guestName,
//      weather, wind, hostDraft, guestDraft, hostReady, guestReady,
//      turnTeam, turnCount, winner, createdAt, startedAt, finishedAt
//    matches/{matchId}/actions/{seq}   (seq zero-padded string, e.g. "00007")
//      seq, by, type, payload, ts
//
//  NOT built yet (next steps, once this foundation is wired
//  into battle.html):
//    - Room-code UI screen (create/join) in a lobby page
//    - Hooking ENGINE's move/face/attack/endTurn calls to
//      MatchSync.submitAction() when STATE.mode === 'pvp'
//    - A dispatcher that takes each incoming action and calls
//      the matching local function (see ACTION TYPES below)
//    - Reconnect/resume handling if a player's app backgrounds
//    - Firestore security rules (draft included at bottom of
//      this file as a comment — apply in Firebase console)
// ═══════════════════════════════════════════════════════

import {
    auth, db,
} from "./firebase.config.js";

import {
    doc, getDoc, setDoc, updateDoc, deleteDoc,
    collection, query, where, limit, getDocs,
    onSnapshot, serverTimestamp, runTransaction,
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// ─────────────────────────────────────────────────────
//  ACTION TYPES — the only vocabulary the sync layer knows.
//  battle.html's ENGINE will map each of these to/from its
//  own local functions (spawnUnit, moveUnit, executeAttack,
//  endTurn, ...). Keeping this list small on purpose.
// ─────────────────────────────────────────────────────
const ACTION = {
    DRAFT_LOCK:  'draft_lock',   // payload: { draft: [type,type,type,type] }
    SPAWN:       'spawn',        // payload: { units: [{id,type,x,z,tm}, ...] } — host writes once both drafts locked
    MOVE:        'move',         // payload: { unitId, path: [{x,z},...] }
    FACE:        'face',         // payload: { unitId, rotY }
    ATTACK:      'attack',       // payload: { atkId, defId, finalDmg, prefix, specialEffect, recoil }
    END_TURN:    'end_turn',     // payload: {}
    SURRENDER:   'surrender',    // payload: {}
};

function pad(n) { return String(n).padStart(5, '0'); }

function genCode() {
    // 5-char room code, avoids ambiguous chars (0/O, 1/I/L)
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

export const MatchSync = {

    matchId: null,
    role: null,          // 'host' | 'guest'
    _unsubMatch: null,
    _unsubActions: null,
    _lastSeq: -1,

    // ── CREATE ROOM ──────────────────────────────────────
    // Host rolls weather/wind here (so it's identical for both
    // players from the start — no separate "sync the weather"
    // step needed later).
    createRoom: async function(hostName, weather, wind) {
        const user = auth.currentUser;
        if (!user) throw new Error('Not signed in.');

        const code = genCode();
        const ref = doc(collection(db, 'matches'));
        await setDoc(ref, {
            code,
            status: 'waiting',       // waiting -> drafting -> active -> finished
            hostUid: user.uid, hostName: hostName || 'Commander',
            guestUid: null, guestName: null,
            weather, wind,
            hostDraft: [], guestDraft: [],
            hostReady: false, guestReady: false,
            turnTeam: 'host', turnCount: 0,
            winner: null,
            createdAt: serverTimestamp(),
            startedAt: null, finishedAt: null,
        });

        this.matchId = ref.id;
        this.role = 'host';
        return { matchId: ref.id, code };
    },

    // ── JOIN ROOM BY CODE ────────────────────────────────
    // Transaction guards against two guests joining the same
    // room at once (last-write-wins race otherwise).
    joinRoomByCode: async function(code, guestName) {
        const user = auth.currentUser;
        if (!user) throw new Error('Not signed in.');

        const q = query(
            collection(db, 'matches'),
            where('code', '==', code.toUpperCase()),
            where('status', '==', 'waiting'),
            limit(1)
        );
        const snap = await getDocs(q);
        if (snap.empty) throw new Error('Room not found or already full.');

        const matchRef = snap.docs[0].ref;

        await runTransaction(db, async (tx) => {
            const d = await tx.get(matchRef);
            if (!d.exists()) throw new Error('Room disappeared.');
            const data = d.data();
            if (data.status !== 'waiting' || data.guestUid) {
                throw new Error('Room already taken.');
            }
            tx.update(matchRef, {
                guestUid: user.uid,
                guestName: guestName || 'Challenger',
                status: 'drafting',
            });
        });

        this.matchId = matchRef.id;
        this.role = 'guest';
        return { matchId: matchRef.id };
    },

    // ── DIRECT CHALLENGE (Friendly tab) ──────────────────
    // No room code — target is preset from the nearby-players list.
    // Same match doc shape as createRoom, just status starts at
    // 'invited' instead of 'waiting' and skips the code lookup step.
    createChallenge: async function(targetUid, targetName, myName, weather, wind) {
        const user = auth.currentUser;
        if (!user) throw new Error('Not signed in.');

        const ref = doc(collection(db, 'matches'));
        await setDoc(ref, {
            code: null,
            status: 'invited',              // invited -> drafting -> active -> finished
            hostUid: user.uid, hostName: myName || 'Commander',
            guestUid: targetUid, guestName: targetName || 'Challenger',
            weather, wind,
            hostDraft: [], guestDraft: [],
            hostReady: false, guestReady: false,
            turnTeam: 'host', turnCount: 0,
            winner: null, lastActionSeq: 0,
            createdAt: serverTimestamp(),
            startedAt: null, finishedAt: null,
        });

        this.matchId = ref.id;
        this.role = 'host';
        return { matchId: ref.id };
    },

    // Live list of challenges sent TO me that I haven't answered yet.
    listenIncomingChallenges: function(callback) {
        const user = auth.currentUser;
        if (!user) throw new Error('Not signed in.');
        const q = query(
            collection(db, 'matches'),
            where('guestUid', '==', user.uid),
            where('status', '==', 'invited')
        );
        return onSnapshot(q, (snap) => {
            const invites = [];
            snap.forEach((d) => invites.push({ id: d.id, ...d.data() }));
            callback(invites);
        });
    },

    acceptChallenge: async function(matchId) {
        await updateDoc(doc(db, 'matches', matchId), { status: 'drafting' });
        this.matchId = matchId;
        this.role = 'guest';
        return { matchId };
    },

    declineChallenge: async function(matchId) {
        await deleteDoc(doc(db, 'matches', matchId));
    },

    // ── RESUME ───────────────────────────────────────────
    // battle.html loads fresh (new module scope), so matchId/role
    // set during createRoom/joinRoomByCode on the lobby screen are
    // gone. Call this with the values passed via URL (?match=...&role=...)
    // to pick the session back up — no Firestore write, just local state.
    resume: function(matchId, role) {
        this.matchId = matchId;
        this.role = role;
        this._lastSeq = -1;
    },

    // ── LISTEN: match doc (weather, draft, turn, status, winner) ──
    listenMatch: function(callback) {
        if (!this.matchId) throw new Error('No active match.');
        if (this._unsubMatch) this._unsubMatch();
        const ref = doc(db, 'matches', this.matchId);
        this._unsubMatch = onSnapshot(ref, (snap) => {
            callback(snap.exists() ? snap.data() : null); // null = match doc deleted (e.g. challenge declined)
        });
        return this._unsubMatch;
    },

    // ── LISTEN: actions, in order, from wherever we left off ──
    // callback fires once per action doc, strictly by seq order.
    // Safe to call once at battle start; handles reconnects since
    // it re-reads from _lastSeq + 1 rather than assuming continuity.
    listenActions: function(callback) {
        if (!this.matchId) throw new Error('No active match.');
        if (this._unsubActions) this._unsubActions();
        const ref = collection(db, 'matches', this.matchId, 'actions');
        this._unsubActions = onSnapshot(ref, (snap) => {
            const fresh = [];
            snap.docChanges().forEach((ch) => {
                if (ch.type === 'added') fresh.push(ch.doc.data());
            });
            fresh.sort((a, b) => a.seq - b.seq);
            fresh.forEach((action) => {
                if (action.seq <= this._lastSeq) return; // already applied
                this._lastSeq = action.seq;
                callback(action);
            });
        });
        return this._unsubActions;
    },

    // ── SUBMIT ACTION ────────────────────────────────────
    // `nextSeq` must be tracked by the caller (battle.html) OR
    // we fetch match.turnCount-based seq — simplest robust option:
    // read-and-increment via transaction on a counter field so two
    // near-simultaneous writes (rare, but e.g. end_turn + attack
    // racing) never collide on the same seq.
    submitAction: async function(type, payload) {
        if (!this.matchId || !this.role) throw new Error('No active match/role.');
        const matchRef = doc(db, 'matches', this.matchId);

        const seq = await runTransaction(db, async (tx) => {
            const d = await tx.get(matchRef);
            const cur = (d.data().lastActionSeq || 0);
            const next = cur + 1;
            tx.update(matchRef, { lastActionSeq: next });
            return next;
        });

        const actionRef = doc(db, 'matches', this.matchId, 'actions', pad(seq));
        await setDoc(actionRef, {
            seq, by: this.role, type, payload,
            ts: serverTimestamp(),
        });
        return seq;
    },

    // ── DRAFT LOCK ───────────────────────────────────────
    lockDraft: async function(draft) {
        const field = this.role === 'host' ? 'hostDraft' : 'guestDraft';
        const readyField = this.role === 'host' ? 'hostReady' : 'guestReady';
        await updateDoc(doc(db, 'matches', this.matchId), {
            [field]: draft,
            [readyField]: true,
        });
        await this.submitAction(ACTION.DRAFT_LOCK, { draft });
    },

    // ── START MATCH (host calls once both hostReady/guestReady true) ──
    startMatch: async function() {
        await updateDoc(doc(db, 'matches', this.matchId), {
            status: 'active',
            startedAt: serverTimestamp(),
        });
    },

    // ── END TURN — flips turnTeam, bumps turnCount ───────
    endTurn: async function() {
        const matchRef = doc(db, 'matches', this.matchId);
        await runTransaction(db, async (tx) => {
            const d = await tx.get(matchRef);
            const data = d.data();
            const nextTeam = data.turnTeam === 'host' ? 'guest' : 'host';
            tx.update(matchRef, {
                turnTeam: nextTeam,
                turnCount: (data.turnCount || 0) + (nextTeam === 'host' ? 1 : 0),
            });
        });
        await this.submitAction(ACTION.END_TURN, {});
    },

    // ── FINISH ───────────────────────────────────────────
    finishMatch: async function(winnerRole) {
        await updateDoc(doc(db, 'matches', this.matchId), {
            status: 'finished',
            winner: winnerRole,
            finishedAt: serverTimestamp(),
        });
    },

    surrender: async function() {
        await this.submitAction(ACTION.SURRENDER, {});
        const myTeam = this.role;
        const otherTeam = myTeam === 'host' ? 'guest' : 'host';
        await this.finishMatch(otherTeam);
    },

    // ── CLEANUP ──────────────────────────────────────────
    leave: function() {
        if (this._unsubMatch) this._unsubMatch();
        if (this._unsubActions) this._unsubActions();
        this._unsubMatch = null; this._unsubActions = null;
        this.matchId = null; this.role = null; this._lastSeq = -1;
    },

    // Abandons a still-waiting room (host backed out before anyone joined)
    cancelRoom: async function() {
        if (!this.matchId) return;
        await deleteDoc(doc(db, 'matches', this.matchId));
        this.leave();
    },

    ACTION,
};

/*
─────────────────────────────────────────────────────────
FIRESTORE SECURITY RULES — draft, apply in Firebase console
under Firestore > Rules. Locks matches to signed-in users
who are actually part of that match; prevents randoms from
writing into someone else's game.
─────────────────────────────────────────────────────────

match /matches/{matchId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
                && request.resource.data.hostUid == request.auth.uid;
  allow update: if request.auth != null
                && (resource.data.hostUid == request.auth.uid
                    || resource.data.guestUid == request.auth.uid
                    || (resource.data.guestUid == null
                        && request.resource.data.guestUid == request.auth.uid));

  match /actions/{seq} {
    allow read: if request.auth != null;
    allow create: if request.auth != null
                  && (get(/databases/$(database)/documents/matches/$(matchId)).data.hostUid == request.auth.uid
                      || get(/databases/$(database)/documents/matches/$(matchId)).data.guestUid == request.auth.uid);
    allow update, delete: if false;
  }
}
*/
