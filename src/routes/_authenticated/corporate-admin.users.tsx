import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCorporateAdminData } from "@/lib/issues.functions";
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/_authenticated/corporate-admin/users")({ component: UsersPage });

function UsersPage() {
  const { text } = useLocale();
  const query = useQuery({ queryKey: ["corporate-admin-data"], queryFn: () => getCorporateAdminData() });
  const [search, setSearch] = useState("");
  const [all, setAll] = useState(false);
  const users = (query.data?.users ?? []).filter((user: any) => `${user.displayName} ${user.email}`.toLowerCase().includes(search.toLowerCase()));

  return <Card><CardHeader><CardTitle>{text("Gebruikers", "Users")}</CardTitle></CardHeader><CardContent className="space-y-4">
    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text("Zoek op naam of e-mailadres…", "Search by name or email…")} />
    {users.slice(0, all ? users.length : 8).map((user: any) => <div key={user.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center gap-2">
      <div className="min-w-0 flex-1"><strong className="block truncate">{user.displayName || text("Naamloos account", "Unnamed account")}</strong><span className="block truncate text-xs text-muted-foreground">{user.email}</span></div>
      <Badge variant="outline">{user.plan}</Badge><Badge variant={user.emailConfirmed ? "secondary" : "outline"}>{user.emailConfirmed ? text("Bevestigd", "Confirmed") : text("Onbevestigd", "Unconfirmed")}</Badge>
      <Button size="sm" variant="outline" asChild><Link to="/corporate-admin/user/$userId" params={{ userId: user.id }}><Eye className="size-4" />{text("Bekijken en bewerken", "View and edit")}</Link></Button>
    </div></div>)}
    {users.length > 8 && <Button variant="outline" onClick={() => setAll((value) => !value)}>{all ? text("Minder tonen", "Show less") : text(`Alle ${users.length} tonen`, `Show all ${users.length}`)}</Button>}
  </CardContent></Card>;
}
