// ================= CONFIGURAÇÕES GERAIS =================
const API_URL = "https://lado-doce.onrender.com";

function apiFetch(url, options = {}) {
    const headers = {
        "ngrok-skip-browser-warning": "true",
        ...(options.headers || {})
    };
    return fetch(url, { ...options, headers });
}

const CHECKOUT_URL = "checkout.html";

// ================= CHAVES DO LOCALSTORAGE =================
const STORAGE_KEYS = {
    user: "ladoDoceUser",
    cart: "ladoDoceCarrinho"
};

// ================= ESTADO GLOBAL DA APLICAÇÃO =================
let auth = {
    usuario: JSON.parse(localStorage.getItem(STORAGE_KEYS.user)) || null
};

let appState = {
    checkoutPendente: false
};

let carrinho = JSON.parse(localStorage.getItem(STORAGE_KEYS.cart)) || [];

carrinho = carrinho.map(item => {
    const { imagem, foto, fotoHover, ...itemSemImagem } = item;
    return itemSemImagem;
});

// ================= FUNÇÕES AUXILIARES =================
function usuarioEstaLogado() {
    return !!auth.usuario;
}

function salvarUsuario(usuario) {
    auth.usuario = usuario;
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(usuario));
}

function limparUsuario() {
    auth.usuario = null;
    localStorage.removeItem(STORAGE_KEYS.user);
}

function salvarCarrinho() {
    try {
        const carrinhoLeve = carrinho.map(item => {
            const { imagem, foto, fotoHover, ...itemSemImagem } = item;
            return itemSemImagem;
        });
        carrinho = carrinhoLeve;
        localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(carrinhoLeve));
    } catch (erro) {
        console.error("Erro ao salvar carrinho:", erro);
        alert("Sua sacola estava com dados muito pesados. O carrinho foi limpo para evitar travamentos.");
        carrinho = [];
        localStorage.removeItem(STORAGE_KEYS.cart);
    }
}

function formatarMoeda(valor) {
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function converterPrecoParaNumero(preco) {
    return Number(
        String(preco)
            .replace("R$", "")
            .replace(/\./g, "")
            .replace(",", ".")
            .trim()
    ) || 0;
}

// ================= CARRINHO — SINCRONIZAÇÃO COM BACKEND =================

async function sincronizarCarrinhoAoLogar(usuario) {
    if (carrinho.length === 0) {
        await carregarCarrinhoDoBackend(usuario);
        return;
    }

    for (const item of carrinho) {
        if (!item.estoque_id) continue;
        try {
            await apiFetch(`${API_URL}/carrinho/adicionar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    usuario_id: usuario.id,
                    estoque_id: item.estoque_id,
                    quantidade: item.quantidade
                })
            });
        } catch (e) {
            console.error("Erro ao sincronizar item:", e);
        }
    }

    await carregarCarrinhoDoBackend(usuario);
}

// Carrega o carrinho do backend e atualiza o estado local
async function carregarCarrinhoDoBackend(usuario) {
    try {
        const res = await apiFetch(`${API_URL}/carrinho/${usuario.id}`);
        if (!res.ok) return;

        const data = await res.json();

        carrinho = (data.itens || []).map(item => ({
            estoque_disponivel: item.estoque_disponivel,
            id: String(item.produto_id),
            estoque_id: item.estoque_id,
            nome: item.produto,
            preco: item.preco,
            imagem_url: item.imagem_url || "",
            tamanho: item.tamanho,
            cor: item.cor || "",
            quantidade: item.quantidade
        }));

        salvarCarrinho();
        atualizarSacola();
    } catch (e) {
        console.error("Erro ao carregar carrinho do backend:", e);
    }
}

// Adiciona item no backend quando o usuário já está logado
async function adicionarItemNoBackend(estoque_id, quantidade = 1) {
    if (!usuarioEstaLogado() || !estoque_id) return;
    try {
        await apiFetch(`${API_URL}/carrinho/adicionar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                usuario_id: auth.usuario.id,
                estoque_id,
                quantidade
            })
        });
    } catch (e) {
        console.error("Erro ao adicionar no backend:", e);
    }
}

// Remove item do backend
async function removerItemDoBackend(estoque_id) {
    if (!usuarioEstaLogado() || !estoque_id) return;
    try {
        await apiFetch(`${API_URL}/carrinho/remover`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                usuario_id: auth.usuario.id,
                estoque_id
            })
        });
    } catch (e) {
        console.error("Erro ao remover do backend:", e);
    }
}

// Atualiza quantidade no backend — retorna { ok, erro } para o chamador tratar
async function atualizarQuantidadeNoBackend(estoque_id, quantidade) {
    if (!usuarioEstaLogado() || !estoque_id) return { ok: true };
    try {
        const res = await apiFetch(`${API_URL}/carrinho/atualizar`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                usuario_id: auth.usuario.id,
                estoque_id,
                quantidade
            })
        });
        const data = await res.json();
        if (data.erro) return { ok: false, erro: data.erro };
        return { ok: true };
    } catch (e) {
        console.error("Erro ao atualizar quantidade no backend:", e);
        return { ok: false, erro: "Erro de conexão" };
    }
}

// ================= MENU PRINCIPAL =================
const btnMenu = document.querySelector(".menuBtn");
const menu = document.querySelector(".menu");
const layers = document.querySelectorAll(".menuLayer");
const links = document.querySelectorAll(".menuContent a");

