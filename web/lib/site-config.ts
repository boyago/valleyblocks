export const siteContact = {
  owner: "Alexandre Boyago",
  email: process.env.CONTACT_EMAIL || "app.boyago@gmail.com",
  website: "https://alexandreboyago.com.br",
};
export const analyticsId = /^G-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "")
  ? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID! : "";
export const ownUsageEnabled = process.env.NEXT_PUBLIC_LABS_USAGE_ENABLED === "true";
export const signupEnabled = process.env.NEXT_PUBLIC_LABS_SIGNUP_ENABLED === "true";
export const paymentsEnabled = process.env.NEXT_PUBLIC_LABS_PAYMENTS_ENABLED === "true";
