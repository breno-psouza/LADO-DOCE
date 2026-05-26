from schemas import usuario_cadastro, ProdutoCreate, EstoqueSchema, SenhaRedefine
from fastapi import FastAPI, Body, Header, Depends
import secrets
from dotenv import load_dotenv
load_dotenv()
import asyncio
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import random
import bcrypt

import requests
import os
import traceback
import mercadopago
from fastapi import Request
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse

from sqlalchemy.exc import IntegrityError
from database import engine, SessionLocal
import models
from schemas import usuario_cadastro

# ==============================
# APP & DB
# ==============================
app = FastAPI()
models.Base.metadata.create_all(bind=engine)

# ==============================
# CORS
# ==============================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================
# AUTENTICAÇÃO ADMIN
# ==============================
ADMIN_SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "")

def verificar_admin(x_admin_key: str = Header(default=None)):
    from fastapi import HTTPException
    if x_admin_key != ADMIN_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Não autorizado")

# ==============================
# CONFIGURAÇÕES
# ==============================
WHATSAPP_LINK = "https://wa.me/5511960170864"
CEP_LOJA = "04233220"  # Origem: Ipiranga - SP

# Tabela de Frete Fixo baseada em médias reais dos Correios
TABELA_FRETE_UF = {
    "SP": {"valor": 15.90, "prazo": 3},
    "RJ": {"valor": 22.50, "prazo": 5},
    "MG": {"valor": 21.80, "prazo": 5},
    "ES": {"valor": 23.40, "prazo": 6},
    "PR": {"valor": 24.10, "prazo": 5},
    "SC": {"valor": 25.30, "prazo": 6},
    "RS": {"valor": 26.90, "prazo": 7},
    "DF": {"valor": 28.50, "prazo": 5},
    "GO": {"valor": 29.10, "prazo": 6},
    "MT": {"valor": 32.40, "prazo": 8},
    "MS": {"valor": 30.20, "prazo": 7},
    "BA": {"valor": 33.70, "prazo": 8},
    "PE": {"valor": 35.20, "prazo": 9},
    "CE": {"valor": 36.80, "prazo": 9},
    "AL": {"valor": 37.50, "prazo": 10},
    "PB": {"valor": 38.10, "prazo": 10},
    "RN": {"valor": 39.40, "prazo": 10},
    "SE": {"valor": 37.90, "prazo": 10},
    "MA": {"valor": 42.30, "prazo": 12},
    "PI": {"valor": 41.50, "prazo": 12},
    "AM": {"valor": 48.90, "prazo": 15},
    "PA": {"valor": 46.20, "prazo": 14},
    "AC": {"valor": 52.10, "prazo": 18},
    "RO": {"valor": 49.50, "prazo": 16},
    "RR": {"valor": 55.40, "prazo": 20},
    "TO": {"valor": 38.60, "prazo": 11},
    "AP": {"valor": 51.30, "prazo": 19},
}

# ==============================
# FUNÇÕES AUXILIARES
# ==============================
def criptografar_senha(senha):
    salt = bcrypt.gensalt()
    senha_hash = bcrypt.hashpw(senha.encode('utf-8'), salt)
    return senha_hash.decode('utf-8')

def tratar_data(data_str):
    formatos = ["%Y-%m-%d", "%d/%m/%Y", "%d%m%Y"]
    for f in formatos:
        try:
            return datetime.strptime(data_str, f).date()
        except:
            continue
    raise ValueError("Formato de data inválido")

def enviar_email(codigo, destinatario):
    html_content = f"""
    <html>
        <body style="margin: 0; padding: 0; font-family: sans-serif; background-color: #f4f4f4;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff;">
                <tr>
                    <td align="center" style="padding: 40px 0 30px 0;">
                        <strong style="font-size: 24px;">Lado Doce</strong>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 20px 30px 40px 30px; text-align: center;">
                        <h2 style="color: #333333;">Sua chave de acesso é</h2>
                        <p style="color: #666666; font-size: 16px;">Oi! Você solicitou uma chave de acesso. Aqui está o seu código:</p>
                        
                        <div style="background-color: #eeeeee; padding: 20px; display: inline-block; border-radius: 5px; margin: 20px 0;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #000000;">{codigo}</span>
                        </div>
                        
                        <p style="color: #999999; font-size: 12px; margin-top: 30px;">
                            Se você não solicitou este código, ignore este e-mail.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 30px; background-color: #000000; color: #ffffff; text-align: center; font-size: 14px;">
                        <strong>Lado Doce</strong>
                    </td>
                </tr>
            </table>
        </body>
    </html>
    """

    try:
        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={
                "api-key": os.getenv("BREVO_API_KEY"),
                "Content-Type": "application/json"
            },
            json={
                "sender": {"name": "Lado Doce", "email": "brenopsouza75@gmail.com"},
                "to": [{"email": destinatario}],
                "subject": f"Sua chave de acesso é {codigo}",
                "htmlContent": html_content
            }
        )
        print("E-mail enviado com sucesso!", response.status_code)
    except Exception as e:
        print("Erro ao enviar email:", e)

def buscar_cep(cep):
    try:
        cep = cep.replace("-", "").strip()
        response = requests.get(f"https://viacep.com.br/ws/{cep}/json/")
        if response.status_code != 200: return None
        data = response.json()
        if "erro" in data: return None
        return {
            "cep": data.get("cep"),
            "logradouro": data.get("logradouro"),
            "bairro": data.get("bairro"),
            "localidade": data.get("localidade"),
            "uf": data.get("uf")
        }
    except Exception as e:
        print("Erro ao buscar CEP:", e)
        return None

# ==============================
# ROTAS
# ==============================

@app.get("/")
def home():
    return RedirectResponse(url="/static/index.html")

@app.post("/cadastrar")
def cadastrar(usuario: usuario_cadastro):
    if usuario.senha != usuario.confirmar_senha:
        return {"erro": "As senhas não coincidem!"}
    db = SessionLocal()
    email = usuario.email.lower()
    if db.query(models.Usuarios).filter(models.Usuarios.email == email).first():
        db.close()
        return {"erro": "Email já cadastrado"}
    try:
        data_convertida = tratar_data(usuario.data_nascimento)
    except ValueError as e:
        db.close()
        return {"erro": str(e)}
    senha_hash = criptografar_senha(usuario.senha)
    novo_usuario = models.Usuarios(
        nome=usuario.nome, email=email, cep=usuario.cep, rua=usuario.rua,
        uf=usuario.uf, numero=usuario.numero, complemento=usuario.complemento,
        senha=senha_hash, telefone=usuario.telefone, data_nascimento=data_convertida,
        cpf=usuario.cpf or "" 
    )
    try:
        db.add(novo_usuario)
        db.commit()
        db.refresh(novo_usuario)
        return {
            "msg": "Usuário cadastrado com sucesso",
            "usuario": {
                "id": novo_usuario.id,
                "nome": novo_usuario.nome,
                "email": novo_usuario.email,
                "telefone": novo_usuario.telefone,
                "cep": novo_usuario.cep,
                "rua": novo_usuario.rua,
                "uf": novo_usuario.uf,
                "numero": novo_usuario.numero,
                "complemento": novo_usuario.complemento or ""
            }
        }
    except IntegrityError:
        db.rollback()
        return {"erro": "Erro ao cadastrar"}
    finally:
        db.close()

