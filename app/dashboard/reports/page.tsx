"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileText, TrendingUp, TrendingDown, DollarSign, BarChart3, CalendarDays, X } from "lucide-react";
import { generateContractPDF } from "@/lib/generate-contract-pdf";

type SaleReport = {
    id: string;
    client_name: string;
    status: string;
    total_value: number;
    received_value: number;
    raw_material_cost: number;
    freight_cost: number;
    commission_carpenter_percent: number;
    commission_seller_percent: number;
    rt_architect_percent: number;
    created_at: string;
};

type ExpenseMap = Record<string, number>;

function getDefaultDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    return { from: fmt(firstDay), to: fmt(today) };
}

export default function ReportsPage() {
    const defaults = getDefaultDates();

    const [sales, setSales] = useState<SaleReport[]>([]);
    const [expenses, setExpenses] = useState<ExpenseMap>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [dateFrom, setDateFrom] = useState(defaults.from);
    const [dateTo, setDateTo] = useState(defaults.to);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/reports?from=${dateFrom}&to=${dateTo}`, { cache: "no-store" });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao carregar");
            const json = await res.json();
            setSales(json.sales as SaleReport[]);
            setExpenses(json.expenses as ExpenseMap);
        } catch (err: any) {
            toast.error("Erro ao carregar relatórios", { description: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [dateFrom, dateTo]);

    const resetFilters = () => {
        const d = getDefaultDates();
        setDateFrom(d.from);
        setDateTo(d.to);
    };

    const formatBRL = (v: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

    const calcProfit = (s: SaleReport) => {
        const directExpenses = expenses[s.id] || 0;
        const costs = (s.raw_material_cost || 0) + (s.freight_cost || 0) + directExpenses;
        const comms = (s.total_value * ((s.commission_seller_percent || 0) + (s.commission_carpenter_percent || 0) + (s.rt_architect_percent || 0))) / 100;
        return s.total_value - costs - comms;
    };

    const calcMargin = (s: SaleReport) => {
        if (s.total_value <= 0) return 0;
        return (calcProfit(s) / s.total_value) * 100;
    };

    const filtered = sales.filter((s) => {
        const matchSearch = s.client_name.toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === "all" || s.status === filterStatus;
        return matchSearch && matchStatus;
    });

    // KPIs
    const totalRevenue = filtered.reduce((s, p) => s + p.total_value, 0);
    const totalReceived = filtered.reduce((s, p) => s + (p.received_value || 0), 0);
    const totalProfit = filtered.reduce((s, p) => s + calcProfit(p), 0);
    const avgMargin = filtered.length > 0
        ? filtered.reduce((s, p) => s + calcMargin(p), 0) / filtered.length
        : 0;
    const concluidos = filtered.filter((s) => s.status === "Concluído");
    const totalProfitConcluidos = concluidos.reduce((s, p) => s + calcProfit(p), 0);

    const statusOptions = ["all", "Orçamento", "Produção", "Montagem", "Concluído"];

    const handleExportCSV = () => {
        const headers = ["Projeto", "Status", "Valor", "Recebido", "Custos", "Comissões", "Lucro", "Margem (%)"];
        const rows = filtered.map((s) => {
            const directExp = expenses[s.id] || 0;
            const costs = (s.raw_material_cost || 0) + (s.freight_cost || 0) + directExp;
            const comms = (s.total_value * ((s.commission_seller_percent || 0) + (s.commission_carpenter_percent || 0) + (s.rt_architect_percent || 0))) / 100;
            const profit = calcProfit(s);
            const margin = calcMargin(s);
            return [
                `"${s.client_name}"`,
                `"${s.status}"`,
                s.total_value.toFixed(2),
                (s.received_value || 0).toFixed(2),
                costs.toFixed(2),
                comms.toFixed(2),
                profit.toFixed(2),
                margin.toFixed(1),
            ].join(",");
        });
        const csv = [headers.join(","), ...rows].join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `relatorio_${dateFrom}_${dateTo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-6">
            <header>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Relatórios / DRE</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                    Demonstrativo de Resultado por projeto — Lucro real vs estimado
                </p>
            </header>

            {/* Date Range Filter */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <CalendarDays className="h-4 w-4 text-indigo-500" />
                        <span className="text-sm font-medium">Período</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">De</span>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="h-8 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:bg-zinc-900 dark:border-zinc-700 dark:text-slate-200"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Até</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="h-8 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:bg-zinc-900 dark:border-zinc-700 dark:text-slate-200"
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={resetFilters}
                            className="h-8 px-3 text-xs gap-1.5"
                        >
                            <X className="h-3 w-3" />
                            Limpar Filtros
                        </Button>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"><DollarSign className="h-4 w-4 text-blue-600" /></div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Receita Total</span>
                    </div>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatBRL(totalRevenue)}</p>
                </div>
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg"><TrendingUp className="h-4 w-4 text-emerald-600" /></div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Recebido</span>
                    </div>
                    <p className="text-xl font-bold text-emerald-600">{formatBRL(totalReceived)}</p>
                </div>
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg"><DollarSign className="h-4 w-4 text-amber-600" /></div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">A Receber</span>
                    </div>
                    <p className="text-xl font-bold text-amber-600">{formatBRL(totalRevenue - totalReceived)}</p>
                </div>
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg"><BarChart3 className="h-4 w-4 text-violet-600" /></div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Lucro Estimado</span>
                    </div>
                    <p className={`text-xl font-bold ${totalProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatBRL(totalProfit)}</p>
                </div>
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg"><TrendingUp className="h-4 w-4 text-indigo-600" /></div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Margem Média</span>
                    </div>
                    <p className="text-xl font-bold text-indigo-600">{avgMargin.toFixed(1)}%</p>
                </div>
            </div>

            {/* Card Resumo DRE Concluídos */}
            {concluidos.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 rounded-xl border border-emerald-200 dark:border-emerald-900/30 p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                        <h3 className="font-bold text-emerald-800 dark:text-emerald-400">DRE — Projetos Concluídos</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3">
                        <div>
                            <p className="text-xs text-emerald-600">Projetos Finalizados</p>
                            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{concluidos.length}</p>
                        </div>
                        <div>
                            <p className="text-xs text-emerald-600">Receita Concluída</p>
                            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatBRL(concluidos.reduce((s, p) => s + p.total_value, 0))}</p>
                        </div>
                        <div>
                            <p className="text-xs text-emerald-600">Lucro Real Acumulado</p>
                            <p className={`text-2xl font-bold ${totalProfitConcluidos >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-500"}`}>
                                {formatBRL(totalProfitConcluidos)}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters + Table */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-black/5 dark:border-white/5 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">Detalhamento por Projeto</h3>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex gap-1">
                            {statusOptions.map((st) => (
                                <button
                                    key={st}
                                    onClick={() => setFilterStatus(st)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filterStatus === st
                                            ? "bg-indigo-600 text-white"
                                            : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                                        }`}
                                >
                                    {st === "all" ? "Todos" : st}
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                            <Input placeholder="Buscar..." className="pl-8 h-8 w-40 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportCSV}
                            className="h-8 px-3 text-xs gap-1.5"
                            disabled={filtered.length === 0}
                        >
                            Exportar CSV
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-slate-400 animate-pulse">Carregando...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">Nenhum projeto encontrado.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Projeto</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                    <TableHead className="text-right">Recebido</TableHead>
                                    <TableHead className="text-right">Custos</TableHead>
                                    <TableHead className="text-right">Comissões</TableHead>
                                    <TableHead className="text-right">Lucro</TableHead>
                                    <TableHead className="text-right">Margem</TableHead>
                                    <TableHead className="text-center w-16">PDF</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((s) => {
                                    const directExp = expenses[s.id] || 0;
                                    const costs = (s.raw_material_cost || 0) + (s.freight_cost || 0) + directExp;
                                    const comms = (s.total_value * ((s.commission_seller_percent || 0) + (s.commission_carpenter_percent || 0) + (s.rt_architect_percent || 0))) / 100;
                                    const profit = calcProfit(s);
                                    const margin = calcMargin(s);

                                    const statusColors: Record<string, string> = {
                                        "Orçamento": "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
                                        "Produção": "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
                                        "Montagem": "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
                                        "Concluído": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
                                    };

                                    return (
                                        <TableRow key={s.id}>
                                            <TableCell>
                                                <p className="font-medium text-sm">{s.client_name}</p>
                                                <p className="text-[10px] text-slate-400">{new Date(s.created_at).toLocaleDateString("pt-BR")}</p>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[s.status] || "bg-slate-100 text-slate-600"}`}>
                                                    {s.status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right text-sm font-medium">{formatBRL(s.total_value)}</TableCell>
                                            <TableCell className="text-right text-sm text-emerald-600">{formatBRL(s.received_value || 0)}</TableCell>
                                            <TableCell className="text-right text-sm text-red-500">{formatBRL(costs)}</TableCell>
                                            <TableCell className="text-right text-sm text-amber-600">{formatBRL(comms)}</TableCell>
                                            <TableCell className={`text-right text-sm font-bold ${profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                                {formatBRL(profit)}
                                            </TableCell>
                                            <TableCell className={`text-right text-sm font-semibold ${margin >= 20 ? "text-emerald-600" : margin >= 0 ? "text-amber-600" : "text-red-500"}`}>
                                                {margin.toFixed(1)}%
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-slate-400 hover:text-indigo-600"
                                                    onClick={() => {
                                                        generateContractPDF({
                                                            clientName: s.client_name,
                                                            totalValue: s.total_value,
                                                            receivedValue: s.received_value || 0,
                                                            rawMaterialCost: s.raw_material_cost || 0,
                                                            freightCost: s.freight_cost || 0,
                                                            commissionCarpenter: s.commission_carpenter_percent || 0,
                                                            commissionSeller: s.commission_seller_percent || 0,
                                                            rtArchitect: s.rt_architect_percent || 0,
                                                            status: s.status,
                                                        });
                                                    }}
                                                >
                                                    <FileText className="h-3.5 w-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </div>
    );
}
