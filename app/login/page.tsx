"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthService } from "@/services/authService";
import { AlertCircle, Lock, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const handleAuthAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg("");

        try {
            await AuthService.login(email, password);
            router.push("/dashboard");
        } catch (err: any) {
            let msg = err.message || "Ocorreu um erro ao processar a autenticação.";

            if (msg.includes("Failed to fetch")) {
                msg = "Falha de conexão: não foi possível acessar o servidor. Verifique sua conexão e tente novamente.";
            } else if (msg.includes("Invalid login credentials")) {
                msg = "Usuário ou senha incorretos. Tente novamente.";
            } else if (msg.includes("User already registered")) {
                msg = "Este e-mail já está cadastrado no sistema.";
            }

            setErrorMsg(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md shadow-lg border-t-4 border-t-indigo-600">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-4">
                        <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
                            <Lock className="h-6 w-6 text-indigo-600" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-center">Fresa</CardTitle>
                    <CardDescription className="text-center">
                        Acesse o sistema com suas credenciais
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAuthAction} className="space-y-4">
                        {errorMsg && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-md flex items-center text-sm">
                                <AlertCircle className="h-4 w-4 mr-2 shrink-0" />
                                {errorMsg}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email">E-mail</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="nome@empresa.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Senha</Label>
                                <a href="/forgot-password" className="text-xs text-indigo-600 font-medium hover:underline">Esqueceu a senha?</a>
                            </div>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
                            {loading ? "Processando..." : "Entrar Seguramente"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