let menuAberto = false;

if (btnMenu && menu) {
    btnMenu.addEventListener("click", () => {
        if (!menuAberto) {
            gsap.to(menu, { opacity: 1, duration: 0.2 });
            menu.style.pointerEvents = "auto";

            gsap.to(layers, {
                y: 0,
                duration: 0.5,
                stagger: 0.08,
                ease: "power3.out"
            });

            gsap.to(links, {
                opacity: 1,
                y: 0,
                delay: 0.35,
                stagger: 0.1
            });
        } else {
            gsap.to(layers, {
                y: "-100%",
                duration: 0.5,
                stagger: 0.08,
                ease: "power3.in"
            });

            gsap.set(links, { opacity: 0, y: 20 });
            gsap.to(menu, { opacity: 0, delay: 0.4 });
            menu.style.pointerEvents = "none";
        }

        menuAberto = !menuAberto;
    });
}

// ================= TEXTO ANIMADO DA HOME =================
const textosAnimados = document.querySelectorAll(".split-text");

textosAnimados.forEach(texto => {
    const letras = texto.textContent.split("");
    texto.innerHTML = "";

    letras.forEach(letra => {
        const span = document.createElement("span");
        span.textContent = letra === " " ? "\u00A0" : letra;
        texto.appendChild(span);
    });

    gsap.to(texto.querySelectorAll("span"), {
        opacity: 1,
        y: 0,
        stagger: 0.06,
        duration: 0.8,
        ease: "power3.out"
    });
});

// ================= TABS DA HERO =================
const tabs = document.querySelectorAll(".tabItem");
const cursor = document.querySelector(".tabCursor");
const containerTabs = document.querySelector(".tabsPI");

if (containerTabs && cursor) {
    tabs.forEach(tab => {
        tab.addEventListener("mouseenter", () => {
            const rect = tab.getBoundingClientRect();
            const parent = containerTabs.getBoundingClientRect();

            cursor.style.width = rect.width + "px";
            cursor.style.left = rect.left - parent.left + "px";
            cursor.style.opacity = "1";
        });
    });

    containerTabs.addEventListener("mouseleave", () => {
        cursor.style.opacity = "0";
    });
}

// ================= REFERÊNCIAS DO MODAL =================
const btnLogin = document.querySelector(".botaoLogin");
const overlay = document.getElementById("overlay");
const modal = document.getElementById("modal");

const telaEscolha = document.getElementById("telaEscolha");
const telaEmail = document.getElementById("telaEmail");
const telaCodigo = document.getElementById("telaCodigo");
const telaSenha = document.getElementById("telaSenha");
const telaCadastro = document.getElementById("telaCadastro");
const telaSucesso = document.getElementById("telaSucesso");

const emailInput = document.getElementById("emailInput");
const infoEmail = document.querySelector(".infoEmail");
const codigoInput = document.getElementById("codigoInput");

const emailSenhaInput = document.getElementById("emailSenhaInput");
const senhaInput = document.getElementById("senhaInput");

const nomeCadastroInput = document.getElementById("nomeCadastroInput");
const emailCadastroInput = document.getElementById("emailCadastroInput");
const senhaCadastroInput = document.getElementById("senhaCadastroInput");
const confirmarSenhaCadastroInput = document.getElementById("confirmarSenhaCadastroInput");
const telefoneCadastroInput = document.getElementById("telefoneCadastroInput");
const cpfCadastroInput = document.getElementById("cpfCadastroInput");
const dataNascimentoCadastroInput = document.getElementById("dataNascimentoCadastroInput");

const tituloSucesso = document.getElementById("tituloSucesso");
const textoSucesso = document.getElementById("textoSucesso");

// ================= REFERÊNCIAS DO MENU DO USUÁRIO =================
const userMenu = document.getElementById("userMenu");
const btnMinhaConta = document.getElementById("btnMinhaConta");
const btnPedidos = document.getElementById("btnPedidos");
const btnLogout = document.getElementById("btnLogout");
const areaUsuario = document.querySelector(".areaUsuario");

// ================= TROCA DE TELAS DO MODAL =================
function trocarTela(novaTela) {
    if (!novaTela) return;

    const telaAtual = document.querySelector(".tela.active");

    if (!telaAtual) {
        novaTela.classList.add("active");
        return;
    }

    if (telaAtual === novaTela) return;

    gsap.to(telaAtual, {
        opacity: 0,
        y: -20,
        duration: 0.25,
        onComplete: () => {
            telaAtual.classList.remove("active");
            novaTela.classList.add("active");

            gsap.fromTo(
                novaTela,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.25 }
            );
        }
    });
}

// ================= ABRIR E FECHAR MODAL =================
function abrirModalLogin() {
    if (!overlay || !modal) return;
    overlay.classList.add("active");
    modal.classList.add("active");
    trocarTela(telaEscolha);
}

function fecharModalLogin() {
    if (!overlay || !modal) return;
    overlay.classList.remove("active");
    modal.classList.remove("active");
}

// ================= TELA DE SUCESSO =================
function mostrarTelaSucesso(titulo, texto) {
    if (!telaSucesso || !tituloSucesso || !textoSucesso) {
        concluirPosLogin();
        return;
    }

    tituloSucesso.textContent = titulo;
    textoSucesso.textContent = texto;
    trocarTela(telaSucesso);

    setTimeout(() => {
        concluirPosLogin();
    }, 1300);
}

