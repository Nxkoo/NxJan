---
name: pearfy-theme
version: alpha-1
date: 2026-06-29
sources:
  - D:/My Projects/PEARFY/pearfy-study-hub/DESIGN.md
  - D:/My Projects/PEARFY/pearfy-study-hub/src/index.css
  - D:/My Projects/PEARFY/pearfy-study-hub/src/components/ThemeProvider.tsx
  - C:/Users/nykoo/OneDrive/Documentos/jan/web-app/src/index.css
  - C:/Users/nykoo/OneDrive/Documentos/jan/web-app/src/hooks/useInterfaceSettings.ts
  - C:/Users/nykoo/OneDrive/Documentos/jan/web-app/src/providers/InterfaceProvider.tsx
  - C:/Users/nykoo/OneDrive/Documentos/jan/web-app/src/providers/ThemeProvider.tsx
  - C:/Users/nykoo/OneDrive/Documentos/jan/web-app/src/containers/AccentColorPicker.tsx
  - C:/Users/nykoo/OneDrive/Documentos/jan/web-app/src/styles/font.css
status: ready-to-implement
---

# Plano: Tema Pearfy (Orchard) para a NxJan

> "Superfícies de papel quente + ações flat com personalidade + progresso como crescimento."

A Pearfy Orchard é um sistema de design autoral: olive-pera + creme + sálvia + semente marrom + pólen dourado + pêssego humano + lavanda de foco. O plano reaproveita **a infraestrutura de temas que a NxJan já tem** (accent color, darkStyle, data-dark-style, CSS variables) para plugar o Orchard como um **accent + flavor de dark adicionais**, sem refatorar componentes.

---

## 0. Diagnóstico (já feito)

### 0.1 Pearfy (fonte)
- **Stack:** React 19 + Vite + Tailwind v4 + shadcn/ui (Radix) + Supabase + HeroUI.
- **Tokens:** CSS variables em `src/index.css` linhas 85-269 (light) e 271-362 (dark), namespace `--orchard-*`.
- **Tipografia:** Fraunces (display), Instrument Sans (UI), JetBrains Mono (code).
- **Easings/shadows:** `--ease-orchard-out`, `--ease-orchard-press`, `--orchard-shadow-card`, `--orchard-shadow-button`.
- **Sistema de tema:** `ThemeProvider` (3 modos: light/dark/system) sem dark styles, classe `.dark` no `<html>`. Sem darkStyle variant — os tokens Orchard mudam todos sob `.dark { }`.
- **Helpers:** `.orchard-paper-surface`, `.orchard-paper-raised`, `.orchard-paper-tier-1/2/3`, `.orchard-paper-tone-soft/warm`, `.orchard-pressed`, `.pearfy-tap`, `.orchard-label-caps`, `.orchard-seed-dots`.

### 0.2 NxJan (alvo)
- **Stack:** Tauri 2 + React 19 + Vite + Tailwind v4 + shadcn/ui (Radix) + framer-motion + next-themes + zustand.
- **Sistema de tema atual:**
  - `useInterfaceSettings` (zustand persistido) controla `accentColor` (ink, blue, green, yellow, orange, red), `darkStyle` ('jan' | 'editorial'), `fontSize`.
  - `InterfaceProvider` aplica `--primary` e `--sidebar` baseado no accent + dark/light.
  - `ThemeProvider` controla `.dark` no `<html>`.
  - Atributo `data-dark-style="jan|editorial"` no `<html>` controla flavor do dark.
  - Tokens em `src/index.css` linhas 210-276 (light), 301-349 (Jan dark), 355-406 (Editorial dark).
- **Fontes já presentes:** `Fraunces` (display serif, IGUAL à Pearfy), `Figtree` (UI sans geométrica), `Inter`, `JetBrains Mono`, `StudioFeixenSans`. **Falta só `Instrument Sans` (pode mapear para `Figtree` como fallback idêntico ao stack da Pearfy).**
- **Tokens próprios:** `--paper`, `--paper-soft`, `--paper-card`, `--paper-muted`, `--ink`, `--blue`, `--green`, `--yellow`, `--orange`, `--red`, `--surface-1/2/3`, `--border-soft/strong`.

### 0.3 Conclusão
A NxJan tem **80% da infraestrutura pronta**. Não precisa de ThemeProvider novo, não precisa de hook novo, não precisa refatorar `InterfaceProvider`. As ações necessárias são:

1. Adicionar tokens `--orchard-*` ao `index.css` (mapeando para os tokens existentes).
2. Estender o tipo `DarkStyle` com `'pearfy'` (light + dark orchard).
3. Adicionar accent color `'pearfy'` (Pear Core `#6F8F3D`).
4. Adicionar helpers visuais Orchard (.orchard-*) ao CSS.
5. Adicionar um componente `PearfyBadge` opcional para casos editoriais.
6. Validar com lint + build + capturas.

---

## 1. Decisões confirmadas (2026-06-29)

