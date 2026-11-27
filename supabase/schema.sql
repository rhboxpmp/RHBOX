-- ==============================================================================
-- RHBOX — Schema Único Enxuto para Supabase (Compatível com Plano Gratuito)
-- ==============================================================================
-- COMO INSTALAR:
--   1. No Supabase, abra "SQL Editor" -> "New query"
--   2. Cole este arquivo inteiro e clique em "Run"
--   3. Em "Authentication -> Users -> Add user", crie o primeiro usuário:
--      ele receberá automaticamente o perfil ADMIN!
--
-- PERFIS DE ACESSO:
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

-- 3. FUNCIONÁRIOS (cadastro + vínculo + lotação)
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

-- ==============================================================================
-- TRIGGER AUTOMÁTICO DE PERFIL NO CADASTRO DE USUÁRIO (auth.users -> profiles)
-- O 1º usuário criado no projeto vira automaticamente 'admin'!
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_has_any_profile BOOLEAN;
    v_role TEXT;
    v_nome TEXT;
    v_sec_id UUID;
BEGIN
    SELECT EXISTS(SELECT 1 FROM public.profiles) INTO v_has_any_profile;

    IF NOT v_has_any_profile THEN
        v_role := 'admin';
    ELSE
        v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'rh_secretaria');
        IF v_role NOT IN ('admin', 'rh_geral', 'rh_secretaria') THEN
            v_role := 'rh_secretaria';
        END IF;
    END IF;

    v_nome := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'nome'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        split_part(NEW.email, '@', 1)
    );

    BEGIN
        v_sec_id := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'secretaria_id', '')), '')::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_sec_id := NULL;
    END;

    INSERT INTO public.profiles (id, nome, email, role, secretaria_id, ativo)
    VALUES (NEW.id, v_nome, LOWER(NEW.email), v_role, v_sec_id, true)
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Backfill seguro caso você já tenha criado o 1º usuário no Auth antes de rodar este SQL
INSERT INTO public.profiles (id, nome, email, role, ativo)
SELECT
    u.id,
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'nome'), ''), split_part(u.email, '@', 1)),
    LOWER(u.email),
    CASE
        WHEN NOT EXISTS (SELECT 1 FROM public.profiles)
             AND row_number() OVER (ORDER BY u.created_at) = 1
        THEN 'admin'
        ELSE 'rh_secretaria'
    END,
    true
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Bucket privado único para anexos de atestados (compatível com Plano Gratuito 1 GB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('atestados', 'atestados', false, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE SET public = false;

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

-- Políticas de Secretarias (idempotentes)
DROP POLICY IF EXISTS "sec_select" ON public.secretarias;
CREATE POLICY "sec_select" ON public.secretarias FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sec_manage" ON public.secretarias;
CREATE POLICY "sec_manage" ON public.secretarias FOR ALL TO authenticated
    USING ((SELECT public.my_role()) IN ('admin', 'rh_geral'))
    WITH CHECK ((SELECT public.my_role()) IN ('admin', 'rh_geral'));

-- Políticas de Perfis
DROP POLICY IF EXISTS "prof_select" ON public.profiles;
CREATE POLICY "prof_select" ON public.profiles FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()) OR (SELECT public.my_role()) = 'admin');

DROP POLICY IF EXISTS "prof_admin" ON public.profiles;
CREATE POLICY "prof_admin" ON public.profiles FOR ALL TO authenticated
    USING ((SELECT public.my_role()) = 'admin')
    WITH CHECK ((SELECT public.my_role()) = 'admin');

-- Políticas de Funcionários, Atestados, Férias/Afastamentos e Ocorrências
DROP POLICY IF EXISTS "func_scope" ON public.funcionarios;
CREATE POLICY "func_scope" ON public.funcionarios FOR ALL TO authenticated
    USING ((SELECT public.can_access_secretaria(secretaria_id)))
    WITH CHECK ((SELECT public.can_access_secretaria(secretaria_id)));

DROP POLICY IF EXISTS "atest_scope" ON public.atestados;
CREATE POLICY "atest_scope" ON public.atestados FOR ALL TO authenticated
    USING ((SELECT public.can_access_secretaria(secretaria_id)))
    WITH CHECK ((SELECT public.can_access_secretaria(secretaria_id)));

DROP POLICY IF EXISTS "ferias_scope" ON public.ferias_afastamentos;
CREATE POLICY "ferias_scope" ON public.ferias_afastamentos FOR ALL TO authenticated
    USING ((SELECT public.can_access_secretaria(secretaria_id)))
    WITH CHECK ((SELECT public.can_access_secretaria(secretaria_id)));

DROP POLICY IF EXISTS "ocorr_scope" ON public.ocorrencias;
CREATE POLICY "ocorr_scope" ON public.ocorrencias FOR ALL TO authenticated
    USING ((SELECT public.can_access_secretaria(secretaria_id)))
    WITH CHECK ((SELECT public.can_access_secretaria(secretaria_id)));

-- Políticas de Logs de Suporte
DROP POLICY IF EXISTS "logs_insert" ON public.activity_logs;
CREATE POLICY "logs_insert" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "logs_admin_select" ON public.activity_logs;
CREATE POLICY "logs_admin_select" ON public.activity_logs FOR SELECT TO authenticated
    USING ((SELECT public.my_role()) = 'admin');

