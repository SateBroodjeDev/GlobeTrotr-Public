import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { TripDocument } from "@/lib/trip-document-upload";

export function useTripDocuments(tripId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["trip-documents", tripId, user?.id],
    enabled: Boolean(user?.id && tripId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("trip_documents")
        .select("id,trip_uuid,travel_item_id,storage_path,file_name,mime_type,size_bytes,document_type,expires_on,created_at")
        .eq("trip_uuid", tripId).order("created_at", { ascending: false });
      if (error) throw Error("DOCUMENT_LIST_UNAVAILABLE");
      return (data ?? []) as TripDocument[];
    },
    retry: false,
    staleTime: 30_000,
  });
}
