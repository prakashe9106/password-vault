export type LoginCategory = "login" | "bank" | "card" | "social" | "email";

export interface CustomField {
  label: string;
  value: string;
}

export const CATEGORY_LABELS: Record<LoginCategory, string> = {
  login: "Login",
  bank: "Bank account",
  card: "Card",
  social: "Social media",
  email: "Email",
};

export const CATEGORY_FIELD_TEMPLATES: Record<LoginCategory, string[]> = {
  login: [],
  bank: ["Bank name", "Account number", "IFSC / routing number", "Branch", "Customer care number"],
  card: ["Card number", "Cardholder name", "Expiry date", "CVV", "PIN"],
  social: ["Recovery email", "Backup codes"],
  email: ["Recovery phone", "App password"],
};

export const LOGIN_CATEGORIES = Object.keys(CATEGORY_LABELS) as LoginCategory[];

/** The empty-valued field set a category's template starts a login with. Selecting a category in
 * the editor replaces custom_fields with this — simple and predictable, at the cost of losing
 * anything typed into a previously-selected category's fields. */
export function defaultCustomFieldsForCategory(category: LoginCategory): CustomField[] {
  return CATEGORY_FIELD_TEMPLATES[category].map((label) => ({ label, value: "" }));
}
