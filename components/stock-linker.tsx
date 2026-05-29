"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Minus, Plus } from "lucide-react";

type InventoryItem = {
    id: string;
    category: string;
    brand: string;
    name_or_color: string;
    thickness: number | null;
    quantity: number;
};

type StockMovement = {
    id: string;
    inventory_id: string;
    movement_type: "IN" | "OUT";
    quantity: number;
    notes: string;
    created_at: string;
    inventory?: InventoryItem;
};

interface StockLinkerProps {
    saleId: string;
    projectName: string;
}

export function StockLinker({ saleId, projectName }: StockLinkerProps) {
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);

    // Form
    const [selectedItem, setSelectedItem] = useState("");
    const [qty, setQty] = useState("1");

    const fetchData = async () => {
        try {
            setLoading(true);
            const [movRes, invRes] = await Promise.all([
                fetch(`/api/stock-movements?saleId=${saleId}`, { cache: "no-store" }),
                fetch("/api/inventory", { cache: "no-store" }),
            ]);
            if (!movRes.ok) throw new Error((await movRes.json().catch(() => ({}))).error || "Falha");
            if (!invRes.ok) throw new Error((await invRes.json().catch(() => ({}))).error || "Falha");

            setMovements((await movRes.json()) as StockMovement[]);
            const inv = (await invRes.json()) as InventoryItem[];
            setInventory(inv.filter((i) => i.quantity > 0));
        } catch (err: any) {
            toast.error("Erro ao carregar movimentações", { description: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (saleId) fetchData();
    }, [saleId]);

    const handleAddOutput = async () => {
        try {
            const qtyNum = parseFloat(qty) || 0;
            if (qtyNum <= 0) throw new Error("Quantidade inválida.");

            const item = inventory.find((i) => i.id === selectedItem);
            if (!item) throw new Error("Item não encontrado.");
            if (item.quantity < qtyNum) throw new Error(`Estoque insuficiente. Disponível: ${item.quantity}`);

            const res = await fetch("/api/stock-movements", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    inventory_id: selectedItem, sale_id: saleId, quantity: qtyNum,
                    notes: `Saída para projeto: ${projectName}`,
                }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha");

            toast.success("Material vinculado!", { description: `${qtyNum}x ${item.name_or_color} retirado do estoque.` });
            setShowAdd(false);
            setSelectedItem("");
            setQty("1");
            fetchData();
        } catch (err: any) {
            toast.error("Erro", { description: err.message });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-indigo-500" />
                    <h3 className="font-semibold text-sm">Materiais Utilizados</h3>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)} className="text-xs h-7">
                    <Minus className="h-3 w-3 mr-1" /> Retirar Material
                </Button>
            </div>

            {/* Formulário */}
            {showAdd && (
                <div className="bg-slate-50 dark:bg-zinc-900 rounded-lg p-3 space-y-3 border border-slate-100 dark:border-zinc-800">
                    <div className="space-y-1">
                        <Label className="text-xs">Material do Estoque</Label>
                        <Select value={selectedItem} onValueChange={setSelectedItem}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Selecione o material" />
                            </SelectTrigger>
                            <SelectContent>
                                {inventory.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                        <span className="font-medium">{item.name_or_color}</span>
                                        <span className="text-slate-400 ml-1">
                                            ({item.category}{item.thickness ? ` ${item.thickness}mm` : ""} — {item.brand || "Sem marca"})
                                        </span>
                                        <span className="text-emerald-600 ml-1 font-bold">Disp: {item.quantity}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Quantidade</Label>
                        <Input className="h-8 text-xs" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
                    </div>
                    <Button size="sm" className="w-full h-7 text-xs bg-orange-600 hover:bg-orange-700" onClick={handleAddOutput} disabled={!selectedItem || !qty}>
                        Confirmar Retirada
                    </Button>
                </div>
            )}

            {/* Lista de Movimentações */}
            {loading ? (
                <p className="text-xs text-slate-400 animate-pulse">Carregando...</p>
            ) : movements.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">Nenhum material vinculado a este projeto.</p>
            ) : (
                <div className="space-y-2">
                    {movements.map((mov) => (
                        <div
                            key={mov.id}
                            className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 text-xs"
                        >
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${mov.movement_type === "OUT" ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
                                }`}>
                                {mov.movement_type === "OUT" ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-700 dark:text-slate-200 truncate">
                                    {mov.inventory?.name_or_color || "Item removido"}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {mov.inventory?.category}{mov.inventory?.thickness ? ` ${mov.inventory.thickness}mm` : ""} • {new Date(mov.created_at).toLocaleDateString("pt-BR")}
                                </p>
                            </div>
                            <p className="font-bold text-red-600 shrink-0">-{mov.quantity}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