// ================= FINALIZAÇÃO APÓS LOGIN =================
async function concluirPosLogin() {
    fecharModalLogin();
    atualizarInterfaceUsuario();

    // Sincroniza carrinho local com o banco ao logar
    if (auth.usuario) {
        await sincronizarCarrinhoAoLogar(auth.usuario);
    }

    if (appState.checkoutPendente) {
        appState.checkoutPendente = false;
        window.location.href = CHECKOUT_URL;
    }
}

function finalizarLogin(usuario, mensagem = {}) {
    salvarUsuario(usuario);

    mostrarTelaSucesso(
        mensagem.titulo || "Seu lado doce voltou ✨",
        mensagem.texto || "Login realizado com sucesso."
    );
}

// ================= ATUALIZAR INTERFACE DO USUÁRIO =================
function atualizarInterfaceUsuario() {
    if (!btnLogin) return;

    const img = btnLogin.querySelector("img");

    if (usuarioEstaLogado()) {
        btnLogin.setAttribute("title", `Olá, ${auth.usuario.nome}`);
        if (img) img.alt = `Usuário logado: ${auth.usuario.nome}`;
    } else {
        btnLogin.setAttribute("title", "Área do usuário");
        if (img) img.alt = "Área do usuário";
    }

    if (userMenu && !usuarioEstaLogado()) {
        userMenu.classList.remove("active");
    }
}

// ================= BOTÃO DO USUÁRIO =================
if (btnLogin) {
    btnLogin.addEventListener("click", (e) => {
        e.stopPropagation();

        if (!usuarioEstaLogado()) {
            abrirModalLogin();
            return;
        }

        if (userMenu) {
            userMenu.classList.toggle("active");
        }
    });
}

// ================= MENU DO USUÁRIO =================
if (btnMinhaConta) {
    btnMinhaConta.addEventListener("click", () => {
        window.location.href = "conta.html";
    });
}

if (btnPedidos) {
    btnPedidos.addEventListener("click", () => {
        window.location.href = "pedidos.html";
    });
}

if (btnLogout) {
    btnLogout.addEventListener("click", () => {
        // Limpa carrinho local ao sair para não misturar com outro usuário
        carrinho = [];
        localStorage.removeItem(STORAGE_KEYS.cart);
        limparUsuario();
        if (userMenu) userMenu.classList.remove("active");
        atualizarInterfaceUsuario();
        atualizarSacola();
        window.location.href = "index.html";
    });
}

document.addEventListener("click", (e) => {
    if (!userMenu || !userMenu.classList.contains("active")) return;
    if (areaUsuario && !areaUsuario.contains(e.target)) {
        userMenu.classList.remove("active");
    }
});

// ================= FECHAR MODAL =================
const btnFechar = document.querySelector(".fecharModal");
if (btnFechar) {
    btnFechar.addEventListener("click", fecharModalLogin);
}

if (overlay) {
    overlay.addEventListener("click", fecharModalLogin);
}

// ================= NAVEGAÇÃO ENTRE TELAS =================
const irEmail = document.getElementById("irEmail");
if (irEmail) {
    irEmail.onclick = () => trocarTela(telaEmail);
}

const irSenha = document.getElementById("irSenha");
if (irSenha) {
    irSenha.onclick = () => trocarTela(telaSenha);
}

// ================= LOGIN POR E-MAIL + CÓDIGO =================
const enviarEmail = document.getElementById("enviarEmail");
if (enviarEmail) {
    enviarEmail.onclick = async () => {
        const email = emailInput?.value?.trim();

        if (!email) {
            alert("Digite seu e-mail.");
            return;
        }

        enviarEmail.disabled = true;
        enviarEmail.textContent = "Enviando...";

        try {
            const res = await apiFetch(`${API_URL}/login-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });

            const data = await res.json();

            if (data.erro) {
                alert(data.erro);
                return;
            }

            if (infoEmail) {
                infoEmail.textContent = `Código enviado para: ${email}`;
            }

            trocarTela(telaCodigo);
        } catch (e) {
            alert("Erro de conexão. Verifique se o servidor está rodando.");
            console.error(e);
        } finally {
            enviarEmail.disabled = false;
            enviarEmail.textContent = "Enviar código";
        }
    };
}

const verificarCodigo = document.getElementById("verificarCodigo");
if (verificarCodigo) {
    verificarCodigo.onclick = async () => {
        const email = emailInput?.value?.trim();
        const codigo = codigoInput?.value?.trim();

        if (!email || !codigo) {
            alert("Preencha o e-mail e o código.");
            return;
        }

        verificarCodigo.disabled = true;
        verificarCodigo.textContent = "Verificando...";

        try {
            const res = await apiFetch(`${API_URL}/verificar-codigo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, codigo })
            });

            const data = await res.json();

            if (data.erro) {
                alert(data.erro);
                return;
            }

            finalizarLogin(data.usuario, {
                titulo: "Olá, bem vindo(a)!",
                texto: "Login com código realizado com sucesso."
            });
        } catch (e) {
            alert("Erro de conexão. Verifique se o servidor está rodando.");
            console.error(e);
        } finally {
            verificarCodigo.disabled = false;
            verificarCodigo.textContent = "Verificar código";
        }
    };
}

