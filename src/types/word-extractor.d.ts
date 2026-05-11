declare module 'word-extractor' {
  export interface Document {
    getBody(): string;
    getFooters(): string;
    getHeaders(): string;
  }
  export default class WordExtractor {
    extract(source: string | Buffer): Promise<Document>;
  }
}
