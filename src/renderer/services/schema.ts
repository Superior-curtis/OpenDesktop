// ============================================================================
// Schema — schema-first validation (inspired by Effect Schema from opencode)
// ============================================================================

export type SchemaType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'record'
  | 'union'
  | 'literal'
  | 'optional'
  | 'nullable'
  | 'struct'
  | 'enum'

type ValidationResult<T> =
  | { success: true; value: T }
  | { success: false; error: string }

export class Schema<T = any> {
  readonly type: SchemaType
  readonly validate: (value: unknown) => ValidationResult<T>
  readonly description?: string
  readonly inner?: Schema<any>
  readonly schemas?: Schema<any>[]
  readonly fields?: Record<string, Schema<any>>
  readonly literalValue?: unknown
  readonly enumValues?: string[]
  readonly keySchema?: Schema<string>
  readonly valueSchema?: Schema<any>

  constructor(config: {
    type: SchemaType
    validate: (value: unknown) => ValidationResult<T>
    description?: string
    inner?: Schema<any>
    schemas?: Schema<any>[]
    fields?: Record<string, Schema<any>>
    literalValue?: unknown
    enumValues?: string[]
    keySchema?: Schema<string>
    valueSchema?: Schema<any>
  }) {
    this.type = config.type
    this.validate = config.validate
    this.description = config.description
    this.inner = config.inner
    this.schemas = config.schemas
    this.fields = config.fields
    this.literalValue = config.literalValue
    this.enumValues = config.enumValues
    this.keySchema = config.keySchema
    this.valueSchema = config.valueSchema
  }

  static string(description?: string): Schema<string> {
    return new Schema<string>({
      type: 'string',
      validate: (value) => {
        if (typeof value === 'string') return { success: true, value }
        return { success: false, error: `Expected string, got ${typeof value}` }
      },
      description,
    })
  }

  static number(description?: string): Schema<number> {
    return new Schema<number>({
      type: 'number',
      validate: (value) => {
        if (typeof value === 'number' && !Number.isNaN(value)) return { success: true, value }
        return { success: false, error: `Expected number, got ${typeof value}` }
      },
      description,
    })
  }

  static boolean(description?: string): Schema<boolean> {
    return new Schema<boolean>({
      type: 'boolean',
      validate: (value) => {
        if (typeof value === 'boolean') return { success: true, value }
        return { success: false, error: `Expected boolean, got ${typeof value}` }
      },
      description,
    })
  }

  static literal<T extends string>(value: T, description?: string): Schema<T> {
    return new Schema<T>({
      type: 'literal',
      validate: (v) => {
        if (v === value) return { success: true, value: v as T }
        return { success: false, error: `Expected literal ${JSON.stringify(value)}, got ${JSON.stringify(v)}` }
      },
      description,
      literalValue: value,
    })
  }

  static array<T>(itemSchema: Schema<T>, description?: string): Schema<T[]> {
    return new Schema<T[]>({
      type: 'array',
      validate: (value) => {
        if (!Array.isArray(value)) return { success: false, error: 'Expected array' }
        for (let i = 0; i < value.length; i++) {
          const result = itemSchema.validate(value[i])
          if (!result.success) return { success: false, error: `[${i}]: ${result.error}` }
        }
        return { success: true, value: value as T[] }
      },
      description,
      inner: itemSchema,
    })
  }

