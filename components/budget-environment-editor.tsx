"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface PriceTableItem {
    id: string;
    position: number;
    name: string;
    price_prazo: number;
    is_active: boolean;
}

interface BudgetItem {
    id: string;
    environment_id: string;
    description: string;
    qty: number;
    alt_cm: number;
    larg_cm: number;
    prof_cm: number;
    price_prazo_m2: number;
    price_avista_m2: number;
    value_prazo: number;
    value_avista: number;
    is_active: boolean;
    position: number;
}

interface Environment {
    id: string;
    name: string;
    position: number;
    items: BudgetItem[];
}

interface TotalsUpdate {
    total_prazo: number;
    total_avista: number;
    environments?: any[];
}

interface Props {
    budgetId?: string;
    token?: string;       // modo público: usa token em vez de budgetId
    readOnly?: boolean;
    avistaDiscountPercent?: number;
    onTotalsChange?: (update?: TotalsUpdate) => void;
}

const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const calcPreview = (alt: number, larg: number, price: number, qty: number) =>
    Math.round((alt * larg / 10000) * price * qty * 100) / 100;

export function BudgetEnvironmentEditor({ budgetId, token, readOnly = false, avistaDiscountPercent = 0, onTotalsChange }: Props) {
    const [environments, setEnvironments] = useState<Environment[]>([]);
    const [priceItems, setPriceItems]     = useState<PriceTableItem[]>([]);
    const [collapsed, setCollapsed]       = useState<Record<string, boolean>>({});
    const [loading, setLoading]           = useState(true);

    // form novo ambiente
    const [addingEnv, setAddingEnv]     = useState(false);
    const [newEnvName, setNewEnvName]   = useState("");

    // edição do nome do ambiente
    const [editEnvId, setEditEnvId]     = useState<string | null>(null);
    const [editEnvName, setEditEnvName] = useState("");

    // form novo item (por ambiente)
    const [addingItemEnv, setAddingItemEnv] = useState<string | null>(null);
    const [newItem, setNewItem] = useState({
        price_table_item_id: "", description: "",
        qty: 1, alt_cm: 0, larg_cm: 0, prof_cm: 0,
        price_prazo_m2: 0, price_avista_m2: 0,
    });

    // edição inline de item
    const [editItemId, setEditItemId] = useState<string | null>(null);
    const [editItem, setEditItem]     = useState<Partial<BudgetItem>>({});

    const isPublic = !!token;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (isPublic) {
                const res = await fetch(`/api/public/budget/${token}`, { cache: 'no-store' });
                if (!res.ok) throw new Error("Orçamento não encontrado");
                const data = await res.json();
                setEnvironments(data.environments || []);
            } else if (budgetId) {
                const res = await fetch(`/api/budgets/${budgetId}`, { cache: 'no-store' });
                const data = await res.json();
                setEnvironments(data.environments || []);

                // carrega tabela de preços
                const pr = await fetch('/api/price-table', { cache: 'no-store' });
                const prData = await pr.json();
                setPriceItems(prData || []);
            }
        } catch (e: any) {
            toast.error("Erro ao carregar", { description: e.message });
        } finally {
            setLoading(false);
        }
    }, [budgetId, token, isPublic]);

    useEffect(() => { load(); }, [load]);

    const authHeaders = async () => {
        return { "Content-Type": "application/json" };
    };

    // ── Ambiente ──────────────────────────────────────────
    const handleAddEnv = async () => {
        if (!newEnvName.trim() || !budgetId) return;
        const res = await fetch(`/api/budgets/${budgetId}/environments`, {
            method: "POST",
            headers: await authHeaders(),
            body: JSON.stringify({ name: newEnvName.trim() }),
        });
        if (!res.ok) { toast.error("Erro ao adicionar ambiente"); return; }
        const env = await res.json();
        setEnvironments(prev => [...prev, env]);
        setNewEnvName("");
        setAddingEnv(false);
        toast.success("Ambiente adicionado!");
    };

    const handleDeleteEnv = async (envId: string) => {
        if (!budgetId) return;
        if (!confirm("Remover ambiente e todos os seus itens?")) return;
        await fetch(`/api/budgets/${budgetId}/environments/${envId}`, {
            method: "DELETE", headers: await authHeaders(),
        });
        setEnvironments(prev => prev.filter(e => e.id !== envId));
        onTotalsChange?.();
        toast.success("Ambiente removido!");
    };

    const handleSaveEnvName = async (envId: string) => {
        if (!budgetId || !editEnvName.trim()) return;
        await fetch(`/api/budgets/${budgetId}/environments/${envId}`, {
            method: "PUT",
            headers: await authHeaders(),
            body: JSON.stringify({ name: editEnvName.trim() }),
        });
        setEnvironments(prev => prev.map(e => e.id === envId ? { ...e, name: editEnvName.trim() } : e));
        setEditEnvId(null);
        toast.success("Ambiente renomeado!");
    };

    // ── Item ──────────────────────────────────────────────
    const handlePriceItemSelect = (itemId: string) => {
        const found = priceItems.find(p => p.id === itemId);
        if (found) {
            setNewItem(prev => ({
                ...prev,
                price_table_item_id: itemId,
                description:         found.name,
                price_prazo_m2:      found.price_prazo,
                price_avista_m2:     0,
            }));
        } else {
            setNewItem(prev => ({ ...prev, price_table_item_id: "", description: "", price_prazo_m2: 0, price_avista_m2: 0 }));
        }
    };

    const handleAddItem = async (envId: string) => {
        if (!budgetId || !newItem.description.trim()) {
            toast.error("Preencha a descrição do item");
            return;
        }
        const res = await fetch(`/api/budgets/${budgetId}/items`, {
            method: "POST",
            headers: await authHeaders(),
            body: JSON.stringify({ ...newItem, environment_id: envId }),
        });
        if (!res.ok) { toast.error("Erro ao adicionar item"); return; }
        const item = await res.json();
        setEnvironments(prev => prev.map(e =>
            e.id === envId ? { ...e, items: [...e.items, item] } : e
        ));
        setNewItem({ price_table_item_id: "", description: "", qty: 1, alt_cm: 0, larg_cm: 0, prof_cm: 0, price_prazo_m2: 0, price_avista_m2: 0 });
        setAddingItemEnv(null);
        onTotalsChange?.();
        toast.success("Item adicionado!");
    };

    const handleDeleteItem = async (envId: string, itemId: string) => {
        if (!budgetId) return;
        await fetch(`/api/budgets/${budgetId}/items/${itemId}`, {
            method: "DELETE", headers: await authHeaders(),
        });
        setEnvironments(prev => prev.map(e =>
            e.id === envId ? { ...e, items: e.items.filter(i => i.id !== itemId) } : e
        ));
        onTotalsChange?.();
        toast.success("Item removido!");
    };

    const handleSaveEditItem = async (envId: string, itemId: string) => {
        if (!budgetId) return;
        const res = await fetch(`/api/budgets/${budgetId}/items/${itemId}`, {
            method: "PUT",
            headers: await authHeaders(),
            body: JSON.stringify(editItem),
        });
        if (!res.ok) { toast.error("Erro ao salvar"); return; }
        const updated = await res.json();
        setEnvironments(prev => prev.map(e =>
            e.id === envId ? { ...e, items: e.items.map(i => i.id === itemId ? { ...i, ...updated } : i) } : e
        ));
        setEditItemId(null);
        onTotalsChange?.();
        toast.success("Item atualizado!");
    };

    // ── Calcula totais localmente (sem round-trip ao servidor) ──
    const calcTotals = (envs: Environment[]): TotalsUpdate => {
        const total_prazo = Math.round(
            envs.flatMap(e => e.items)
                .filter(i => i.is_active)
                .reduce((sum, i) => sum + (i.value_prazo || 0), 0)
            * 100) / 100;
        const total_avista = Math.round(total_prazo * (1 - avistaDiscountPercent / 100) * 100) / 100;
        return { total_prazo, total_avista, environments: envs };
    };

    // ── Modo público: toggle ativo / qty ──────────────────
    const handlePublicToggle = (item: BudgetItem) => {
        // Atualização otimista: muda estado local imediatamente
        const newEnvs = environments.map(e => ({
            ...e,
            items: e.items.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i),
        }));
        setEnvironments(newEnvs);
        onTotalsChange?.(calcTotals(newEnvs));

        // Persiste em background — não aguardamos para não bloquear a UI
        fetch(`/api/public/budget/${token}/update`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item_id: item.id, is_active: !item.is_active }),
        });
    };

    const handlePublicQty = async (item: BudgetItem, qty: number) => {
        if (qty < 1) return;
        const newEnvs = environments.map(e => ({
            ...e,
            items: e.items.map(i => i.id === item.id ? { ...i, qty } : i),
        }));
        setEnvironments(newEnvs);
        onTotalsChange?.(calcTotals(newEnvs));

        fetch(`/api/public/budget/${token}/update`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item_id: item.id, qty }),
        });
    };

    const handlePublicEnvToggle = (env: Environment) => {
        const allActive = env.items.length > 0 && env.items.every(i => i.is_active);
        const newState = !allActive;

        // Atualização otimista imediata
        const newEnvs = environments.map(e =>
            e.id === env.id ? { ...e, items: e.items.map(i => ({ ...i, is_active: newState })) } : e
        );
        setEnvironments(newEnvs);
        onTotalsChange?.(calcTotals(newEnvs));

        // Persiste em background (paralelo, não bloqueia UI)
        Promise.all(
            env.items
                .filter(i => i.is_active !== newState)
                .map(item => fetch(`/api/public/budget/${token}/update`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ item_id: item.id, is_active: newState }),
                }))
        );
    };

    if (loading) return <p className="text-xs text-slate-400 animate-pulse">Carregando ambientes...</p>;

    return (
        <div className="space-y-4">
            {environments.map(env => {
                const isCollapsed = collapsed[env.id];
                const subPrazo  = env.items.filter(i => i.is_active).reduce((s, i) => s + (i.value_prazo || 0), 0);
                const subAvista = subPrazo * (1 - avistaDiscountPercent / 100);

                return (
                    <div key={env.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                        {/* cabeçalho ambiente */}
                        <div className={`flex items-center gap-2 px-4 py-3 ${isPublic ? 'bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40' : 'bg-slate-50 dark:bg-zinc-900'}`}>
                            {isPublic && (
                                <input
                                    type="checkbox"
                                    checked={env.items.length > 0 && env.items.every(i => i.is_active)}
                                    onChange={() => !readOnly && handlePublicEnvToggle(env)}
                                    disabled={readOnly}
                                    className="h-5 w-5 accent-indigo-500 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Marcar/desmarcar todos os itens deste ambiente"
                                />
                            )}
                            <button onClick={() => setCollapsed(prev => ({ ...prev, [env.id]: !prev[env.id] }))}>
                                {isCollapsed ? <ChevronRight className={`h-4 w-4 ${isPublic ? 'text-indigo-400' : 'text-slate-400'}`} /> : <ChevronDown className={`h-4 w-4 ${isPublic ? 'text-indigo-400' : 'text-slate-400'}`} />}
                            </button>

                            {editEnvId === env.id ? (
                                <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                                    <Input
                                        className="h-6 text-sm font-semibold flex-1"
                                        value={editEnvName}
                                        onChange={e => setEditEnvName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEnvName(env.id); if (e.key === 'Escape') setEditEnvId(null); }}
                                        autoFocus
                                    />
                                    <button onClick={() => handleSaveEnvName(env.id)} className="text-indigo-500 hover:text-indigo-700">
                                        <Check className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => setEditEnvId(null)} className="text-slate-400 hover:text-slate-600">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <span
                                    className={`flex-1 cursor-pointer ${isPublic ? 'font-bold text-base text-indigo-700 dark:text-indigo-300 tracking-wide' : 'font-semibold text-sm'}`}
                                    onClick={() => setCollapsed(prev => ({ ...prev, [env.id]: !prev[env.id] }))}
                                >{env.name}</span>
                            )}

                            {!readOnly && !isPublic && (
                                <>
                                    <button
                                        onClick={e => { e.stopPropagation(); setEditEnvId(env.id); setEditEnvName(env.name); }}
                                        className="text-slate-300 hover:text-indigo-500 transition-colors"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={e => { e.stopPropagation(); handleDeleteEnv(env.id); }}
                                        className="text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </>
                            )}
                        </div>

                        {!isCollapsed && (
                            <div className={`space-y-1 ${isPublic ? 'px-2 py-2' : 'p-3 space-y-1.5'}`}>
                                {/* cabeçalho tabela — oculto no mobile */}
                                <div className="hidden sm:grid text-[10px] text-slate-400 font-semibold px-1" style={{ gridTemplateColumns: isPublic ? '2rem 2.5rem 1fr 6rem 6rem' : '2rem 1fr 6rem 6rem 2.5rem' }}>
                                    {isPublic ? <span /> : null}
                                    <span className={isPublic ? '' : 'text-center'}>Qtd</span>
                                    <span>{isPublic ? 'Descrição' : 'Descrição / Dimensões'}</span>
                                    <span className="text-right">A Prazo</span>
                                    <span className="text-right border-l border-slate-200 dark:border-zinc-700 pl-2">À Vista</span>
                                    {!isPublic && <span />}
                                </div>

                                {env.items.map(item => (
                                    <div key={item.id}>
                                        {editItemId === item.id ? (
                                            <div className="bg-slate-50 dark:bg-zinc-900 rounded-lg p-2 space-y-2 border border-indigo-200 text-xs">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <Label className="text-[10px]">Descrição</Label>
                                                        <Input className="h-7 text-xs" value={editItem.description ?? item.description}
                                                            onChange={e => setEditItem(p => ({ ...p, description: e.target.value }))} />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px]">Qtd</Label>
                                                        <Input type="number" className="h-7 text-xs" value={editItem.qty ?? item.qty}
                                                            onChange={e => setEditItem(p => ({ ...p, qty: parseFloat(e.target.value) || 1 }))} />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {['alt_cm', 'larg_cm', 'prof_cm'].map(f => (
                                                        <div key={f}>
                                                            <Label className="text-[10px]">{f === 'alt_cm' ? 'Alt (cm)' : f === 'larg_cm' ? 'Larg (cm)' : 'Prof (cm)'}</Label>
                                                            <Input type="number" className="h-7 text-xs"
                                                                value={(editItem as any)[f] ?? (item as any)[f]}
                                                                onChange={e => setEditItem(p => ({ ...p, [f]: parseFloat(e.target.value) || 0 }))} />
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => handleSaveEditItem(env.id, item.id)}>
                                                        <Check className="h-3 w-3 mr-1" />Salvar
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setEditItemId(null)}>
                                                        <X className="h-3 w-3 mr-1" />Cancelar
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {/* ── Layout mobile ── */}
                                                <div className={`sm:hidden px-1 py-2 rounded transition-colors space-y-1.5 ${
                                                    isPublic ? 'hover:bg-white/60 dark:hover:bg-zinc-800/60' : ''
                                                } ${!item.is_active ? 'opacity-50' : ''}`}>
                                                    {/* linha 1: checkbox? + qtd + descrição + ações */}
                                                    <div className="flex items-start gap-2">
                                                        {isPublic && (
                                                            <input
                                                                type="checkbox"
                                                                checked={item.is_active}
                                                                onChange={() => !readOnly && handlePublicToggle(item)}
                                                                disabled={readOnly}
                                                                className="h-4 w-4 accent-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed mt-0.5 shrink-0"
                                                            />
                                                        )}
                                                        <span className="text-slate-500 text-xs tabular-nums shrink-0 w-5 text-right pt-0.5">
                                                            {String(item.qty % 1 === 0 ? Math.round(item.qty) : item.qty).padStart(2, '0')}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <span className={`block break-words text-xs ${!item.is_active ? 'line-through' : ''} ${isPublic ? 'text-slate-700 dark:text-slate-200' : 'font-medium'}`}>
                                                                {item.description}
                                                            </span>
                                                            {!isPublic && (item.alt_cm > 0 || item.larg_cm > 0 || item.prof_cm > 0) && (
                                                                <p className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
                                                                    {item.alt_cm > 0 && <span>Alt: {item.alt_cm}cm</span>}
                                                                    {item.larg_cm > 0 && <span>Larg: {item.larg_cm}cm</span>}
                                                                    {item.prof_cm > 0 && <span>Prof: {item.prof_cm}cm</span>}
                                                                    {item.alt_cm > 0 && item.larg_cm > 0 && (
                                                                        <span className="text-indigo-400 font-semibold">
                                                                            {item.price_prazo_m2 > 0 && <>{fmt(item.price_prazo_m2)}/m² · </>}
                                                                            {((item.alt_cm * item.larg_cm) / 10000).toFixed(2)} m²
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {!isPublic && (
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <button onClick={() => { setEditItemId(item.id); setEditItem({}); }}
                                                                    className="text-slate-300 hover:text-indigo-500 transition-colors p-1">
                                                                    <Pencil className="h-3 w-3" />
                                                                </button>
                                                                <button onClick={() => handleDeleteItem(env.id, item.id)}
                                                                    className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* linha 2: valores */}
                                                    <div className={`flex justify-end gap-4 text-xs font-medium pl-7 ${!item.is_active ? 'line-through' : ''}`}>
                                                        <span className="text-slate-500 text-[10px] self-center">A Prazo</span>
                                                        <span className="font-semibold">{fmt(item.value_prazo)}</span>
                                                        <span className="text-slate-500 text-[10px] self-center border-l border-slate-200 dark:border-zinc-700 pl-4">À Vista</span>
                                                        <span className="text-emerald-600 font-semibold">{fmt(item.value_prazo * (1 - avistaDiscountPercent / 100))}</span>
                                                    </div>
                                                </div>

                                                {/* ── Layout desktop ── */}
                                                <div
                                                    className={`hidden sm:grid items-center text-xs px-1 rounded transition-colors ${
                                                        !item.is_active ? 'opacity-50 line-through' : ''
                                                    } ${isPublic ? 'py-2 hover:bg-white/60 dark:hover:bg-zinc-800/60' : 'py-1.5'}`}
                                                    style={{ gridTemplateColumns: isPublic ? '2rem 2.5rem 1fr 6rem 6rem' : '2rem 1fr 6rem 6rem 2.5rem' }}
                                                >
                                                    {isPublic ? (
                                                        <>
                                                            <input
                                                                type="checkbox"
                                                                checked={item.is_active}
                                                                onChange={() => !readOnly && handlePublicToggle(item)}
                                                                disabled={readOnly}
                                                                className="h-4 w-4 accent-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                                                            />
                                                            <span className="text-slate-500 font-mono self-start pt-0.5">
                                                                {String(item.qty % 1 === 0 ? Math.round(item.qty) : item.qty).padStart(2, '0')}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-500 self-start pt-0.5">{String(item.qty % 1 === 0 ? Math.round(item.qty) : item.qty).padStart(2, '0')}</span>
                                                    )}
                                                    <div className="min-w-0">
                                                        <span className={`truncate block ${isPublic ? 'text-slate-700 dark:text-slate-200' : 'font-medium'}`}>{item.description}</span>
                                                        {!isPublic && (item.alt_cm > 0 || item.larg_cm > 0 || item.prof_cm > 0) && (
                                                            <p className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
                                                                {item.alt_cm > 0 && <span>Alt: {item.alt_cm}cm</span>}
                                                                {item.larg_cm > 0 && <span>Larg: {item.larg_cm}cm</span>}
                                                                {item.prof_cm > 0 && <span>Prof: {item.prof_cm}cm</span>}
                                                                {item.alt_cm > 0 && item.larg_cm > 0 && (
                                                                    <span className="text-indigo-400 font-semibold">
                                                                        {item.price_prazo_m2 > 0 && <>{fmt(item.price_prazo_m2)}/m² · </>}
                                                                        {((item.alt_cm * item.larg_cm) / 10000).toFixed(2)} m²
                                                                    </span>
                                                                )}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className="text-right font-medium self-start pt-0.5">{fmt(item.value_prazo)}</span>
                                                    <span className="text-right text-emerald-600 font-medium self-start pt-0.5 border-l border-slate-100 dark:border-zinc-800 pl-2">{fmt(item.value_prazo * (1 - avistaDiscountPercent / 100))}</span>
                                                    {!isPublic && (
                                                        <div className="flex items-center gap-1 justify-end self-start pt-0.5">
                                                            <button onClick={() => { setEditItemId(item.id); setEditItem({}); }}
                                                                className="text-slate-300 hover:text-indigo-500 transition-colors">
                                                                <Pencil className="h-3 w-3" />
                                                            </button>
                                                            <button onClick={() => handleDeleteItem(env.id, item.id)}
                                                                className="text-slate-300 hover:text-red-500 transition-colors">
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}

                                {/* subtotal */}
                                <div className="flex justify-end gap-3 text-xs font-bold border-t pt-1.5 mt-1">
                                    <span className="text-slate-400">Sub Total =&gt;</span>
                                    <span className="text-indigo-600 min-w-[6rem] text-right">{fmt(subPrazo)}</span>
                                    <span className="text-emerald-600 min-w-[6rem] text-right border-l border-slate-200 dark:border-zinc-700 pl-2">{fmt(subAvista)}</span>
                                </div>

                                {/* form adicionar item */}
                                {!readOnly && !isPublic && (
                                    <>
                                        {addingItemEnv === env.id ? (
                                            <div className="bg-slate-50 dark:bg-zinc-900 rounded-lg p-2 space-y-2 border border-slate-200 dark:border-zinc-700 text-xs mt-2">
                                                <div className="space-y-2">
                                                    <div>
                                                        <Label className="text-[10px]">Da tabela de preços</Label>
                                                        <select
                                                            className="w-full h-8 text-xs rounded border border-input bg-background px-2"
                                                            value={newItem.price_table_item_id}
                                                            onChange={e => handlePriceItemSelect(e.target.value)}
                                                        >
                                                            <option value="">-- selecione --</option>
                                                            {priceItems.filter(p => p.is_active).map(p => (
                                                                <option key={p.id} value={p.id}>
                                                                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.price_prazo)}/m² — {p.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px]">Descrição</Label>
                                                        <Input className="h-8 text-xs" placeholder="Descrição do móvel"
                                                            value={newItem.description}
                                                            onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2">
                                                    <div>
                                                        <Label className="text-[10px]">Qtd</Label>
                                                        <Input type="number" min={1} className="h-7 text-xs" value={newItem.qty}
                                                            onChange={e => setNewItem(p => ({ ...p, qty: parseFloat(e.target.value) || 1 }))} />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px]">Alt (cm)</Label>
                                                        <Input type="number" className="h-7 text-xs" value={newItem.alt_cm}
                                                            onChange={e => setNewItem(p => ({ ...p, alt_cm: parseFloat(e.target.value) || 0 }))} />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px]">Larg (cm)</Label>
                                                        <Input type="number" className="h-7 text-xs" value={newItem.larg_cm}
                                                            onChange={e => setNewItem(p => ({ ...p, larg_cm: parseFloat(e.target.value) || 0 }))} />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px]">Prof (cm)</Label>
                                                        <Input type="number" className="h-7 text-xs" value={newItem.prof_cm}
                                                            onChange={e => setNewItem(p => ({ ...p, prof_cm: parseFloat(e.target.value) || 0 }))} />
                                                    </div>
                                                </div>
                                                {newItem.price_prazo_m2 > 0 && (
                                                    <div className="text-[10px] text-slate-400 flex gap-3">
                                                        <span>Preço/m²: {fmt(newItem.price_prazo_m2)}</span>
                                                        <span className="font-bold text-indigo-600">
                                                            A Prazo: {fmt(calcPreview(newItem.alt_cm, newItem.larg_cm, newItem.price_prazo_m2, newItem.qty))}
                                                        </span>
                                                        {avistaDiscountPercent > 0 && (
                                                            <span className="font-bold text-emerald-600">
                                                                À Vista: {fmt(calcPreview(newItem.alt_cm, newItem.larg_cm, newItem.price_prazo_m2, newItem.qty) * (1 - avistaDiscountPercent / 100))}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex gap-2">
                                                    <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => handleAddItem(env.id)}>
                                                        <Check className="h-3 w-3 mr-1" />Adicionar
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300" onClick={() => setAddingItemEnv(null)}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <Button size="sm" variant="ghost" className="w-full h-7 text-xs text-slate-400 mt-1"
                                                onClick={() => { setAddingItemEnv(env.id); setNewItem({ price_table_item_id: "", description: "", qty: 1, alt_cm: 0, larg_cm: 0, prof_cm: 0, price_prazo_m2: 0, price_avista_m2: 0 }); }}>
                                                <Plus className="h-3 w-3 mr-1" />Adicionar Item
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Adicionar ambiente */}
            {!readOnly && !isPublic && (
                <div>
                    {addingEnv ? (
                        <div className="flex gap-2">
                            <Input className="h-8 text-sm" placeholder="Nome do ambiente (ex: QUARTO LARA)"
                                value={newEnvName} onChange={e => setNewEnvName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddEnv(); if (e.key === 'Escape') setAddingEnv(false); }}
                                autoFocus />
                            <Button size="sm" className="h-8" onClick={handleAddEnv}>Adicionar</Button>
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setAddingEnv(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <Button size="sm" variant="outline" className="w-full" onClick={() => setAddingEnv(true)}>
                            <Plus className="h-4 w-4 mr-2" />Adicionar Ambiente
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