// ================= LOGIN POR E-MAIL + SENHA =================
const entrarSenha = document.getElementById("entrarSenha");
if (entrarSenha) {
    entrarSenha.onclick = async () => {
        const email = emailSenhaInput?.value?.trim();
        const senha = senhaInput?.value?.trim();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!email || !emailRegex.test(email)) {
            alert("Insira um e-mail válido.");
            return;
        }
        if (!senha || senha.length < 6) {
            alert("Insira uma senha mais forte (mínimo 6 caracteres).");
            return;
        }

        entrarSenha.disabled = true;
        entrarSenha.textContent = "Entrando...";

        try {
            const res = await apiFetch(`${API_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, senha })
            });

            const data = await res.json();

            if (data.erro) {
                alert(data.erro);
                return;
            }

            finalizarLogin(data.usuario, {
                titulo: "Olá, bem vindo(a)!",
                texto: "Login realizado com sucesso. Sua sacola está te esperando."
            });
        } catch (e) {
            alert("Erro de conexão. Verifique se o servidor está rodando.");
            console.error(e);
        } finally {
            entrarSenha.disabled = false;
            entrarSenha.textContent = "Entrar";
        }
    };
}

// ================= IR PARA CADASTRO =================
const linkCriarConta = document.querySelector(".linkCriarConta");
if (linkCriarConta) {
    linkCriarConta.addEventListener("click", (e) => {
        e.preventDefault();
        trocarTela(telaCadastro);
    });
}

const telaEsqueciSenha   = document.getElementById("telaEsqueciSenha");
const telaRedefinirSenha = document.getElementById("telaRedefinirSenha");
 
const emailRecuperacaoInput    = document.getElementById("emailRecuperacaoInput");
const codigoRecuperacaoInput   = document.getElementById("codigoRecuperacaoInput");
const novaSenhaInput           = document.getElementById("novaSenhaInput");
const confirmarNovaSenhaInput  = document.getElementById("confirmarNovaSenhaInput");
const infoEmailRecuperacao     = document.querySelector(".infoEmailRecuperacao");
 
// -- Botão "Esqueci minha senha" na telaSenha --
const linkSenha = document.querySelector(".linkSenha");
if (linkSenha) {
    linkSenha.addEventListener("click", (e) => {
        e.preventDefault();
        // Pré-preenche o e-mail se o usuário já digitou na tela de senha
        if (emailSenhaInput?.value && emailRecuperacaoInput) {
            emailRecuperacaoInput.value = emailSenhaInput.value;
        }
        trocarTela(telaEsqueciSenha);
    });
}
 
// -- PASSO 1: Solicitar código de recuperação --
const enviarCodigoRecuperacao = document.getElementById("enviarCodigoRecuperacao");
if (enviarCodigoRecuperacao) {
    enviarCodigoRecuperacao.onclick = async () => {
        const email = emailRecuperacaoInput?.value?.trim();
 
        if (!email) {
            alert("Digite seu e-mail.");
            return;
        }
 
        enviarCodigoRecuperacao.disabled = true;
        enviarCodigoRecuperacao.textContent = "Enviando...";
 
        try {
            const res = await apiFetch(`${API_URL}/esqueci-senha`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
 
            await res.json();
 
            if (infoEmailRecuperacao) {
                infoEmailRecuperacao.textContent = `Código enviado para: ${email}`;
            }
 
            // Limpa campos da tela seguinte ao trocar
            if (codigoRecuperacaoInput)  codigoRecuperacaoInput.value  = "";
            if (novaSenhaInput)          novaSenhaInput.value          = "";
            if (confirmarNovaSenhaInput) confirmarNovaSenhaInput.value = "";
 
            trocarTela(telaRedefinirSenha);
        } catch (e) {
            alert("Erro de conexão. Verifique se o servidor está rodando.");
            console.error(e);
        } finally {
            enviarCodigoRecuperacao.disabled = false;
            enviarCodigoRecuperacao.textContent = "Enviar código";
        }
    };
}
 
const confirmarRedefinicao = document.getElementById("confirmarRedefinicao");
if (confirmarRedefinicao) {
    confirmarRedefinicao.onclick = async () => {
        const email          = emailRecuperacaoInput?.value?.trim();
        const codigo         = codigoRecuperacaoInput?.value?.trim();
        const novaSenha      = novaSenhaInput?.value?.trim();
        const confirmarSenha = confirmarNovaSenhaInput?.value?.trim();
 
        if (!codigo || !novaSenha || !confirmarSenha) {
            alert("Preencha todos os campos.");
            return;
        }
 
        if (novaSenha !== confirmarSenha) {
            alert("As senhas não coincidem.");
            return;
        }
 
        if (novaSenha.length < 6) {
            alert("A senha deve ter pelo menos 6 caracteres.");
            return;
        }
 
        confirmarRedefinicao.disabled = true;
        confirmarRedefinicao.textContent = "Salvando...";
 
        try {
            const res = await apiFetch(`${API_URL}/redefinir-senha`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    codigo,
                    nova_senha:      novaSenha,
                    confirmar_senha: confirmarSenha
                })
            });
 
            const data = await res.json();
 
            if (data.erro) {
                alert(data.erro);
                return;
            }
 
            tituloSucesso.textContent = "Senha atualizada!";
            textoSucesso.textContent  = "Agora é só fazer login com sua nova senha.";
            trocarTela(telaSucesso);
 
            setTimeout(() => {
                if (emailSenhaInput) emailSenhaInput.value = email;
                if (senhaInput) senhaInput.value = "";
                trocarTela(telaSenha);
            }, 1500);
 
        } catch (e) {
            alert("Erro de conexão. Verifique se o servidor está rodando.");
            console.error(e);
        } finally {
            confirmarRedefinicao.disabled = false;
            confirmarRedefinicao.textContent = "Salvar senha";
        }
    };
}
 
// ─────────────────────────────────────────────────────────
// ATUALIZAÇÃO DO BOTÃO VOLTAR — substitua o bloco existente
// "// ================= BOTÕES VOLTAR DO MODAL ============"
// pelo trecho abaixo (adiciona o tratamento das novas telas):
// ─────────────────────────────────────────────────────────
document.querySelectorAll(".btnVoltar").forEach(btn => {
    btn.addEventListener("click", () => {
        const telaAtual = document.querySelector(".tela.active");
        if (!telaAtual) return;
 
        if (telaAtual.id === "telaCodigo") {
            trocarTela(telaEmail);
        } else if (telaAtual.id === "telaEmail" || telaAtual.id === "telaSenha") {
            trocarTela(telaEscolha);
        } else if (telaAtual.id === "telaCadastro") {
            trocarTela(telaSenha || telaEscolha);
        } else if (telaAtual.id === "telaEsqueciSenha") {
            trocarTela(telaSenha);           // volta para login com senha
        } else if (telaAtual.id === "telaRedefinirSenha") {
            trocarTela(telaEsqueciSenha);    // volta para digitar e-mail
        }
    });
});

// ================= CADASTRO =================
const cadastrarConta = document.getElementById("cadastrarConta");
if (cadastrarConta) {
    cadastrarConta.onclick = async () => {
        const nome = nomeCadastroInput?.value?.trim();
        const email = emailCadastroInput?.value?.trim();
        const senha = senhaCadastroInput?.value?.trim();
        const confirmarSenha = confirmarSenhaCadastroInput?.value?.trim();
        const telefone = telefoneCadastroInput?.value?.trim();
        const cpf = cpfCadastroInput?.value?.trim();
        const dataNascimento = dataNascimentoCadastroInput?.value?.trim();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!emailRegex.test(email)) {
            alert("Insira um e-mail válido.");
            return;
        }

        if (senha.length < 4) {
           alert("Insira uma senha mais forte (mínimo 4 caracteres).");
           return;
        }
         
        if (!nome || !email || !senha || !confirmarSenha || !telefone || !cpf || !dataNascimento) {
            alert("Preencha todos os campos do cadastro.");
            return;
        }

        if (senha !== confirmarSenha) {
            alert("As senhas não coincidem.");
            return;
        }

        cadastrarConta.disabled = true;
        cadastrarConta.textContent = "Cadastrando...";

        try {
            const res = await apiFetch(`${API_URL}/cadastrar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nome,
                    email,
                    senha,
                    confirmar_senha: confirmarSenha,
                    telefone,
                    cpf,
                    data_nascimento: dataNascimento,
                    cep: "00000000",
                    rua: "A preencher",
                    uf: "SP",
                    numero: "S/N",
                    complemento: ""
                })
            });

            const data = await res.json();

            if (data.erro) {
                alert(data.erro);
                return;
            }

            finalizarLogin(data.usuario, {
                titulo: "Conta criada com sucesso.",
                texto: "Agora você já pode finalizar seu pedido."
            });
        } catch (e) {
            alert("Erro de conexão. Verifique se o servidor está rodando.");
            console.error(e);
        } finally {
            cadastrarConta.disabled = false;
            cadastrarConta.textContent = "Cadastrar";
        }
    };
}

