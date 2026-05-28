"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRBAC } from "@/components/rbac-provider";
import { toast } from "sonner";
import { AuthService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BudgetEnvironmentEditor } from "@/components/budget-environment-editor";
import { BudgetPaymentSimulator } from "@/components/budget-payment-simulator";
import { generateBudgetPDF } from "@/lib/generate-budget-pdf";
import { ArrowLeft, FileText, Share2, LockOpen, Copy, ShieldCheck, Clock, Send, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Budget {
    id: string;
    client_name: string;
    client_address: string;
    budget_number: string;
    payment_type: 'prazo' | 'avista' | 'both';
    total_prazo: number;
    total_avista: number;
    prazo_entry_percent: number;
    prazo_installments: number;
    avista_discount_percent: number;
    avista_entry_percent: number;
    observations: string;
    status: 'draft' | 'sent' | 'approved' | 'rejected';
    public_token: string;
    sale_id: string | null;
    created_by_name: string | null;
    environments: any[];
}

const STATUS_INFO: Record<string, { text: string; icon: any; bg: string; border: string; text_c: string }> = {
    draft:    { text: "Rascunho — não enviado", icon: Clock,       bg: "bg-slate-50 dark:bg-zinc-800/40",       border: "border-slate-200 dark:border-zinc-700",      text_c: "text-slate-500 dark:text-slate-400"     },
    sent:     { text: "Aguardando Aprovação",    icon: Send,        bg: "bg-indigo-50 dark:bg-indigo-900/20",    border: "border-indigo-200 dark:border-indigo-800",   text_c: "text-indigo-600 dark:text-indigo-400"   },
    approved: { text: "Contrato Autorizado",     icon: ShieldCheck, bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800", text_c: "text-emerald-600 dark:text-emerald-400" },
    rejected: { text: "Orçamento Recusado",      icon: Clock,       bg: "bg-red-50 dark:bg-red-900/20",         border: "border-red-200 dark:border-red-800",         text_c: "text-red-500 dark:text-red-400"         },
};

const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function BudgetDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { isCarpenter, loading: rbacLoading, profile } = useRBAC();

    const [budget, setBudget]     = useState<Budget | null>(null);
    const [loading, setLoading]   = useState(true);
    const [shareUrl, setShareUrl] = useState("");
    const [shareOpen, setShareOpen] = useState(false);
    const [orgData, setOrgData] = useState<{
        name: string; company_name?: string; cnpj?: string;
        phone?: string; email?: string; address?: string; owner_name?: string;
        logo_url?: string; budget_validity_days?: number;
    }>({ name: "Marcenaria Pro" });
    const [selectedPayment, setSelectedPayment] = useState<'prazo' | 'avista' | null>(null);

    const obsRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!rbacLoading && isCarpenter) router.replace("/dashboard");
    }, [rbacLoading, isCarpenter, router]);

    const authHeader = async () => {
        const tok = await AuthService.getAccessToken();
        return { Authorization: `Bearer ${tok}` };
    };

    const load = useCallback(async () => {
        try {
            const h = await authHeader();
            const res = await fetch(`/api/budgets/${id}`, { headers: h });
            if (!res.ok) { router.replace('/dashboard/budgets'); return; }
            const data = await res.json();
            setBudget(data);
            if (data.payment_type === 'prazo' || data.payment_type === 'avista') {
                setSelectedPayment(data.payment_type);
            } else {
                setSelectedPayment(null);
            }
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { if (!isCarpenter) load(); }, [load, isCarpenter]);

    // carrega dados da org para o PDF
    useEffect(() => {
        supabase.from('organizations')
            .select('name, company_name, cnpj, phone, email, address, owner_name, logo_url, budget_validity_days')
            .single()
            .then(({ data }) => { if (data) setOrgData(data); });
    }, []);

    const patch = async (updates: Partial<Budget>): Promise<boolean> => {
        const h = await authHeader();
        const res = await fetch(`/api/budgets/${id}`, {
            method: 'PUT',
            headers: { ...h, 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            toast.error("Erro ao salvar", { description: err.error || "Tente novamente." });
            return false;
        }
        const data = await res.json();
        setBudget(prev => prev ? { ...prev, ...data } : null);
        return true;
    };

    const handleObsChange = (val: string) => {
        setBudget(prev => prev ? { ...prev, observations: val } : null);
        if (obsRef.current) clearTimeout(obsRef.current);
        obsRef.current = setTimeout(() => patch({ observations: val }), 800);
    };

    const handlePaymentChange = (updates: any) => {
        setBudget(prev => prev ? { ...prev, ...updates } : null);
        if (obsRef.current) clearTimeout(obsRef.current);
        obsRef.current = setTimeout(() => patch(updates), 800);
    };

    const handleStatus = async (status: string, paymentType?: 'prazo' | 'avista') => {
        const updates: any = { status };
        if (paymentType) updates.payment_type = paymentType;
        return patch(updates);
    };

    const handleApproveConfirm = async () => {
        if (!selectedPayment) { toast.error("Selecione uma condição de pagamento na seção abaixo."); return; }
        const ok = await handleStatus('approved', selectedPayment);
        if (ok) toast.success("Contrato autorizado! Orçamento bloqueado para edição.");
    };

    const handleReopen = async () => {
        const ok = await patch({ status: 'sent', payment_type: 'both' });
        if (ok) {
            setSelectedPayment(null);
            toast.success("Orçamento reaberto para edição.");
        }
    };

    const handleShare = async () => {
        const h = await authHeader();
        const res = await fetch(`/api/budgets/${id}/share`, { headers: h });
        const { public_url } = await res.json();
        setShareUrl(public_url);
        setShareOpen(true);
        // marca como enviado automaticamente
        if (budget?.status === 'draft') {
            await patch({ status: 'sent' });
        }
    };


    const handleGeneratePDF = async () => {
        if (!budget) return;
        const activeEnvs = budget.environments.map((env: any) => ({
            name: env.name,
            items: env.items.filter((i: any) => i.is_active).map((i: any) => ({
                description: i.description,
                qty: i.qty,
                alt_cm: i.alt_cm,
                larg_cm: i.larg_cm,
                value_prazo: i.value_prazo,
                value_avista: i.value_avista,
                is_active: true,
            })),
        })).filter((e: any) => e.items.length > 0);

        const validityDays = orgData.budget_validity_days || 30;
        const validity = new Date();
        validity.setDate(validity.getDate() + validityDays);

        await generateBudgetPDF({
            orgName:        orgData.name,
            orgCompanyName: orgData.company_name,
            orgCNPJ:        orgData.cnpj,
            orgPhone:       orgData.phone,
            orgEmail:       orgData.email,
            orgAddress:     orgData.address,
            orgOwnerName:   orgData.owner_name,
            orgLogoUrl:     orgData.logo_url,
            validityDate: validity.toLocaleDateString('pt-BR'),
            clientName:   budget.client_name,
            clientAddress: budget.client_address,
            paymentType:  budget.payment_type,
            totalPrazo:   budget.total_prazo,
            totalAvista:  budget.total_avista,
            prazoEntryPercent:     budget.prazo_entry_percent,
            prazoInstallments:     budget.prazo_installments,
            avistaDiscountPercent: budget.avista_discount_percent,
            avistaEntryPercent:    budget.avista_entry_percent,
            environments: activeEnvs,
            observations: budget.observations,
            responsibleName: budget.created_by_name || profile?.full_name || orgData.owner_name,
        });
    };

    if (loading) return <div className="text-sm text-slate-400 animate-pulse p-8">Carregando orçamento...</div>;
    if (!budget) return null;

    const statusInfo = STATUS_INFO[budget.status] || STATUS_INFO.sent;
    const StatusIcon = statusInfo.icon;

    return (
        <div className="max-w-3xl space-y-4 pb-28 sm:pb-8">
            {/* Navegação */}
            <button
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                onClick={() => router.push('/dashboard/budgets')}
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Orçamentos</span>
            </button>

            {/* Card do cliente */}
            <div className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex overflow-hidden">
                <div className="bg-indigo-600 flex items-center justify-center px-4 shrink-0">
                    <span className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">PARA</span>
                </div>
                <div className="px-4 py-4">
                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 leading-tight">{budget.client_name}</h2>
                    {budget.client_address && (
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{budget.client_address}</p>
                    )}
                </div>
            </div>

            {/* Card de status + ações */}
            <div className={`rounded-xl border ${statusInfo.bg} ${statusInfo.border} px-4 py-3 space-y-3`}>
                <div className="flex items-center gap-2">
                    <StatusIcon className={`h-5 w-5 shrink-0 ${statusInfo.text_c}`} />
                    <p className={`text-base font-bold ${statusInfo.text_c}`}>{statusInfo.text}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 h-11 text-sm gap-1.5" onClick={handleGeneratePDF}>
                        <FileText className="h-4 w-4" />Baixar PDF
                    </Button>
                    <Button variant="outline" className="flex-1 h-11 text-sm gap-1.5" onClick={handleShare}>
                        <Share2 className="h-4 w-4" />Compartilhar
                    </Button>
                </div>
            </div>

            {/* Ambientes e Itens */}
            <div className="rounded-xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 p-4 sm:p-5 space-y-4">
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wide">Ambientes e Móveis</h3>
                <BudgetEnvironmentEditor
                    budgetId={id}
                    avistaDiscountPercent={budget.avista_discount_percent}
                    onTotalsChange={load}
                    readOnly={budget.status === 'approved'}
                />
            </div>

            {/* Condições de Pagamento */}
            <div className="rounded-xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wide">Condição de Pagamento</h3>
                    {budget.status !== 'approved' && <span className="text-red-500 text-sm font-bold">*</span>}
                </div>
                <BudgetPaymentSimulator
                    budget={budget}
                    onChange={budget.status === 'approved' ? undefined : handlePaymentChange}
                    readOnly={budget.status === 'approved'}
                    selectedPayment={selectedPayment}
                    onSelectPayment={budget.status === 'approved' ? undefined : setSelectedPayment}
                />
            </div>

            {/* Observações */}
            <div className="rounded-xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 p-4 sm:p-5 space-y-2">
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wide">Observações</h3>
                <Textarea
                    className="text-sm resize-none"
                    rows={4}
                    disabled={budget.status === 'approved'}
                    placeholder="Ex: Incluso portas com amortecimento, gavetas telescópicas..."
                    value={budget.observations || ""}
                    onChange={e => handleObsChange(e.target.value)}
                />
                {budget.status !== 'approved' && (
                    <div className="flex justify-end">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            Salvo automaticamente
                        </span>
                    </div>
                )}
            </div>

            {/* Ação principal — sticky no mobile */}
            <div className="fixed bottom-0 left-0 right-0 sm:relative sm:bottom-auto sm:left-auto sm:right-auto z-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm border-t border-slate-200 dark:border-zinc-800 sm:bg-transparent sm:dark:bg-transparent sm:border-none sm:backdrop-blur-none p-4 sm:p-0">
                {budget.status !== 'approved' ? (
                    <Button
                        className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white h-14 text-lg font-bold rounded-xl shadow-md"
                        onClick={handleApproveConfirm}
                    >
                        <ShieldCheck className="h-6 w-6 mr-2" />Autorizar Contrato
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        className="w-full text-amber-600 border-amber-300 hover:bg-amber-50 h-12 text-base font-semibold rounded-xl"
                        onClick={handleReopen}
                    >
                        <LockOpen className="h-5 w-5 mr-2" />Reabrir Orçamento
                    </Button>
                )}
            </div>

            {/* Modal Compartilhar */}
            <Dialog open={shareOpen} onOpenChange={setShareOpen}>
                <DialogContent className={[
                    "gap-0 p-0 overflow-hidden",
                    // desktop: modal centralizado
                    "sm:max-w-xs sm:rounded-2xl",
                    // mobile: bottom sheet
                    "max-sm:!left-0 max-sm:!right-0 max-sm:!bottom-0 max-sm:!top-auto",
                    "max-sm:!translate-x-0 max-sm:!translate-y-0",
                    "max-sm:!w-full max-sm:max-w-full",
                    "max-sm:rounded-t-3xl max-sm:rounded-b-none",
                    "max-sm:data-[state=open]:slide-in-from-bottom-8 max-sm:data-[state=open]:slide-in-from-top-0",
                ].join(" ")}>
                    {/* Alça — mobile */}
                    <div className="sm:hidden flex justify-center pt-3 pb-0">
                        <div className="h-1 w-10 rounded-full bg-slate-200 dark:bg-zinc-700" />
                    </div>

                    <div className="px-5 pt-4 pb-6 sm:px-6 sm:pt-5 sm:pb-5 space-y-4">
                        {/* Título */}
                        <div className="flex items-center gap-2">
                            <Share2 className="h-4 w-4 text-indigo-500 shrink-0" />
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Compartilhar orçamento</span>
                        </div>

                        {/* Botões */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                className="flex flex-col items-center justify-center gap-2 h-20 sm:h-16 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 transition-colors"
                                onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Link copiado!"); }}
                            >
                                <Copy className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Copiar link</span>
                            </button>
                            <button
                                className="flex flex-col items-center justify-center gap-2 h-20 sm:h-16 rounded-2xl bg-green-500 hover:bg-green-600 active:bg-green-700 transition-colors"
                                onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Olá! Segue o link do seu orçamento interativo, de Móveis Planejados, realizado na empresa: ${orgData.name || orgData.company_name}.\n\n${shareUrl}`)}`, '_blank')}
                            >
                                <MessageCircle className="h-6 w-6 text-white" />
                                <span className="text-xs font-semibold text-white">WhatsApp</span>
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