@app.post("/login")
def login(email: str = Body(..., embed=True), senha: str = Body(..., embed=True)):
    db = SessionLocal()
    usuario = db.query(models.Usuarios).filter(models.Usuarios.email == email.lower()).first()
    db.close()
    if usuario and bcrypt.checkpw(senha.encode(), usuario.senha.encode()):
        return {
            "msg": "Login realizado",
            "usuario": {
                "id": usuario.id,
                "nome": usuario.nome,
                "email": usuario.email,
                "telefone": usuario.telefone,
                "cep": usuario.cep,
                "rua": usuario.rua,
                "uf": usuario.uf,
                "numero": usuario.numero,
                "complemento": usuario.complemento or ""
            }
        }
    return {"erro": "Credenciais inválidas"}

@app.post("/login-email")
def login_email(email: str = Body(..., embed=True)):
    db = SessionLocal()
    db.query(models.CodigoLogin).filter(models.CodigoLogin.email == email).delete()
    codigo = str(random.randint(100000, 999999))
    expiracao = datetime.utcnow() + timedelta(minutes=5)
    db.add(models.CodigoLogin(email=email, codigo=codigo, expiracao=expiracao))
    db.commit()
    enviar_email(codigo, email)
    db.close()
    return {"msg": "Código enviado"}

@app.post("/verificar-codigo")
def verificar_codigo(email: str = Body(..., embed=True), codigo: str = Body(..., embed=True)):
    db = SessionLocal()
    registro = db.query(models.CodigoLogin).filter(
        models.CodigoLogin.email == email,
        models.CodigoLogin.codigo == codigo
    ).first()
    if not registro:
        db.close()
        return {"erro": "Código inválido"}
    if registro.expiracao < datetime.utcnow():
        db.close()
        return {"erro": "Código expirado"}
    db.delete(registro)
    db.commit()

    usuario = db.query(models.Usuarios).filter(models.Usuarios.email == email.lower()).first()
    if not usuario:
        usuario = models.Usuarios(
            nome="",
            email=email.lower(),
            cep="00000000",
            rua="A preencher",
            uf="SP",
            numero="S/N",
            complemento="",
            senha="",
            telefone="",
            data_nascimento=datetime.utcnow().date()
        )
        db.add(usuario)
        db.commit()
        db.refresh(usuario)

    db.close()
    return {
        "msg": "Login autorizado",
        "usuario": {
            "id": usuario.id,
            "nome": usuario.nome,
            "email": usuario.email,
            "telefone": usuario.telefone,
            "cep": usuario.cep,
            "rua": usuario.rua,
            "uf": usuario.uf,
            "numero": usuario.numero,
            "complemento": usuario.complemento or ""
        }
    }

# ---------------------------------------------------------
# FRETE
# ---------------------------------------------------------
@app.post("/calcular-frete")
def calcular_frete(cep: str = Body(..., embed=True)):
    cep_limpo = cep.replace("-", "").strip()
    endereco = buscar_cep(cep_limpo)
    
    if not endereco:
        return {"erro": "CEP inválido ou não encontrado"}

    uf_destino = endereco.get("uf")
    cidade_destino = endereco.get("localidade").upper()
    opcoes = []

    if cidade_destino == "SÃO PAULO":
        opcoes.append({
            "id": "retirada_loja",
            "tipo": "retirada",
            "nome": "Retirada em Loja",
            "valor": 0.0,
            "prazo": "Em até 2 horas",
            "descricao": "Disponível para retirada imediata"
        })

    dados_frete = TABELA_FRETE_UF.get(uf_destino)
    
    if dados_frete:
        if not (uf_destino == "SP" and cidade_destino == "SÃO PAULO"):
            opcoes.append({
                "id": f"entrega_padrao_{uf_destino}",
                "tipo": "entrega",
                "nome": "Entrega Padrão (PAC)",
                "valor": dados_frete["valor"],
                "prazo": f"{dados_frete['prazo']} a {dados_frete['prazo'] + 2} dias úteis",
                "descricao": "Entrega econômica via Correios"
            })
        
        valor_final_sedex = round(dados_frete["valor"] * 1.4, 2)
        if uf_destino == "SP" and cidade_destino == "SÃO PAULO":
            valor_final_sedex = 12.90

        opcoes.append({
            "id": f"entrega_expressa_{uf_destino}",
            "tipo": "entrega",
            "nome": "Entrega Expressa (SEDEX)",
            "valor": valor_final_sedex,
            "prazo": f"{max(1, dados_frete['prazo'] // 2)} a {max(2, dados_frete['prazo'] // 2 + 1)} dias úteis",
            "descricao": "Entrega rápida via Correios"
        })

    opcoes.append({
        "id": "suporte_whats",
        "tipo": "whatsapp",
        "nome": "Combinar outra forma",
        "valor": None,
        "link": WHATSAPP_LINK,
        "descricao": "Dúvidas sobre frete? Chame no WhatsApp"
    })

    opcoes_ordenadas = sorted(opcoes, key=lambda x: (x['tipo'] != 'retirada', x.get('valor') or 999))

    return {
        "endereco": endereco, 
        "opcoes_entrega": opcoes_ordenadas
    }

# ==============================
# GESTÃO DE ESTOQUE E PRODUTOS
# ==============================
from schemas import usuario_cadastro, ProdutoCreate, EstoqueSchema
from typing import List

@app.get("/produtos")
def listar_produtos():
    db = SessionLocal()
    try:
        produtos = db.query(models.Produto).all()
        resultado = []
        for p in produtos:
            variacoes = db.query(models.Estoque).filter(models.Estoque.produto_id == p.id).all()
            total_estoque = sum(v.quantidade for v in variacoes) 
            resultado.append({
                "id": p.id,
                "nome": p.nome,
                "descricao": p.descricao,
                "preco": float(p.preco),
                "categoria": p.categoria,
                "imagem_url": p.imagem_url,
                "status": p.status or "ativo", 
                "esgotado": total_estoque == 0,
                "estoque": [
                    {
                        "estoque_id": v.id,
                        "tamanho": v.tamanho,
                        "cor": v.cor,
                        "quantidade": v.quantidade,
                        "sku": v.sku
                    } for v in variacoes
                ]
            })
        return resultado
    finally:
        db.close()

@app.post("/checkout/baixa-estoque")
def processar_venda(estoque_id: int = Body(...), quantidade: int = Body(...)):
    db = SessionLocal()
    try:
        item = db.query(models.Estoque).filter(models.Estoque.id == estoque_id).first()
        if not item:
            return {"erro": "Variação de produto não encontrada"}
        if item.quantidade < quantidade:
            return {"erro": "Estoque insuficiente para esta cor/tamanho"}
        item.quantidade -= quantidade
        db.commit()
        return {"msg": "Estoque atualizado com sucesso", "restante": item.quantidade}
    except Exception as e:
        db.rollback()
        return {"erro": str(e)}
    finally:
        db.close()

@app.get("/admin/pesquisar-produto/{produto_id}", dependencies=[Depends(verificar_admin)])
def pesquisar_produto_admin(produto_id: int):
    db = SessionLocal()
    try:
        produto = db.query(models.Produto).filter(models.Produto.id == produto_id).first()
        if not produto:
            return {"erro": "Produto não encontrado"}
        return {
            "id": produto.id,
            "nome": produto.nome,
            "imagem": produto.imagem_url,
            "preco": float(produto.preco),
            "variacoes": [
                {
                    "estoque_id": v.id,
                    "tamanho": v.tamanho,
                    "cor": v.cor,
                    "quantidade": v.quantidade
                } for v in produto.estoque
            ]
        }
    finally:
        db.close()

