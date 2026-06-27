"use client";

import jsPDF from "jspdf";

export interface BudgetItemPDF {
    description: string;
    qty: number;
    alt_cm: number;
    larg_cm: number;
    value_prazo: number;
    value_avista: number;
    is_active: boolean;
}

export interface BudgetEnvironmentPDF {
    name: string;
    items: BudgetItemPDF[];
}

export interface BudgetPDFData {
    orgName: string;
    orgCompanyName?: string;
    orgCNPJ?: string;
    orgPhone?: string;
    orgEmail?: string;
    orgAddress?: string;
    orgOwnerName?: string;
    orgLogoUrl?: string;
    validityDate: string;
    clientName: string;
    clientAddress?: string;
    paymentType: 'prazo' | 'avista' | 'both';
    totalPrazo: number;
    totalAvista: number;
    prazoEntryPercent: number;
    prazoInstallments: number;
    avistaDiscountPercent: number;
    avistaEntryPercent: number;
    environments: BudgetEnvironmentPDF[];
    observations?: string;
    responsibleName?: string;
}

async function urlToBase64(url: string): Promise<string | null> {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror  = () => reject(null);
            reader.readAsDataURL(blob);
        });
    } catch { return null; }
}

export interface GenerateBudgetPDFOptions {
    /** "save" (padrão) baixa o arquivo; "blob" retorna o arquivo para compartilhar. */
    output?: "save" | "blob";
}

export interface BudgetPDFResult {
    blob: Blob;
    filename: string;
}

