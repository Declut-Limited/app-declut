import { apiClient } from './client';
import type {
  ApiEnvelope,
  AuthTokens,
  ChangePasswordPayload,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  GoogleSignInPayload,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  ResendOtpPayload,
  ResendVerificationEmailResponse,
  ResetPasswordPayload,
  User,
  VerifyEmailPayload,
  VerifyOtpPayload,
  VerifyOtpResponse,
} from './types';

type AuthResponse = AuthTokens & { user?: User };

export async function register(payload: RegisterPayload) {
  const res = await apiClient.post<ApiEnvelope<RegisterResponse>>('/auth/register', payload);
  return res.data.data;
}

export async function login(payload: LoginPayload) {
  const res = await apiClient.post<ApiEnvelope<AuthResponse>>('/auth/login', payload);
  return res.data.data;
}

export async function googleSignIn(payload: GoogleSignInPayload) {
  const res = await apiClient.post<ApiEnvelope<AuthResponse>>('/auth/google', payload);
  return res.data.data;
}

export async function logout(refreshToken: string) {
  await apiClient.post('/auth/logout', { refreshToken });
}

export async function forgotPassword(payload: ForgotPasswordPayload) {
  const res = await apiClient.post<ApiEnvelope<ForgotPasswordResponse>>('/auth/forgot-password', payload);
  return res.data.data;
}

export async function resendOtp(payload: ResendOtpPayload) {
  const res = await apiClient.post<ApiEnvelope<ForgotPasswordResponse>>('/auth/resend-otp', payload);
  return res.data.data;
}

export async function verifyOtp(payload: VerifyOtpPayload) {
  const res = await apiClient.post<ApiEnvelope<VerifyOtpResponse>>('/auth/verify-otp', payload);
  return res.data.data;
}

export async function resetPassword(payload: ResetPasswordPayload) {
  await apiClient.post('/auth/reset-password', payload);
}

export async function changePassword(payload: ChangePasswordPayload) {
  await apiClient.patch('/auth/change-password', payload);
}

/**
 * Confirmed (2026-07-23). Unlike the forgot-password OTP chain this is
 * JwtAuthGuard-protected, not anonymous — register already sends the first
 * OTP and returns its otpToken, so this only needs both when otpToken is
 * missing (e.g. app restarted mid-flow, or logging back in with an
 * already-registered-but-unverified account).
 */
export async function verifyEmail(payload: VerifyEmailPayload) {
  await apiClient.post('/auth/verify-email', payload);
}

export async function resendVerificationEmail() {
  const res = await apiClient.post<ApiEnvelope<ResendVerificationEmailResponse>>('/auth/resend-verification-email');
  return res.data.data;
}
