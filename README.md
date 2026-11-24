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
1. Crie um projeto gratuito no [Supabase](https://supabase.com) (região recomendada: **South America / São Paulo**).
2. Abra **SQL Editor → New query**, cole o conteúdo integral de `supabase/schema.sql` e clique em **Run**.
   - Isso cria todas as tabelas, políticas RLS por secretaria, bucket privado `atestados` e o trigger automático de perfis.
3. Em **Authentication → Users → Add user → Create new user**, cadastre o e-mail e a senha do primeiro administrador (marque **Auto Confirm User**).
   - O primeiro usuário criado recebe automaticamente o perfil **`admin`**!
4. Em **Settings → API** (ou **Project Settings → API Keys**) no Supabase, copie as 3 chaves e configure nas **Environment Variables** do projeto na Vercel (ou em `.env.local` no computador):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (chave pública / Publishable)
   - `SUPABASE_SERVICE_ROLE_KEY` (chave secreta / Secret — permite criar novos usuários diretamente pelo módulo **Admin & Logs**)
5. Faça **Redeploy** na Vercel (ou reinicie `npm run dev` localmente). A partir daí, o painel de demonstração local some automaticamente e todo o app opera no seu banco Supabase.
