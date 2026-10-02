"""Verifica o contraste (WCAG 2.1) dos pares de cores da identidade visual do Health Enterprise.
Uso: python3 validar_contraste.py  — termina com "TUDO OK" quando todos os pares passam."""
def L(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def cr(a,b):
    x,y=sorted([L(a),L(b)],reverse=True); return (x+0.05)/(y+0.05)
claro=dict(bg="#faf9f7",card="#ffffff",fg="#0d1f1a",muted="#5f6670",border="#e5e2dc",input="#8a8f98",
  primary="#b45309",primaryHover="#92400e",onPrimary="#ffffff",link="#b45309",
  brand="#163028",brandDeep="#0d1f1a",onBrand="#ffffff",brandAccentOnDark="#f59e0b",
  ok="#166534",okBg="#e8f5ec",warn="#8a5a00",warnBg="#fdf6d8",danger="#b91c1c",dangerBg="#fdeceb",focus="#b45309")
escuro=dict(bg="#0b1714",card="#12241f",fg="#ecebe7",muted="#a7b0ab",border="#24392f",input="#6f817a",
  primary="#f59e0b",primaryHover="#fbbf24",onPrimary="#0d1f1a",link="#fbbf24",
  brand="#163028",brandDeep="#0d1f1a",onBrand="#ffffff",brandAccentOnDark="#f59e0b",
  ok="#4ade80",okBg="#123524",warn="#facc15",warnBg="#3a3110",danger="#f87171",dangerBg="#3b1717",focus="#fbbf24")
checks=[("Texto principal / fundo","fg","bg",4.5),("Texto principal / cartão","fg","card",4.5),("Texto secundário / fundo","muted","bg",4.5),("Texto secundário / cartão","muted","card",4.5),
("Texto do botão primário","onPrimary","primary",4.5),("Texto do botão (hover)","onPrimary","primaryHover",4.5),("Link / fundo","link","bg",4.5),("Link / cartão","link","card",4.5),
("Borda de campo / cartão (UI)","input","card",3),("Foco / fundo (UI)","focus","bg",3),("Texto sobre marca verde","onBrand","brand",4.5),("Âmbar sobre verde-escuro","brandAccentOnDark","brandDeep",4.5),
("Saudável (texto) / fundo do selo","ok","okBg",4.5),("Atenção (texto) / fundo do selo","warn","warnBg",4.5),("Déficit (texto) / fundo do selo","danger","dangerBg",4.5),
("Saudável / cartão","ok","card",4.5),("Atenção / cartão","warn","card",4.5),("Déficit / cartão","danger","card",4.5)]
ok=True
for nome,p in [("CLARO",claro),("ESCURO",escuro)]:
    print("==",nome)
    for t,a,b,m in checks:
        c=cr(p[a],p[b]); s="OK" if c>=m else "FALHA"; ok&= c>=m
        print(f"  {c:5.2f}:1 (mín {m}) {s:5} {t}  {p[a]} / {p[b]}")
print("TUDO OK" if ok else "HÁ FALHAS")
