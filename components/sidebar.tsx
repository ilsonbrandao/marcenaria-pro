"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useRBAC } from "./rbac-provider";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
    LayoutDashboard, Wallet, Package, Users,
    Hammer, BarChart3, Building2, CalendarDays, Truck,
    BadgeDollarSign, Sliders, ClipboardList, ScrollText,
    UserCog, ShieldAlert, FileText, Tag, Settings,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────
type MenuItem = { name: string; href: string; icon: any };

type RoleConfig = {
    label: string;
    badgeClass: string;
    borderClass: string;
    activeClass: string;
    items: MenuItem[];
};

const ROLES: Record<string, RoleConfig> = {
    sysadmin: {
        label: "Super Admin",
        badgeClass:  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
        borderClass: "border-slate-200 dark:border-zinc-700",
        activeClass: "bg-primary/10 text-primary",
        items: [
            { name: "Painel Geral",  href: "/dashboard/admin",        icon: ShieldAlert },
            { name: "Marcenarias",   href: "/dashboard/organizations", icon: Building2 },
            { name: "Usuários",      href: "/dashboard/users",         icon: UserCog },
        ],
    },
    owner: {
        label: "Proprietário",
        badgeClass:  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
        borderClass: "border-slate-200 dark:border-zinc-700",
        activeClass: "bg-primary/10 text-primary",
        items: [
            { name: "Business Intelligence", href: "/dashboard/bi",            icon: BarChart3 },
            { name: "Kanban de Projetos",     href: "/dashboard",               icon: LayoutDashboard },
            { name: "Orçamentos",             href: "/dashboard/budgets",       icon: FileText },
            { name: "Tabela de Preços",       href: "/dashboard/price-table",   icon: Tag },
            { name: "Financeiro",             href: "/dashboard/finance",       icon: Wallet },
            { name: "Estoque",                href: "/dashboard/inventory",     icon: Package },
            { name: "Clientes (CRM)",         href: "/dashboard/crm",           icon: Users },
            { name: "Arquitetos",             href: "/dashboard/architects",    icon: ClipboardList },
            { name: "Fornecedores",           href: "/dashboard/suppliers",     icon: Truck },
            { name: "Comissões",              href: "/dashboard/commissions",   icon: BadgeDollarSign },
            { name: "Relatórios",             href: "/dashboard/reports",       icon: ScrollText },
            { name: "Auditoria",              href: "/dashboard/audit",         icon: ShieldAlert },
            { name: "Config. Kanban",         href: "/dashboard/kanban-config", icon: Sliders },
            { name: "Usuários",               href: "/dashboard/users",         icon: UserCog },
            { name: "Configurações",          href: "/dashboard/settings",      icon: Settings },
        ],
    },
    office: {
        label: "Escritório / Adm",
        badgeClass:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
        borderClass: "border-slate-200 dark:border-zinc-700",
        activeClass: "bg-primary/10 text-primary",
        items: [
            { name: "Kanban de Projetos", href: "/dashboard",             icon: LayoutDashboard },
            { name: "Orçamentos",         href: "/dashboard/budgets",     icon: FileText },
            { name: "Tabela de Preços",   href: "/dashboard/price-table", icon: Tag },
            { name: "Financeiro",         href: "/dashboard/finance",     icon: Wallet },
            { name: "Clientes (CRM)",     href: "/dashboard/crm",         icon: Users },
            { name: "Arquitetos",         href: "/dashboard/architects",  icon: ClipboardList },
            { name: "Fornecedores",       href: "/dashboard/suppliers",   icon: Truck },
            { name: "Comissões",          href: "/dashboard/commissions", icon: BadgeDollarSign },
            { name: "Estoque",            href: "/dashboard/inventory",   icon: Package },
            { name: "Auditoria",          href: "/dashboard/audit",       icon: ShieldAlert },
            { name: "Usuários",           href: "/dashboard/users",       icon: UserCog },
        ],
    },
    seller: {
        label: "Vendedor",
        badgeClass:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        borderClass: "border-slate-200 dark:border-zinc-700",
        activeClass: "bg-primary/10 text-primary",
        items: [
            { name: "Minhas Vendas",  href: "/dashboard",             icon: LayoutDashboard },
            { name: "Orçamentos",     href: "/dashboard/budgets",     icon: FileText },
            { name: "Comissões",      href: "/dashboard/commissions", icon: BadgeDollarSign },
            { name: "Clientes (CRM)", href: "/dashboard/crm",         icon: Users },
        ],
    },
    carpenter: {
        label: "Marceneiro",
        badgeClass:  "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
        borderClass: "border-slate-200 dark:border-zinc-700",
        activeClass: "bg-primary/10 text-primary",
        items: [
            { name: "Meus Projetos", href: "/dashboard",             icon: Hammer },
            { name: "Comissões",     href: "/dashboard/commissions", icon: BadgeDollarSign },
        ],
    },
};

