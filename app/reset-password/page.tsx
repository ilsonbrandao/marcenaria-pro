"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Info } from "lucide-react";

const MIN_LENGTH = 10;

function NoToken() {
    return (
        <CardContent>
            <div className="flex flex-col items-center gap-4 py-2">
                <div className="bg-blue-50 text-blue-700 p-3 rounded-md flex items-start gap-2 text-sm">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                        Este link é inválido ou já foi usado. Peça ao administrador da sua
                        marcenaria um novo link de definição de senha.
                    </span>
                </div>
                <Link href="/login" className="text-sm text-indigo-600 font-medium hover:underline">
                    Voltar ao Login
                </Link>
            </div>
        </CardContent>
    );
}

function SetPasswordForm({ token }: { token: string }) {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (password.length < MIN_LENGTH) {
            toast.error(`A senha deve ter ao menos ${MIN_LENGTH} caracteres.`);
            return;
        }
        if (password !== confirm) {
            toast.error("As senhas não conferem.");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/auth/set-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.error || "Não foi possível definir a senha.");
                return;
            }
            toast.success("Senha definida! Faça login para continuar.");
            router.push("/login");
        } finally {
            setSaving(false);
        }
    };

    return (
        <CardContent>
            <div className="space-y-3 py-2">
                <div className="space-y-1">
                    <Label>Nova Senha</Label>
                    <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={`Mínimo ${MIN_LENGTH} caracteres`}
                    />
                </div>
                <div className="space-y-1">
                    <Label>Confirmar Senha</Label>
                    <Input
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repita a senha"
                    />
                </div>
                <Button className="w-full" onClick={submit} disabled={saving}>
                    {saving ? "Salvando..." : "Definir senha"}
                </Button>
            </div>
        </CardContent>
    );
}

function ResetPasswordInner() {
    const token = useSearchParams().get("token");
    return token ? <SetPasswordForm token={token} /> : <NoToken />;
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md shadow-lg border-t-4 border-t-indigo-600">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-4">
                        <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
                            <Lock className="h-6 w-6 text-indigo-600" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-center">Definir Senha</CardTitle>
                    <CardDescription className="text-center">Escolha a senha da sua conta</CardDescription>
                </CardHeader>
                <Suspense fallback={<CardContent><p className="text-sm text-center py-4">Carregando…</p></CardContent>}>
                    <ResetPasswordInner />
                </Suspense>
            </Card>
        </div>
    );
}