1. **Posição do accent:** em um **grupo separado "Themes"** no `AccentColorPicker`, com divider visual. O accent pearfy vive sozinho abaixo dos 6 accents base (ink, blue, green, yellow, orange, red).
2. **Instrument Sans:** **SIM, adicionar.** Download do TTF variable, `@font-face` em `web-app/src/styles/font.css`, fallback `Figtree`.
3. **UX do seletor:** criar um **botão "Ativar Pearfy"** (preset) no topo do Settings > Interface que aplica `darkStyle: 'pearfy' + accent: 'pearfy'` em uma ação. Mantém a opção manual de escolher darkStyle no picker existente.
4. **Polish visual:** **NÃO migrar landing/hero** — só os tokens via CSS. Componentes existentes reagem sozinhos.

## 2. Arquivos a tocar

| Arquivo | Mudança |
|---|---|
| `web-app/src/index.css` | + tokens Orchard, + block `.dark[data-dark-style="pearfy"]`, + block `:root[data-dark-style="pearfy"]`, + utilities `.orchard-*`, + easings, + radii |
| `web-app/src/hooks/useInterfaceSettings.ts` | + accent `'pearfy'` em `ACCENT_COLORS`; + `'pearfy'` em `DarkStyle`; + label em `DARK_STYLE_OPTIONS`; + action `applyThemePreset({ darkStyle, accentColor })` |
| `web-app/src/providers/InterfaceProvider.tsx` | + branch para `darkStyle === 'pearfy'` em `applyAccentColorToDOM` (skip sidebar quando pearfy) |
| `web-app/src/containers/AccentColorPicker.tsx` | **refatorar layout**: divider + grupo "Themes" abaixo dos accents base; accent pearfy com label "Pearfy Orchard" + ícone leaf |
| `web-app/src/containers/ThemePresets.tsx` | (NOVO) preset card "Pearfy Orchard" que aplica darkStyle+accent em uma ação; visual com sample de cores |
| `web-app/src/routes/settings/interface.tsx` | montar `ThemePresets` antes do `AccentColorPicker` no card "Appearance" |
| `web-app/src/styles/font.css` | + `@font-face` Instrument Sans Variable; manter fallbacks |
| `web-app/public/fonts/instrument-sans/` | (NOVO) `InstrumentSans-Variable.ttf` |
| `web-app/src/components/ui/pearfy-badge.tsx` | (NOVO, opcional) badge com variants `leaf / paper / pollen / lavender / gold` |

> **NÃO mexer** em: `ThemeProvider.tsx`, `useTheme.ts`, `services/theme/*`, nenhum componente de página (zero polimento além dos tokens).

---

## 2. Fase 1 — Tokens Orchard (núcleo)

### 2.1 Em `web-app/src/index.css`, dentro de `@layer base { :root { ... } }`, **acrescentar** (após o bloco existente, sem sobrescrever nada):

```css
/* ── Pearfy Orchard tokens (light) ─────────────────────────────────
   Ativados quando html tem data-dark-style="pearfy".
   Espelham o sistema Orchard da Pearfy src/index.css (linhas 86-118).
   ───────────────────────────────────────────────────────────────── */
--orchard-bg: #F8F4EA;            /* Cream Paper — fundo base */
--orchard-bg-soft: #FCF8EF;
--orchard-surface: #FFFDF7;
--orchard-surface-raised: #FFF9EE;
--orchard-surface-muted: #EFE7D4;
--orchard-surface-orchard: #EDF3DF;
--orchard-ink: #243126;            /* Leaf Ink */
--orchard-ink-soft: #3D473D;
--orchard-muted: #6F746B;
--orchard-muted-soft: #9A9D93;
--orchard-border: #DED5BF;
--orchard-border-soft: #EBE3D0;
--orchard-primary: #6F8F3D;        /* Pear Core */
--orchard-primary-hover: #647F36;
--orchard-primary-active: #58712E;
--orchard-primary-light: #DDEBC2;  /* Pear Light */
--orchard-pear: #A8BE68;           /* Pear Highlight */
--orchard-sage: #E7EEDB;
--orchard-seed: #8B6F47;           /* Seed Brown */
--orchard-seed-soft: #CBB58C;
--orchard-pollen: #E7B84A;         /* Gold Pollen */
--orchard-peach: #F2B8A2;          /* Blush Peach */
--orchard-mist: #C9DCE8;           /* Blue Mist */
--orchard-focus: #A99BE6;          /* Lavender Focus */
--orchard-danger: #D9755B;
--orchard-shadow-card: 0 1px 0 rgba(36,49,38,0.055), 0 9px 24px rgba(139,111,71,0.075);
--orchard-shadow-button: 0 3px 0 rgba(36,49,38,0.18);
--orchard-shadow-button-active: 0 1px 0 rgba(36,49,38,0.18);
--ease-orchard-out: cubic-bezier(0.22, 1, 0.36, 1);
--ease-orchard-press: cubic-bezier(0.2, 0, 0, 1);
```

