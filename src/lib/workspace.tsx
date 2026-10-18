import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { TripSaveQueue, TRIP_RELOAD_MESSAGE } from "./trip-save-queue";
import { useQuery } from "@tanstack/react-query";
import { getStaffSecurityStatus } from "./staff-security.functions";
import { staffLoginRequired, authSessionCacheId } from "./staff-account-access";
import { FALLBACK_RATES, type Rates } from "./services";
import { getRates } from "./fx.functions";
import {
  createTrip as createTripInDatabase,
  deleteTrip as deleteTripInDatabase,
  loadWorkspace,
  saveTrip as saveTripInDatabase,
  saveWorkspace,
} from "./cloud.functions";
import { useAuth } from "./auth";
import { TEMPLATES, type PlanId, type Trip, type TripTemplate, type WorkspaceState } from "./types";
import { GLOBETROTR_BRANDING } from "./branding";

const STORAGE_KEY = "globetrotr.workspace.v1";
const LEGACY_STORAGE_KEY = "atlasledger.workspace.v1";

export const uid = () => Math.random().toString(36).slice(2, 10);

function seed(): WorkspaceState {
  return {
    plan: "free",
    role: "owner",
    baseCurrency: "EUR",
    branding: {
      brandName: "GlobeTrotr",
      domain: "globetrotr.nl",
      accent: 172,
      tagline: "Plan elke reis. Verantwoord elke euro.",
    },
    members: [],
    trips: [],
  };
}

