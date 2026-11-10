import { AsyncLocalStorage } from "node:async_hooks";
const nonces = new AsyncLocalStorage<string>();
export const withCspNonce = <T>(nonce: string, run: () => T) => nonces.run(nonce, run);
export const currentCspNonce = () => nonces.getStore();
