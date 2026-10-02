import { useState } from 'react'

/* Protótipo revisado da tela de login — Health Enterprise.
   Base: docs/design/prototipo (Figma). Mudanças: nome e logo oficiais,
   tokens de docs/design/identidade/tokens/tokens.css (contraste AA),
   sem login com Google (RF01), modo escuro via classe `.dark`. */

function Simbolo({ size = 36, semFundo = false }: { size?: number; semFundo?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Health Enterprise">
      {!semFundo && <rect width="64" height="64" rx="14" fill="var(--brand)" />}
      <path d="M32 51V31" stroke="var(--brand-amber)" strokeWidth="5" strokeLinecap="round" />
      <path d="M32 33C32 20.5 41.5 13.5 52 13.5C52 26 43.5 33 32 33Z" fill="var(--brand-amber)" />
      <path d="M32 39C32 30.5 24.5 25 13.5 25C13.5 34 20.5 39 32 39Z" fill="var(--brand-amber-light)" />
    </svg>
  )
}

function Logo({ negativo = false }: { negativo?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Simbolo semFundo={negativo} />
      <span className={`font-display text-xl font-semibold ${negativo ? 'text-white' : 'text-foreground'}`}>
        Health Enterprise
      </span>
    </div>
  )
}

function IconeErro() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1" fill="none" />
      <rect x="5.5" y="3" width="1" height="4" rx=".5" />
      <rect x="5.5" y="8.5" width="1" height="1" rx=".5" />
    </svg>
  )
}

export default function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  function validate() {
    const next: typeof errors = {}
    if (!email.trim()) next.email = 'Informe seu e-mail'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'E-mail inválido'
    if (!password) next.password = 'Informe sua senha'
    return next
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    setTimeout(() => setLoading(false), 1800)
  }

  const campo = (erro?: string) =>
    `w-full px-4 py-3 rounded-xl text-sm border bg-card text-foreground placeholder:text-muted-foreground
     transition-shadow outline-none focus:border-ring focus:ring-4 focus:ring-ring/15
     ${erro ? 'border-destructive ring-4 ring-destructive/10' : 'border-input'}`

  return (
    <div className="min-h-screen flex bg-background font-sans">
      {/* Painel institucional */}
      <aside className="hidden lg:flex flex-col justify-between w-[46%] px-14 py-12 relative overflow-hidden bg-brand-deep">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 60% 30%, rgba(245,158,11,0.10) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 20% 80%, rgba(16,82,57,0.4) 0%, transparent 60%)',
          }}
        />
        <header className="relative z-10"><Logo negativo /></header>

        <div className="relative z-10">
          <p className="text-xs font-medium uppercase tracking-widest mb-5 text-brand-amber">
            ERP para microempreendedores e autônomos
          </p>
          <h1 className="font-display text-5xl leading-[1.1] text-white mb-6 font-semibold">
            A saúde do seu negócio,<br />visual e sob controle.
          </h1>
          <p className="text-base leading-relaxed max-w-sm text-white/75">
            Controle o estoque, precifique produtos e serviços com precisão e acompanhe cada centavo do seu caixa — tudo em um só lugar.
          </p>
        </div>

        <footer className="relative z-10">
          <p className="text-xs uppercase tracking-widest mb-4 text-white/60">Recursos incluídos</p>
          <ul className="flex flex-wrap gap-2">
            {['Calculadora de preços', 'Controle de estoque', 'Fluxo de caixa', 'Gestão de equipe'].map(f => (
              <li key={f} className="text-xs px-3 py-1.5 rounded-full border border-white/25 text-white/80">{f}</li>
            ))}
          </ul>
        </footer>
      </aside>

      {/* Formulário */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-16 relative">
        <div className="lg:hidden mb-10"><Logo /></div>

        <div className="w-full max-w-sm">
          <div className="mb-9">
            <h2 className="font-display text-3xl mb-1.5 font-semibold text-foreground">Bem-vindo de volta</h2>
            <p className="text-sm text-muted-foreground">Acesse sua conta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5 text-foreground">E-mail</label>
              <input id="email" type="email" autoComplete="email" value={email} placeholder="voce@empresa.com"
                aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-erro' : undefined}
                onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })) }}
                className={campo(errors.email)} />
              {errors.email && (
                <p id="email-erro" className="text-xs mt-1.5 flex items-center gap-1 text-destructive"><IconeErro />{errors.email}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-sm font-medium text-foreground">Senha</label>
                <a href="#" className="text-xs font-medium text-primary hover:text-primary-hover underline-offset-2 hover:underline">
                  Esqueci a senha
                </a>
              </div>
              <div className="relative">
                <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  value={password} placeholder="Sua senha"
                  aria-invalid={!!errors.password} aria-describedby={errors.password ? 'senha-erro' : undefined}
                  onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })) }}
                  className={`${campo(errors.password)} pr-11`} />
                <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {showPassword ? (
                      <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
                    ) : (
                      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                    )}
                  </svg>
                </button>
              </div>
              {errors.password && (
                <p id="senha-erro" className="text-xs mt-1.5 flex items-center gap-1 text-destructive"><IconeErro />{errors.password}</p>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3.5 mt-2 rounded-xl text-sm font-semibold tracking-wide flex items-center justify-center gap-2
                         bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-70 disabled:cursor-not-allowed transition-colors">
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-sm mt-8 text-muted-foreground">
            Não tem uma conta?{' '}
            <a href="#" className="font-semibold text-primary hover:text-primary-hover hover:underline underline-offset-2">Crie gratuitamente</a>
          </p>
        </div>

        <p className="absolute bottom-6 text-xs text-muted-foreground">
          © 2026 Health Enterprise · <a href="#" className="hover:underline">Termos</a> · <a href="#" className="hover:underline">Privacidade</a>
        </p>
      </main>
    </div>
  )
}
