"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { BudgetEnvironmentEditor } from "@/components/budget-environment-editor";
import { BudgetPaymentSimulator } from "@/components/budget-payment-simulator";
import { generateBudgetPDF } from "@/lib/generate-budget-pdf";
import { ShieldCheck, LockOpen, User, FileDown, Clock, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
            <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.83 9.83 0 001.51 5.255l-.999 3.648 3.728-.978zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
        </svg>
    );
}
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface OrgData {
    name: string;
    company_name?: string;
    cnpj?: string;
    phone?: string;
    email?: string;
    address?: string;
    owner_name?: string;
    logo_url?: string;
    budget_validity_days?: number;
}

interface PublicBudget {
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
    status: string;
    created_at: string;
    created_by_name: string | null;
    environments: any[];
    org: OrgData | null;
}

const STATUS_INFO: Record<string, { text: string; icon: any; bg: string; border: string; text_c: string }> = {
    draft:    { text: "Aguardando envio",         icon: Clock,        bg: "bg-slate-50",   border: "border-slate-200",  text_c: "text-slate-500"  },
    sent:     { text: "Aguardando sua aprovação",  icon: Send,         bg: "bg-indigo-50",  border: "border-indigo-200", text_c: "text-indigo-600" },
    approved: { text: "Contrato autorizado!",       icon: CheckCircle2, bg: "bg-emerald-50", border: "border-emerald-200",text_c: "text-emerald-600"},
    rejected: { text: "Orçamento recusado",         icon: Clock,        bg: "bg-red-50",     border: "border-red-200",   text_c: "text-red-500"    },
};

