"use client";

import { useEffect, useState } from "react";
import { useRBAC } from "@/components/rbac-provider";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Plus, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";

interface CalEvent {
    id: string;
    title: string;
    description: string;
    event_type: string;
    event_date: string;
    event_time: string | null;
    is_private: boolean;
    color: string;
    sale_id: string | null;
    created_by: string | null;
    profiles: { full_name: string } | null;
    sales: { client_name: string } | null;
}

const EVENT_TYPES = [
    { value: "delivery",     label: "Entrega",           color: "#22c55e" },
    { value: "budget",       label: "Orçamento",         color: "#f59e0b" },
    { value: "meeting",      label: "Reunião",           color: "#6366f1" },
    { value: "installation", label: "Montagem",          color: "#a78bfa" },
    { value: "other",        label: "Outro",             color: "#94a3b8" },
];

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAY_NAMES = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

export default function CalendarPage() {
    const { profile, canManageSales, loading } = useRBAC();
    const [events, setEvents] = useState<CalEvent[]>([]);
    const [today] = useState(new Date());
    const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() });
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    const [editing, setEditing] = useState<CalEvent | null>(null);
    const [form, setForm] = useState({
        title: "", description: "", event_type: "delivery",
        event_date: "", event_time: "", is_private: false, color: "#22c55e",
    });
    const [saving, setSaving] = useState(false);

    const load = async () => {
        const firstDay = new Date(current.year, current.month, 1).toISOString().slice(0, 10);
        const lastDay  = new Date(current.year, current.month + 1, 0).toISOString().slice(0, 10);
        const res = await fetch(`/api/calendar?from=${firstDay}&to=${lastDay}`, { cache: "no-store" });
        if (!res.ok) toast.error((await res.json().catch(() => ({}))).error || "Falha ao carregar");
        else setEvents((await res.json()) || []);
    };

    useEffect(() => { if (!loading) load(); }, [loading, current]);

    const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();
    const firstWeekday = new Date(current.year, current.month, 1).getDay();

    const eventsOn = (day: number) => {
        const date = `${current.year}-${String(current.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return events.filter(e => e.event_date === date);
    };

    const openNew = (date?: string) => {
        setEditing(null);
        setForm({ title: "", description: "", event_type: "delivery", event_date: date || "", event_time: "", is_private: false, color: "#22c55e" });
        setOpen(true);
    };

    const openEdit = (e: CalEvent) => {
        setEditing(e);
        setForm({ title: e.title, description: e.description, event_type: e.event_type, event_date: e.event_date, event_time: e.event_time || "", is_private: e.is_private, color: e.color });
        setOpen(true);
    };

    const save = async () => {
        if (!form.title.trim() || !form.event_date) { toast.error("Título e data são obrigatórios."); return; }
        setSaving(true);
        try {
            const payload = { ...form, event_time: form.event_time || null };
            if (editing) {
                const res = await fetch("/api/calendar", {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...payload, id: editing.id }),
                });
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha");
                toast.success("Evento atualizado.");
            } else {
                const res = await fetch("/api/calendar", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha");
                toast.success("Evento criado.");
            }
            setOpen(false);
            load();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id: string) => {
        if (!confirm("Remover este evento?")) return;
        const res = await fetch(`/api/calendar?id=${id}`, { method: "DELETE" });
        if (!res.ok) toast.error((await res.json().catch(() => ({}))).error || "Falha");
        else { toast.success("Evento removido."); load(); }
    };

    const selectedEvents = selected ? eventsOn(parseInt(selected)) : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Calendário</h2>
                    <p className="text-sm text-slate-500">Master Schedule — prazos e orçamentos</p>
                </div>
                <Button onClick={() => openNew()}><Plus className="mr-2 h-4 w-4" />Novo Evento</Button>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Calendário */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <Button variant="ghost" size="icon" onClick={() => setCurrent(c => {
                                const d = new Date(c.year, c.month - 1);
                                return { year: d.getFullYear(), month: d.getMonth() };
                            })}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <CardTitle className="text-base">{MONTH_NAMES[current.month]} {current.year}</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setCurrent(c => {
                                const d = new Date(c.year, c.month + 1);
                                return { year: d.getFullYear(), month: d.getMonth() };
                            })}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-7 gap-px">
                            {DAY_NAMES.map(d => (
                                <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>
                            ))}
                            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e-${i}`} />)}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const dayStr = String(day).padStart(2, "0");
                                const dateStr = `${current.year}-${String(current.month + 1).padStart(2, "0")}-${dayStr}`;
                                const dayEvents = eventsOn(day);
                                const isToday = day === today.getDate() && current.month === today.getMonth() && current.year === today.getFullYear();
                                const isSelected = selected === String(day);
                                return (
                                    <button
                                        key={day}
                                        onClick={() => { setSelected(isSelected ? null : String(day)); }}
                                        className={`relative rounded-lg p-1 min-h-[52px] text-left transition-all hover:bg-slate-50 dark:hover:bg-zinc-800 ${
                                            isSelected ? "ring-2 ring-primary bg-primary/5" : ""
                                        }`}
                                    >
                                        <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                                            isToday ? "bg-primary text-primary-foreground" : "text-slate-700 dark:text-slate-300"
                                        }`}>{day}</span>
                                        <div className="mt-0.5 space-y-0.5">
                                            {dayEvents.slice(0, 2).map(ev => (
                                                <div key={ev.id} className="h-1.5 rounded-full" style={{ background: ev.color }} />
                                            ))}
                                            {dayEvents.length > 2 && (
                                                <span className="text-[9px] text-slate-400">+{dayEvents.length - 2}</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Painel lateral: eventos do dia selecionado */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">
                            {selected
                                ? `${selected} de ${MONTH_NAMES[current.month]}`
                                : "Selecione um dia"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {!selected && (
                            <p className="text-xs text-slate-400 text-center py-6">
                                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                Clique em um dia para ver eventos.
                            </p>
                        )}
                        {selected && selectedEvents.length === 0 && (
                            <div className="text-center py-6">
                                <p className="text-xs text-slate-400 mb-2">Nenhum evento neste dia.</p>
                                <Button size="sm" variant="outline" onClick={() => openNew(`${current.year}-${String(current.month + 1).padStart(2, "0")}-${selected.padStart(2, "0")}`)}>
                                    <Plus className="mr-1 h-3 w-3" />Criar Evento
                                </Button>
                            </div>
                        )}
                        {selectedEvents.map(ev => {
                            const typeConfig = EVENT_TYPES.find(t => t.value === ev.event_type);
                            return (
                                <div key={ev.id} className="p-3 rounded-xl border dark:border-zinc-800">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: ev.color }} />
                                            <p className="font-medium text-sm truncate">{ev.title}</p>
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(ev)}>
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => remove(ev.id)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="secondary" className="text-[10px]">{typeConfig?.label}</Badge>
                                        {ev.event_time && <span className="text-[10px] text-slate-400">{ev.event_time.slice(0, 5)}</span>}
                                        {ev.sales && <span className="text-[10px] text-slate-400 truncate">· {ev.sales.client_name}</span>}
                                    </div>
                                    {ev.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ev.description}</p>}
                                    <p className="text-[10px] text-slate-400 mt-1">por {ev.profiles?.full_name ?? "Sistema"}</p>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>

            {/* Modal Novo/Editar Evento */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{editing ? "Editar Evento" : "Novo Evento"}</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <Field label="Título *">
                            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Entrega do Sr. João" />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Data *">
                                <Input type="date" value={form.event_date} onChange={e => setForm(p => ({ ...p, event_date: e.target.value }))} />
                            </Field>
                            <Field label="Hora">
                                <Input type="time" value={form.event_time} onChange={e => setForm(p => ({ ...p, event_time: e.target.value }))} />
                            </Field>
                        </div>
                        <Field label="Tipo de Evento">
                            <Select value={form.event_type} onValueChange={v => {
                                const t = EVENT_TYPES.find(t => t.value === v);
                                setForm(p => ({ ...p, event_type: v, color: t?.color || p.color }));
                            }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Descrição">
                            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
                        </Field>
                        <div className="flex items-center gap-3">
                            <Switch checked={form.is_private} onCheckedChange={v => setForm(p => ({ ...p, is_private: v }))} id="priv" />
                            <Label htmlFor="priv" className="cursor-pointer text-sm">Privado (apenas admins veem)</Label>
                        </div>
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
