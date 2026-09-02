const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return 'Email is required.';
  if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address.';
  return undefined;
}

export function validateName(value: string): string | undefined {
  if (!value.trim()) return 'Name is required.';
  if (value.trim().length < 2) return 'Enter your full name.';
  return undefined;
}

/** `localDigits` is the phone number after the fixed +234 segment (see PhoneInput). */
export function validateNigerianLocalPhone(localDigits: string): string | undefined {
  if (!localDigits) return 'Phone number is required.';
  if (localDigits.length !== 10) return 'Enter a valid 10-digit phone number.';
  if (!/^[789]/.test(localDigits)) return 'Enter a valid Nigerian phone number.';
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'Password is required.';
  if (value.length < 8) return 'Password must be at least 8 characters.';
  return undefined;
}

export function validateRequired(value: string, label: string): string | undefined {
  if (!value.trim()) return `${label} is required.`;
  return undefined;
}

/** Required + bounded length — matches the backend's own field constraints (e.g. listing title 3-120 chars). */
export function validateLength(value: string, label: string, min: number, max: number): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  if (trimmed.length < min) return `${label} must be at least ${min} characters.`;
  if (trimmed.length > max) return `${label} must be ${max} characters or fewer.`;
  return undefined;
}

/** For optional fields that still have a backend max length (e.g. listing brand, max 60 chars). */
export function validateOptionalMaxLength(value: string, label: string, max: number): string | undefined {
  if (value.trim().length > max) return `${label} must be ${max} characters or fewer.`;
  return undefined;
}

export function validatePrice(value: string): string | undefined {
  if (!value.trim()) return 'Price is required.';
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Enter a valid price.';
  return undefined;
}