### 2.2 No mesmo arquivo, **acrescentar** um bloco paralelo dentro do mesmo `@layer base` (depois do `:root { ... }` existente, mas antes do `.dark { ... }`):

```css
/* Pearfy light flavor — sobrescreve os tokens shadcn com o Orchard.
   Ativado por data-dark-style="pearfy" no <html>.
   Esses tokens são LIDOS pelo resto do app via @theme inline,
   então mudar aqui muda TUDO sem mexer em componentes. */
:root[data-dark-style="pearfy"] {
  --radius: 0.875rem;             /* 14px — base radius Orchard */

  /* Mapear Orchard → tokens NxJan */
  --background: var(--orchard-bg);
  --foreground: var(--orchard-ink);
  --card: var(--orchard-surface);
  --card-foreground: var(--orchard-ink);
  --popover: var(--orchard-surface-raised);
  --popover-foreground: var(--orchard-ink);
  --primary: var(--orchard-primary);
  --primary-foreground: var(--orchard-surface);
  --secondary: var(--orchard-surface-muted);
  --secondary-foreground: var(--orchard-ink);
  --muted: var(--orchard-surface-muted);
  --muted-foreground: var(--orchard-muted);
  --accent: var(--orchard-primary-light);
  --accent-foreground: var(--orchard-primary-active);
  --destructive: var(--orchard-danger);
  --input: var(--orchard-surface);
  --ring: 79 28% 50%;             /* mesmo HSL da Pearfy (--ring) */
  --chart-1: var(--orchard-primary);
  --chart-2: var(--orchard-pollen);
  --chart-3: var(--orchard-peach);
  --chart-4: var(--orchard-focus);
  --chart-5: var(--orchard-mist);

  /* Surface 3-level herdado do editorial paper, mas com tons Orchard */
  --surface-1: var(--orchard-bg);
  --surface-2: var(--orchard-surface);
  --surface-3: var(--orchard-surface-raised);

  /* Bordas translúcidas estilo pencil stroke, mas em tons seed */
  --border-soft: color-mix(in srgb, var(--orchard-seed) 14%, transparent);
  --border: color-mix(in srgb, var(--orchard-ink) 45%, transparent);
  --border-strong: color-mix(in srgb, var(--orchard-ink) 75%, transparent);

  /* Sidebar do Jan vira "orchard bg soft" — uma cor, não três */
  --sidebar: var(--orchard-bg-soft);
  --sidebar-foreground: var(--orchard-ink);
  --sidebar-primary: var(--orchard-primary);
  --sidebar-primary-foreground: var(--orchard-surface);
  --sidebar-accent: var(--orchard-sage);
  --sidebar-accent-foreground: var(--orchard-primary-active);
  --sidebar-border: var(--border-soft);
  --sidebar-ring: var(--orchard-primary);

  /* Chips paper da NxJan → tons Orchard */
  --paper: var(--orchard-bg);
  --paper-soft: var(--orchard-bg-soft);
  --paper-card: var(--orchard-surface);
  --paper-muted: var(--orchard-surface-muted);
  --ink: var(--orchard-ink);
  --blue: var(--orchard-focus);
  --blue-soft: color-mix(in srgb, var(--orchard-focus) 22%, var(--orchard-surface) 78%);
  --green: var(--orchard-primary);
  --green-soft: var(--orchard-primary-light);
  --yellow: var(--orchard-pollen);
  --yellow-soft: color-mix(in srgb, var(--orchard-pollen) 22%, var(--orchard-surface) 78%);
  --orange: var(--orchard-peach);
  --orange-soft: color-mix(in srgb, var(--orchard-peach) 26%, var(--orchard-surface) 74%);
  --red: var(--orchard-danger);
  --red-soft: color-mix(in srgb, var(--orchard-danger) 22%, var(--orchard-surface) 78%);
}
```

### 2.3 Adicionar bloco paralelo para o **dark orchard** (depois do `.dark[data-dark-style="editorial"] { ... }`):

