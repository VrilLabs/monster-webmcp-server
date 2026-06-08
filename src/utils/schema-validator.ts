/**
 * MonsterWebMCP - JSON Schema Validator
 * Lightweight JSON Schema validation without external dependencies
 * Validates tool input schemas and execution arguments
 */

import type { JSONSchema, JSONSchemaProperty } from '../core/types';

export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate a value against a JSON Schema property definition
 */
function validateProperty(
  value: unknown,
  schema: JSONSchemaProperty,
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (value === undefined || value === null) {
    // null is valid if type includes 'null'
    return errors;
  }

  // Type check
  if (schema.type) {
    const actualType = getTypeOf(value);
    const expectedTypes: string[] = Array.isArray(schema.type) ? schema.type : [schema.type];
    const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];

    if (!expectedTypes.some(t => t === actualType || (t === 'number' && actualType === 'integer'))) {
      // Allow integer as number
      if (!(schema.type === 'number' && actualType === 'integer')) {
        errors.push({
          path,
          message: `Expected type ${expectedTypes.join('|')}, got ${actualType}`,
          value,
        });
        return errors; // Skip further validation if type is wrong
      }
    }
  }

  // String validations
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path,
        message: `String length ${value.length} is less than minimum ${schema.minLength}`,
        value,
      });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path,
        message: `String length ${value.length} exceeds maximum ${schema.maxLength}`,
        value,
      });
    }
    if (schema.pattern !== undefined) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push({
          path,
          message: `String does not match pattern ${schema.pattern}`,
          value,
        });
      }
    }
    if (schema.enum !== undefined && !schema.enum.includes(value)) {
      errors.push({
        path,
        message: `Value not in enum: [${schema.enum.join(', ')}]`,
        value,
      });
    }
    if (schema.format !== undefined) {
      const formatValid = validateFormat(value, schema.format);
      if (!formatValid) {
        errors.push({
          path,
          message: `String does not match format "${schema.format}"`,
          value,
        });
      }
    }
  }

  // Number validations
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        path,
        message: `Value ${value} is less than minimum ${schema.minimum}`,
        value,
      });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        path,
        message: `Value ${value} exceeds maximum ${schema.maximum}`,
        value,
      });
    }
    if (schema.enum !== undefined && !schema.enum.includes(String(value))) {
      errors.push({
        path,
        message: `Value not in enum: [${schema.enum.join(', ')}]`,
        value,
      });
    }
  }

  // Array validations
  if (Array.isArray(value) && schema.items) {
    for (let i = 0; i < value.length; i++) {
      errors.push(...validateProperty(value[i], schema.items, `${path}[${i}]`));
    }
  }

  // Object validations
  if (typeof value === 'object' && value !== null && !Array.isArray(value) && schema.properties) {
    const obj = value as Record<string, unknown>;
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in obj) {
        errors.push(...validateProperty(obj[key], propSchema, `${path}.${key}`));
      }
    }

    // Check additionalProperties
    if (schema.additionalProperties === false) {
      const allowedKeys = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(obj)) {
        if (!allowedKeys.has(key)) {
          errors.push({
            path: `${path}.${key}`,
            message: `Additional property "${key}" is not allowed`,
            value: obj[key],
          });
        }
      }
    } else if (typeof schema.additionalProperties === 'object') {
      const allowedKeys = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(obj)) {
        if (!allowedKeys.has(key)) {
          errors.push(...validateProperty(obj[key], schema.additionalProperties, `${path}.${key}`));
        }
      }
    }

    // Check required within nested object
    if (schema.required) {
      for (const reqKey of schema.required) {
        if (!(reqKey in obj)) {
          errors.push({
            path: `${path}.${reqKey}`,
            message: `Required property "${reqKey}" is missing`,
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Get the JSON Schema type of a JavaScript value
 */
function getTypeOf(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value as number)) return 'integer';
  return typeof value;
}

/**
 * Validate string format constraints
 */
function validateFormat(value: string, format: string): boolean {
  switch (format) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'uri':
    case 'url':
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
    case 'date-time':
      return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) && !isNaN(Date.parse(value));
    case 'uuid':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    default:
      return true; // Unknown formats pass
  }
}

/**
 * Validate arguments against a tool's input schema
 */
export function validateArguments(
  args: Record<string, unknown>,
  schema: JSONSchema
): ValidationResult {
  const errors: ValidationError[] = [];

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in args) || args[field] === undefined || args[field] === null) {
        errors.push({
          path: field,
          message: `Required property "${field}" is missing`,
        });
      }
    }
  }

  // Validate each provided property
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in args && args[key] !== undefined && args[key] !== null) {
        errors.push(...validateProperty(args[key], propSchema, key));
      }
    }
  }

  // Check additionalProperties
  if (schema.additionalProperties === false && schema.properties) {
    const allowedKeys = new Set(Object.keys(schema.properties));
    for (const key of Object.keys(args)) {
      if (!allowedKeys.has(key)) {
        errors.push({
          path: key,
          message: `Additional property "${key}" is not allowed`,
          value: args[key],
        });
      }
    }
  } else if (typeof schema.additionalProperties === 'object' && schema.properties) {
    const allowedKeys = new Set(Object.keys(schema.properties));
    for (const key of Object.keys(args)) {
      if (!allowedKeys.has(key)) {
        errors.push(...validateProperty(args[key], schema.additionalProperties, key));
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that a schema is a valid JSON Schema object
 */
export function isValidJsonSchema(schema: unknown): boolean {
  if (typeof schema !== 'object' || schema === null) return false;
  const s = schema as Record<string, unknown>;

  // Must have type: 'object' at root level
  if (s.type !== 'object') return false;

  // If properties is defined, it must be an object
  if (s.properties !== undefined) {
    if (typeof s.properties !== 'object' || s.properties === null) return false;
    for (const prop of Object.values(s.properties as Record<string, unknown>)) {
      if (typeof prop !== 'object' || prop === null) return false;
    }
  }

  // If required is defined, it must be an array of strings
  if (s.required !== undefined) {
    if (!Array.isArray(s.required)) return false;
    for (const item of s.required) {
      if (typeof item !== 'string') return false;
    }
  }

  return true;
}

/**
 * Format validation errors into a readable string
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map((e) => (e.path ? `${e.path}: ${e.message}` : e.message))
    .join('; ');
}
