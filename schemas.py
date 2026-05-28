# schemas.py
from pydantic import BaseModel
from typing import Optional, List

class usuario_cadastro(BaseModel):
    nome: str
    email: str
    cep: str
    rua: str
    uf: str
    numero: str
    complemento: Optional[str] = None
    senha: str
    confirmar_senha: str
    telefone: str           
    data_nascimento: str
    cpf: Optional[str] = None  

class EstoqueSchema(BaseModel):
    tamanho: str
    cor: str
    quantidade: int

class ProdutoCreate(BaseModel):
    nome: str
    descricao: str
    preco: float
    categoria: str
    imagem_url: Optional[str] = None
    imagem_hover_url: str = ""
    variacoes: List[EstoqueSchema]

class AlertaItem(BaseModel):
    aviso: str
    produto: str
    detalhe: str
    quantidade_restante: int

class AlertaResposta(BaseModel):
    total_alertas: int
    itens: List[AlertaItem]

class SenhaRedefine(BaseModel):
    email:           str
    codigo:          str
    nova_senha:      str
    confirmar_senha: str