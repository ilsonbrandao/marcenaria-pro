"use client";

import { useEffect, useState } from "react";
import { useRBAC } from "@/components/rbac-provider";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, Plus, Edit2, Trash2, Search, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OrganizationsPage() {
    const { isSysadmin, loading: rbacLoading } = useRBAC();
    const router = useRouter();

    const [organizations, setOrganizations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Modal state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formLoading, setFormLoading] = useState(false);

    // Form fields
    const [orgId, setOrgId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [cnpj, setCnpj] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [stateUF, setStateUF] = useState("");

    // Delete flow
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [orgToDelete, setOrgToDelete] = useState<any>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteCounts, setDeleteCounts] = useState<{ users: number; sales: number } | null>(null);

    useEffect(() => {
        if (!rbacLoading) {
            if (!isSysadmin) {
                router.push("/dashboard");
                return;
            }
            fetchOrganizations();
        }
    }, [rbacLoading, isSysadmin, router]);

    const fetchOrganizations = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/organizations", { cache: "no-store" });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao carregar");
            setOrganizations(await res.json());
        } catch (error: any) {
            toast.error("Erro ao carregar marcenarias", { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setOrgId(null);
        setName("");
        setCnpj("");
        setPhone("");
        setAddress("");
        setCity("");
        setStateUF("");
        setIsEditing(false);
        setDialogOpen(true);
    };

    const handleOpenEdit = (org: any) => {
        setOrgId(org.id);
        setName(org.name || "");
        setCnpj(org.cnpj || "");
        setPhone(org.phone || "");
        setAddress(org.address || "");
        setCity(org.city || "");
        setStateUF(org.state || "");
        setIsEditing(true);
        setDialogOpen(true);
    };

    const handleSaveOrg = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error("O nome da marcenaria é obrigatório.");
            return;
        }

        setFormLoading(true);
        try {
            const payload = {
                name,
                cnpj,
                phone,
                address,
                city,
                state: stateUF
            };

            if (isEditing && orgId) {
                const res = await fetch("/api/organizations", {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...payload, id: orgId }),
                });
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha");
                toast.success("Marcenaria atualizada com sucesso!");
            } else {
                const res = await fetch("/api/organizations", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha");
                toast.success("Marcenaria criada com sucesso!");
            }

            setDialogOpen(false);
            fetchOrganizations();
        } catch (error: any) {
            toast.error("Erro ao salvar marcenaria", { description: error.message });
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteClick = async (org: any) => {
        setOrgToDelete(org);
        setDeleteCounts(null);
        setDeleteDialogOpen(true);

        // Buscar contagens para mostrar ao usuário antes de confirmar
        const res = await fetch(`/api/organizations/${org.id}/counts`, { cache: "no-store" });
        const data = res.ok ? await res.json() : { users: 0, sales: 0 };
        setDeleteCounts({ users: data.users || 0, sales: data.sales || 0 });
    };

    const confirmDelete = async () => {
        if (!orgToDelete) return;
        setDeleteLoading(true);
        try {
            const res = await fetch(`/api/organizations?id=${orgToDelete.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha");
            toast.success("Marcenaria excluída com sucesso!");
            setDeleteDialogOpen(false);
            fetchOrganizations();
        } catch (error: any) {
            toast.error("Erro ao excluir", { description: error.message });
        } finally {
            setDeleteLoading(false);
        }
    };

    const filteredOrganizations = organizations.filter(org =>
        (org.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (org.cnpj?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    );

    if (rbacLoading) return <div className="p-8 text-center text-slate-500">Carregando permissões...</div>;
    if (!isSysadmin) return null;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                        Marcenarias Clientelizadas
                    </h1>
                    <p className="text-slate-500 mt-2">
                        Gerencie todas as instâncias (tenants) cadastradas no sistema.
                    </p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 shrink-0">
                    <Plus className="w-4 h-4 mr-2" /> Cadastrar Marcenaria
                </Button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center gap-4 justify-between bg-slate-50/50">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        Lista de Marcenarias
                    </h3>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por nome ou CNPJ..."
                            className="pl-9 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-400 animate-pulse">Carregando marcenarias...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Identidade</TableHead>
                                    <TableHead>Contato</TableHead>
                                    <TableHead>Localização</TableHead>
                                    <TableHead>Equipe</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredOrganizations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                            Nenhuma marcenaria encontrada.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredOrganizations.map(org => (
                                        <TableRow key={org.id}>
                                            <TableCell>
                                                <div className="font-medium text-slate-900">{org.name || "Sem Nome"}</div>
                                                <div className="text-xs text-slate-500">{org.cnpj ? `CNPJ: ${org.cnpj}` : "CNPJ não informado"}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm text-slate-600">{org.phone || "—"}</div>
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-600">
                                                {org.city || org.state ? (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" /> {org.city || ''} {org.city && org.state ? '-' : ''} {org.state || ''}
                                                    </span>
                                                ) : "—"}
                                            </TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                                    {org.member_count || 0} membro(s)
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-indigo-600" onClick={() => handleOpenEdit(org)} title="Editar">
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => handleDeleteClick(org)} title="Excluir">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {/* Form Modal */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Editar Marcenaria" : "Nova Marcenaria"}</DialogTitle>
                        <DialogDescription>
                            {isEditing ? "Altere as informações desta organização." : "Cadastre uma nova empresa na plataforma."}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveOrg} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome Empresarial ou Fantasia *</Label>
                            <Input placeholder="Ex: Marcenaria Móveis Planejados" required value={name} onChange={e => setName(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>CNPJ</Label>
                                <Input placeholder="00.000.000/0000-00" value={cnpj} onChange={e => setCnpj(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Telefone</Label>
                                <Input placeholder="(00) 00000-0000" value={phone} onChange={e => setPhone(e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Endereço Completo</Label>
                            <Input placeholder="Rua, Número, Bairro" value={address} onChange={e => setAddress(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-[1fr_80px] gap-4">
                            <div className="space-y-2">
                                <Label>Cidade</Label>
                                <Input placeholder="Ex: São Paulo" value={city} onChange={e => setCity(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>UF</Label>
                                <Input placeholder="SP" maxLength={2} value={stateUF} onChange={e => setStateUF(e.target.value.toUpperCase())} />
                            </div>
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={formLoading}>Cancelar</Button>
                            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={formLoading}>
                                {formLoading ? "Salvando..." : (isEditing ? "Salvar Alterações" : "Cadastrar Marcenaria")}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Excluir Marcenaria</DialogTitle>
                        <DialogDescription asChild>
                            <div className="space-y-3 text-sm text-slate-600">
                                <p>Você está prestes a excluir <b>{orgToDelete?.name}</b> de forma permanente.</p>
                                {deleteCounts === null ? (
                                    <p className="text-slate-400 animate-pulse">Calculando impacto...</p>
                                ) : (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                                        <p className="font-semibold text-red-700">Isso irá apagar permanentemente:</p>
                                        <p className="text-red-600">• <b>{deleteCounts.users}</b> usuário(s)</p>
                                        <p className="text-red-600">• <b>{deleteCounts.sales}</b> projeto(s)</p>
                                        <p className="text-red-600">• Todos os clientes, despesas e estoque vinculados</p>
                                    </div>
                                )}
                                <p className="font-semibold text-red-700">Esta ação não pode ser desfeita.</p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>Cancelar</Button>
                        <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading || deleteCounts === null}>
                            {deleteLoading ? "Excluindo..." : "Sim, Excluir Tudo"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
