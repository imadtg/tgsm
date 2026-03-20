import type { OperationErrorShape } from './types'

export class TgsmError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly suggestion?: string

  constructor(shape: OperationErrorShape) {
    super(shape.message)
    this.name = 'TgsmError'
    this.code = shape.code
    this.retryable = shape.retryable
    this.suggestion = shape.suggestion
  }

  toJSON(): OperationErrorShape {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      suggestion: this.suggestion,
    }
  }
}

export function asTgsmError(error: unknown): TgsmError {
  if (error instanceof TgsmError) {
    return error
  }

  if (error instanceof Error) {
    return new TgsmError({
      code: 'UNEXPECTED_ERROR',
      message: error.message,
      retryable: false,
    })
  }

  return new TgsmError({
    code: 'UNEXPECTED_ERROR',
    message: 'Unexpected error',
    retryable: false,
  })
}
