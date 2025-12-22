import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import shell from 'highlight.js/lib/languages/shell';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  sh: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  yaml: 'markdown',
  html: 'xml',
  htm: 'xml',
  txt: 'plaintext',
  text: 'plaintext',
};

let isRegistered = false;

const registerLanguages = () => {
  if (isRegistered) {
    return;
  }

  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('typescript', typescript);
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('shell', shell);
  hljs.registerLanguage('json', json);
  hljs.registerLanguage('css', css);
  hljs.registerLanguage('xml', xml);
  hljs.registerLanguage('java', java);
  hljs.registerLanguage('go', go);
  hljs.registerLanguage('rust', rust);
  hljs.registerLanguage('cpp', cpp);
  hljs.registerLanguage('markdown', markdown);

  isRegistered = true;
};

export const normalizeHighlightLanguage = (language: string): string => {
  const normalized = language.trim().toLowerCase();
  if (!normalized || normalized === 'plaintext') {
    return 'plaintext';
  }

  return LANGUAGE_ALIASES[normalized] ?? normalized;
};

export const highlightCodeBlock = (code: string, language: string): string => {
  registerLanguages();

  const normalized = normalizeHighlightLanguage(language);
  const trimmed = code.replace(/\n$/, '');

  try {
    if (normalized !== 'plaintext' && hljs.getLanguage(normalized)) {
      return hljs.highlight(trimmed, { language: normalized, ignoreIllegals: true }).value;
    }

    if (trimmed.length > 0) {
      return hljs.highlightAuto(trimmed, ['typescript', 'javascript', 'python', 'json', 'bash', 'xml']).value;
    }
  } catch {
    // fall through to escaped plain text
  }

  return escapeHtml(trimmed);
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};
