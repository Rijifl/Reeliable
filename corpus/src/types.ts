export interface RawDocument {
  id: string;
  rawText: string;
  metadata: Record<string, string>;
}

export interface CorpusDocument {
  id: string;
  text: string;
  sourceName: string;
  sourceUrl: string;
  category: string; // oncology, nutrition, infectious_disease, etc.
}

export interface Passage {
  id: string;
  text: string;
  documentId: string;
  sourceName: string;
  sourceUrl: string;
  category: string;
}