  static record<V>(valueSchema: Schema<V>, description?: string): Schema<Record<string, V>> {
    return new Schema<Record<string, V>>({
      type: 'record',
      validate: (value) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return { success: false, error: 'Expected record (object)' }
        }
        for (const [k, v] of Object.entries(value)) {
          const result = valueSchema.validate(v)
          if (!result.success) return { success: false, error: `.${k}: ${result.error}` }
        }
        return { success: true, value: value as Record<string, V> }
      },
      description,
      inner: valueSchema,
    })
  }

  static union<T extends any[]>(
    ...schemas: { [K in keyof T]: Schema<T[K]> }
  ): Schema<T[number]> {
    const flattened = schemas.flatMap((s) =>
      s.type === 'union' && s.schemas ? s.schemas : [s],
    ) as unknown as { [K in keyof T]: Schema<T[K]> }
    return new Schema<T[number]>({
      type: 'union',
      validate: (value) => {
        const errors: string[] = []
        for (let i = 0; i < flattened.length; i++) {
          const result = (flattened[i] as Schema<any>).validate(value)
          if (result.success) return result
          errors.push(result.error)
        }
        return { success: false, error: `No union variant matched:\n${errors.join('\n')}` }
      },
      schemas: flattened as unknown as Schema<any>[],
    })
  }

  static optional<T>(schema: Schema<T>): Schema<T | undefined> {
    return new Schema<T | undefined>({
      type: 'optional',
      validate: (value) => {
        if (value === undefined) return { success: true, value: undefined as T | undefined }
        return schema.validate(value)
      },
      inner: schema,
    })
  }

  static nullable<T>(schema: Schema<T>): Schema<T | null> {
    return new Schema<T | null>({
      type: 'nullable',
      validate: (value) => {
        if (value === null) return { success: true, value: null as T | null }
        return schema.validate(value)
      },
      inner: schema,
    })
  }

  static struct<T extends Record<string, Schema>>(
    fields: T,
    description?: string,
  ): Schema<{ [K in keyof T]: T[K] extends Schema<infer V> ? V : never }> {
    return new Schema({
      type: 'struct',
      validate: (value) => {
        if (typeof value !== 'object' || value === null) {
          return { success: false, error: 'Expected object' }
        }
        if (Array.isArray(value)) return { success: false, error: 'Expected object, got array' }
        const obj = value as Record<string, unknown>
        for (const key of Object.keys(fields)) {
          const result = fields[key].validate(obj[key])
          if (!result.success) return { success: false, error: `.${key}: ${result.error}` }
        }
        return { success: true, value: value as any }
      },
      fields,
      description,
    }) as any
  }

  static enum<T extends string>(values: T[], description?: string): Schema<T> {
    return new Schema<T>({
      type: 'enum',
      validate: (value) => {
        if (values.includes(value as T)) return { success: true, value: value as T }
        return {
          success: false,
          error: `Expected one of [${values.map((v) => JSON.stringify(v)).join(', ')}], got ${JSON.stringify(value)}`,
        }
      },
      enumValues: values,
      description,
    })
  }
}

// ============================================================================
// Validation functions
// ============================================================================

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function validate<T>(schema: Schema<T>, value: unknown): T {
  const result = schema.validate(value)
  if (!result.success) throw new ValidationError(result.error)
  return result.value
}

export function validateOrThrow<T>(schema: Schema<T>, value: unknown): T {
  return validate(schema, value)
}

export function isValid<T>(schema: Schema<T>, value: unknown): value is T {
  return schema.validate(value).success
}

// ============================================================================
// TaggedUnion — discriminated union helper
// ============================================================================

type TaggedUnionValue<T extends Record<string, Schema>> = {
  [K in keyof T]: { type: K } & (T[K] extends Schema<infer V> ? V : never)
}[keyof T]

export class TaggedUnion<T extends Record<string, Schema>> {
  constructor(
    private tag: string,
    private variants: T,
  ) {}

  validate(
    value: unknown,
  ):
    | { success: true; value: TaggedUnionValue<T> }
    | { success: false; error: string } {
    if (typeof value !== 'object' || value === null) {
      return { success: false, error: 'Expected object' }
    }
    const obj = value as Record<string, unknown>
    const tagValue = obj[this.tag]
    if (typeof tagValue !== 'string') {
      return { success: false, error: `Missing or invalid tag "${String(this.tag)}"` }
    }
    const variant = this.variants[tagValue]
    if (!variant) {
      const keys = Object.keys(this.variants)
      return {
        success: false,
        error: `Unknown tag value "${tagValue}". Expected one of [${keys.join(', ')}]`,
      }
    }
    const result = variant.validate(value)
    if (!result.success) return result
    return {
      success: true,
      value: { ...result.value, [this.tag]: tagValue } as TaggedUnionValue<T>,
    }
  }

