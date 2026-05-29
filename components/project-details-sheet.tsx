"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Save, Wallet, Percent, PackageOpen, Trash2, FileText,
    AlertTriangle, Upload, ImageIcon, FileIcon, X, Download,
    MessageSquare, Loader2,
} from "lucide-react";
import { generateContractPDF } from "@/lib/generate-contract-pdf";
import { InstallmentsManager } from "./installments-manager";
import { StockLinker } from "./stock-linker";
import { useRBAC } from "./rbac-provider";

export type SaleProject = {
    id: string;
    client_name: string;
    status: 'Orçamento' | 'Produção' | 'Montagem' | 'Concluído';
    total_value: number;
    received_value: number;
    raw_material_cost: number;
    freight_cost: number;
    commission_seller_percent: number;
    commission_carpenter_percent: number;
    rt_architect_percent: number;
};

interface ProjectFile {
    id: string;
    file_name: string;
    file_path: string;
    file_type: string;
    signed_url: string | null;
    created_at: string;
    profiles: { full_name: string } | null;
}

interface ProjectDetailsSheetProps {
    project: SaleProject | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdated: () => void;
}

export function ProjectDetailsSheet({ project, open, onOpenChange, onUpdated }: ProjectDetailsSheetProps) {
    const { isCarpenter, canViewFinance } = useRBAC();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<SaleProject>>({});

    // Notes
    const [notes, setNotes] = useState("");
    const [savingNotes, setSavingNotes] = useState(false);

    // Files
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Report dialog
    const [reportDialogOpen, setReportDialogOpen] = useState(false);
    const [reportMessage, setReportMessage] = useState("");
    const [reportLoading, setReportLoading] = useState(false);

    useEffect(() => {
        if (!project || !open) return;
        setFormData({
            total_value: project.total_value,
            received_value: project.received_value,
            raw_material_cost: project.raw_material_cost,
            freight_cost: project.freight_cost,
            commission_seller_percent: project.commission_seller_percent,
            commission_carpenter_percent: project.commission_carpenter_percent,
            rt_architect_percent: project.rt_architect_percent,
        });
        loadNotes();
        loadFiles();
    }, [project, open]);

    const loadNotes = async () => {
        if (!project) return;
        const res = await fetch(`/api/sales?id=${project.id}`, { cache: 'no-store' });
        if (res.ok) { const data = await res.json(); setNotes(data?.notes || ""); }
    };

    const loadFiles = async () => {
        if (!project) return;
        setLoadingFiles(true);
        try {
            const res = await fetch(`/api/sales/${project.id}/files`);
            if (res.ok) setFiles(await res.json());
        } finally {
            setLoadingFiles(false);
        }
    };

    const handleSaveNotes = async () => {
        if (!project) return;
        setSavingNotes(true);
        try {
            const res = await fetch(`/api/sales/${project.id}/notes`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            toast.success("Observações salvas!");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSavingNotes(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !project) return;

        const maxMB = 50;
        if (file.size > maxMB * 1024 * 1024) {
            toast.error(`Arquivo muito grande (máx ${maxMB}MB).`);
            return;
        }

        setUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await fetch(`/api/sales/${project.id}/files`, {
                method: 'POST',
                body: form,
            });
            if (!res.ok) throw new Error((await res.json()).error);
            toast.success(`"${file.name}" enviado!`);
            loadFiles();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteFile = async (fileId: string, fileName: string) => {
        if (!project) return;
        if (!confirm(`Remover "${fileName}"?`)) return;
        try {
            const res = await fetch(`/api/sales/${project.id}/files?fileId=${fileId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error((await res.json()).error);
            toast.success("Arquivo removido.");
            loadFiles();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleChange = (field: keyof SaleProject, value: string) => {
        const rawVal = parseFloat(value.replace(/\D/g, "")) / 100 || 0;
        setFormData(prev => ({ ...prev, [field]: rawVal }));
    };

    const handlePercentChange = (field: keyof SaleProject, value: string) => {
        setFormData(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
    };

    const handleSave = async () => {
        if (!project) return;
        setLoading(true);
        try {
            const res = await fetch('/api/sales', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: project.id, ...formData }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha");
            toast.success("Projeto atualizado!");
            onUpdated();
            onOpenChange(false);
        } catch (error: any) {
            toast.error("Erro ao salvar", { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleReport = async () => {
        if (!project || !reportMessage.trim()) return;
        setReportLoading(true);
        try {
            const res = await fetch(`/api/sales/${project.id}/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: reportMessage }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success('Relato registrado!');
            setReportMessage("");
            setReportDialogOpen(false);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setReportLoading(false);
        }
    };

    const formatBRL = (value: number = 0) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const currentTotal = formData.total_value || 0;
    const currentCosts = (formData.raw_material_cost || 0) + (formData.freight_cost || 0);
    const currentCommissionsValue = currentTotal * ((
        (formData.commission_seller_percent || 0) +
        (formData.commission_carpenter_percent || 0) +
        (formData.rt_architect_percent || 0)
    ) / 100);
    const currentProfit = currentTotal - currentCosts - currentCommissionsValue;
    const marginPercent = currentTotal > 0 ? ((currentProfit / currentTotal) * 100).toFixed(0) : "0";

    if (!project) return null;

    const STATUS_COLORS: Record<string, string> = {
        'Orçamento': 'bg-slate-100 text-slate-700',
        'Produção':  'bg-blue-100 text-blue-700',
        'Montagem':  'bg-amber-100 text-amber-700',
        'Concluído': 'bg-emerald-100 text-emerald-700',
    };

    return (
        <>
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
                {/* Header */}
                <SheetHeader className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-zinc-800 shrink-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <SheetTitle className="text-lg leading-tight">{project.client_name}</SheetTitle>
                            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${STATUS_COLORS[project.status] || 'bg-slate-100 text-slate-600'}`}>
                                {project.status}
                            </span>
                        </div>
                    </div>
                </SheetHeader>

                {/* Tabs */}
                <Tabs defaultValue="details" className="flex flex-col flex-1 min-h-0">
                    <TabsList className="mx-5 mt-3 mb-0 shrink-0 w-auto justify-start bg-slate-100 dark:bg-zinc-800/60 h-9">
                        <TabsTrigger value="details" className="text-xs h-7 px-3">
                            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />Detalhes
                        </TabsTrigger>
                        <TabsTrigger value="files" className="text-xs h-7 px-3">
                            <FileIcon className="h-3.5 w-3.5 mr-1.5" />
                            Arquivos {files.length > 0 && <span className="ml-1 bg-primary text-primary-foreground text-[10px] rounded-full px-1.5">{files.length}</span>}
                        </TabsTrigger>
                        {!isCarpenter && (
                            <TabsTrigger value="finance" className="text-xs h-7 px-3">
                                <Wallet className="h-3.5 w-3.5 mr-1.5" />Financeiro
                            </TabsTrigger>
                        )}
                    </TabsList>

                    {/* ── TAB DETALHES ── */}
                    <TabsContent value="details" className="flex-1 overflow-y-auto px-5 py-4 mt-0 space-y-5">

                        {/* Observações */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                Observações do Projeto
                            </Label>
                            <textarea
                                className="w-full min-h-[160px] rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-slate-300 dark:placeholder:text-zinc-600"
                                placeholder="Detalhes de execução, materiais especiais, instruções ao marceneiro, retorno do cliente..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                            <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes} className="w-full">
                                {savingNotes ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Salvando...</> : <><Save className="h-3.5 w-3.5 mr-2" />Salvar Observações</>}
                            </Button>
                        </div>

                        {/* Relatar Problema (marceneiro) */}
                        {isCarpenter && (
                            <Button
                                variant="outline"
                                className="w-full border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-900 dark:hover:bg-amber-900/20"
                                onClick={() => setReportDialogOpen(true)}
                            >
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Relatar Falta de Material / Problema
                            </Button>
                        )}

                        {/* Materiais do estoque */}
                        <div className="border-t border-slate-100 dark:border-zinc-800 pt-4">
                            <StockLinker saleId={project.id} projectName={project.client_name} />
                        </div>
                    </TabsContent>

                    {/* ── TAB ARQUIVOS ── */}
                    <TabsContent value="files" className="flex-1 overflow-y-auto px-5 py-4 mt-0 space-y-4">

                        {/* Upload */}
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                className="hidden"
                                onChange={handleUpload}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl py-6 flex flex-col items-center gap-2 text-slate-400 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50"
                            >
                                {uploading
                                    ? <Loader2 className="h-6 w-6 animate-spin" />
                                    : <Upload className="h-6 w-6" />}
                                <span className="text-sm font-medium">
                                    {uploading ? "Enviando..." : "Clique para enviar PDF ou foto"}
                                </span>
                                <span className="text-xs">PDF, JPG, PNG, WEBP · máx 50MB</span>
                            </button>
                        </div>

                        {/* Lista de arquivos */}
                        {loadingFiles && (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                            </div>
                        )}
                        {!loadingFiles && files.length === 0 && (
                            <p className="text-center text-sm text-slate-400 py-6">Nenhum arquivo enviado ainda.</p>
                        )}
                        <div className="space-y-2">
                            {files.map(f => {
                                const isImage = f.file_type === 'image';
                                return (
                                    <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-200 dark:hover:border-zinc-700 transition-colors">
                                        {/* Thumbnail ou ícone */}
                                        <div className="h-10 w-10 rounded-lg shrink-0 overflow-hidden bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                                            {isImage && f.signed_url
                                                ? <img src={f.signed_url} alt={f.file_name} className="h-full w-full object-cover" />
                                                : <FileText className="h-5 w-5 text-red-500" />}
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{f.file_name}</p>
                                            <p className="text-[10px] text-slate-400">
                                                {f.profiles?.full_name} · {new Date(f.created_at).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                        {/* Ações */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            {f.signed_url && (
                                                <a href={f.signed_url} target="_blank" rel="noopener noreferrer">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary">
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                </a>
                                            )}
                                            {canViewFinance && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                                                    onClick={() => handleDeleteFile(f.id, f.file_name)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </TabsContent>

                    {/* ── TAB FINANCEIRO ── */}
                    {!isCarpenter && (
                        <TabsContent value="finance" className="flex-1 overflow-y-auto px-5 py-4 mt-0 space-y-5">

                            {/* Comissões */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 border-b pb-2">
                                    <Percent className="h-4 w-4 text-primary" />
                                    <h3 className="font-semibold text-sm">Comissões e RT (%)</h3>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { field: 'commission_carpenter_percent' as const, label: 'Marceneiro' },
                                        { field: 'commission_seller_percent' as const, label: 'Vendedor' },
                                        { field: 'rt_architect_percent' as const, label: 'Arquiteto' },
                                    ].map(({ field, label }) => (
                                        <div key={field} className="space-y-1.5">
                                            <Label className="text-xs">{label}</Label>
                                            <div className="relative">
                                                <Input type="number" value={formData[field]} onChange={e => handlePercentChange(field, e.target.value)} className="pr-6 h-9" />
                                                <span className="absolute right-2 top-2 text-xs text-slate-400">%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Parcelas */}
                            <div className="border-t border-slate-100 dark:border-zinc-800 pt-4">
                                <InstallmentsManager saleId={project.id} totalValue={formData.total_value || 0} />
                            </div>

                            {/* Ações */}
                            <div className="space-y-2 border-t border-slate-100 dark:border-zinc-800 pt-4">
                                <Button onClick={handleSave} disabled={loading} className="w-full">
                                    <Save className="h-4 w-4 mr-2" />
                                    {loading ? "Salvando..." : "Salvar Alterações"}
                                </Button>
                                <Button variant="outline" className="w-full" onClick={() => {
                                    generateContractPDF({
                                        clientName: project.client_name,
                                        totalValue: formData.total_value || 0,
                                        receivedValue: formData.received_value || 0,
                                        rawMaterialCost: formData.raw_material_cost || 0,
                                        freightCost: formData.freight_cost || 0,
                                        commissionCarpenter: formData.commission_carpenter_percent || 0,
                                        commissionSeller: formData.commission_seller_percent || 0,
                                        rtArchitect: formData.rt_architect_percent || 0,
                                        status: project.status,
                                    });
                                    toast.success("PDF gerado!");
                                }}>
                                    <FileText className="h-4 w-4 mr-2" />Gerar Contrato PDF
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/20"
                                    onClick={async () => {
                                        if (!confirm(`Excluir "${project.client_name}"?`)) return;
                                        const res = await fetch(`/api/sales?id=${project.id}`, { method: 'DELETE' });
                                        if (!res.ok) { toast.error((await res.json().catch(() => ({}))).error || "Falha"); return; }
                                        toast.success('Projeto excluído.');
                                        onUpdated();
                                        onOpenChange(false);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />Excluir Projeto
                                </Button>
                            </div>
                        </TabsContent>
                    )}
                </Tabs>
            </SheetContent>
        </Sheet>

        {/* Dialog Relatar Problema */}
        <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-amber-600">Relatar Problema</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <p className="text-sm text-slate-500">
                        Descreva a falta de material ou problema no projeto <b>{project?.client_name}</b>.
                    </p>
                    <Input
                        placeholder="Ex: Falta de MDF 18mm, ferragem danificada..."
                        value={reportMessage}
                        onChange={e => setReportMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleReport()}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setReportDialogOpen(false)} disabled={reportLoading}>Cancelar</Button>
                    <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={handleReport} disabled={!reportMessage.trim() || reportLoading}>
                        {reportLoading ? "Registrando..." : "Enviar Relato"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
