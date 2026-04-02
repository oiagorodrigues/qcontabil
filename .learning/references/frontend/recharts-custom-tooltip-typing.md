# Recharts Custom Tooltip: Avoiding Generic Type Conflicts

## Context

Recharts usa generics em `TooltipProps<ValueType, NameType>`. Quando se passa `content={<CustomTooltip />}` diretamente, o TypeScript falha porque o tipo inferido por Recharts internamente é `Formatter<ValueType, NameType>` — onde `NameType` pode ser `number | string`, não apenas `string`.

## Problema

```typescript
// ❌ Erro TS2322 — tipos incompatíveis em formatter
function ChartTooltip(props: TooltipProps<number, string> & { currency: string }) {
  ...
}

<Tooltip content={(props) => <ChartTooltip {...props} currency={currency} />} />
```

## Solução: factory function com props explícitas

Em vez de tipar via `TooltipProps`, usar uma factory que captura `currency` no closure e retorna um componente com props explícitas:

```typescript
function makeTooltip(currency: string) {
  return function ChartTooltip({
    active,
    payload,
    label,
  }: {
    active?: boolean
    payload?: { value?: number }[]
    label?: string
  }) {
    if (!active || !payload?.length) return null
    return (
      <div>
        <p>{label}</p>
        <p>{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(payload[0].value ?? 0)}</p>
      </div>
    )
  }
}

// Uso — sem conflito de tipos
<Tooltip content={makeTooltip(currency)} />
```

## Por que funciona

A factory retorna um componente com props literais que Recharts aceita sem passar por seus generics internos. O `currency` fica no closure — sem prop drilling.

## Referência

- Recharts Tooltip: https://recharts.org/en-US/api/Tooltip
