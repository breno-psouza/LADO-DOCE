// ================= CONFIGURAÇÕES =================
const API_URL = "https://lado-doce.onrender.com";

function iniciarAdmin() {
    carregarProdutos();
    carregarClientes();
    carregarPedidosFiltrados();
    carregarAlertasEstoque();
    atualizarDashboard();
}
function getAdminKey() {
    return sessionStorage.getItem("adminKey") || "";
}

async function adminFetch(url, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        "x-admin-key": getAdminKey(),
        ...(options.headers || {})
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 403) {
        sessionStorage.clear();
        // Mostra tela de login sem recarregar (evita loop infinito)
        const telaLogin = document.getElementById("telaLoginAdmin");
        if (telaLogin) {
            telaLogin.style.display = "flex";
            document.getElementById("erroAdmin").style.display = "block";
            document.getElementById("erroAdmin").textContent = "Sessão expirada. Digite a senha novamente.";
        }
        return res;
    }
    return res;
}

// ================= UTILITÁRIOS =================
function trocarTela(id) {
    document.querySelectorAll('.tela').forEach(tela => tela.classList.remove('ativa'));
    document.getElementById(id)?.classList.add('ativa');
    // Só atualiza dashboard quando vai pra essa tela
    if (id === "dashboard") atualizarDashboard();
}

const CHAVE_CONFIG_LOJA = "configLoja";

let produtos = [];
let pedidos = [];
let clientes = [];
let editProdutoId = null;

function formatarPrecoAdmin(valor) {
    let str = String(valor).replace("R$", "").trim();
    if (str.includes(",")) {
        str = str.replace(/\./g, "").replace(",", ".");
    }
    const numero = Number(str);
    if (!Number.isFinite(numero)) return 0;
    return numero;
}

