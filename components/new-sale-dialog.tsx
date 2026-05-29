"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

type OptionItem = { id: string; name: string };

export function NewSaleDialog({ onSaleAdded }: { onSaleAdded: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [clientName, setClientName] = useState("");
    const [totalValue, setTotalValue] = useState("");
    const [description, setDescription] = useState("");

    // Selects de clientes e arquitetos
    const [clients, setClients] = useState<OptionItem[]>([]);
    const [architects, setArchitects] = useState<OptionItem[]>([]);
    const [selectedClient, setSelectedClient] = useState("");
    const [selectedArchitect, setSelectedArchitect] = useState("");

    useEffect(() => {
        if (open) {
            fetch("/api/clients", { cache: "no-store" })
                .then((r) => (r.ok ? r.json() : []))
                .then((d) => setClients((d || []).map((c: any) => ({ id: c.id, name: c.name }))));
            fetch("/api/architects", { cache: "no-store" })
                .then((r) => (r.ok ? r.json() : { architects: [] }))
                .then((d) => setArchitects((d.architects || []).map((a: any) => ({ id: a.id, name: a.name }))));
        }
    }, [open]);

    // Quando seleciona um cliente do cadastro, preenche o nome automaticamente
    const handleClientSelect = (clientId: string) => {
        setSelectedClient(clientId);
        const found = clients.find((c) => c.id === clientId);
        if (found) setClientName(found.name);
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const val = parseFloat(totalValue.replace(/\D/g, "")) / 100 || 0;

            const payload: any = {
                client_name: clientName.trim(),
                total_value: val,
                status: 'Orçamento',
                notes: description.trim() || null,
            };
            if (selectedClient) payload.client_id = selectedClient;
            if (selectedArchitect) payload.architect_id = selectedArchitect;

            const res = await fetch('/api/sales', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha");

            toast.success("Projeto criado!", { description: "O novo orçamento foi adicionado ao Kanban." });
            setOpen(false);
            setClientName("");
            setTotalValue("");
            setDescription("");
            setSelectedClient("");
            setSelectedArchitect("");
            onSaleAdded();
        } catch (error: any) {
            toast.error("Erro ao criar venda", { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleFormatValue = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value.replace(/\D/g, "");
        if (!raw) return setTotalValue("");

        const num = parseFloat(raw) / 100;
        setTotalValue(
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm">
                    <Plus className="h-4 w-4 mr-2" /> Novo Projeto
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Lançar Novo Projeto</DialogTitle>
                    <DialogDescription>
                        Adicione as informações iniciais do fechamento (ou orçamento).
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Cliente do cadastro */}
                    {clients.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <Label>Cliente (Cadastrado)</Label>
                            <Select value={selectedClient} onValueChange={handleClientSelect}>
                                <SelectTrigger><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
                                <SelectContent>
                                    {clients.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="clientName">Nome do Projeto / Cliente</Label>
                        <Input
                            id="clientName"
                            placeholder="Ex: Cozinha Planejada Sra. Ana"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="totalValue">Valor Total da Venda</Label>
                        <Input
                            id="totalValue"
                            placeholder="R$ 0,00"
                            value={totalValue}
                            onChange={handleFormatValue}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="description">Observações (Opcional)</Label>
                        <Input
                            id="description"
                            placeholder="Ex: Cozinha + sala, entrega em 60 dias"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Arquiteto parceiro */}
                    {architects.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <Label>Arquiteto Parceiro (Opcional)</Label>
                            <Select value={selectedArchitect} onValueChange={setSelectedArchitect}>
                                <SelectTrigger><SelectValue placeholder="Selecionar arquiteto..." /></SelectTrigger>
                                <SelectContent>
                                    {architects.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-slate-400">Se selecionado, o RT padrão do arquiteto será aplicado automaticamente.</p>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={loading || !clientName || !totalValue}>
                        {loading ? "Salvando..." : "Salvar Projeto"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
