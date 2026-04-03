import { InvoiceTemplate } from './template.types'
import type { TemplateFunction } from './template.types'
import { classicTemplate } from './classic.template'
import { modernTemplate } from './modern.template'
import { minimalTemplate } from './minimal.template'

/** Registry mapping each InvoiceTemplate variant to its render function. */
const registry = new Map<InvoiceTemplate, TemplateFunction>([
  [InvoiceTemplate.CLASSIC, classicTemplate],
  [InvoiceTemplate.MODERN, modernTemplate],
  [InvoiceTemplate.MINIMAL, minimalTemplate],
])

/**
 * Returns the TemplateFunction for the given template name.
 * Throws if the template is not registered.
 */
export function getTemplate(name: InvoiceTemplate): TemplateFunction {
  const fn = registry.get(name)
  if (!fn) {
    throw new Error(`Template not registered: ${name}`)
  }
  return fn
}

export { registry }
