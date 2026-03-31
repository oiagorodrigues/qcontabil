# TanStack Form v1.28: Passing Form to Sub-Components

## Context

TanStack Form v1.28's `FormApi` / `ReactFormExtendedApi` requires 12 generic type parameters. Directly typing a prop as `FormApi<MyData, ...>` is impractical. The challenge: how to pass form functionality to sub-components without losing type safety.

## Anti-Pattern

```typescript
// DON'T: using `any` defeats TypeScript
interface Props { form: any }
```

## Solution: Data + Callbacks Interface

Instead of passing the form object, define an interface with the specific data and callbacks the sub-component needs:

```typescript
interface ContactFieldState {
  value: string | boolean
  meta: { errors: unknown[] }
  handleBlur: () => void
  handleChange: (value: string | boolean) => void
}

interface ContactsArrayState {
  value: ContactInput[]
  meta: { errors: unknown[] }
  pushValue: (value: ContactInput) => void
  removeValue: (index: number) => void
}

interface ContactsFieldArrayProps {
  contacts: ContactsArrayState
  renderField: (name: string, children: (field: ContactFieldState) => ReactNode) => ReactNode
  setFieldValue: (name: string, value: boolean) => void
}
```

The parent component bridges TanStack Form's types to this interface:

```typescript
<form.Field name="contacts" mode="array">
  {(contactsField) => (
    <ContactsFieldArray
      contacts={{
        value: contactsField.state.value,
        meta: contactsField.state.meta,
        pushValue: contactsField.pushValue,
        removeValue: contactsField.removeValue,
      }}
      renderField={(name, children) => (
        <form.Field name={name as ContactFieldPath} key={name}>
          {(field) => children({
            value: field.state.value as string | boolean,
            meta: field.state.meta,
            handleBlur: field.handleBlur,
            handleChange: field.handleChange as (v: string | boolean) => void,
          })}
        </form.Field>
      )}
      setFieldValue={(name, value) =>
        form.setFieldValue(name as ContactFieldPath, value)
      }
    />
  )}
</form.Field>
```

## Key Takeaway

When library types are too complex to propagate, define your own interface at the boundary. The parent maps library types → your interface. The child stays type-safe without depending on the library's generics.
