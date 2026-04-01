/**
 * ASDM Custom Error Classes
 *
 * Each error type maps to a specific failure domain,
 * making error handling and user messaging precise.
 */

export class AsdmError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly suggestion?: string
  ) {
    super(message)
    this.name = 'AsdmError'
  }
}

export class ConfigError extends AsdmError {
  constructor(message: string, suggestion?: string) {
    super(message, 'CONFIG_ERROR', suggestion)
    this.name = 'ConfigError'
  }
}

export class RegistryError extends AsdmError {
  constructor(message: string, suggestion?: string) {
    super(message, 'REGISTRY_ERROR', suggestion)
    this.name = 'RegistryError'
  }
}

export class IntegrityError extends AsdmError {
  constructor(message: string, suggestion?: string) {
    super(message, 'INTEGRITY_ERROR', suggestion)
    this.name = 'IntegrityError'
  }
}

export class ParseError extends AsdmError {
  constructor(message: string, suggestion?: string) {
    super(message, 'PARSE_ERROR', suggestion)
    this.name = 'ParseError'
  }
}

export class PolicyError extends AsdmError {
  constructor(message: string, suggestion?: string) {
    super(message, 'POLICY_ERROR', suggestion)
    this.name = 'PolicyError'
  }
}

export class NetworkError extends AsdmError {
  constructor(message: string, suggestion?: string) {
    super(message, 'NETWORK_ERROR', suggestion)
    this.name = 'NetworkError'
  }
}

export class SchemaError extends AsdmError {
  constructor(message: string, suggestion?: string) {
    super(message, 'SCHEMA_ERROR', suggestion)
    this.name = 'SchemaError'
  }
}
