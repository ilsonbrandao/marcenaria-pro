import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthSessionProvider } from "@/components/session-provider";

export const metadata: Metadata = {
    title: "Fresa — Gestão para Marcenarias",
    description: "Sistema Multi-tenant para Gestão de Marcenarias",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pt-BR" suppressHydrationWarning>
            <body style={{ fontFamily: '"Inter", sans-serif' }}>
                <AuthSessionProvider>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        {children}
                        <Toaster richColors position="top-center" />
                    </ThemeProvider>
                </AuthSessionProvider>
            </body>
        </html>
    );
}
