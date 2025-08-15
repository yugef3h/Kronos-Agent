declare module 'word-extractor' {
  export default class WordExtractor {
    extract(filePath: string): Promise<{
      getBody(): string;
    }>;
  }
}