@app.get("/estoque/{estoque_id}")
def consultar_estoque(estoque_id: int):
    """Retorna a quantidade atual de uma variação de estoque (usado pelo frontend em tempo real)."""
    db = SessionLocal()
    try:
        estoque = db.query(models.Estoque).filter(models.Estoque.id == estoque_id).first()
        if not estoque:
            return {"erro": "Estoque não encontrado"}
        return {"estoque_id": estoque_id, "quantidade": estoque.quantidade}
    finally:
        db.close()

@app.patch("/admin/estoque/repor", dependencies=[Depends(verificar_admin)])
def repor_estoque(estoque_id: int = Body(...), quantidade_adicional: int = Body(...)):
    db = SessionLocal()
    try:
        item = db.query(models.Estoque).filter(models.Estoque.id == estoque_id).first()
        if not item:
            return {"erro": "Variação de estoque não encontrada"}
        item.quantidade += quantidade_adicional
        db.commit()
        db.refresh(item)
        return {
            "msg": "Estoque atualizado com sucesso!",
            "produto": item.produto.nome,
            "nova_quantidade": item.quantidade
        }
    except Exception as e:
        db.rollback()
        return {"erro": str(e)}
    finally:
        db.close()

@app.get("/admin/alertas-producao", dependencies=[Depends(verificar_admin)])
def alertas_producao():
    db = SessionLocal()
    try:
        LIMITE_CRITICO = 5
        itens_baixos = (
            db.query(models.Estoque)
            .filter(models.Estoque.quantidade <= LIMITE_CRITICO)
            .all()
        )
        lista_alertas = []
        for item in itens_baixos:
            produto = db.query(models.Produto).filter(
                models.Produto.id == item.produto_id
            ).first()
            lista_alertas.append({
                "aviso": "⚠️ PRODUZIR MAIS",
                "produto": produto.nome if produto else "Produto desconhecido",
                "detalhe": f"{item.cor} / {item.tamanho}",
                "quantidade_restante": item.quantidade
            })
        return {
            "total_alertas": len(lista_alertas),
            "itens": lista_alertas
        }
    finally:
        db.close()

# ==============================
# CARRINHO
# ==============================
@app.post("/carrinho/adicionar")
def adicionar_carrinho(
    usuario_id: int = Body(...),
    estoque_id: int = Body(...),
    quantidade: int = Body(1)
):
    db = SessionLocal()
    estoque = db.query(models.Estoque).filter(models.Estoque.id == estoque_id).first()
    if not estoque:
        db.close()
        return {"erro": "Variação não encontrada"}
    item = db.query(models.Carrinho).filter(
        models.Carrinho.usuario_id == usuario_id,
        models.Carrinho.estoque_id == estoque_id
    ).first()
    quantidade_atual_carrinho = item.quantidade if item else 0
    if estoque.quantidade < quantidade_atual_carrinho + quantidade:
        db.close()
        return {"erro": f"Estoque insuficiente. Disponível: {max(0, estoque.quantidade - quantidade_atual_carrinho)} unidade(s)"}
    if item:
        item.quantidade += quantidade
    else:
        novo_item = models.Carrinho(
            usuario_id=usuario_id,
            estoque_id=estoque_id,
            quantidade=quantidade
        )
        db.add(novo_item)
    db.commit()
    db.close()
    return {"msg": "Adicionado ao carrinho"}

@app.get("/carrinho/{usuario_id}")
def ver_carrinho(usuario_id: int):
    db = SessionLocal()
    itens = db.query(models.Carrinho).filter(models.Carrinho.usuario_id == usuario_id).all()
    resultado = []
    total = 0
    for item in itens:
        estoque = db.query(models.Estoque).filter(models.Estoque.id == item.estoque_id).first()
        if not estoque:
            continue
        produto = estoque.produto
        preco = float(produto.preco)
        subtotal = preco * item.quantidade
        total += subtotal
        resultado.append({
            "produto_id": produto.id,
            "estoque_id": estoque.id,
            "produto": produto.nome,
            "preco": preco,
            "imagem_url": produto.imagem_url,
            "cor": estoque.cor,
            "tamanho": estoque.tamanho,
            "quantidade": item.quantidade,
            "subtotal": subtotal,
            "estoque_disponivel": estoque.quantidade
        })
    db.close()
    return {"itens": resultado, "total": total}

@app.delete("/carrinho/remover")
def remover_item(
    usuario_id: int = Body(...),
    estoque_id: int = Body(...)
):
    db = SessionLocal()
    item = db.query(models.Carrinho).filter(
        models.Carrinho.usuario_id == usuario_id,
        models.Carrinho.estoque_id == estoque_id
    ).first()
    if not item:
        db.close()
        return {"erro": "Item não encontrado"}
    db.delete(item)
    db.commit()
    db.close()
    return {"msg": "Removido"}

@app.patch("/carrinho/atualizar")
def atualizar_quantidade(
    usuario_id: int = Body(...),
    estoque_id: int = Body(...),
    quantidade: int = Body(...)
):
    db = SessionLocal()
    item = db.query(models.Carrinho).filter(
        models.Carrinho.usuario_id == usuario_id,
        models.Carrinho.estoque_id == estoque_id
    ).first()
    if not item:
        db.close()
        return {"erro": "Item não encontrado"}
    estoque = db.query(models.Estoque).filter(models.Estoque.id == estoque_id).first()
    if quantidade > estoque.quantidade:
        db.close()
        return {"erro": "Estoque insuficiente"}
    if quantidade <= 0:
        db.delete(item)
    else:
        item.quantidade = quantidade
    db.commit()
    db.close()
    return {"msg": "Carrinho atualizado"}

