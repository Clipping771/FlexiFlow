import { DictionaryResult } from '../../types';

export interface DictionaryProvider {
  name: string;
  lookup(word: string, contextSentence?: string): Promise<DictionaryResult | null>;
}
