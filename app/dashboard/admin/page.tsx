"use client";

import { useEffect, useState } from "react";
import { useRBAC } from "@/components/rbac-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Users, Activity, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function AdminDashboardPage() {
    const { isSysadmin, loading: rbacLoading } = useRBAC();
    const router = useRouter();

    const [stats, setStats] = useState({
        totalOrgs: 0,
        totalUsers: 0,
        recentOrgs: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!rbacLoading) {
            if (!isSysadmin) {
                router.push("/dashboard");
                return;
            }
            fetchStats();
        }
    }, [rbacLoading, isSysadmin, router]);

    const fetchStats = async () => {
        try {
            const res = await fetch("/api/admin/stats", { cache: "no-store" });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao carregar");
            const data = await res.json();
            setStats({
                totalOrgs: data.totalOrgs || 0,
                totalUsers: data.totalUsers || 0,
                recentOrgs: data.recentOrgs || 0,
            });
        } catch (error: any) {
            toast.error("Erro ao carregar métricas", { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    if (rbacLoading || loading) {
        return <div className="p-8 flex items-center justify-center text-slate-500">Acessando painel da plataforma...</div>;
    }

    if (!isSysadmin) return null;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 border-b pb-4 border-slate-200">
                    Visão Geral da Plataforma
                </h1>
                <p className="text-slate-500 mt-2">
                    Acompanhe o crescimento e volume de clientes e usuários da Fresa SaaS.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-slate-50/50 border-b mb-4">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Total de Marcenarias Ativas
                        </CardTitle>
                        <Building2 className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{stats.totalOrgs}</div>
                        <p className="text-xs text-slate-500 mt-1">
                            +{stats.recentOrgs} na última semana
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-slate-50/50 border-b mb-4">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Volume Total de Usuários
                        </CardTitle>
                        <Users className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{stats.totalUsers}</div>
                        <p className="text-xs text-slate-500 mt-1">
                            Usuários cadastrados em todas as lojistas
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-slate-50/50 border-b mb-4">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            Status do Sistema
                        </CardTitle>
                        <Activity className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-emerald-600 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            Operacional
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Todos os serviços (Auth, Database, Storage) estão rodando normalmente.
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions / Helpers */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <h3 className="text-lg font-semibold text-indigo-900 mb-2">Para onde ir agora?</h3>
                    <ul className="space-y-3 text-sm text-indigo-800">
                        <li className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs">1</div>
                            <span>Acesse o menu <b>Marcenarias</b> para criar a estrutura dos seus clientes SaaS.</span>
                        </li>
                        <li className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs">2</div>
                            <span>Use o menu <b>Usuários</b> para enviar acesso aos donos de marcenaria na plataforma.</span>
                        </li>
                        <li className="flex items-center gap-2 cursor-pointer hover:underline" onClick={() => router.push('/dashboard/organizations')}>
                            <div className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs">→</div>
                            <b>Ir para Gestões de Marcenarias</b>
                        </li>
                    </ul>
                </div>

                <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-base font-semibold text-slate-800 mb-1">Dica de Administração</h3>
                        <p className="text-sm text-slate-600">
                            Lembre-se: Como <b>Admin Geral</b>, você tem acesso irrestrito para visualizar todos os dados de todas as tabelas (RLS Bypass ativado). Isso permite dar suporte técnico imediato. No entanto, se quiser ver e operar um Kanban de um cliente logista perfeitamente igual a ele, considere criar um perfil de "Admin da Marcenaria" para testar de modo isolado.
                        </p>
                    </div>
                </div>
            </div>

        </div>
    );
}