-- Storage bucket 'atestados' (isolado por secretaria via pasta <secretaria_id>/<arquivo>)
DROP POLICY IF EXISTS "storage_atestados_all" ON storage.objects;
DROP POLICY IF EXISTS "storage_atestados_scope" ON storage.objects;
CREATE POLICY "storage_atestados_scope" ON storage.objects FOR ALL TO authenticated
    USING (
        bucket_id = 'atestados'
        AND (
            (SELECT public.my_role()) IN ('admin', 'rh_geral')
            OR (
                (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
                AND (SELECT public.can_access_secretaria(((storage.foldername(name))[1])::uuid))
            )
        )
    )
    WITH CHECK (
        bucket_id = 'atestados'
        AND (
            (SELECT public.my_role()) IN ('admin', 'rh_geral')
            OR (
                (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
                AND (SELECT public.can_access_secretaria(((storage.foldername(name))[1])::uuid))
            )
        )
    );

-- Seed inicial de secretarias de exemplo (pode renomear/editar depois no app)
INSERT INTO public.secretarias (nome, sigla, responsavel) VALUES
    ('Secretaria de Administração', 'SEMAD', 'Coordenação Geral'),
    ('Secretaria de Saúde', 'SMS', 'Diretoria de Saúde'),
    ('Secretaria de Educação', 'SMEC', 'Coordenação Pedagógica'),
    ('Secretaria de Infraestrutura', 'SEINFRA', 'Diretoria de Obras')
ON CONFLICT (sigla) DO NOTHING;

-- ==============================================================================
-- MÓDULO PONTO / FREQUÊNCIA MENSAL + FERIADOS MUNICIPAIS
-- ==============================================================================

-- 8. FERIADOS MUNICIPAIS / PONTOS FACULTATIVOS (gerenciados por RH Geral / Admin)
CREATE TABLE IF NOT EXISTS public.feriados_municipais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL,
    descricao TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'feriado_municipal' CHECK (tipo IN ('feriado_municipal', 'ponto_facultativo')),
    recorrente_anual BOOLEAN NOT NULL DEFAULT FALSE,
    registrado_por TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 9. FREQUÊNCIA MENSAL CONSOLIDADA POR SERVIDOR (competência YYYY-MM)
CREATE TABLE IF NOT EXISTS public.frequencia_mensal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
    secretaria_id UUID NOT NULL REFERENCES public.secretarias(id) ON DELETE RESTRICT,
    competencia TEXT NOT NULL CHECK (competencia ~ '^\d{4}-\d{2}$'),
    faltas_injustificadas INTEGER NOT NULL DEFAULT 0 CHECK (faltas_injustificadas >= 0),
    faltas_justificadas INTEGER NOT NULL DEFAULT 0 CHECK (faltas_justificadas >= 0),
    abonos INTEGER NOT NULL DEFAULT 0 CHECK (abonos >= 0),
    horas_extras_50 NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (horas_extras_50 >= 0),
    horas_extras_100 NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (horas_extras_100 >= 0),
    adicional_noturno NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (adicional_noturno >= 0),
    plantoes INTEGER NOT NULL DEFAULT 0 CHECK (plantoes >= 0),
    outros_adicionais TEXT,
    observacoes TEXT,
    registrado_por TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (funcionario_id, competencia)
);

-- 10. FECHAMENTO MENSAL DE FREQUÊNCIA POR SECRETARIA
CREATE TABLE IF NOT EXISTS public.frequencia_fechamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secretaria_id UUID NOT NULL REFERENCES public.secretarias(id) ON DELETE CASCADE,
    competencia TEXT NOT NULL CHECK (competencia ~ '^\d{4}-\d{2}$'),
    status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado_secretaria', 'conferido_rh')),
    fechado_por TEXT,
    fechado_em TIMESTAMPTZ,
    conferido_por TEXT,
    conferido_em TIMESTAMPTZ,
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (secretaria_id, competencia)
);

CREATE INDEX IF NOT EXISTS idx_feriados_data ON public.feriados_municipais(data);
CREATE INDEX IF NOT EXISTS idx_freq_mensal_sec_comp ON public.frequencia_mensal(secretaria_id, competencia);
CREATE INDEX IF NOT EXISTS idx_freq_fech_sec_comp ON public.frequencia_fechamentos(secretaria_id, competencia);

ALTER TABLE public.feriados_municipais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frequencia_mensal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frequencia_fechamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feriados_select" ON public.feriados_municipais;
CREATE POLICY "feriados_select" ON public.feriados_municipais FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "feriados_manage" ON public.feriados_municipais;
CREATE POLICY "feriados_manage" ON public.feriados_municipais FOR ALL TO authenticated
    USING ((SELECT public.my_role()) IN ('admin', 'rh_geral'))
    WITH CHECK ((SELECT public.my_role()) IN ('admin', 'rh_geral'));

DROP POLICY IF EXISTS "freq_mensal_scope" ON public.frequencia_mensal;
CREATE POLICY "freq_mensal_scope" ON public.frequencia_mensal FOR ALL TO authenticated
    USING ((SELECT public.can_access_secretaria(secretaria_id)))
    WITH CHECK ((SELECT public.can_access_secretaria(secretaria_id)));

DROP POLICY IF EXISTS "freq_fech_scope" ON public.frequencia_fechamentos;
CREATE POLICY "freq_fech_scope" ON public.frequencia_fechamentos FOR ALL TO authenticated
    USING ((SELECT public.can_access_secretaria(secretaria_id)))
    WITH CHECK ((SELECT public.can_access_secretaria(secretaria_id)));
