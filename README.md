# IMPI Lex — Agente de Propiedad Intelectual México

Agente conversacional especializado en **Propiedad Industrial e Intelectual en México** y **Marketing Digital de Marca**, construido con Next.js 14 y la API de Anthropic (Claude).

## Características

- ⚖️ Marco normativo completo: LFPPI, Niza, Protocolo de Madrid, T-MEC
- 🔍 Guía paso a paso de búsqueda en Marcanet y proceso IMPI
- 📄 Integración de expedientes y documentos clave
- 📣 Estrategia de marketing digital y branding legal
- 🛡️ Vigilancia y defensa de marca online
- 💾 Historial de conversación persistente (localStorage)
- 🔒 API key segura en servidor (nunca expuesta al cliente)

---

## Instalación rápida

### 1. Prerequisitos
- Node.js 18+
- Una API key de Anthropic → https://console.anthropic.com/

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
```bash
cp .env.example .env.local
# Edita .env.local y agrega tu ANTHROPIC_API_KEY
```

### 4. Correr en desarrollo
```bash
npm run dev
# Abre http://localhost:3000
```

---

## Despliegue en Vercel (recomendado)

```bash
# Instala Vercel CLI
npm i -g vercel

# Despliega
vercel

# Configura la variable de entorno en el dashboard de Vercel:
# ANTHROPIC_API_KEY = sk-ant-...
```

O conecta tu repo de GitHub en https://vercel.com/new y agrega `ANTHROPIC_API_KEY` en Settings > Environment Variables.

---

## Estructura del proyecto

```
impi-lex/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       └── route.ts      # API route (llama a Anthropic server-side)
│   │   ├── globals.css           # Variables CSS y estilos base
│   │   ├── layout.tsx            # Layout raíz
│   │   ├── page.tsx              # Componente principal del chat
│   │   └── page.module.css       # Estilos del chat
│   └── lib/
│       └── agent.ts              # System prompt + datos de prompts/recursos
├── .env.example                  # Template de variables de entorno
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## Personalización con Claude Code

Puedes pedirle a Claude Code que:
- Agregue autenticación de usuarios (NextAuth.js)
- Conecte una base de datos para historial multi-sesión (Supabase, PlanetScale)
- Exporte conversaciones a PDF
- Agregue streaming de respuestas
- Integre búsqueda en tiempo real en Marcanet vía scraping
- Genere documentos Word desde el chat (integración con tu `Marca_tu_Marca.docx`)

---

## Stack

- **Framework**: Next.js 14 (App Router)
- **IA**: Claude claude-sonnet-4-6 via @anthropic-ai/sdk
- **Estilos**: CSS Modules + Google Fonts
- **Despliegue**: Vercel (recomendado)
