import { useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { transactionsApi } from '@/api';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Cold-launch / backgrounded-app backstop for the Paystack redirect (`declut://payment-callback`).
 * The live in-WebView interception (PaystackCheckoutWebView in listingDetailsModal) handles the
 * common case, where the checkout screen is still mounted to catch its own onRedirect — this
 * route only gets hit when it isn't (app was backgrounded or killed mid-checkout, so the OS
 * relaunched the app via the `declut://` scheme registered in app.json, with no live component
 * left to intercept the navigation).
 *
 * Paystack appends `?reference=...&trxref=...` to whatever callback_url we gave it, so that's all
 * this route has to work with — no listing id, no transactionId. It resolves the transaction by
 * that reference, then hands off to listingDetailsModal (which owns the confirm/poll/success UI)
 * with enough to resume there.
 */
export default function PaymentCallback() {
  const params = useLocalSearchParams<{ reference?: string; trxref?: string }>();
  const { reference, trxref } = params;
  const ref = reference ?? trxref;
  const { status } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    console.log(`[PaymentCallback] mounted — params=${JSON.stringify(params)} authStatus=${status}`);
  }, []);

  useEffect(() => {
    // Wait for AuthProvider's SecureStore hydration to finish. AuthProvider does not gate its
    // children on this (see index.tsx, which waits on status itself) — on a genuine cold launch
    // (app process wasn't already running before this deep link opened it, which is the only case
    // this route exists for), firing immediately can race the access-token read: apiClient has no
    // Authorization header yet, and this JwtAuthGuard-protected lookup 401s.
    if (status === 'loading') {
      console.log('[PaymentCallback] waiting for auth hydration before resolving reference');
      return;
    }
    if (handledRef.current) return;
    handledRef.current = true;

    if (status !== 'authenticated' || !ref) {
      console.warn(`[PaymentCallback] bailing to '/' — authStatus=${status} ref=${ref ?? '(none)'}`);
      router.replace('/');
      return;
    }

    console.log(`[PaymentCallback] resolving reference=${ref} via GET /transactions/by-reference/${ref}`);
    transactionsApi
      .getTransactionByReference(ref)
      .then((transaction) => {
        console.log(`[PaymentCallback] resolved reference=${ref} → transaction=${transaction._id} listing=${transaction.listing?._id} status=${transaction.status} — handing off to listingDetailsModal`);
        router.replace({
          pathname: '/(modals)/listingDetailsModal',
          params: { id: transaction.listing?._id, resumeTransactionId: transaction._id },
        });
      })
      .catch((e) => {
        console.error(`[PaymentCallback] failed to resolve reference=${ref}`, e);
        router.replace('/');
      });
  }, [status, ref]);

  return null;
}
