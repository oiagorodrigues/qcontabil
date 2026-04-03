# Recharts BarChart Integration in React + Vite

## Context

Integração do recharts em projeto React 19 + Vite para dashboard financeiro com dados de API.

## Setup básico

```bash
pnpm --filter web add recharts
```

## Pattern de BarChart responsivo

```typescript
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'

<ResponsiveContainer width="100%" height={200}>
  <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
    <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
    <YAxis
      tick={{ fontSize: 12 }}
      axisLine={false}
      tickLine={false}
      tickFormatter={(v: number) =>
        new Intl.NumberFormat('en-US', { notation: 'compact', style: 'currency', currency }).format(v)
      }
    />
    <Tooltip content={makeTooltip(currency)} />
    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

**Boas práticas:**
- `axisLine={false}` + `tickLine={false}` — remove linhas desnecessárias, visual mais limpo
- `radius={[4, 4, 0, 0]}` — bordas arredondadas no topo das barras
- `hsl(var(--primary))` — usa token CSS do design system (Tailwind/shadcn)
- `notation: 'compact'` no YAxis — formata valores grandes como "10K", "1.2M"

## Filling gaps (meses sem dados)

A API não retorna meses sem invoices — o service preenche gaps no backend antes de retornar:

```typescript
// Backend: gera todos os meses do range e faz lookup no resultado da query
const months = getMonthsInRange(range)
const lookup = new Map(rows.map(r => [`${r.year}-${r.month}`, Number(r.total)]))

return months.map(({ year, month, label }) => ({
  label,
  total: lookup.get(`${year}-${month}`) ?? 0,
}))
```

## Referência

- Recharts: https://recharts.org
