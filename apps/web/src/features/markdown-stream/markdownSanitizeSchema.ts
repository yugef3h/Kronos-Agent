import { defaultSchema } from 'rehype-sanitize';

const codeAttributes = [...(defaultSchema.attributes?.code ?? []), 'className', 'class'];
const preAttributes = [...(defaultSchema.attributes?.pre ?? []), 'className', 'class'];
const spanAttributes = [...(defaultSchema.attributes?.span ?? []), 'className', 'class'];

export const markdownSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: codeAttributes,
    pre: preAttributes,
    span: spanAttributes,
  },
};
