"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Save, Building2, CreditCard, Smartphone, FileText, Camera, User, Phone, Mail, MapPin, Hash, BadgeCheck, Clock } from "lucide-react";
import { useRBAC } from "@/components/rbac-provider";
import { AuthService } from "@/services/authService";
import { toast } from "sonner";

export default function SettingsPage() {
    const { profile, isSysadmin, isOwner, isOffice } = useRBAC();

    const [loadingCompany, setLoadingCompany] = useState(false);
    const [loadingPayment, setLoadingPayment] = useState(false);
    const [loadingObs, setLoadingObs]         = useState(false);

    const [companyData, setCompanyData] = useState({
        name: "", company_name: "", cnpj: "", state_registration: "",
        phone: "", email: "", address: "",
        owner_name: "", owner_cpf: "", owner_phone: "",
        budget_validity_days: 30,
    });
    const [logoUrl, setLogoUrl]         = useState("");
    const [uploadingLogo, setUploadingLogo] = useState(false);

    const [paymentDefaults, setPaymentDefaults] = useState({
        default_payment_type:            "both",
        default_prazo_entry_percent:     30,
        default_prazo_installments:      12,
        default_avista_discount_percent: 10,
        default_avista_entry_percent:    50,
    });

    const [defaultObs, setDefaultObs] = useState("");

    // A sessão vai por cookie httpOnly (Auth.js); não há header a enviar.
    const authHeader = async (): Promise<Record<string, string>> => ({});

    useEffect(() => {
        const fetchOrg = async () => {
            if (!profile?.organization_id) return;
            const h = await authHeader();
            const res = await fetch('/api/settings', { headers: h });
            if (!res.ok) return;
            const data = await res.json();
            setLogoUrl(data.logo_url || "");
            setCompanyData({
                name:                 data.name               || "",
                company_name:         data.company_name       || "",
                cnpj:                 data.cnpj               || "",
                state_registration:   data.state_registration || "",
                phone:                data.phone              || "",
                email:                data.email              || "",
                address:              data.address            || "",
                owner_name:           data.owner_name         || "",
                owner_cpf:            data.owner_cpf          || "",
                owner_phone:          data.owner_phone        || "",
                budget_validity_days: data.budget_validity_days ?? 30,
            });
            setPaymentDefaults({
                default_payment_type:            data.default_payment_type           ?? "both",
                default_prazo_entry_percent:      data.default_prazo_entry_percent     ?? 30,
                default_prazo_installments:       data.default_prazo_installments      ?? 12,
                default_avista_discount_percent:  data.default_avista_discount_percent ?? 10,
                default_avista_entry_percent:     data.default_avista_entry_percent    ?? 50,
            });
            setDefaultObs(data.default_budget_observations || "");
        };
        fetchOrg();
    }, [profile]);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingLogo(true);
        try {
            const h = await authHeader();
            const form = new FormData();
            form.append('file', file);
            const res = await fetch('/api/settings/logo', { method: 'POST', headers: h, body: form });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setLogoUrl(data.logo_url);
            toast.success("Logo atualizado com sucesso!");
        } catch (e: any) {
            toast.error("Erro ao enviar logo", { description: e.message });
        } finally {
            setUploadingLogo(false);
            e.target.value = "";
        }
    };

    const handleSaveCompany = async () => {
        setLoadingCompany(true);
        try {
            const h = await authHeader();
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { ...h, 'Content-Type': 'application/json' },
                body: JSON.stringify(companyData),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success("Dados da marcenaria salvos!");
        } catch (e: any) {
            toast.error("Erro ao salvar", { description: e.message });
        } finally {
            setLoadingCompany(false);
        }
    };

    const handleSavePayment = async () => {
        setLoadingPayment(true);
        try {
            const h = await authHeader();
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { ...h, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...paymentDefaults, budget_validity_days: companyData.budget_validity_days }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success("Preferências de pagamento salvas!", {
                description: "Novos orçamentos já usarão esses valores.",
            });
        } catch (e: any) {
            toast.error("Erro ao salvar", { description: e.message });
        } finally {
            setLoadingPayment(false);
        }
    };

    const handleSaveObs = async () => {
        setLoadingObs(true);
        try {
            const h = await authHeader();
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { ...h, 'Content-Type': 'application/json' },
                body: JSON.stringify({ default_budget_observations: defaultObs }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success("Observações padrão salvas!");
        } catch (e: any) {
            toast.error("Erro ao salvar", { description: e.message });
        } finally {
            setLoadingObs(false);
        }
    };

    const isEditable  = isSysadmin || isOwner || isOffice;
    const showPrazo   = paymentDefaults.default_payment_type === 'prazo'  || paymentDefaults.default_payment_type === 'both';
    const showAvista  = paymentDefaults.default_payment_type === 'avista' || paymentDefaults.default_payment_type === 'both';

    return (
        <div className="max-w-2xl space-y-6">

            {/* Cabeçalho */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Configurações</h1>
                <p className="text-sm text-slate-500 mt-1">Gerencie os dados da sua marcenaria e as preferências do sistema</p>
            </div>

            {/* ── DADOS DA MARCENARIA ───────────────────────────────── */}
            <section className="rounded-xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden shadow-sm">
                {/* Topo do card */}
                <div className="flex items-center justify-between px-5 py-4 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-indigo-500" />
                        <h2 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Dados da Marcenaria</h2>
                    </div>
                    {!isEditable && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Somente leitura</span>
                    )}
                </div>

                <div className="p-5 space-y-6">
                    {/* Logo */}
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Logo da Empresa</p>
                        <div className="flex items-center gap-4">
                            <div className="h-20 w-20 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-700 overflow-hidden flex items-center justify-center bg-slate-50 dark:bg-zinc-900 shrink-0">
                                {logoUrl
                                    ? <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
                                    : <Building2 className="h-8 w-8 text-slate-300" />}
                            </div>
                            {isEditable && (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-slate-500">Formatos aceitos: PNG, JPG ou SVG (máx. 2 MB)</p>
                                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 dark:border-zinc-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                                        <Camera className="h-3.5 w-3.5" />
                                        {uploadingLogo ? "Enviando..." : "Escolher imagem"}
                                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                                    </label>
                                    {logoUrl && <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1"><BadgeCheck className="h-3 w-3" />Logo cadastrado</p>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Dados da empresa */}
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Dados da Empresa</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Razão Social" icon={<Hash className="h-3.5 w-3.5" />}>
                                <Input value={companyData.company_name} disabled={!isEditable}
                                    placeholder="Razão Social Ltda."
                                    onChange={e => setCompanyData(p => ({ ...p, company_name: e.target.value }))} />
                            </Field>
                            <Field label="Nome Fantasia" icon={<Building2 className="h-3.5 w-3.5" />}>
                                <Input value={companyData.name} disabled={!isEditable}
                                    placeholder="Nome da marcenaria"
                                    onChange={e => setCompanyData(p => ({ ...p, name: e.target.value }))} />
                            </Field>
                            <Field label="CNPJ">
                                <Input value={companyData.cnpj} disabled={!isEditable}
                                    placeholder="00.000.000/0000-00"
                                    onChange={e => setCompanyData(p => ({ ...p, cnpj: e.target.value }))} />
                            </Field>
                            <Field label="Inscrição Estadual">
                                <Input value={companyData.state_registration} disabled={!isEditable}
                                    placeholder="000.000.000.000"
                                    onChange={e => setCompanyData(p => ({ ...p, state_registration: e.target.value }))} />
                            </Field>
                            <Field label="Telefone" icon={<Phone className="h-3.5 w-3.5" />}>
                                <Input value={companyData.phone} disabled={!isEditable}
                                    placeholder="(00) 00000-0000"
                                    onChange={e => setCompanyData(p => ({ ...p, phone: e.target.value }))} />
                            </Field>
                            <Field label="E-mail" icon={<Mail className="h-3.5 w-3.5" />}>
                                <Input value={companyData.email} disabled={!isEditable}
                                    placeholder="contato@suamarcenaria.com.br"
                                    onChange={e => setCompanyData(p => ({ ...p, email: e.target.value }))} />
                            </Field>
                            <div className="md:col-span-2">
                                <Field label="Endereço" icon={<MapPin className="h-3.5 w-3.5" />}>
                                    <Input value={companyData.address} disabled={!isEditable}
                                        placeholder="Rua, número, bairro, cidade - UF"
                                        onChange={e => setCompanyData(p => ({ ...p, address: e.target.value }))} />
                                </Field>
                            </div>
                        </div>
                    </div>

                    {/* Dados do proprietário */}
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Dados do Proprietário</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <Field label="Nome Completo" icon={<User className="h-3.5 w-3.5" />}>
                                    <Input value={companyData.owner_name} disabled={!isEditable}
                                        placeholder="Nome completo do proprietário"
                                        onChange={e => setCompanyData(p => ({ ...p, owner_name: e.target.value }))} />
                                </Field>
                            </div>
                            <Field label="CPF">
                                <Input value={companyData.owner_cpf} disabled={!isEditable}
                                    placeholder="000.000.000-00"
                                    onChange={e => setCompanyData(p => ({ ...p, owner_cpf: e.target.value }))} />
                            </Field>
                            <Field label="Telefone" icon={<Phone className="h-3.5 w-3.5" />}>
                                <Input value={companyData.owner_phone} disabled={!isEditable}
                                    placeholder="(00) 00000-0000"
                                    onChange={e => setCompanyData(p => ({ ...p, owner_phone: e.target.value }))} />
                            </Field>
                        </div>
                    </div>

                    {isEditable && (
                        <div className="pt-1">
                            <Button onClick={handleSaveCompany} disabled={loadingCompany} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                <Save className="h-4 w-4 mr-2" />
                                {loadingCompany ? "Salvando..." : "Salvar Dados da Empresa"}
                            </Button>
                        </div>
                    )}
                </div>
            </section>

            {/* ── PREFERÊNCIAS DE PAGAMENTO ─────────────────────────── */}
            {isEditable && (
                <section className="rounded-xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2 px-5 py-4 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
                        <CreditCard className="h-4 w-4 text-indigo-500" />
                        <div>
                            <h2 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Preferências de Pagamento</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Valores padrão ao criar novos orçamentos — podem ser ajustados em cada orçamento individualmente.</p>
                        </div>
                    </div>

                    <div className="p-5 space-y-5">
                        <Field label="Modalidade padrão">
                            <Select
                                value={paymentDefaults.default_payment_type}
                                onValueChange={v => setPaymentDefaults(p => ({ ...p, default_payment_type: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="both">A Prazo e À Vista</SelectItem>
                                    <SelectItem value="prazo">Somente A Prazo (Cartão)</SelectItem>
                                    <SelectItem value="avista">Somente À Vista (PIX)</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>

                        {showPrazo && (
                            <div className="rounded-lg border border-indigo-100 bg-indigo-50 dark:bg-indigo-900/10 dark:border-indigo-900/30 p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <CreditCard className="h-4 w-4 text-indigo-500" />
                                    <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">A Prazo — Cartão de Crédito</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Entrada padrão (%)">
                                        <Input type="number" min={0} max={100}
                                            value={paymentDefaults.default_prazo_entry_percent}
                                            onChange={e => setPaymentDefaults(p => ({ ...p, default_prazo_entry_percent: parseFloat(e.target.value) || 0 }))} />
                                    </Field>
                                    <Field label="Número de parcelas">
                                        <Input type="number" min={1} max={60}
                                            value={paymentDefaults.default_prazo_installments}
                                            onChange={e => setPaymentDefaults(p => ({ ...p, default_prazo_installments: parseInt(e.target.value) || 1 }))} />
                                    </Field>
                                </div>
                            </div>
                        )}

                        {showAvista && (
                            <div className="rounded-lg border border-emerald-100 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-900/30 p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Smartphone className="h-4 w-4 text-emerald-600" />
                                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">À Vista — PIX</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Desconto padrão (%)">
                                        <Input type="number" min={0} max={100}
                                            value={paymentDefaults.default_avista_discount_percent}
                                            onChange={e => setPaymentDefaults(p => ({ ...p, default_avista_discount_percent: parseFloat(e.target.value) || 0 }))} />
                                    </Field>
                                    <Field label="Entrada padrão (%)">
                                        <Input type="number" min={0} max={100}
                                            value={paymentDefaults.default_avista_entry_percent}
                                            onChange={e => setPaymentDefaults(p => ({ ...p, default_avista_entry_percent: parseFloat(e.target.value) || 0 }))} />
                                    </Field>
                                </div>
                            </div>
                        )}

                        <Field label="Validade do Orçamento (dias)" icon={<Clock className="h-3.5 w-3.5" />}>
                            <Input type="number" min={1} max={365} value={companyData.budget_validity_days}
                                placeholder="30"
                                onChange={e => setCompanyData(p => ({ ...p, budget_validity_days: parseInt(e.target.value) || 30 }))} />
                            <p className="text-xs text-slate-400 mt-1">Prazo de validade exibido no PDF do orçamento.</p>
                        </Field>

                        <Button onClick={handleSavePayment} disabled={loadingPayment} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Save className="h-4 w-4 mr-2" />
                            {loadingPayment ? "Salvando..." : "Salvar Preferências"}
                        </Button>
                    </div>
                </section>
            )}

            {/* ── OBSERVAÇÕES PADRÃO ────────────────────────────────── */}
            {isEditable && (
                <section className="rounded-xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2 px-5 py-4 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
                        <FileText className="h-4 w-4 text-indigo-500" />
                        <div>
                            <h2 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Observações Padrão do Orçamento</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Texto pré-preenchido em todo novo orçamento. Pode ser editado a qualquer momento em cada orçamento.</p>
                        </div>
                    </div>
                    <div className="p-5 space-y-4">
                        <Textarea
                            rows={5}
                            className="resize-none text-sm"
                            placeholder={"Ex: Incluso portas com amortecimento e gavetas telescópicas.\nGarantia de 1 ano contra defeitos de fabricação.\nPrazo de entrega: 45 dias úteis após aprovação."}
                            value={defaultObs}
                            onChange={e => setDefaultObs(e.target.value)}
                        />
                        <Button onClick={handleSaveObs} disabled={loadingObs} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Save className="h-4 w-4 mr-2" />
                            {loadingObs ? "Salvando..." : "Salvar Observações"}
                        </Button>
                    </div>
                </section>
            )}

            {/* ── SOBRE O SISTEMA ───────────────────────────────────── */}
            <section className="rounded-xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shrink-0">
                        M
                    </div>
                    <div className="space-y-0.5">
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">Fresa</p>
                        <p className="text-xs text-slate-500">Sistema de gestão para marcenarias e lojas de planejados</p>
                        <p className="text-xs text-slate-400 pt-1">
                            Desenvolvido por <span className="font-semibold text-slate-600 dark:text-slate-300">Ilson Brandão</span>
                        </p>
                        <p className="text-xs text-slate-400">© {new Date().getFullYear()} — Todos os direitos reservados.</p>
                    </div>
                </div>
            </section>

        </div>
    );
}

// ── Componente auxiliar de campo ──────────────────────────
function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                {icon && <span className="text-slate-400">{icon}</span>}
                {label}
            </Label>
            {children}
        </div>
    );
}