export default function PublicBudgetPage() {
    const { token } = useParams<{ token: string }>();
    const [budget, setBudget]           = useState<PublicBudget | null>(null);
    const [loading, setLoading]         = useState(true);
    const [acting, setActing]               = useState(false);
    const [generatingPDF, setGeneratingPDF] = useState(false);
    const [sharing, setSharing]             = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<'prazo' | 'avista' | null>(null);
    const [alertOpen, setAlertOpen]         = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/public/budget/${token}?_=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) throw new Error("Orçamento não encontrado.");
            const data = await res.json();
            setBudget(data);
            if (data.payment_type === 'prazo' || data.payment_type === 'avista') {
                setSelectedPayment(data.payment_type);
            } else {
                setSelectedPayment(null);
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { load(); }, [load]);

    const handleAction = async (status: 'approved' | 'sent') => {
        if (status === 'approved' && !selectedPayment) {
            setAlertOpen(true);
            return;
        }
        setActing(true);
        try {
            const res = await fetch(`/api/public/budget/${token}/update`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'set_status', status, chosen_payment_type: status === 'approved' ? selectedPayment : null }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                toast.error("Erro ao salvar", { description: err.error || "Tente novamente." });
                return;
            }
            if (status === 'sent') {
                setSelectedPayment(null);
                toast.success("Orçamento reaberto. Escolha novamente a condição de pagamento.");
            } else {
                toast.success("Contrato autorizado! A marcenaria entrará em contato.");
            }
            // re-fetch para garantir sincronismo com o banco
            await load();
        } finally {
            setActing(false);
        }
    };

    const reloadTotals = useCallback(async (update?: { total_prazo: number; total_avista: number; environments?: any[] }) => {
        if (update) {
            // Totais calculados localmente — aplica direto, sem fetch
            setBudget(prev => prev ? { ...prev, ...update } : null);
        } else {
            // Fallback: busca completa (usado após add/remove de itens no dashboard)
            const res = await fetch(`/api/public/budget/${token}`, { cache: 'no-store' });
            const data = await res.json();
            setBudget(prev => prev ? {
                ...prev,
                total_prazo:  data.total_prazo,
                total_avista: data.total_avista,
                environments: data.environments,
            } : null);
        }
    }, [token]);

    // Monta os dados do PDF a partir do estado atual da tela
    // (já atualizado em tempo real pelo toggle de itens).
    const buildPdfData = () => {
        if (!budget) return null;
        const org = budget.org;
        const validityDays = org?.budget_validity_days || 30;
        const validity = new Date();
        validity.setDate(validity.getDate() + validityDays);

        const activeEnvs = (budget.environments || []).map((env: any) => ({
            name: env.name,
            items: (env.items || []).filter((i: any) => i.is_active).map((i: any) => ({
                description:  i.description,
                qty:          i.qty,
                alt_cm:       i.alt_cm,
                larg_cm:      i.larg_cm,
                value_prazo:  i.value_prazo,
                value_avista: i.value_avista,
                is_active:    true,
            })),
        })).filter((e: any) => e.items.length > 0);

        return {
            orgName:               org?.name        || "Marcenaria",
            orgCompanyName:        org?.company_name,
            orgCNPJ:               org?.cnpj,
            orgPhone:              org?.phone,
            orgEmail:              org?.email,
            orgAddress:            org?.address,
            orgOwnerName:          org?.owner_name,
            orgLogoUrl:            org?.logo_url,
            validityDate:          validity.toLocaleDateString('pt-BR'),
            clientName:            budget.client_name,
            clientAddress:         budget.client_address,
            // Condição de pagamento escolhida pelo cliente na tela
            paymentType:           selectedPayment ?? budget.payment_type,
            totalPrazo:            budget.total_prazo,
            totalAvista:           budget.total_avista,
            prazoEntryPercent:     budget.prazo_entry_percent,
            prazoInstallments:     budget.prazo_installments,
            avistaDiscountPercent: budget.avista_discount_percent,
            avistaEntryPercent:    budget.avista_entry_percent,
            environments:          activeEnvs,
            observations:          budget.observations,
            // Responsável = usuário que elaborou o orçamento (não o dono da empresa)
            responsibleName:       budget.created_by_name || org?.owner_name,
        };
    };

    const handleDownloadPDF = async () => {
        const data = buildPdfData();
        if (!data) return;
        setGeneratingPDF(true);
        try {
            await generateBudgetPDF(data);
        } finally {
            setGeneratingPDF(false);
        }
    };

    const handleShareWhatsApp = async () => {
        const data = buildPdfData();
        if (!data) return;
        setSharing(true);
        try {
            const result = await generateBudgetPDF(data, { output: "blob" });
            if (!result) return;
            const file = new File([result.blob], result.filename, { type: "application/pdf" });
            const msg = `Olá! Segue o orçamento "${budget?.budget_number ?? ""}" da ${data.orgName}.`;

            // Compartilhamento nativo com arquivo (mobile) — abre WhatsApp entre as opções
            if (navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title: "Orçamento", text: msg });
                return;
            }

            // Fallback (desktop / navegadores sem file share): baixa o PDF e abre o WhatsApp com a mensagem
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = result.filename;
            a.click();
            URL.revokeObjectURL(url);
            window.open(`https://wa.me/?text=${encodeURIComponent(msg + " (PDF baixado — anexe na conversa)")}`, "_blank");
        } catch (e: any) {
            if (e?.name !== "AbortError") toast.error("Não foi possível compartilhar o PDF.");
        } finally {
            setSharing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <p className="text-slate-400 animate-pulse">Carregando orçamento...</p>
            </div>
        );
    }

    if (!budget) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center space-y-2">
                    <p className="text-xl font-bold text-slate-700">Orçamento não encontrado</p>
                    <p className="text-slate-400 text-sm">Este link pode ter expirado ou sido removido.</p>
                </div>
            </div>
        );
    }

    const org        = budget.org;
    const statusInfo = STATUS_INFO[budget.status] || STATUS_INFO.sent;
    const StatusIcon = statusInfo.icon;

    const infoLine = [
        org?.address,
        org?.phone ? `Tel: ${org.phone}` : null,
        org?.email,
    ].filter(Boolean).join("  ·  ");

    const validityDays = org?.budget_validity_days || 30;
    const validityDate = (() => {
        const d = new Date();
        d.setDate(d.getDate() + validityDays);
        return d.toLocaleDateString('pt-BR');
    })();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">

            <div className="max-w-2xl mx-auto px-4 pt-5 pb-1">

                {/* ── CABEÇALHO — card da empresa ─────────── */}
                <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div className="px-5 py-5">
                        <div className="flex items-start gap-4">

                            {/* Logo */}
                            <div className="shrink-0">
                                {org?.logo_url ? (
                                    <img src={org.logo_url} alt="Logo"
                                        className="h-20 w-20 object-contain rounded-xl" />
                                ) : (
                                    <div className="h-20 w-20 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-4xl font-black">
                                        {(org?.name || "M").charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            {/* Dados da empresa */}
                            <div className="flex-1 min-w-0">
                                <h1 className="text-xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                                    {org?.name || "Marcenaria"}
                                </h1>
                                {(org?.company_name || org?.cnpj) && (
                                    <p className="text-slate-500 text-sm mt-1 leading-snug">
                                        {[org?.company_name, org?.cnpj ? `CNPJ: ${org.cnpj}` : null].filter(Boolean).join("  ·  ")}
                                    </p>
                                )}
                                {infoLine && (
                                    <p className="text-slate-400 text-xs mt-1.5 leading-snug">{infoLine}</p>
                                )}
                            </div>

                            {/* Validade + Responsável — desktop */}
                            <div className="shrink-0 text-right hidden sm:block">
                                <p className="text-xl font-black text-indigo-600 leading-tight">ORÇAMENTO</p>
                                <p className="text-sm text-slate-500 mt-1.5">Válido até: <span className="font-semibold text-slate-700 dark:text-slate-200">{validityDate}</span></p>
                                {org?.owner_name && (
                                    <p className="text-sm text-slate-500 mt-0.5">Resp.: <span className="font-semibold text-slate-700 dark:text-slate-200">{org.owner_name}</span></p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Mobile: validade + resp — dentro do card */}
                    <div className="sm:hidden border-t border-slate-100 dark:border-zinc-800 px-5 py-3 flex flex-wrap gap-x-5 gap-y-1.5 bg-slate-50 dark:bg-zinc-800/40">
                        <p className="text-sm text-slate-500">
                            Válido até: <span className="font-semibold text-slate-700 dark:text-slate-200">{validityDate}</span>
                        </p>
                        {org?.owner_name && (
                            <p className="text-sm text-slate-500 flex items-center gap-1">
                                <User className="h-3.5 w-3.5" />
                                <span>Resp.: <span className="font-semibold text-slate-700 dark:text-slate-200">{org.owner_name}</span></span>
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-28 print:pb-0">

                {/* Card do cliente */}
                <div className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex overflow-hidden">
                    <div className="bg-indigo-600 flex items-center justify-center px-4 shrink-0">
                        <span className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">PARA</span>
                    </div>
                    <div className="px-4 py-4">
                        <p className="text-xl font-black text-slate-800 dark:text-slate-100 leading-tight">{budget.client_name}</p>
                        {budget.client_address && (
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{budget.client_address}</p>
                        )}
                    </div>
                </div>

                {/* Status + Ações */}
                <div className="flex items-center gap-2 print:hidden">
                    <div className={`flex items-center gap-2 rounded-full border ${statusInfo.bg} ${statusInfo.border} pl-3 pr-4 py-1.5`}>
                        <StatusIcon className={`h-4 w-4 shrink-0 ${statusInfo.text_c}`} />
                        <p className={`text-sm font-semibold ${statusInfo.text_c}`}>{statusInfo.text}</p>
                    </div>
                    <div className="flex-1" />
                    <Button
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-full bg-[#25D366] hover:bg-[#1ebe5b] text-white"
                        title="Compartilhar no WhatsApp"
                        onClick={handleShareWhatsApp}
                        disabled={sharing || generatingPDF}>
                        <WhatsAppIcon className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-10 gap-1.5 rounded-full px-4 text-sm font-medium"
                        title="Baixar PDF"
                        onClick={handleDownloadPDF}
                        disabled={generatingPDF || sharing}>
                        <FileDown className="h-4 w-4" />
                        {generatingPDF ? "Gerando..." : "PDF"}
                    </Button>
                </div>

                {/* Ambientes */}
                <div className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 sm:p-5 space-y-3">
                    <h2 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wide">Itens do Orçamento</h2>
                    <BudgetEnvironmentEditor
                        token={token}
                        readOnly={budget.status === 'approved'}
                        avistaDiscountPercent={budget.avista_discount_percent}
                        onTotalsChange={reloadTotals}
                    />
                </div>

                {/* Condições de Pagamento */}
                <div className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 sm:p-5 space-y-3">
                    <div className="flex items-center gap-1.5">
                        <h2 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wide print:hidden">
                            <span className="print:hidden">Escolha a </span>condição de pagamento
                        </h2>
                        {budget.status !== 'approved' && <span className="text-red-500 font-bold print:hidden">*</span>}
                    </div>
                    <BudgetPaymentSimulator
                        budget={budget}
                        readOnly={budget.status === 'approved'}
                        hideInputs={true}
                        selectedPayment={selectedPayment}
                        onSelectPayment={budget.status === 'approved' ? undefined : setSelectedPayment}
                    />
                </div>

                {/* Observações */}
                {budget.observations && (
                    <div className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 sm:p-5 space-y-2">
                        <h2 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wide">Observações</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">{budget.observations}</p>
                    </div>
                )}

                <p className="text-center text-[10px] text-slate-300 dark:text-slate-700 print:hidden">
                    Orçamento gerado pelo sistema Fresa
                </p>
            </div>

            {/* Ação principal — sticky no mobile */}
            <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm border-t border-slate-200 dark:border-zinc-800 p-4 print:hidden">
                <div className="max-w-2xl mx-auto">
                    {budget.status !== 'approved' ? (
                        <Button
                            className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white h-14 text-lg font-bold rounded-xl shadow-md"
                            onClick={() => handleAction('approved')}
                            disabled={acting}
                        >
                            <ShieldCheck className="h-6 w-6 mr-2" />Autorizar Contrato
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            className="w-full text-amber-600 border-amber-300 hover:bg-amber-50 h-12 text-base font-semibold rounded-xl"
                            onClick={() => handleAction('sent')}
                            disabled={acting}
                        >
                            <LockOpen className="h-5 w-5 mr-2" />Reabrir Orçamento
                        </Button>
                    )}
                </div>
            </div>

            {/* Alerta: condição de pagamento não selecionada */}
            <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
                <DialogContent className="sm:max-w-xs text-center">
                    <DialogHeader>
                        <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                            <ShieldCheck className="h-6 w-6 text-amber-500" />
                        </div>
                        <DialogTitle className="text-center text-base">Escolha uma condição de pagamento</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-500 -mt-1">
                        Selecione <strong>A Prazo</strong> ou <strong>À Vista</strong> antes de autorizar o contrato.
                    </p>
                    <DialogFooter className="sm:justify-center mt-1">
                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => setAlertOpen(false)}>
                            Entendido
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