# ==============================
# PEDIDOS
# ==============================
@app.post("/pedido/finalizar")
def finalizar_pedido(
    usuario_id: int = Body(...),
    frete_valor: float = Body(...),
    frete_tipo: str = Body(...),
    frete_prazo: str = Body(...)
):
    """
    Fluxo correto:
    1. Salva pedido no banco com db.flush() para obter o ID
    2. Cria preferência MP com external_reference = pedido.id
    3. Reserva estoque e commita tudo
    4. Limpa o carrinho
    """
    db = SessionLocal()
    try:
        itens_carrinho = db.query(models.Carrinho).filter(models.Carrinho.usuario_id == usuario_id).all()
        if not itens_carrinho:
            return {"erro": "Carrinho vazio"}

        usuario = db.query(models.Usuarios).filter(models.Usuarios.id == usuario_id).first()
        if not usuario:
            return {"erro": "Usuário não encontrado"}

        # Verifica estoque com lock para evitar race condition
        for item in itens_carrinho:
            estoque = db.query(models.Estoque).filter(
                models.Estoque.id == item.estoque_id
            ).with_for_update().first()
            if not estoque or estoque.quantidade < item.quantidade:
                nome = estoque.produto.nome if estoque else "item"
                return {"erro": f"Estoque insuficiente: {nome}. Atualize sua sacola e tente novamente."}

        # Calcula total
        total = 0
        itens_info = []
        for item in itens_carrinho:
            estoque = db.query(models.Estoque).filter(models.Estoque.id == item.estoque_id).first()
            preco = float(estoque.produto.preco)
            total += preco * item.quantidade
            itens_info.append({
                "estoque_id": estoque.id,
                "nome": estoque.produto.nome,
                "tamanho": estoque.tamanho,
                "imagem": estoque.produto.imagem_url or "",
                "quantidade": item.quantidade,
                "preco": preco
            })
        total_com_frete = total + frete_valor

        # PASSO 1: Salva o pedido primeiro para ter o ID (sem commitar ainda)
        pedido = models.Pedido(
            usuario_id=usuario_id,
            total=total_com_frete,
            status="aguardando_pagamento",
            frete_valor=frete_valor,
            frete_tipo=frete_tipo,
            frete_prazo=frete_prazo,
            mp_preference_id=""
        )
        db.add(pedido)
        db.flush()  # gera pedido.id sem commitar

        # PASSO 2: Cria preferência no MP com external_reference = pedido.id
        itens_mp = []
        for info in itens_info:
            itens_mp.append({
                "title": f"{info['nome']} | Tam: {info['tamanho']}",
                "quantity": info["quantidade"],
                "currency_id": "BRL",
                "unit_price": info["preco"],
                "picture_url": info["imagem"]
            })
        if frete_valor > 0:
            itens_mp.append({
                "title": "Frete",
                "quantity": 1,
                "currency_id": "BRL",
                "unit_price": frete_valor
            })

        preference_data = {
            "items": itens_mp,
            "external_reference": str(pedido.id),
            "payer": {
                "email": usuario.email,
                "first_name": usuario.nome.split()[0],
                "last_name": " ".join(usuario.nome.split()[1:]) or ".",
                "identification": {
                    "type": "CPF",
                    "number": (usuario.cpf or "").replace(".", "").replace("-", "")
                }
            },
            "back_urls": {
                "success": f"{BASE_URL}/static/compracerta.html",
                "failure": f"{BASE_URL}/static/compraerrada.html",
                "pending": f"{BASE_URL}/static/aguardando-pagamento.html"
            },
            "notification_url": f"{BASE_URL}/pagamento/webhook",
            "metadata": {"usuario_id": usuario_id, "pedido_id": pedido.id},
            "payment_methods": {
                "excluded_payment_types": [{"id": "bank_transfer"}],
                "installments": 1
            },
            "binary_mode": False
        }

        result = sdk.preference().create(preference_data)
        print(f"[MP] status: {result.get('status')} | preference_id: {result.get('response', {}).get('id')}")

        if "response" not in result or not result["response"].get("init_point"):
            db.rollback()
            return {"erro": "Erro ao criar preferência no Mercado Pago. Tente novamente."}

        link = result["response"]["init_point"]
        preference_id = result["response"]["id"]
        pedido.mp_preference_id = preference_id

        # PASSO 3: Salva itens e reserva estoque
        for info in itens_info:
            db.add(models.PedidoItem(
                pedido_id=pedido.id,
                estoque_id=info["estoque_id"],
                quantidade=info["quantidade"],
                preco_unitario=info["preco"]
            ))
            db.query(models.Estoque).filter(
                models.Estoque.id == info["estoque_id"]
            ).update(
                {"quantidade": models.Estoque.quantidade - info["quantidade"]},
                synchronize_session=False
            )

        db.commit()

        # PASSO 4: Limpa o carrinho do banco
        db.query(models.Carrinho).filter(models.Carrinho.usuario_id == usuario_id).delete()
        db.commit()

        return {
            "msg": "Pedido criado com sucesso",
            "pedido_id": pedido.id,
            "total": float(pedido.total),
            "link": link,
            "preference_id": preference_id
        }
    except Exception as e:
        db.rollback()
        print(f"[ERRO finalizar_pedido] {e}")
        return {"erro": str(e)}
    finally:
        db.close()

@app.get("/pedido/detalhe/{pedido_id}")
def detalhe_pedido(pedido_id: int):
    db = SessionLocal()
    pedido = db.query(models.Pedido).filter(models.Pedido.id == pedido_id).first()
    if not pedido:
        db.close()
        return {"erro": "Pedido não encontrado"}
    itens = db.query(models.PedidoItem).filter(models.PedidoItem.pedido_id == pedido_id).all()
    lista_itens = []
    for item in itens:
        estoque = db.query(models.Estoque).filter(models.Estoque.id == item.estoque_id).first()
        produto = estoque.produto if estoque else None
        lista_itens.append({
            "produto": produto.nome if produto else "Produto removido",
            "imagem_url": produto.imagem_url if produto else "",
            "cor": estoque.cor if estoque else "-",
            "tamanho": estoque.tamanho if estoque else "-",
            "quantidade": item.quantidade,
            "preco_unitario": float(item.preco_unitario),
            "subtotal": float(item.preco_unitario) * item.quantidade
        })
    db.close()
    return {
        "pedido_id": pedido.id,
        "status": pedido.status,
        "total": float(pedido.total),
        "frete": {
            "tipo": pedido.frete_tipo,
            "valor": float(pedido.frete_valor),
            "prazo": pedido.frete_prazo
        },
        "data": pedido.criado_em.strftime("%d/%m/%Y %H:%M"),
        "itens": lista_itens
    }

@app.get("/pedido/{usuario_id}")
def listar_pedidos(usuario_id: int):
    """
    CORREÇÃO: Agora todo pedido no banco já tem mp_preference_id (criado atomicamente).
    - aguardando_pagamento = aguardando cartão/débito (expira em 30 min)
    - aguardando_boleto    = boleto emitido (expira em 3 dias úteis)
    - Ambos aparecem pro usuário; apenas 'cancelado' some da lista principal
    """
    db = SessionLocal()
    pedidos = db.query(models.Pedido).filter(
        models.Pedido.usuario_id == usuario_id
    ).order_by(models.Pedido.criado_em.desc()).all()
    VISIVEL = {"pago", "enviado", "entregue", "cancelado", "aguardando_boleto"}
    # "expirado" = timeout do sistema → NÃO aparece pro cliente
    # "cancelado" = admin/MP cancelou → aparece pro cliente
    resultado = []
    for p in pedidos:
        # Só mostra pedidos com status final ou boleto emitido.
        # aguardando_pagamento fica oculto até o MP confirmar.
        if p.status not in VISIVEL:
            continue
        resultado.append({
            "pedido_id": p.id,
            "total": float(p.total),
            "status": p.status,
            "metodo_pagamento": p.metodo_pagamento or "",
            "data": p.criado_em.strftime("%d/%m/%Y %H:%M")
        })
    db.close()
    return resultado

@app.patch("/pedido/status")
def atualizar_status(
    pedido_id: int = Body(...),
    novo_status: str = Body(...)
):
    db = SessionLocal()
    try:
        pedido = db.query(models.Pedido).filter(models.Pedido.id == pedido_id).first()
        if not pedido:
            return {"erro": "Pedido não encontrado"}
        transicoes_validas = {
            "aguardando_pagamento": ["cancelado"],
            "pendente": ["pago", "cancelado"],
            "pago": ["enviado", "cancelado"],
            "enviado": ["entregue"],
            "entregue": [],
            "cancelado": []
        }
        if novo_status not in transicoes_validas[pedido.status]:
            return {"erro": f"Não pode mudar de {pedido.status} para {novo_status}"}
        pedido.status = novo_status
        db.commit()
        return {"msg": "Status atualizado"}
    except Exception as e:
        db.rollback()
        return {"erro": str(e)}
    finally:
        db.close()

