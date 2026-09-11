/** Shapes match docs/Declut-API.postman_collection.json. */

export interface ApiEnvelope<T> {
  data: T;
  message?: string;
  success?: boolean;
}

/** Confirmed 2026-07-24 against the deployed API: { success: false, error: { statusCode, message, path, timestamp } }. */
export interface ApiErrorBody {
  success: false;
  error: {
    statusCode: number;
    message: string | string[];
    path?: string;
    timestamp?: string;
  };
}

export type KycStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type AuthProvider = 'google' | 'email_phone';
export type AccountStatus = 'active' | 'suspended' | 'pending';

/** Confirmed 2026-09-10 against the deployed GET /users/me — richer than the old shape (stats, slug, kyc sub-checks). */
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  authProvider?: AuthProvider;
  emailVerified?: boolean;
  kycStatus: KycStatus;
  kyc?: { verifiedNIN: boolean; livenessChecked: boolean };
  accountStatus?: AccountStatus;
  /** Short human-facing id, e.g. "USR-0017". */
  slug?: string;
  avgRating?: number;
  reviewCount?: number;
  trustScore?: number;
  bankCode?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  /** True once a BankAccount row exists for this user (see POST /bank-accounts) — drives whether the post-publish payout prompt shows. */
  hasPayoutDetails?: boolean;
  /** UI-ready, but not actually returned by any documented endpoint yet — undefined on every real response today. */
  location?: string;
  profileImageUrl?: string;
  listingCount?: number;
  soldCount?: number;
  purchaseCount?: number;
  totalAmountInEscrow?: number;
  createdAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Register also sends a signup-verification OTP immediately and returns its stateless token. */
export interface RegisterResponse extends AuthTokens {
  otpToken: string;
}

export interface RegisterPayload {
  email: string;
  name: string;
  password: string;
  /** Nigerian number: 07/08/09 + 9 local digits, or +234 international. Doubles as the alternate login identifier — must be unique. */
  phone: string;
  /** Optional Expo push token — if present, added to deviceTokens (deduped, same as POST /notifications/register-token). */
  pushToken?: string;
}

export interface LoginPayload {
  /** Email or phone — whichever the account was registered with. */
  identifier: string;
  password: string;
  /** Optional Expo push token — if present, added to deviceTokens (deduped, same as POST /notifications/register-token). */
  pushToken?: string;
}

export interface GoogleSignInPayload {
  idToken: string;
}

