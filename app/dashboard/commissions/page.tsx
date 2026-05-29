"use client";

import { useEffect, useState } from "react";
import { useRBAC } from "@/components/rbac-provider";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BadgeDollarSign, CheckCircle2, Clock, XCircle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface Commission {
    id: string;
    sale_id: string;
    profile_id: string;
    commission_type: "seller" | "carpenter" | "architect_rt";
    base_amount: number;
    percent: number;
    amount: number;
    status: "pending" | "paid" | "cancelled";
    paid_at: string | null;
    notes: string | null;
    created_at: string;
    profiles: { full_name: string; role: string };
    sales: { client_name: string; total_value: number };
}

const STATUS_LABELS: Record<string, string> = { pending: "Pendente", paid: "Pago", cancelled: "Cancelado" };
const TYPE_LABELS: Record<string, string> = { seller: "Vendedor", carpenter: "Marceneiro", architect_rt: "RT Arquiteto" };
const STATUS_COLORS: Record<string, string> = {
    pending:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    paid:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// Gera lista dos últimos 12 meses no formato { value: "2026-03", label: "Março 2026" }
function buildMonthOptions() {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return opts;
}
const MONTH_OPTIONS = buildMonthOptions();

export default function CommissionsPage() {
    const { canViewCommissions, canViewFinance, isSeller, isCarpenter, profile, loading } = useRBAC();
    const router = useRouter();
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [statusFilter, setStatusFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [monthFilter, setMonthFilter] = useState("all");
    const [loadingData, setLoadingData] = useState(true);

    const load = async () => {
        setLoadingData(true);
        const qs = new URLSearchParams({ status: statusFilter, type: typeFilter, month: monthFilter });
        const res = await fetch(`/api/commissions?${qs}`, { cache: "no-store" });
        if (!res.ok) toast.error((await res.json().catch(() => ({}))).error || "Falha ao carregar");
        else setCommissions((await res.json()) || []);
        setLoadingData(false);
    };

    useEffect(() => { if (!loading && canViewCommissions) load(); }, [loading, canViewCommissions, statusFilter, typeFilter, monthFilter]);

    const markPaid = async (id: string) => {
        const res = await fetch("/api/commissions", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });
        if (!res.ok) toast.error((await res.json().catch(() => ({}))).error || "Falha");
        else { toast.success("Comissão marcada como paga."); load(); }
    };

    const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const totals = commissions.reduce((acc, c) => {
        acc.total += c.amount;
        if (c.status === "pending") acc.pending += c.amount;
        if (c.status === "paid") acc.paid += c.amount;
        return acc;
    }, { total: 0, pending: 0, paid: 0 });

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Comissões</h2>
                <p className="text-sm text-slate-500">
                    {canViewFinance ? "Gestão de comissões por projeto" : "Suas comissões"}
                </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
                <KpiCard label="Total" value={fmt(totals.total)} icon={BadgeDollarSign} className="text-indigo-600" />
                <KpiCard label="Pendente" value={fmt(totals.pending)} icon={Clock} className="text-amber-600" />
                <KpiCard label="Pago" value={fmt(totals.paid)} icon={CheckCircle2} className="text-emerald-600" />
            </div>

            {/* Filtros */}
            <div className="flex gap-3 flex-wrap">
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="Todos os meses" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os meses</SelectItem>
                        {MONTH_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                </Select>
                {canViewFinance && (
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os tipos</SelectItem>
                            <SelectItem value="seller">Vendedor</SelectItem>
                            <SelectItem value="carpenter">Marceneiro</SelectItem>
                            <SelectItem value="architect_rt">RT Arquiteto</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* Lista */}
            <div className="space-y-3">
                {loadingData && <p className="text-slate-400 text-sm">Carregando...</p>}
                {!loadingData && commissions.length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                        <BadgeDollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhuma comissão encontrada.</p>
                    </div>
                )}
                {commissions.map(c => (
                    <Card
                        key={c.id}
                        className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
                        onClick={() => router.push(`/dashboard?sale=${c.sale_id}`)}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        {canViewFinance && (
                                            <p className="font-semibold text-sm">{c.profiles?.full_name}</p>
                                        )}
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400">
                                            {TYPE_LABELS[c.commission_type]}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
                                            {STATUS_LABELS[c.status]}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Projeto: <strong>{c.sales?.client_name}</strong>
                                        {canViewFinance && <> · Base: {fmt(c.base_amount)} · {c.percent}%</>}
                                    </p>
                                    {c.paid_at && <p className="text-xs text-emerald-600 mt-0.5">Pago em {new Date(c.paid_at).toLocaleDateString("pt-BR")}</p>}
                                    {c.notes && <p className="text-xs text-slate-400 mt-1">{c.notes}</p>}
                                </div>
                                <div className="text-right shrink-0 flex flex-col items-end gap-2">
                                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{fmt(c.amount)}</p>
                                    {canViewFinance && c.status === "pending" ? (
                                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={e => { e.stopPropagation(); markPaid(c.id); }}>
                                            <CheckCircle2 className="mr-1 h-3 w-3" />Marcar Pago
                                        </Button>
                                    ) : (
                                        <ArrowRight className="h-4 w-4 text-slate-300 dark:text-zinc-600" />
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function KpiCard({ label, value, icon: Icon, className }: { label: string; value: string; icon: any; className?: string }) {
    return (
        <Card>
            <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`h-8 w-8 shrink-0 ${className}`} />
                <div>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}
