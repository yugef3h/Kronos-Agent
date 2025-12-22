import {
  closeOpenMarkdownFence,
  inferCodeLanguage,
  isInsideOpenCodeFence,
  prepareStreamingMarkdown,
  wrapBareCodeStream,
} from './streamingMarkdown';

describe('streamingMarkdown', () => {
  it('closes an open fence for streaming markdown', () => {
    const input = '说明\n```typescript\nconst a = 1\n';
    expect(closeOpenMarkdownFence(input)).toBe(`${input}\n\`\`\``);
    expect(isInsideOpenCodeFence(input)).toBe(true);
  });

  it('wraps bare code-like streams', () => {
    const input = 'export const foo = () => {\n  return 1;\n';
    expect(wrapBareCodeStream(input)).toBe('```typescript\nexport const foo = () => {\n  return 1;\n');
  });

  it('prepares streaming markdown without touching completed fences', () => {
    const input = '```js\nconsole.log(1)\n```';
    expect(prepareStreamingMarkdown(input, true)).toBe(input);
  });

  it('infers typescript for import syntax', () => {
    expect(inferCodeLanguage("import { x } from 'y'")).toBe('typescript');
  });
});