function formatarMoeda(valor) {
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function nomeCategoria(categoria) {
    return categoria === "lancamentos" ? "Lançamentos" : "Catálogo";
}

function obterTamanhosSelecionados() {
    return Array.from(document.querySelectorAll('#gradeTamanhosProduto input:checked')).map(input => input.value);
}

function marcarTamanhos(tamanhos = []) {
    document.querySelectorAll('#gradeTamanhosProduto input').forEach(input => {
        input.checked = tamanhos.includes(input.value);
    });
    atualizarGradeQtd();
}

function atualizarGradeQtd() {
    const grade = document.getElementById("gradeQtdTamanho");
    if (!grade) return;
    const selecionados = obterTamanhosSelecionados();
    if (selecionados.length === 0) { grade.innerHTML = ""; return; }
    grade.innerHTML = selecionados.map(tam => `
        <div class="linha-qtd-tamanho">
            <span>${tam}</span>
            <input type="number" min="0" value="0"
                   id="qtd_${tam}" placeholder="Qtd ${tam}">
        </div>
    `).join("");
}

function obterQtdPorTamanho() {
    const selecionados = obterTamanhosSelecionados();
    const resultado = {};
    selecionados.forEach(tam => {
        const input = document.getElementById(`qtd_${tam}`);
        resultado[tam] = input ? Number(input.value) || 0 : 0;
    });
    return resultado;
}

function atualizarPreview(inputId, previewId, fallback = "") {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;
    const file = input.files?.[0];
    if (file) {
        preview.src = URL.createObjectURL(file);
        preview.classList.add("active");
        return;
    }
    if (fallback) {
        preview.src = fallback;
        preview.classList.add("active");
    } else {
        preview.removeAttribute("src");
        preview.classList.remove("active");
    }
}

// ================= PRODUTOS — CARREGAR DA API =================
async function carregarProdutos() {
    const tbody = document.querySelector("#produtos tbody");
    if (!tbody) return;

    tbody.innerHTML = "<tr><td colspan='10'>Carregando...</td></tr>";

    try {
        const res = await fetch(`${API_URL}/produtos`);
        if (!res.ok) throw new Error();
        produtos = await res.json();
        aplicarFiltroProdutos();
    } catch (e) {
        console.error("Erro ao carregar produtos:", e);
        tbody.innerHTML = `<tr><td colspan="10" style="color:red">Erro ao carregar produtos.</td></tr>`;
    }

    atualizarDashboard();
}

function renderizarProdutos(lista) {
    const tbody = document.querySelector("#produtos tbody");
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10">Nenhum produto encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";
    lista.forEach(produto => {
        const tamanhos = produto.estoque
            ? [...new Set(produto.estoque.map(v => v.tamanho))].join(", ")
            : "Não definido";

        const totalEstoque = produto.estoque
            ? produto.estoque.reduce((soma, v) => soma + v.quantidade, 0)
            : 0;

        const statusAtual = produto.status || "ativo";
        const btnStatusLabel = statusAtual === "ativo" ? "Desativar" : "Ativar";
        const btnStatusClass = statusAtual === "ativo" ? "btn-remover" : "btn-editar";

        tbody.innerHTML += `
            <tr>
                <td><img src="${produto.imagem_url || 'imagens/Monograma.png'}" width="55" height="70" alt="${produto.nome}"></td>
                <td>${produto.nome}</td>
                <td>${produto.id}</td>
                <td>${formatarMoeda(produto.preco)}</td>
                <td>${totalEstoque}</td>
                <td>${tamanhos}</td>
                <td><span class="status ${statusAtual}">${statusAtual}</span></td>
                <td>${nomeCategoria(produto.categoria)}</td>
                <td class="acoes">
                    <button class="btn-editar" onclick="editarProduto(${produto.id})">Editar</button>
                    <button class="${btnStatusClass}" onclick="alterarStatusProduto(${produto.id}, '${statusAtual === 'ativo' ? 'inativo' : 'ativo'}')">${btnStatusLabel}</button>
                    <button class="btn-remover" onclick="removerProduto(${produto.id})">Remover</button>
                </td>
            </tr>
        `;
    });
}

// ================= PRODUTOS — FILTRO =================
function aplicarFiltroProdutos() {
    const statusFiltro = document.getElementById("filtroStatusProduto")?.value || "todos";
    const categoria = document.getElementById("filtroCategoriaProduto")?.value || "todos";
    const busca = document.getElementById("filtroBuscaProduto")?.value.toLowerCase().trim() || "";

    const filtrados = produtos.filter(produto => {
        const statusAtual = produto.status || "ativo";
        // O select tem "Status" como valor padrão, tratamos como "todos"
        const statusOk = statusFiltro === "todos" || statusFiltro === "Status" ||
            statusAtual === statusFiltro.toLowerCase();
        const categoriaOk = categoria === "todos" || produto.categoria === categoria;
        const buscaOk = produto.nome.toLowerCase().includes(busca);
        return statusOk && categoriaOk && buscaOk;
    });

    renderizarProdutos(filtrados);
}

// ================= PRODUTOS — ALTERAR STATUS =================
async function alterarStatusProduto(id, novoStatus) {
    try {
        const res = await adminFetch(`${API_URL}/admin/produto/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: novoStatus })
        });
        const data = await res.json();
        if (data.erro) { alert(data.erro); return; }
        await carregarProdutos();
    } catch (e) {
        alert("Erro ao alterar status do produto.");
    }
}

// ================= PRODUTOS — MODAL =================
function abrirModal() {
    editProdutoId = null;
    limparModal();
    document.querySelector("#modalProduto h2").innerText = "Adicionar T-shirt";
    document.getElementById("modalProduto").style.display = "flex";
}

function fecharModal() {
    document.getElementById("modalProduto").style.display = "none";
}

function limparModal() {
    document.getElementById("nomeProduto").value = "";
    document.getElementById("precoProduto").value = "";
    document.getElementById("ordemProduto").value = "";
    document.getElementById("destaqueProduto").checked = false;
    document.getElementById("statusProduto").value = "Ativo";
    document.getElementById("categoriaProduto").value = "lancamentos";
    document.getElementById("fotoProduto").value = "";
    document.getElementById("fotoHoverProduto").value = "";
    marcarTamanhos(["P", "M", "G", "GG"]);
    atualizarPreview("fotoProduto", "previewFotoProduto");
    atualizarPreview("fotoHoverProduto", "previewFotoHoverProduto");
}

async function editarProduto(id) {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;

    document.getElementById("nomeProduto").value = produto.nome;
    document.getElementById("precoProduto").value = produto.preco;
    document.getElementById("ordemProduto").value = "";
    document.getElementById("destaqueProduto").checked = false;
    document.getElementById("statusProduto").value = produto.status || "ativo";
    document.getElementById("categoriaProduto").value = produto.categoria || "catalogo";

    const tamanhos = produto.estoque ? [...new Set(produto.estoque.map(v => v.tamanho))] : [];
    marcarTamanhos(tamanhos);

    // Preenche qtd por tamanho
    if (produto.estoque) {
        produto.estoque.forEach(v => {
            const input = document.getElementById(`qtd_${v.tamanho}`);
            if (input) input.value = v.quantidade;
        });
    }

    atualizarPreview("fotoProduto", "previewFotoProduto", produto.imagem_url);
    atualizarPreview("fotoHoverProduto", "previewFotoHoverProduto", produto.imagem_url);

    editProdutoId = id;
    document.querySelector("#modalProduto h2").innerText = "Editar T-shirt";
    document.getElementById("modalProduto").style.display = "flex";
}

// ================= UPLOAD DE IMAGEM — SUPABASE =================
const SUPABASE_URL = "https://atpfqlcxvdalouydrsav.supabase.co";
const SUPABASE_BUCKET = "imagens";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cGZxbGN4dmRhbG91eWRyc2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjkxOTMsImV4cCI6MjA4ODk0NTE5M30._1wiQ0hXKGgnbwgggLxQgL-yKtYkO-xSblEd6bAiaRw";

async function uploadImagemSupabase(arquivo) {
    if (!arquivo) return null;

    const extensao = arquivo.name.split(".").pop();
    const nomeUnico = `produtos/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`;

    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${nomeUnico}`, {
        method: "POST",
        headers: {
            "Content-Type": arquivo.type,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "x-upsert": "true"
        },
        body: arquivo
    });

    if (!res.ok) {
        const erro = await res.text();
        console.error("Erro no upload:", erro);
        return null;
    }

    return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${nomeUnico}`;
}

// ================= PRODUTOS — SALVAR =================
async function salvarProduto() {
    const nome = document.getElementById("nomeProduto").value.trim();
    const preco = formatarPrecoAdmin(document.getElementById("precoProduto").value.trim());
    const categoria = document.getElementById("categoriaProduto").value;
    const tamanhos = obterTamanhosSelecionados();
    const arquivoFoto = document.getElementById("fotoProduto").files?.[0];

    if (!nome || !preco) { alert("Preencha nome e preço."); return; }
    if (tamanhos.length === 0) { alert("Selecione pelo menos um tamanho."); return; }

    const qtdPorTamanho = obterQtdPorTamanho();
    const variacoes = tamanhos.map(tamanho => ({
        tamanho,
        cor: "Único",
        quantidade: qtdPorTamanho[tamanho] || 0
    }));

    // Quantidade total calculada automaticamente pela soma dos tamanhos
    const quantidade = variacoes.reduce((soma, v) => soma + v.quantidade, 0);

    const btnSalvar = document.querySelector("#modalProduto button");
    if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.textContent = "Salvando..."; }

    try {
        // Faz upload da imagem se um arquivo foi selecionado
        let imagemUrl = editProdutoId ? produtos.find(p => p.id === editProdutoId)?.imagem_url || "" : "";

        if (arquivoFoto) {
            btnSalvar.textContent = "Enviando imagem...";
            const urlUpload = await uploadImagemSupabase(arquivoFoto);
            if (!urlUpload) {
                alert("Erro ao enviar a imagem. Verifique sua conexão e tente novamente.");
                return;
            }
            imagemUrl = urlUpload;
        }

        const corpo = { nome, descricao: "", preco, categoria, imagem_url: imagemUrl, variacoes };

        btnSalvar.textContent = "Salvando produto...";
        const url = editProdutoId ? `${API_URL}/admin/produto/${editProdutoId}` : `${API_URL}/admin/produto`;
        const method = editProdutoId ? "PUT" : "POST";

        const res = await adminFetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpo)
        });

        const data = await res.json();
        if (data.erro) { alert(data.erro); return; }

        fecharModal();
        await carregarProdutos();
        alert(editProdutoId ? "Produto atualizado!" : "Produto cadastrado!");

    } catch (e) {
        console.error("Erro ao salvar produto:", e);
        alert("Erro de conexão com o servidor.");
    } finally {
        if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.textContent = "Salvar"; }
    }
}

// ================= PRODUTOS — REMOVER =================
async function removerProduto(id) {
    if (!confirm("Remover este produto da loja?")) return;
    try {
        const res = await adminFetch(`${API_URL}/admin/produto/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.erro) { alert(data.erro); return; }
        await carregarProdutos();
    } catch (e) {
        alert("Erro de conexão com o servidor.");
    }
}

