import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { hidePublicJournalReaction, listPublicJournalReactions } from "@/lib/public-trip-follow.functions";
import { useLocale } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Reaction={id:string;entry_id:string;liked:boolean;display_name:string|null;comment:string|null;status:"visible"|"hidden";created_at:string};

export function TripJournalReactionManagement({tripId,editable}:{tripId:string;editable:boolean}){
 const{text}=useLocale();
 const query=useQuery({queryKey:["journal-reactions",tripId],enabled:editable,queryFn:async()=>await listPublicJournalReactions({data:{tripId}}) as Reaction[],retry:false});
 if(!editable||!query.data?.some((item:Reaction)=>item.comment&&item.status==="visible"))return null;
 async function hide(id:string){try{await hidePublicJournalReaction({data:{tripId,reactionId:id}});await query.refetch();toast.success(text("Reactie verborgen.","Comment hidden."));}catch{toast.error(text("Reactie kon niet worden verborgen.","Comment could not be hidden."));}}
 return <Card className="surface"><CardContent className="space-y-3 p-4"><div className="flex items-center gap-2"><MessageCircle className="size-4 text-primary"/><strong>{text("Reacties beheren","Manage comments")}</strong></div><p className="text-xs text-muted-foreground">{text("Verberg reacties die niet op je openbare reisverhaal thuishoren.","Hide comments that do not belong on your public travel story.")}</p>{query.data.filter((item:Reaction)=>item.comment&&item.status==="visible").map((item:Reaction)=><div key={item.id} className="flex gap-3 rounded-xl border p-3"><div className="min-w-0 flex-1"><strong className="text-sm">{item.display_name}</strong><p className="whitespace-pre-wrap text-sm">{item.comment}</p></div><Button size="icon" variant="ghost" aria-label={text("Reactie verbergen","Hide comment")} onClick={()=>void hide(item.id)}><Trash2 className="size-4"/></Button></div>)}</CardContent></Card>
}
