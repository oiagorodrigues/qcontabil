import { describe, it, expect } from 'vitest'
import { isValidCnpj } from './cnpj'

describe('isValidCnpj', () => {
  it('validates known valid CNPJs', () => {
    expect(isValidCnpj('11222333000181')).toBe(true)
    expect(isValidCnpj('11444777000161')).toBe(true)
    expect(isValidCnpj('43378917000137')).toBe(true)
  })

  it('rejects CNPJ with wrong check digits', () => {
    expect(isValidCnpj('11222333000182')).toBe(false)
    expect(isValidCnpj('11444777000160')).toBe(false)
  })

  it('rejects CNPJ with all same digits', () => {
    for (let d = 0; d <= 9; d++) {
      expect(isValidCnpj(String(d).repeat(14))).toBe(false)
    }
  })

  it('rejects input with wrong length', () => {
    expect(isValidCnpj('1122233300018')).toBe(false)
    expect(isValidCnpj('112223330001811')).toBe(false)
    expect(isValidCnpj('')).toBe(false)
  })

  it('rejects non-numeric input', () => {
    expect(isValidCnpj('1122233300018a')).toBe(false)
    expect(isValidCnpj('11.222.333/0001-81')).toBe(false)
  })
})