// ================= ESTOQUE — REPOR =================
async function reporEstoque(estoqueId, quantidade) {
    try {
        const res = await adminFetch(`${API_URL}/admin/estoque/repor`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estoque_id: estoqueId, quantidade_adicional: quantidade })
        });
        return await res.json();
    } catch (e) {
        return { erro: "Erro de conexão" };
    }
}

// ================= PEDIDOS — CARREGAR DA API =================
async function limparPedidosExpirados() {
    if (!confirm("Isso vai cancelar todos os pedidos que ficaram em aguardando_pagamento por mais de 30 min. Continuar?")) return;
    try {
        const res = await adminFetch(`${API_URL}/admin/pedidos/limpar-expirados`, { method: "DELETE" });
        const data = await res.json();
        alert(data.msg || data.erro || "Concluído");
        await carregarPedidosFiltrados();
    } catch (e) {
        alert("Erro ao limpar pedidos expirados.");
    }
}

async function carregarPedidosFiltrados() {
    const tbody = document.querySelector("#pedidos tbody");
    if (!tbody) return;

    tbody.innerHTML = "<tr><td colspan='6'>Carregando...</td></tr>";

    try {
        const res = await adminFetch(`${API_URL}/admin/pedidos`);
        if (!res.ok) throw new Error();
        pedidos = await res.json();
        aplicarFiltroPedidos();
    } catch (e) {
        console.error("Erro ao carregar pedidos:", e);
        tbody.innerHTML = `<tr><td colspan="6" style="color:red">Erro ao carregar pedidos.</td></tr>`;
    }

    atualizarDashboard();
}

