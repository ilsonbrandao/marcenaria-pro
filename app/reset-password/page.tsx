"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Info } from "lucide-react";

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
                    <CardTitle className="text-2xl font-bold text-center">Redefinir Senha</CardTitle>
                    <CardDescription className="text-center">Recurso indisponível</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center gap-4 py-2">
                        <div className="bg-blue-50 text-blue-700 p-3 rounded-md flex items-start gap-2 text-sm">
                            <Info className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>
                                A redefinição de senha por e-mail não está disponível.
                                Já logado, você pode alterar a senha no menu do seu perfil.
                                Caso não consiga acessar, peça ao administrador para cadastrar uma nova senha.
                            </span>
                        </div>
                        <Link href="/login" className="text-sm text-indigo-600 font-medium hover:underline">
                            Voltar ao Login
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