type Ctx = {
  state: WorkspaceState;
  update: (fn: (s: WorkspaceState) => WorkspaceState) => void;
  updateTrip: (id: string, fn: (t: Trip) => Trip) => void;
  /** Optimistic trip mutation that resolves only after the server confirms it. */
  saveTripNow: (id: string, fn: (t: Trip) => Trip) => Promise<void>;
  addTrip: (name: string, template: TripTemplate) => Promise<string>;
  removeTrip: (id: string) => Promise<void>;
  rates: Rates;
  ratesLive: boolean;
  reset: () => void;
  changePlan: (plan: PlanId) => Promise<boolean>;
  refreshWorkspace: () => Promise<void>;
  cloud: "local" | "loading" | "synced" | "saving";
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(() => seed());
  const { user, session, loading: authLoading } = useAuth();
  const userId = user?.id;
  const sessionCacheId = authSessionCacheId(session?.access_token);
  const accountSecurity = useQuery({
    queryKey: ["account-session-security", user?.id, sessionCacheId],
    queryFn: () => getStaffSecurityStatus(),
    enabled: Boolean(user) && !authLoading,
    retry: false,
    staleTime: 0,
    refetchInterval: 60_000,
  });
  const accountAccessAllowed = !user || (accountSecurity.isSuccess && !staffLoginRequired(accountSecurity.data));
  const [cloud, setCloud] = useState<Ctx["cloud"]>("local");
  const hydrated = useRef(false);
  const stateRef = useRef(state);
  const cloudPersistenceReady = useRef(false);
  const saveSequence = useRef(0);
  const pendingTripIds = useRef(new Set<string>());
  const workspaceDirty = useRef(false);
  const tripQueue = useRef(new TripSaveQueue());
  const [saveRevision, setSaveRevision] = useState(0);
  stateRef.current = state;

  const cacheKey = user && accountAccessAllowed ? `${STORAGE_KEY}.${user.id}` : null;
  const legacyCacheKey = user && accountAccessAllowed ? `${LEGACY_STORAGE_KEY}.${user.id}` : null;

  // Per-account cache for instant paint; guests never see another account's data
  useEffect(() => {
    if (!cacheKey) {
      hydrated.current = true;
      return;
    }
    try {
      const raw = localStorage.getItem(cacheKey) ?? (legacyCacheKey ? localStorage.getItem(legacyCacheKey) : null);
      if (raw) setState(JSON.parse(raw) as WorkspaceState);
      if (!localStorage.getItem(cacheKey) && raw) localStorage.setItem(cacheKey, raw);
      if (legacyCacheKey) localStorage.removeItem(legacyCacheKey);
    } catch {
      /* ignore */
    }
    hydrated.current = true;
  }, [cacheKey, legacyCacheKey]);

  useEffect(() => {
    if (!cacheKey) return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, cacheKey]);

  // Cloud hydration when signed in
  useEffect(() => {
    if (authLoading) return;
    if (userId && !accountAccessAllowed) {
      cloudPersistenceReady.current = false;
      tripQueue.current = new TripSaveQueue();
      pendingTripIds.current.clear();
      setCloud("loading");
      setState(seed());
      return;
    }
    if (!userId) {
      cloudPersistenceReady.current = false;
      setCloud("local");
      setState(seed());
      hydrated.current = false;
      return;
    }
    tripQueue.current = new TripSaveQueue();
    pendingTripIds.current.clear();
    let cancelled = false;
    setCloud("loading");
    loadWorkspace()
      .then(async (row) => {
        if (cancelled) return;
        const remote = row?.data as WorkspaceState | undefined;
        if (remote && Array.isArray(remote.trips)) {
          setState(remote);
        } else {
          await saveWorkspace({ data: { data: stateRef.current } });
        }
        cloudPersistenceReady.current = true;
        if (!cancelled) setCloud("synced");
      })
      .catch(() => !cancelled && setCloud("local"));
    return () => {
      cancelled = true;
    };
  // Auth refresh/focus can replace the User object without changing the account
  // or session. That must not reload trips or reset their pending save queue.
  }, [userId, authLoading, accountAccessAllowed, sessionCacheId]);

  const persistTrip = useCallback(async (trip: Trip) => {
    const queue = tripQueue.current;
    const result = await queue.enqueue(trip, (snapshot) =>
      saveTripInDatabase({ data: { trip: snapshot } }),
    );
    if (queue !== tripQueue.current) return;
    // Preserve edits made while this snapshot was in flight; acknowledge only its version.
    const next = {
      ...stateRef.current,
      trips: stateRef.current.trips.map((current) =>
        current.id === trip.id ? { ...current, revision: result.revision } : current,
      ),
    };
    stateRef.current = next;
    setState(next);
  }, []);

  // Workspace-instellingen en reizen gebruiken verschillende schrijfpunten:
  // reisdata gaat direct naar de relationele tabellen, overige instellingen
  // blijven tijdelijk in het workspace-document.
  useEffect(() => {
    if (!user || !hydrated.current || !cloudPersistenceReady.current) return;
    if (!workspaceDirty.current && !pendingTripIds.current.size) return;
    const t = setTimeout(() => {
      const sequence = ++saveSequence.current;
      const tripIds = [...pendingTripIds.current];
      const shouldSaveWorkspace = workspaceDirty.current;
      pendingTripIds.current.clear();
      workspaceDirty.current = false;
      setCloud("saving");
      (async () => {
        if (shouldSaveWorkspace) await saveWorkspace({ data: { data: stateRef.current } });
        // Achter elkaar opslaan houdt de JSON-compatibiliteitskopie consistent
        // wanneer twee verschillende reizen vlak na elkaar wijzigen.
        for (const id of tripIds) {
          const trip = stateRef.current.trips.find((current) => current.id === id);
          if (trip && !tripQueue.current.isBlocked(id)) await persistTrip(trip);
        }
      })()
        .then(() => {
          if (sequence === saveSequence.current) setCloud("synced");
        })
        .catch((error) => {
          toast.error(error instanceof Error ? error.message : TRIP_RELOAD_MESSAGE, {
            duration: Infinity,
          });
          if (shouldSaveWorkspace) workspaceDirty.current = true;
          tripIds
            .filter((id) => !tripQueue.current.isBlocked(id))
            .forEach((id) => pendingTripIds.current.add(id));
          if (sequence === saveSequence.current) setCloud("synced");
        });
    }, 900);
    return () => clearTimeout(t);
  }, [saveRevision, user, persistTrip]);

  const ratesQuery = useQuery({
    queryKey: ["fx-rates"],
    queryFn: () => getRates(),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  const update = useCallback((fn: (s: WorkspaceState) => WorkspaceState) => {
    workspaceDirty.current = true;
    setState((s) => fn(s));
    setSaveRevision((revision) => revision + 1);
  }, []);

  const updateTrip = useCallback((id: string, fn: (t: Trip) => Trip) => {
    if (tripQueue.current.isBlocked(id)) {
      toast.error(TRIP_RELOAD_MESSAGE, { duration: Infinity });
      return;
    }
    pendingTripIds.current.add(id);
    const next = {
      ...stateRef.current,
      trips: stateRef.current.trips.map((trip) => (trip.id === id ? fn(trip) : trip)),
    };
    stateRef.current = next;
    setState(next);
    setSaveRevision((revision) => revision + 1);
  }, []);

  const saveTripNow = useCallback(
    async (id: string, fn: (trip: Trip) => Trip) => {
      if (tripQueue.current.isBlocked(id)) throw new Error(TRIP_RELOAD_MESSAGE);
      const previousState = stateRef.current;
      const previousTrip = previousState.trips.find((trip) => trip.id === id);
      if (!previousTrip) throw new Error("Reis niet gevonden.");

      const nextTrip = fn(previousTrip);
      const nextState = {
        ...previousState,
        trips: previousState.trips.map((trip) => (trip.id === id ? nextTrip : trip)),
      };
      stateRef.current = nextState;
      setState(nextState);
      pendingTripIds.current.delete(id);

      if (!user) return;

      setCloud("saving");
      try {
        await persistTrip(nextTrip);
        setCloud("synced");
      } catch (error) {
        // Revert only when no newer edit has replaced this optimistic trip.
        setState((current) => {
          const stored = current.trips.find((trip) => trip.id === id);
          if (stored !== nextTrip) return current;
          const reverted = {
            ...current,
            trips: current.trips.map((trip) => (trip.id === id ? previousTrip : trip)),
          };
          stateRef.current = reverted;
          return reverted;
        });
        setCloud("synced");
        throw error;
      }
    },
    [user, persistTrip],
  );

  const addTrip = useCallback(
    async (name: string, template: TripTemplate) => {
      const tpl = TEMPLATES.find((t) => t.id === template)!;
      const today = new Date().toISOString().slice(0, 10);
      let id = user ? crypto.randomUUID() : uid();
      let revision: string | undefined;
      if (user) {
        const created = await createTripInDatabase({
          data: { tripId: id, name, template, start: today, budget: 1500 },
        });
        id = created.tripId;
        revision = created.revision;
      }
      const current = stateRef.current;
      const next = {
        ...current,
        trips: [
          ...current.trips,
          {
            id,
            ...(revision ? { revision } : {}),
            name,
            template,
            start: today,
            end: today,
            budget: 1500,
            stops: [],
            itinerary: tpl.itinerary.map((title) => ({ id: uid(), day: today, title })),
            expenses: [],
          },
        ],
      };
      // Directe vervolgstappen (zoals JSON-import) lezen stateRef voordat React
      // opnieuw rendert. Houd de ref daarom synchroon met de nieuwe reis.
      stateRef.current = next;
      setState(next);
      pendingTripIds.current.add(id);
      setSaveRevision((revision) => revision + 1);
      return id;
    },
    [user],
  );

  const removeTrip = useCallback(
    async (id: string) => {
      const trip = stateRef.current.trips.find((current) => current.id === id);
      if (!trip) throw new Error("Reis niet gevonden.");
      const queue = tripQueue.current;
      pendingTripIds.current.delete(id);
      if (user) {
        await queue.enqueue(trip, async (snapshot) => {
          if (!snapshot.revision) throw new Error(TRIP_RELOAD_MESSAGE);
          await deleteTripInDatabase({ data: { tripId: id, revision: snapshot.revision } });
          queue.block(id);
          return { revision: snapshot.revision };
        });
      }
      if (queue !== tripQueue.current) return;
      const next = {
        ...stateRef.current,
        trips: stateRef.current.trips.filter((current) => current.id !== id),
      };
      stateRef.current = next;
      setState(next);
    },
    [user],
  );

  const reset = useCallback(() => setState(seed()), []);

  const changePlan = useCallback(
    async (plan: PlanId) => {
      if (!user) return false;

      const previous = stateRef.current;
      const next = {
        ...previous,
        plan,
        ...(plan === "agency" ? {} : { branding: { ...GLOBETROTR_BRANDING } }),
      };
      stateRef.current = next;
      setState(next);
      setCloud("saving");

      try {
        await saveWorkspace({ data: { data: next } });
        setCloud("synced");
        return true;
      } catch {
        stateRef.current = previous;
        setState(previous);
        setCloud("synced");
        return false;
      }
    },
    [user],
  );

  const refreshWorkspace = useCallback(async () => {
    if (!user) return;
    setCloud("loading");
    try {
      const row = await loadWorkspace();
      const remote = row?.data as WorkspaceState | undefined;
      if (remote && Array.isArray(remote.trips)) {
        stateRef.current = remote;
        setState(remote);
      }
      setCloud("synced");
    } catch (error) {
      setCloud("synced");
      throw error;
    }
  }, [user]);

  const value = useMemo<Ctx>(
    () => ({
      state,
      update,
      updateTrip,
      saveTripNow,
      addTrip,
      removeTrip,
      rates: ratesQuery.data ?? FALLBACK_RATES,
      ratesLive: !!ratesQuery.data,
      reset,
      changePlan,
      refreshWorkspace,
      cloud,
    }),
    [
      state,
      update,
      updateTrip,
      saveTripNow,
      addTrip,
      removeTrip,
      ratesQuery.data,
      reset,
      changePlan,
      refreshWorkspace,
      cloud,
    ],
  );

  return <WorkspaceContext.Provider value={accountAccessAllowed ? value : { ...value, state: seed(), cloud: "loading" }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
