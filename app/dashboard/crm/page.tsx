"use client";

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, Phone, Mail, MapPin, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { DataPagination } from "@/components/ui/data-pagination";
import { useRBAC } from "@/components/rbac-provider";

type Client = {
    id: string;
    name: string;
    cpf: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    created_at: string;
};

type Budget = {
    id: string;
    budget_number: string | null;
    created_at: string;
    status: string;
    total_prazo: number;
    total_avista: number;
};

type Sale = {
    id: string;
    created_at: string;
    status: string;
    total_value: number | null;
};

const BUDGET_STATUS: Record<string, { label: string; className: string }> = {
    draft:    { label: "Rascunho", className: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-400" },
    sent:     { label: "Enviado",  className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    approved: { label: "Aprovado", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    rejected: { label: "Recusado", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

function formatBRL(value: number | null) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("pt-BR");
}

function ClientHistory({ clientId }: { clientId: string }) {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/clients/${clientId}/history`, { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : { budgets: [], sales: [] }))
            .then((json) => {
                setBudgets((json.budgets as Budget[]) || []);
                setSales((json.sales as Sale[]) || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [clientId]);

    if (loading) {
        return (
            <div className="p-4 text-xs text-slate-400 animate-pulse">
                Carregando histórico...
            </div>
        );
    }

    return (
        <div className="p-4 bg-slate-50 dark:bg-zinc-900/50 border-t border-black/5 dark:border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Orçamentos */}
            <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Orçamentos ({budgets.length})
                </p>
                {budgets.length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhum orçamento vinculado.</p>
                ) : (
                    <div className="space-y-1.5">
                        {budgets.map((b) => {
                            const st = BUDGET_STATUS[b.status] ?? BUDGET_STATUS.draft;
                            return (
                                <div
                                    key={b.id}
                                    className="flex items-center justify-between gap-3 text-xs bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 border border-black/5 dark:border-white/5"
                                >
                                    <span className="text-slate-400 shrink-0">{formatDate(b.created_at)}</span>
                                    {b.budget_number && (
                                        <span className="text-slate-500 font-mono truncate">#{b.budget_number}</span>
                                    )}
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${st.className}`}>
                                        {st.label}
                                    </span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                                        {formatBRL(b.total_prazo || b.total_avista)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Vendas */}
            <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Vendas / Projetos ({sales.length})
                </p>
                {sales.length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhuma venda vinculada.</p>
                ) : (
                    <div className="space-y-1.5">
                        {sales.map((s) => (
                            <div
                                key={s.id}
                                className="flex items-center justify-between gap-3 text-xs bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 border border-black/5 dark:border-white/5"
                            >
                                <span className="text-slate-400 shrink-0">{formatDate(s.created_at)}</span>
                                <span className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full text-[10px] font-semibold truncate">
                                    {s.status}
                                </span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                                    {formatBRL(s.total_value)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ClientesPage() {
    const { isCarpenter } = useRBAC();

    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    const [dialogOpen, setDialogOpen] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const [name, setName]       = useState("");
    const [cpf, setCpf]         = useState("");
    const [phone, setPhone]     = useState("");
    const [email, setEmail]     = useState("");
    const [address, setAddress] = useState("");
    const [notes, setNotes]     = useState("");

    const fetchClients = useCallback(async () => {
        setLoading(true);
        const res = await fetch("/api/clients", { cache: "no-store" });
        if (!res.ok) toast.error("Erro ao carregar clientes", { description: (await res.json().catch(() => ({}))).error });
        else setClients((await res.json()) as Client[]);
        setLoading(false);
    }, []);

    useEffect(() => { fetchClients(); }, [fetchClients]);

    const openNew = () => {
        setEditingClient(null);
        setName(""); setCpf(""); setPhone(""); setEmail(""); setAddress(""); setNotes("");
        setDialogOpen(true);
    };

    const openEdit = (client: Client, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingClient(client);
        setName(client.name);
        setCpf(client.cpf || "");
        setPhone(client.phone || "");
        setEmail(client.email || "");
        setAddress(client.address || "");
        setNotes(client.notes || "");
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        try {
            setFormLoading(true);
            const payload = {
                name:    name.trim(),
                cpf:     cpf.trim()     || null,
                phone:   phone.trim()   || null,
                email:   email.trim()   || null,
                address: address.trim() || null,
                notes:   notes.trim()   || null,
            };

            if (editingClient) {
                const res = await fetch("/api/clients", {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...payload, id: editingClient.id }),
                });
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha");
                toast.success("Cliente atualizado!");
            } else {
                const res = await fetch("/api/clients", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha");
                toast.success("Cliente cadastrado!");
            }

            setDialogOpen(false);
            fetchClients();
        } catch (err: any) {
            toast.error("Erro", { description: err.message });
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Deseja excluir esse cliente?")) return;
        const res = await fetch(`/api/clients?id=${id}`, { method: "DELETE" });
        if (!res.ok) { toast.error("Erro ao excluir", { description: (await res.json().catch(() => ({}))).error }); return; }
        toast.success("Cliente excluído");
        if (expandedId === id) setExpandedId(null);
        fetchClients();
    };

    const toggleExpand = (id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    };

    const filtered = clients.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.cpf || "").includes(search) ||
        (c.phone || "").includes(search) ||
        (c.email || "").toLowerCase().includes(search.toLowerCase())
    );
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    if (isCarpenter) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                Você não tem permissão para acessar esta página.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Clientes</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Clique em um cliente para ver o histórico de orçamentos e vendas
                    </p>
                </div>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={openNew}>
                    <Plus className="h-4 w-4 mr-2" /> Novo Cliente
                </Button>
            </header>

            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-black/5 dark:border-white/5 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                    <span className="font-semibold text-slate-600 dark:text-slate-400 text-sm">
                        {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
                    </span>
                    <div className="relative max-w-xs w-full">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por nome, CPF, telefone..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-slate-400 animate-pulse">Carregando...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">Nenhum cliente encontrado.</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cliente</TableHead>
                                <TableHead>CPF</TableHead>
                                <TableHead>Contato</TableHead>
                                <TableHead>Endereço</TableHead>
                                <TableHead className="text-right w-28">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginated.map((client) => (
                                <React.Fragment key={client.id}>
                                    <TableRow
                                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900/40"
                                        onClick={() => toggleExpand(client.id)}
                                    >
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                                                    <span className="text-sm font-bold text-violet-700 dark:text-violet-400">
                                                        {client.name.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm text-slate-900 dark:text-slate-100 leading-tight">
                                                        {client.name}
                                                    </p>
                                                    {client.notes && (
                                                        <p className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                                            {client.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {client.cpf
                                                ? <span className="text-xs text-slate-500 font-mono">{client.cpf}</span>
                                                : <span className="text-xs text-slate-300">—</span>}
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-0.5">
                                                {client.phone && (
                                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                                        <Phone className="h-3 w-3" /> {client.phone}
                                                    </div>
                                                )}
                                                {client.email && (
                                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                                        <Mail className="h-3 w-3" /> {client.email}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {client.address ? (
                                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                                    <MapPin className="h-3 w-3 shrink-0" />
                                                    <span className="truncate max-w-[160px]">{client.address}</span>
                                                </div>
                                            ) : <span className="text-xs text-slate-300">—</span>}
                                        </TableCell>
                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-violet-600"
                                                    onClick={() => toggleExpand(client.id)}
                                                    title="Ver histórico"
                                                >
                                                    {expandedId === client.id
                                                        ? <ChevronUp className="h-3.5 w-3.5" />
                                                        : <ChevronDown className="h-3.5 w-3.5" />}
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                                                    onClick={(e) => openEdit(client, e)}
                                                    title="Editar"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                                                    onClick={(e) => handleDelete(client.id, e)}
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>

                                    {expandedId === client.id && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="p-0">
                                                <ClientHistory clientId={client.id} />
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                )}

                <DataPagination
                    page={page}
                    pageSize={PAGE_SIZE}
                    total={filtered.length}
                    onPageChange={setPage}
                />
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingClient ? "Editar Cliente" : "Cadastrar Cliente"}</DialogTitle>
                        <DialogDescription>Preencha os dados do cliente.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome Completo *</Label>
                            <Input
                                placeholder="Ex: Maria da Silva"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>CPF</Label>
                                <Input
                                    placeholder="000.000.000-00"
                                    value={cpf}
                                    onChange={(e) => setCpf(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Telefone</Label>
                                <Input
                                    placeholder="(00) 00000-0000"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>E-mail</Label>
                            <Input
                                placeholder="email@exemplo.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Endereço</Label>
                            <Input
                                placeholder="Rua, número, bairro, cidade"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Observações</Label>
                            <Input
                                placeholder="Ex: Cliente indicou vizinha"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={formLoading || !name.trim()}>
                            {formLoading ? "Salvando..." : editingClient ? "Salvar" : "Cadastrar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
