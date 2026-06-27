"use client";

import jsPDF from "jspdf";

interface ContractData {
    clientName: string;
    totalValue: number;
    receivedValue: number;
    rawMaterialCost: number;
    freightCost: number;
    commissionCarpenter: number;
    commissionSeller: number;
    rtArchitect: number;
    status: string;
    orgName?: string;
}

export function generateContractPDF(data: ContractData) {
    const doc = new jsPDF();
    const formatBRL = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFillColor(79, 70, 229); // Indigo
    doc.rect(0, 0, pageWidth, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(data.orgName || "Sua Marcenaria", 15, 18);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Contrato de Prestação de Serviço de Marcenaria", 15, 28);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 15, 35);

    y = 55;

    // Info do Cliente
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Dados do Projeto", 15, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const addRow = (label: string, value: string, yPos: number) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text(label, 15, yPos);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 30);
        doc.text(value, 80, yPos);
        return yPos + 8;
    };

    y = addRow("Cliente:", data.clientName, y);
    y = addRow("Status:", data.status, y);
    y = addRow("Valor Total:", formatBRL(data.totalValue), y);
    y = addRow("Já Recebido:", formatBRL(data.receivedValue), y);
    y = addRow("Saldo Restante:", formatBRL(data.totalValue - data.receivedValue), y);

    y += 5;

    // Divisor
    doc.setDrawColor(220, 220, 220);
    doc.line(15, y, pageWidth - 15, y);
    y += 10;

    // Custos
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Detalhamento de Custos", 15, y);
    y += 10;

    doc.setFontSize(10);
    y = addRow("Material (MDF/Ferragem):", formatBRL(data.rawMaterialCost), y);
    y = addRow("Frete / Refeições:", formatBRL(data.freightCost), y);

    y += 5;
    doc.line(15, y, pageWidth - 15, y);
    y += 10;

    // Comissões
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Comissões e RT", 15, y);
    y += 10;

    doc.setFontSize(10);
    y = addRow("Comissão Marceneiro:", `${data.commissionCarpenter}%  (${formatBRL(data.totalValue * data.commissionCarpenter / 100)})`, y);
    y = addRow("Comissão Vendedor:", `${data.commissionSeller}%  (${formatBRL(data.totalValue * data.commissionSeller / 100)})`, y);
    y = addRow("RT Arquiteto:", `${data.rtArchitect}%  (${formatBRL(data.totalValue * data.rtArchitect / 100)})`, y);

    y += 5;
    doc.line(15, y, pageWidth - 15, y);
    y += 10;

    // Resumo Final
    const totalCosts = data.rawMaterialCost + data.freightCost;
    const totalCommissions = data.totalValue * (data.commissionCarpenter + data.commissionSeller + data.rtArchitect) / 100;
    const profit = data.totalValue - totalCosts - totalCommissions;
    const margin = data.totalValue > 0 ? (profit / data.totalValue * 100).toFixed(1) : "0";

    doc.setFillColor(245, 245, 255);
    doc.rect(15, y - 3, pageWidth - 30, 30, "F");
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(79, 70, 229);
    doc.text(`Lucro Estimado: ${formatBRL(profit)}`, 20, y + 8);
    doc.text(`Margem: ${margin}%`, 20, y + 18);

    y += 40;

    // Assinatura
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("_______________________________", 15, y);
    doc.text("Assinatura do Cliente", 15, y + 8);
    doc.text("_______________________________", pageWidth / 2 + 10, y);
    doc.text("Assinatura da Marcenaria", pageWidth / 2 + 10, y + 8);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text("Documento gerado automaticamente pelo sistema Fresa", 15, 285);

    // Salvar
    const safeFilename = data.clientName.replace(/[^a-zA-Z0-9]/g, "_");
    doc.save(`Contrato_${safeFilename}.pdf`);
}