# ======================================================
# ADMIN — ROTAS NOVAS (adicionar produto, editar,
#         remover, listar todos pedidos, listar clientes)
# ======================================================

@app.post("/admin/produto", dependencies=[Depends(verificar_admin)])
def criar_produto(produto: ProdutoCreate):
    db = SessionLocal()
    try:
        novo = models.Produto(
            nome=produto.nome,
            descricao=produto.descricao,
            preco=produto.preco,
            categoria=produto.categoria,
            imagem_url=produto.imagem_url or ""
        )
        db.add(novo)
        db.commit()
        db.refresh(novo)
        for v in produto.variacoes:
            estoque = models.Estoque(
                produto_id=novo.id,
                tamanho=v.tamanho,
                cor=v.cor,
                quantidade=v.quantidade
            )
            db.add(estoque)
        db.commit()
        return {"msg": "Produto criado com sucesso", "id": novo.id}
    except Exception as e:
        db.rollback()
        return {"erro": str(e)}
    finally:
        db.close()

@app.put("/admin/produto/{produto_id}", dependencies=[Depends(verificar_admin)])
def editar_produto(produto_id: int, produto: ProdutoCreate):
    db = SessionLocal()
    try:
        p = db.query(models.Produto).filter(models.Produto.id == produto_id).first()
        if not p:
            return {"erro": "Produto não encontrado"}
        p.nome = produto.nome
        p.descricao = produto.descricao
        p.preco = produto.preco
        p.categoria = produto.categoria
        if produto.imagem_url:
            p.imagem_url = produto.imagem_url
        # Remove variações antigas e recria
        db.query(models.Estoque).filter(models.Estoque.produto_id == produto_id).delete()
        for v in produto.variacoes:
            estoque = models.Estoque(
                produto_id=produto_id,
                tamanho=v.tamanho,
                cor=v.cor,
                quantidade=v.quantidade
            )
            db.add(estoque)
        db.commit()
        return {"msg": "Produto atualizado com sucesso"}
    except Exception as e:
        db.rollback()
        return {"erro": str(e)}
    finally:
        db.close()

@app.delete("/admin/produto/{produto_id}", dependencies=[Depends(verificar_admin)])
def deletar_produto(produto_id: int):
    db = SessionLocal()
    try:
        db.query(models.Estoque).filter(models.Estoque.produto_id == produto_id).delete()
        p = db.query(models.Produto).filter(models.Produto.id == produto_id).first()
        if not p:
            return {"erro": "Produto não encontrado"}
        db.delete(p)
        db.commit()
        return {"msg": "Produto removido"}
    except Exception as e:
        db.rollback()
        return {"erro": str(e)}
    finally:
        db.close()

@app.get("/admin/pedidos", dependencies=[Depends(verificar_admin)])
def listar_todos_pedidos():
    db = SessionLocal()
    try:
        pedidos = db.query(models.Pedido).order_by(models.Pedido.criado_em.desc()).all()
        resultado = []
        for p in pedidos:
            usuario = db.query(models.Usuarios).filter(models.Usuarios.id == p.usuario_id).first()
            itens = db.query(models.PedidoItem).filter(models.PedidoItem.pedido_id == p.id).all()
            lista_itens = []
            for item in itens:
                estoque = db.query(models.Estoque).filter(models.Estoque.id == item.estoque_id).first()
                produto = estoque.produto if estoque else None
                lista_itens.append({
                    "produto": produto.nome if produto else "Removido",
                    "tamanho": estoque.tamanho if estoque else "-",
                    "cor": estoque.cor if estoque else "-",
                    "quantidade": item.quantidade,
                    "subtotal": float(item.preco_unitario) * item.quantidade
                })
            resultado.append({
                "pedido_id": p.id,
                "cliente": usuario.nome if usuario else "-",
                "email": usuario.email if usuario else "-",
                "telefone": usuario.telefone if usuario else "-",
                "endereco_entrega": {
                    "rua": usuario.rua if usuario else "-",
                    "numero": usuario.numero if usuario else "-",
                    "complemento": usuario.complemento if usuario else "",
                    "cep": usuario.cep if usuario else "-",
                    "uf": usuario.uf if usuario else "-",
                } if usuario else None,
                "total": float(p.total),
                "status": p.status,
                "data": p.criado_em.strftime("%d/%m/%Y %H:%M"),
                "frete": {
                    "tipo": p.frete_tipo,
                    "valor": float(p.frete_valor),
                    "prazo": p.frete_prazo
                },
                "itens": lista_itens
            })
        return resultado
    finally:
        db.close()

@app.get("/admin/clientes", dependencies=[Depends(verificar_admin)])
def listar_clientes():
    db = SessionLocal()
    try:
        usuarios = db.query(models.Usuarios).all()
        resultado = []
        for u in usuarios:
            pedidos = db.query(models.Pedido).filter(
                models.Pedido.usuario_id == u.id,
                models.Pedido.status != "cancelado"
            ).all()
            total_gasto = sum(float(p.total or 0) for p in pedidos)

            resultado.append({
                "id": u.id,
                "nome": u.nome,
                "email": u.email,
                "telefone": u.telefone,
                "cpf": u.cpf or "",
                "cep": u.cep,
                "rua": u.rua,
                "numero": u.numero,
                "uf": u.uf,
                "complemento": u.complemento or "",
                "total_gasto": total_gasto,
                "status": u.status or "ativo"
            })
        return resultado
    finally:
        db.close()

@app.patch("/usuario/{usuario_id}")
def atualizar_usuario(
    usuario_id: int,
    nome: str = Body("", embed=True),
    telefone: str = Body("", embed=True),
    cep: str = Body("00000000", embed=True),
    rua: str = Body("A preencher", embed=True),
    numero: str = Body("S/N", embed=True),
    complemento: str = Body("", embed=True),
    uf: str = Body("SP", embed=True)
):
    db = SessionLocal()
    try:
        usuario = db.query(models.Usuarios).filter(models.Usuarios.id == usuario_id).first()
        if not usuario:
            return {"erro": "Usuário não encontrado"}
        if nome: usuario.nome = nome
        if telefone: usuario.telefone = telefone
        if cep: usuario.cep = cep
        if rua: usuario.rua = rua
        if numero: usuario.numero = numero
        usuario.complemento = complemento
        if uf: usuario.uf = uf
        db.commit()
        return {"msg": "Dados atualizados com sucesso"}
    except Exception as e:
        db.rollback()
        return {"erro": str(e)}
    finally:
        db.close()

@app.patch("/admin/produto/{produto_id}/status", dependencies=[Depends(verificar_admin)])
def atualizar_status_produto(produto_id: int, status: str = Body(..., embed=True)):
    db = SessionLocal()
    try:
        p = db.query(models.Produto).filter(models.Produto.id == produto_id).first()
        if not p:
            return {"erro": "Produto não encontrado"}
        p.status = status
        db.commit()
        return {"msg": "Status atualizado"}
    except Exception as e:
        db.rollback()
        return {"erro": str(e)}
    finally:
        db.close()

