"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRBAC } from "@/components/rbac-provider";
import { Phone, MapPin, Check } from "lucide-react";

const ROLE_INFO: Record<string, { label: string; color: string }> = {
    sysadmin: { label: "Super Admin",      color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    owner:    { label: "Proprietário",     color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
    office:   { label: "Escritório / Adm", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    seller:   { label: "Vendedor",         color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    carpenter:{ label: "Marceneiro",       color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
};

export default function ProfilePage() {
    const { profile } = useRBAC();
    const [email, setEmail] = useState("");
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!profile?.id) return;
        fetch("/api/me", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!data) return;
                setEmail(data.email || "");
                setFullName(data.full_name || "");
                setPhone(data.phone || "");
                setAddress(data.address || "");
            });
    }, [profile]);

    const handleSave = async () => {
        if (!profile?.id) return;
        setLoading(true);
        try {
            const res = await fetch("/api/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, address }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao salvar");
            setSaved(true);
            toast.success("Perfil salvo!");
            setTimeout(() => setSaved(false), 2500);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const roleInfo = profile?.role ? ROLE_INFO[profile.role] : undefined;
    const initials = fullName
        ? fullName.trim().split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
        : "?";

    return (
        <div className="max-w-sm mx-auto pt-4 pb-10 space-y-6">

            {/* Avatar + identidade */}
            <div className="flex flex-col items-center gap-3 pt-2">
                <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center shadow-lg">
                    <span className="text-3xl font-bold text-primary-foreground">{initials}</span>
                </div>
                <div className="text-center">
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                        {fullName || "Seu Nome"}
                    </p>
                    <p className="text-sm text-slate-400 mt-0.5">{email}</p>
                    {roleInfo && (
                        <span className={`inline-block text-xs font-semibold px-3 py-0.5 rounded-full mt-2 ${roleInfo.color}`}>
                            {roleInfo.label}
                        </span>
                    )}
                </div>
            </div>

            {/* Campos editáveis */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm divide-y divide-slate-100 dark:divide-zinc-800">

                <Field label="Nome">
                    <p className="text-sm text-slate-500 dark:text-slate-400 py-2">{fullName || "—"}</p>
                </Field>

                <Field label="E-mail">
                    <p className="text-sm text-slate-500 dark:text-slate-400 py-2">{email || "—"}</p>
                </Field>

                <Field label="Telefone" icon={<Phone className="h-4 w-4 text-slate-400" />}>
                    <Input
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="border-0 shadow-none focus-visible:ring-0 h-9 px-0 text-sm"
                    />
                </Field>

                <Field label="Endereço" icon={<MapPin className="h-4 w-4 text-slate-400" />}>
                    <Input
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        placeholder="Rua, Número, Bairro"
                        className="border-0 shadow-none focus-visible:ring-0 h-9 px-0 text-sm"
                    />
                </Field>
            </div>

            <Button
                onClick={handleSave}
                disabled={loading}
                className="w-full h-11 text-base font-semibold rounded-xl"
            >
                {saved ? (
                    <><Check className="h-4 w-4 mr-2" />Salvo!</>
                ) : loading ? "Salvando..." : "Salvar"}
            </Button>
        </div>
    );
}

function Field({ label, icon, children }: {
    label: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-start gap-3 px-4 py-3">
            {icon && <div className="mt-3 shrink-0">{icon}</div>}
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide leading-none mb-0.5">{label}</p>
                {children}
            </div>
        </div>
    );
}