// ================= BOTÕES VOLTAR DO MODAL =================
document.querySelectorAll(".btnVoltar").forEach(btn => {
    btn.addEventListener("click", () => {
        const telaAtual = document.querySelector(".tela.active");
        if (!telaAtual) return;

        if (telaAtual.id === "telaCodigo") {
            trocarTela(telaEmail);
        } else if (telaAtual.id === "telaEmail" || telaAtual.id === "telaSenha") {
            trocarTela(telaEscolha);
        } else if (telaAtual.id === "telaCadastro") {
            trocarTela(telaSenha || telaEscolha);
        }
    });
});

// ================= REFERÊNCIAS DA SACOLA =================
const abrirSacolaBtn = document.getElementById("abrirSacola");
const fecharSacolaBtn = document.getElementById("fecharSacola");
const overlaySacola = document.getElementById("overlaySacola");
const sacolaLateral = document.getElementById("sacolaLateral");

const sacolaVazia = document.getElementById("sacolaVazia");
const sacolaComItens = document.getElementById("sacolaComItens");
const listaItensSacola = document.getElementById("listaItensSacola");
const subtotalSacola = document.getElementById("subtotalSacola");
const contadorSacola = document.getElementById("contadorSacola");
const btnFinalizar = document.querySelector(".btnFinalizar");

// ================= ABRIR E FECHAR SACOLA =================
function abrirPainelSacola() {
    if (!sacolaLateral || !overlaySacola) return;
    sacolaLateral.classList.add("active");
    overlaySacola.classList.add("active");
}

function fecharPainelSacola() {
    if (!sacolaLateral || !overlaySacola) return;
    sacolaLateral.classList.remove("active");
    overlaySacola.classList.remove("active");
}

if (abrirSacolaBtn) {
    abrirSacolaBtn.addEventListener("click", abrirPainelSacola);
}

