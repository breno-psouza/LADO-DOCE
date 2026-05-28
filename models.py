from sqlalchemy import Column, Integer, String, DateTime, Date, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class ConfigFrete(Base):
    __tablename__ = "config_frete"
    id = Column(Integer, primary_key=True)
    regiao = Column(String)
    valor_base = Column(Numeric)
    prazo_dias = Column(Integer)


class ConfigLoja(Base):
    __tablename__ = "config_loja"
    id = Column(Integer, primary_key=True)
    cep_loja = Column(String)
    frete_gratis_valor = Column(Numeric)


class Usuarios(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    cep = Column(String, nullable=False)
    rua = Column(String, nullable=False)
    uf = Column(String, nullable=False)
    numero = Column(String, nullable=False)
    complemento = Column(String, nullable=True)
    senha = Column(String, nullable=False)
    telefone = Column(String, nullable=False)
    data_nascimento = Column(Date, nullable=False)
    cpf = Column(String, nullable=True)
    status = Column(String, default="ativo")  # ← NOVO: ativo | bloqueado


class CodigoLogin(Base):
    __tablename__ = "codigos_login"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    codigo = Column(String, nullable=False)
    expiracao = Column(DateTime, nullable=False)


class Produto(Base):
    __tablename__ = "produtos"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    descricao = Column(String)
    preco = Column(Numeric(10, 2), nullable=False)
    imagem_url = Column(String)
    imagem_hover_url = Column(String, default="")
    categoria = Column(String)
    status = Column(String, default="ativo")  
    estoque = relationship("Estoque", back_populates="produto", cascade="all, delete")


class Estoque(Base):
    __tablename__ = "estoque"
    id = Column(Integer, primary_key=True, index=True)
    produto_id = Column(Integer, ForeignKey("produtos.id", ondelete="CASCADE"))
    tamanho = Column(String, nullable=False)
    cor = Column(String, nullable=False)
    quantidade = Column(Integer, default=0)
    sku = Column(String, unique=True)
    produto = relationship("Produto", back_populates="estoque")


class Carrinho(Base):
    __tablename__ = "carrinho"
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, nullable=False)
    estoque_id = Column(Integer, ForeignKey("estoque.id", ondelete="SET NULL"), nullable=True)
    quantidade = Column(Integer, default=1)


class Pedido(Base):
    __tablename__ = "pedidos"
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, nullable=False)
    total = Column(Numeric(10, 2), default=0)
    status = Column(String, default="pendente")
    criado_em = Column(DateTime, default=datetime.utcnow)
    frete_valor = Column(Numeric(10, 2), default=0)
    frete_tipo = Column(String)
    frete_prazo = Column(String)
    mp_preference_id = Column(String(255), nullable=True)
    metodo_pagamento = Column(String, nullable=True)  # ex: "boleto", "credit_card", "debit_card"


class PedidoItem(Base):
    __tablename__ = "pedido_itens"
    id = Column(Integer, primary_key=True, index=True)
    pedido_id = Column(Integer, ForeignKey("pedidos.id"))
    estoque_id = Column(Integer, nullable=False)
    quantidade = Column(Integer, nullable=False)
    preco_unitario = Column(Numeric(10, 2), nullable=False)

class RecuperacaoSenha(Base):
    __tablename__ = "recuperacao_senha"
    id        = Column(Integer, primary_key=True, index=True)
    email     = Column(String(255), nullable=False)
    codigo    = Column(String(6),   nullable=False)
    expiracao = Column(DateTime,    nullable=False)

