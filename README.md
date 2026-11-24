# RHBOX — Gestão de Servidores

> *Gestão de servidores com organização, valorização e transparência.*

Aplicação web enxuta e instantânea desenvolvida com **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS** e **Supabase** (compatível com o plano gratuito).

## Módulos Incluídos
- **Dashboard** — indicadores em tempo real, distribuição por secretaria e atalhos rápidos
- **Funcionários** — cadastro, vínculos, lotações e ficha individual resumida
- **Secretarias** — organização de pastas e contagem automática de servidores
- **Atestados Médicos** — lançamento direto, cálculo automático de dias, anexo e aprovação/rejeição
- **Férias, Licenças e Afastamentos** — controle unificado por categoria e status
- **Ocorrências Funcionais** — registro de elogios, advertências, capacitações, transferências e portarias
- **Relatórios (PDF e CSV)** — exportação imediata pronta para Excel e impressão
- **Admin & Logs** — gestão dos 3 perfis (`admin`, `rh_geral`, `rh_secretaria`) e logs de atividade/suporte

## Como Rodar Localmente (Modo Interativo)
```bash
npm install
npm run dev
```
Acesse `http://localhost:3000` (sem `.env.local`, o sistema funciona automaticamente em modo local interativo com dados salvos em `.data/rhbox-local.json`, usando os 3 perfis de demonstração).

## Como Conectar ao Supabase (Plano Gratuito)
1. Crie um projeto no [Supabase](https://supabase.com).
2. Abra o **SQL Editor**, cole o conteúdo integral de `supabase/schema.sql` e clique em **Run**.
3. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Reinicie a aplicação (ou configure as mesmas variáveis na Vercel para publicação online).