// ================= PEDIDOS — FILTRO =================
function aplicarFiltroPedidos() {
    const tbody = document.querySelector("#pedidos tbody");
    if (!tbody) return;

    const statusFiltro = document.querySelector("#pedidos select")?.value || "todos";
    const dataFiltro = document.querySelector("#pedidos input[type='date']")?.value || "";
    const buscaFiltro = document.querySelector("#pedidos input[type='text']")?.value.toLowerCase().trim() || "";

    let filtrados = [...pedidos];

    // Filtro por status — os valores do select batem com os do banco
    if (statusFiltro && statusFiltro !== "todos") {
        filtrados = filtrados.filter(p => p.status === statusFiltro);
    }

    // Filtro por data
    if (dataFiltro) {
        const [ano, mes, dia] = dataFiltro.split("-");
        const dataBR = `${dia}/${mes}/${ano}`;
        filtrados = filtrados.filter(p => p.data && p.data.startsWith(dataBR));
    }

    // Filtro por busca
    if (buscaFiltro) {
        filtrados = filtrados.filter(p =>
            String(p.pedido_id).includes(buscaFiltro) ||
            (p.cliente || "").toLowerCase().includes(buscaFiltro)
        );
    }

    renderizarPedidos(filtrados);
}

function renderizarPedidos(lista) {
    const tbody = document.querySelector("#pedidos tbody");
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6">Nenhum pedido encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";
    lista.forEach(pedido => {
        const indexReal = pedidos.findIndex(p => p.pedido_id === pedido.pedido_id);
        tbody.innerHTML += `
            <tr>
                <td>#${pedido.pedido_id}</td>
                <td>${pedido.cliente || "-"}</td>
                <td>${pedido.data || "-"}</td>
                <td>${formatarMoeda(pedido.total)}</td>
                <td><span class="status ${String(pedido.status).replaceAll(" ", "-")}">${pedido.status}</span></td>
                <td class="acoes">
                    <button class="btn-editar" onclick="verPedido(${indexReal})">Ver detalhes</button>
                    <button class="btn-etiquetas" onclick="imprimirEtiqueta(${indexReal})">Imprimir Etiqueta</button>
                    <select onchange="atualizarStatusPedido(${pedido.pedido_id}, this.value)">
                        <option value="">Mudar status</option>
                        <option value="pago">Pago</option>
                        <option value="enviado">Enviado</option>
                        <option value="entregue">Entregue</option>
                        <option value="cancelado">Cancelado</option>
                    </select>
                </td>
            </tr>
        `;
    });
}

