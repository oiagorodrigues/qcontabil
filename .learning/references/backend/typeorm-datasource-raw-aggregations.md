# TypeORM DataSource.query() for Raw SQL Aggregations

## Context

NestJS services que precisam de queries agregadas complexas (SUM, GROUP BY, EXTRACT) sem carregar entidades completas. O QueryBuilder é verboso para agregações e não suporta bem `EXTRACT` + `GROUP BY` dinâmico.

## Pattern

Injetar `DataSource` diretamente e usar `.query()` para SQL raw:

```typescript
@Injectable()
export class DashboardService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getSummary(userId: string): Promise<number> {
    const rows = await this.dataSource.query<{ total: string }[]>(
      `SELECT COALESCE(SUM(total), 0)::text AS total
       FROM invoices
       WHERE "userId" = $1 AND status IN ('sent', 'paid')`,
      [userId],
    )
    return Number(rows[0]?.total ?? 0)
  }
}
```

**Por que `::text`?** PostgreSQL retorna `numeric` como string no driver Node.js. Cast para `text` mantém a precisão e evita surpresas — converter com `Number()` depois.

**Por que `COALESCE(..., 0)`?** SUM de zero rows retorna NULL — COALESCE garante que o resultado seja sempre numérico.

## Parametrização dinâmica

Para listas de valores (ex: `IN (...)`) com quantidade variável:

```typescript
const statuses = ['sent', 'paid']
const placeholders = statuses.map((_, i) => `$${i + 2}`).join(', ')
const params = [userId, ...statuses]

await this.dataSource.query(
  `SELECT SUM(total) FROM invoices WHERE "userId" = $1 AND status IN (${placeholders})`,
  params,
)
```

## Module config

`DashboardModule` não precisa de `TypeOrmModule.forFeature()` — `DataSource` é provido globalmente pelo `TypeOrmModule.forRootAsync()`. Basta `@InjectDataSource()` no construtor.

## Trade-offs

| Approach | Quando usar |
|---|---|
| `Repository.find()` | CRUD simples, filtros básicos |
| `QueryBuilder` | Joins complexos, paginação tipada |
| `DataSource.query()` | Agregações, GROUP BY, EXTRACT, window functions |

## Referência

- TypeORM DataSource: https://typeorm.io/data-source
