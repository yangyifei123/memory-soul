/**
 * Memory-Soul: User Model Tests
 * TDD approach - tests written first
 */

import * as fs from 'fs';
import * as path from 'path';
import { UserModel } from '../src/memory/user-model';

describe('UserModel', () => {
  const testDir = path.join(__dirname, 'test-data', 'user-model');
  const userId = 'test-user';
  
  let model: UserModel;

  beforeEach(() => {
    // Clean and create fresh directory for each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    
    model = new UserModel({
      userId,
      basePath: testDir
    });
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('load and save', () => {
    it('should create default preferences on first load', async () => {
      const prefs = await model.load();

      expect(prefs.userId).toBe(userId);
      expect(prefs.communicationStyle).toBe('mixed');
      expect(prefs.technicalLevel).toBe('intermediate');
      expect(prefs.ignoredPatterns).toEqual([]);
      expect(prefs.preferredPatterns).toEqual([]);
    });

    it('should persist preferences across instances', async () => {
      await model.load();
      await model.setCommunicationStyle('concise');
      
      // Create new instance with same userId
      const model2 = new UserModel({ userId, basePath: testDir });
      const prefs = await model2.load();
      
      expect(prefs.communicationStyle).toBe('concise');
    });
  });

  describe('updatePreference', () => {
    it('should update communication style', async () => {
      await model.load();
      await model.setCommunicationStyle('detailed');
      
      const prefs = await model.load();
      expect(prefs.communicationStyle).toBe('detailed');
    });

    it('should update technical level', async () => {
      await model.load();
      await model.setTechnicalLevel('expert');
      
      const prefs = await model.load();
      expect(prefs.technicalLevel).toBe('expert');
    });
  });

  describe('pattern management', () => {
    it('should add preferred patterns', async () => {
      await model.load();
      await model.addPreferredPattern('concise');
      await model.addPreferredPattern('technical');
      
      const prefs = await model.load();
      expect(prefs.preferredPatterns).toContain('concise');
      expect(prefs.preferredPatterns).toContain('technical');
    });

    it('should not add duplicate preferred patterns', async () => {
      await model.load();
      await model.addPreferredPattern('concise');
      await model.addPreferredPattern('concise');
      
      const prefs = await model.load();
      expect(prefs.preferredPatterns.filter(p => p === 'concise').length).toBe(1);
    });

    it('should add ignored patterns', async () => {
      await model.load();
      await model.addIgnoredPattern('verbose');
      
      const prefs = await model.load();
      expect(prefs.ignoredPatterns).toContain('verbose');
    });
  });

  describe('agent preference', () => {
    it('should set preferred agent', async () => {
      await model.load();
      await model.setPreferredAgent('atlas');
      
      const prefs = await model.load();
      expect(prefs.preferredAgent).toBe('atlas');
    });
  });

  describe('preference inference', () => {
    it('should infer detailed style from long content', async () => {
      // Fresh model for this test with unique userId
      const freshModel = new UserModel({ 
        userId: userId + '-detailed', 
        basePath: testDir + '-detailed' 
      });
      
      const longContent = 'This is a very long message that contains many words and explains things in great detail with lots of information about various topics that the user is interested in discussing with the agent';
      await freshModel.inferPreferencesFromInteraction(longContent, 'sisyphus');
      
      const prefs = await freshModel.load();
      expect(prefs.preferredPatterns).toContain('detailed');
    });

    it('should infer concise style from short content', async () => {
      const freshModel = new UserModel({ 
        userId: userId + '-concise', 
        basePath: testDir + '-concise' 
      });
      
      const shortContent = 'Fix bug';
      await freshModel.inferPreferencesFromInteraction(shortContent, 'sisyphus');
      
      const prefs = await freshModel.load();
      expect(prefs.preferredPatterns).toContain('concise');
    });

    it('should infer expert level from technical terms', async () => {
      const freshModel = new UserModel({ 
        userId: userId + '-expert', 
        basePath: testDir + '-expert' 
      });
      
      const technicalContent = 'function async await import export class interface type';
      await freshModel.inferPreferencesFromInteraction(technicalContent, 'sisyphus');
      
      const prefs = await freshModel.load();
      expect(prefs.technicalLevel).toBe('expert');
    });

    it('should track agent usage', async () => {
      const usageDir = testDir + '-usage-track';

      // Clean slate
      if (fs.existsSync(usageDir)) {
        fs.rmSync(usageDir, { recursive: true });
      }
      fs.mkdirSync(usageDir, { recursive: true });

      const freshModel = new UserModel({
        userId: userId + '-usage-track',
        basePath: usageDir
      });

      await freshModel.inferPreferencesFromInteraction('Test', 'sisyphus');
      await freshModel.inferPreferencesFromInteraction('Test', 'sisyphus');
      await freshModel.inferPreferencesFromInteraction('Test', 'atlas');

      const stats = await freshModel.getAgentUsageStats();
      expect(stats['sisyphus']).toBe(2);
      expect(stats['atlas']).toBe(1);
    });
  });

  describe('getMostUsedAgent', () => {
    it('should return most used agent', async () => {
      const freshModel = new UserModel({ 
        userId: userId + '-mostused', 
        basePath: testDir + '-mostused' 
      });
      
      for (let i = 0; i < 5; i++) {
        await freshModel.inferPreferencesFromInteraction('Test', 'sisyphus');
      }
      for (let i = 0; i < 3; i++) {
        await freshModel.inferPreferencesFromInteraction('Test', 'atlas');
      }
      
      const mostUsed = await freshModel.getMostUsedAgent();
      expect(mostUsed).toBe('sisyphus');
    });

    it('should return undefined when no usage', async () => {
      await model.load();
      const mostUsed = await model.getMostUsedAgent();
      expect(mostUsed).toBeUndefined();
    });
  });
});
