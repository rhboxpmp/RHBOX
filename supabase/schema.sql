-- ==============================================================================
-- RHBOX SIMPLES — Schema Único Enxuto para Supabase (Compatível com Plano Gratuito)
-- Prefeitura Municipal de Planalto — Bahia
-- ==============================================================================
-- Como instalar: cole este arquivo inteiro no SQL Editor do Supabase e clique em RUN.
-- Perfis de acesso:
--   - admin         : controle total do app, usuários/perfis, logs e suporte
--   - rh_geral      : gestão completa de todas as secretarias
--   - rh_secretaria : acesso restrito somente aos dados da própria secretaria
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. SECRETARIAS / LOTAÇÕES
CREATE TABLE IF NOT EXISTS public.secretarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    sigla TEXT NOT NULL UNIQUE,
    responsavel TEXT,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. PERFIS DE USUÁRIOS (vinculado a auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'rh_secretaria' CHECK (role IN ('admin', 'rh_geral', 'rh_secretaria')),
    secretaria_id UUID REFERENCES public.secretarias(id) ON DELETE SET NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3. FUNCIONÁRIOS (cadastro + vínculo + lotação unificados de forma direta)
CREATE TABLE IF NOT EXISTS public.funcionarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    matricula TEXT NOT NULL UNIQUE,
    cargo TEXT NOT NULL,
    vinculo TEXT NOT NULL CHECK (vinculo IN ('efetivo', 'contratado', 'comissionado', 'temporario', 'estagiario')),
    secretaria_id UUID NOT NULL REFERENCES public.secretarias(id) ON DELETE RESTRICT,
    data_admissao DATE NOT NULL,
    telefone TEXT,
    email TEXT,
    situacao TEXT NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo', 'ferias', 'afastado', 'licenca', 'desligado')),
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 4. ATESTADOS MÉDICOS
CREATE TABLE IF NOT EXISTS public.atestados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
    secretaria_id UUID NOT NULL REFERENCES public.secretarias(id) ON DELETE RESTRICT,
    data_emissao DATE NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    dias INTEGER NOT NULL CHECK (dias > 0),
    tipo TEXT NOT NULL DEFAULT 'Atestado Médico',
    status TEXT NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido', 'aprovado', 'rejeitado')),
    observacoes TEXT,
    anexo_nome TEXT,
    anexo_path TEXT,
    registrado_por TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 5. FÉRIAS, LICENÇAS E AFASTAMENTOS
CREATE TABLE IF NOT EXISTS public.ferias_afastamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
    secretaria_id UUID NOT NULL REFERENCES public.secretarias(id) ON DELETE RESTRICT,
    categoria TEXT NOT NULL CHECK (categoria IN ('ferias', 'licenca', 'afastamento')),
    subtipo TEXT NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    dias INTEGER NOT NULL CHECK (dias > 0),
    status TEXT NOT NULL DEFAULT 'programado' CHECK (status IN ('programado', 'em_andamento', 'concluido', 'cancelado')),
    observacoes TEXT,
    registrado_por TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 6. OCORRÊNCIAS FUNCIONAIS
CREATE TABLE IF NOT EXISTS public.ocorrencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
    secretaria_id UUID NOT NULL REFERENCES public.secretarias(id) ON DELETE RESTRICT,
    tipo TEXT NOT NULL CHECK (tipo IN ('elogio', 'advertencia', 'transferencia', 'capacitacao', 'portaria', 'outro')),
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    data_fato DATE NOT NULL,
    numero_ato TEXT,
    registrado_por TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 7. LOGS DE ATIVIDADE E SUPORTE (exclusivo Admin)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_nome TEXT NOT NULL,
    usuario_role TEXT NOT NULL,
    modulo TEXT NOT NULL,
    acao TEXT NOT NULL,
    detalhes TEXT,
    nivel TEXT NOT NULL DEFAULT 'info' CHECK (nivel IN ('info', 'alerta', 'erro')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Índices essenciais
CREATE INDEX IF NOT EXISTS idx_func_secretaria ON public.funcionarios(secretaria_id);
CREATE INDEX IF NOT EXISTS idx_atest_secretaria ON public.atestados(secretaria_id, data_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_ferias_secretaria ON public.ferias_afastamentos(secretaria_id, data_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_ocorr_secretaria ON public.ocorrencias(secretaria_id, data_fato DESC);
CREATE INDEX IF NOT EXISTS idx_logs_created ON public.activity_logs(created_at DESC);

-- Bucket privado único para anexos de atestados (compatível com Plano Gratuito 1 GB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('atestados', 'atestados', false, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- RLS SIMPLIFICADO E SEGURO (admin / rh_geral / rh_secretaria)
-- ==============================================================================
ALTER TABLE public.secretarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atestados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_afastamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
    SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()) AND ativo = true;
$$;

CREATE OR REPLACE FUNCTION public.my_secretaria_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
    SELECT secretaria_id FROM public.profiles WHERE id = (SELECT auth.uid()) AND ativo = true;
$$;

CREATE OR REPLACE FUNCTION public.can_access_secretaria(target_sec_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
    SELECT (SELECT public.my_role()) IN ('admin', 'rh_geral')
        OR ((SELECT public.my_role()) = 'rh_secretaria' AND (SELECT public.my_secretaria_id()) = target_sec_id);
$$;

-- Políticas de Secretarias
CREATE POLICY "sec_select" ON public.secretarias FOR SELECT TO authenticated USING (true);
CREATE POLICY "sec_manage" ON public.secretarias FOR ALL TO authenticated
    USING ((SELECT public.my_role()) IN ('admin', 'rh_geral'))
    WITH CHECK ((SELECT public.my_role()) IN ('admin', 'rh_geral'));

-- Políticas de Perfis (usuário vê o próprio; admin gerencia todos)
CREATE POLICY "prof_select" ON public.profiles FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()) OR (SELECT public.my_role()) = 'admin');
CREATE POLICY "prof_admin" ON public.profiles FOR ALL TO authenticated
    USING ((SELECT public.my_role()) = 'admin')
    WITH CHECK ((SELECT public.my_role()) = 'admin');

-- Políticas de Funcionários, Atestados, Férias/Afastamentos e Ocorrências (escopo por secretaria)
CREATE POLICY "func_scope" ON public.funcionarios FOR ALL TO authenticated
    USING ((SELECT public.can_access_secretaria(secretaria_id)))
    WITH CHECK ((SELECT public.can_access_secretaria(secretaria_id)));

CREATE POLICY "atest_scope" ON public.atestados FOR ALL TO authenticated
    USING ((SELECT public.can_access_secretaria(secretaria_id)))
    WITH CHECK ((SELECT public.can_access_secretaria(secretaria_id)));

CREATE POLICY "ferias_scope" ON public.ferias_afastamentos FOR ALL TO authenticated
    USING ((SELECT public.can_access_secretaria(secretaria_id)))
    WITH CHECK ((SELECT public.can_access_secretaria(secretaria_id)));

CREATE POLICY "ocorr_scope" ON public.ocorrencias FOR ALL TO authenticated
    USING ((SELECT public.can_access_secretaria(secretaria_id)))
    WITH CHECK ((SELECT public.can_access_secretaria(secretaria_id)));

-- Políticas de Logs de Suporte (qualquer autenticado grava; somente admin lê)
CREATE POLICY "logs_insert" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "logs_admin_select" ON public.activity_logs FOR SELECT TO authenticated
    USING ((SELECT public.my_role()) = 'admin');

-- Storage bucket 'atestados' (somente usuários autenticados)
CREATE POLICY "storage_atestados_all" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'atestados')
    WITH CHECK (bucket_id = 'atestados');

-- Seed inicial opcional de secretarias de exemplo
INSERT INTO public.secretarias (nome, sigla, responsavel) VALUES
    ('Secretaria Municipal de Administração', 'SEMAD', 'Coordenação Geral'),
    ('Secretaria Municipal de Saúde', 'SMS', 'Diretoria de Saúde'),
    ('Secretaria Municipal de Educação', 'SMEC', 'Coordenação Pedagógica'),
    ('Secretaria Municipal de Infraestrutura', 'SEINFRA', 'Diretoria de Obras')
ON CONFLICT (sigla) DO NOTHING;