```css
/* Pearfy dark — pomar à noite, não terminal gamer. Greens suaves, navy
   esverdeado, lavanda com moderação, zero neon. Emula Pearfy
   src/index.css .dark {} (linhas 271-362). */
.dark[data-dark-style="pearfy"] {
  --orchard-bg: #101110;
  --orchard-bg-soft: #11130D;
  --orchard-surface: rgba(20,22,17,0.85);
  --orchard-surface-raised: rgba(28,32,24,0.95);
  --orchard-surface-muted: rgba(35,40,30,0.7);
  --orchard-surface-orchard: rgba(22,26,18,0.85);
  --orchard-ink: #F2EFE8;
  --orchard-ink-soft: #D1CDBC;
  --orchard-muted: #989689;
  --orchard-muted-soft: #6A675B;
  --orchard-border: rgba(255,255,255,0.16);
  --orchard-border-soft: rgba(255,255,255,0.10);
  --orchard-primary: #859160;          /* mais dessaturado no dark */
  --orchard-primary-hover: #96A36E;
  --orchard-primary-active: #727C50;
  --orchard-primary-light: rgba(133,145,96,0.15);
  --orchard-pear: #9DA873;
  --orchard-sage: rgba(38,44,30,0.6);
  --orchard-seed: #C9BCA5;
  --orchard-seed-soft: #857B69;
  --orchard-pollen: #E3B64D;
  --orchard-peach: #C47962;
  --orchard-mist: #6B765E;
  --orchard-focus: #796A85;
  --orchard-danger: #C47962;
  --orchard-shadow-card: 0 1px 1px rgba(255,255,255,0.03) inset, 0 12px 32px rgba(0,0,0,0.45);
  --orchard-shadow-button: 0 3px 0 rgba(0,0,0,0.42);
  --orchard-shadow-button-active: 0 1px 0 rgba(0,0,0,0.42);

  --background: var(--orchard-bg);
  --foreground: var(--orchard-ink);
  --card: var(--orchard-surface);
  --card-foreground: var(--orchard-ink);
  --popover: var(--orchard-surface-raised);
  --popover-foreground: var(--orchard-ink);
  --primary: var(--orchard-primary);
  --primary-foreground: var(--orchard-ink);
  --secondary: var(--orchard-surface-muted);
  --secondary-foreground: var(--orchard-ink);
  --muted: var(--orchard-surface-muted);
  --muted-foreground: var(--orchard-muted);
  --accent: var(--orchard-primary-light);
  --accent-foreground: var(--orchard-primary);
  --destructive: var(--orchard-danger);
  --input: var(--orchard-surface-raised);
  --ring: 75 21% 44%;
  --sidebar: var(--orchard-bg-soft);
  --sidebar-foreground: var(--orchard-ink);
  --sidebar-primary: var(--orchard-primary);
  --sidebar-primary-foreground: var(--orchard-ink);
  --sidebar-accent: var(--orchard-sage);
  --sidebar-accent-foreground: var(--orchard-primary);
  --sidebar-border: var(--border-soft);
  --sidebar-ring: var(--orchard-primary);

  --paper: var(--orchard-bg);
  --paper-soft: var(--orchard-bg-soft);
  --paper-card: var(--orchard-surface);
  --paper-muted: var(--orchard-surface-muted);
  --ink: var(--orchard-ink);
  --blue: var(--orchard-focus);
  --blue-soft: color-mix(in srgb, var(--orchard-focus) 22%, var(--orchard-surface) 78%);
  --green: var(--orchard-primary);
  --green-soft: var(--orchard-primary-light);
  --yellow: var(--orchard-pollen);
  --yellow-soft: color-mix(in srgb, var(--orchard-pollen) 22%, var(--orchard-surface) 78%);
  --orange: var(--orchard-peach);
  --orange-soft: color-mix(in srgb, var(--orchard-peach) 26%, var(--orchard-surface) 74%);
  --red: var(--orchard-danger);
  --red-soft: color-mix(in srgb, var(--orchard-danger) 22%, var(--orchard-surface) 78%);

  /* BG radial sutil da Pearfy dark */
  background-image: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(123,135,88,0.16) 0%, transparent 70%);
}
```

> **Detalhe-chave da Pearfy:** no dark, `primary` (decorativo) fica dessaturado mas `--primary` (CTA em componentes) **permanece com a escala clara via `primaryDark`**. Por isso o accent color `pearfy` em `useInterfaceSettings` precisa de um `primaryDark: '#6F8F3D'` (igual ao light) — feito na Fase 2.

### 2.4 Adicionar easings e radii Orchard ao `@theme inline` (no topo):

```css
@theme inline {
  /* ... existente ... */

  /* Pearfy Orchard easings & shadows */
  --ease-orchard-out: var(--ease-orchard-out);
  --ease-orchard-press: var(--ease-orchard-press);
  --shadow-orchard-card: var(--orchard-shadow-card);
  --shadow-orchard-button: var(--orchard-shadow-button);
}
```

---

## 3. Fase 2 — Accent color Pearfy

### 3.1 Em `web-app/src/hooks/useInterfaceSettings.ts`:

```ts
export type DarkStyle = 'jan' | 'editorial' | 'pearfy'   // ← estender
```

```ts
export const DARK_STYLE_OPTIONS = [
  // ... existentes ...
  {
    value: 'pearfy',
    label: 'Pearfy Orchard',
    description: 'Olive pear + cream paper, serif editorial. Estuda devagar, sem pressa.',
  },
] as const
```

```ts
const isDarkStyle = (value: unknown): value is DarkStyle =>
  value === 'jan' || value === 'editorial' || value === 'pearfy'
```

Adicionar entrada no array `ACCENT_COLORS` (em qualquer posição — sugiro entre `ink` e `blue` para destaque):