  match(value: unknown): string | null {
    if (typeof value !== 'object' || value === null) return null
    const obj = value as Record<string, unknown>
    const tagValue = obj[this.tag]
    if (typeof tagValue !== 'string') return null
    if (this.variants[tagValue]) return tagValue
    return null
  }
}

// ============================================================================
// Branded types — nominal wrappers
// ============================================================================

export type Branded<T, Brand extends string> = T & { __brand: Brand }

export function brand<T, B extends string>(value: T, _brand: B): Branded<T, B> {
  return value as Branded<T, B>
}

// ============================================================================
// Pre-built branded identifiers
// ============================================================================

export type SessionID = Branded<string, 'SessionID'>
export type MessageID = Branded<string, 'MessageID'>
export type ToolID = Branded<string, 'ToolID'>
export type ProviderID = Branded<string, 'ProviderID'>
export type PermissionID = Branded<string, 'PermissionID'>

const SESSION_PREFIX = 'ses_'
const MESSAGE_PREFIX = 'msg_'
const TOOL_PREFIX = 'tool_'
const PROVIDER_PREFIX = 'prov_'
const PERMISSION_PREFIX = 'perm_'

function brandedStringSchema<B extends string>(
  brandName: B,
  prefix: string,
): Schema<Branded<string, B>> {
  return new Schema<Branded<string, B>>({
    type: 'string',
    validate: (value: unknown) => {
      if (typeof value !== 'string') {
        return { success: false, error: `Expected string for ${brandName}, got ${typeof value}` }
      }
      if (!value.startsWith(prefix)) {
        return {
          success: false,
          error: `Expected ${brandName} with prefix "${prefix}", got ${JSON.stringify(value)}`,
        }
      }
      return { success: true, value: value as Branded<string, B> }
    },
  })
}

export const SessionIDSchema: Schema<SessionID> = brandedStringSchema('SessionID', SESSION_PREFIX)
export const MessageIDSchema: Schema<MessageID> = brandedStringSchema('MessageID', MESSAGE_PREFIX)
export const ToolIDSchema: Schema<ToolID> = brandedStringSchema('ToolID', TOOL_PREFIX)
export const ProviderIDSchema: Schema<ProviderID> = brandedStringSchema('ProviderID', PROVIDER_PREFIX)
export const PermissionIDSchema: Schema<PermissionID> = brandedStringSchema('PermissionID', PERMISSION_PREFIX)

export function generateSessionID(): SessionID {
  return brand(`ses_${crypto.randomUUID()}`, 'SessionID')
}

export function generateMessageID(): MessageID {
  return brand(`msg_${crypto.randomUUID()}`, 'MessageID')
}

export function generateToolID(): ToolID {
  return brand(`tool_${crypto.randomUUID()}`, 'ToolID')
}

export function generateProviderID(): ProviderID {
  return brand(`prov_${crypto.randomUUID()}`, 'ProviderID')
}

export function generatePermissionID(): PermissionID {
  return brand(`perm_${crypto.randomUUID()}`, 'PermissionID')
}

export function isSessionID(value: unknown): value is SessionID {
  return typeof value === 'string' && value.startsWith(SESSION_PREFIX)
}

export function isMessageID(value: unknown): value is MessageID {
  return typeof value === 'string' && value.startsWith(MESSAGE_PREFIX)
}

export function isToolID(value: unknown): value is ToolID {
  return typeof value === 'string' && value.startsWith(TOOL_PREFIX)
}

export function isProviderID(value: unknown): value is ProviderID {
  return typeof value === 'string' && value.startsWith(PROVIDER_PREFIX)
}

