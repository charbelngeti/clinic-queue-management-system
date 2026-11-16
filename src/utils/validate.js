import mongoose from 'mongoose';
import { invalid } from './errors.js';

/**
 * Minimal declarative validator for request bodies/queries (server-side validation, NFR-SEC-04).
 * Returns a new object containing only the declared fields (unknown fields are dropped),
 * trimmed and type-coerced. Throws a 422 AppError with per-field messages on failure.
 *
 * rule = { type: 'string'|'number'|'int'|'boolean'|'date'|'objectId'|'array'|'object',
 *          required, min, max, enum, pattern, label, of (rule for array items), fields (for objects),
 *          lowercase, default }
 */
export function validate(input, schema, { partial = false } = {}) {
  const errors = {};
  const out = {};
  const src = input && typeof input === 'object' ? input : {};

  for (const [key, rule] of Object.entries(schema)) {
    const label = rule.label || key;
    let value = src[key];
    if (typeof value === 'string') value = value.trim();
    const missing = value === undefined || value === null || value === '';

    if (missing) {
      if (partial) {
        // In a partial update, sending an empty value for an optional field clears it.
        if (key in src) {
          if (rule.required) errors[key] = `${label} is required.`;
          else out[key] = null;
        }
      } else if (rule.required) errors[key] = `${label} is required.`;
      else if (rule.default !== undefined) out[key] = rule.default;
      continue;
    }
    const result = checkValue(value, rule, label);
    if (result.error) errors[key] = result.error;
    else out[key] = result.value;
  }

  if (Object.keys(errors).length) throw invalid(errors);
  return out;
}

function checkValue(value, rule, label) {
  switch (rule.type) {
    case 'string': {
      if (typeof value !== 'string') return { error: `${label} must be text.` };
      let v = rule.lowercase ? value.toLowerCase() : value;
      if (rule.min !== undefined && v.length < rule.min) return { error: `${label} must be at least ${rule.min} characters.` };
      if (rule.max !== undefined && v.length > rule.max) return { error: `${label} must be at most ${rule.max} characters.` };
      if (rule.enum && !rule.enum.includes(v)) return { error: `${label} must be one of: ${rule.enum.join(', ')}.` };
      if (rule.pattern && !rule.pattern.test(v)) return { error: rule.patternMessage || `${label} has an invalid format.` };
      return { value: v };
    }
    case 'number':
    case 'int': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return { error: `${label} must be a number.` };
      if (rule.type === 'int' && !Number.isInteger(n)) return { error: `${label} must be a whole number.` };
      if (rule.min !== undefined && n < rule.min) return { error: `${label} must be at least ${rule.min}.` };
      if (rule.max !== undefined && n > rule.max) return { error: `${label} must be at most ${rule.max}.` };
      return { value: n };
    }
    case 'boolean': {
      if (typeof value === 'boolean') return { value };
      if (value === 'true') return { value: true };
      if (value === 'false') return { value: false };
      return { error: `${label} must be true or false.` };
    }
    case 'date': {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return { error: `${label} must be a valid date.` };
      return { value: d };
    }
    case 'dateString': {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))
        return { error: `${label} must be a date in YYYY-MM-DD format.` };
      return { value };
    }
    case 'time': {
      if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
        return { error: `${label} must be a time in HH:MM format.` };
      return { value };
    }
    case 'objectId': {
      if (!mongoose.isValidObjectId(value) || String(value).length !== 24) return { error: `${label} is not a valid reference.` };
      return { value: String(value) };
    }
    case 'array': {
      if (!Array.isArray(value)) return { error: `${label} must be a list.` };
      if (rule.min !== undefined && value.length < rule.min) return { error: `${label} needs at least ${rule.min} item(s).` };
      if (rule.max !== undefined && value.length > rule.max) return { error: `${label} can have at most ${rule.max} items.` };
      if (!rule.of) return { value };
      const items = [];
      for (let i = 0; i < value.length; i++) {
        let item = value[i];
        if (typeof item === 'string') item = item.trim();
        if (rule.of.type === 'object') {
          try {
            items.push(validate(item, rule.of.fields));
          } catch (e) {
            const first = Object.values(e.details || {})[0];
            return { error: `${label} item ${i + 1}: ${first || 'invalid'}` };
          }
        } else {
          const r = checkValue(item, rule.of, `${label} item ${i + 1}`);
          if (r.error) return r;
          items.push(r.value);
        }
      }
      return { value: items };
    }
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) return { error: `${label} is invalid.` };
      try {
        return { value: validate(value, rule.fields) };
      } catch (e) {
        const first = Object.values(e.details || {})[0];
        return { error: `${label}: ${first || 'invalid'}` };
      }
    }
    default:
      return { value };
  }
}

export const PHONE = { pattern: /^\+?[0-9 ]{9,15}$/, patternMessage: 'Phone must be 9–15 digits, optionally starting with +.' };
export const EMAIL = { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, patternMessage: 'Enter a valid email address.' };
export const PASSWORD_RULE = {
  type: 'string',
  min: 8,
  max: 72,
  pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/,
  patternMessage: 'Password must be at least 8 characters and contain letters and numbers.',
};

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