@app.patch("/admin/cliente/{usuario_id}/status", dependencies=[Depends(verificar_admin)])
def atualizar_status_cliente(usuario_id: int, status: str = Body(..., embed=True)):
    db = SessionLocal()
    try:
        u = db.query(models.Usuarios).filter(models.Usuarios.id == usuario_id).first()
        if not u:
            return {"erro": "Cliente não encontrado"}
        u.status = status
        db.commit()
        return {"msg": "Status atualizado"}
    except Exception as e:
        db.rollback()
        return {"erro": str(e)}
    finally:
        db.close()

#ESQUECI SENHA
def enviar_email_recuperacao(codigo: str, destinatario: str):
    html_content = f"""
    <html>
        <body style="margin:0;padding:0;font-family:sans-serif;background-color:#f4f4f4;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600"
                   style="border-collapse:collapse;background-color:#ffffff;">
                <tr>
                    <td align="center" style="padding:40px 0 30px 0;">
                        <strong style="font-size:24px;">Lado Doce</strong>
                    </td>
                </tr>
                <tr>
                    <td style="padding:20px 30px 40px 30px;text-align:center;">
                        <h2 style="color:#333333;">Redefinição de Senha</h2>
                        <p style="color:#666666;font-size:16px;">
                            Recebemos uma solicitação para redefinir sua senha.<br>
                            Use o código abaixo — ele expira em <strong>15 minutos</strong>.
                        </p>
                        <div style="background-color:#eeeeee;padding:20px;display:inline-block;
                                    border-radius:5px;margin:20px 0;">
                            <span style="font-size:32px;font-weight:bold;
                                         letter-spacing:5px;color:#000000;">{codigo}</span>
                        </div>
                        <p style="color:#999999;font-size:12px;margin-top:30px;">
                            Se você não solicitou a redefinição, ignore este e-mail.
                            Sua senha permanece a mesma.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="padding:30px;background-color:#000000;color:#ffffff;
                               text-align:center;font-size:14px;">
                        <strong>Lado Doce</strong>
                    </td>
                </tr>
            </table>
        </body>
    </html>
    """

    try:
        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={
                "api-key": os.getenv("BREVO_API_KEY"),
                "Content-Type": "application/json"
            },
            json={
                "sender": {"name": "Lado Doce", "email": "brenopsouza75@gmail.com"},
                "to": [{"email": destinatario}],
                "subject": f"Redefinição de senha — código {codigo}",
                "htmlContent": html_content
            }
        )
        print("E-mail de recuperação enviado com sucesso!", response.status_code)
    except Exception as e:
        print("Erro ao enviar e-mail de recuperação:", e)

@app.post("/esqueci-senha")
def esqueci_senha(email: str = Body(..., embed=True)):
    
    db = SessionLocal()
    try:
        usuario = db.query(models.Usuarios).filter(
            models.Usuarios.email == email.lower()
        ).first()
        if not usuario:
            return {"msg": "Se esse e-mail estiver cadastrado, você receberá um código em breve."}

        db.query(models.RecuperacaoSenha).filter(
            models.RecuperacaoSenha.email == email.lower()
        ).delete()

        codigo    = str(random.randint(100000, 999999))
        expiracao = datetime.utcnow() + timedelta(minutes=15)

        db.add(models.RecuperacaoSenha(
            email=email.lower(),
            codigo=codigo,
            expiracao=expiracao
        ))
        db.commit()

        enviar_email_recuperacao(codigo, email)
        return {"msg": "Se esse e-mail estiver cadastrado, você receberá um código em breve."}

    except Exception as e:
        db.rollback()
        return {"erro": str(e)}
    finally:
        db.close()

@app.post("/verificar-codigo-senha")
def verificar_codigo_senha(
    email:  str = Body(..., embed=True),
    codigo: str = Body(..., embed=True)
):
    db = SessionLocal()
    try:
        registro = db.query(models.RecuperacaoSenha).filter(
            models.RecuperacaoSenha.email  == email.lower(),
            models.RecuperacaoSenha.codigo == codigo
        ).first()

        if not registro:
            return {"erro": "Código inválido."}

        if registro.expiracao < datetime.utcnow():
            db.delete(registro)
            db.commit()
            return {"erro": "Código expirado. Solicite um novo."}

        return {"valido": True}

    finally:
        db.close()

@app.post("/redefinir-senha")
def redefinir_senha(dados: SenhaRedefine):
    db = SessionLocal()
    try:
        if dados.nova_senha != dados.confirmar_senha:
            return {"erro": "As senhas não coincidem."}

        if len(dados.nova_senha) < 6:
            return {"erro": "A senha deve ter pelo menos 6 caracteres."}

        registro = db.query(models.RecuperacaoSenha).filter(
            models.RecuperacaoSenha.email  == dados.email.lower(),
            models.RecuperacaoSenha.codigo == dados.codigo
        ).first()

        if not registro:
            return {"erro": "Código inválido."}

        if registro.expiracao < datetime.utcnow():
            db.delete(registro)
            db.commit()
            return {"erro": "Código expirado. Solicite um novo."}

        usuario = db.query(models.Usuarios).filter(
            models.Usuarios.email == dados.email.lower()
        ).first()

        if not usuario:
            return {"erro": "Usuário não encontrado."}

        usuario.senha = criptografar_senha(dados.nova_senha)

        db.delete(registro)
        db.commit()

        return {"msg": "Senha redefinida com sucesso!"}

    except Exception as e:
        db.rollback()
        return {"erro": str(e)}
    finally:
        db.close()


# ==============================
# ALERTAS DE PRODUCAO
# ==============================
@app.get("/admin/alertas-producao", dependencies=[Depends(verificar_admin)])
def alertas_producao():
    """
    Retorna itens de estoque abaixo do limite critico (padrao: 3 unidades).
    Usado pelo painel admin para alertar sobre reposicao necessaria.
    """
    db = SessionLocal()
    try:
        LIMITE_CRITICO = 3

        estoques = db.query(models.Estoque).all()
        alertas = []

        for e in estoques:
            if e.quantidade <= LIMITE_CRITICO:
                produto = db.query(models.Produto).filter(
                    models.Produto.id == e.produto_id
                ).first()
                nome = produto.nome if produto else "Produto removido"

                if e.quantidade == 0:
                    aviso = "🔴 SEM ESTOQUE"
                elif e.quantidade <= 1:
                    aviso = "🔴 CRÍTICO"
                else:
                    aviso = "🟠 ESTOQUE BAIXO"

                alertas.append({
                    "produto":            nome,
                    "aviso":              aviso,
                    "detalhe":            f"Tamanho {e.tamanho} · {e.cor}",
                    "quantidade_restante": e.quantidade,
                    "estoque_id":         e.id
                })

        return {
            "total_alertas": len(alertas),
            "itens":         sorted(alertas, key=lambda x: x["quantidade_restante"])
        }
    finally:
        db.close()

#PAGAMENTO A SEGUIR:
MP_ACCESS_TOKEN = os.getenv("MP_ACCESS_TOKEN")
sdk = mercadopago.SDK(MP_ACCESS_TOKEN)
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
 
