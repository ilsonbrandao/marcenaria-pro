"use client";

import { useEffect, useState, useCallback } from "react";
import { useRBAC } from "@/components/rbac-provider";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Share2, Trash2, Search, Eye } from "lucide-react";

interface Budget {
    id: string;
    client_name: string;
    budget_number: string;
    payment_type: string;
    total_prazo: number;
    total_avista: number;
    status: 'draft' | 'sent' | 'approved' | 'rejected';
    created_at: string;
    profiles?: { full_name: string };
}

interface Client { id: string; name: string; address?: string; }

const STATUS_LABELS: Record<string, string> = {
    draft:    "Rascunho",
    sent:     "Enviado",
    approved: "Aprovado",
    rejected: "Rejeitado",
};
const STATUS_COLORS: Record<string, string> = {
    draft:    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    sent:     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    rejected: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300",
};

const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function BudgetsPage() {
    const { isCarpenter, loading } = useRBAC();
    const router = useRouter();

    const [budgets, setBudgets]     = useState<Budget[]>([]);
    const [total, setTotal]         = useState(0);
    const [page, setPage]           = useState(1);
    const [search, setSearch]       = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [fetching, setFetching]   = useState(false);

    // dialog novo orçamento
    const [openNew, setOpenNew]     = useState(false);
    const [clients, setClients]     = useState<Client[]>([]);
    const [creating, setCreating]   = useState(false);
    const [newForm, setNewForm]     = useState({
        client_id: "", client_name: "", client_address: "",
        payment_type: "both",
        prazo_entry_percent: 30, prazo_installments: 12,
        avista_discount_percent: 10, avista_entry_percent: 50,
        observations: "",
    });
    const selectedClient = clients.find(c => c.id === newForm.client_id);

    useEffect(() => {
        if (!loading && isCarpenter) router.replace("/dashboard");
    }, [loading, isCarpenter, router]);

    // Sessão vai por cookie (Auth.js); sem Bearer token.
    const authHeader = async (): Promise<Record<string, string>> => ({});

    const load = useCallback(async () => {
        setFetching(true);
        try {
            const h = await authHeader();
            const params = new URLSearchParams({ page: String(page) });
            if (search) params.set('search', search);
            if (statusFilter !== 'all') params.set('status', statusFilter);
            const res = await fetch(`/api/budgets?${params}`, { headers: h });
            const data = await res.json();
            setBudgets(data.data || []);
            setTotal(data.total || 0);
        } finally {
            setFetching(false);
        }
    }, [page, search, statusFilter]);

    useEffect(() => { if (!isCarpenter) load(); }, [load, isCarpenter]);

    // carrega clientes + padrões de pagamento da org ao abrir o dialog
    useEffect(() => {
        if (!openNew) return;
        fetch('/api/clients', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then((data) => setClients((data || []).map((c: any) => ({ id: c.id, name: c.name, address: c.address }))));
        authHeader().then(h =>
            fetch('/api/settings', { headers: h })
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (data) setNewForm(p => ({
                        ...p,
                        payment_type:            data.default_payment_type              ?? p.payment_type,
                        prazo_entry_percent:     data.default_prazo_entry_percent        ?? p.prazo_entry_percent,
                        prazo_installments:      data.default_prazo_installments         ?? p.prazo_installments,
                        avista_discount_percent: data.default_avista_discount_percent    ?? p.avista_discount_percent,
                        avista_entry_percent:    data.default_avista_entry_percent       ?? p.avista_entry_percent,
                        observations:            data.default_budget_observations        ?? p.observations,
                    }));
                })
        );
    }, [openNew]);

    const handleClientSelect = (clientId: string) => {
        const c = clients.find(c => c.id === clientId);
        setNewForm(p => ({ ...p, client_id: clientId, client_name: c?.name || "", client_address: c?.address || "" }));
    };

    const handleCreate = async () => {
        if (!newForm.client_name.trim()) { toast.error("Selecione ou informe o cliente."); return; }
        setCreating(true);
        try {
            const h = await authHeader();
            const res = await fetch('/api/budgets', {
                method: 'POST',
                headers: { ...h, 'Content-Type': 'application/json' },
                body: JSON.stringify(newForm),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success("Orçamento criado!");
            setOpenNew(false);
            router.push(`/dashboard/budgets/${data.id}?new=true`);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir este orçamento?")) return;
        const h = await authHeader();
        await fetch(`/api/budgets/${id}`, { method: 'DELETE', headers: h });
        toast.success("Orçamento excluído.");
        load();
    };

    const handleShare = async (id: string) => {
        const h = await authHeader();
        const res = await fetch(`/api/budgets/${id}/share`, { headers: h });
        const { public_url } = await res.json();
        await navigator.clipboard.writeText(public_url);
        toast.success("Link copiado para a área de transferência!", { description: public_url });
    };

    const limit = 20;
    const totalPages = Math.ceil(total / limit);

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Orçamentos</h2>
                </div>
                <Button onClick={() => setOpenNew(true)}>
                    <Plus className="h-4 w-4 mr-2" />Novo Orçamento
                </Button>
            </div>

            {/* Filtros */}
            <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input className="pl-9 h-9" placeholder="Buscar por cliente..."
                        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="h-9 w-40">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="sent">Enviado</SelectItem>
                        <SelectItem value="approved">Aprovado</SelectItem>
                        <SelectItem value="rejected">Rejeitado</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Tabela */}
            <div className="rounded-xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden">
                <div className="grid grid-cols-[1fr_6rem_6rem_5.5rem_7rem_6rem] text-[10px] text-slate-400 font-semibold px-4 py-2 border-b bg-slate-50 dark:bg-zinc-950 dark:border-zinc-800">
                    <span>Cliente</span>
                    <span className="text-right">A Prazo</span>
                    <span className="text-right">À Vista</span>
                    <span className="text-center">Status</span>
                    <span>Data</span>
                    <span />
                </div>

                {fetching ? (
                    <p className="text-sm text-slate-400 text-center py-8 animate-pulse">Carregando...</p>
                ) : budgets.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">Nenhum orçamento encontrado.</p>
                ) : (
                    budgets.map(b => (
                        <div key={b.id}
                            className="grid grid-cols-[1fr_6rem_6rem_5.5rem_7rem_6rem] items-center px-4 py-3 border-b last:border-b-0 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer text-sm"
                            onClick={() => router.push(`/dashboard/budgets/${b.id}`)}
                        >
                            <span className="font-medium truncate">{b.client_name}</span>
                            <span className="text-right text-indigo-600 font-semibold">{fmt(b.total_prazo)}</span>
                            <span className="text-right text-emerald-600 font-semibold">{fmt(b.total_avista)}</span>
                            <span className="flex justify-center">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status]}`}>
                                    {STATUS_LABELS[b.status]}
                                </span>
                            </span>
                            <span className="text-xs text-slate-400">
                                {new Date(b.created_at).toLocaleDateString('pt-BR')}
                            </span>
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                <Button size="icon" variant="ghost" className="h-7 w-7" title="Ver"
                                    onClick={() => router.push(`/dashboard/budgets/${b.id}`)}>
                                    <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" title="Compartilhar"
                                    onClick={() => handleShare(b.id)}>
                                    <Share2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600" title="Excluir"
                                    onClick={() => handleDelete(b.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                    <span className="text-sm text-slate-500">{page} / {totalPages}</span>
                    <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                </div>
            )}

            {/* Dialog Novo Orçamento */}
            <Dialog open={openNew} onOpenChange={v => { setOpenNew(v); if (!v) setNewForm(p => ({ ...p, client_id: "", client_name: "", client_address: "" })); }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Novo Orçamento</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Cliente <span className="text-red-500">*</span></Label>
                            <Select value={newForm.client_id} onValueChange={handleClientSelect}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um cliente..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {newForm.client_id && (
                            <div className="space-y-1">
                                <Label className="text-slate-500">Endereço</Label>
                                <p className="text-sm px-3 py-2 rounded-md border bg-slate-50 dark:bg-zinc-800 dark:border-zinc-700 text-slate-500">
                                    {selectedClient?.address || <span className="italic text-slate-400">Não cadastrado</span>}
                                </p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
                        <Button onClick={handleCreate} disabled={creating || !newForm.client_id}>
                            {creating ? "Criando..." : "Criar Orçamento"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
