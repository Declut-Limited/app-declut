import { City, State } from 'country-state-city';

export interface DropdownOption {
  label: string;
  value: string;
}

// The app only ever operates in Nigeria — no country picker is shown, so this stays internal.
const NIGERIA_COUNTRY_CODE = 'NG';

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

// Values match the backend's Listing.condition enum ('new' | 'neatly_used') exactly — POST/PATCH
// /listings sends `condition` verbatim, so this can't be a display label like the other option lists.
export const CONDITION_OPTIONS: DropdownOption[] = [
  { label: 'New', value: 'new' },
  { label: 'Neatly used', value: 'neatly_used' },
];

// Real states, from country-state-city — replaces the old hand-typed 36-state list.
export const NIGERIAN_STATE_OPTIONS: DropdownOption[] = State.getStatesOfCountry(NIGERIA_COUNTRY_CODE).map((s) => ({
  label: s.name,
  value: s.name,
}));

// `state` is looked up by name (not country-state-city's isoCode) since that's the display value
// stored everywhere else in the app (PickerField, AddItemPreviewStep) — resolving it to the isoCode
// City.getCitiesOfState actually needs is this function's job alone.
export function getAreaOptions(state: string): DropdownOption[] {
  const match = State.getStatesOfCountry(NIGERIA_COUNTRY_CODE).find((s) => s.name === state);
  if (!match) return [];
  return City.getCitiesOfState(NIGERIA_COUNTRY_CODE, match.isoCode).map((c) => ({ label: c.name, value: c.name }));
}
