// ═══════════════════════════════════════════════════════
//  GLITZ OF HORIZON — PVP MATCH SYNC (LOCAL TEST BACKEND)
//  js/match.sync.local.js
//
//  Same public interface as match.sync.js (Firestore), backed
//  by a plain WebSocket to a tiny relay you run yourself via
//  Termux (see pvp-local-server.mjs). No internet, no Firebase
//  quota, no second account needed — just two phones on the
//  same local link (Bluetooth tethering PAN, or same Wi-Fi).
//
//  battle.html's PvpFlow code is written against this same
//  interface, so it doesn't know or care which backend is
//  loaded — see loadMatchSyncBackend() in battle.html's module
//  script.
//
//  Flow:
//    1. One phone runs: node pvp-local-server.mjs   (via Termux)
//    2. Both phones open pvplocaltest.html, enter that phone's
//       IP + port, one taps "Host Room", the other "Join Room"
//       with the code shown.
//    3. pvplocaltest.html redirects both into
//       battle.html?mode=pvp&local=1&wsHost=IP:PORT&match=local&role=host|guest
// ═══════════════════════════════════════════════════════

const ACTION = {
    DRAFT_LOCK: 'draft_lock',
    SPAWN:      'spawn',
    MOVE:       'move',
    FACE:       'face',
    ATTACK:     'attack',
    END_TURN:   'end_turn',
    SURRENDER:  'surrender',
};

export const MatchSyncLocal = {
    ws: null,
    matchId: null,
    role: null,
    _matchCb: null,
    _actionCb: null,
    _lastSeq: -1,
    _matchData: null,
    _wsUrl: null,

    // ── LOW-LEVEL CONNECT ────────────────────────────────
    // Resolves once the socket is open. Rejects on error before open.
    connect: function(wsHost) {
        this._wsUrl = `ws://${wsHost}`;
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(this._wsUrl);
            let settled = false;
            ws.onopen = () => { settled = true; this.ws = ws; resolve(); };
            ws.onerror = (e) => { if (!settled) { settled = true; reject(new Error('Could not reach ' + this._wsUrl + ' — check the IP/port and that pvp-local-server.mjs is running.')); } };
            ws.onclose = () => { console.warn('[match.sync.local] connection closed'); };
            ws.onmessage = (ev) => {
                let msg; try { msg = JSON.parse(ev.data); } catch { return; }
                this._handle(msg);
            };
        });
    },

    _handle: function(msg) {
        if (msg.type === 'match_update') {
            this._matchData = msg.data;
            if (this._matchCb && msg.data) this._matchCb(msg.data);
        } else if (msg.type === 'action') {
            if (msg.action.seq <= this._lastSeq) return; // already applied
            this._lastSeq = msg.action.seq;
            if (this._actionCb) this._actionCb(msg.action);
        } else if (msg.type === 'created') {
            this.matchId = msg.matchId; this.role = 'host';
            if (this._createResolve) this._createResolve(msg);
        } else if (msg.type === 'joined') {
            this.matchId = msg.matchId; this.role = 'guest';
            if (this._joinResolve) this._joinResolve(msg);
        } else if (msg.type === 'error') {
            console.error('[match.sync.local]', msg.message);
            if (this._createReject) this._createReject(new Error(msg.message));
            if (this._joinReject) this._joinReject(new Error(msg.message));
        }
    },

    // ── CREATE / JOIN ────────────────────────────────────
    // Call connect(wsHost) first (pvplocaltest.html does this).
    createRoom: function(hostName, weather, wind) {
        return new Promise((resolve, reject) => {
            this._createResolve = (msg) => resolve({ matchId: msg.matchId, code: msg.code });
            this._createReject = reject;
            this.ws.send(JSON.stringify({ type: 'create', name: hostName, weather, wind }));
        });
    },

    joinRoomByCode: function(code, guestName) {
        return new Promise((resolve, reject) => {
            this._joinResolve = (msg) => resolve({ matchId: msg.matchId });
            this._joinReject = reject;
            this.ws.send(JSON.stringify({ type: 'join', code: code.toUpperCase(), name: guestName }));
        });
    },

    // ── RESUME ───────────────────────────────────────────
    // battle.html is a fresh page load — opens its own new socket
    // to wsHost, then tells the relay which role this socket is.
    resume: async function(matchId, role, wsHost) {
        this.matchId = matchId; this.role = role; this._lastSeq = -1;
        if (!this.ws || this.ws.readyState !== 1) {
            await this.connect(wsHost);
        }
        this.ws.send(JSON.stringify({ type: 'resume', role }));
    },

    listenMatch: function(cb) {
        this._matchCb = cb;
        if (this._matchData) cb(this._matchData); // fire immediately if we already have state
    },

    listenActions: function(cb) {
        this._actionCb = cb;
    },

    // ── SUBMIT ACTION ────────────────────────────────────
    // Relay assigns seq (single Node process = naturally ordered,
    // no transaction needed like the Firestore version).
    submitAction: function(type, payload) {
        this.ws.send(JSON.stringify({ type: 'action', action: { by: this.role, type, payload } }));
        return Promise.resolve();
    },

    lockDraft: function(draft) {
        const field = this.role === 'host' ? 'hostDraft' : 'guestDraft';
        const readyField = this.role === 'host' ? 'hostReady' : 'guestReady';
        this.ws.send(JSON.stringify({ type: 'update_match', patch: { [field]: draft, [readyField]: true } }));
        return this.submitAction(ACTION.DRAFT_LOCK, { draft });
    },

    startMatch: function() {
        this.ws.send(JSON.stringify({ type: 'update_match', patch: { status: 'active', startedAt: Date.now() } }));
        return Promise.resolve();
    },

    endTurn: function() {
        const cur = this._matchData || { turnTeam: 'host', turnCount: 0 };
        const nextTeam = cur.turnTeam === 'host' ? 'guest' : 'host';
        this.ws.send(JSON.stringify({ type: 'update_match', patch: {
            turnTeam: nextTeam,
            turnCount: (cur.turnCount || 0) + (nextTeam === 'host' ? 1 : 0),
        }}));
        return this.submitAction(ACTION.END_TURN, {});
    },

    finishMatch: function(winnerRole) {
        this.ws.send(JSON.stringify({ type: 'update_match', patch: { status: 'finished', winner: winnerRole } }));
        return Promise.resolve();
    },

    surrender: function() {
        this.submitAction(ACTION.SURRENDER, {});
        const other = this.role === 'host' ? 'guest' : 'host';
        return this.finishMatch(other);
    },

    leave: function() {
        if (this.ws) this.ws.close();
        this.ws = null; this.matchId = null; this.role = null; this._lastSeq = -1; this._matchData = null;
    },

    cancelRoom: function() { this.leave(); },

    ACTION,
};