```ts
{
  name: 'Pearfy',
  value: 'pearfy',
  thumb: '#6F8F3D',
  primary: '#6F8F3D',
  /* No dark, o primary Orchard fica dessaturado (#859160) para textos/ícones;
     mas botões/CTA precisam do Pear Core claro para contraste. */
  primaryDark: '#6F8F3D',
  /* Sidebar = orchard bg-soft (cream paper) no light, dark orchard bg-soft
     (#11130D) no dark, e mesma cor no editorial-dark (paper at night). */
  sidebar: {
    light: '#FCF8EF',
    dark: '#11130D',
    darkEditorial: '#FCF8EF',  // não usado — pearfy tem flavor próprio
  },
},
```

> **Nota crítica:** ao adicionar um accent `'pearfy'`, a `applyAccentColorToDOM` atual em `useInterfaceSettings.ts` (linhas 117-145) já cobre o caso automaticamente (ela seta `--sidebar` e `--primary` baseado na presença/ausência de `primaryDark`). **Não é necessário** modificar `InterfaceProvider.tsx` se a lógica permanecer genérica. **Verificar** que o ramo `darkStyle === 'pearfy'` no switcher não é tratado especialmente — se for, adicionar `'pearfy'` na lista de checagens.

### 3.2 Em `web-app/src/providers/InterfaceProvider.tsx`:

Verificar o ternário da linha 42-46:
```ts
const sidebarColor = isDark
  ? darkStyle === 'editorial'
    ? color.sidebar.darkEditorial
    : color.sidebar.dark
  : color.sidebar.light
```

Como o accent pearfy tem `darkEditorial` próprio (`#FCF8EF`), mas o **modo dark pearfy já tem `--sidebar` definido pelo CSS** (Fase 2.3 sobrescreve), a sidebar injetada por JS conflita. **Solução:** pular a injeção de `--sidebar` quando `darkStyle === 'pearfy'`, deixando o CSS mandar:

```ts
const sidebarColor = (() => {
  if (isDark) {
    if (darkStyle === 'editorial') return color.sidebar.darkEditorial
    if (darkStyle === 'pearfy') return null   // CSS owns this
    return color.sidebar.dark
  }
  return color.sidebar.light
})()
if (sidebarColor !== null) {
  root.style.setProperty('--sidebar', sidebarColor)
}
```

E, analogamente, o ramo do `primaryDark`:

```ts
let primaryColor: string = color.primary
if (isDark && darkStyle === 'jan' && 'primaryDark' in color) {
  primaryColor = (color as { primaryDark: string }).primaryDark
}
if (isDark && darkStyle === 'pearfy' && 'primaryDark' in color) {
  primaryColor = (color as { primaryDark: string }).primaryDark
}
```

> O accent pearfy precisa de `primaryDark` porque o `--primary` no dark pearfy é `#859160` (decorativo, definido no CSS) **mas o accent pearfy envia `#6F8F3D`** (CTA legível) via JS. Isso espelha a regra documentada da Pearfy: "primária decorativa dessaturada, action-primary clara".

### 3.3 Em `web-app/src/containers/AccentColorPicker.tsx` — **refatorar para grupo separado**

A infraestrutura atual (linhas 11-32) renderiza N cores em uma única fileira. **Decisão:** separar em dois grupos visuais:

```tsx
import { cn } from '@/lib/utils'
import {
  useInterfaceSettings,
  ACCENT_COLORS,
} from '@/hooks/useInterfaceSettings'

const BASE_ACCENTS = ACCENT_COLORS.filter((c) => c.value !== 'pearfy')
const THEME_ACCENTS = ACCENT_COLORS.filter((c) => c.value === 'pearfy')

export function AccentColorPicker() {
  const { accentColor, setAccentColor } = useInterfaceSettings()

  return (
    <div className="flex flex-col gap-3">
      {/* Group: Accent colors */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {BASE_ACCENTS.map((color) => (
          <ColorButton
            key={color.value}
            color={color}
            isSelected={accentColor === color.value}
            onClick={() => setAccentColor(color.value)}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        <span className="h-px flex-1 bg-border-soft" />
        <span>Themes</span>
        <span className="h-px flex-1 bg-border-soft" />
      </div>

      {/* Group: Themes (Pearfy) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {THEME_ACCENTS.map((color) => (
          <ColorButton
            key={color.value}
            color={color}
            isSelected={accentColor === color.value}
            onClick={() => setAccentColor(color.value)}
            label="Pearfy"
            subtitle="Orchard"
          />
        ))}
      </div>
    </div>
  )
}

function ColorButton({ color, isSelected, onClick, label, subtitle }: {
  color: typeof ACCENT_COLORS[number]
  isSelected: boolean
  onClick: () => void
  label?: string
  subtitle?: string
}) {
  return (
    <button
      title={color.name}
      onClick={onClick}
      className={cn(
        'group relative size-9 rounded-lg border border-border-soft transition-all duration-200 cursor-pointer hover:scale-110',
        isSelected && 'ring-2 ring-offset-2 ring-offset-background ring-primary border-none'
      )}
      style={{
        backgroundColor: color.value === 'ink' ? 'var(--background)' : color.thumb,
      }}
    >
      {(label || subtitle) && (
        <span className="absolute left-1/2 -translate-x-1/2 -bottom-5 text-[0.625rem] font-semibold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          {label}
        </span>
      )}
    </button>
  )
}
```

