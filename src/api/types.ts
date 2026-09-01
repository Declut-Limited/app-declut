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

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  emailVerified?: boolean;
  kycStatus: KycStatus;
  trustScore?: number;
  bankCode?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
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

export interface UpdateProfilePayload {
  name?: string;
  bankCode?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
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
  brand?: string;
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
  city: string;
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
  | 'disputed';

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
}

export interface CheckoutPayload {
  listingId: string;
  offerId?: string;
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
