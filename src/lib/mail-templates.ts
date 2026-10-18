import { mailLocale } from "./mail-locale.ts";
export type MailJob={locale:string;templateKey:string;payload:{title?:string;body?:string;tripId?:string|null;actionUrl?:string}};

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]!);
const localized=(value:string|undefined,en:boolean,fallback:string)=>{const parts=(value??fallback).split(" / ");return (en?parts[1]:parts[0])??parts[0]};
const sameOrigin=(value:string|undefined,origin:string)=>{try{return Boolean(value)&&new URL(value!).origin===origin}catch{return false}};

export function renderMail(job:MailJob,baseUrl:string){
  const locale=mailLocale(job.locale),en=locale==="en",origin=new URL(baseUrl).origin;
  const title=job.templateKey==="content_report" ? (job.payload.title ?? "GlobeTrotr") : localized(job.payload.title,en,en?"GlobeTrotr update":"GlobeTrotr-update");
  const plainBody=job.templateKey==="content_report" ? (job.payload.body ?? "") : localized(job.payload.body,en,"").replaceAll("|"," · ");
  const requestedAction=job.payload.actionUrl;
  const actionUrl=sameOrigin(requestedAction,origin)?requestedAction!:job.payload.tripId?`${origin}/trips/${encodeURIComponent(job.payload.tripId)}`:origin;
  const actionLabel=job.templateKey==="invitation"?(en?"View invitation":"Uitnodiging bekijken"):"Open GlobeTrotr";
  const serviceNote=en?"This is a service message from GlobeTrotr.":"Dit is een servicemelding van GlobeTrotr.";
  const html=`<!doctype html><html lang="${locale}"><body style="margin:0;padding:0;background:#f4f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#102039"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f6"><tr><td align="center" style="padding:40px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e4ebe8;border-radius:18px;overflow:hidden"><tr><td align="center" style="padding:36px 40px 24px"><img src="${origin}/assets/email/logo.png" width="56" height="56" alt="GlobeTrotr"><div style="margin-top:13px;font-size:22px;font-weight:700">GlobeTrotr</div><div style="margin-top:5px;font-size:13px;color:#748078">Plan every trip. Track every euro.</div></td></tr><tr><td style="padding:36px 40px 40px;border-top:1px solid #edf1ef"><h1 style="margin:0 0 18px;font-size:27px">${escapeHtml(title)}</h1><p style="margin:0 0 28px;font-size:16px;line-height:25px;color:#52606b;white-space:pre-line">${escapeHtml(plainBody)}</p><table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#168b78" style="border-radius:10px"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:15px 26px;color:#fff;text-decoration:none;font-weight:600">${actionLabel}</a></td></tr></table><p style="margin:24px 0 0;font-size:13px;color:#77827c"><a href="${origin}/contact" style="color:#168b78;text-decoration:none;font-weight:600">${en?"Contact GlobeTrotr":"Contact met GlobeTrotr"}</a></p></td></tr><tr><td align="center" style="padding:24px;background:#fafcfb;border-top:1px solid #edf1ef;font-size:11px;color:#99a39e">GlobeTrotr · Plan every trip. Track every euro.</td></tr></table></td></tr></table></body></html>`;
  return{subject:title,text:`${title}\n\n${plainBody}\n\n${actionUrl}\n\n${serviceNote}`,html};
}
