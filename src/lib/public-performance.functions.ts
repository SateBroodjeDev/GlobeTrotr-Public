import { createServerFn } from "@tanstack/react-start";
import { publicRumSettings } from "./public-performance";

/** Public configuration only; no database, identity, writes, logs or provider calls. */
export const getPublicRumSettings = createServerFn({ method: "GET" })
  .handler(async () => publicRumSettings(process.env));
