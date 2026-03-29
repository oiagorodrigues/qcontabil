const WEIGHTS_FIRST = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const WEIGHTS_SECOND = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

function calculateDigit(digits: number[], weights: number[]): number {
  const sum = digits.reduce((acc, digit, i) => acc + digit * weights[i], 0)
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

export function isValidCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14) return false
  if (!/^\d{14}$/.test(cnpj)) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false

  const digits = cnpj.split('').map(Number)

  const firstCheck = calculateDigit(digits.slice(0, 12), WEIGHTS_FIRST)
  if (digits[12] !== firstCheck) return false

  const secondCheck = calculateDigit(digits.slice(0, 13), WEIGHTS_SECOND)
  if (digits[13] !== secondCheck) return false

  return true
}