if (fecharSacolaBtn) {
    fecharSacolaBtn.addEventListener("click", fecharPainelSacola);
}

if (overlaySacola) {
    overlaySacola.addEventListener("click", fecharPainelSacola);
}

// ================= ATUALIZAR SACOLA =================
function atualizarSacola() {
    if (!listaItensSacola || !sacolaVazia || !sacolaComItens || !contadorSacola || !subtotalSacola) return;

    listaItensSacola.innerHTML = "";

    if (carrinho.length === 0) {
        sacolaVazia.style.display = "flex";
        sacolaComItens.classList.remove("active");
        contadorSacola.textContent = "0 produtos";
        subtotalSacola.textContent = "R$ 0,00";
        salvarCarrinho();
        return;
    }

    sacolaVazia.style.display = "none";
    sacolaComItens.classList.add("active");

    let subtotal = 0;
    let totalItens = 0;

    carrinho.forEach((item, index) => {
        const precoNumero = converterPrecoParaNumero(item.preco);

        subtotal += precoNumero * item.quantidade;
        totalItens += item.quantidade;

        const div = document.createElement("div");
        div.classList.add("itemSacola");

        const imagemItem = item.imagem_url || "imagens/Monograma.png";

        div.innerHTML = `
            <img src="${imagemItem}" alt="${item.nome}">
            <div class="infoItemSacola">
                <h3>${item.nome}</h3>
                <p>${typeof item.preco === "number" ? formatarMoeda(item.preco) : item.preco}</p>
                <span>Tamanho: ${item.tamanho}${item.cor ? " · " + item.cor : ""}</span>

                <div class="controleQuantidade">
                    <button class="diminuirQtd" data-index="${index}" type="button">−</button>
                    <span>${item.quantidade}</span>
                    <button class="aumentarQtd" data-index="${index}" type="button">+</button>
                </div>
            </div>
            <button class="removerItem" data-index="${index}" type="button">🗑</button>
        `;

        listaItensSacola.appendChild(div);
    });

    contadorSacola.textContent = totalItens === 1 ? "1 produto" : `${totalItens} produtos`;
    subtotalSacola.textContent = formatarMoeda(subtotal);

    document.querySelectorAll(".removerItem").forEach(btn => {
        btn.addEventListener("click", async () => {
            const index = Number(btn.dataset.index);
            const item = carrinho[index];
            await removerItemDoBackend(item.estoque_id);
            carrinho.splice(index, 1);
            salvarCarrinho();
            atualizarSacola();
        });
    });

    document.querySelectorAll(".aumentarQtd").forEach(btn => {
        btn.addEventListener("click", async () => {
            const index = Number(btn.dataset.index);
            const item = carrinho[index];
            const novaQtd = item.quantidade + 1;
            const resultado = await atualizarQuantidadeNoBackend(item.estoque_id, novaQtd);
            if (!resultado.ok) {
                alert(resultado.erro || "Estoque insuficiente.");
                return;
            }
            item.quantidade = novaQtd;
            salvarCarrinho();
            atualizarSacola();
        });
    });

    document.querySelectorAll(".diminuirQtd").forEach(btn => {
        btn.addEventListener("click", async () => {
            const index = Number(btn.dataset.index);
            if (carrinho[index].quantidade > 1) {
                carrinho[index].quantidade -= 1;
                await atualizarQuantidadeNoBackend(carrinho[index].estoque_id, carrinho[index].quantidade);
            } else {
                await removerItemDoBackend(carrinho[index].estoque_id);
                carrinho.splice(index, 1);
            }
            salvarCarrinho();
            atualizarSacola();
        });
    });

    salvarCarrinho();
}

