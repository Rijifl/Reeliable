/** Thrown for invalid client input — the route maps this to HTTP 400.
 *  Anything else that escapes the pipeline is a server fault → HTTP 500. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
