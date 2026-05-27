// ================= CONFIGURAÇÕES =================
// 🔧 MUDE ESTA URL quando hospedar o backend em produção
const API_URL = "https://lado-doce.onrender.com";

const CHAVE_CARRINHO = "ladoDoceCarrinho";
const CHAVE_USUARIO = "ladoDoceUser";

let carrinho = JSON.parse(localStorage.getItem(CHAVE_CARRINHO) || "[]");
carrinho = carrinho.map(item => {
    const { imagem, foto, fotoHover, ...itemSemImagem } = item;
    return itemSemImagem;
});
const usuario = JSON.parse(localStorage.getItem(CHAVE_USUARIO) || "null");

if (!usuario) {
    alert("Você precisa estar logado(a) para finalizar a compra.");
    window.location.href = "index.html";
}

if (!carrinho.length) {
    alert("Sua sacola está vazia.");
    window.location.href = "index.html";
}

// ================= REFERÊNCIAS =================
const checkoutNome        = document.getElementById("checkoutNome");
const checkoutEmail       = document.getElementById("checkoutEmail");
const checkoutTelefone    = document.getElementById("checkoutTelefone");
const checkoutCep         = document.getElementById("checkoutCep");
const checkoutRua         = document.getElementById("checkoutRua");
const checkoutNumero      = document.getElementById("checkoutNumero");
const checkoutComplemento = document.getElementById("checkoutComplemento");
const checkoutBairro      = document.getElementById("checkoutBairro");
const checkoutCidade      = document.getElementById("checkoutCidade");
const checkoutEstado      = document.getElementById("checkoutEstado");

const listaResumoCheckout = document.getElementById("listaResumoCheckout");
const checkoutSubtotal    = document.getElementById("checkoutSubtotal");
const checkoutFrete       = document.getElementById("checkoutFrete");
const checkoutTotal       = document.getElementById("checkoutTotal");
const confirmarPedido     = document.getElementById("confirmarPedido");
const mensagemCheckout    = document.getElementById("mensagemCheckout");
const opcoesFreteContainer = document.getElementById("opcoesFrete");

// ================= PRÉ-PREENCHER COM DADOS DO USUÁRIO =================
if (checkoutNome)     checkoutNome.value     = usuario?.nome || "";
if (checkoutEmail)    checkoutEmail.value    = usuario?.email || "";
if (checkoutTelefone) checkoutTelefone.value = usuario?.telefone || "";

if (usuario?.cep && usuario.cep !== "00000000") {
    if (checkoutCep)    checkoutCep.value    = usuario.cep;
    if (checkoutNumero) checkoutNumero.value = usuario.numero !== "S/N" ? usuario.numero || "" : "";
    if (checkoutComplemento) checkoutComplemento.value = usuario.complemento || "";
}

// ================= FUNÇÕES AUXILIARES =================
function converterPrecoParaNumero(preco) {
    return Number(
        String(preco)
            .replace("R$", "")
            .replace(/\./g, "")
            .replace(",", ".")
            .trim()
    ) || 0;
}

function formatarPreco(valor) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ================= ESTADO DO FRETE =================
let freteSelecionado = { valor: 0, tipo: "", prazo: "" };

