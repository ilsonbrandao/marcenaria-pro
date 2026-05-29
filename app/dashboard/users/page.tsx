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
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { Users, Plus, Edit2, Trash2, Search, KeyRound } from "lucide-react";
import { DataPagination } from "@/components/ui/data-pagination";
import { useRouter } from "next/navigation";

export default function UsersPage() {
    const { isSysadmin, isOwner, isOffice, canManageUsers, profile, loading: rbacLoading } = useRBAC();
    const router = useRouter();

    const [users, setUsers] = useState<any[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterRole, setFilterRole] = useState("all");
    const [filterOrg, setFilterOrg] = useState("all");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    // Modal state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formLoading, setFormLoading] = useState(false);

    // Form fields
    const [userId, setUserId] = useState<string | null>(null);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<string>("carpenter");
    const [orgId, setOrgId] = useState<string>("none");
    const [password, setPassword] = useState("");
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [stateLocation, setStateLocation] = useState("");
    const [cpf, setCpf] = useState("");
    const [phone, setPhone] = useState("");
    const [notes, setNotes] = useState("");
    const [isActive, setIsActive] = useState(true);

    // Delete flow
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<any>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        if (!rbacLoading) {
            if (!canManageUsers) {
                router.push("/dashboard");
                return;
            }
            fetchData();
        }
    }, [rbacLoading, canManageUsers, router]);

    const fetchData = async () => {
        setLoading(true);
        try {
            await Promise.all([fetchUsers(), isSysadmin ? fetchOrganizations() : null]);

        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/users", { cache: "no-store" });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Erro ao buscar usuários");
            }
            const data = await res.json();
            setUsers(data);
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const fetchOrganizations = async () => {
        const res = await fetch("/api/organizations", { cache: "no-store" });
        if (res.ok) {
            const data = await res.json();
            setOrganizations((data || []).map((o: any) => ({ id: o.id, name: o.name })));
        }
    };

    const handleOpenCreate = () => {
        setUserId(null);
        setFullName("");
        setEmail("");
        setPassword("");
        setRole("carpenter");
        setOrgId(isSysadmin ? "none" : (profile?.organization_id || "none"));
        setAddress("");
        setCity("");
        setStateLocation("");
        setCpf("");
        setPhone("");
        setNotes("");
        setIsActive(true);
        setIsEditing(false);
        setDialogOpen(true);
    };

    const handleOpenEdit = (user: any) => {
        setUserId(user.id);
        setFullName(user.full_name || "");
        setEmail(user.email || "");
        setPassword(""); // Leve em branco para não alterar
        setRole(user.role || "carpenter");
        setOrgId(user.organization_id || "none");
        setAddress(user.address || "");
        setCity(user.city || "");
        setStateLocation(user.state || "");
        setCpf(user.cpf || "");
        setPhone(user.phone || "");
        setNotes(user.notes || "");
        setIsActive(user.is_active !== false); // Se undefined/null assume true
        setIsEditing(true);
        setDialogOpen(true);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!fullName || !email || (!isEditing && !password)) {
            toast.error("Preencha todos os campos obrigatórios.");
            return;
        }

        setFormLoading(true);
        try {
            const payload = {
                id: userId,
                full_name: fullName,
                email,
                role,
                organization_id: orgId === "none" ? null : orgId,
                address,
                city,
                state: stateLocation,
                cpf,
                phone,
                notes,
                is_active: isActive,
                ...(password.trim() ? { password } : {})
            };

            const method = isEditing ? "PUT" : "POST";
            const res = await fetch("/api/users", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao salvar usuário");

            toast.success(isEditing ? "Usuário atualizado com sucesso!" : "Usuário criado com sucesso!");
            setDialogOpen(false);
            fetchUsers();

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteClick = (user: any) => {
        setUserToDelete(user);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!userToDelete) return;
        setDeleteLoading(true);
        try {
            const res = await fetch(`/api/users?id=${userToDelete.id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Erro ao excluir usuário");
            }

            toast.success("Usuário removido com sucesso!");
            setDeleteDialogOpen(false);
            fetchUsers();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setDeleteLoading(false);
        }
    };

    const getRoleName = (r: string) => {
        const map: Record<string, string> = {
            sysadmin:  'Super Admin',
            owner:     'Proprietário',
            office:    'Escritório / Adm',
            seller:    'Vendedor',
            carpenter: 'Marceneiro',
        };
        return map[r] || r;
    };

    const getRoleColor = (r: string) => {
        const map: Record<string, string> = {
            sysadmin:  'bg-purple-50 text-purple-700 border-purple-200',
            owner:     'bg-indigo-50 text-indigo-700 border-indigo-200',
            office:    'bg-emerald-50 text-emerald-700 border-emerald-200',
            seller:    'bg-amber-50 text-amber-700 border-amber-200',
            carpenter: 'bg-orange-50 text-orange-700 border-orange-200',
        };
        return map[r] || 'bg-slate-50 text-slate-600 border-slate-200';
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = (u.full_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (u.email?.toLowerCase() || "").includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === "all" || u.role === filterRole;
        const matchesOrg = filterOrg === "all" || u.organization_id === filterOrg || (!u.organization_id && filterOrg === "none");
        return matchesSearch && matchesRole && matchesOrg;
    });
    const paginatedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    if (rbacLoading) return <div className="p-8 text-center text-slate-500">Carregando permissões...</div>;
    if (!canManageUsers) return null;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                        Usuários
                    </h1>
                </div>
                <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 h-9 shrink-0 gap-2">
                    <Plus className="w-4 h-4" /> Novo Usuário
                </Button>
            </div>

            <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar usuário..."
                                className="pl-9 h-9 border-slate-200 shadow-sm"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                            />
                        </div>
                        <Select value={filterRole} onValueChange={setFilterRole}>
                            <SelectTrigger className="w-full sm:w-40 h-9 bg-white border-slate-200 shadow-sm"><SelectValue placeholder="Perfil" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Filtro: Perfis</SelectItem>
                                {isSysadmin && <SelectItem value="sysadmin">Super Admin</SelectItem>}
                                <SelectItem value="owner">Proprietário</SelectItem>
                                <SelectItem value="office">Escritório / Adm</SelectItem>
                                <SelectItem value="seller">Vendedor</SelectItem>
                                <SelectItem value="carpenter">Marceneiro</SelectItem>
                            </SelectContent>
                        </Select>
                        {isSysadmin && (
                            <Select value={filterOrg} onValueChange={setFilterOrg}>
                                <SelectTrigger className="w-full sm:w-48 h-9 bg-white border-slate-200 shadow-sm"><SelectValue placeholder="Marcenaria" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Filtro: Marcenarias</SelectItem>
                                    <SelectItem value="none">Time Global</SelectItem>
                                    {organizations.map(org => (
                                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-400 animate-pulse">Carregando usuários...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome e E-mail</TableHead>
                                    <TableHead>Perfil</TableHead>
                                    <TableHead>Status</TableHead>
                                    {isSysadmin && <TableHead>Marcenaria</TableHead>}
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                            Nenhum usuário encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedUsers.map(user => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="font-medium text-slate-900">{user.full_name || "Sem Nome"}</div>
                                                <div className="text-xs text-slate-500">{user.email || "Sem e-mail"}</div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`text-xs px-2.5 py-0.5 rounded-full border ${getRoleColor(user.role)}`}>
                                                    {getRoleName(user.role)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {user.is_active !== false ? (
                                                    <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Ativo</span>
                                                ) : (
                                                    <span className="text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">Inativo</span>
                                                )}
                                            </TableCell>
                                            {isSysadmin && (
                                                <TableCell className="text-slate-600">
                                                    {user.organizations?.name || <span className="text-slate-400 italic">Global</span>}
                                                </TableCell>
                                            )}
                                            <TableCell className="text-right flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-indigo-600" onClick={() => handleOpenEdit(user)} title="Editar">
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                {user.id !== profile?.id && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => handleDeleteClick(user)} title="Excluir">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
                <DataPagination page={page} pageSize={PAGE_SIZE} total={filteredUsers.length} onPageChange={setPage} />
            </div>

            {/* Form Modal */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="pb-2 border-b border-slate-100">
                        <DialogTitle className="text-xl font-semibold text-slate-800">
                            {isEditing ? "Editar Usuário" : "Novo Usuário"}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveUser} className="space-y-6 py-4">

                        {/* Seção Principal */}
                        <div className="space-y-4 mb-6">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                                Dados de Acesso
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-600">Endereço de E-mail</Label>
                                    <Input type="email" placeholder="email@exemplo.com" required disabled={isEditing} value={email} onChange={e => setEmail(e.target.value)} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-600">{isEditing ? "Nova Senha (Opcional)" : "Senha Inicial"}</Label>
                                    <Input type="password" placeholder="******" required={!isEditing} value={password} onChange={e => setPassword(e.target.value)} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-600">Nível de Acesso (Perfil)</Label>
                                    <Select value={role} onValueChange={setRole}>
                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {isSysadmin && <SelectItem value="sysadmin">Super Admin (Global)</SelectItem>}
                                            <SelectItem value="owner">Proprietário (Acesso Total)</SelectItem>
                                            <SelectItem value="office">Escritório / Adm (Financeiro)</SelectItem>
                                            <SelectItem value="seller">Vendedor (Comercial)</SelectItem>
                                            <SelectItem value="carpenter">Marceneiro (Produção)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {isSysadmin && (
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-slate-600">Vincular a uma Marcenaria</Label>
                                        <Select value={orgId} onValueChange={setOrgId}>
                                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Global (Nenhuma / Sysadmin)</SelectItem>
                                                {organizations.map(org => (
                                                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Seção Pessoal */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    Informações do Usuário
                                </h4>
                                {isEditing && (
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${isActive ? 'text-emerald-500' : 'text-slate-400'}`}>Status:</span>
                                        <Select value={isActive ? "active" : "inactive"} onValueChange={(v) => setIsActive(v === "active")}>
                                            <SelectTrigger className="w-[100px] h-7 text-xs bg-slate-50 border-slate-200"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="active">Ativo</SelectItem>
                                                <SelectItem value="inactive">Inativo</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-600">Nome Completo</Label>
                                    <Input placeholder="Ex: João Silva" required value={fullName} onChange={e => setFullName(e.target.value)} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-600">CPF</Label>
                                    <Input placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(e.target.value)} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-600">Telefone / WhatsApp</Label>
                                    <Input placeholder="(00) 00000-0000" value={phone} onChange={e => setPhone(e.target.value)} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-600">Cidade</Label>
                                    <Input placeholder="Ex: São Paulo" value={city} onChange={e => setCity(e.target.value)} className="h-9" />
                                </div>
                                <div className="space-y-1.5 md:col-span-2 flex gap-4">
                                    <div className="flex-1 space-y-1.5">
                                        <Label className="text-xs text-slate-600">Endereço Completo</Label>
                                        <Input placeholder="Rua, Número, Bairro" value={address} onChange={e => setAddress(e.target.value)} className="h-9" />
                                    </div>
                                    <div className="w-24 space-y-1.5">
                                        <Label className="text-xs text-slate-600">UF</Label>
                                        <Input placeholder="SP" maxLength={2} className="uppercase h-9 text-center" value={stateLocation} onChange={e => setStateLocation(e.target.value.toUpperCase())} />
                                    </div>
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <Label className="text-xs text-slate-600">Observações</Label>
                                    <Input placeholder="Anotações internas sobre este usuário..." value={notes} onChange={e => setNotes(e.target.value)} className="h-9" />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={formLoading}>Cancelar</Button>
                            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={formLoading}>
                                {formLoading ? "Salvando..." : (isEditing ? "Salvar Alterações" : "Criar Usuário")}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Remover Acesso</DialogTitle>
                        <DialogDescription>
                            Você está prestes a excluir a conta de <b>{userToDelete?.full_name}</b>. Isso revogará o acesso dele ao sistema e não pode ser desfeito. Deseja continuar?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>Cancelar</Button>
                        <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
                            {deleteLoading ? "Excluindo..." : "Sim, Excluir Usuário"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