def enviar_email_pedido_confirmado(destinatario: str, pedido_id: int, total: float):
    html_content = f"""
    <html>
        <body style="margin:0;padding:0;font-family:sans-serif;background-color:#f4f4f4;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600"
                   style="border-collapse:collapse;background-color:#ffffff;">
                <tr>
                    <td align="center" style="padding:40px 0 30px 0;">
                        <strong style="font-size:24px;">Lado Doce</strong>
                    </td>
                </tr>
                <tr>
                    <td style="padding:20px 30px 40px 30px;text-align:center;">
                        <h2 style="color:#333333;">Pedido confirmado! </h2>
                        <p style="color:#666666;font-size:16px;">
                            Seu pagamento foi aprovado e seu pedido já está sendo preparado.
                        </p>
                        <div style="background-color:#eeeeee;padding:20px;
                                    display:inline-block;border-radius:5px;margin:20px 0;">
                            <p style="margin:0;font-size:14px;color:#333;">Pedido nº <strong>{pedido_id}</strong></p>
                            <p style="margin:4px 0 0;font-size:22px;font-weight:bold;color:#000;">
                                R$ {total:.2f}
                            </p>
                        </div>
                        <p style="color:#999999;font-size:12px;margin-top:30px;">
                            Qualquer dúvida, fale conosco pelo WhatsApp.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="padding:30px;background-color:#000000;color:#ffffff;
                               text-align:center;font-size:14px;">
                        <strong>Lado Doce</strong>
                    </td>
                </tr>
            </table>
        </body>
    </html>
    """

    try:
        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={
                "api-key": os.getenv("BREVO_API_KEY"),
                "Content-Type": "application/json"
            },
            json={
                "sender": {"name": "Lado Doce", "email": "brenopsouza75@gmail.com"},
                "to": [{"email": destinatario}],
                "subject": f"Pedido #{pedido_id} confirmado — Lado Doce",
                "htmlContent": html_content
            }
        )
        print(f"E-mail de confirmação enviado para {destinatario}", response.status_code)
    except Exception as e:
        print(f"Erro ao enviar e-mail de confirmação: {e}")
  
@app.post("/pagamento/criar")
def criar_pagamento(
    pedido_id:   int   = Body(...),
    usuario_id:  int   = Body(...),
    total:       float = Body(...),
    frete_valor: float = Body(...)
):
    db = SessionLocal()
    try:
        itens_db = db.query(models.PedidoItem).filter(
            models.PedidoItem.pedido_id == pedido_id
        ).all()
 
        if not itens_db:
            return {"erro": "Pedido sem itens"}
 
        usuario = db.query(models.Usuarios).filter(
            models.Usuarios.id == usuario_id
        ).first()
 
        if not usuario:
            return {"erro": "Usuário não encontrado"}
 
        itens_mp = []
        for item in itens_db:
            estoque = db.query(models.Estoque).filter(
                models.Estoque.id == item.estoque_id
            ).first()
            produto = estoque.produto if estoque else None
            nome = produto.nome if produto else "Produto"
            tamanho = estoque.tamanho if estoque else ""
            imagem = produto.imagem_url if produto else ""
 
            itens_mp.append({
                "title":       f"{nome} | Tam: {tamanho}",
                "quantity":    item.quantidade,
                "currency_id": "BRL",
                "unit_price":  float(item.preco_unitario),
                "picture_url": imagem
            })
 
        if frete_valor > 0:
            itens_mp.append({
                "title":       "Frete",
                "quantity":    1,
                "currency_id": "BRL",
                "unit_price":  frete_valor
            })
 
        preference_data = {
            "items": itens_mp,
            "payer": {
                "email":      usuario.email,
                "first_name": usuario.nome.split()[0],
                "last_name":  " ".join(usuario.nome.split()[1:]) or ".",
                "identification": {
                    "type":   "CPF",
                    "number": (usuario.cpf or "").replace(".", "").replace("-", "")
                }
            },
            "back_urls": {
                "success": f"{BASE_URL}/static/compracerta.html?pedido_id={pedido_id}",
                "failure": f"{BASE_URL}/static/compraerrada.html?pedido_id={pedido_id}",
                "pending": f"{BASE_URL}/static/aguardando-pagamento.html?pedido_id={pedido_id}"
            },
            "notification_url": f"{BASE_URL}/pagamento/webhook",
            "metadata": {
                "pedido_id":  pedido_id,
                "usuario_id": usuario_id
            },
            "payment_methods": {
                "excluded_payment_types": [{"id": "bank_transfer"}],
                "installments": 1
            },
            "binary_mode": False
        }
 
        result = sdk.preference().create(preference_data)
        print(f"[MP] result completo: {result}")

        if "response" not in result:
            return {"erro": "Erro ao criar preferência no Mercado Pago"}
 
        link = result["response"].get("init_point")
        preference_id = result["response"].get("id")
 
        pedido = db.query(models.Pedido).filter(
            models.Pedido.id == pedido_id
        ).first()
        if pedido and hasattr(pedido, 'mp_preference_id'):
            pedido.mp_preference_id = preference_id
            db.commit()
 
        return {"link": link, "preference_id": preference_id}
 
    except Exception as e:
        return {"erro": str(e)}
    finally:
        db.close()
  
