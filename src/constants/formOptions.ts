export interface DropdownOption {
  label: string;
  value: string;
}

// Placeholder list — no /categories endpoint is documented yet; swap for a real backend-driven list once one exists.
export const CATEGORY_OPTIONS: DropdownOption[] = [
  { label: 'Electronics', value: 'electronics' },
  { label: 'Furniture', value: 'furniture' },
  { label: 'Home Appliances', value: 'home-appliances' },
  { label: 'Fashion', value: 'fashion' },
  { label: 'Kitchenware', value: 'kitchenware' },
  { label: 'Books & Stationery', value: 'books-stationery' },
  { label: 'Toys & Games', value: 'toys-games' },
  { label: 'Sports & Outdoors', value: 'sports-outdoors' },
  { label: 'Other', value: 'other' },
];

// value === label (matching states/areas below) — Preview displays this value as plain text directly.
export const CONDITION_OPTIONS: DropdownOption[] = ['Brand New', 'Neatly Used', 'Used', 'Fairly Used'].map((name) => ({
  label: name,
  value: name,
}));

export const NIGERIAN_STATE_OPTIONS: DropdownOption[] = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
].map((name) => ({ label: name, value: name }));

// Placeholder — only Lagos LGAs are filled in (matching the one example shown); every state maps
// to this same list for now. Needs a real per-state dataset or a backend-driven /areas endpoint.
export const LAGOS_AREA_OPTIONS: DropdownOption[] = [
  'Agege', 'Ajeromi-Ifelodun', 'Alimosho', 'Amuwo-Odofin', 'Apapa', 'Badagry',
  'Epe', 'Eti-Osa', 'Ibeju-Lekki', 'Ifako-Ijaiye', 'Ikeja', 'Ikorodu', 'Kosofe',
  'Lagos Island', 'Lagos Mainland', 'Mushin', 'Ojo', 'Oshodi-Isolo', 'Shomolu', 'Surulere',
].map((name) => ({ label: name, value: name }));

export const AREA_OPTIONS_BY_STATE: Record<string, DropdownOption[]> = {
  Lagos: LAGOS_AREA_OPTIONS,
};

export function getAreaOptions(state: string): DropdownOption[] {
  return AREA_OPTIONS_BY_STATE[state] ?? LAGOS_AREA_OPTIONS;
}
