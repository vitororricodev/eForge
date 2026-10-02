# Hotfix do deploy — TanStack Start XSS

Correção de 02/10/2026 sobre o commit `b093e5d` da branch `main` do eForge.

## Causa e correção

O Vercel bloqueou o build porque o `package-lock.json` resolvia `@tanstack/react-start@1.168.52` e `@tanstack/start-server-core@1.169.34`, versões afetadas por CVE-2026-102989 / GHSA-qx66-fv34-fjm8. O aviso aparece antes da compilação da aplicação.

O comunicado oficial exige React Start 1.168.60 ou superior e Start Server Core 1.169.39 ou superior. A correção atualiza o manifest e o lockfile, mantendo o framework e o adaptador existentes.

| Pacote                        | Versão resolvida anterior | Versão corrigida |
| ----------------------------- | ------------------------- | ---------------- |
| `@tanstack/react-start`       | 1.168.52                  | 1.168.60         |
| `@tanstack/start-server-core` | 1.169.34                  | 1.169.39         |
| `@tanstack/react-router`      | 1.170.35                  | 1.170.41         |
| `@tanstack/router-plugin`     | 1.168.37                  | 1.168.42         |

Os três pacotes diretos de Start/Router/plugin usam versões exatas compatíveis. O core corrigido é uma dependência transitiva registrada no lockfile. A instalação não mantém cópias antigas desses pacotes. Não foi adicionado o bypass `DANGEROUSLY_DEPLOY_VULNERABLE_TANSTACK_START_XSS`.

Fontes oficiais consultadas:

- <https://tanstack.com/blog/tanstack-start-security-update-cve-2026-102989>
- <https://github.com/TanStack/router/security/advisories/GHSA-qx66-fv34-fjm8>

## Aplicar ao projeto existente

O pacote `eForge-hotfix-TanStack.zip` contém somente os quatro arquivos deste hotfix: `package.json`, `package-lock.json`, `README-eForge.md` e este documento. Extraia na raiz do mesmo projeto, substituindo os arquivos correspondentes. Aplique os dois arquivos de dependências juntos; um redeploy do commit antigo continuará usando as versões bloqueadas.

Instale e confira:

```bash
npm ci
npm ls @tanstack/react-start @tanstack/start-server-core @tanstack/react-router @tanstack/router-plugin
npm test
npm run typecheck
npm run build
npm run build:mobile
```

Depois envie os arquivos ao Git e faça um novo deploy do commit atualizado:

```bash
git add package.json package-lock.json README-eForge.md HOTFIX-TANSTACK-XSS.md
git commit -m "fix: atualiza TanStack Start e corrige bloqueio de segurança no deploy"
git push origin main
```

O Vercel precisa compilar esse novo commit com o lockfile atualizado. A proteção de segurança permanece habilitada. Se o painel ainda mostrar `b093e5d` ou `1.168.52`, está executando o commit anterior. Caso a instalação de dependências tenha sido personalizada no painel, ela deve respeitar o `package-lock.json` do novo commit.

Este hotfix não exige SQL, nova migration, alteração de permissões nem reimportação do catálogo. A configuração Supabase e as duas migrations da integração ExerciseDB continuam conforme `INTEGRACAO-EXERCISEDB.md`.

## Diretrizes aplicadas

Consultados os `.md` de arquitetura/frontend fornecidos e os documentos do projeto, incluindo README, regras do avatar semanal/mobile e hotfix de fontes. Foram aplicadas as regras de preservar a stack/pastas/componentes existentes, limitar o escopo à causa do erro, manter instalação reproduzível com lockfile e validar TypeScript/testes/builds. Layout, fontes, avatar, treinos e banco permanecem com a implementação existente.

## Validação

- `npm ci`: passou, em uma instalação nova e isolada.
- `npm ls` dos quatro pacotes: passou, com Start 1.168.60 e core 1.169.39, sem cópias antigas ou incompatibilidades de peer dependencies.
- Conferência do `package-lock.json`: todas as entradas de React Start e Start Server Core usam as versões corrigidas.
- `npm test`: passaram as sete suites, incluindo banco local, snapshots, mapa semanal e integração ExerciseDB.
- `npm run typecheck`: passou.
- `npm run build`: passou.
- `npm run build:mobile`: passou; permanece o aviso anterior de tamanho do bundle.
- Playwright da biblioteca e do mapa: passou, incluindo navegação, filtros, montagem/substituição/conclusão do treino, administração e larguras mobile/desktop.
- `git diff --check`: passou.

Os testes usaram dados locais/interceptados; não foi alterado o Supabase remoto nem publicada a aplicação pelo assistente. O novo build no Vercel precisa ser executado depois de aplicar este hotfix ao repositório. Os avisos existentes de dependências/formatação fora deste escopo não foram tratados por esta atualização.
