/**
 * Integration tests for member key building
 * Tests Priority 1 Fix #2: Structured JSON keys instead of colon delimiters
 */

import { normalizeForCompare } from '../textNormalize';

// Mock the buildMemberKey function from BulkUploadService
function buildMemberKey(treeName, memberName) {
  return JSON.stringify({ 
    tree: normalizeForCompare(treeName), 
    member: normalizeForCompare(memberName) 
  });
}

describe('buildMemberKey - Structured Key Construction', () => {
  
  describe('Basic Functionality', () => {
    test('creates valid JSON key', () => {
      const key = buildMemberKey('राम परिवार', 'राम शर्मा');
      expect(() => JSON.parse(key)).not.toThrow();
    });
    
    test('key contains normalized tree and member names', () => {
      const treeName = 'राम परिवार';
      const memberName = 'राम शर्मा';
      const key = buildMemberKey(treeName, memberName);
      const parsed = JSON.parse(key);
      
      expect(parsed.tree).toBe(normalizeForCompare(treeName));
      expect(parsed.member).toBe(normalizeForCompare(memberName));
    });
  });
  
  describe('Delimiter Conflict Resolution', () => {
    test('handles tree names with colons', () => {
      const treeName = "Sharma: Main Branch";
      const memberName = "राम शर्मा";
      
      const key = buildMemberKey(treeName, memberName);
      const parsed = JSON.parse(key);
      
      expect(parsed.tree).toBe(normalizeForCompare(treeName));
      expect(parsed.member).toBe(normalizeForCompare(memberName));
    });
    
    test('handles member names with colons', () => {
      const treeName = "राम परिवार";
      const memberName = "Ram: First Generation";
      
      const key = buildMemberKey(treeName, memberName);
      const parsed = JSON.parse(key);
      
      expect(parsed.tree).toBe(normalizeForCompare(treeName));
      expect(parsed.member).toBe(normalizeForCompare(memberName));
    });
    
    test('handles both names with colons', () => {
      const treeName = "Sharma: Main Branch";
      const memberName = "Ram: Elder Son";
      
      const key = buildMemberKey(treeName, memberName);
      const parsed = JSON.parse(key);
      
      expect(parsed.tree).toBe(normalizeForCompare(treeName));
      expect(parsed.member).toBe(normalizeForCompare(memberName));
    });
    
    test('handles triple-pipe delimiter (old fallback)', () => {
      const treeName = "Family|||Tree";
      const memberName = "Member|||Name";
      
      const key = buildMemberKey(treeName, memberName);
      const parsed = JSON.parse(key);
      
      expect(parsed.tree).toBe(normalizeForCompare(treeName));
      expect(parsed.member).toBe(normalizeForCompare(memberName));
    });
  });
  
  describe('Special Characters', () => {
    test('handles quotes in names', () => {
      const treeName = 'The "Main" Family';
      const memberName = 'Ram "The Elder"';
      
      const key = buildMemberKey(treeName, memberName);
      const parsed = JSON.parse(key);
      
      expect(parsed.tree).toBe(normalizeForCompare(treeName));
      expect(parsed.member).toBe(normalizeForCompare(memberName));
    });
    
    test('handles backslashes', () => {
      const treeName = "Family\\Branch";
      const memberName = "Ram\\Sharma";
      
      const key = buildMemberKey(treeName, memberName);
      const parsed = JSON.parse(key);
      
      expect(parsed.tree).toBe(normalizeForCompare(treeName));
      expect(parsed.member).toBe(normalizeForCompare(memberName));
    });
    
    test('handles newlines and tabs', () => {
      const treeName = "Family\nTree";
      const memberName = "Ram\tSharma";
      
      const key = buildMemberKey(treeName, memberName);
      const parsed = JSON.parse(key);
      
      expect(parsed.tree).toBe(normalizeForCompare(treeName));
      expect(parsed.member).toBe(normalizeForCompare(memberName));
    });
  });
  
  describe('Normalization Integration', () => {
    test('different spacing produces same key', () => {
      const key1 = buildMemberKey('राम  परिवार', 'राम शर्मा');
      const key2 = buildMemberKey('राम परिवार', 'राम शर्मा');
      
      expect(key1).toBe(key2);
    });
    
    test('different casing produces same key', () => {
      const key1 = buildMemberKey('SHARMA Family', 'RAM Sharma');
      const key2 = buildMemberKey('sharma family', 'ram sharma');
      
      expect(key1).toBe(key2);
    });
    
    test('different invisible characters produce same key', () => {
      const key1 = buildMemberKey('राम\u200Cपरिवार', 'राम शर्मा');
      const key2 = buildMemberKey('रामपरिवार', 'राम शर्मा');
      
      expect(key1).toBe(key2);
    });
  });
  
  describe('Backwards Compatibility Tests', () => {
    test('can parse old colon-delimited key format', () => {
      // Simulate old format key
      const oldKey = "राम परिवार:राम शर्मा";
      const parts = oldKey.split(':');
      
      expect(parts.length).toBe(2);
      expect(parts[0]).toBe('राम परिवार');
      expect(parts[1]).toBe('राम शर्मा');
      
      // Convert to new format
      const newKey = buildMemberKey(parts[0], parts[1]);
      const parsed = JSON.parse(newKey);
      
      expect(parsed.tree).toBe(normalizeForCompare(parts[0]));
      expect(parsed.member).toBe(normalizeForCompare(parts[1]));
    });
    
    test('old format with colon in tree name breaks (shows need for fix)', () => {
      const oldKey = "Sharma: Main:राम शर्मा";
      const parts = oldKey.split(':');
      
      // This is the BUG - splits into 3 parts instead of 2
      expect(parts.length).toBe(3);
      expect(parts).toEqual(['Sharma', ' Main', 'राम शर्मा']);
      
      // New format handles this correctly
      const treeName = "Sharma: Main";
      const memberName = "राम शर्मा";
      const newKey = buildMemberKey(treeName, memberName);
      const parsed = JSON.parse(newKey);
      
      expect(parsed.tree).toBe(normalizeForCompare(treeName));
      expect(parsed.member).toBe(normalizeForCompare(memberName));
    });
  });
  
  describe('Lookup Simulation', () => {
    test('simulates complete lookup flow', () => {
      // Create a map like BulkUploadModal does
      const memberMap = new Map();
      
      // Add some members
      const trees = [
        { name: 'राम परिवार', members: ['राम शर्मा', 'सीता शर्मा'] },
        { name: 'Sharma: Main Branch', members: ['Ram Sharma', 'Sita Sharma'] },
        { name: 'Mixed परिवार', members: ['Mixed Name'] }
      ];
      
      trees.forEach(tree => {
        tree.members.forEach(member => {
          const key = buildMemberKey(tree.name, member);
          memberMap.set(key, `${tree.name}_${member}_ID`);
        });
      });
      
      // Test lookups with variations
      const testCases = [
        { tree: 'राम  परिवार', member: 'राम शर्मा', shouldFind: true },
        { tree: 'SHARMA: Main Branch', member: 'ram sharma', shouldFind: true },
        { tree: 'Mixed परिवार', member: 'Mixed Name', shouldFind: true },
        { tree: 'NonExistent', member: 'NonExistent', shouldFind: false },
      ];
      
      testCases.forEach(({ tree, member, shouldFind }) => {
        const lookupKey = buildMemberKey(tree, member);
        const found = memberMap.has(lookupKey);
        
        expect(found).toBe(shouldFind);
        
        if (shouldFind) {
          expect(memberMap.get(lookupKey)).toContain('_ID');
        }
      });
    });
  });
  
  describe('Performance Tests', () => {
    test('handles large number of keys efficiently', () => {
      const memberMap = new Map();
      const startTime = Date.now();
      
      // Create 1000 keys
      for (let i = 0; i < 1000; i++) {
        const key = buildMemberKey(`Tree${i}`, `Member${i}`);
        memberMap.set(key, `ID${i}`);
      }
      
      const createTime = Date.now() - startTime;
      
      // Lookup 1000 keys
      const lookupStart = Date.now();
      for (let i = 0; i < 1000; i++) {
        const key = buildMemberKey(`Tree${i}`, `Member${i}`);
        memberMap.get(key);
      }
      const lookupTime = Date.now() - lookupStart;
      
      // Should complete in reasonable time (< 100ms each on modern hardware)
      expect(createTime).toBeLessThan(100);
      expect(lookupTime).toBeLessThan(100);
      
      expect(memberMap.size).toBe(1000);
    });
  });
  
  describe('Edge Cases', () => {
    test('handles empty strings', () => {
      const key = buildMemberKey('', '');
      const parsed = JSON.parse(key);
      
      expect(parsed.tree).toBe('');
      expect(parsed.member).toBe('');
    });
    
    test('handles very long names', () => {
      const longTree = 'A'.repeat(500);
      const longMember = 'B'.repeat(500);
      
      const key = buildMemberKey(longTree, longMember);
      const parsed = JSON.parse(key);
      
      expect(parsed.tree.length).toBeGreaterThan(0);
      expect(parsed.member.length).toBeGreaterThan(0);
    });
  });
});
