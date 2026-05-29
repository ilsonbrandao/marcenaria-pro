export const ApiClient = {
    async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const headers = new Headers(options.headers || {});
        headers.set('Content-Type', 'application/json');

        // A sessão (Auth.js) é enviada automaticamente via cookie httpOnly.
        const response = await fetch(endpoint, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.error || 'Erro na comunicação com a API');
        }

        return response.json();
    },

    async closeSale(saleId: string, payload: any) {
        return this.request(`/api/sales/${saleId}/close`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async advanceSale(saleId: string, payload: any) {
        return this.request(`/api/sales/${saleId}/advance`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
};
