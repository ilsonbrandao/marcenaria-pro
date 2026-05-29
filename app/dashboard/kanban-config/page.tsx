"use client";

import { useEffect, useState } from "react";
import { useRBAC } from "@/components/rbac-provider";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical, CheckCircle2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Stage {
    id: string;
    kanban_type: "sales" | "production";
    name: string;
    color: string;
    position: number;
    is_final: boolean;
}

const PRESET_COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#a78bfa","#60a5fa","#fb923c","#94a3b8","#10b981","#ec4899"];

export default function KanbanConfigPage() {
    const { isOwner, isOffice, isSysadmin, loading } = useRBAC();
    const router = useRouter();
    const canManage = isOwner || isOffice || isSysadmin;

    const [stages, setStages] = useState<Stage[]>([]);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Stage | null>(null);
    const [form, setForm] = useState({ name: "", color: "#6366f1", is_final: false, kanban_type: "production" as "sales" | "production" });
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"sales" | "production">("production");
    const [dragId, setDragId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    useEffect(() => { if (!loading && !canManage) router.replace("/dashboard"); }, [loading, canManage, router]);

    const load = async () => {
        const res = await fetch("/api/kanban-stages", { cache: "no-store" });
        if (!res.ok) toast.error((await res.json().catch(() => ({}))).error || "Falha ao carregar");
        else setStages(await res.json());
    };

    useEffect(() => { if (canManage) load(); }, [canManage]);

    const openNew = (type: "sales" | "production") => {
        setEditing(null);
        setForm({ name: "", color: "#6366f1", is_final: false, kanban_type: type });
        setOpen(true);
    };

    const openEdit = (s: Stage) => {
        setEditing(s);
        setForm({ name: s.name, color: s.color, is_final: s.is_final, kanban_type: s.kanban_type });
        setOpen(true);
    };

    const save = async () => {
        if (!form.name.trim()) { toast.error("Nome é obrigatório."); return; }
        setSaving(true);
        try {
            if (editing) {
                const res = await fetch("/api/kanban-stages", {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: editing.id, name: form.name, color: form.color, is_final: form.is_final }),
                });
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha");
                toast.success("Etapa atualizada.");
            } else {
                const maxPos = stages.filter(s => s.kanban_type === form.kanban_type).length;
                const res = await fetch("/api/kanban-stages", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...form, position: maxPos }),
                });
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha");
                toast.success("Etapa criada.");
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
        if (!confirm("Remover esta etapa? Projetos nela serão desvinculados.")) return;
        const res = await fetch(`/api/kanban-stages?id=${id}`, { method: "DELETE" });
        if (!res.ok) toast.error((await res.json().catch(() => ({}))).error || "Falha");
        else { toast.success("Etapa removida."); load(); }
    };

    const handleDrop = async (type: "sales" | "production", fromId: string, toId: string) => {
        if (fromId === toId) return;
        const filtered = stages.filter(s => s.kanban_type === type).sort((a, b) => a.position - b.position);
        const fromIdx = filtered.findIndex(s => s.id === fromId);
        const toIdx = filtered.findIndex(s => s.id === toId);
        if (fromIdx < 0 || toIdx < 0) return;
        const reordered = [...filtered];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, moved);
        await fetch("/api/kanban-stages", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order: reordered.map((s, i) => ({ id: s.id, position: i })) }),
        });
        load();
    };

    const renderStages = (type: "sales" | "production") => {
        const filtered = stages.filter(s => s.kanban_type === type).sort((a, b) => a.position - b.position);
        return (
            <div className="space-y-2">
                {filtered.map((s, i) => (
                    <div
                        key={s.id}
                        draggable
                        onDragStart={() => setDragId(s.id)}
                        onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                        onDragOver={e => { e.preventDefault(); setDragOverId(s.id); }}
                        onDrop={e => { e.preventDefault(); if (dragId) handleDrop(type, dragId, s.id); setDragId(null); setDragOverId(null); }}
                        className={`flex items-center gap-3 p-3 rounded-xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 transition-all
                            ${dragId === s.id ? "opacity-40" : ""}
                            ${dragOverId === s.id && dragId !== s.id ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20" : ""}`}
                    >
                        <span className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing">
                            <GripVertical className="h-4 w-4" />
                        </span>
                        <span className="h-3 w-3 rounded-full shrink-0 border border-white/30 shadow" style={{ background: s.color }} />
                        <span className="flex-1 font-medium text-sm">{s.name}</span>
                        <span className="text-xs text-slate-400">#{i + 1}</span>
                        {s.is_final && (
                            <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-200">
                                <CheckCircle2 className="h-3 w-3" />Final
                            </Badge>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => remove(s.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                ))}
                <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => openNew(type)}>
                    <Plus className="mr-2 h-4 w-4" />Adicionar Etapa
                </Button>
            </div>
        );
    };

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Configurar Kanban</h2>
                <p className="text-sm text-slate-500">Defina e ordene as etapas do funil de vendas e fluxo de produção.</p>
            </div>

            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
                <TabsList className="mb-4">
                    <TabsTrigger value="production">Fluxo de Produção</TabsTrigger>
                    <TabsTrigger value="sales">Funil de Vendas</TabsTrigger>
                </TabsList>
                <TabsContent value="production">
                    <Card><CardHeader><CardTitle className="text-base">Etapas de Produção</CardTitle></CardHeader>
                        <CardContent>{renderStages("production")}</CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="sales">
                    <Card><CardHeader><CardTitle className="text-base">Funil de Vendas</CardTitle></CardHeader>
                        <CardContent>{renderStages("sales")}</CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader><DialogTitle>{editing ? "Editar Etapa" : "Nova Etapa"}</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Nome da Etapa *</Label>
                            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Em Produção" />
                        </div>
                        <div className="space-y-1">
                            <Label>Cor</Label>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_COLORS.map(c => (
                                    <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                                        className={`h-7 w-7 rounded-full border-2 transition-all ${form.color === c ? "border-primary scale-110 shadow" : "border-white/30"}`}
                                        style={{ background: c }} />
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Switch checked={form.is_final} onCheckedChange={v => setForm(p => ({ ...p, is_final: v }))} id="is_final" />
                            <Label htmlFor="is_final" className="cursor-pointer">Etapa Final (Concluído / Assinado)</Label>
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