async function atualizarStatusPedido(pedidoId, novoStatus) {
    if (!novoStatus) return;
    try {
        const res = await fetch(`${API_URL}/pedido/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pedido_id: pedidoId, novo_status: novoStatus })
        });
        const data = await res.json();
        if (data.erro) { alert(data.erro); return; }
        await carregarPedidosFiltrados();
    } catch (e) {
        alert("Erro ao atualizar status.");
    }
}

function verPedido(index) {
    const pedido = pedidos[index];
    if (!pedido) return;

    const itens = Array.isArray(pedido.itens)
        ? pedido.itens.map(item => `<p>${item.produto} · ${item.tamanho} · ${item.cor} · Qtd ${item.quantidade} · ${formatarMoeda(item.subtotal)}</p>`).join("")
        : "<p>-</p>";

    const end = pedido.endereco_entrega;
    const enderecoHTML = end ? `
        <hr>
        <h3>Endereço de entrega</h3>
        <p>${end.rua || "-"}, ${end.numero || "-"}${end.complemento ? " — " + end.complemento : ""}</p>
        <p>CEP: ${end.cep || "-"} · ${end.uf || "-"}</p>
    ` : "";

    document.getElementById("conteudoPedido").innerHTML = `
        <h2>Pedido #${pedido.pedido_id}</h2>
        <p><b>Cliente:</b> ${pedido.cliente || "-"}</p>
        <p><b>Email:</b> ${pedido.email || "-"}</p>
        <p><b>Telefone:</b> ${pedido.telefone || "-"}</p>
        <p><b>Data:</b> ${pedido.data || "-"}</p>
        <p><b>Total:</b> ${formatarMoeda(pedido.total)}</p>
        <p><b>Status:</b> ${pedido.status}</p>
        <p><b>Frete:</b> ${pedido.frete?.tipo || "-"} · ${formatarMoeda(pedido.frete?.valor || 0)} · ${pedido.frete?.prazo || "-"}</p>
        ${enderecoHTML}
        <hr>
        <h3>Itens</h3>
        ${itens}
        <button onclick="fecharModalPedido()">Fechar</button>
    `;
    document.getElementById("modalPedido").style.display = "flex";
}

function imprimirEtiqueta(index) {
    const pedido = pedidos[index];
    if (!pedido) return;

    const end = pedido.endereco_entrega;
    const enderecoHTML = end
        ? `${end.rua || "-"}, ${end.numero || "-"}${end.complemento ? " — " + end.complemento : ""} · CEP ${end.cep || "-"} · ${end.uf || "-"}`
        : "Endereço não disponível";

    document.getElementById("conteudoPedido").innerHTML = `
        <div id="areaEtiqueta" style="border: 2px dashed #ccc; padding: 24px; font-family: monospace; line-height: 1.8;">
            <h2 style="margin:0 0 12px">📦 ETIQUETA — Pedido #${pedido.pedido_id}</h2>
            <p><b>DESTINATÁRIO:</b> ${pedido.cliente || "-"}</p>
            <p><b>ENDEREÇO:</b> ${enderecoHTML}</p>
            <p><b>FRETE:</b> ${pedido.frete?.tipo || "-"} · ${pedido.frete?.prazo || "-"}</p>
            <hr>
            <p style="font-size: 12px; color: #666;">Remetente: Lado Doce — São Paulo/SP</p>
        </div>
        <br>
        <button onclick="confirmarImpressao()">Imprimir</button>
        <button onclick="fecharModalPedido()">Fechar</button>
    `;
    document.getElementById("modalPedido").style.display = "flex";
}

function confirmarImpressao() { alert("Etiqueta gerada com sucesso"); }
function fecharModalPedido() { document.getElementById("modalPedido").style.display = "none"; }

// ================= CLIENTES — CARREGAR DA API =================
async function carregarClientes() {
    const tbody = document.querySelector("#clientes tbody");
    if (!tbody) return;

    tbody.innerHTML = "<tr><td colspan='5'>Carregando...</td></tr>";

    try {
        const res = await adminFetch(`${API_URL}/admin/clientes`);
        if (!res.ok) throw new Error();
        clientes = await res.json();
        aplicarFiltroClientes();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:red">Erro ao carregar clientes.</td></tr>`;
    }
}

// ================= CLIENTES — FILTRO =================
function aplicarFiltroClientes() {
    const tbody = document.querySelector("#clientes tbody");
    if (!tbody) return;

    const statusFiltro = document.querySelector("#clientes select")?.value || "todos";
    const busca = document.querySelector("#clientes input[type='text']")?.value.toLowerCase().trim() || "";

    const filtrados = clientes.filter(c => {
        const statusAtual = c.status || "ativo";
        const statusOk = statusFiltro === "todos" || statusAtual === statusFiltro.toLowerCase();
        const buscaOk = !busca ||
            (c.nome || "").toLowerCase().includes(busca) ||
            (c.email || "").toLowerCase().includes(busca);
        return statusOk && buscaOk;
    }).sort((a, b) => a.id - b.id);

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">Nenhum cliente encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";
    filtrados.forEach(cliente => {
        const statusAtual = cliente.status || "ativo";
        const btnLabel = statusAtual === "ativo" ? "Bloquear" : "Desbloquear";
        const btnClass = statusAtual === "ativo" ? "btn-remover" : "btn-editar";
        const novoStatus = statusAtual === "ativo" ? "bloqueado" : "ativo";

        tbody.innerHTML += `
            <tr>
                <td>#${cliente.id}</td>
                <td>${cliente.nome || "-"}</td>
                <td>${cliente.email}</td>
                <td>${formatarMoeda(cliente.total_gasto || 0)}</td>
                <td><span class="status ${statusAtual}">${statusAtual}</span></td>
                <td class="acoes">
                    <button class="btn-editar" onclick='verCliente(${JSON.stringify(cliente).replace(/'/g, "&#39;")})'>Ver detalhes</button>
                    <button class="${btnClass}" onclick="alterarStatusCliente(${cliente.id}, '${novoStatus}')">${btnLabel}</button>
                </td>
            </tr>
        `;
    });
}

// ================= CLIENTES — ALTERAR STATUS =================
async function alterarStatusCliente(id, novoStatus) {
    try {
        const res = await adminFetch(`${API_URL}/admin/cliente/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: novoStatus })
        });
        const data = await res.json();
        if (data.erro) { alert(data.erro); return; }
        await carregarClientes();
    } catch (e) {
        alert("Erro ao alterar status do cliente.");
    }
}

function verCliente(cliente) {
    if (typeof cliente === "string") cliente = JSON.parse(cliente);

    document.getElementById("conteudoCliente").innerHTML = `
        <h2>Cliente</h2>
        <p><b>Nome:</b> ${cliente.nome || "-"}</p>
        <p><b>Email:</b> ${cliente.email}</p>
        <p><b>Telefone:</b> ${cliente.telefone || "-"}</p>
        <p><b>CPF:</b> ${cliente.cpf || "-"}</p>
        <p><b>CEP:</b> ${cliente.cep || "-"}</p>
        <p><b>Endereço:</b> ${cliente.rua || "-"}, ${cliente.numero || "-"}</p>
        <p><b>UF:</b> ${cliente.uf || "-"}</p>
        <p><b>Total gasto:</b> ${formatarMoeda(cliente.total_gasto || 0)}</p>
        <p><b>Status:</b> ${cliente.status || "ativo"}</p>
        <button onclick="fecharModalCliente()">Fechar</button>
    `;
    document.getElementById("modalCliente").style.display = "flex";
}

function fecharModalCliente() { document.getElementById("modalCliente").style.display = "none"; }

// ================= ALERTAS DE ESTOQUE — SININHO =================
let totalAlertas = 0;

async function carregarAlertasEstoque() {
    try {
        const res = await adminFetch(`${API_URL}/admin/alertas-producao`);
        const data = await res.json();
        const lista = document.getElementById("listaPainelAlertas");
        const badge = document.getElementById("badgeAlerta");
        const btnSino = document.getElementById("btnSininho");

        totalAlertas = data.total_alertas || 0;

        // Atualiza o badge no sininho
        if (badge) {
            if (totalAlertas > 0) {
                badge.textContent = totalAlertas > 9 ? "9+" : totalAlertas;
                badge.style.display = "flex";
            } else {
                badge.style.display = "none";
            }
        }

        // Atualiza o emoji do sininho
        if (btnSino) {
            btnSino.innerHTML = (totalAlertas > 0
                ? `🔔 <span class="badge-alerta" id="badgeAlerta">${totalAlertas > 9 ? "9+" : totalAlertas}</span>`
                : `🔔 <span class="badge-alerta" id="badgeAlerta" style="display:none">0</span>`);
        }

        if (!lista) return;

        if (!data.itens || data.itens.length === 0) {
            lista.innerHTML = `<p class="alerta-vazio">✅ Nenhum alerta de estoque no momento.</p>`;
            return;
        }

        lista.innerHTML = data.itens.map(item => {
            const classe = item.quantidade_restante === 0 || item.quantidade_restante <= 1 ? "critico" : "baixo";
            return `
                <div class="alerta-card ${classe}">
                    <span class="alerta-card-titulo">${item.aviso} — ${item.produto}</span>
                    <span class="alerta-card-detalhe">${item.detalhe}</span>
                    <span class="alerta-card-qtd">Restante: ${item.quantidade_restante} unidade(s)</span>
                </div>
            `;
        }).join("");

    } catch (e) {
        console.error("Erro ao carregar alertas:", e);
    }
}

function abrirPainelAlertas() {
    document.getElementById("painelAlertas")?.classList.add("aberto");
    document.getElementById("overlayAlertas")?.classList.add("ativo");
}

function fecharPainelAlertas() {
    document.getElementById("painelAlertas")?.classList.remove("aberto");
    document.getElementById("overlayAlertas")?.classList.remove("ativo");
}

// ================= DASHBOARD =================
async function atualizarDashboard() {
    try {
        const STATUS_PAGOS = ["pago", "enviado", "entregue"];
        const periodo = Number(document.getElementById("periodoDashboard")?.value || 1);
        const agora = new Date();

        // Reusa dados já carregados — só faz fetch se ainda não tiver
        const todosPedidos = pedidos.length > 0 ? pedidos : await (async () => {
            const res = await adminFetch(`${API_URL}/admin/pedidos`);
            const data = res.ok ? await res.json() : [];
            pedidos = data;
            return data;
        })();

        const pedidosFiltrados = todosPedidos.filter(p => {
            if (!p.data) return false;
            const [dataParte] = p.data.split(" ");
            const [dia, mes, ano] = dataParte.split("/");
            // Usa T12:00 para evitar bug de timezone (UTC vs horário local)
            const dataPedido = new Date(`${ano}-${mes}-${dia}T12:00:00`);

            if (periodo === 1) {
                // "Hoje" = mesmo dia calendário
                return dataPedido.toDateString() === agora.toDateString();
            }
            // Compara só as datas (sem hora) para não perder pedidos do dia
            const inicioPeriodo = new Date(agora);
            inicioPeriodo.setHours(0, 0, 0, 0);
            inicioPeriodo.setDate(inicioPeriodo.getDate() - periodo);
            return dataPedido >= inicioPeriodo;
        });

        const pedidosPagos = pedidosFiltrados.filter(p => STATUS_PAGOS.includes(p.status));
        const totalVendas = pedidosPagos.reduce((soma, p) => soma + Number(p.total || 0), 0);

        const titulos = { 1: "Vendas do Dia", 7: "Vendas (7 dias)", 30: "Vendas (30 dias)", 60: "Vendas (60 dias)", 90: "Vendas (90 dias)" };
        const tituloEl = document.getElementById("tituloVendasPeriodo");
        if (tituloEl) tituloEl.innerText = titulos[periodo] || "Vendas";

        const resumoEl = document.getElementById("resumoPeriodoDashboard");
        if (resumoEl) resumoEl.innerText = periodo === 1 ? "Mostrando vendas de hoje" : `Mostrando últimos ${periodo} dias`;

        document.getElementById("vendasDia") && (document.getElementById("vendasDia").innerText = formatarMoeda(totalVendas));
        document.getElementById("totalPedidosDash") && (document.getElementById("totalPedidosDash").innerText = pedidosPagos.length);

        // Reusa clientes e produtos já carregados
        const clientesAtivos = clientes.length > 0 ? clientes : await (async () => {
            const res = await adminFetch(`${API_URL}/admin/clientes`);
            const data = res.ok ? await res.json() : [];
            clientes = data;
            return data;
        })();
        document.getElementById("clientesAtivosDash") && (document.getElementById("clientesAtivosDash").innerText =
            clientesAtivos.filter(c => (c.status || "ativo") === "ativo").length);

        const produtosAtivos = produtos.length > 0 ? produtos : await (async () => {
            const res = await fetch(`${API_URL}/produtos`);
            const data = res.ok ? await res.json() : [];
            produtos = data;
            return data;
        })();
        document.getElementById("produtosAtivosDash") && (document.getElementById("produtosAtivosDash").innerText =
            produtosAtivos.filter(p => (p.status || "ativo") === "ativo").length);

        // Histórico mostra todos com scroll (sem limite)
        const historico = document.getElementById("historicoVendasDash");
        if (historico) {
            if (pedidosFiltrados.length === 0) {
                historico.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#999;padding:20px">Nenhum pedido no período selecionado.</td></tr>`;
            } else {
                historico.innerHTML = pedidosFiltrados.map(pedido => `
                    <tr>
                        <td>#${pedido.pedido_id}</td>
                        <td>${pedido.cliente || "-"}</td>
                        <td>${pedido.data || "-"}</td>
                        <td>${formatarMoeda(pedido.total)}</td>
                        <td><span class="status ${String(pedido.status).replaceAll(" ", "-")}">${pedido.status}</span></td>
                    </tr>
                `).join("");
            }
        }
    } catch (e) {
        console.error("Erro ao atualizar dashboard:", e);
    }
}

