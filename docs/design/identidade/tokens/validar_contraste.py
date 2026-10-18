"""Verifica o contraste (WCAG 2.1) dos pares de cores da identidade visual do Health Enterprise — tokens v2 (SPEC-016).
Uso: python3 validar_contraste.py  — termina com "TUDO OK" quando todos os pares passam."""
def L(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def cr(a,b):
    x,y=sorted([L(a),L(b)],reverse=True); return (x+0.05)/(y+0.05)
claro=dict(bg="#eef3f1",card="#ffffff",fg="#12201c",muted="#5a6863",mutedBg="#e4ece8",input="#7a8882",
  primary="#1d6a51",primaryHover="#134e3b",onPrimary="#ffffff",link="#1d6a51",focus="#1d6a51",
  estrutura="#12342c",onEstrutura="#ffffff",estruturaSuave="#a9c2b9",ambar="#f5a524",onAmbar="#1f1500",
  ok="#166534",okBg="#e8f5ec",warn="#8a5a00",warnBg="#fdf6d8",danger="#b42318",dangerBg="#fdeceb",neutro="#84948d")
escuro=dict(bg="#0b1714",card="#12241f",fg="#ecebe7",muted="#a7b0ab",mutedBg="#1a2e28",input="#6f817a",
  primary="#3dbf93",primaryHover="#62d3ab",onPrimary="#06140f",link="#62d3ab",focus="#f5a524",
  estrutura="#0f2a23",onEstrutura="#ffffff",estruturaSuave="#9db8ae",ambar="#f5a524",onAmbar="#1f1500",
  ok="#4ade80",okBg="#123524",warn="#facc15",warnBg="#3a3110",danger="#f87171",dangerBg="#3b1717",neutro="#647770")
checks=[("Texto principal / fundo","fg","bg",4.5),("Texto principal / cartão","fg","card",4.5),
("Texto de apoio / fundo","muted","bg",4.5),("Texto de apoio / cartão","muted","card",4.5),("Texto de apoio / preenchimento","muted","mutedBg",4.5),
("Texto do botão principal","onPrimary","primary",4.5),("Texto do botão (hover)","onPrimary","primaryHover",4.5),
("Link / fundo","link","bg",4.5),("Link / cartão","link","card",4.5),
("Borda de campo / cartão (UI)","input","card",3),("Borda de campo / fundo (UI)","input","bg",3),
("Foco / fundo (UI)","focus","bg",3),("Foco / cartão (UI)","focus","card",3),
("Texto / estrutura","onEstrutura","estrutura",4.5),("Texto de apoio / estrutura","estruturaSuave","estrutura",4.5),
("Âmbar / estrutura","ambar","estrutura",4.5),("Texto / âmbar","onAmbar","ambar",4.5),
("Saudável / selo","ok","okBg",4.5),("Atenção / selo","warn","warnBg",4.5),("Déficit / selo","danger","dangerBg",4.5),
("Saudável / cartão","ok","card",4.5),("Atenção / cartão","warn","card",4.5),("Déficit / cartão","danger","card",4.5),
("Série de contexto do gráfico / cartão (UI)","neutro","card",3)]
ok=True
for nome,p in [("CLARO",claro),("ESCURO",escuro)]:
    print("==",nome)
    for t,a,b,m in checks:
        c=cr(p[a],p[b]); s="OK" if c>=m else "FALHA"; ok&= c>=m
        print(f"  {c:5.2f}:1 (mín {m}) {s:5} {t}  {p[a]} / {p[b]}")
print("TUDO OK" if ok else "HÁ FALHAS")
