import { io, type Socket } from 'socket.io-client';
import { AppState, type AppStateStatus } from 'react-native';
import type { Listing } from '@/api/types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;
// The realtime gateway lives at the API host's root, not under the REST /api prefix — strip it
// off rather than hardcode a second host. EXPO_PUBLIC_SOCKET_URL overrides this if the gateway is
// ever hosted separately from the REST API.
const SOCKET_HOST = process.env.EXPO_PUBLIC_SOCKET_URL ?? API_BASE_URL.replace(/\/api\/?$/, '');
const USER_EVENTS_NAMESPACE = '/user-events';

export interface ListingUpdateEvent {
  listingId: string;
  action: 'status_changed' | 'updated' | 'deleted';
  status?: Listing['status'];
  oldStatus?: Listing['status'];
}

/**
 * Confirmed with backend 2026-09-19, widened 2026-09-20 — a *global* broadcast (every connected
 * socket, no room, nothing to subscribe to) for listing changes visible to everyone, not just the
 * owner or an explicit watcher. Originally `status_changed`-only (pending_sale/sold, reported/
 * unreported, delisted/relisted — still deliberately excluding pause/resume, which stay owner-only
 * via the room-scoped `listing:update`); now also carries `updated` (a plain edit — title/price/
 * photos/etc., no status involved) and `deleted`, closing the gap where a browsing user had no
 * live signal for another seller editing or deleting a listing they were looking at.
 * `status`/`oldStatus` are only present when `action === 'status_changed'`.
 *
 * The listing's own owner/actor is excluded from this broadcast on all three actions — they get
 * the equivalent via their personal-room `listing:update` copy instead, so nothing about "My
 * Listings" or the device that performed the action goes through this event.
 */
export interface PublicListingUpdateEvent {
  listingId: string;
  action: 'status_changed' | 'updated' | 'deleted';
  status?: Listing['status'];
  oldStatus?: Listing['status'];
}

export interface NewListingEvent {
  listingId: string;
  title: string;
  price: number;
  mainImageUrl: string;
}

export interface SocketNotification {
  id?: string;
  type?: string;
  title?: string;
  // Confirmed 2026-09-19 — the live socket payload's field is `message` (the stored REST inbox
  // row still uses `body`; that's a separate shape this app doesn't read from this event).
  message?: string;
  // payment received, funds released, listing reported, etc. — whichever of these two ids is
  // present says what to refetch/patch. `type: 'listing_reported'` confirmed to include
  // `data.listingId` (+ `data.title`) as of 2026-09-19; `type: 'listing_unlisted'` doesn't yet.
  data?: {
    transactionId?: string;
    listingId?: string;
    [key: string]: unknown;
  };
}

let socket: Socket | null = null;

/** Opens the one realtime socket for the whole session — the moment it connects, the server
 *  verifies the access token and drops this device into its own personal room (own notifications,
 *  own listings/transactions, no explicit "join" needed). Safe to call more than once: if a socket
 *  is already open, this just re-syncs its auth instead of opening a second one. */
export function connectSocket(accessToken: string): Socket {
  if (socket) {
    updateSocketToken(accessToken);
    return socket;
  }

  socket = io(`${SOCKET_HOST}${USER_EVENTS_NAMESPACE}`, {
    auth: { token: accessToken },
    transports: ['websocket'],
    autoConnect: false,
  });

  if (__DEV__) {
    socket.on('connect', () => console.log('[socket] connected'));
    socket.on('disconnect', (reason) => {
      // Confirmed with backend 2026-09-19: a rejected/expired token does NOT surface as
      // connect_error — the server accepts the handshake, then immediately calls
      // socket.disconnect(), which the client sees as this event with exactly this reason.
      // Socket.IO's client does NOT auto-reconnect after a server-initiated disconnect (only
      // after a network-caused one), so the socket just sits idle here until something calls
      // connectSocket/updateSocketToken again — in practice, the next token refresh.
      if (reason === 'io server disconnect') {
        console.warn('[socket] disconnected by server (io server disconnect) — likely a rejected/expired token; staying idle until the next token refresh reconnects it');
      } else {
        console.log('[socket] disconnected —', reason);
      }
    });
    socket.on('connect_error', (err) => console.warn('[socket] connect_error —', err.message));
  }

  socket.connect();
  return socket;
}

/**
 * Access tokens expire (45 min default) but a live socket doesn't re-verify mid-connection —
 * left alone, it would keep working past the old token's expiry on borrowed time rather than
 * actually failing loudly. Call this every time the access token rotates (see AuthContext's
 * onTokensRefreshed registration) so the socket re-handshakes with the new one. Mutating
 * `socket.auth` + disconnect().connect() is socket.io's own documented pattern for updating auth
 * on an existing connection, rather than tearing down and rebuilding a whole new Socket instance.
 */
export function updateSocketToken(accessToken: string): void {
  if (!socket) return;
  socket.auth = { token: accessToken };
  if (socket.connected) socket.disconnect().connect();
  else socket.connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}

// A backgrounded app can have its socket's underlying connection silently killed by the OS
// without this JS ever running to see it happen — left alone, the Socket object can sit there
// still believing it's connected (`socket.connected === true`) until the next engine.io
// heartbeat finally times out (tens of seconds), silently dropping every realtime event in the
// meantime. Forcing a fresh connect the instant the app is foregrounded again means events are
// flowing before the user has even looked at the screen, instead of waiting on that timeout —
// same "re-verify on resume" idea as React Query's own focusManager wiring in queryClient.ts,
// applied to the socket instead of to queries.
let appState: AppStateStatus = AppState.currentState;

AppState.addEventListener('change', (nextState) => {
  const cameToForeground = /inactive|background/.test(appState) && nextState === 'active';
  appState = nextState;
  if (!cameToForeground || !socket) return;
  if (__DEV__) console.log('[socket] app foregrounded — forcing a fresh reconnect');
  socket.disconnect().connect();
});
