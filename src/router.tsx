import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = async () => {
  const nonce = import.meta.env.SSR ? (await import("./lib/csp-context.server")).currentCspNonce() :
    document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.content;
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    ssr: { nonce },
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