export function isPermissionID(value: unknown): value is PermissionID {
  return typeof value === 'string' && value.startsWith(PERMISSION_PREFIX)
}

// ============================================================================
// JSON Schema generation
// ============================================================================

export interface JsonSchema {
  type?: string
  properties?: Record<string, JsonSchema>
  additionalProperties?: JsonSchema | boolean
  items?: JsonSchema
  required?: string[]
  enum?: unknown[]
  description?: string
  $ref?: string
  oneOf?: JsonSchema[]
  anyOf?: JsonSchema[]
  nullable?: boolean
}

function isOptionalSchema(s: Schema<any>): boolean {
  return s.type === 'optional'
}

function unwrapOptional(s: Schema<any>): Schema<any> {
  return s.type === 'optional' && s.inner ? s.inner : s
}

export function toJsonSchema(schema: Schema<any>): JsonSchema {
  switch (schema.type) {
    case 'string': {
      const js: JsonSchema = { type: 'string' }
      if (schema.description) js.description = schema.description
      return js
    }
    case 'number': {
      const js: JsonSchema = { type: 'number' }
      if (schema.description) js.description = schema.description
      return js
    }
    case 'boolean': {
      const js: JsonSchema = { type: 'boolean' }
      if (schema.description) js.description = schema.description
      return js
    }
    case 'literal': {
      return { enum: [schema.literalValue] }
    }
    case 'array': {
      const js: JsonSchema = { type: 'array' }
      if (schema.inner) js.items = toJsonSchema(schema.inner)
      if (schema.description) js.description = schema.description
      return js
    }
    case 'record': {
      const js: JsonSchema = { type: 'object' }
      if (schema.inner) js.additionalProperties = toJsonSchema(schema.inner)
      if (schema.description) js.description = schema.description
      return js
    }
    case 'union': {
      if (schema.schemas && schema.schemas.length > 0) {
        return { anyOf: schema.schemas.map((s) => toJsonSchema(s)) }
      }
      return {}
    }
    case 'optional': {
      if (schema.inner) {
        const inner = schema.inner
        const js = toJsonSchema(inner)
        if (inner.type === 'nullable') js.nullable = true
        return js
      }
      return {}
    }
    case 'nullable': {
      if (schema.inner) {
        const js = toJsonSchema(schema.inner)
        js.nullable = true
        return js
      }
      return { nullable: true }
    }
    case 'struct': {
      const js: JsonSchema = { type: 'object' }
      if (schema.description) js.description = schema.description
      if (schema.fields) {
        js.properties = {}
        const required: string[] = []
        for (const [key, field] of Object.entries(schema.fields)) {
          const inner = unwrapOptional(field)
          js.properties[key] = toJsonSchema(inner)
          if (inner.type === 'nullable') {
            js.properties[key].nullable = true
          }
          if (!isOptionalSchema(field)) {
            required.push(key)
          }
        }
        if (required.length > 0) js.required = required
      }
      return js
    }
    case 'enum': {
      const js: JsonSchema = {}
      if (schema.enumValues && schema.enumValues.length > 0) {
        js.enum = [...schema.enumValues]
      }
      if (schema.description) js.description = schema.description
      return js
    }
    default:
      return {}
  }
}

// ============================================================================
// Codec — encode/decode pairs
// ============================================================================

export interface Codec<T> {
  encode: (value: T) => unknown
  decode: (value: unknown) => T
  schema: Schema<T>
}

export function codec<T>(
  schema: Schema<T>,
  encode?: (value: T) => unknown,
): Codec<T> {
  const doEncode = encode ?? ((value: T): unknown => value)
  return {
    encode: doEncode,
    decode: (value: unknown): T => validate(schema, value),
    schema,
  }
}

// ============================================================================
// Pipe utility
// ============================================================================

export function pipe<T, R>(value: T, ...fns: ((v: any) => any)[]): R {
  let result: any = value
  for (const fn of fns) {
    result = fn(result)
  }
  return result as R
}