// ================= CALCULAR FRETE DA API =================
async function calcularFreteDaAPI(cep) {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length < 8) return;

    opcoesFreteContainer.innerHTML = "<p>Calculando frete...</p>";

    try {
        const res = await fetch(`${API_URL}/calcular-frete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cep: cepLimpo })
        });

        const data = await res.json();

        if (data.erro) {
            opcoesFreteContainer.innerHTML = `<p style="color:red">${data.erro}</p>`;
            return;
        }

        // Preenche endereço automaticamente — sempre sobrescreve com dados do CEP
        if (data.endereco) {
            if (checkoutRua)    checkoutRua.value    = data.endereco.logradouro || "";
            if (checkoutBairro) checkoutBairro.value = data.endereco.bairro     || "";
            if (checkoutCidade) checkoutCidade.value = data.endereco.localidade || "";
            if (checkoutEstado) checkoutEstado.value = data.endereco.uf         || "";
        }

        // Renderiza opções de frete vindas da API
        if (data.opcoes_entrega && data.opcoes_entrega.length > 0) {
            opcoesFreteContainer.innerHTML = data.opcoes_entrega.map((opcao, i) => {
                if (opcao.tipo === "whatsapp") {
                    return `
                        <label class="opcao-frete">
                            <span>
                                <input type="radio" name="frete"
                                    value="0"
                                    data-tipo="whatsapp"
                                    data-prazo="a combinar">
                                <a href="${opcao.link}" target="_blank">📱 ${opcao.nome}</a>
                                <small>${opcao.descricao}</small>
                            </span>
                        </label>
                    `;
                }

                const valorExibido = opcao.valor === 0 ? "Grátis" : formatarPreco(opcao.valor);
                const checked = i === 0 ? "checked" : "";

                return `
                    <label class="opcao-frete">
                        <span>
                            <input type="radio" name="frete"
                                value="${opcao.valor}"
                                data-tipo="${opcao.nome}"
                                data-prazo="${opcao.prazo}"
                                ${checked}>
                            ${opcao.nome} · ${opcao.prazo}
                        </span>
                        <strong>${valorExibido}</strong>
                    </label>
                `;
            }).join("");

            // Seleciona o primeiro frete automaticamente
            const primeiroFrete = data.opcoes_entrega.find(o => o.tipo !== "whatsapp");
            if (primeiroFrete) {
                freteSelecionado = {
                    valor: primeiroFrete.valor || 0,
                    tipo: primeiroFrete.nome,
                    prazo: primeiroFrete.prazo
                };
            }

            // Listener para trocar frete
            document.querySelectorAll('input[name="frete"]').forEach(input => {
                input.addEventListener("change", () => {
                    freteSelecionado = {
                        valor: Number(input.value),
                        tipo: input.dataset.tipo || "",
                        prazo: input.dataset.prazo || ""
                    };
                    renderizarResumo();
                });
            });

            renderizarResumo();
        } else {
            opcoesFreteContainer.innerHTML = "<p style='color:red'>Nenhuma opção de frete disponível para este CEP.</p>";
        }

    } catch (e) {
        console.error("Erro ao calcular frete:", e);
        opcoesFreteContainer.innerHTML = "<p style='color:red'>Erro ao calcular frete. Verifique se o servidor está rodando.</p>";
    }
}

// ================= LISTENER DO CEP =================
if (checkoutCep) {
    // Dispara ao sair do campo
    checkoutCep.addEventListener("blur", () => {
        calcularFreteDaAPI(checkoutCep.value);
    });

    // Dispara ao digitar 8 dígitos (sem precisar sair do campo)
    checkoutCep.addEventListener("input", () => {
        const cepLimpo = checkoutCep.value.replace(/\D/g, "");
        if (cepLimpo.length === 8) {
            calcularFreteDaAPI(checkoutCep.value);
        }
    });

    // Se já tem CEP do usuário, calcula ao abrir a página
    if (checkoutCep.value && checkoutCep.value.replace(/\D/g, "").length === 8) {
        calcularFreteDaAPI(checkoutCep.value);
    }
}

// ================= RENDERIZAR RESUMO DO PEDIDO =================
function renderizarResumo() {
    if (!listaResumoCheckout || !checkoutSubtotal || !checkoutFrete || !checkoutTotal) return;

    listaResumoCheckout.innerHTML = "";

    let subtotal = 0;

    carrinho.forEach(item => {
        const preco = typeof item.preco === "number" ? item.preco : converterPrecoParaNumero(item.preco);
        subtotal += preco * item.quantidade;

        const div = document.createElement("div");
        div.className = "itemResumoCheckout";
        const imagemItem = item.imagem_url || "imagens/Monograma.png";

        div.innerHTML = `
            <img src="${imagemItem}" alt="${item.nome}">
            <div>
                <strong>${item.nome}</strong>
                <p>Tamanho: ${item.tamanho}${item.cor ? " · " + item.cor : ""}</p>
                <p>Qtd: ${item.quantidade}</p>
            </div>
            <strong>${formatarPreco(preco * item.quantidade)}</strong>
        `;

        listaResumoCheckout.appendChild(div);
    });

    const frete = freteSelecionado.valor || 0;
    const total = subtotal + frete;

    checkoutSubtotal.textContent = formatarPreco(subtotal);
    checkoutFrete.textContent    = frete === 0 ? "Grátis" : formatarPreco(frete);
    checkoutTotal.textContent    = formatarPreco(total);
}

// ================= CONFIRMAR PEDIDO NA API =================
if (confirmarPedido) {
    confirmarPedido.addEventListener("click", async () => {
        const obrigatorios = [
            "checkoutNome", "checkoutEmail", "checkoutTelefone",
            "checkoutCep", "checkoutRua", "checkoutNumero",
            "checkoutBairro", "checkoutCidade", "checkoutEstado"
        ];

        const faltando = obrigatorios.some(id => {
            const campo = document.getElementById(id);
            return !campo || !campo.value.trim();
        });

        if (faltando) {
            mensagemCheckout.classList.add("active");
            mensagemCheckout.style.color = "red";
            mensagemCheckout.textContent = "Preencha todos os campos de identificação e endereço.";
            return;
        }

        if (!freteSelecionado.tipo) {
            mensagemCheckout.classList.add("active");
            mensagemCheckout.style.color = "red";
            mensagemCheckout.textContent = "Digite o CEP para calcular e selecionar uma opção de frete.";
            return;
        }

        // Se frete é por WhatsApp, mostra mensagem e não prossegue
        if (freteSelecionado.tipo === "whatsapp") {
            mensagemCheckout.classList.add("active");
            mensagemCheckout.style.color = "#856404";
            mensagemCheckout.textContent = "Para combinar frete pelo WhatsApp, finalize seu pedido normalmente e anote o número do pedido. Em seguida, nos contate via WhatsApp para combinarmos a entrega.";
            return;
        }

        confirmarPedido.disabled = true;
        confirmarPedido.textContent = "Processando...";

        try {
            // Uma única chamada: cria o pedido + preferência MP atomicamente.
            // Se o MP falhar, o pedido não é salvo no banco.
            const res = await fetch(`${API_URL}/pedido/finalizar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    usuario_id:  usuario.id,
                    frete_valor: freteSelecionado.valor,
                    frete_tipo:  freteSelecionado.tipo,
                    frete_prazo: freteSelecionado.prazo
                })
            });

            const data = await res.json();

            if (data.erro) {
                mensagemCheckout.classList.add("active");
                mensagemCheckout.style.color = "red";
                mensagemCheckout.textContent = data.erro;
                confirmarPedido.disabled = false;
                confirmarPedido.textContent = "Finalizar e Pagar!";
                return;
            }

            if (!data.link) {
                mensagemCheckout.classList.add("active");
                mensagemCheckout.style.color = "red";
                mensagemCheckout.textContent = "Erro ao gerar link de pagamento. Tente novamente.";
                confirmarPedido.disabled = false;
                confirmarPedido.textContent = "Finalizar e Pagar!";
                return;
            }

            // Salva o pedido_id atual para referência nas telas de retorno do MP
            localStorage.setItem("ladoDocePedidoAtual", data.pedido_id);

            mensagemCheckout.classList.add("active");
            mensagemCheckout.style.color = "green";
            mensagemCheckout.textContent = "Pedido criado! Redirecionando para o pagamento...";

            // Redireciona para o Mercado Pago
            window.location.href = data.link;

        } catch (e) {
            console.error("Erro ao finalizar pedido:", e);
            mensagemCheckout.classList.add("active");
            mensagemCheckout.style.color = "red";
            mensagemCheckout.textContent = "Erro de conexão com o servidor. Tente novamente.";
            confirmarPedido.disabled = false;
            confirmarPedido.textContent = "Finalizar e Pagar!";
        }
    });
}

// ================= INICIALIZAÇÃO =================
renderizarResumo();
