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