export async function generateBudgetPDF(
    data: BudgetPDFData,
    opts: GenerateBudgetPDFOptions = {},
): Promise<BudgetPDFResult | void> {
    let logoBase64: string | null = null;
    if (data.orgLogoUrl) logoBase64 = await urlToBase64(data.orgLogoUrl);

    const doc = new jsPDF();
    const W  = doc.internal.pageSize.getWidth();
    const H  = doc.internal.pageSize.getHeight();
    const ML = 14;
    const MR = W - 14;

    const fmt = (v: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

    // ── Paleta clean para impressão ──────────────────────────
    const DARK        = [25,  25,  25]  as const;
    const GRAY        = [110, 110, 115] as const;
    const LGRAY       = [210, 210, 215] as const;  // bordas e linhas
    const FILL_LIGHT  = [246, 246, 249] as const;  // fundos muito sutis
    const FILL_ALT    = [251, 251, 253] as const;  // linhas alternadas

    // Acentos — apenas texto e bordas finas, sem preenchimento forte
    const ACCENT      = [60,  50,  185] as const;  // indigo — texto e bordas
    const ACCENT_FILL = [243, 243, 252] as const;  // indigo claríssimo
    const GREEN_T     = [4,   120, 87]  as const;  // emerald — texto e bordas
    const GREEN_FILL  = [242, 252, 247] as const;  // emerald claríssimo

    let y = 0;
    const checkPage = (needed: number) => {
        if (y + needed > H - 20) { doc.addPage(); y = 15; }
    };

    // ── CABEÇALHO (fundo branco) ─────────────────────────────
    const LOGO_W = 36;
    const LOGO_H = 36;
    const LOGO_X = ML;
    const LOGO_Y = 8;

    // Logo
    if (logoBase64) {
        try {
            const imgType = logoBase64.includes('image/png')  ? 'PNG'
                : logoBase64.includes('image/jpeg') || logoBase64.includes('image/jpg') ? 'JPEG'
                : 'PNG';
            doc.addImage(logoBase64, imgType, LOGO_X, LOGO_Y, LOGO_W, LOGO_H);
        } catch { /* ignora se falhar */ }
    } else {
        // Placeholder com inicial
        doc.setFillColor(...ACCENT_FILL);
        doc.roundedRect(LOGO_X, LOGO_Y, LOGO_W, LOGO_H, 3, 3, "F");
        doc.setDrawColor(...LGRAY);
        doc.setLineWidth(0.3);
        doc.roundedRect(LOGO_X, LOGO_Y, LOGO_W, LOGO_H, 3, 3, "S");
        doc.setTextColor(...ACCENT);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text(
            (data.orgName || "M").charAt(0).toUpperCase(),
            LOGO_X + LOGO_W / 2, LOGO_Y + LOGO_H / 2 + 5,
            { align: "center" }
        );
    }

    // Texto da empresa (ao lado da logo)
    const TX = LOGO_X + LOGO_W + 6;
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(data.orgName, TX, LOGO_Y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    let infoY = LOGO_Y + 14;
    if (data.orgCompanyName) {
        doc.text(data.orgCompanyName, TX, infoY);
        infoY += 5;
    }
    if (data.orgCNPJ) {
        doc.text(`CNPJ: ${data.orgCNPJ}`, TX, infoY);
    }

    // Linha de contato
    const contact: string[] = [];
    if (data.orgAddress) contact.push(data.orgAddress);
    if (data.orgPhone)   contact.push(`Tel: ${data.orgPhone}`);
    if (data.orgEmail)   contact.push(data.orgEmail);
    if (contact.length) {
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY);
        const contactStr = contact.join("  |  ");
        const cLines = doc.splitTextToSize(contactStr, W * 0.55);
        doc.text(cLines, TX, LOGO_Y + 28);
    }

    // Lado direito: ORÇAMENTO
    doc.setTextColor(...ACCENT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("ORÇAMENTO", MR, LOGO_Y + 9, { align: "right" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text(`Válido até: ${data.validityDate}`, MR, LOGO_Y + 16, { align: "right" });
    if (data.orgOwnerName) {
        doc.text(`Resp.: ${data.orgOwnerName}`, MR, LOGO_Y + 22, { align: "right" });
    }

    y = LOGO_Y + LOGO_H + 6;

    // Linha separadora
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.4);
    doc.line(ML, y, MR, y);
    y += 8;

    // ── PARA (CLIENTE) ───────────────────────────────────────
    const clientH = data.clientAddress ? 18 : 12;
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, W - ML * 2, clientH, 2, 2, "S");

    // Rótulo "PARA" — apenas borda esquerda colorida (accent strip)
    doc.setFillColor(...ACCENT_FILL);
    doc.roundedRect(ML, y, 16, clientH, 2, 2, "F");
    doc.rect(ML + 8, y, 8, clientH, "F"); // cobre metade direita arredondada
    doc.setTextColor(...ACCENT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("PARA", ML + 8, y + (data.clientAddress ? 10 : 7), { align: "center" });

    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(data.clientName, ML + 20, y + 6);
    if (data.clientAddress) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.text(data.clientAddress, ML + 20, y + 13);
    }

    y += clientH + 8;

    // ── CÁLCULOS ─────────────────────────────────────────────
    const showPrazo  = data.paymentType === 'prazo'  || data.paymentType === 'both';
    const showAvista = data.paymentType === 'avista' || data.paymentType === 'both';

    const prazoEntry       = data.totalPrazo * (data.prazoEntryPercent / 100);
    const prazoRemainder   = data.totalPrazo - prazoEntry;
    const prazoInstallment = data.prazoInstallments > 0 ? prazoRemainder / data.prazoInstallments : 0;
    const avistaTotal      = data.totalPrazo * (1 - data.avistaDiscountPercent / 100);
    const avistaEntry      = avistaTotal * (data.avistaEntryPercent / 100);
    const avistaRemainder  = avistaTotal - avistaEntry;

    // ── TABELA DE ITENS ──────────────────────────────────────
    const COL_QTY   = ML;
    const COL_DESC  = ML + 12;
    const COL_PRAZO = MR - 35;
    const COL_VIST  = MR;

    checkPage(14);

    // Cabeçalho da tabela — fundo muito claro, texto escuro
    doc.setFillColor(...FILL_LIGHT);
    doc.rect(ML, y - 3, W - ML * 2, 9, "F");
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.3);
    doc.rect(ML, y - 3, W - ML * 2, 9, "S");
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("Qtd",       COL_QTY,   y + 3);
    doc.text("Descrição", COL_DESC,  y + 3);
    doc.text("A Prazo",   COL_PRAZO, y + 3, { align: "right" });
    if (showAvista) doc.text("À Vista", COL_VIST, y + 3, { align: "right" });
    y += 10;

    let rowAlt = false;

    for (const env of data.environments) {
        const activeItems = env.items.filter(i => i.is_active);
        if (activeItems.length === 0) continue;

        checkPage(12);

        // Cabeçalho do ambiente
        doc.setFillColor(...ACCENT_FILL);
        doc.rect(ML, y - 2, W - ML * 2, 8, "F");

        // Barra lateral colorida no ambiente
        doc.setFillColor(...ACCENT);
        doc.rect(ML, y - 2, 2.5, 8, "F");

        doc.setTextColor(...ACCENT);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(env.name.toUpperCase(), COL_DESC, y + 4);
        y += 9;
        rowAlt = false;

        let subPrazo  = 0;
        let subAvista = 0;

        for (const item of activeItems) {
            checkPage(8);

            if (rowAlt) {
                doc.setFillColor(...FILL_ALT);
                doc.rect(ML, y - 2, W - ML * 2, 7, "F");
            }
            rowAlt = !rowAlt;

            const itemAvista = item.value_prazo * (1 - data.avistaDiscountPercent / 100);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(...DARK);
            doc.text(
                String(item.qty % 1 === 0 ? Math.round(item.qty) : item.qty).padStart(2, "0"),
                COL_QTY, y + 2
            );
            const descLines = doc.splitTextToSize(item.description, COL_PRAZO - COL_DESC - 4);
            doc.text(descLines[0], COL_DESC, y + 2);
            doc.text(fmt(item.value_prazo), COL_PRAZO, y + 2, { align: "right" });
            if (showAvista) doc.text(fmt(itemAvista), COL_VIST, y + 2, { align: "right" });

            subPrazo  += item.value_prazo;
            subAvista += itemAvista;
            y += 7;
        }

        // Subtotal
        checkPage(10);
        doc.setDrawColor(...LGRAY);
        doc.setLineWidth(0.2);
        doc.line(ML, y, MR, y);
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY);
        doc.text("Subtotal", COL_PRAZO - 22, y + 2, { align: "right" });
        doc.setTextColor(...DARK);
        doc.text(fmt(subPrazo), COL_PRAZO, y + 2, { align: "right" });
        if (showAvista) doc.text(fmt(subAvista), COL_VIST, y + 2, { align: "right" });
        y += 9;
    }

    // ── CARDS DE PAGAMENTO ───────────────────────────────────
    checkPage(42);
    y += 4;

    const colW = showPrazo && showAvista ? (W - ML * 2 - 4) / 2 : W - ML * 2;

    if (showPrazo) {
        const bx = ML;
        const bh = 32;
        doc.setFillColor(...ACCENT_FILL);
        doc.roundedRect(bx, y, colW, bh, 2, 2, "F");
        doc.setDrawColor(...ACCENT);
        doc.setLineWidth(0.4);
        doc.roundedRect(bx, y, colW, bh, 2, 2, "S");

        // Label — só texto, sem fundo sólido
        doc.setTextColor(...ACCENT);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("A PRAZO — CARTÃO DE CRÉDITO", bx + colW / 2, y + 7, { align: "center" });

        // Linha separadora fina sob o label
        doc.setDrawColor(...ACCENT);
        doc.setLineWidth(0.2);
        doc.line(bx + 6, y + 9, bx + colW - 6, y + 9);

        doc.setTextColor(...DARK);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(fmt(data.totalPrazo), bx + colW / 2, y + 18, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY);
        doc.text(
            `Entrada: ${fmt(prazoEntry)} (${data.prazoEntryPercent}%) + ${data.prazoInstallments}x de ${fmt(prazoInstallment)}`,
            bx + colW / 2, y + 25, { align: "center" }
        );
        doc.text("via cartão de crédito", bx + colW / 2, y + 30, { align: "center" });
    }

    if (showAvista) {
        const bx = showPrazo ? ML + colW + 4 : ML;
        const bh = 32;
        doc.setFillColor(...GREEN_FILL);
        doc.roundedRect(bx, y, colW, bh, 2, 2, "F");
        doc.setDrawColor(...GREEN_T);
        doc.setLineWidth(0.4);
        doc.roundedRect(bx, y, colW, bh, 2, 2, "S");

        doc.setTextColor(...GREEN_T);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(`À VISTA — PIX (-${data.avistaDiscountPercent}%)`, bx + colW / 2, y + 7, { align: "center" });

        doc.setDrawColor(...GREEN_T);
        doc.setLineWidth(0.2);
        doc.line(bx + 6, y + 9, bx + colW - 6, y + 9);

        doc.setTextColor(...DARK);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(fmt(avistaTotal), bx + colW / 2, y + 18, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY);
        doc.text(
            `Entrada: ${fmt(avistaEntry)} (${data.avistaEntryPercent}%) + Saldo: ${fmt(avistaRemainder)}`,
            bx + colW / 2, y + 25, { align: "center" }
        );
        doc.text("na finalização da montagem via PIX", bx + colW / 2, y + 30, { align: "center" });
    }

    y += 38;

    // ── OBSERVAÇÕES + RESPONSÁVEL ────────────────────────────
    const hasObs  = !!data.observations;
    const hasResp = !!data.responsibleName;

    if (hasObs || hasResp) {
        const RESP_W = 58;
        const obsW   = hasResp ? W - ML * 2 - RESP_W - 4 : W - ML * 2;

        const obsLines = hasObs ? doc.splitTextToSize(data.observations!, obsW - 6) : [];
        const obsH  = hasObs ? Math.max(obsLines.length * 4.5 + 8, 22) : 0;
        const blockH = hasResp ? Math.max(obsH, 24) : obsH;

        checkPage(blockH + 12);

        if (hasObs) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(...GRAY);
            doc.text("OBSERVAÇÕES", ML, y);
            y += 3;

            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(...LGRAY);
            doc.setLineWidth(0.3);
            doc.roundedRect(ML, y, obsW, blockH, 2, 2, "FD");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(...DARK);
            doc.text(obsLines, ML + 4, y + 6);
        }

        if (hasResp) {
            const rx = ML + obsW + 4;
            const ry = hasObs ? y : y + 3;
            if (!hasObs) y += 3;

            doc.setFillColor(...ACCENT_FILL);
            doc.setDrawColor(...ACCENT);
            doc.setLineWidth(0.3);
            doc.roundedRect(rx, ry, RESP_W, blockH, 2, 2, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6);
            doc.setTextColor(...ACCENT);
            doc.text("RESPONSÁVEL PELO ORÇAMENTO", rx + RESP_W / 2, ry + 7, { align: "center" });

            doc.setDrawColor(...ACCENT);
            doc.setLineWidth(0.2);
            doc.line(rx + 5, ry + 9, rx + RESP_W - 5, ry + 9);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(...DARK);
            const nameLines = doc.splitTextToSize(data.responsibleName!, RESP_W - 8);
            doc.text(nameLines, rx + RESP_W / 2, ry + 16, { align: "center" });
        }

        y += blockH + 8;
    }

    // ── RODAPÉ ───────────────────────────────────────────────
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.2);
    doc.line(ML, H - 12, MR, H - 12);
    doc.setFontSize(6.5);
    doc.setTextColor(180, 180, 185);
    doc.text(
        `Documento gerado em ${new Date().toLocaleDateString('pt-BR')} pelo sistema Fresa`,
        W / 2, H - 7, { align: "center" }
    );

    const safe = data.clientName.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Orcamento_${safe}.pdf`;

    if (opts.output === "blob") {
        return { blob: doc.output("blob"), filename };
    }

    doc.save(filename);
}
