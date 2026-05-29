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
import { Plus, Package, Layers, Search } from "lucide-react";
import { DataPagination } from "@/components/ui/data-pagination";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";

type InventoryItem = {
    id: string;
    category: "MDF" | "Ferragem";
    brand: string;
    name_or_color: string;
    thickness: number | null;
    quantity: number;
    cost_per_unit: number;
};

export default function InventoryPage() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    // Form
    const [category, setCategory] = useState<"MDF" | "Ferragem">("MDF");
    const [brand, setBrand] = useState("");
    const [nameOrColor, setNameOrColor] = useState("");
    const [thickness, setThickness] = useState("");
    const [quantity, setQuantity] = useState("");
    const [costPerUnit, setCostPerUnit] = useState("");
    const [generateExpense, setGenerateExpense] = useState(false);

    const fetchItems = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/inventory", { cache: "no-store" });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao carregar");
            setItems((await res.json()) as InventoryItem[]);
        } catch (err: any) {
            toast.error("Erro ao carregar estoque", { description: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const handleAdd = async () => {
        try {
            setFormLoading(true);
            const unitCost = parseFloat(costPerUnit.replace(/\D/g, "")) / 100 || 0;
            const parsedQuantity = parseFloat(quantity) || 0;

            const res = await fetch("/api/inventory", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    category,
                    brand: brand.trim(),
                    name_or_color: nameOrColor.trim(),
                    thickness: category === "MDF" ? parseFloat(thickness) || null : null,
                    quantity: parsedQuantity,
                    cost_per_unit: unitCost,
                    generate_expense: generateExpense,
                }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao salvar");

            toast.success("Item adicionado ao estoque!");
            setDialogOpen(false);
            setBrand("");
            setNameOrColor("");
            setThickness("");
            setQuantity("");
            setCostPerUnit("");
            setGenerateExpense(false);
            fetchItems();
        } catch (err: any) {
            toast.error("Erro ao salvar", { description: err.message });
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Tem certeza que deseja excluir '${name}' do estoque?`)) return;

        try {
            const res = await fetch(`/api/inventory?id=${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao excluir");
            toast.success("Item excluído com sucesso!");
            fetchItems();
        } catch (err: any) {
            toast.error("Erro ao excluir", { description: err.message });
        }
    };

    const formatBRL = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

    const handleFormatCost = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value.replace(/\D/g, "");
        if (!raw) return setCostPerUnit("");
        const num = parseFloat(raw) / 100;
        setCostPerUnit(
            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num)
        );
    };

    const filtered = items.filter(
        (i) =>
            i.name_or_color?.toLowerCase().includes(search.toLowerCase()) ||
            i.brand?.toLowerCase().includes(search.toLowerCase())
    );
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // KPIs
    const totalMDF = items.filter((i) => i.category === "MDF").reduce((s, i) => s + i.quantity, 0);
    const totalFerragem = items.filter((i) => i.category === "Ferragem").reduce((s, i) => s + i.quantity, 0);
    const totalStockValue = items.reduce((s, i) => s + i.quantity * i.cost_per_unit, 0);

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Estoque</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gestão de chapas MDF e ferragens disponíveis</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Plus className="h-4 w-4 mr-2" /> Novo Item
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Adicionar ao Estoque</DialogTitle>
                            <DialogDescription>Registre uma nova chapa de MDF ou ferragem.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>Categoria</Label>
                                <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MDF">Chapa MDF</SelectItem>
                                        <SelectItem value="Ferragem">Ferragem</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Marca</Label>
                                    <Input placeholder="Ex: Duratex, Arauco" value={brand} onChange={(e) => setBrand(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>{category === "MDF" ? "Cor / Acabamento" : "Nome do Item"}</Label>
                                    <Input placeholder={category === "MDF" ? "Ex: Branco TX" : "Ex: Corrediça 450mm"} value={nameOrColor} onChange={(e) => setNameOrColor(e.target.value)} />
                                </div>
                            </div>
                            {category === "MDF" && (
                                <div className="space-y-2">
                                    <Label>Espessura (mm)</Label>
                                    <Input type="number" placeholder="Ex: 15" value={thickness} onChange={(e) => setThickness(e.target.value)} />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Quantidade</Label>
                                    <Input type="number" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Custo Unitário</Label>
                                    <Input placeholder="R$ 0,00" value={costPerUnit} onChange={handleFormatCost} />
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                                <Checkbox id="genExpense" checked={generateExpense} onCheckedChange={(c) => setGenerateExpense(!!c)} />
                                <Label htmlFor="genExpense" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                                    Lançar entrada no Financeiro (Despesas)
                                </Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                            <Button onClick={handleAdd} disabled={formLoading || !nameOrColor}>
                                {formLoading ? "Salvando..." : "Adicionar"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg"><Layers className="h-4 w-4 text-amber-600" /></div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Chapas MDF</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalMDF} <span className="text-sm font-normal text-slate-400">unidades</span></p>
                </div>
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-sky-50 dark:bg-sky-900/20 rounded-lg"><Package className="h-4 w-4 text-sky-600" /></div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Ferragens</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalFerragem} <span className="text-sm font-normal text-slate-400">itens</span></p>
                </div>
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg"><Package className="h-4 w-4 text-indigo-600" /></div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Valor do Estoque</span>
                    </div>
                    <p className="text-2xl font-bold text-indigo-600">{formatBRL(totalStockValue)}</p>
                </div>
            </div>

            {/* Search + Table */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-black/5 dark:border-white/5 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">Itens em Estoque</h3>
                    <div className="relative max-w-xs w-full">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por nome ou marca..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                </div>
                {loading ? (
                    <div className="p-8 text-center text-slate-400 animate-pulse">Carregando...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">Nenhum item encontrado. Adicione pelo botão acima.</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Marca</TableHead>
                                <TableHead>Nome / Cor</TableHead>
                                <TableHead>Espessura</TableHead>
                                <TableHead className="text-right">Qtd</TableHead>
                                <TableHead className="text-right">Custo Unit.</TableHead>
                                <TableHead className="text-right">Subtotal</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginated.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${item.category === "MDF" ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20" : "bg-sky-50 text-sky-700 dark:bg-sky-900/20"}`}>
                                            {item.category}
                                        </span>
                                    </TableCell>
                                    <TableCell>{item.brand || "—"}</TableCell>
                                    <TableCell className="font-medium">{item.name_or_color}</TableCell>
                                    <TableCell>{item.thickness ? `${item.thickness}mm` : "—"}</TableCell>
                                    <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                                    <TableCell className="text-right text-slate-500">{formatBRL(item.cost_per_unit)}</TableCell>
                                    <TableCell className="text-right font-semibold text-indigo-600">{formatBRL(item.quantity * item.cost_per_unit)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={() => handleDelete(item.id, item.name_or_color)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
                <DataPagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
            </div>
        </div>
    );
}
