"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Info } from "lucide-react";

export default function ForgotPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md shadow-lg border-t-4 border-t-indigo-600">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-4">
                        <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
                            <KeyRound className="h-6 w-6 text-indigo-600" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-center">Recuperar Senha</CardTitle>
                    <CardDescription className="text-center">
                        Redefinição de senha
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center gap-4 py-2">
                        <div className="bg-blue-50 text-blue-700 p-3 rounded-md flex items-start gap-2 text-sm">
                            <Info className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>
                                Para redefinir sua senha, peça ao administrador da sua marcenaria.
                                Ele pode cadastrar uma nova senha para você na tela de <b>Usuários</b>.
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