// Auto-refresh removido a pedido do usuário

// ================= CONFIGURAÇÕES =================
function salvarConfig() {
    const config = {
        nomeLoja: document.getElementById("nomeLoja")?.value || "Lado Doce",
        sloganLoja: document.getElementById("sloganLoja")?.value || "",
        textoHeroLoja: document.getElementById("textoHeroLoja")?.value || "",
        whatsappLoja: document.getElementById("whatsappLoja")?.value || "",
        instagramLoja: document.getElementById("instagramLoja")?.value || "",
        enderecoLoja: document.getElementById("enderecoLoja")?.value || "",
    };
    localStorage.setItem(CHAVE_CONFIG_LOJA, JSON.stringify(config));
    alert("Configurações salvas com sucesso!");
}

function carregarConfig() {
    const config = JSON.parse(localStorage.getItem(CHAVE_CONFIG_LOJA) || "null");
    if (!config) return;
    Object.entries(config).forEach(([chave, valor]) => {
        const campo = document.getElementById(chave);
        if (!campo) return;
        if (campo.type === "checkbox") campo.checked = !!valor;
        else campo.value = valor || "";
    });
}

function exportarDados() {
    const dados = { produtos, pedidos, clientes, exportadoEm: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lado-doce-backup-${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.json`;
    a.click();
}

function limparProdutosDaLoja() {
    carregarProdutos();
}

// ================= INICIALIZAÇÃO =================
document.addEventListener("DOMContentLoaded", () => {
    // Filtros produtos
    document.getElementById("filtroStatusProduto")?.addEventListener("change", aplicarFiltroProdutos);
    document.getElementById("filtroCategoriaProduto")?.addEventListener("change", aplicarFiltroProdutos);
    document.getElementById("filtroBuscaProduto")?.addEventListener("input", aplicarFiltroProdutos);
    document.getElementById("fotoProduto")?.addEventListener("change", () => atualizarPreview("fotoProduto", "previewFotoProduto"));
    document.querySelectorAll('#gradeTamanhosProduto input').forEach(input => {
        input.addEventListener("change", atualizarGradeQtd);
    });
    document.getElementById("fotoHoverProduto")?.addEventListener("change", () => atualizarPreview("fotoHoverProduto", "previewFotoHoverProduto"));

    // Filtros pedidos
    document.querySelector("#pedidos select")?.addEventListener("change", aplicarFiltroPedidos);
    document.querySelector("#pedidos input[type='date']")?.addEventListener("change", aplicarFiltroPedidos);
    document.querySelector("#pedidos input[type='text']")?.addEventListener("input", aplicarFiltroPedidos);

    // Filtros clientes
    document.querySelector("#clientes select")?.addEventListener("change", aplicarFiltroClientes);
    document.querySelector("#clientes input[type='text']")?.addEventListener("input", aplicarFiltroClientes);

    // Dashboard período
    document.getElementById("periodoDashboard")?.addEventListener("change", atualizarDashboard);

    carregarConfig();

    // Só carrega dados se já tiver feito login
    if (getAdminKey()) {
        carregarProdutos();
        carregarClientes();
        carregarPedidosFiltrados();
        carregarAlertasEstoque();
        atualizarDashboard();
    }

});
