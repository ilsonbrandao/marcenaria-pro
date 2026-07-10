"use client";

import { useEffect, useState } from "react";
import { useRBAC } from "@/components/rbac-provider";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthService } from "@/services/authService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, GripVertical, Tag } from "lucide-react";

interface PriceItem {
    id: string;
    position: number;
    name: string;
    price_prazo: number;
    is_active: boolean;
}

const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function PriceTablePage() {
    const { isOwner, isOffice, isSysadmin, loading } = useRBAC();
    const router = useRouter();
    const canManage = isOwner || isOffice || isSysadmin;

    const [items, setItems]     = useState<PriceItem[]>([]);
    const [open, setOpen]       = useState(false);
    const [editing, setEditing] = useState<PriceItem | null>(null);
    const [saving, setSaving]   = useState(false);
    const [form, setForm]       = useState({ name: "", price_prazo: "", is_active: true });
    const [dragId, setDragId]   = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    useEffect(() => {
        if (!loading && !canManage) router.replace("/dashboard");
    }, [loading, canManage, router]);

    // A sessão vai por cookie httpOnly (Auth.js); não há header a enviar.
    const headers = async (): Promise<Record<string, string>> => ({ "Content-Type": "application/json" });

    const load = async () => {
        const h = await headers();
        const res = await fetch("/api/price-table", { headers: h });
        const data = await res.json();
        setItems(data || []);
    };

    useEffect(() => { if (canManage) load(); }, [canManage]);

    const openNew = () => {
        setEditing(null);
        setForm({ name: "", price_prazo: "", is_active: true });
        setOpen(true);
    };

    const openEdit = (item: PriceItem) => {
        setEditing(item);
        setForm({
            name:        item.name,
            price_prazo: String(item.price_prazo),
            is_active:   item.is_active,
        });
        setOpen(true);
    };

    const save = async () => {
        if (!form.name.trim()) { toast.error("Nome é obrigatório."); return; }
        setSaving(true);
        try {
            const h = await headers();
            const body = {
                name:        form.name.trim(),
                price_prazo: parseFloat(form.price_prazo.replace(',', '.')) || 0,
                is_active:   form.is_active,
            };

            if (editing) {
                await fetch(`/api/price-table/${editing.id}`, { method: "PUT", headers: h, body: JSON.stringify(body) });
                toast.success("Item atualizado.");
            } else {
                await fetch("/api/price-table", { method: "POST", headers: h, body: JSON.stringify(body) });
                toast.success("Item criado.");
            }
            setOpen(false);
            load();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id: string) => {
        if (!confirm("Remover este item da tabela de preços?")) return;
        const h = await headers();
        await fetch(`/api/price-table/${id}`, { method: "DELETE", headers: h });
        toast.success("Item removido.");
        load();
    };

    const handleDrop = async (fromId: string, toId: string) => {
        if (fromId === toId) return;
        const fromIdx = items.findIndex(i => i.id === fromId);
        const toIdx   = items.findIndex(i => i.id === toId);
        const reordered = [...items];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, moved);
        setItems(reordered);
        const h = await headers();
        await Promise.all(
            reordered.map((item, idx) =>
                fetch(`/api/price-table/${item.id}`, {
                    method: "PUT", headers: h,
                    body: JSON.stringify({ position: idx }),
                })
            )
        );
        load();
    };

    return (
        <div className="max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Tabela de Preços</h2>
                    <p className="text-sm text-slate-500">Preço por metro quadrado por tipo de móvel.</p>
                </div>
                <Button onClick={openNew}>
                    <Plus className="h-4 w-4 mr-2" />Novo Item
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" />
                        {items.length} {items.length === 1 ? "item" : "itens"} cadastrados
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* cabeçalho */}
                    <div className="grid grid-cols-[2rem_1fr_8rem_5rem_3rem] text-[10px] text-slate-400 font-semibold px-3 py-1 border-b">
                        <span>#</span>
                        <span>Tipo de Móvel</span>
                        <span className="text-right">Valor/m²</span>
                        <span className="text-center">Ativo</span>
                        <span />
                    </div>
                    <div className="space-y-1 pt-1">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                draggable
                                onDragStart={() => setDragId(item.id)}
                                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                                onDragOver={e => { e.preventDefault(); setDragOverId(item.id); }}
                                onDrop={e => { e.preventDefault(); if (dragId) handleDrop(dragId, item.id); setDragId(null); setDragOverId(null); }}
                                className={`grid grid-cols-[2rem_1fr_8rem_5rem_3rem] items-center px-3 py-2 rounded-lg border text-sm transition-all
                                    ${dragId === item.id ? 'opacity-40' : ''}
                                    ${dragOverId === item.id && dragId !== item.id ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800'}
                                `}
                            >
                                <span className="text-slate-300 cursor-grab active:cursor-grabbing">
                                    <GripVertical className="h-4 w-4" />
                                </span>
                                <span className={`font-medium truncate ${!item.is_active ? 'text-slate-400 line-through' : ''}`}>
                                    <span className="text-xs text-slate-400 mr-1">[{item.position + 1}]</span>
                                    {item.name}
                                </span>
                                <span className="text-right text-indigo-600 font-semibold">{fmt(item.price_prazo)}</span>
                                <span className="flex justify-center">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                        {item.is_active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </span>
                                <div className="flex items-center gap-1 justify-end">
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(item)}>
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:text-red-600" onClick={() => remove(item.id)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {items.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-6">Nenhum item cadastrado. Clique em "Novo Item" para começar.</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar Item" : "Novo Item"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Tipo de Móvel *</Label>
                            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                placeholder="Ex: Armário (Branco) Cozinha" />
                        </div>
                        <div className="space-y-1">
                            <Label>Valor/m² (R$)</Label>
                            <Input type="number" min={0} step={0.01}
                                value={form.price_prazo}
                                onChange={e => setForm(p => ({ ...p, price_prazo: e.target.value }))}
                                placeholder="1600.00" />
                        </div>
                        <div className="flex items-center gap-3">
                            <Switch id="is_active" checked={form.is_active}
                                onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
                            <Label htmlFor="is_active" className="cursor-pointer">Item ativo (aparece na seleção)</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
