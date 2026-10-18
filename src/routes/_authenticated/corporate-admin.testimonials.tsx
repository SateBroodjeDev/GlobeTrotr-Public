import { translationDraftMessage } from "@/lib/translation-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, Pencil, RotateCcw, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TranslationDraftButtons, type TranslationDirection } from "@/components/TranslationDraftButtons";
import { useLocale } from "@/lib/locale";
import { createTranslationDraft } from "@/lib/translation.functions";
import { archiveTestimonial, listTestimonials, saveTestimonial } from "@/lib/testimonials.functions";

export const Route=createFileRoute("/_authenticated/corporate-admin/testimonials")({component:TestimonialsPage});
const empty={id:"",authorName:"",authorContextNl:"",authorContextEn:"",quoteNl:"",quoteEn:"",rating:5 as number|null,position:0,published:false};

function TestimonialsPage(){
  const{text}=useLocale();const query=useQuery({queryKey:["testimonials-admin"],queryFn:listTestimonials});const[form,setForm]=useState(empty);const[saving,setSaving]=useState(false);const rows=query.data??[];
  const englishInvalid=form.quoteEn.trim().length>0&&form.quoteEn.trim().length<20;
  async function translate(direction:TranslationDirection){
    const source=direction==="nl-en"?"nl":"en",target=direction==="nl-en"?"en":"nl";
    const quoteValue=direction==="nl-en"?form.quoteNl:form.quoteEn;
    const contextValue=direction==="nl-en"?form.authorContextNl:form.authorContextEn;
    if(!quoteValue.trim())return;
    setSaving(true);
    try{
      const [quote,context]=await Promise.all([
        createTranslationDraft({data:{text:quoteValue,source,target}}),
        contextValue.trim()?createTranslationDraft({data:{text:contextValue,source,target}}):Promise.resolve({translated:""}),
      ]);
      setForm(current=>direction==="nl-en"?{...current,quoteEn:quote.translated,authorContextEn:context.translated}:{...current,quoteNl:quote.translated,authorContextNl:context.translated});
      toast.success(text("Vertaalconcept gemaakt. Controleer de woorden van de recensent voor opslaan.","Translation draft created. Review the reviewer's wording before saving."));
    }catch(error){toast.error(translationDraftMessage(error, text));}
    finally{setSaving(false);}
  }
  async function save(){setSaving(true);try{await saveTestimonial({data:{...form,id:form.id||undefined}});setForm(empty);await query.refetch();toast.success(text("Recensie opgeslagen.","Testimonial saved."));}catch(error){const message=error instanceof Error?error.message:"";toast.error(message.includes("FORBIDDEN")?text("Je hebt geen recht om recensies te beheren.","You do not have permission to manage testimonials."):message.includes("INVALID_TESTIMONIAL")?text("Controleer de naam en teksten. Een recensie bevat minimaal 20 tekens.","Check the name and text. A testimonial needs at least 20 characters."):text("Recensie kon niet worden opgeslagen. Probeer het opnieuw.","Testimonial could not be saved. Please try again."));}finally{setSaving(false);}}
  async function archive(id:string,archived:boolean){try{await archiveTestimonial({data:{id,archived}});await query.refetch();toast.success(archived?text("Recensie gearchiveerd.","Testimonial archived."):text("Recensie hersteld.","Testimonial restored."));}catch{toast.error(text("Actie mislukt.","Action failed."));}}
  function edit(row:any){setForm({id:row.id,authorName:row.author_name,authorContextNl:row.author_context_nl??"",authorContextEn:row.author_context_en??"",quoteNl:row.quote_nl,quoteEn:row.quote_en??"",rating:row.rating,position:row.position,published:row.published});window.scrollTo({top:0,behavior:"smooth"});}
  return <div className="space-y-5"><Card><CardHeader><CardTitle>{form.id?text("Recensie bewerken","Edit testimonial"):text("Recensie toevoegen","Add testimonial")}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Field label={text("Naam","Name")}><Input maxLength={80} value={form.authorName} onChange={e=>setForm({...form,authorName:e.target.value})}/></Field><Field label={text("Context, bijvoorbeeld ‘betatester’","Context, for example ‘beta tester’")}><Input maxLength={120} value={form.authorContextNl} onChange={e=>setForm({...form,authorContextNl:e.target.value})}/></Field><Field label="Context EN"><Input maxLength={120} value={form.authorContextEn} onChange={e=>setForm({...form,authorContextEn:e.target.value})}/></Field><Field label={text("Waardering","Rating")}><select className="h-10 w-full rounded-md border bg-background px-3" value={form.rating??""} onChange={e=>setForm({...form,rating:e.target.value?Number(e.target.value):null})}><option value="">{text("Niet tonen","Do not show")}</option>{[5,4,3,2,1].map(v=><option key={v} value={v}>{v}/5</option>)}</select></Field><Field label="Recensie NL" wide><Textarea maxLength={600} rows={5} value={form.quoteNl} onChange={e=>setForm({...form,quoteNl:e.target.value})}/></Field><Field label={text("Recensie EN (optioneel, minimaal 20 tekens)","Testimonial EN (optional, at least 20 characters)")} wide><Textarea minLength={20} maxLength={600} rows={5} value={form.quoteEn} onChange={e=>setForm({...form,quoteEn:e.target.value})}/></Field><div className="sm:col-span-2"><TranslationDraftButtons translating={saving} canTranslateNl={form.quoteNl.trim().length>=2} canTranslateEn={form.quoteEn.trim().length>=2} onTranslate={(direction)=>void translate(direction)}/></div><Field label={text("Volgorde","Position")}><Input type="number" min={0} max={10000} value={form.position} onChange={e=>setForm({...form,position:Number(e.target.value)})}/></Field><label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={form.published} onChange={e=>setForm({...form,published:e.target.checked})}/>{text("Publiceren op homepage","Publish on homepage")}</label><div className="flex gap-2 sm:col-span-2"><Button disabled={saving||form.authorName.trim().length<2||form.quoteNl.trim().length<20||englishInvalid} onClick={()=>void save()}>{saving?text("Opslaan…","Saving…"):text("Opslaan","Save")}</Button>{form.id&&<Button variant="outline" onClick={()=>setForm(empty)}>{text("Annuleren","Cancel")}</Button>}</div></CardContent></Card><Card><CardHeader><CardTitle>{text("Alle recensies","All testimonials")}</CardTitle></CardHeader><CardContent className="space-y-3">{query.isLoading&&<p className="text-sm text-muted-foreground">{text("Laden…","Loading…")}</p>}{!query.isLoading&&!rows.length&&<p className="text-sm text-muted-foreground">{text("Nog geen recensies toegevoegd.","No testimonials added yet.")}</p>}{rows.map((row:any)=><article key={row.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start gap-2"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{row.author_name}</strong>{row.published&&<Badge>{text("Gepubliceerd","Published")}</Badge>}{row.archived_at&&<Badge variant="outline">{text("Gearchiveerd","Archived")}</Badge>}</div><p className="mt-2 text-sm text-muted-foreground">“{row.quote_nl}”</p>{row.rating&&<p className="mt-2 flex gap-0.5 text-amber-500">{Array.from({length:row.rating},(_,i)=><Star key={i} className="size-3.5 fill-current"/>)}</p>}</div><Button size="icon" variant="outline" onClick={()=>edit(row)} aria-label={text("Bewerken","Edit")}><Pencil className="size-4"/></Button><Button size="icon" variant="outline" onClick={()=>void archive(row.id,!row.archived_at)} aria-label={row.archived_at?text("Herstellen","Restore"):text("Archiveren","Archive")}>{row.archived_at?<RotateCcw className="size-4"/>:<Archive className="size-4"/>}</Button></div></article>)}</CardContent></Card></div>;
}
function Field({label,wide=false,children}:{label:string;wide?:boolean;children:React.ReactNode}){return <label className={`space-y-1.5 text-sm ${wide?"sm:col-span-2":""}`}><span>{label}</span>{children}</label>}
