"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRBAC } from "@/components/rbac-provider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { StockLinker } from "@/components/stock-linker";
import {
    ArrowLeft, Send, Upload, Download, FileText, Loader2, Save,
    Calendar, X, Paperclip, MessageSquare, StickyNote, HardHat,
    ZoomIn, ChevronLeft, ChevronRight, AlertTriangle, Package,
    ImageIcon, Trash2,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Profile { id: string; full_name: string; avatar_url?: string; role: string; }
interface Message {
    id: string; message: string; created_at: string;
    profile_id: string; profiles: Profile | null;
}
interface ProjectFile {
    id: string; file_name: string; file_type: string;
    signed_url: string | null; created_at: string;
    profiles: { full_name: string; avatar_url?: string } | null;
}
interface Sale {
    id: string; client_name: string; status: string;
    delivery_date: string | null; notes: string | null;
    carpenter_id: string | null; seller_id: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
    'Orçamento': 'bg-slate-100 text-slate-700 border-slate-200',
    'Produção':  'bg-blue-100 text-blue-700 border-blue-200',
    'Montagem':  'bg-amber-100 text-amber-700 border-amber-200',
    'Concluído': 'bg-emerald-100 text-emerald-700 border-emerald-200',
};
const ROLE_LABELS: Record<string, string> = {
    sysadmin: 'Super Admin', owner: 'Proprietário',
    office: 'Escritório', seller: 'Vendedor', carpenter: 'Marceneiro',
};
function getInitials(name?: string | null) {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}
function fmtDateTime(iso: string) {
    return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}
function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "short", year: "numeric",
    });
}
function deliveryCountdown(d: string | null) {
    if (!d) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dt = new Date(d + "T00:00:00");
    const diff = Math.round((dt.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return { label: `${Math.abs(diff)} dia(s) atrasado`, urgent: true };
    if (diff === 0) return { label: "Entrega hoje!", urgent: true };
    if (diff === 1) return { label: "Entrega amanhã", urgent: true };
    return { label: `${diff} dias para entrega`, urgent: diff <= 5 };
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ images, index, onClose, onPrev, onNext }: {
    images: ProjectFile[]; index: number;
    onClose: () => void; onPrev: () => void; onNext: () => void;
}) {
    const f = images[index];
    useEffect(() => {
        const fn = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowLeft") onPrev();
            if (e.key === "ArrowRight") onNext();
        };
        window.addEventListener("keydown", fn);
        return () => window.removeEventListener("keydown", fn);
    }, [onClose, onPrev, onNext]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-sm" onClick={onClose}>
            <button className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 rounded-full p-2 z-10" onClick={onClose}>
                <X className="h-5 w-5" />
            </button>
            {images.length > 1 && (
                <>
                    <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/50 rounded-full p-2 z-10"
                        onClick={e => { e.stopPropagation(); onPrev(); }}>
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/50 rounded-full p-2 z-10"
                        onClick={e => { e.stopPropagation(); onNext(); }}>
                        <ChevronRight className="h-6 w-6" />
                    </button>
                </>
            )}
            <div className="max-w-5xl max-h-[90vh] w-full px-16" onClick={e => e.stopPropagation()}>
                <img src={f.signed_url!} alt={f.file_name}
                    className="max-h-[78vh] max-w-full mx-auto object-contain rounded-xl shadow-2xl" />
                <div className="mt-3 text-center space-y-0.5">
                    <p className="text-white/80 text-sm font-medium">{f.file_name}</p>
                    <p className="text-white/50 text-xs">
                        {f.profiles?.full_name} · {fmtDate(f.created_at)}
                        {images.length > 1 && <span className="ml-3">{index + 1} / {images.length}</span>}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Card de arquivo (feed) ───────────────────────────────────────────────────
function FileCard({ file, onDelete, onViewImage, canDelete }: {
    file: ProjectFile;
    onDelete: (id: string, name: string) => void;
    onViewImage: () => void;
    canDelete: boolean;
}) {
    const isImage = file.file_type === "image";

    return (
        <div className="rounded-2xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
            {isImage && file.signed_url ? (
                <div className="relative w-full bg-slate-100 dark:bg-zinc-900 cursor-pointer" style={{ aspectRatio: "4/3" }} onClick={onViewImage}>
                    <img src={file.signed_url} alt={file.file_name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                        <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                </div>
            ) : (
                <a href={file.signed_url || "#"} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 cursor-pointer"
                    style={{ aspectRatio: "4/3" }}>
                    <FileText className="h-14 w-14 text-red-400 group-hover:text-red-500 transition-colors drop-shadow" />
                    <span className="text-xs font-bold text-red-400 uppercase tracking-widest">PDF</span>
                    <span className="text-[10px] text-red-300 dark:text-red-600">clique para abrir</span>
                </a>
            )}
            <div className="px-3 py-2 flex items-center gap-2 border-t border-slate-50 dark:border-zinc-800/60">
                <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={file.profiles?.avatar_url || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">{getInitials(file.profiles?.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">{file.file_name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{file.profiles?.full_name} · {fmtDate(file.created_at)}</p>
                </div>
                <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {file.signed_url && (
                        <a href={file.signed_url} target="_blank" rel="noopener noreferrer" download>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary" title="Baixar">
                                <Download className="h-3.5 w-3.5" />
                            </Button>
                        </a>
                    )}
                    {canDelete && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" title="Excluir"
                            onClick={() => onDelete(file.id, file.file_name)}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Componente principal ──────────────────────────────────────────────────────
type TabId = "chat" | "materials" | "notes";

export default function ProjectPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { profile: me, isCarpenter, canViewFinance } = useRBAC();

    const [sale, setSale] = useState<Sale | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [notes, setNotes] = useState("");
    const [newMsg, setNewMsg] = useState("");
    const [savingNotes, setSavingNotes] = useState(false);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [loadingPage, setLoadingPage] = useState(true);
    const [activeTab, setActiveTab] = useState<TabId>("chat");

    // Relatar problema
    const [reportOpen, setReportOpen] = useState(false);
    const [reportMsg, setReportMsg] = useState("");
    const [reportLoading, setReportLoading] = useState(false);

    // Lightbox
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const imageFiles = files.filter(f => f.file_type === "image" && f.signed_url);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const msgInputRef = useRef<HTMLInputElement>(null);

    // ── Carregamento ─────────────────────────────────────────────────────────
    const loadSale = useCallback(async () => {
        const res = await fetch(`/api/sales?id=${id}`, { cache: "no-store" });
        if (!res.ok) { toast.error("Projeto não encontrado."); router.back(); return; }
        const data = await res.json();
        setSale(data); setNotes(data.notes || "");
    }, [id]);

    const loadMessages = useCallback(async () => {
        const res = await fetch(`/api/sales/${id}/messages`, { cache: "no-store" });
        if (res.ok) setMessages(await res.json());
    }, [id]);

    const loadFiles = useCallback(async () => {
        const res = await fetch(`/api/sales/${id}/files`, { cache: "no-store" });
        if (res.ok) setFiles(await res.json());
    }, [id]);

    useEffect(() => {
        if (!id) return;
        Promise.all([loadSale(), loadMessages(), loadFiles()]).finally(() => setLoadingPage(false));
    }, [id]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    // ── Ações ────────────────────────────────────────────────────────────────
    const handleSendMessage = async () => {
        if (!newMsg.trim() || sending) return;
        setSending(true);
        try {
            const res = await fetch(`/api/sales/${id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: newMsg }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setNewMsg(""); loadMessages();
        } catch (err: any) { toast.error(err.message); }
        finally { setSending(false); msgInputRef.current?.focus(); }
    };

    const handleSaveNotes = async () => {
        setSavingNotes(true);
        try {
            const res = await fetch(`/api/sales/${id}/notes`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notes }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            toast.success("Observações salvas!");
        } catch (err: any) { toast.error(err.message); }
        finally { setSavingNotes(false); }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 50MB)."); return; }
        setUploading(true);
        try {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch(`/api/sales/${id}/files`, {
                method: "POST", body: form,
            });
            if (!res.ok) throw new Error((await res.json()).error);
            toast.success(`"${file.name}" enviado!`); loadFiles();
        } catch (err: any) { toast.error(err.message); }
        finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
    };

    const handleDeleteFile = async (fileId: string, fileName: string) => {
        if (!confirm(`Excluir "${fileName}"?`)) return;
        try {
            const res = await fetch(`/api/sales/${id}/files?fileId=${fileId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error((await res.json()).error);
            toast.success("Arquivo removido."); loadFiles();
        } catch (err: any) { toast.error(err.message); }
    };

    const handleReport = async () => {
        if (!reportMsg.trim()) return;
        setReportLoading(true);
        try {
            const res = await fetch(`/api/sales/${id}/report`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: reportMsg }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            toast.success("Relato registrado!");
            setReportMsg(""); setReportOpen(false);
        } catch (err: any) { toast.error(err.message); }
        finally { setReportLoading(false); }
    };

    // ─────────────────────────────────────────────────────────────────────────
    if (loadingPage) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />Carregando projeto...
            </div>
        );
    }
    if (!sale) return null;
    const countdown = deliveryCountdown(sale.delivery_date);

    const TABS: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
        { id: "chat",      label: "Chat",      icon: <MessageSquare className="h-3.5 w-3.5" />, badge: messages.length || undefined },
        { id: "materials", label: "Materiais", icon: <Package className="h-3.5 w-3.5" /> },
        { id: "notes",     label: "Notas",     icon: <StickyNote className="h-3.5 w-3.5" /> },
    ];

    return (
        <>
        {/* ── Lightbox ───────────────────────────────────────────────────── */}
        {lightboxIndex !== null && imageFiles.length > 0 && (
            <Lightbox
                images={imageFiles} index={lightboxIndex}
                onClose={() => setLightboxIndex(null)}
                onPrev={() => setLightboxIndex(i => i !== null ? (i - 1 + imageFiles.length) % imageFiles.length : 0)}
                onNext={() => setLightboxIndex(i => i !== null ? (i + 1) % imageFiles.length : 0)}
            />
        )}

        {/* ── Dialog: Relatar Problema ───────────────────────────────────── */}
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="h-5 w-5" />Relatar Problema
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-1">
                    <p className="text-sm text-slate-500">
                        Descreva a falta de material ou problema no projeto <b>{sale.client_name}</b>.
                    </p>
                    <Input
                        placeholder="Ex: Falta de MDF 18mm, ferragem danificada..."
                        value={reportMsg}
                        onChange={e => setReportMsg(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleReport()}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setReportOpen(false)} disabled={reportLoading}>Cancelar</Button>
                    <Button
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={handleReport}
                        disabled={!reportMsg.trim() || reportLoading}
                    >
                        {reportLoading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Enviando...</> : "Enviar Relato"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <div className="flex flex-col gap-5">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-2 pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-slate-500" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 flex flex-wrap items-center gap-2 min-w-0">
                        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{sale.client_name}</h1>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[sale.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {sale.status}
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-11">
                    {sale.delivery_date && (
                        <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${
                            countdown?.urgent
                                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-zinc-900 dark:text-slate-400 dark:border-zinc-700'
                        }`}>
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            Entrega: {new Date(sale.delivery_date + "T00:00:00").toLocaleDateString("pt-BR")}
                            {countdown && <span className="ml-1 opacity-70">· {countdown.label}</span>}
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700">
                        <HardHat className="h-3.5 w-3.5" />Marceneiro responsável
                    </div>
                </div>
            </div>

            {/* ── Grid principal ───────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

                {/* ══ COLUNA ESQUERDA: Tabs (Chat | Materiais | Notas) ══════ */}
                <div className="lg:col-span-2 flex flex-col rounded-2xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">

                    {/* Tab navigation */}
                    <div className="flex border-b border-slate-100 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/60 shrink-0">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                                    activeTab === tab.id
                                        ? "border-primary text-primary bg-white dark:bg-zinc-950"
                                        : "border-transparent text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300"
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                                {tab.badge !== undefined && (
                                    <span className="bg-primary/15 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* ── Tab: Chat ── */}
                    {activeTab === "chat" && (
                        <>
                            <div className="overflow-y-auto px-4 py-4 space-y-4" style={{ height: 380 }}>
                                {messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-300 dark:text-zinc-600 gap-2 py-8">
                                        <MessageSquare className="h-9 w-9" />
                                        <p className="text-xs font-medium">Nenhuma mensagem ainda</p>
                                        <p className="text-[10px]">Seja o primeiro a comentar!</p>
                                    </div>
                                )}
                                {messages.map(msg => {
                                    const isMe = msg.profile_id === me?.id;
                                    const name = msg.profiles?.full_name || "Usuário";
                                    return (
                                        <div key={msg.id} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
                                            <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                                                <AvatarImage src={msg.profiles?.avatar_url || ""} />
                                                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">{getInitials(name)}</AvatarFallback>
                                            </Avatar>
                                            <div className={`flex flex-col max-w-[78%] ${isMe ? "items-end" : ""}`}>
                                                <div className={`flex items-center gap-1.5 mb-1 ${isMe ? "flex-row-reverse" : ""}`}>
                                                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                                        {isMe ? "Você" : name}
                                                    </span>
                                                    {msg.profiles?.role && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-400">
                                                            {ROLE_LABELS[msg.profiles.role] || msg.profiles.role}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                                    isMe
                                                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                                                        : "bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 rounded-tl-sm"
                                                }`}>
                                                    {msg.message}
                                                </div>
                                                <span className="text-[9px] text-slate-400 mt-0.5 px-0.5">{fmtDateTime(msg.created_at)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="px-3 py-3 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 shrink-0">
                                <div className="flex gap-2 items-center">
                                    <input
                                        ref={msgInputRef}
                                        type="text"
                                        value={newMsg}
                                        onChange={e => setNewMsg(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                                        placeholder="Escreva uma mensagem..."
                                        className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-slate-300 dark:placeholder:text-zinc-600"
                                    />
                                    <Button size="icon" className="h-9 w-9 rounded-xl shrink-0" onClick={handleSendMessage} disabled={!newMsg.trim() || sending}>
                                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── Tab: Materiais ── */}
                    {activeTab === "materials" && (
                        <div className="overflow-y-auto p-4" style={{ minHeight: 380 }}>
                            <StockLinker saleId={id as string} projectName={sale.client_name} />
                        </div>
                    )}

                    {/* ── Tab: Notas ── */}
                    {activeTab === "notes" && (
                        <div className="p-4 space-y-3" style={{ minHeight: 380 }}>
                            <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                                Visível para toda a equipe do projeto.
                            </p>
                            <textarea
                                className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-sm p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-slate-300 dark:placeholder:text-zinc-600"
                                style={{ minHeight: 260 }}
                                placeholder="Detalhes de execução, materiais especiais, instruções para o marceneiro..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                            <Button size="sm" className="w-full" onClick={handleSaveNotes} disabled={savingNotes}>
                                {savingNotes
                                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Salvando...</>
                                    : <><Save className="h-3.5 w-3.5 mr-1.5" />Salvar Observações</>}
                            </Button>
                        </div>
                    )}

                    {/* ── Rodapé: Relatar Problema ── */}
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-zinc-800 bg-amber-50/60 dark:bg-amber-900/10 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-8 text-xs border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 gap-1.5"
                            onClick={() => setReportOpen(true)}
                        >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Relatar Falta de Material / Problema
                        </Button>
                    </div>
                </div>

                {/* ══ COLUNA DIREITA: Feed de Fotos e Documentos ═══════════ */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                    {/* Header + upload */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-blue-500" />
                            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Fotos e Documentos</span>
                            {files.length > 0 && (
                                <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                                    {files.length}
                                </span>
                            )}
                        </div>
                        <div className="ml-auto">
                            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleUpload} />
                            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                {uploading
                                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Enviando...</>
                                    : <><Upload className="h-3.5 w-3.5" />Enviar arquivo</>}
                            </Button>
                        </div>
                    </div>

                    {/* Feed vazio */}
                    {files.length === 0 && !uploading && (
                        <div
                            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700 py-20 text-slate-300 dark:text-zinc-600 gap-3 cursor-pointer hover:border-primary/40 hover:text-primary/40 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <ImageIcon className="h-12 w-12" />
                            <p className="text-sm font-medium">Nenhuma foto ou documento</p>
                            <p className="text-xs">Clique aqui para enviar</p>
                        </div>
                    )}

                    {/* Grid de arquivos */}
                    {files.length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                            {files.map(f => {
                                const imgIdx = imageFiles.findIndex(img => img.id === f.id);
                                return (
                                    <FileCard
                                        key={f.id}
                                        file={f}
                                        canDelete={!isCarpenter || canViewFinance}
                                        onDelete={handleDeleteFile}
                                        onViewImage={() => imgIdx >= 0 && setLightboxIndex(imgIdx)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
        </>
    );
}
