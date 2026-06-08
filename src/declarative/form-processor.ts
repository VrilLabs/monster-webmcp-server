/**
 * MonsterWebMCP - Declarative Form Processor
 * Processes HTML form elements with WebMCP declarative attributes:
 * - toolname: Registers the form as a tool
 * - tooldescription: Tool description
 * - toolautosubmit: Auto-submit the form when agent calls the tool
 * - toolparamdescription: Per-input parameter descriptions
 * - SubmitEvent.respondWith(): Pattern for returning tool results
 */

import type { MonsterMCP } from '../core/monster-mcp';
import type { JSONSchema, JSONSchemaProperty, ToolResult } from '../core/types';

const TOOL_NAME_ATTR = 'toolname';
const TOOL_DESC_ATTR = 'tooldescription';
const AUTO_SUBMIT_ATTR = 'toolautosubmit';
const PARAM_DESC_ATTR = 'toolparamdescription';

export class DeclarativeProcessor {
  private monsterMCP: MonsterMCP;
  private observer: MutationObserver | null = null;
  private processedForms: WeakSet<HTMLFormElement> = new WeakSet();
  private destroyed = false;

  constructor(monsterMCP: MonsterMCP) {
    this.monsterMCP = monsterMCP;

    if (typeof document === 'undefined') return;

    // Process existing forms on the page
    this.processExistingForms();

    // Set up MutationObserver for dynamically added forms
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [TOOL_NAME_ATTR, TOOL_DESC_ATTR, AUTO_SUBMIT_ATTR],
    });
  }

  /**
   * Process all existing forms on the page that have toolname attribute
   */
  private processExistingForms(): void {
    if (typeof document === 'undefined') return;

    const forms = document.querySelectorAll(`form[${TOOL_NAME_ATTR}]`);
    for (const form of forms) {
      if (form instanceof HTMLFormElement) {
        this.processForm(form);
      }
    }
  }

  /**
   * Handle DOM mutations to detect new/changed forms
   */
  private handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      // Check added nodes for new forms
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLFormElement) {
          if (node.hasAttribute(TOOL_NAME_ATTR)) {
            this.processForm(node);
          }
        }
        // Check children of added nodes
        if (node instanceof HTMLElement) {
          const forms = node.querySelectorAll(`form[${TOOL_NAME_ATTR}]`);
          for (const form of forms) {
            if (form instanceof HTMLFormElement) {
              this.processForm(form);
            }
          }
        }
      }

      // Handle attribute changes on existing forms
      if (mutation.type === 'attributes' && mutation.target instanceof HTMLFormElement) {
        if (mutation.target.hasAttribute(TOOL_NAME_ATTR)) {
          this.processForm(mutation.target);
        }
      }
    }
  }

  /**
   * Process a single form element and register it as a tool
   */
  private processForm(form: HTMLFormElement): void {
    const name = form.getAttribute(TOOL_NAME_ATTR);
    if (!name) return;

    // Avoid double-processing
    if (this.processedForms.has(form)) return;
    this.processedForms.add(form);

    const description = form.getAttribute(TOOL_DESC_ATTR) || `Tool: ${name}`;
    const autoSubmit = form.hasAttribute(AUTO_SUBMIT_ATTR);

    // Build JSON Schema from form inputs
    const inputSchema = this.buildSchema(form);

    // Store the respondWith callback on the form
    const respondWithCallbacks: Map<string, (result: ToolResult) => void> = new Map();

    // Register the tool
    this.monsterMCP.registerTool({
      name,
      description,
      inputSchema,
      execute: async (args, signal) => {
        // Fill the form with provided arguments
        this.fillForm(form, args);

        if (autoSubmit) {
          // For autoSubmit forms, we trigger form submission
          // and wait for the respondWith callback
          return new Promise<ToolResult>((resolve) => {
            const requestId = `${name}_${Date.now()}`;
            respondWithCallbacks.set(requestId, resolve);

            // Set up the respondWith function on the form's submit event
            const handleSubmit = (e: Event) => {
              e.preventDefault();

              // Create a mock SubmitEvent with respondWith
              const respondWith = (result: ToolResult) => {
                respondWithCallbacks.delete(requestId);
                form.removeEventListener('submit', handleSubmit);
                resolve(result);
              };

              // Store respondWith on the event for user code to call
              (e as SubmitEvent & { respondWith: (result: ToolResult) => void }).respondWith = respondWith;

              // Dispatch a custom event so user code can handle and call respondWith
              const customEvent = new CustomEvent('toolsubmit', {
                detail: { args, respondWith, form },
                bubbles: true,
              });
              form.dispatchEvent(customEvent);

              // If no one calls respondWith within a timeout, resolve with form data
              setTimeout(() => {
                if (respondWithCallbacks.has(requestId)) {
                  respondWithCallbacks.delete(requestId);
                  form.removeEventListener('submit', handleSubmit);
                  const formData = new FormData(form);
                  const data: Record<string, string> = {};
                  formData.forEach((value, key) => {
                    data[key] = value as string;
                  });
                  resolve({
                    content: [
                      {
                        type: 'text',
                        text: JSON.stringify(data),
                      },
                    ],
                  });
                }
              }, 5000);
            };

            form.addEventListener('submit', handleSubmit);

            // Trigger the submit
            if (signal?.aborted) {
              form.removeEventListener('submit', handleSubmit);
              respondWithCallbacks.delete(requestId);
              return resolve({
                content: [{ type: 'text', text: 'Tool execution aborted' }],
                isError: true,
              });
            }

            form.requestSubmit();
          });
        }

        // Non-autoSubmit: just return the arguments as the result
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(args, null, 2),
            },
          ],
        };
      },
    });
  }

  /**
   * Build a JSON Schema from form input elements
   */
  private buildSchema(form: HTMLFormElement): JSONSchema {
    const properties: Record<string, JSONSchemaProperty> = {};
    const required: string[] = [];

    const inputs = form.querySelectorAll(
      'input, select, textarea'
    );

    for (const element of inputs) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) {
        continue;
      }

      const inputName = element.getAttribute('name');
      if (!inputName) continue;

      const paramDescription = element.getAttribute(PARAM_DESC_ATTR) || '';
      const isRequired = element.hasAttribute('required');
      const inputType = element instanceof HTMLInputElement ? element.type : 'text';

      let schema: JSONSchemaProperty;

      if (element instanceof HTMLSelectElement) {
        // Build enum from option values
        const options = Array.from(element.options);
        const enumValues = options
          .filter((opt) => opt.value !== '')
          .map((opt) => opt.value);

        schema = {
          type: 'string',
          description: paramDescription || `Select ${inputName}`,
          enum: enumValues.length > 0 ? enumValues : undefined,
        };
      } else if (element instanceof HTMLTextAreaElement) {
        schema = {
          type: 'string',
          description: paramDescription || `Text input ${inputName}`,
        };
      } else {
        // HTMLInputElement
        switch (inputType) {
          case 'number':
          case 'range':
            schema = {
              type: 'number',
              description: paramDescription || `Number input ${inputName}`,
            };
            if (element instanceof HTMLInputElement) {
              if (element.min) schema.minimum = parseFloat(element.min);
              if (element.max) schema.maximum = parseFloat(element.max);
            }
            break;

          case 'checkbox':
            schema = {
              type: 'boolean',
              description: paramDescription || `Checkbox ${inputName}`,
            };
            break;

          case 'date':
          case 'datetime-local':
            schema = {
              type: 'string',
              description: paramDescription || `Date input ${inputName}`,
              format: inputType === 'datetime-local' ? 'date-time' : 'date',
            };
            break;

          case 'email':
            schema = {
              type: 'string',
              description: paramDescription || `Email input ${inputName}`,
              format: 'email',
            };
            break;

          case 'url':
            schema = {
              type: 'string',
              description: paramDescription || `URL input ${inputName}`,
              format: 'uri',
            };
            break;

          case 'radio': {
            // Collect all radio inputs with the same name
            const radioGroup = form.querySelectorAll(`input[type="radio"][name="${inputName}"]`);
            const enumValues = Array.from(radioGroup)
              .map((radio) => (radio as HTMLInputElement).value)
              .filter((v) => v !== '');

            // Only create schema if not already created by a previous radio with same name
            if (properties[inputName]) continue;

            schema = {
              type: 'string',
              description: paramDescription || `Radio group ${inputName}`,
              enum: enumValues.length > 0 ? enumValues : undefined,
            };
            break;
          }

          default:
            schema = {
              type: 'string',
              description: paramDescription || `Text input ${inputName}`,
            };

            // Add enum for datalist-backed inputs
            if (element instanceof HTMLInputElement && element.list) {
              const datalist = element.list;
              const options = datalist.querySelectorAll('option');
              const enumValues = Array.from(options)
                .map((opt) => opt.value)
                .filter((v) => v !== '');
              if (enumValues.length > 0) {
                schema.enum = enumValues;
              }
            }

            // Add pattern if specified
            if (element instanceof HTMLInputElement && element.pattern) {
              schema.pattern = element.pattern;
            }

            // Add maxLength/minLength if specified
            if (element instanceof HTMLInputElement) {
              if (element.maxLength > 0) schema.maxLength = element.maxLength;
              if (element.minLength > 0) schema.minLength = element.minLength;
            }
            break;
        }
      }

      // Add default value if present
      if (element instanceof HTMLSelectElement) {
        if (element.value) {
          schema.default = element.value;
        }
      } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        if (element.defaultValue) {
          if (schema.type === 'number') {
            schema.default = parseFloat(element.defaultValue);
          } else if (schema.type === 'boolean') {
            schema.default = element.defaultValue === 'true' || element.defaultValue === 'on';
          } else {
            schema.default = element.defaultValue;
          }
        }
      }

      properties[inputName] = schema;

      if (isRequired) {
        required.push(inputName);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
      additionalProperties: false,
    };
  }

  /**
   * Fill a form with the provided arguments
   */
  private fillForm(form: HTMLFormElement, args: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(args)) {
      const input = form.querySelector(`[name="${key}"]`);
      if (!input) continue;

      if (input instanceof HTMLInputElement) {
        if (input.type === 'checkbox') {
          input.checked = Boolean(value);
        } else if (input.type === 'radio') {
          const radio = form.querySelector(
            `input[type="radio"][name="${key}"][value="${value}"]`
          ) as HTMLInputElement | null;
          if (radio) radio.checked = true;
        } else {
          input.value = String(value);
        }
      } else if (input instanceof HTMLSelectElement) {
        input.value = String(value);
      } else if (input instanceof HTMLTextAreaElement) {
        input.value = String(value);
      }
    }
  }

  /**
   * Destroy the processor and clean up
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
