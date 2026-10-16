import { describe, it, expect } from 'vitest';
import { isEditableElement, detectSelectionType } from '../selection';

describe('Selection & Editable Element Detection', () => {
  it('detects input fields and textareas as editable', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const div = document.createElement('div');
    const editableDiv = document.createElement('div');
    editableDiv.contentEditable = 'true';

    expect(isEditableElement(input)).toBe(true);
    expect(isEditableElement(textarea)).toBe(true);
    expect(isEditableElement(editableDiv)).toBe(true);
    expect(isEditableElement(div)).toBe(false);
  });

  it('normalizes punctuation around selected words', () => {
    const testCases = [
      { raw: '  scrutiny,  ', expected: 'scrutiny' },
      { raw: '"mitigate"', expected: 'mitigate' },
      { raw: 'ephemeral.', expected: 'ephemeral' },
      { raw: '(ubiquitous)', expected: 'ubiquitous' },
      { raw: 'well-being', expected: 'well-being' }
    ];

    for (const { raw, expected } of testCases) {
      const clean = raw.trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
      expect(clean).toBe(expected);
    }
  });

  it('detects nested children inside contenteditable and role="textbox" as editable', () => {
    const parentEditable = document.createElement('div');
    parentEditable.contentEditable = 'true';
    const childSpan = document.createElement('span');
    parentEditable.appendChild(childSpan);
    document.body.appendChild(parentEditable);

    expect(isEditableElement(childSpan)).toBe(true);

    const roleBox = document.createElement('div');
    roleBox.setAttribute('role', 'textbox');
    const roleChild = document.createElement('p');
    roleBox.appendChild(roleChild);
    document.body.appendChild(roleBox);

    expect(isEditableElement(roleChild)).toBe(true);

    document.body.removeChild(parentEditable);
    document.body.removeChild(roleBox);
  });

  describe('detectSelectionType', () => {
    it('accurately detects single words', () => {
      expect(detectSelectionType('scrutiny')).toBe('word');
      expect(detectSelectionType('ephemeral')).toBe('word');
      expect(detectSelectionType('well-being')).toBe('word');
      expect(detectSelectionType('state-of-the-art')).toBe('word');
    });

    it('accurately detects short and long phrases without finite clauses', () => {
      expect(detectSelectionType('take off')).toBe('phrase');
      expect(detectSelectionType('in spite of')).toBe('phrase');
      expect(detectSelectionType('piece of cake')).toBe('phrase');
      expect(detectSelectionType('on the other hand')).toBe('phrase');
      // Long prepositional / noun phrase without finite main verb
      expect(detectSelectionType('under the direct supervision of the chief medical officer')).toBe('phrase');
      expect(detectSelectionType('in accordance with the provisions set forth by the committee')).toBe('phrase');
    });

    it('accurately detects complete sentences including short sentences, clause fragments, and long sentences', () => {
      // Short sentence with terminal punctuation
      expect(detectSelectionType('He laughed.')).toBe('sentence');
      expect(detectSelectionType('It works!')).toBe('sentence');
      expect(detectSelectionType('Why not?')).toBe('sentence');

      // Short sentence without terminal punctuation (has subject + finite verb)
      expect(detectSelectionType('he laughed')).toBe('sentence');
      expect(detectSelectionType('she left early')).toBe('sentence');
      expect(detectSelectionType('the committee approved the proposal')).toBe('sentence');

      // News headlines and article titles without terminal punctuation
      expect(detectSelectionType('19 fire engines battle blaze at Tongi pharmaceutical factory')).toBe('sentence');
      expect(detectSelectionType('Fire breaks out at Tongi pharmaceutical factory')).toBe('sentence');
      expect(detectSelectionType('Police arrest three suspects in robbery case')).toBe('sentence');
      expect(detectSelectionType('Bangladesh wins historic test against Pakistan')).toBe('sentence');
      expect(detectSelectionType('US inflation cools down in September')).toBe('sentence');

      // Long complex sentence (> 30 words, single terminal period) is classified as sentence, not paragraph
      const longSentence = 'Although the economic indicators showed a modest recovery in the third quarter, several leading analysts warned that persistent inflation and supply chain bottlenecks could undermine long-term stability across global markets.';
      expect(detectSelectionType(longSentence)).toBe('sentence');
    });

    it('accurately detects multi-sentence paragraphs and multi-line blocks', () => {
      // Multiple sentences with terminal punctuation
      expect(detectSelectionType('First sentence here. Second sentence starts right here.')).toBe('paragraph');
      // Multi-line block
      expect(detectSelectionType('Paragraph line 1\nParagraph line 2')).toBe('paragraph');
    });
  });
});

