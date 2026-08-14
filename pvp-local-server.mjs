// ═══════════════════════════════════════════════════════
//  GLITZ OF HORIZON — LOCAL PVP TEST RELAY
//  pvp-local-server.mjs
//
//  Run this on ONE of the two phones via Termux:
//      npm install ws
//      node pvp-local-server.mjs
//
//  It prints the IP:port to put into pvplocaltest.html on both
//  phones. This does NOT touch Firestore or Firebase Auth at all
//  — it's just a dumb relay so two devices on the same local
//  network (Bluetooth tethering PAN, or same Wi-Fi) can play a
//  real match to shake out bugs before wiring the online lobby.
//
//  Holds exactly one match at a time — restart the process to
//  reset between test games.
// ═══════════════════════════════════════════════════════

import { WebSocketServer } from 'ws';
import { networkInterfaces } from 'os';

const PORT = process.env.PORT || 8787;
const wss = new WebSocketServer({ port: PORT });

let match = null;               // the in-memory "Firestore doc"
const sockets = { host: null, guest: null };

function genCode() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
    let c = ''; for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
}

function send(ws, obj) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function broadcastMatch() {
    send(sockets.host, { type: 'match_update', data: match });
    send(sockets.guest, { type: 'match_update', data: match });
}

function broadcastAction(action) {
    send(sockets.host, { type: 'action', action });
    send(sockets.guest, { type: 'action', action });
}

wss.on('connection', (ws) => {
    ws.role = null;

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }

        switch (msg.type) {
            case 'create': {
                match = {
                    code: genCode(), status: 'waiting',
                    hostName: msg.name || 'Commander', guestName: null,
                    weather: msg.weather, wind: msg.wind,
                    hostDraft: [], guestDraft: [], hostReady: false, guestReady: false,
                    turnTeam: 'host', turnCount: 0, winner: null, lastActionSeq: 0,
                };
                ws.role = 'host'; sockets.host = ws;
                console.log(`[room created] code=${match.code}`);
                send(ws, { type: 'created', matchId: 'local', code: match.code });
                broadcastMatch();
                break;
            }

            case 'join': {
                if (!match || match.code !== msg.code) {
                    send(ws, { type: 'error', message: 'Room not found. Check the code.' });
                    return;
                }
                if (match.guestName && sockets.guest && sockets.guest.readyState === 1) {
                    send(ws, { type: 'error', message: 'Room already has a guest.' });
                    return;
                }
                match.guestName = msg.name || 'Challenger';
                match.status = 'drafting';
                ws.role = 'guest'; sockets.guest = ws;
                console.log(`[guest joined] ${match.guestName}`);
                send(ws, { type: 'joined', matchId: 'local' });
                broadcastMatch();
                break;
            }

            case 'resume': {
                ws.role = msg.role;
                sockets[msg.role] = ws;
                if (match) send(ws, { type: 'match_update', data: match });
                break;
            }

            case 'update_match': {
                if (!match) return;
                Object.assign(match, msg.patch);
                broadcastMatch();
                break;
            }

            case 'action': {
                if (!match) return;
                match.lastActionSeq = (match.lastActionSeq || 0) + 1;
                const action = { ...msg.action, seq: match.lastActionSeq, ts: Date.now() };
                broadcastAction(action);
                break;
            }
        }
    });

    ws.on('close', () => {
        if (ws.role && sockets[ws.role] === ws) sockets[ws.role] = null;
    });
});

// ── print reachable IPs so you know what to type into pvplocaltest.html ──
const nets = networkInterfaces();
console.log(`\nGlitz PvP local test relay running on port ${PORT}\n`);
console.log('Try these on the OTHER phone (same network / Bluetooth PAN):');
for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
            console.log(`  ${net.address}:${PORT}   (interface: ${name})`);
        }
    }
}
console.log('\nIf nothing gets listed above, the Bluetooth PAN interface may not');
console.log('be up yet — check `ip addr` in Termux once both phones are paired');
console.log('and tethering is on, then restart this server.\n');