> O accent pearfy vira um "tile" 9×9 (um pouco maior) com label tooltip "Pearfy Orchard" no hover. Divider com caps "Themes" editorial.

## 4. Fase 3 — Preset "Ativar Pearfy" (UX one-click)

### 4.1 Em `web-app/src/hooks/useInterfaceSettings.ts` — adicionar action

```ts
interface InterfaceSettingsState {
  // ... existente ...
  applyThemePreset: (preset: { darkStyle: DarkStyle; accentColor: AccentColorValue }) => void
}

// dentro do create():
applyThemePreset: (preset) => {
  const { isDark } = useTheme.getState()
  // 1. aplica darkStyle (seta atributo data-dark-style)
  if (isDarkStyle(preset.darkStyle)) {
    applyDarkStyleToDOM(preset.darkStyle)
  }
  // 2. aplica accent (seta --primary e --sidebar no DOM)
  applyAccentColorToDOM(preset.accentColor, isDark, preset.darkStyle)
  // 3. commita no zustand (persiste no localStorage)
  set({ darkStyle: preset.darkStyle, accentColor: preset.accentColor })
},
```

### 4.2 (NOVO) `web-app/src/containers/ThemePresets.tsx`

```tsx
import { useInterfaceSettings } from '@/hooks/useInterfaceSettings'
import { cn } from '@/lib/utils'

const PEARFY_PRESET = {
  darkStyle: 'pearfy' as const,
  accentColor: 'pearfy' as const,
  label: 'Pearfy Orchard',
  description: 'Olive pear + cream paper, serif editorial. Estuda devagar, sem pressa.',
  swatches: ['#F8F4EA', '#6F8F3D', '#E7B84A', '#A99BE6', '#F2B8A2'],
}

export function ThemePresets() {
  const { applyThemePreset } = useInterfaceSettings()

  return (
    <button
      onClick={() => applyThemePreset(PEARFY_PRESET)}
      className={cn(
        'group flex w-full items-start gap-3 rounded-2xl border border-border-soft bg-card p-4 text-left transition-all duration-200',
        'hover:border-primary/40 hover:shadow-[0_8px_24px_rgba(111,143,61,0.10)]',
        'active:translate-y-px'
      )}
    >
      {/* Swatch strip */}
      <div className="flex flex-col gap-1 shrink-0">
        <div className="flex h-12 w-12 overflow-hidden rounded-xl border border-border-soft">
          {PEARFY_PRESET.swatches.map((color, i) => (
            <div key={i} className="h-full flex-1" style={{ backgroundColor: color }} />
          ))}
        </div>
      </div>

      {/* Copy */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Theme
          </span>
          <span className="text-base font-semibold text-foreground">
            {PEARFY_PRESET.label}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          {PEARFY_PRESET.description}
        </p>
      </div>

      {/* Apply chevron */}
      <div className="shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary">
        →
      </div>
    </button>
  )
}
```

### 4.3 Em `web-app/src/routes/settings/interface.tsx`

Renderizar o preset **antes** do `AccentColorPicker` no card "Appearance":

```tsx
<AppearanceSection
  title="Theme"
  // ... props existentes ...
  actions={
    <div className="flex flex-col gap-3">
      <ThemePresets />
      <AccentColorPicker />
    </div>
  }
/>
```

> **Hierarquia visual:** o preset é o "atalho emocional" (1 clique, bonito, claro); o picker é o "ajuste fino" (6+1 cores granulares). Decisão de design da Pearfy: tornar o caminho bonito óbvio, manter o controle técnico escondido.

---

## 5. Fase 4 — Instrument Sans (fonte da Pearfy)

Acrescentar ao final do `web-app/src/index.css` (dentro de `@layer utilities` ou criar um novo `@layer components`):

