"use client";

import { useEffect, useState } from "react";
import { useRBAC } from "@/components/rbac-provider";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Truck, Phone, Mail, ToggleLeft, ToggleRight } from "lucide-react";

interface Supplier {
    id: string;
    name: string;
    cnpj_cpf: string;
    phone: string;
    email: string;
    address: string;
    contact_name: string;
    notes: string;
    is_active: boolean;
}

const EMPTY: Omit<Supplier, "id"> = { name: "", cnpj_cpf: "", phone: "", email: "", address: "", contact_name: "", notes: "", is_active: true };

export default function SuppliersPage() {
    const { canManageSuppliers, loading } = useRBAC();
    const router = useRouter();

    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Supplier | null>(null);
    const [form, setForm] = useState<Omit<Supplier, "id">>(EMPTY);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!loading && !canManageSuppliers) router.replace("/dashboard");
    }, [loading, canManageSuppliers, router]);

    const load = async () => {
        const res = await fetch("/api/suppliers", { cache: "no-store" });
        if (!res.ok) toast.error((await res.json().catch(() => ({}))).error || "Falha ao carregar");
        else setSuppliers((await res.json()) || []);
    };

    useEffect(() => { if (canManageSuppliers) load(); }, [canManageSuppliers]);

    const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
    const openEdit = (s: Supplier) => { setEditing(s); setForm(s); setOpen(true); };

    const save = async () => {
        if (!form.name.trim()) { toast.error("Nome é obrigatório."); return; }
        setSaving(true);
        try {
            if (editing) {
                const res = await fetch("/api/suppliers", {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...form, id: editing.id }),
                });
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao salvar");
                toast.success("Fornecedor atualizado.");
            } else {
                const res = await fetch("/api/suppliers", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(form),
                });
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao salvar");
                toast.success("Fornecedor cadastrado.");
            }
            setOpen(false);
            load();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (s: Supplier) => {
        const res = await fetch("/api/suppliers", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: s.id, is_active: !s.is_active }),
        });
        if (!res.ok) toast.error((await res.json().catch(() => ({}))).error || "Falha");
        else { toast.success(s.is_active ? "Fornecedor desativado." : "Fornecedor ativado."); load(); }
    };

    const filtered = suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.cnpj_cpf?.includes(search) ||
        s.email?.toLowerCase().includes(search.toLowerCase())
    );

    const f = (k: keyof Omit<Supplier, "id">) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({ ...prev, [k]: e.target.value }));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Fornecedores</h2>
                    <p className="text-sm text-slate-500">{suppliers.length} fornecedor(es) cadastrado(s)</p>
                </div>
                <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Fornecedor</Button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input className="pl-9" placeholder="Buscar fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map(s => (
                    <Card key={s.id} className={!s.is_active ? "opacity-60" : ""}>
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <Truck className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-sm truncate">{s.name}</p>
                                        {s.contact_name && <p className="text-xs text-slate-500 truncate">{s.contact_name}</p>}
                                    </div>
                                </div>
                                <Badge variant={s.is_active ? "default" : "secondary"} className="text-[10px] shrink-0">
                                    {s.is_active ? "Ativo" : "Inativo"}
                                </Badge>
                            </div>

                            <div className="space-y-1 text-xs text-slate-500">
                                {s.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{s.phone}</p>}
                                {s.email && <p className="flex items-center gap-1.5"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{s.email}</span></p>}
                                {s.cnpj_cpf && <p className="text-slate-400">CNPJ/CPF: {s.cnpj_cpf}</p>}
                            </div>

                            {s.notes && <p className="text-xs text-slate-400 bg-slate-50 dark:bg-zinc-900 rounded p-2 line-clamp-2">{s.notes}</p>}

                            <div className="flex items-center gap-2 pt-1">
                                <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(s)}>
                                    <Pencil className="mr-1.5 h-3.5 w-3.5" />Editar
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => toggleActive(s)}>
                                    {s.is_active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-slate-400" />}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {filtered.length === 0 && (
                    <div className="md:col-span-3 text-center py-16 text-slate-400">
                        <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhum fornecedor encontrado.</p>
                    </div>
                )}
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
                        <Field label="Nome *"><Input value={form.name} onChange={f("name")} placeholder="Razão social ou nome" /></Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="CNPJ / CPF"><Input value={form.cnpj_cpf} onChange={f("cnpj_cpf")} /></Field>
                            <Field label="Telefone"><Input value={form.phone} onChange={f("phone")} /></Field>
                        </div>
                        <Field label="E-mail"><Input value={form.email} onChange={f("email")} type="email" /></Field>
                        <Field label="Contato (pessoa)"><Input value={form.contact_name} onChange={f("contact_name")} /></Field>
                        <Field label="Endereço"><Input value={form.address} onChange={f("address")} /></Field>
                        <Field label="Observações"><Textarea value={form.notes} onChange={f("notes")} rows={3} /></Field>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <Label className="text-xs">{label}</Label>
            {children}
        </div>
    );
}
