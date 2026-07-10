"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useRBAC } from "./rbac-provider";
import { useColorTheme } from "./color-theme-provider";
import { COLOR_THEMES, ColorTheme } from "@/lib/color-themes";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import {
    Menu, Moon, Sun, Monitor, LogOut, KeyRound, User,
    Building2, ChevronDown, X, Palette, CalendarDays,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { AuthService } from "@/services/authService";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SidebarMobileMenu } from "./sidebar";

interface Organization {
    id: string;
    name: string;
}

export function Header() {
    const { setTheme, theme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const { profile, isSysadmin, impersonatedOrg, impersonate } = useRBAC();
    const { colorTheme, setColorTheme } = useColorTheme();

    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [loadingOrgs, setLoadingOrgs] = useState(false);
    const [changePwdOpen, setChangePwdOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [savingPwd, setSavingPwd] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (!isSysadmin) return;
        setLoadingOrgs(true);
        fetch("/api/organizations", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => {
                setOrgs((data || []).map((o: any) => ({ id: o.id, name: o.name })));
                setLoadingOrgs(false);
            })
            .catch(() => setLoadingOrgs(false));
    }, [isSysadmin]);

    const getInitials = () => {
        if (!profile?.full_name) return "MP";
        return profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
    };

    const handleLogout = async () => {
        await AuthService.logout();
        toast.info("Você saiu do sistema.");
        router.push("/login");
    };

    const handleChangePwd = async () => {
        if (!currentPassword) { toast.error("Informe a senha atual."); return; }
        if (newPassword.length < 10) { toast.error("Senha muito curta (mínimo 10 caracteres)."); return; }
        if (newPassword !== confirmPassword) { toast.error("As senhas não conferem."); return; }
        setSavingPwd(true);
        try {
            await AuthService.changePassword(currentPassword, newPassword);
            setChangePwdOpen(false);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            // A troca invalida todas as sessões, inclusive esta.
            toast.success("Senha alterada. Entre novamente com a nova senha.");
            await AuthService.logout();
            router.push("/login");
        } catch (err: any) {
            toast.error(err.message || "Erro ao alterar senha.");
        } finally {
            setSavingPwd(false);
        }
    };

    return (
        <>
            <header className="sticky top-0 z-30 flex h-11 w-full shrink-0 items-center gap-2 bg-white px-3 border-b dark:bg-zinc-950 dark:border-zinc-800 shadow-sm md:px-4">
                {/* Mobile menu trigger */}
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 md:hidden">
                            <Menu className="h-4 w-4" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-72 p-0">
                        <SidebarMobileMenu />
                    </SheetContent>
                </Sheet>

                {/* Impersonation Banner (sysadmin) */}
                <div className="flex-1 min-w-0">
                    {isSysadmin && impersonatedOrg && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 w-fit">
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span>Visualizando: <strong>{impersonatedOrg.name}</strong></span>
                            <button onClick={() => impersonate(null)} className="ml-0.5 hover:text-amber-900">
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {/* Seletor de Empresa — apenas Super Admin */}
                    {isSysadmin && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="hidden md:flex gap-1 h-8 text-xs max-w-[150px] px-2">
                                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">
                                        {impersonatedOrg ? impersonatedOrg.name : "Selecionar Empresa"}
                                    </span>
                                    <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
                                <DropdownMenuLabel>Impersonar Marcenaria</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {impersonatedOrg && (
                                    <>
                                        <DropdownMenuItem onClick={() => impersonate(null)} className="text-amber-600 font-medium">
                                            <X className="mr-2 h-4 w-4" />
                                            Sair da conta do cliente
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </>
                                )}
                                {loadingOrgs
                                    ? <DropdownMenuItem disabled>Carregando...</DropdownMenuItem>
                                    : orgs.map(org => (
                                        <DropdownMenuItem
                                            key={org.id}
                                            onClick={() => impersonate(org)}
                                            className={cn(impersonatedOrg?.id === org.id && "bg-primary/10 text-primary")}
                                        >
                                            <Building2 className="mr-2 h-4 w-4 opacity-60" />
                                            {org.name}
                                        </DropdownMenuItem>
                                    ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {/* Calendário */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-8 w-8 rounded-full",
                            pathname === "/dashboard/calendar"
                                ? "text-primary bg-primary/10"
                                : "text-slate-500 dark:text-slate-400"
                        )}
                        title="Calendário"
                        onClick={() => router.push("/dashboard/calendar")}
                    >
                        <CalendarDays className="h-[1.1rem] w-[1.1rem]" />
                    </Button>

                    {/* Aparência: Cores + Modo (menu unificado) */}
                    {mounted && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="Aparência">
                                    <span className="relative flex items-center justify-center h-5 w-5">
                                        <Palette className="h-[1.1rem] w-[1.1rem] text-slate-500 dark:text-slate-400" />
                                        <span
                                            className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-white dark:border-zinc-950 shadow"
                                            style={{ background: `hsl(var(--primary))` }}
                                        />
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 p-2.5 space-y-2.5">

                                {/* Cores — 6 bolinhas em 2 linhas de 3 */}
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Cor</p>
                                    <div className="grid grid-cols-6 gap-1.5">
                                        {COLOR_THEMES.map(t => {
                                            const active = colorTheme === t.value;
                                            return (
                                                <button
                                                    key={t.value}
                                                    title={t.label}
                                                    onClick={() => setColorTheme(t.value as ColorTheme)}
                                                    className={cn(
                                                        "relative h-6 w-6 rounded-full border-2 shadow-sm transition-all hover:scale-110",
                                                        active
                                                            ? "border-primary ring-2 ring-primary ring-offset-1 dark:ring-offset-zinc-900 scale-110"
                                                            : "border-transparent hover:border-slate-300 dark:hover:border-zinc-500"
                                                    )}
                                                >
                                                    <span className={cn("absolute inset-0 rounded-full", t.swatch)} />
                                                    {active && (
                                                        <span className="absolute inset-0 flex items-center justify-center">
                                                            <svg className="h-2.5 w-2.5 text-white drop-shadow" viewBox="0 0 12 12" fill="none">
                                                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                            </svg>
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Divisor */}
                                <div className="h-px bg-slate-100 dark:bg-zinc-800" />

                                {/* Modo claro/escuro */}
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Aparência</p>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {([
                                            { value: "light",  label: "Claro",  icon: Sun },
                                            { value: "system", label: "Auto",   icon: Monitor },
                                            { value: "dark",   label: "Escuro", icon: Moon },
                                        ] as const).map(({ value, label, icon: Icon }) => {
                                            const active = theme === value;
                                            return (
                                                <button
                                                    key={value}
                                                    onClick={() => setTheme(value)}
                                                    className={cn(
                                                        "flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-[11px] font-medium transition-all",
                                                        active
                                                            ? "border-primary bg-primary/10 text-primary shadow-sm"
                                                            : "border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
                                                    )}
                                                >
                                                    <Icon className="h-4 w-4" />
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {/* Perfil do Usuário */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-8 w-8 rounded-full cursor-pointer p-0">
                                <Avatar className="h-8 w-8 border border-primary/20">
                                    <AvatarImage src={profile?.avatar_url || ""} alt="User" />
                                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">{getInitials()}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-52" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal py-2">
                                <div className="flex flex-col space-y-0.5">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                                        {profile?.full_name || "Carregando..."}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {ROLE_LABELS[profile?.role ?? "carpenter"]}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/dashboard/profile")}>
                                <User className="mr-2 h-4 w-4" />Meu Perfil
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => setChangePwdOpen(true)}>
                                <KeyRound className="mr-2 h-4 w-4" />Alterar Senha
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer dark:text-red-400">
                                <LogOut className="mr-2 h-4 w-4" />Sair do sistema
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Modal Alterar Senha */}
            <Dialog open={changePwdOpen} onOpenChange={setChangePwdOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Alterar Senha</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1">
                            <Label>Senha Atual</Label>
                            <Input
                                type="password"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                placeholder="Sua senha atual"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Nova Senha</Label>
                            <Input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="Mínimo 10 caracteres"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Confirmar Senha</Label>
                            <Input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Repita a nova senha"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setChangePwdOpen(false)}>Cancelar</Button>
                        <Button onClick={handleChangePwd} disabled={savingPwd}>
                            {savingPwd ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

const ROLE_LABELS: Record<string, string> = {
    sysadmin:  "Super Admin",
    owner:     "Proprietário",
    office:    "Escritório / Adm",
    seller:    "Vendedor",
    carpenter: "Marceneiro",
};
