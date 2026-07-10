"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users, UserPlus, Trash2, Mail } from "lucide-react";

type TeamMember = {
    id: string;
    full_name: string;
    role: "sysadmin" | "admin" | "carpenter";
};

export function TeamManager() {
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteName, setInviteName] = useState("");
    const [inviteRole, setInviteRole] = useState("carpenter");
    const [inviting, setInviting] = useState(false);

    const fetchTeam = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/users", { cache: "no-store" });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao carregar");
            const data = await res.json();
            setTeam((data as any[]).map((u) => ({ id: u.id, full_name: u.full_name, role: u.role })) as TeamMember[]);
        } catch (err: any) {
            toast.error("Erro ao carregar a equipe", { description: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeam();
    }, []);

    const roleLabels: Record<string, string> = {
        sysadmin: "Admin Geral",
        admin: "Administrador",
        carpenter: "Marceneiro",
    };

    const roleColors: Record<string, string> = {
        sysadmin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
        admin: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        carpenter: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    };

    const handleInvite = async () => {
        if (!inviteEmail) return;
        try {
            setInviting(true);
            const res = await fetch("/api/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: inviteEmail, fullName: inviteName, role: inviteRole }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Erro desconhecido ao convidar.");

            if (data.setup_url) {
                await navigator.clipboard.writeText(data.setup_url).catch(() => {});
                toast.success("Usuário criado!", {
                    description: `Link de definição de senha copiado. Envie a ${inviteEmail} — vale ${data.expires_in_hours}h e só funciona uma vez.`,
                    duration: 10000,
                });
            } else {
                toast.success("Usuário criado!", { description: `Repasse o acesso a ${inviteEmail}.` });
            }
            setInviteEmail("");
            setInviteName("");
            setInviteRole("carpenter");
            fetchTeam();
        } catch (err: any) {
            toast.error("Erro ao convidar", { description: err.message });
        } finally {
            setInviting(false);
        }
    };

    const handleRemove = async (id: string) => {
        if (!confirm("Remover este usuário da marcenaria? Ele perderá todo o acesso.")) return;

        try {
            const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao remover");

            toast.success("Usuário removido da equipe com sucesso!");
            fetchTeam();
        } catch (err: any) {
            toast.error("Erro ao remover usuário", { description: err.message });
        }
    };

    return (
        <section className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                <h2 className="font-semibold text-lg text-slate-800 dark:text-slate-200">Equipe e Acessos</h2>
            </div>

            {/* Form de Convite */}
            <div className="bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-slate-100 dark:border-zinc-800 space-y-4">
                <h3 className="font-medium text-sm text-slate-700 dark:text-slate-300">Convidar novo membro</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-1">
                        <Label className="text-xs mb-1 block">Nome</Label>
                        <Input placeholder="Nome do João..." value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="md:col-span-1">
                        <Label className="text-xs mb-1 block">E-mail</Label>
                        <Input type="email" placeholder="joao@email.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="md:col-span-1">
                        <Label className="text-xs mb-1 block">Nível de Acesso (Cargo)</Label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="carpenter">Marceneiro</SelectItem>
                                <SelectItem value="admin">Administrador</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="md:col-span-1 flex items-end">
                        <Button onClick={handleInvite} disabled={!inviteEmail || inviting} className="h-8 w-full text-xs bg-indigo-600 hover:bg-indigo-700">
                            {inviting ? "Enviando..." : <><UserPlus className="h-3.5 w-3.5 mr-2" />Convidar</>}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Listagem */}
            <div className="rounded-lg border border-black/5 dark:border-white/5 overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
                        <TableRow>
                            <TableHead className="w-[80px]">Membro</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Cargo</TableHead>
                            <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={4} className="text-center text-slate-400 py-6 text-sm">Carregando...</TableCell></TableRow>
                        ) : team.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center text-slate-400 py-6 text-sm">Nenhum membro encontrado.</TableCell></TableRow>
                        ) : (
                            team.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center">
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                                {user.full_name ? user.full_name[0].toUpperCase() : "M"}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium text-sm">{user.full_name || "Usuário Pendente"}</TableCell>
                                    <TableCell>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleColors[user.role]}`}>
                                            {roleLabels[user.role]}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleRemove(user.id)} className="h-7 w-7 text-slate-400 hover:text-red-500">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}