// ================= PRODUTOS DA API =================
function escaparHTML(texto) {
    return String(texto || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function criarBotoesTamanho(variacoes = []) {
    const tamanhos = [...new Set(variacoes.map(v => v.tamanho))];
    if (tamanhos.length === 0) return ["P", "M", "G", "GG"].map(t =>
        `<button class="btn-tamanho" type="button">${t}</button>`
    ).join("");

    return tamanhos.map(tamanho => {
        const temEstoque = variacoes.some(v => v.tamanho === tamanho && v.quantidade > 0);
        return `<button class="btn-tamanho${temEstoque ? "" : " sem-estoque"}" type="button" data-tamanho="${escaparHTML(tamanho)}">${escaparHTML(tamanho)}</button>`;
    }).join("");
}

function criarCardProdutoAPI(produto) {
    const nome = escaparHTML(produto.nome);
    const nomeCurto = produto.nome && produto.nome.length > 22 ? escaparHTML(produto.nome.slice(0, 22) + "...") : nome;
    const preco = formatarMoeda(produto.preco);
    const foto = produto.imagem_url || "imagens/Monograma.png";
    const fotoHover = produto.imagem_hover_url || foto;
    const esgotado = produto.esgotado;

    return `
        <div class="produto produto-api ${esgotado ? "produto-esgotado" : ""}"
             data-id="${produto.id}"
             data-nome="${nome}"
             data-preco="${produto.preco}"
             data-imagem="${foto}"
             data-esgotado="${esgotado}"
             data-estoque='${JSON.stringify(produto.estoque)}'>
            <div class="imagem-produto">
                <img src="${foto}" class="img-principal" alt="${nome}">
                <img src="${fotoHover}" class="img-hover" alt="${nome}">

                ${esgotado ? `<div class="badge-esgotado">ESGOTADO</div>` : ""}

                <div class="card-produto">
                    <h3>${nome}</h3>
                    <p class="preco-card">${preco}</p>
                    <div class="lista-tamanhos">
                        ${criarBotoesTamanho(produto.estoque)}
                    </div>
                    <button class="adicionar-carrinho" type="button" ${esgotado ? "disabled" : ""}>
                        ${esgotado ? "ESGOTADO" : "ADICIONAR"}
                    </button>
                </div>
            </div>
            <div class="info-externa"><h3>${nomeCurto}</h3></div>
        </div>
    `;
}

async function carregarProdutosDaAPI() {
    const containerLancamentos = document.getElementById("listaLancamentos") || document.querySelector(".lancamentosSemana .imagemLancamentos");
    const containerCatalogo = document.getElementById("listaCatalogo") || document.querySelector("#catalogo .imagemCatalogo");

    if (!containerLancamentos && !containerCatalogo) return;

    try {
        const res = await apiFetch(`${API_URL}/produtos`);
        if (!res.ok) throw new Error("Falha ao buscar produtos");

        const produtos = await res.json();

        const lancamentos = produtos.filter(p => p.categoria === "lancamentos");
        const catalogo = produtos.filter(p => p.categoria === "catalogo");

        if (containerLancamentos) {
            containerLancamentos.innerHTML = lancamentos.length > 0
                ? lancamentos.map(criarCardProdutoAPI).join("")
                : "<p>Nenhum lançamento disponível no momento.</p>";
        }

        if (containerCatalogo) {
            containerCatalogo.innerHTML = catalogo.length > 0
                ? catalogo.map(criarCardProdutoAPI).join("")
                : "<p>Nenhum produto no catálogo no momento.</p>";
        }

        configurarProdutosDaLoja();
    } catch (e) {
        console.error("Erro ao carregar produtos da API:", e);
        if (containerLancamentos) containerLancamentos.innerHTML = "<p>Erro ao carregar produtos.</p>";
        if (containerCatalogo) containerCatalogo.innerHTML = "<p>Erro ao carregar produtos.</p>";
    }
}

function configurarProdutosDaLoja() {
    const produtosContainer = document.querySelectorAll(".produto");

    produtosContainer.forEach(produto => {
        const botoesTamanho = produto.querySelectorAll(".btn-tamanho");
        const btnAdicionar = produto.querySelector(".adicionar-carrinho");

        botoesTamanho.forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (btn.classList.contains("sem-estoque")) {
                    alert("Este tamanho está fora de estoque.");
                    return;
                }
                botoesTamanho.forEach(b => b.classList.remove("selecionado"));
                btn.classList.add("selecionado");
                produto.dataset.tamanhoSelecionado = btn.dataset.tamanho || btn.innerText.trim();
            });
        });

        if (btnAdicionar) {
            btnAdicionar.addEventListener("click", async (e) => {
                e.stopPropagation();

                const id = produto.dataset.id;
                const nome = produto.dataset.nome || "Produto";
                const preco = Number(produto.dataset.preco) || 0;
                const imagem_url = produto.dataset.imagem || "imagens/Monograma.png";
                const tamanho = produto.dataset.tamanhoSelecionado;

                if (!tamanho) {
                    alert("Selecione um tamanho antes de adicionar!");
                    return;
                }

                let estoque_id = null;
                let cor = "";
                try {
                    const estoque = JSON.parse(produto.dataset.estoque || "[]");
                    const variacao = estoque.find(v => v.tamanho === tamanho);
                    if (variacao) {
                        estoque_id = variacao.estoque_id;
                        cor = variacao.cor || "";
                    }
                } catch (err) {}

                const itemExistente = carrinho.find(item => item.id === id && item.tamanho === tamanho);

                // Busca estoque em tempo real do backend (evita dado stale do HTML)
                let estoqueDisponivel = 9999;
                try {
                    const resEst = await apiFetch(`${API_URL}/estoque/${estoque_id}`);
                    if (resEst.ok) {
                        const dadosEst = await resEst.json();
                        estoqueDisponivel = dadosEst.quantidade ?? 9999;
                    }
                } catch (err) {
                    // fallback: usa o dataset local se o backend falhar
                    try {
                        const estoqueArr = JSON.parse(produto.dataset.estoque || "[]");
                        const variacaoAtual = estoqueArr.find(v => v.tamanho === tamanho);
                        if (variacaoAtual) estoqueDisponivel = variacaoAtual.quantidade ?? 9999;
                    } catch (err2) {}
                }

                if (itemExistente) {
                    if (itemExistente.quantidade >= estoqueDisponivel) {
                        alert(`Quantidade máxima disponível em estoque: ${estoqueDisponivel}`);
                        return;
                    }
                    itemExistente.quantidade += 1;
                    itemExistente.estoque_disponivel = estoqueDisponivel;
                    await atualizarQuantidadeNoBackend(itemExistente.estoque_id, itemExistente.quantidade);
                } else {
                    if (estoqueDisponivel <= 0) {
                        alert("Este item está fora de estoque.");
                        return;
                    }
                    carrinho.push({ id, estoque_id, nome, preco, imagem_url, tamanho, cor, quantidade: 1, estoque_disponivel: estoqueDisponivel });
                    await adicionarItemNoBackend(estoque_id, 1);
                }

                salvarCarrinho();
                atualizarSacola();
                abrirPainelSacola();
            });
        }
    });
}

