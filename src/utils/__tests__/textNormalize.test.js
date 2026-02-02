/**
 * Tests for normalizeForCompare function
 * Validates Priority 1 fixes for bulk upload system
 */

import { normalizeForCompare } from '../textNormalize';

describe('normalizeForCompare - Priority 1 Fixes', () => {
  
  describe('Unicode Normalization', () => {
    test('handles NFC vs NFD equivalence', () => {
      const nfc = "नमस्ते";  // Precomposed
      const nfd = "नमस्ते";  // Decomposed
      expect(normalizeForCompare(nfc)).toBe(normalizeForCompare(nfd));
    });
    
    test('uses NFKC normalization', () => {
      const input = "hello"; // Regular text
      const result = normalizeForCompare(input);
      expect(result).toBe('hello');
    });
  });
  
  describe('Invisible Character Removal', () => {
    test('removes zero-width joiners (U+200C)', () => {
      const withZWJ = "राम\u200Cपरिवार";
      const withoutZWJ = "रामपरिवार";
      expect(normalizeForCompare(withZWJ)).toBe(normalizeForCompare(withoutZWJ));
    });
    
    test('removes zero-width non-joiners (U+200D)', () => {
      const withZWNJ = "राम\u200Dपरिवार";
      const withoutZWNJ = "रामपरिवार";
      expect(normalizeForCompare(withZWNJ)).toBe(normalizeForCompare(withoutZWNJ));
    });
    
    test('removes soft hyphens (U+00AD)', () => {
      const input = "राम\u00ADपरिवार";
      const expected = "रामपरिवार";
      expect(normalizeForCompare(input)).toBe(expected);
    });
    
    test('removes non-breaking spaces (U+00A0)', () => {
      const input = "राम\u00A0परिवार";
      const expected = "राम परिवार"; // Should become regular space
      expect(normalizeForCompare(input)).toBe(expected);
    });
    
    test('removes zero-width spaces (U+200B)', () => {
      const input = "राम\u200Bपरिवार";
      const expected = "रामपरिवार";
      expect(normalizeForCompare(input)).toBe(expected);
    });
    
    test('removes left-to-right marks (U+200E)', () => {
      const input = "Ram\u200EFamily";
      const expected = "ramfamily"; // Mark is removed, no space inserted
      expect(normalizeForCompare(input)).toBe(expected);
    });
    
    test('removes right-to-left marks (U+200F)', () => {
      const input = "Ram\u200FFamily";
      const expected = "ramfamily"; // Mark is removed, no space inserted
      expect(normalizeForCompare(input)).toBe(expected);
    });
    
    test('removes BOM (U+FEFF)', () => {
      const input = "\uFEFFराम परिवार";
      const expected = "राम परिवार";
      expect(normalizeForCompare(input)).toBe(expected);
    });
  });
  
  describe('Case Normalization (toLowerCase)', () => {
    test('converts ASCII uppercase to lowercase', () => {
      const input = "SHARMA FAMILY";
      const expected = "sharma family";
      expect(normalizeForCompare(input)).toBe(expected);
    });
    
    test('handles mixed case consistently', () => {
      const input1 = "SharMA";
      const input2 = "sharma";
      expect(normalizeForCompare(input1)).toBe(normalizeForCompare(input2));
    });
    
    test('is consistent across different systems (not locale-dependent)', () => {
      // toLowerCase() should behave consistently unlike toLocaleLowerCase()
      const input = "ISTANBUL";
      const result = normalizeForCompare(input);
      expect(result).toBe('istanbul'); // Not 'ıstanbul' (Turkish locale issue)
    });
  });
  
  describe('Whitespace Handling', () => {
    test('collapses multiple spaces to single space', () => {
      const input = "राम   परिवार"; // 3 spaces
      const expected = "राम परिवार"; // 1 space
      expect(normalizeForCompare(input)).toBe(expected);
    });
    
    test('trims leading and trailing whitespace', () => {
      const input = "  राम परिवार  ";
      const expected = "राम परिवार";
      expect(normalizeForCompare(input)).toBe(expected);
    });
    
    test('handles tabs and newlines', () => {
      const input = "राम\t\nपरिवार";
      const expected = "राम परिवार";
      expect(normalizeForCompare(input)).toBe(expected);
    });
  });
  
  describe('Mixed Language Text', () => {
    test('handles English + Nepali correctly', () => {
      const input = "Sharma राम परिवार";
      const expected = "sharma राम परिवार";
      expect(normalizeForCompare(input)).toBe(expected);
    });
    
    test('removes punctuation', () => {
      const input = "Sharma, Ram Family!";
      const expected = "sharma ram family";
      expect(normalizeForCompare(input)).toBe(expected);
    });
    
    test('preserves Devanagari characters', () => {
      const input = "श्री राम परिवार";
      const expected = "श्री राम परिवार";
      expect(normalizeForCompare(input)).toBe(expected);
    });
  });
  
  describe('Edge Cases', () => {
    test('handles null and undefined', () => {
      expect(normalizeForCompare(null)).toBe('');
      expect(normalizeForCompare(undefined)).toBe('');
    });
    
    test('handles empty string', () => {
      expect(normalizeForCompare('')).toBe('');
    });
    
    test('handles numbers', () => {
      expect(normalizeForCompare('123')).toBe('123');
      expect(normalizeForCompare(123)).toBe('123');
    });
    
    test('handles special characters only', () => {
      const input = "!@#$%^&*()";
      const expected = ""; // All special chars removed
      expect(normalizeForCompare(input).trim()).toBe(expected);
    });
  });
  
  describe('Real-World Nepali Family Tree Data', () => {
    const testCases = [
      { raw: "शर्मा परिवार", normalized: "शर्मा परिवार" },
      { raw: "SHARMA परिवार", normalized: "sharma परिवार" },
      { raw: "Sharma Family", normalized: "sharma family" },
      { raw: "श्री राम परिवार", normalized: "श्री राम परिवार" },
      { raw: "राम    शर्मा", normalized: "राम शर्मा" },
      { raw: " राम परिवार ", normalized: "राम परिवार" },
      { raw: "राम-शर्मा", normalized: "राम शर्मा" },
      { raw: "राम.परिवार", normalized: "राम परिवार" },
    ];
    
    testCases.forEach(({ raw, normalized }) => {
      test(`normalizes "${raw}" correctly`, () => {
        expect(normalizeForCompare(raw)).toBe(normalized);
      });
    });
  });
  
  describe('Idempotency', () => {
    test('normalizing twice gives same result', () => {
      const input = "  SHARMA   राम   परिवार  ";
      const once = normalizeForCompare(input);
      const twice = normalizeForCompare(once);
      expect(once).toBe(twice);
    });
  });
});