export interface RefreshPayload {
  refreshToken: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ForgotPasswordResponse {
  otpToken: string;
}

export interface ResendOtpPayload {
  otpToken: string;
}

export interface VerifyOtpPayload {
  otpToken: string;
  otp: string;
}

export interface VerifyOtpResponse {
  resetToken: string;
}

export interface ResetPasswordPayload {
  resetToken: string;
  newPassword: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface VerifyEmailPayload {
  otpToken: string;
  otp: string;
}

export interface ResendVerificationEmailResponse {
  otpToken: string;
}

export interface VerifyNinPayload {
  nin: string;
}

export interface LivenessCheckPayload {
  selfieImageBase64: string;
}

/** Both checks are independent; kycStatus becomes 'verified' once both pass. */
export interface KycCheckResponse {
  kycStatus: KycStatus;
  referenceId?: string;
  reason?: string;
}

export interface KycHistoryEntry {
  referenceId: string;
  status: KycStatus;
  createdAt: string;
}

/** Confirmed 2026-09-10 — bank/payout details live on their own BankAccount document now (see POST /bank-accounts), not here. */
export interface UpdateProfilePayload {
  name?: string;
  phoneNumber?: string;
  /** Cloudinary secure URL from GET /media/upload-signature, uploaded client-side first. */
  profileImage?: string;
}

/** GET /banks — active Nigerian banks only. Nothing persisted. */
export interface Bank {
  code: string;
  name: string;
  shortName: string;
  fullName: string;
  slug: string;
  logoUrl: string;
}

/** GET /banks/resolve — also a Paystack passthrough, used to show the resolved name before submitting. */
export interface ResolveBankAccountResponse {
  accountNumber: string;
  accountName: string;
}

export interface CreateBankAccountPayload {
  bankCode: string;
  accountNumber: string;
}

/** POST /bank-accounts — accountHolderName is re-resolved server-side against Paystack, never taken from the client. */
export interface BankAccount {
  id: string;
  userId: string;
  bankCode: string;
  shortName: string;
  fullName: string;
  accountNumber: string;
  maskedAccountNumber: string;
  accountHolderName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  results: T[];
  page: number;
  limit: number;
  total: number;
  hasMore?: boolean;
}

export interface Category {
  id: string;
  title: string;
  slug: string;
}

/** GeoJSON Point, matching the backend's actual response shape — coordinates are [lng, lat], not [lat, lng]. */
export interface ListingLocation {
  type?: 'Point';
  coordinates: [number, number];
}

/** Cloudinary's own upload-response shape, camelCased — publicId/secureUrl are what /listings stores per image/video. */
export interface CloudinaryMediaRef {
  publicId: string;
  url: string;
  secureUrl: string;
  /** Optional on the way in — defaulted server-side to array position/false when omitted. */
  sortOrder?: number;
  isPrimary?: boolean;
}

export type ListingCondition = 'new' | 'neatly_used';

export interface Listing {
  id: string;
  _id: string;
  title: string;
  description: string;
  category: string;
  condition: ListingCondition;
  price: number;
  specs?: { brand?: string };
  images: CloudinaryMediaRef[];
  video?: CloudinaryMediaRef;
  /** Computed server-side from whichever image has isPrimary:true (falls back to the first). Never sent by the client. */
  mainImageUrl: string;
  hasDefect?: boolean;
  defectDescription?: string | null;
  location: ListingLocation;
  /** Computed server-side as "city, state". Never sent by the client. */
  locationLabel: string;
  state?: string;
  city?: string;
  address?: string;
  status: 'active' | 'archived' | 'sold';
  sellerId: string;
  /** Populated on GET /listings/:id (id or LST-#### slug) — not present on list/search results. */
  seller?: Pick<User, 'id' | 'name' | 'trustScore'>;
  createdAt: string;
  /** Only present when a search included lat/lng (radius search). */
  distanceKm?: number;
  /** Only present if the backend embeds the caller's favorite state in search results. */
  favorited?: boolean;
  /** UI-ready, but not actually returned by any documented endpoint yet — undefined on every real response today. */
  viewCount?: number;
  /** UI-ready, but not actually returned by any documented endpoint yet — undefined on every real response today. */
  watchCount?: number;
}

/** Plain {lat,lng} on the way in — distinct from ListingLocation, the GeoJSON shape the response comes back as. */
export interface CreateListingLocation {
  lat: number;
  lng: number;
}

export interface CreateListingPayload {
  title: string;
  description: string;
  categoryId: string;
  price: number;
  brand?: string;
  state: string;
  area: string;
  address: string;
  location: CreateListingLocation;
  condition: ListingCondition;
  hasDefect: boolean;
  defectDescription?: string | null;
  /** Max 3. */
  images: CloudinaryMediaRef[];
  /** Single object, not an array — max 1. */
  video?: CloudinaryMediaRef;
}

export type UpdateListingPayload = Partial<CreateListingPayload>;

export interface DeleteImageResponse {
  deleted: boolean;
}

/** GET /listings — all fields optional/combinable; shares its filter logic with GET /listings/count. */
export interface ListingSearchParams {
  categoryId?: string;
  /** When true, lat/lng/searchWithin apply ($geoNear). When false/omitted, address/state/city/area text filters apply instead. */
  useMyLocation?: boolean;
  lat?: number;
  lng?: number;
  /** Radius in km — only applied when useMyLocation is true. Omitted = unlimited distance, still proximity-sorted. */
  searchWithin?: number;
  address?: string;
  state?: string;
  city?: string;
  area?: string;
  /** Matches Listing.condition = 'new'. */
  conditionNew?: boolean;
  /** Matches Listing.condition in [like_new, good] — fair/poor are excluded. */
  conditionNeatlyUsed?: boolean;
  minPrice?: number;
  maxPrice?: number;
  /** Free-text match against title/description (Mongo text search). */
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListingsCountParams {
  lat: number;
  lng: number;
  /** >= 0.1. Defaults to 5 if omitted. */
  radiusKm?: number;
}

/** Response shape assumed ({ count }) — no example response was given for GET /listings/count. */
export interface ListingsCountResponse {
  count: number;
}

/** counted:false means this viewer already registered a view for this listing within the last hour. */
export interface RegisterListingViewResponse {
  counted: boolean;
}

export interface NearbyListingsParams {
  lat: number;
  lng: number;
  /** Max distance in km, >= 0.1. Defaults to 5 if omitted. Actually enforced server-side (via $geoNear), unlike ListingSearchParams.radiusKm. */
  radiusKm?: number;
  page?: number;
  limit?: number;
}

export interface NewListingsParams {
  page?: number;
  limit?: number;
}

export interface UploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder?: string;
}

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'withdrawn';

export interface Offer {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  status: OfferStatus;
  proposedBy: string;
}

export interface MakeOfferPayload {
  listingId: string;
  amount: number;
}

export interface CounterOfferPayload {
  amount: number;
}

export type TransactionStatus =
  | 'pending_payment'
  | 'escrow_active'
  | 'awaiting_inspection'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'refunded';

export interface Transaction {
  id: string;
  listingId: string;
  offerId?: string;
  buyerId: string;
  sellerId: string;
  status: TransactionStatus;
  amount: number;
  /** Only ever present for the buyer, and only while escrow_active/awaiting_inspection. */
  confirmationCode?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** GET /transactions/purchases query — 'active' maps server-side to awaiting_inspection only; omit entirely for every status. */
export type PurchaseStatusFilter = 'active' | 'completed' | 'refunded' | 'disputed';

export interface CheckoutPayload {
  listingId: string;
  /** App's own deep-link scheme (registered as `declut://` in app.json) — Paystack redirects here when checkout finishes. */
  callbackUrl?: string;
}

/** No Transaction/Escrow exists yet at this point — just a pending_payment stub + where to send the buyer to pay. */
export interface CheckoutResponse {
  transactionId: string;
  paystackAuthorizationUrl: string;
}

export interface ConfirmCodePayload {
  code: string;
}

export interface Review {
  id: string;
  transactionId: string;
  rating: number;
  comment: string;
  reviewerId: string;
  revieweeId: string;
}

export interface LeaveReviewPayload {
  transactionId: string;
  rating: number;
  comment: string;
}

/** Batched as of 2026-07-23 — 1-10 entries per call, token min 10 chars, platform optional. */
export interface DeviceTokenEntry {
  token: string;
  platform?: 'ios' | 'android';
}

export interface RegisterDeviceTokensPayload {
  tokens: DeviceTokenEntry[];
}

export interface RegisterDeviceTokensResponse {
  registered: number;
}

/** GET /notification-settings/user/:userId — auto-creates with defaults on first call. */
export interface NotificationSettings {
  id: string;
  userId: string;
  channels: { push: boolean; email: boolean };
  transactionUpdates: boolean;
  inspectionReminders: boolean;
  disputeUpdates: boolean;
  /** Not accepted by PATCH — sending it 400s. Always on. */
  paymentAndEscrowUpdates: boolean;
  /** Not accepted by PATCH — sending it 400s. Always on. */
  listingActivity: boolean;
  /** Not accepted by PATCH — sending it 400s. Always on. */
  productUpdates: boolean;
  /** Not accepted by PATCH — sending it 400s, despite the design showing a toggle for it. */
  referralAndRewards: boolean;
  createdAt: string;
  updatedAt: string;
}

/** PATCH /notification-settings/user/:userId — partial update; only these fields are accepted. */
export interface UpdateNotificationSettingsPayload {
  channels?: { push?: boolean; email?: boolean };
  transactionUpdates?: boolean;
  inspectionReminders?: boolean;
  disputeUpdates?: boolean;
}
