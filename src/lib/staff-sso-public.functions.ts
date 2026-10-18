import { createServerFn } from "@tanstack/react-start";

// Public visibility flag only; no database or privileged credentials.
export const getStaffSsoConfiguration = createServerFn({ method: "GET" }).handler(async () => ({
  enabled: process.env.STAFF_SSO_ENABLED === "true",
}));
