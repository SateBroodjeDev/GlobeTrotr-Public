import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { getPublicRumSettings } from "@/lib/public-performance.functions";
import { publicRumPage, type PublicRumSettings } from "./public-performance";

const disabled: PublicRumSettings = { enabled: false };
export function usePublicRumSettings(): PublicRumSettings {
  const path = useRouterState({ select: state => state.location.href });
  const [candidate, setCandidate] = useState(false);
  useEffect(() => { setCandidate(publicRumPage(window.location.href) !== null); }, [path]);
  const query = useQuery({
    queryKey: ["public-performance-settings"], queryFn: () => getPublicRumSettings(), enabled: candidate,
    staleTime: Infinity, retry: false, refetchOnWindowFocus: false,
  });
  return candidate ? query.data ?? disabled : disabled;
}
