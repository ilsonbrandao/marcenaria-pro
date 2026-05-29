"use client";

import { useEffect, useState } from "react";
import { useRBAC } from "@/components/rbac-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Percent, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";

interface ProjectBI {
    id: string;
    client_name: string;
    total_value: number;
    received_value: number;
    raw_material_cost: number;
    freight_cost: number;
    meals_cost: number;
    commission_seller_percent: number;
    commission_carpenter_percent: number;
    rt_architect_percent: number;
    status: string;
}

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#a78bfa"];

export default function BIPage() {
    const { canViewReports, isOwner, isSysadmin, loading } = useRBAC();
    const router = useRouter();
    const [projects, setProjects] = useState<ProjectBI[]>([]);
    const [expenses, setExpenses] = useState<{ amount: number; expense_type: string }[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        if (!loading && !canViewReports) router.replace("/dashboard");
    }, [loading, canViewReports, router]);

    useEffect(() => {
        if (loading || !canViewReports) return;
        (async () => {
            const res = await fetch("/api/bi", { cache: "no-store" });
            if (res.ok) {
                const json = await res.json();
                setProjects(json.projects || []);
                setExpenses(json.expenses || []);
            }
            setLoadingData(false);
        })();
    }, [loading, canViewReports]);

    const computeProjectMargin = (p: ProjectBI) => {
        const directCosts =
            p.raw_material_cost +
            p.freight_cost +
            p.meals_cost +
            p.total_value * ((p.commission_seller_percent + p.commission_carpenter_percent + p.rt_architect_percent) / 100);
        const grossProfit = p.total_value - directCosts;
        const margin = p.total_value > 0 ? (grossProfit / p.total_value) * 100 : 0;
        return { grossProfit, margin };
    };

    const totalRevenue    = projects.reduce((s, p) => s + p.total_value, 0);
    const totalReceived   = projects.reduce((s, p) => s + p.received_value, 0);
    const totalDirectCost = projects.reduce((s, p) => {
        const { grossProfit } = computeProjectMargin(p);
        return s + (p.total_value - grossProfit);
    }, 0);
    const fixedExpenses   = expenses.filter(e => e.expense_type === "Fixed").reduce((s, e) => s + e.amount, 0);
    const grossProfit     = totalRevenue - totalDirectCost;
    const netProfit       = grossProfit - fixedExpenses;
    const avgMargin       = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    const projectChartData = projects
        .filter(p => p.status === "Concluído" || p.total_value > 0)
        .slice(0, 10)
        .map(p => {
            const { grossProfit: gp } = computeProjectMargin(p);
            return { name: p.client_name.split(" ")[0], receita: p.total_value, lucro: Math.max(0, gp) };
        });

    const pieData = [
        { name: "Custo Direto", value: totalDirectCost },
        { name: "Despesa Fixa", value: fixedExpenses },
        { name: "Lucro Líquido", value: Math.max(0, netProfit) },
    ];

    const statusCount = projects.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    if (loadingData) {
        return <div className="flex items-center justify-center h-64 text-slate-400">Carregando BI...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Business Intelligence</h2>
                <p className="text-sm text-slate-500">Visão consolidada de lucro, custos e desempenho</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <KpiCard title="Receita Total" value={fmt(totalRevenue)} sub={`Recebido: ${fmt(totalReceived)}`} icon={DollarSign} color="text-indigo-600" />
                <KpiCard title="Lucro Bruto" value={fmt(grossProfit)} sub={`Margem: ${avgMargin.toFixed(1)}%`} icon={TrendingUp} color="text-emerald-600" />
                <KpiCard title="Lucro Líquido" value={fmt(netProfit)} sub={`Despesas fixas: ${fmt(fixedExpenses)}`} icon={netProfit > 0 ? TrendingUp : TrendingDown} color={netProfit > 0 ? "text-emerald-600" : "text-red-500"} />
                <KpiCard title="Margem Média" value={`${avgMargin.toFixed(1)}%`} sub={`${projects.length} projetos`} icon={Percent} color="text-amber-600" />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Receita vs Lucro por Projeto */}
                <Card className="lg:col-span-2">
                    <CardHeader><CardTitle className="text-base">Receita vs Lucro Bruto por Projeto</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={projectChartData}>
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(v: any) => fmt(v)} />
                                <Legend />
                                <Bar dataKey="receita" name="Receita" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="lucro" name="Lucro Bruto" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Composição dos Custos */}
                <Card>
                    <CardHeader><CardTitle className="text-base">Composição da Receita</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" label={(props: any) => `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(v: any) => fmt(v)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Status dos Projetos */}
            <Card>
                <CardHeader><CardTitle className="text-base">Projetos por Status</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-3">
                        {Object.entries(statusCount).map(([status, count]) => (
                            <div key={status} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700">
                                <BarChart3 className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">{status}</span>
                                <span className="text-sm font-bold text-primary">{count}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function KpiCard({ title, value, sub, icon: Icon, color }: { title: string; value: string; sub: string; icon: any; color: string }) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-slate-500">{title}</p>
                    <Icon className={cn("h-4 w-4", color)} />
                </div>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
            </CardContent>
        </Card>
    );
}

function cn(...classes: (string | undefined | false)[]) {
    return classes.filter(Boolean).join(" ");
}
