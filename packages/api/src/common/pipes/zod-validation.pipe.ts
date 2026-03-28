import { PipeTransform, BadRequestException } from "@nestjs/common"
import type { ZodSchema, ZodError } from "zod"

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value)

    if (!result.success) {
      const errors = this.formatErrors(result.error)
      throw new BadRequestException({ message: "Validation failed", errors })
    }

    return result.data
  }

  private formatErrors(error: ZodError): Record<string, string[]> {
    const errors: Record<string, string[]> = {}

    for (const issue of error.issues) {
      const path = issue.path.join(".") || "_root"
      if (!errors[path]) {
        errors[path] = []
      }
      errors[path].push(issue.message)
    }

    return errors
  }
}
