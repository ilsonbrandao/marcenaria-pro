"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Ruler, Phone, Mail, Pencil, Trash2, Percent, Search } from "lucide-react";
import { DataPagination } from "@/components/ui/data-pagination";

type Architect = {
    id: string;
    name: string;
    phone: string;
    email: string;
    default_rt_percent: number;
    notes: string;
    created_at: string;
};

export default function ArchitectsPage() {
    const [architects, setArchitects] = useState<Architect[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [editing, setEditing] = useState<Architect | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    // Dados de vendas vinculadas
    const [salesData, setSalesData] = useState<Record<string, { count: number; totalRT: number }>>({});

    // Form
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [rtPercent, setRtPercent] = useState("5");
    const [notes, setNotes] = useState("");

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/architects", { cache: "no-store" });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao carregar");
            const json = await res.json();
            setArchitects(json.architects as Architect[]);
            setSalesData(json.salesData || {});
        } catch (err: any) {
            toast.error("Erro ao carregar arquitetos", { description: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const openEdit = (a: Architect) => {
        setEditing(a);
        setName(a.name);
        setPhone(a.phone || "");
        setEmail(a.email || "");
        setRtPercent(String(a.default_rt_percent));
        setNotes(a.notes || "");
        setDialogOpen(true);
    };

    const resetForm = () => {
        setEditing(null);
        setName(""); setPhone(""); setEmail(""); setRtPercent("5"); setNotes("");
    };

    const handleSave = async () => {
        try {
            setFormLoading(true);
            const payload = {
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim(),
                default_rt_percent: parseFloat(rtPercent) || 5,
                notes: notes.trim(),
            };

            if (editing) {
                const res = await fetch("/api/architects", {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...payload, id: editing.id }),
                });
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha");
                toast.success("Arquiteto atualizado!");
            } else {
                const res = await fetch("/api/architects", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha");
                toast.success("Arquiteto cadastrado!");
            }
            setDialogOpen(false);
            resetForm();
            fetchData();
        } catch (err: any) {
            toast.error("Erro", { description: err.message });
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Deseja excluir este arquiteto?")) return;
        const res = await fetch(`/api/architects?id=${id}`, { method: "DELETE" });
        if (!res.ok) { toast.error("Erro ao excluir"); return; }
        toast.success("Arquiteto excluído");
        fetchData();
    };

    const formatBRL = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

    const totalRT = Object.values(salesData).reduce((s, d) => s + d.totalRT, 0);
    const totalIndicacoes = Object.values(salesData).reduce((s, d) => s + d.count, 0);

    const filtered = architects.filter((a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        (a.phone || "").includes(search) ||
        (a.email || "").toLowerCase().includes(search.toLowerCase())
    );
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Arquitetos Parceiros</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Controle de indicações e Reserva Técnica (RT) a pagar</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Plus className="h-4 w-4 mr-2" /> Novo Arquiteto
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editing ? "Editar Arquiteto" : "Cadastrar Arquiteto"}</DialogTitle>
                            <DialogDescription>Dados do profissional e seu percentual padrão de RT.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>Nome Completo</Label>
                                <Input placeholder="Ex: Arq. Ana Beatriz" value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Telefone</Label>
                                    <Input placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>E-mail</Label>
                                    <Input placeholder="arq@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>RT Padrão (%)</Label>
                                <div className="relative">
                                    <Input type="number" value={rtPercent} onChange={(e) => setRtPercent(e.target.value)} className="pr-8" />
                                    <span className="absolute right-3 top-2.5 text-xs text-slate-400">%</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Observações</Label>
                                <Input placeholder="Ex: Parceiro desde 2023" value={notes} onChange={(e) => setNotes(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
                            <Button onClick={handleSave} disabled={formLoading || !name}>
                                {formLoading ? "Salvando..." : editing ? "Salvar" : "Cadastrar"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg"><Ruler className="h-4 w-4 text-indigo-600" /></div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Arquitetos Cadastrados</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{architects.length}</p>
                </div>
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg"><Ruler className="h-4 w-4 text-amber-600" /></div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Total de Indicações</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-600">{totalIndicacoes}</p>
                </div>
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg"><Percent className="h-4 w-4 text-red-600" /></div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">RT Total a Pagar</span>
                    </div>
                    <p className="text-2xl font-bold text-red-500">{formatBRL(totalRT)}</p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-black/5 dark:border-white/5 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">Arquitetos e Indicações</h3>
                    <div className="relative max-w-xs w-full">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input placeholder="Buscar por nome, telefone ou e-mail..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                    </div>
                </div>
                {loading ? (
                    <div className="p-8 text-center text-slate-400 animate-pulse">Carregando...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">{architects.length === 0 ? 'Nenhum arquiteto cadastrado. Clique em "Novo Arquiteto".' : "Nenhum arquiteto encontrado."}</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Arquiteto</TableHead>
                                <TableHead>Contato</TableHead>
                                <TableHead className="text-center">RT Padrão</TableHead>
                                <TableHead className="text-center">Indicações</TableHead>
                                <TableHead className="text-right">RT a Receber</TableHead>
                                <TableHead className="text-right w-24">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginated.map((a) => {
                                const stats = salesData[a.id] || { count: 0, totalRT: 0 };
                                return (
                                    <TableRow key={a.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                                                    <Ruler className="h-4 w-4 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{a.name}</p>
                                                    {a.notes && <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{a.notes}</p>}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                {a.phone && (
                                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                                        <Phone className="h-3 w-3" /> {a.phone}
                                                    </div>
                                                )}
                                                {a.email && (
                                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                                        <Mail className="h-3 w-3" /> {a.email}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 text-xs font-bold px-2 py-1 rounded-md">
                                                {a.default_rt_percent}%
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center font-semibold">{stats.count}</TableCell>
                                        <TableCell className="text-right font-semibold text-red-500">{formatBRL(stats.totalRT)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => openEdit(a)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => handleDelete(a.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
                <DataPagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
            </div>
        </div>
    );
}