carregarProdutosDaAPI();

// ================= FINALIZAR COMPRA =================
if (btnFinalizar) {
    btnFinalizar.addEventListener("click", () => {
        if (carrinho.length === 0) {
            alert("Sua sacola está vazia.");
            return;
        }

        if (!usuarioEstaLogado()) {
            appState.checkoutPendente = true;
            fecharPainelSacola();
            abrirModalLogin();
            return;
        }

        window.location.href = CHECKOUT_URL;
    });
}

// ================= INICIALIZAÇÃO =================
atualizarInterfaceUsuario();
atualizarSacola();

// Se já está logado ao carregar a página, recarrega o carrinho do backend
if (usuarioEstaLogado()) {
    carregarCarrinhoDoBackend(auth.usuario);
}

// pagamento a seguir
async function finalizarEPagar({ usuario_id, frete_valor, frete_tipo, frete_prazo }) {
    // 1. Cria o pedido no banco
    const resPedido = await apiFetch(`${API_URL}/pedido/finalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id, frete_valor, frete_tipo, frete_prazo })
    });
 
    const dadosPedido = await resPedido.json();
 
    if (dadosPedido.erro) {
        alert("Erro ao criar pedido: " + dadosPedido.erro);
        return;
    }
 
    const pedido_id = dadosPedido.pedido_id;
    const total     = dadosPedido.total;
 
    // 2. Gera o link de pagamento no MP
    const resPag = await apiFetch(`${API_URL}/pagamento/criar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_id, usuario_id, total, frete_valor })
    });
 
    const dadosPag = await resPag.json();
 
    if (dadosPag.erro) {
        alert("Erro ao gerar pagamento: " + dadosPag.erro);
        return;
    }
 
    // 3. Salva o pedido_id no localStorage para usar na tela de retorno
    localStorage.setItem("ladoDocePedidoAtual", pedido_id);
 
    // 4. Redireciona para o Mercado Pago
    window.location.href = dadosPag.link;
}
 
// ── Tela de retorno: lê o status da URL e exibe para o usuário ────────────
// Cole este trecho na página que recebe o retorno do MP
// (pode ser compracerta.html, ou o checkout.html verificando a URL)
 
function verificarRetornoPagamento() {
    const params    = new URLSearchParams(window.location.search);
    const pedido_id = params.get("pedido_id") || localStorage.getItem("ladoDocePedidoAtual");
    const pathname  = window.location.pathname;
 
    // Detecta qual back_url foi chamada
    if (pathname.includes("sucesso")) {
        exibirResultadoPagamento("approved", pedido_id);
    } else if (pathname.includes("falha")) {
        exibirResultadoPagamento("failure", pedido_id);
    } else if (pathname.includes("pendente")) {
        exibirResultadoPagamento("pending", pedido_id);
        iniciarPollingStatus(pedido_id); // fica verificando até confirmar
    }
}
 
function exibirResultadoPagamento(status, pedido_id) {
    const mensagens = {
        approved: {
            titulo: "Pedido confirmado! 🎉",
            texto:  "Seu pagamento foi aprovado. Em breve você receberá um e-mail de confirmação.",
            cor:    "#4caf50"
        },
        failure: {
            titulo: "Pagamento não aprovado",
            texto:  "Tente novamente com outro método de pagamento.",
            cor:    "#f44336"
        },
        pending: {
            titulo: "Aguardando confirmação",
            texto:  "Seu pagamento está sendo processado. Você receberá um e-mail quando for confirmado.",
            cor:    "#ff9800"
        }
    };
 
    const m = mensagens[status] || mensagens.pending;
 
    // Adapte os IDs abaixo conforme os elementos da sua página de retorno
    const elTitulo = document.getElementById("statusTitulo");
    const elTexto  = document.getElementById("statusTexto");
    const elNum    = document.getElementById("numeroPedido");
 
    if (elTitulo) { elTitulo.textContent = m.titulo; elTitulo.style.color = m.cor; }
    if (elTexto)  elTexto.textContent  = m.texto;
    if (elNum && pedido_id) elNum.textContent = `Pedido #${pedido_id}`;
 
    // Limpa o pedido local após exibir (evita reexibição ao recarregar)
    if (status === "approved") {
        localStorage.removeItem("ladoDocePedidoAtual");
        localStorage.removeItem("ladoDoceCarrinho");  // limpa carrinho após compra
    }
}
 
// ── Polling de status (para boleto/Pix ou conferência extra) ─────────────
 
function iniciarPollingStatus(pedido_id) {
    if (!pedido_id) return;
 
    const intervalo = setInterval(async () => {
        try {
            const res  = await apiFetch(`${API_URL}/pagamento/status/${pedido_id}`);
            const data = await res.json();
 
            if (data.status === "pago") {
                clearInterval(intervalo);
                exibirResultadoPagamento("approved", pedido_id);
                localStorage.removeItem("ladoDocePedidoAtual");
                localStorage.removeItem("ladoDoceCarrinho");
            }
        } catch (e) {
            console.error("Erro no polling de status:", e);
        }
    }, 3000); // verifica a cada 3 segundos
}
 
// ── Chama a verificação quando a página carregar ──────────────────────────
 
document.addEventListener("DOMContentLoaded", verificarRetornoPagamento);
 