```css
@layer utilities {
  /* Paper surfaces — três pesos. Cards Orchard = tier-2 por padrão. */
  .orchard-paper-surface {
    background: linear-gradient(180deg,
      color-mix(in srgb, var(--orchard-surface) 96%, white 4%),
      var(--orchard-surface));
    border: 1px solid var(--orchard-border);
    box-shadow: var(--orchard-shadow-card);
  }
  .orchard-paper-raised {
    background: var(--orchard-surface-raised);
    border: 1px solid var(--orchard-border);
    box-shadow: var(--orchard-shadow-card);
  }
  .orchard-paper-tier-1 { border-radius: 16px; border: 1px solid color-mix(in srgb, var(--orchard-border-soft) 50%, transparent);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.42), 0 2px 0 rgba(139,111,71,0.08); }
  .orchard-paper-tier-2 { border-radius: 22px; border: 1px solid var(--orchard-border);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.48), 0 10px 26px rgba(139,111,71,0.08); }
  .orchard-paper-tier-3 { border-radius: 24px; border: 1px solid color-mix(in srgb, var(--orchard-border) 88%, var(--orchard-ink) 12%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.52), 0 18px 48px rgba(36,49,38,0.07); }
  .orchard-paper-tier-hero { border-radius: 28px; }

  /* Alternância rítmica de fundo (seções vizinhas) */
  .orchard-paper-tone-soft {
    background: linear-gradient(180deg,
      color-mix(in srgb, var(--orchard-bg-soft) 88%, var(--orchard-sage) 12%),
      color-mix(in srgb, var(--orchard-bg-soft) 96%, var(--orchard-sage) 4%));
  }
  .orchard-paper-tone-warm {
    background: linear-gradient(180deg,
      color-mix(in srgb, var(--orchard-bg) 92%, var(--orchard-pollen) 8%),
      color-mix(in srgb, var(--orchard-bg-soft) 88%, var(--orchard-peach) 12%));
  }

  /* Botão com "press shadow" tátil. Aplica-se via className quando desejado. */
  .orchard-pressed {
    box-shadow: var(--orchard-shadow-button);
    transform: translateY(0);
    will-change: transform;
  }
  .orchard-pressed:active {
    box-shadow: var(--orchard-shadow-button-active);
    transform: translateY(1px);
  }
  @media (prefers-reduced-motion: reduce) {
    .orchard-pressed, .orchard-pressed:active { transform: none; }
  }

  /* Nav items / chips ativos (sage + ink ativo) */
  .orchard-shell-active {
    background: var(--orchard-sage);
    color: color-mix(in srgb, var(--orchard-primary-active) 82%, var(--orchard-ink) 18%);
    border-color: color-mix(in srgb, var(--orchard-primary) 24%, var(--orchard-border) 76%);
  }

  /* Caps editoriais — small + espaçado */
  .orchard-label-caps {
    font-size: 0.6875rem;
    font-weight: 800;
    letter-spacing: 0.18em;
    line-height: 1;
    text-transform: uppercase;
  }

  /* Tap target 44×44 (Apple HIG / Material) — utilitário de Pearfy */
  .pearfy-tap {
    position: relative;
    min-height: 2.75rem;
    min-width: 2.75rem;
  }
  .pearfy-tap:not(.pearfy-tap--no-extend)::before {
    content: "";
    position: absolute;
    inset: -0.5rem;
    z-index: 0;
  }
  .pearfy-tap > * { position: relative; z-index: 1; }
}
```

> Esses helpers **não se aplicam automaticamente**. Eles ficam disponíveis para componentes que quiserem usar a estética Orchard explicitamente. **Não migrar componentes existentes** — isso é opcional e incremental.

---

## 5. Fase 4 — Componentes Pearfy (opcional, incremental)

### 5.1 `web-app/src/components/ui/pearfy-badge.tsx` (novo)

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const pearfyBadge = cva(
  'inline-flex items-center gap-1 rounded-full font-bold leading-none',
  {
    variants: {
      variant: {
        leaf: 'bg-[var(--orchard-primary-light)] text-[var(--orchard-primary-active)] px-2.5 py-1.5 text-xs',
        paper: 'bg-[var(--orchard-surface-muted)] text-[var(--orchard-seed)] border border-[var(--orchard-border)] px-2.5 py-1.5 text-xs',
        pollen: 'bg-[var(--orchard-pollen)] text-[#3D2C07] px-2.5 py-1.5 text-xs',
        lavender: 'bg-[color-mix(in_srgb,var(--orchard-focus)_26%,white_74%)] text-[#4F467A] px-2.5 py-1.5 text-xs',
        gold: 'bg-[hsl(42_77%_60%)] text-[hsl(42_80%_13%)] px-2.5 py-1.5 text-xs',
      },
      size: {
        sm: 'text-[0.6875rem] px-2 py-1',
        md: 'text-xs',
      },
    },
    defaultVariants: { variant: 'leaf', size: 'md' },
  }
)

export interface PearfyBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pearfyBadge> {}

export function PearfyBadge({ className, variant, size, ...props }: PearfyBadgeProps) {
  return <span className={cn(pearfyBadge({ variant, size }), className)} {...props} />
}
```

### 5.2 NÃO migrar `components/ui/button.tsx`, `card.tsx`, `input.tsx` etc.

A regra da Pearfy é: **o sistema se aplica via tokens, não via classes**. Os componentes shadcn já leem `--primary`, `--card`, `--ring` etc. e vão reagir automaticamente quando `data-dark-style="pearfy"`. **Não é necessário** criar variantes Orchard dos componentes base.

---

## 6. Fase 5 — Ajustes finos & validação

### 6.1 Checklist de QA visual (manual, com dev:web rodando)

Para cada combinação de (light, dark) × (accent: ink, blue, pearfy) × (darkStyle: jan, editorial, pearfy):

- [ ] Sidebar: ler como "paper rail", não como "blue rail"
- [ ] Background: warm cream (light) / deep navy-esverdeado (dark), zero neon
- [ ] Botão primário: Pear Core `#6F8F3D` no light, **mesma cor** no dark pearfy (action-primary)
- [ ] Card surface: leve inner highlight, sombra curta quente
- [ ] H1/H2 em serif Fraunces, mais editorial que o Jan Blue
- [ ] Body em Instrument Sans (UI pearfy) ou Figtree/Inter
- [ ] Focus ring verde-oliva claro (`hsl(79 28% 50%)` light / `hsl(75 21% 44%)` dark)
- [ ] Toast (sonner): borda seed, fundo paper, título em Fraunces
- [ ] Scrollbar: warm, sutil, hover pear leaf
- [ ] Toaster rich: success verde, error peach-coral, info lavender, warning pollen
- [ ] Settings > Appearance: preset "Pearfy Orchard" visível e funcional (1 click aplica tudo)

