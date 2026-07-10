import { signIn, signOut } from 'next-auth/react';

export type UserRole = 'sysadmin' | 'owner' | 'office' | 'seller' | 'carpenter';

export interface UserProfile {
    id: string;
    organization_id: string;
    role: UserRole;
    full_name: string;
    avatar_url?: string;
    color_theme?: string;
    address?: string;
    city?: string;
    state?: string;
    cpf?: string;
    phone?: string;
    notes?: string;
    is_active?: boolean;
    email?: string;
}

export const AuthService = {
    async login(email: string, password: string) {
        const res = await signIn('credentials', { email, password, redirect: false });
        if (!res || res.error) {
            throw new Error('Invalid login credentials');
        }
        return res;
    },

    async logout() {
        await signOut({ redirect: false });
    },

    async getCurrentUserProfile(): Promise<UserProfile | null> {
        const res = await fetch('/api/me', { cache: 'no-store' });
        if (!res.ok) return null;
        return (await res.json()) as UserProfile;
    },

    async getProfile(): Promise<UserProfile | null> {
        return this.getCurrentUserProfile();
    },

    async changePassword(currentPassword: string, newPassword: string) {
        const res = await fetch('/api/me/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, password: newPassword }),
        });
        if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.error || 'Falha ao alterar a senha.');
        }
    },

    async updateProfile(updates: Partial<Pick<UserProfile, 'full_name' | 'avatar_url' | 'color_theme' | 'phone'>>) {
        const res = await fetch('/api/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.error || 'Falha ao atualizar o perfil.');
        }
    },
};