// ─── OrgBrand ─────────────────────────────────────────────
function OrgBrand() {
    const { profile, isSysadmin, effectiveOrgId } = useRBAC();
    const [org, setOrg] = useState<{ name: string; logo_url: string | null } | null>(null);

    useEffect(() => {
        if (!effectiveOrgId) { setOrg(null); return; }
        fetch(`/api/organizations?id=${effectiveOrgId}`, { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => setOrg(data ? { name: data.name, logo_url: data.logo_url } : null))
            .catch(() => setOrg(null));
    }, [effectiveOrgId]);

    if (isSysadmin && !effectiveOrgId) {
        return (
            <div className="px-4 mb-4 flex flex-col items-center gap-1">
                <div className="h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shadow-sm">
                    <ShieldAlert className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 text-center leading-tight">Marcenaria Pro</p>
                <p className="text-[10px] text-slate-400">Plataforma</p>
            </div>
        );
    }

    const name = org?.name ?? profile?.full_name ?? "Marcenaria";

    return (
        <div className="px-4 mb-4 flex flex-col items-center gap-1">
            <div className="h-12 w-12 rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 shadow-sm flex items-center justify-center">
                {org?.logo_url
                    ? <img src={org.logo_url} alt={name} className="h-full w-full object-contain p-1" />
                    : <Building2 className="h-6 w-6 text-slate-400 dark:text-zinc-500" />}
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 text-center leading-tight px-1 truncate w-full">
                {name}
            </p>
        </div>
    );
}

// ─── RoleCard ─────────────────────────────────────────────
function RoleCard({ roleKey, pathname }: { roleKey: string; pathname: string }) {
    const cfg = ROLES[roleKey];
    if (!cfg) return null;

    return (
        <div className={cn("rounded-xl border overflow-hidden bg-white dark:bg-zinc-900", cfg.borderClass)}>
            {/* Header sutil */}
            <div className="px-3 pt-2 pb-1.5 border-b border-slate-100 dark:border-zinc-800">
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", cfg.badgeClass)}>
                    {cfg.label}
                </span>
            </div>

            {/* Lista de itens */}
            <div className="py-0.5">
                {cfg.items.map(item => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium transition-colors",
                                active
                                    ? cfg.activeClass
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
                            )}
                        >
                            <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "" : "opacity-50")} />
                            <span className="truncate">{item.name}</span>
                            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-current shrink-0" />}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

// ─── ProfileCard ──────────────────────────────────────────
function ProfileCard() {
    const { profile, loading } = useRBAC();
    const role = profile?.role ?? "carpenter";
    const cfg = ROLES[role] ?? ROLES.carpenter;
    const initials = profile?.full_name
        ? profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
        : "MP";

    return (
        <div className={cn("mx-3 p-3 rounded-xl border bg-white dark:bg-zinc-900", cfg.borderClass)}>
            <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border-2 border-white shadow dark:border-zinc-700 shrink-0">
                    <AvatarImage src={profile?.avatar_url || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                        {loading ? "..." : initials}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate leading-tight">
                        {loading ? "Carregando..." : (profile?.full_name || "Usuário")}
                    </p>
                    <span className={cn("inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5", cfg.badgeClass)}>
                        {cfg.label}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Sidebar principal ────────────────────────────────────
export function Sidebar({ className }: { className?: string }) {
    const pathname = usePathname();
    const { profile, loading } = useRBAC();
    const role = (profile?.role ?? "carpenter") as keyof typeof ROLES;
    const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.2.0";

    return (
        <aside className={cn("h-full py-4 flex flex-col", className)}>
            <OrgBrand />

            <nav className="flex-1 px-3 space-y-3 overflow-y-auto">
                <RoleCard roleKey={role} pathname={pathname} />
            </nav>

            <div className="mt-3 space-y-3">
                {!loading && <ProfileCard />}
                <div className="text-center pb-1">
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-600">Marcenaria Pro © 2026</p>
                    <p className="text-[9px] text-slate-300 dark:text-slate-700 font-mono">v{version}</p>
                </div>
            </div>
        </aside>
    );
}

// ─── Sidebar mobile ───────────────────────────────────────
export function SidebarMobileMenu() {
    const pathname = usePathname();
    const { profile, loading } = useRBAC();
    const role = (profile?.role ?? "carpenter") as keyof typeof ROLES;
    const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.2.0";

    return (
        <div className="flex flex-col h-full py-4">
            <OrgBrand />
            <nav className="flex-1 px-3 space-y-3 overflow-y-auto">
                <RoleCard roleKey={role} pathname={pathname} />
            </nav>
            <div className="mt-3 space-y-3">
                {!loading && <ProfileCard />}
                <div className="text-center pb-1">
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-600">Marcenaria Pro © 2026</p>
                    <p className="text-[9px] text-slate-300 dark:text-zinc-700 font-mono">v{version}</p>
                </div>
            </div>
        </div>
    );
}
