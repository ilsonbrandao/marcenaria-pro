"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Check, Calendar, DollarSign, Pencil, Trash2 } from "lucide-react";

type Installment = {
    id: string;
    sale_id: string;
    description: string;
    amount: number;
    due_date: string;
    paid: boolean;
    paid_at: string | null;
};

interface InstallmentsManagerProps {
    saleId: string;
    totalValue: number;
}

export function InstallmentsManager({ saleId, totalValue }: InstallmentsManagerProps) {
    const [installments, setInstallments] = useState<Installment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);

    // Form add
    const [desc, setDesc] = useState("");
    const [amount, setAmount] = useState("");
    const [dueDate, setDueDate] = useState("");

    // Form edit
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDesc, setEditDesc] = useState("");
    const [editAmount, setEditAmount] = useState("");
    const [editDueDate, setEditDueDate] = useState("");

    // Valor da Venda editável
    const [saleValue, setSaleValue] = useState(totalValue);
    const [editingSaleValue, setEditingSaleValue] = useState(false);
    const [saleValueInput, setSaleValueInput] = useState("");

    const fetchInstallments = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/installments?saleId=${saleId}`, { cache: "no-store" });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao carregar");
            setInstallments((await res.json()) as Installment[]);
        } catch (err: any) {
            toast.error("Erro ao carregar parcelas", { description: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (saleId) fetchInstallments();
    }, [saleId]);

    useEffect(() => {
        setSaleValue(totalValue);
    }, [totalValue]);

    const handleSaveSaleValue = async () => {
        const val = parseFloat(saleValueInput.replace(/\D/g, "")) / 100 || 0;
        const res = await fetch("/api/sales", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: saleId, total_value: val }),
        });
        if (!res.ok) { toast.error("Erro ao salvar valor", { description: (await res.json().catch(() => ({}))).error }); return; }
        setSaleValue(val);
        setEditingSaleValue(false);
        toast.success("Valor da venda atualizado!");
    };

    const handleAdd = async () => {
        try {
            const val = parseFloat(amount.replace(/\D/g, "")) / 100 || 0;

            const res = await fetch("/api/installments", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sale_id: saleId, description: desc || "Parcela", amount: val, due_date: dueDate }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha");

            toast.success("Parcela adicionada!");
            setShowAdd(false);
            setDesc("");
            setAmount("");
            setDueDate("");
            fetchInstallments();
        } catch (err: any) {
            toast.error("Erro", { description: err.message });
        }
    };

    const togglePaid = async (inst: Installment) => {
        const newPaid = !inst.paid;
        const res = await fetch("/api/installments", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: inst.id, paid: newPaid }),
        });
        if (!res.ok) { toast.error("Erro ao atualizar"); return; }
        fetchInstallments();
        toast.success(newPaid ? "Parcela marcada como paga!" : "Parcela desmarcada");
    };

    const handleStartEdit = (inst: Installment) => {
        setEditingId(inst.id);
        setEditDesc(inst.description);
        setEditAmount(formatBRLRaw(inst.amount));
        setEditDueDate(inst.due_date);
    };

    const handleSaveEdit = async () => {
        if (!editingId) return;
        const val = parseFloat(editAmount.replace(/\D/g, "")) / 100 || 0;
        const res = await fetch("/api/installments", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingId, description: editDesc || "Parcela", amount: val, due_date: editDueDate }),
        });
        if (!res.ok) { toast.error("Erro ao salvar", { description: (await res.json().catch(() => ({}))).error }); return; }
        toast.success("Parcela atualizada!");
        setEditingId(null);
        fetchInstallments();
    };

    const handleDelete = async (id: string) => {
        const res = await fetch(`/api/installments?id=${id}`, { method: "DELETE" });
        if (!res.ok) { toast.error("Erro ao excluir", { description: (await res.json().catch(() => ({}))).error }); return; }
        toast.success("Parcela excluída!");
        fetchInstallments();
    };

    const formatBRLRaw = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

    const formatBRL = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

    const handleFormatAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value.replace(/\D/g, "");
        if (!raw) return setAmount("");
        const num = parseFloat(raw) / 100;
        setAmount(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num));
    };

    const totalInstallments = installments.reduce((s, i) => s + i.amount, 0);
    const totalPaid = installments.filter((i) => i.paid).reduce((s, i) => s + i.amount, 0);
    const remaining = saleValue - totalPaid;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-indigo-500" />
                    <h3 className="font-semibold text-sm">Valor e Condições de pagamento</h3>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)} className="text-xs h-7">
                    <Plus className="h-3 w-3 mr-1" /> Parcela
                </Button>
            </div>

            {/* Resumo rápido */}
            <div className="grid grid-cols-3 gap-2 text-center">
                <div
                    className="bg-slate-50 dark:bg-zinc-900 rounded-md p-2 cursor-pointer"
                    onClick={() => { if (!editingSaleValue) { setSaleValueInput(formatBRL(saleValue)); setEditingSaleValue(true); } }}
                >
                    <p className="text-[10px] text-slate-400">Valor da Venda</p>
                    {editingSaleValue ? (
                        <div className="flex gap-1 mt-0.5" onClick={e => e.stopPropagation()}>
                            <input
                                autoFocus
                                className="w-full text-xs font-bold bg-white dark:bg-zinc-800 border border-indigo-300 rounded px-1 py-0.5 outline-none"
                                value={saleValueInput}
                                onChange={e => {
                                    let raw = e.target.value.replace(/\D/g, "");
                                    if (!raw) { setSaleValueInput(""); return; }
                                    setSaleValueInput(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(raw) / 100));
                                }}
                                onKeyDown={e => { if (e.key === "Enter") handleSaveSaleValue(); if (e.key === "Escape") setEditingSaleValue(false); }}
                                onBlur={handleSaveSaleValue}
                            />
                        </div>
                    ) : (
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatBRL(saleValue)}</p>
                    )}
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-md p-2">
                    <p className="text-[10px] text-emerald-600">Recebido</p>
                    <p className="text-xs font-bold text-emerald-600">{formatBRL(totalPaid)}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-md p-2">
                    <p className="text-[10px] text-amber-600">Falta Receber</p>
                    <p className="text-xs font-bold text-amber-600">{formatBRL(remaining > 0 ? remaining : 0)}</p>
                </div>
            </div>

            {/* Form de Adicionar */}
            {showAdd && (
                <div className="bg-slate-50 dark:bg-zinc-900 rounded-lg p-3 space-y-3 border border-slate-100 dark:border-zinc-800">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="text-xs">Descrição</Label>
                            <Input className="h-8 text-xs" placeholder="Ex: Sinal" value={desc} onChange={(e) => setDesc(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Valor</Label>
                            <Input className="h-8 text-xs" placeholder="R$ 0,00" value={amount} onChange={handleFormatAmount} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Vencimento</Label>
                        <Input className="h-8 text-xs" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                    <Button size="sm" className="w-full h-7 text-xs" onClick={handleAdd} disabled={!amount || !dueDate}>
                        Adicionar
                    </Button>
                </div>
            )}

            {/* Lista de Parcelas */}
            {loading ? (
                <p className="text-xs text-slate-400 animate-pulse">Carregando...</p>
            ) : installments.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">Nenhuma parcela cadastrada.</p>
            ) : (
                <div className="space-y-2">
                    {installments.map((inst) => (
                        <div key={inst.id}>
                            {editingId === inst.id ? (
                                <div className="bg-slate-50 dark:bg-zinc-900 rounded-lg p-3 space-y-2 border border-indigo-200 dark:border-indigo-800">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Descrição</Label>
                                            <Input className="h-8 text-xs" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Valor</Label>
                                            <Input className="h-8 text-xs" value={editAmount} onChange={e => {
                                                let raw = e.target.value.replace(/\D/g, "");
                                                if (!raw) { setEditAmount(""); return; }
                                                setEditAmount(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(raw) / 100));
                                            }} />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Vencimento</Label>
                                        <Input className="h-8 text-xs" type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleSaveEdit}>Salvar</Button>
                                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setEditingId(null)}>Cancelar</Button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all text-xs ${inst.paid
                                        ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-900/30"
                                        : "bg-white border-slate-100 dark:bg-zinc-950 dark:border-zinc-800"
                                    }`}
                                >
                                    <button
                                        onClick={() => togglePaid(inst)}
                                        className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${inst.paid
                                            ? "bg-emerald-500 border-emerald-500 text-white"
                                            : "border-slate-300 dark:border-zinc-600 hover:border-indigo-400"
                                        }`}
                                    >
                                        {inst.paid && <Check className="h-3 w-3" />}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-medium truncate ${inst.paid ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"}`}>
                                            {inst.description}
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                            Venc: {new Date(inst.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                                        </p>
                                    </div>
                                    <p className={`font-bold shrink-0 ${inst.paid ? "text-emerald-600" : "text-slate-900 dark:text-slate-100"}`}>
                                        {formatBRL(inst.amount)}
                                    </p>
                                    <button
                                        onClick={() => handleStartEdit(inst)}
                                        className="text-slate-400 hover:text-indigo-500 transition-colors shrink-0"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(inst.id)}
                                        className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
