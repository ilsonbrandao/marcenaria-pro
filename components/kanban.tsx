"use client";

import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { NewSaleDialog } from './new-sale-dialog';
import { ProjectDetailsSheet } from './project-details-sheet';
import { useRBAC } from './rbac-provider';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

type SaleProject = {
  id: string;
  client_name: string;
  status: 'Orçamento' | 'Produção' | 'Montagem' | 'Concluído';
  total_value: number;
  received_value: number;
  raw_material_cost: number;
  freight_cost: number;
  commission_seller_percent: number;
  commission_carpenter_percent: number;
  rt_architect_percent: number;
};

const COLUMNS = ['Orçamento', 'Produção', 'Montagem', 'Concluído'];

export function KanbanBoard() {
  const [projects, setProjects] = useState<SaleProject[]>([]);
  const [loading, setLoading] = useState(true);
  const { isCarpenter } = useRBAC();
  const [selectedProject, setSelectedProject] = useState<SaleProject | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Auto-open project from ?sale= query param
  useEffect(() => {
    const saleId = searchParams.get('sale');
    if (!saleId || projects.length === 0) return;
    const found = projects.find(p => p.id === saleId);
    if (found) { setSelectedProject(found); setIsSheetOpen(true); }
  }, [searchParams, projects]);

  // Busca inicial
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sales', { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Falha ao buscar projetos');
      setProjects((await res.json()) as SaleProject[]);
    } catch (err: any) {
      toast.error('Erro ao buscar projetos', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  // Cálculo Simples de Lucro (Pode ser melhorado em telas detalhadas)
  const calcEstimatedProfit = (p: SaleProject) => {
    const total = p.total_value;
    const costs = p.raw_material_cost + p.freight_cost;
    const commissions = (total * (p.commission_seller_percent + p.commission_carpenter_percent + p.rt_architect_percent)) / 100;
    return total - costs - commissions;
  };

  const getMarginColor = (total: number, profit: number) => {
    if (total === 0) return 'text-gray-500 bg-gray-50';
    const margin = (profit / total) * 100;
    if (margin >= 35) return 'text-emerald-600 bg-emerald-50';
    if (margin >= 25) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId) return;

    const oldStatus = source.droppableId;
    const newStatus = destination.droppableId as any;

    // Otimização Otimista no Cliente Front
    setProjects((prev: SaleProject[]) => prev.map((p: SaleProject) =>
      p.id === draggableId ? { ...p, status: newStatus } : p
    ));

    // Atualiza Status na Nuvem
    const res = await fetch('/api/sales', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draggableId, status: newStatus }),
    });

    if (!res.ok) {
      toast.error('Erro ao mover projeto', { description: (await res.json().catch(() => ({}))).error });
      fetchProjects();
      return;
    }
    const info = await res.json().catch(() => ({}));

    // ==========================================
    // BAIXA AUTOMÁTICA DE ESTOQUE (→ Produção)
    // ==========================================
    if (newStatus === 'Produção' && oldStatus === 'Orçamento') {
      const linkedCount = info.linked_materials_count ?? 0;
      if (linkedCount > 0) {
        toast.success('🏭 Produção iniciada!', {
          description: `${linkedCount} material(is) já deduzidos do estoque.`,
        });
      } else {
        toast.info('🏭 Produção iniciada!', {
          description: 'Nenhum material vinculado. Clique no card para vincular insumos do estoque.',
        });
      }
    }

    // ==========================================
    // FECHAMENTO DRE (→ Concluído)
    // ==========================================
    if (newStatus === 'Concluído') {
      const project = projects.find((p: SaleProject) => p.id === draggableId);
      if (project) {
        const totalDirectExpenses = info.total_direct_expenses ?? 0;

        // Custo total real = material + frete + despesas diretas
        const realCosts = (project.raw_material_cost || 0) + (project.freight_cost || 0) + totalDirectExpenses;
        const commissions = (project.total_value * ((project.commission_seller_percent || 0) + (project.commission_carpenter_percent || 0) + (project.rt_architect_percent || 0))) / 100;
        const realProfit = project.total_value - realCosts - commissions;
        const margin = project.total_value > 0 ? ((realProfit / project.total_value) * 100).toFixed(1) : '0';

        const formatBRLLocal = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

        if (realProfit >= 0) {
          toast.success('✅ Projeto Concluído com Sucesso!', {
            description: `Lucro Real: ${formatBRLLocal(realProfit)} (${margin}%). Despesas diretas: ${formatBRLLocal(totalDirectExpenses)}`,
            duration: 8000,
          });
        } else {
          toast.error('⚠️ Projeto Concluído com PREJUÍZO!', {
            description: `Prejuízo de ${formatBRLLocal(Math.abs(realProfit))}. Revise os custos deste projeto.`,
            duration: 10000,
          });
        }
      }
    }

    // Status genéricos
    if (newStatus !== 'Produção' && newStatus !== 'Concluído') {
      toast.info(`Projeto movido para ${newStatus}`);
    }
    if (newStatus === 'Montagem') {
      toast.info('🔧 Montagem iniciada!', { description: 'Projeto em fase de montagem no cliente.' });
    }
  };

  if (loading && projects.length === 0) {
    return <div className="p-8 flex items-center justify-center text-indigo-500 animate-pulse">Carregando seus projetos...</div>;
  }

  return (
    <div className="bg-transparent h-full flex flex-col">
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kanban de Projetos</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Acompanhamento e saúde financeira de vendas ativas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors font-medium ${showCompleted ? 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-zinc-700' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'}`}
          >
            {showCompleted ? 'Ocultar Concluídos' : 'Mostrar Concluídos'}
          </button>
          {!isCarpenter && <NewSaleDialog onSaleAdded={fetchProjects} />}
        </div>
      </header>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className={`grid grid-cols-1 gap-4 pb-4 ${showCompleted ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          {COLUMNS.filter((col) => showCompleted || col !== 'Concluído').map((column) => (
            <Droppable key={column} droppableId={column}>
              {(provided, snapshot) => (
                <div
                  className={`flex flex-col bg-slate-100/50 dark:bg-zinc-900/50 rounded-xl border-t-4 transition-colors ${snapshot.isDraggingOver ? 'bg-indigo-50 dark:bg-zinc-800 border-indigo-500' : 'border-slate-300 dark:border-zinc-700'}`}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5">
                    <h2 className="font-semibold text-slate-800 dark:text-slate-200">{column}</h2>
                    <span className="bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 text-xs font-bold px-2 py-1 rounded-md shadow-sm border border-black/5 dark:border-white/5">
                      {projects.filter((p: SaleProject) => p.status === column).length}
                    </span>
                  </div>

                  <div className="flex-1 min-h-[500px] p-2 flex flex-col gap-3">
                    {projects.filter((p: SaleProject) => p.status === column).map((project: SaleProject, index: number) => {
                      const profit = calcEstimatedProfit(project);
                      const marginPercent = project.total_value > 0 ? ((profit / project.total_value) * 100).toFixed(0) : 0;
                      const balance = project.total_value - project.received_value;

                      return (
                        <Draggable key={project.id} draggableId={project.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => {
                                if (isCarpenter) {
                                  router.push(`/dashboard/projects/${project.id}`);
                                } else {
                                  setSelectedProject(project);
                                  setIsSheetOpen(true);
                                }
                              }}
                              className={`bg-white dark:bg-zinc-950 rounded-lg shadow-sm p-4 border transition-all ${snapshot.isDragging ? 'shadow-lg border-indigo-500 rotate-2' : 'border-black/5 dark:border-white/5 hover:border-indigo-300'
                                } cursor-grab active:cursor-grabbing hover:shadow-md`}
                            >
                              <div className="flex justify-between items-start mb-3">
                                <h3 className="font-medium text-sm text-slate-900 dark:text-slate-100 leading-snug">
                                  {project.client_name}
                                </h3>
                              </div>

                              {!isCarpenter && (
                                <div className="space-y-2 mt-4">
                                  <div className="flex justify-between text-xs items-center">
                                    <span className="text-slate-500 dark:text-slate-400">Valor Total</span>
                                    <span className="font-semibold text-slate-900 dark:text-slate-200">{formatBRL(project.total_value)}</span>
                                  </div>

                                  <div className="flex justify-between text-xs items-center">
                                    <span className="text-slate-500 dark:text-slate-400">A Receber</span>
                                    <span className="font-medium text-amber-600 dark:text-amber-500">{formatBRL(balance)}</span>
                                  </div>

                                </div>
                              )}

                              {isCarpenter && (
                                <div className="space-y-2 mt-4">
                                  <div className="flex justify-between text-xs items-center">
                                    <span className="text-slate-500 dark:text-slate-400">Status</span>
                                    <span className="font-medium text-indigo-600 dark:text-indigo-500">{project.status}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {/* Painel Lateral Financeiro do Projeto */}
      <ProjectDetailsSheet
        project={selectedProject}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onUpdated={fetchProjects}
      />
    </div>
  );
}
