# Lado Doce — Sistema de E-commerce

> Sistema web de e-commerce desenvolvido para a marca **Lado Doce**, atendendo a uma demanda real de projeto profissional.

---

## 🌐 Acesso ao Sistema

| Ambiente | URL |
|----------|-----|
| 🛍️ Loja | [https://lado-doce.onrender.com](https://lado-doce.onrender.com) |
| 🔐 Painel Admin | [https://lado-doce.onrender.com/static/admin.html](https://lado-doce.onrender.com/static/admin.html) |

> ⚠️ **Aviso:** O sistema está hospedado no plano gratuito do Render, que entra em modo de hibernação após períodos de inatividade. No primeiro acesso pode levar até 50 segundos para carregar. Aguarde e recarregue a página se necessário.

### Credenciais do Painel Administrativo
| Campo | Valor |
|-------|-------|
| Senha | `admin` |

---

## 🎥 Vídeo de Apresentação

📹 [Assistir no YouTube](https://youtube.com/SEU_LINK_AQUI)

---

## 👥 Integrantes do Grupo

| Nome | RA | Função no Projeto |
|------|----|-------------------|
| Breno Pereira de Souza | 3025106713 | Desenvolvedor Backend / Banco de Dados |
| Carlos Daniel Oliveira Azevedo | 3025200264 | Desenvolvedor Backend / Banco de Dados |
| Guilherme Gorri Oliveira | 3025106026 | Integração de Pagamentos (Mercado Pago) |
| Matheus Landim de Jesus | 3025106105 | Recuperação de Senha |
| Monique Pereira Barros Hernandes | 3025106709 | Desenvolvedora Frontend |
| Vitor Ferreira Souza | 3025107104 | Desenvolvedor Frontend |

---

## 📋 Sobre o Projeto

A **Lado Doce** é uma marca de t-shirts criada por Jéssica Gabriela Paz. Jéssica começou no ramo em 2012, mas foi em 2020 que a empresa foi oficialmente aberta, encontrando sua identidade digital e expandindo sua presença para lojistas de todo Brasil.

O projeto surgiu a partir de uma demanda real: a cunhada de um dos integrantes do grupo precisava digitalizar as vendas da marca, que até então dependia de canais informais como WhatsApp. Desenvolvemos um sistema de e-commerce completo, do cadastro de produtos ao pagamento, entregando uma solução funcional publicada em produção.

### Tipo de Projeto
✅ Projeto Profissional

---

## ✨ Funcionalidades

### 🛍️ Loja (Cliente)
- Catálogo de produtos com seção de lançamentos semanais e catálogo geral
- Sistema de sacola de compras com resumo lateral
- Cadastro e login de usuários (e-mail com código de verificação ou senha)
- Recuperação de senha por e-mail (via Brevo)
- Área do usuário para atualizar dados cadastrais e endereço
- Checkout com cálculo de frete automático por UF (tabela fixa baseada nos Correios + ViaCEP)
- Pagamento via Mercado Pago (cartão de crédito e boleto bancário)
- Polling automático de status de pagamento (boleto)
- Acompanhamento de pedidos com histórico detalhado
- Páginas de retorno: pagamento aprovado, pagamento recusado, aguardando boleto

### 🔐 Painel Administrativo
- Login protegido por senha via header `x-admin-key`
- Gerenciamento de produtos: adicionar, editar, ativar/inativar e remover
- Controle de estoque por tamanho (PP, P, M, G, GG, G1, G2)
- Upload de imagem principal e imagem de hover via Supabase Storage
- Filtro de produtos por status, categoria e busca por nome
- Gerenciamento de pedidos com filtro por status, data e busca
- Limpeza manual e automática de pedidos expirados (com devolução de estoque)
- Gerenciamento de clientes com bloqueio e histórico de gastos
- Dashboard com cards de vendas, pedidos, clientes e produtos ativos
- Filtro de período no dashboard (hoje, 7, 30, 60 e 90 dias)
- Alertas de estoque baixo com painel de notificações (sininho)
- Exportação de dados (produtos, pedidos e clientes) em JSON
- Configurações da loja (identidade, contato, preferências)

---

## 🛠️ Tecnologias Utilizadas

### Backend
- **Python 3** + **FastAPI**
- **SQLAlchemy** (ORM)
- **Supabase** (banco de dados PostgreSQL em nuvem)
- **Mercado Pago API** (pagamentos — cartão e boleto)
- **Brevo API/GMAIL** (envio de e-mails transacionais)
- **ViaCEP** (consulta e preenchimento automático de endereço)
- **bcrypt** (hash de senhas)

### Frontend
- **HTML5**, **CSS3**, **JavaScript** (vanilla)
- **GSAP + ScrollTrigger** (animações e página "Sobre")

### Infraestrutura
- **Render** (hospedagem cloud — backend + frontend estático servido pelo FastAPI)
- **Supabase Storage** (armazenamento de imagens dos produtos)
- **GitHub** (versionamento)

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- Python 3.10+
- Git

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/breno-psouza/LADO-DOCE.git
cd LADO-DOCE

# 2. Instale as dependências
pip install -r requirements.txt

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas chaves

# 4. Rode o servidor
uvicorn main:app --reload --port 8000
```

Acesse em: `http://localhost:8000`

### Variáveis de Ambiente (.env)
Veja o arquivo `.env.example` no repositório para saber quais variáveis configurar (chaves do Mercado Pago, Brevo, Supabase e senha do admin).

---

## 📁 Estrutura do Projeto

```
LADO-DOCE/
LADO-DOCE/
├── main.py                       ← API principal (FastAPI)
├── models.py                     ← Modelos do banco de dados
├── schemas.py                    ← Schemas de validação
├── database.py                   ← Configuração do banco
├── requirements.txt              ← Dependências Python
├── .gitignore                    ← Arquivos ignorados pelo Git
├── .env.example                  ← Exemplo de variáveis de ambiente
└── static/                       ← Frontend
    ├── imagens/                  ← Assets e imagens do site
    ├── index.html                ← Página inicial / loja
    ├── admin.html                ← Painel administrativo
    ├── admin.css                 ← Estilos do painel admin
    ├── admin.js                  ← JS do painel admin
    ├── checkout.html             ← Página de checkout
    ├── checkout.js               ← JS do checkout
    ├── conta.html                ← Área do usuário
    ├── pedidos.html              ← Meus pedidos
    ├── sobre.html                ← Página sobre a marca
    ├── sobre.css                 ← Estilos da página sobre
    ├── sobre.js                  ← JS da página sobre
    ├── aguardando-pagamento.html ← Retorno boleto
    ├── compracerta.html          ← Retorno pagamento aprovado
    ├── compraerrada.html         ← Retorno pagamento recusado
    ├── script.js                 ← JS principal da loja
    └── style.css                 ← Estilos globais
```

---

## ☁️ Hospedagem

O projeto está hospedado no **Render** (plano gratuito), com deploy automático a cada push na branch principal do GitHub. O frontend é servido diretamente pelo FastAPI como arquivos estáticos na rota `/static`.

---

*Projeto desenvolvido para a disciplina de Projeto em Desenvolvimento de Sistemas — Uninove 2026*
