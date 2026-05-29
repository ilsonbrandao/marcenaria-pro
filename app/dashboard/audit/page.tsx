"use client";

import { useEffect, useState } from "react";
import { useRBAC } from "@/components/rbac-provider";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Search, ChevronDown, ChevronRight } from "lucide-react";

interface AuditLog {
    id: string;
    table_name: string;
    record_id: string;
    action: "INSERT" | "UPDATE" | "DELETE";
    old_data: Record<string, any> | null;
    new_data: Record<string, any> | null;
    created_at: string;
    profiles: { full_name: string } | null;
}

const ACTION_COLORS = {
    INSERT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    UPDATE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const TABLE_LABELS: Record<string, string> = {
    sales: "Projetos",
    profiles: "Usuários",
    expenses: "Despesas",
    inventory: "Estoque",
    commissions: "Comissões",
    purchases: "Compras",
};

export default function AuditPage() {
    const { canViewAudit, loading } = useRBAC();
    const router = useRouter();

    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [search, setSearch] = useState("");
    const [tableFilter, setTableFilter] = useState("all");
    const [actionFilter, setActionFilter] = useState("all");
    const [expanded, setExpanded] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 30;

    useEffect(() => { if (!loading && !canViewAudit) router.replace("/dashboard"); }, [loading, canViewAudit, router]);

    const load = async (p = 0) => {
        setLoadingData(true);
        const qs = new URLSearchParams({ table: tableFilter, action: actionFilter, page: String(p) });
        const res = await fetch(`/api/audit?${qs}`, { cache: "no-store" });
        if (!res.ok) toast.error((await res.json().catch(() => ({}))).error || "Falha ao carregar");
        else setLogs((await res.json()) || []);
        setLoadingData(false);
    };

    useEffect(() => { if (!loading && canViewAudit) load(page); }, [loading, canViewAudit, tableFilter, actionFilter, page]);

    const fmt = (d: string) => new Date(d).toLocaleString("pt-BR");

    const filteredLogs = search
        ? logs.filter(l =>
            l.table_name.includes(search.toLowerCase()) ||
            l.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            l.record_id?.includes(search)
        )
        : logs;

    const renderDiff = (log: AuditLog) => {
        if (log.action === "INSERT" && log.new_data) {
            return (
                <div className="mt-3 text-xs bg-slate-50 dark:bg-zinc-900 rounded-lg p-3 max-h-60 overflow-y-auto">
                    <pre className="text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap break-all">
                        + {JSON.stringify(log.new_data, null, 2)}
                    </pre>
                </div>
            );
        }
        if (log.action === "DELETE" && log.old_data) {
            return (
                <div className="mt-3 text-xs bg-slate-50 dark:bg-zinc-900 rounded-lg p-3 max-h-60 overflow-y-auto">
                    <pre className="text-red-700 dark:text-red-400 whitespace-pre-wrap break-all">
                        - {JSON.stringify(log.old_data, null, 2)}
                    </pre>
                </div>
            );
        }
        if (log.action === "UPDATE" && log.old_data && log.new_data) {
            const changed = Object.keys(log.new_data).filter(k =>
                JSON.stringify(log.old_data![k]) !== JSON.stringify(log.new_data![k])
            );
            return (
                <div className="mt-3 text-xs bg-slate-50 dark:bg-zinc-900 rounded-lg p-3 max-h-60 overflow-y-auto space-y-1.5">
                    {changed.map(k => (
                        <div key={k} className="grid grid-cols-[auto_1fr_1fr] gap-2 items-start">
                            <span className="font-mono text-slate-500 truncate">{k}:</span>
                            <span className="text-red-600 dark:text-red-400 line-through truncate">
                                {JSON.stringify(log.old_data![k])}
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400 truncate">
                                {JSON.stringify(log.new_data![k])}
                            </span>
                        </div>
                    ))}
                    {changed.length === 0 && <span className="text-slate-400">Nenhum campo alterado (possível metadado).</span>}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Log de Auditoria</h2>
                <p className="text-sm text-slate-500">Registro completo de todas as alterações no sistema.</p>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input className="pl-9" placeholder="Buscar por usuário, tabela ou ID..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select value={tableFilter} onValueChange={v => { setTableFilter(v); setPage(0); }}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas as tabelas</SelectItem>
                        {Object.entries(TABLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas as ações</SelectItem>
                        <SelectItem value="INSERT">Criação</SelectItem>
                        <SelectItem value="UPDATE">Edição</SelectItem>
                        <SelectItem value="DELETE">Exclusão</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Logs */}
            <div className="space-y-2">
                {loadingData && <p className="text-slate-400 text-sm">Carregando logs...</p>}
                {!loadingData && filteredLogs.length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                        <ShieldAlert className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhum log encontrado.</p>
                    </div>
                )}
                {filteredLogs.map(log => (
                    <Card key={log.id} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action]}`}>
                                    {log.action}
                                </span>
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    {TABLE_LABELS[log.table_name] ?? log.table_name}
                                </span>
                                <span className="text-xs text-slate-500 flex-1">
                                    por <strong>{log.profiles?.full_name ?? "Sistema"}</strong>
                                    {" · "}{fmt(log.created_at)}
                                </span>
                                <span className="text-xs font-mono text-slate-300 dark:text-zinc-600 hidden md:block truncate max-w-[120px]">
                                    {log.record_id?.slice(0, 8)}...
                                </span>
                                {expanded === log.id ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                            </div>
                            {expanded === log.id && renderDiff(log)}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Paginação */}
            <div className="flex items-center justify-center gap-3">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <span className="text-sm text-slate-500">Página {page + 1}</span>
                <Button variant="outline" size="sm" disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
        </div>
    );
}
