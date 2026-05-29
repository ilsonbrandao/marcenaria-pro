"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Plus, TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpCircle, ArrowDownCircle, Trash2, CalendarDays, X } from "lucide-react";
import { FinanceCharts } from "@/components/finance-charts";

type Expense = {
    id: string;
    description: string;
    amount: number;
    expense_type: "Fixed" | "Direct";
    date_incurred: string;
    sale_id: string | null;
    sales?: { client_name: string } | null;
};

type Sale = {
    id: string;
    client_name: string;
    total_value: number;
    received_value: number;
    status: string;
};

function getDefaultDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    return { from: fmt(firstDay), to: fmt(today) };
}

export default function FinancePage() {
    const defaults = getDefaultDates();

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [formLoading, setFormLoading] = useState(false);

    // Date range
    const [dateFrom, setDateFrom] = useState(defaults.from);
    const [dateTo, setDateTo] = useState(defaults.to);

    // Form State
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [expenseType, setExpenseType] = useState<"Fixed" | "Direct">("Fixed");
    const [saleId, setSaleId] = useState<string>("");

    // Delete confirmation dialog
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/finance?from=${dateFrom}&to=${dateTo}`, { cache: "no-store" });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao carregar");
            const json = await res.json();
            setExpenses(json.expenses as Expense[]);
            setSales(json.sales as Sale[]);
        } catch (err: any) {
            toast.error("Erro ao carregar dados financeiros", { description: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [dateFrom, dateTo]);

    const resetFilters = () => {
        const d = getDefaultDates();
        setDateFrom(d.from);
        setDateTo(d.to);
    };

    const handleAddExpense = async () => {
        const val = parseFloat(amount.replace(/\D/g, "")) / 100 || 0;

        if (val <= 0) {
            toast.error("Valor inválido", { description: "O valor da despesa deve ser maior que zero." });
            return;
        }

        try {
            setFormLoading(true);
            const res = await fetch("/api/finance", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    description: description.trim(),
                    amount: val,
                    expense_type: expenseType,
                    sale_id: saleId || null,
                }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao salvar");

            toast.success("Despesa registrada!");
            setDialogOpen(false);
            setDescription("");
            setAmount("");
            setSaleId("");
            fetchData();
        } catch (err: any) {
            toast.error("Erro ao salvar despesa", { description: err.message });
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteExpense = async () => {
        if (!expenseToDelete) return;
        try {
            setDeleteLoading(true);
            const res = await fetch(`/api/finance?id=${expenseToDelete.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao excluir");
            toast.success("Despesa excluída");
            setDeleteDialogOpen(false);
            setExpenseToDelete(null);
            fetchData();
        } catch (err: any) {
            toast.error("Erro ao excluir despesa", { description: err.message });
        } finally {
            setDeleteLoading(false);
        }
    };

    const formatBRL = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

    const handleFormatValue = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value.replace(/\D/g, "");
        if (!raw) return setAmount("");
        const num = parseFloat(raw) / 100;
        setAmount(
            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num)
        );
    };

    // KPIs
    const totalRevenue = sales.reduce((sum, s) => sum + (s.total_value || 0), 0);
    const totalReceived = sales.reduce((sum, s) => sum + (s.received_value || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const fixedExpenses = expenses.filter((e) => e.expense_type === "Fixed").reduce((s, e) => s + e.amount, 0);
    const directExpenses = expenses.filter((e) => e.expense_type === "Direct").reduce((s, e) => s + e.amount, 0);
    const netProfit = totalReceived - totalExpenses;

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Financeiro</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Visão geral de receitas, despesas e lucro líquido</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Plus className="h-4 w-4 mr-2" /> Nova Despesa
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Registrar Despesa</DialogTitle>
                            <DialogDescription>Lance uma despesa fixa ou vinculada a um projeto.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>Descrição</Label>
                                <Input placeholder="Ex: Aluguel do galpão" value={description} onChange={(e) => setDescription(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Valor</Label>
                                <Input placeholder="R$ 0,00" value={amount} onChange={handleFormatValue} />
                            </div>
                            <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select value={expenseType} onValueChange={(v: any) => setExpenseType(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Fixed">Fixa (Geral)</SelectItem>
                                        <SelectItem value="Direct">Direta (Projeto)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {expenseType === "Direct" && (
                                <div className="space-y-2">
                                    <Label>Vincular a Projeto (Opcional)</Label>
                                    <Select value={saleId} onValueChange={setSaleId}>
                                        <SelectTrigger><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
                                        <SelectContent>
                                            {sales.map((s) => (
                                                <SelectItem key={s.id} value={s.id}>{s.client_name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                            <Button onClick={handleAddExpense} disabled={formLoading || !description || !amount}>
                                {formLoading ? "Salvando..." : "Registrar"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"><DollarSign className="h-4 w-4 text-blue-600" /></div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Faturamento Total</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatBRL(totalRevenue)}</p>
                </div>
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg"><ArrowUpCircle className="h-4 w-4 text-emerald-600" /></div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Já Recebido</span>
                    </div>
                    <p className="text-lg font-bold text-emerald-600">{formatBRL(totalReceived)}</p>
                </div>
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg"><ArrowDownCircle className="h-4 w-4 text-red-600" /></div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Total Despesas</span>
                    </div>
                    <p className="text-lg font-bold text-red-500">{formatBRL(totalExpenses)}</p>
                </div>
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg"><Wallet className="h-4 w-4 text-indigo-600" /></div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Lucro Líquido</span>
                    </div>
                    <p className={`text-lg font-bold ${netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatBRL(netProfit)}</p>
                </div>
            </div>

            {/* Split: Fixas vs Diretas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingDown className="h-4 w-4 text-orange-500" />
                        <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">Despesas Fixas</h3>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">Aluguel, Energia, Internet, Funcionários</p>
                    <p className="text-2xl font-bold text-orange-500">{formatBRL(fixedExpenses)}</p>
                </div>
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-cyan-500" />
                        <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">Custos Diretos (Vinculados)</h3>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">Insumos e refeições de projetos específicos</p>
                    <p className="text-2xl font-bold text-cyan-500">{formatBRL(directExpenses)}</p>
                </div>
            </div>

            {/* Gráficos Financeiros */}
            <FinanceCharts sales={sales} expenses={expenses} />

            {/* Tabela de Despesas */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-black/5 dark:border-white/5">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">Histórico de Despesas</h3>
                </div>
                {loading ? (
                    <div className="p-8 text-center text-slate-400 animate-pulse">Carregando...</div>
                ) : expenses.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">Nenhuma despesa registrada ainda. Clique em "Nova Despesa".</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Projeto</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead className="text-right w-12"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {expenses.map((exp) => (
                                <TableRow key={exp.id}>
                                    <TableCell className="font-medium">{exp.description}</TableCell>
                                    <TableCell>
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${exp.expense_type === "Fixed" ? "bg-orange-50 text-orange-600 dark:bg-orange-900/20" : "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20"}`}>
                                            {exp.expense_type === "Fixed" ? "Fixa" : "Direta"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-slate-500 text-sm">{exp.sales?.client_name || "—"}</TableCell>
                                    <TableCell className="text-slate-500 text-sm">{new Date(exp.date_incurred).toLocaleDateString("pt-BR")}</TableCell>
                                    <TableCell className="text-right font-semibold text-red-500">{formatBRL(exp.amount)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-red-500"
                                            onClick={() => {
                                                setExpenseToDelete(exp);
                                                setDeleteDialogOpen(true);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
                setDeleteDialogOpen(open);
                if (!open) setExpenseToDelete(null);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar exclusão</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja excluir a despesa{" "}
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                                "{expenseToDelete?.description}"
                            </span>{" "}
                            no valor de{" "}
                            <span className="font-semibold text-red-500">
                                {formatBRL(expenseToDelete?.amount ?? 0)}
                            </span>
                            ? Esta ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDeleteDialogOpen(false);
                                setExpenseToDelete(null);
                            }}
                            disabled={deleteLoading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteExpense}
                            disabled={deleteLoading}
                        >
                            {deleteLoading ? "Excluindo..." : "Excluir"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