@app.post("/pagamento/webhook")
async def webhook_pagamento(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}
 
    topic      = request.query_params.get("topic", "")
    id_param   = request.query_params.get("id", "")
 
    print(f"[Webhook MP] topic={topic} | id={id_param} | body={data}")
 
    if not data and not id_param:
        return JSONResponse(content="OK", status_code=200)
 
    payment_id = None
    if id_param:
        payment_id = id_param
    elif data.get("type") == "payment":
        payment_id = data.get("data", {}).get("id")
    elif "id" in data:
        payment_id = str(data["id"])
 
    is_payment = (
        topic == "payment"
        or data.get("type") == "payment"
        or data.get("action") in ("payment.created", "payment.updated")
    )
 
    if payment_id and is_payment:
        db = SessionLocal()
        try:
            pagamento = sdk.payment().get(payment_id)
 
            if "response" not in pagamento:
                return JSONResponse(content="OK", status_code=200)
 
            resp        = pagamento["response"]
            novo_status = resp.get("status")
            metadata    = resp.get("metadata", {})
            pedido_id   = metadata.get("pedido_id")

            external_ref      = resp.get("external_reference")
            preference_id_pag = resp.get("preference_id") or str(resp.get("order", {}).get("id", ""))
            merchant_order_id = str(resp.get("order", {}).get("id", ""))

            print(f"[Webhook MP] payment_id={payment_id} status={novo_status} pedido_id={pedido_id} preference_id={preference_id_pag}")
            print(f"[Webhook MP] external_ref={external_ref} | preference_id={resp.get('preference_id')} | order={resp.get('order')}")

            pedido = None

            if external_ref:
                try:
                    pedido = db.query(models.Pedido).filter(
                        models.Pedido.id == int(external_ref)
                    ).first()
                    if pedido:
                        print(f"[Webhook MP] Pedido encontrado pelo external_reference: {pedido.id}")
                except:
                    pass

            if not pedido and pedido_id:
                try:
                    pedido = db.query(models.Pedido).filter(
                        models.Pedido.id == int(pedido_id)
                    ).first()
                    if pedido:
                        print(f"[Webhook MP] Pedido encontrado pelo metadata pedido_id: {pedido.id}")
                except:
                    pass

            if not pedido and resp.get("preference_id"):
                pedido = db.query(models.Pedido).filter(
                    models.Pedido.mp_preference_id == resp.get("preference_id")
                ).first()
                if pedido:
                    print(f"[Webhook MP] Pedido encontrado pelo preference_id: {pedido.id}")
            if not pedido and merchant_order_id:
                pedido = db.query(models.Pedido).filter(
                    models.Pedido.mp_preference_id == merchant_order_id
                ).first()
                if pedido:
                    print(f"[Webhook MP] Pedido encontrado pelo merchant_order_id: {pedido.id}")

            if not pedido:
                print(f"[Webhook MP] ATENÇÃO: Pedido NÃO encontrado para payment_id={payment_id} | external_ref={external_ref} | preference_id={resp.get('preference_id')} | merchant_order_id={merchant_order_id}")

            if pedido:
                metodo = resp.get("payment_method_id", "")
                pedido.metodo_pagamento = metodo

                if novo_status == "approved":
                    if pedido.status in ("aguardando_pagamento", "aguardando_boleto", "pendente"):
                        print(f"[Webhook MP] Aprovando pedido {pedido.id} (estava: {pedido.status})")
                        db.query(models.Carrinho).filter(
                            models.Carrinho.usuario_id == pedido.usuario_id
                        ).delete()
                        pedido.status = "pago"
                        db.commit()

                        usuario = db.query(models.Usuarios).filter(
                            models.Usuarios.id == pedido.usuario_id
                        ).first()
                        if usuario:
                            enviar_email_pedido_confirmado(
                                destinatario=usuario.email,
                                pedido_id=pedido.id,
                                total=float(pedido.total)
                            )
                        print(f"[Webhook MP] Pedido {pedido.id} → pago ✅")

                elif novo_status == "pending":
                    if pedido.status in ("aguardando_pagamento", "aguardando_boleto"):
                        pedido.status = "aguardando_boleto"
                        db.commit()
                        print(f"[Webhook MP] Pedido {pedido.id} → aguardando_boleto (método: {metodo})")

                elif novo_status in ("cancelled", "rejected"):
                    if pedido.status in ("aguardando_pagamento", "aguardando_boleto"):
                        itens = db.query(models.PedidoItem).filter(
                            models.PedidoItem.pedido_id == pedido.id
                        ).all()
                        for item in itens:
                            estoque = db.query(models.Estoque).filter(
                                models.Estoque.id == item.estoque_id
                            ).first()
                            if estoque:
                                estoque.quantidade += item.quantidade
                        pedido.status = "cancelado"
                        db.commit()
                        print(f"[Webhook MP] Pedido {pedido.id} → cancelado (status MP: {novo_status})")
 
        except Exception as e:
            print(f"[Webhook MP] Erro: {e}")
            traceback.print_exc()
        finally:
            db.close()
 
    return JSONResponse(content="OK", status_code=200)

@app.get("/pagamento/sucesso")
def pagamento_sucesso(pedido_id: int):
    return {
        "status":    "approved",
        "pedido_id": pedido_id,
        "msg":       "Pagamento aprovado! Seu pedido está sendo preparado."
    }
 
 
@app.get("/pagamento/falha")
def pagamento_falha(pedido_id: int):
    return {
        "status":    "failure",
        "pedido_id": pedido_id,
        "msg":       "Pagamento não aprovado. Tente novamente."
    }
 
 
@app.get("/pagamento/pendente")
def pagamento_pendente(pedido_id: int):
    return {
        "status":    "pending",
        "pedido_id": pedido_id,
        "msg":       "Pagamento pendente. Você receberá um e-mail quando for confirmado."
    }
  
@app.get("/pagamento/status/{pedido_id}")
def status_pedido_pagamento(pedido_id: int):
    db = SessionLocal()
    try:
        pedido = db.query(models.Pedido).filter(
            models.Pedido.id == pedido_id
        ).first()
        if not pedido:
            return {"erro": "Pedido não encontrado"}
        return {"status": pedido.status, "pedido_id": pedido_id}
    finally:
        db.close()

@app.delete("/admin/pedidos/limpar-expirados", dependencies=[Depends(verificar_admin)])
def limpar_pedidos_expirados():
    db = SessionLocal()
    try:
        limite_cartao = datetime.utcnow() - timedelta(minutes=30)
        limite_boleto = datetime.utcnow() - timedelta(days=3)

        expirados_cartao = db.query(models.Pedido).filter(
            models.Pedido.status == "aguardando_pagamento",
            models.Pedido.criado_em < limite_cartao
        ).all()

        expirados_boleto = db.query(models.Pedido).filter(
            models.Pedido.status == "aguardando_boleto",
            models.Pedido.criado_em < limite_boleto
        ).all()

        todos = expirados_cartao + expirados_boleto
        total = len(todos)

        for p in todos:
            itens = db.query(models.PedidoItem).filter(
                models.PedidoItem.pedido_id == p.id
            ).all()
            for item in itens:
                estoque = db.query(models.Estoque).filter(
                    models.Estoque.id == item.estoque_id
                ).first()
                if estoque:
                    estoque.quantidade += item.quantidade
            p.status = "expirado"

        db.commit()
        return {"msg": f"{total} pedido(s) expirado(s) cancelado(s) e estoque devolvido"}
    except Exception as e:
        db.rollback()
        return {"erro": str(e)}
    finally:
        db.close()


# ==============================
# CANCELAMENTO AUTOMÁTICO EM BACKGROUND
# ==============================
async def cancelar_pedidos_expirados_automatico():
    while True:
        await asyncio.sleep(300)
        db = SessionLocal()
        try:
            limite_cartao = datetime.utcnow() - timedelta(minutes=30)
            limite_boleto = datetime.utcnow() - timedelta(days=3)
            expirados = db.query(models.Pedido).filter(
                models.Pedido.status.in_(["aguardando_pagamento", "aguardando_boleto"])
            ).all()
            total_exp = 0
            for p in expirados:
                if p.status == "aguardando_pagamento" and p.criado_em >= limite_cartao:
                    continue
                if p.status == "aguardando_boleto" and p.criado_em >= limite_boleto:
                    continue
                itens = db.query(models.PedidoItem).filter(
                    models.PedidoItem.pedido_id == p.id
                ).all()
                for item in itens:
                    db.query(models.Estoque).filter(
                        models.Estoque.id == item.estoque_id
                    ).update(
                        {"quantidade": models.Estoque.quantidade + item.quantidade},
                        synchronize_session=False
                    )
                p.status = "expirado"
                total_exp += 1
            if total_exp > 0:
                db.commit()
                print(f"[AUTO] {total_exp} pedido(s) marcado(s) como expirado(s) e estoque devolvido")
        except Exception as e:
            db.rollback()
            print(f"[AUTO] Erro: {e}")
        finally:
            db.close()


# ==============================
# LOGIN DO ADMIN
# ==============================
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")


@app.post("/admin/login")
def admin_login(senha: str = Body(..., embed=True)):
    if senha == ADMIN_PASSWORD:
        return {"ok": True}
    return {"ok": False}

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(cancelar_pedidos_expirados_automatico())

# ==============================
# ARQUIVOS ESTÁTICOS DO FRONTEND
# ==============================
import os
from fastapi.staticfiles import StaticFiles

pasta_front = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=pasta_front), name="static")