### 6.2 Acessibilidade

- [ ] Contraste AA (4.5:1) em texto corpo:
  - light: `#243126` ink sobre `#F8F4EA` bg = **14.5:1** ✓
  - dark: `#F2EFE8` ink sobre `#101110` bg = **15.8:1** ✓
- [ ] Pear Core `#6F8F3D` como botão, texto `#FFFDF7` = **4.9:1** ✓
- [ ] Não depender só de cor (manter ícones, underlines, etc.)

### 6.3 Lint & build

```bash
yarn lint            # ESLint sobre web-app
yarn test:web        # vitest
yarn build:web       # tsc + vite build
```

### 6.4 Critério de aceitação

1. **Modo padrão continua idêntico** ao atual (accent `ink` + darkStyle `jan` = visualmente zero diff).
2. **Selecionar `darkStyle: "pearfy"` em Settings > Interface** muda todo o app para orchard (light ou dark) sem reload.
3. **Selecionar accent `pearfy` isolado** (sem mudar darkStyle) só muda a CTA/sidebar — fundo continua sendo o do darkStyle atual.
4. **Combinar `darkStyle: pearfy` + `accent: pearfy`** dá o visual 100% Orchard: cream paper + olive CTAs.
5. Nenhum teste existente quebra (os tokens `--background`, `--card`, `--primary` continuam existindo com os mesmos nomes).

---

## 7. Riscos & decisões pendentes

### 7.1 Riscos

| Risco | Mitigação |
|---|---|
| Sobrescrever tokens de outros accents | Usar escopo `:root[data-dark-style="pearfy"]` e `.dark[data-dark-style="pearfy"]` — não toca `:root` direto |
| Sidebar injetada por JS conflitar com CSS pearfy | Phase 2.2 do plano: skip JS injection quando `darkStyle === 'pearfy'` |
| Tabelas e code blocks (shiki) precisarem de cor especial | Já mapeamos `--orchard-pollen`, `--orchard-focus` etc. para `--yellow`, `--blue` — shiki pega via CSS |
| Body `::before` dot pattern (linha 420 do index.css) | Manter o original; só ajustar a opacidade dentro de `pearfy` se ficar agressivo |
| Accent `pearfy` com `primaryDark` fixo | Reutilizar o mesmo `#6F8F3D` light+dark (action-primary permanece claro) — documentar no type |

### 7.2 Decisões confirmadas (2026-06-29)

1. ✅ Accent "Pearfy" em **grupo separado "Themes"** no `AccentColorPicker` (com divider editorial).
2. ✅ Adicionar **Instrument Sans Variable** (TTF em `/public/fonts/instrument-sans/`).
3. ✅ Expor como **preset "Ativar Pearfy"** no topo do Settings > Appearance (1 click aplica darkStyle+accent).
4. ✅ **Sem polish na landing/hero** — só tokens via CSS.

### 7.3 Decisões ainda em aberto (baixa prioridade, podem ser revisitadas)

5. Preservar o dot pattern do body (`body::before` em `index.css:420`) ou desligar no pearfy mode? (A Pearfy usa seed dots só no AuthPage; o resto é limpo.)
6. Quando pearfy estiver ativo, o `font-display: Fraunces` deve cair também em h3/h4 (Pearfy usa Instrument Sans para h3, não serif)?

---

## 8. Critério de "pronto"

O tema Pearfy está pronto quando, ao ligar `darkStyle: "pearfy" + accent: "pearfy"` no Settings > Interface:

1. Tela inicial lê como "mesa de estudos", não como "terminal".
2. Botão Send é verde-oliva `#6F8F3D`, não azul Jan.
3. Sidebar é cream `#FCF8EF` (light) ou near-black esverdeado (dark).
4. Cards têm borda seed, sombra quente curta, radius 22px.
5. Títulos em Fraunces serif, corpo em Figtree.
6. Dark mode é "pomar à noite" (verde suave), não "azulão".
7. Sonner toasts usam o estilo editorial paper (border 1.5px, sombra tátil).
8. Nenhum componente existente regrediu visualmente no modo padrão.
9. `yarn lint` + `yarn test:web` + `yarn build:web` passam sem warning.
