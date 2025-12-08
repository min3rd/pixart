import { TestBed } from '@angular/core/testing';
import { LogService } from './log.service';
import { LogStorageService } from './log-storage.service';

describe('LogService', () => {
  let service: LogService;
  let storageService: LogStorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LogService);
    storageService = TestBed.inject(LogStorageService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create a session on initialization', () => {
    expect(service.sessionId()).toBeTruthy();
  });

  it('should log an action', () => {
    service.log('file', 'create_project', {
      parameters: { projectId: 'test-123' },
    });

    const logs = service.getRecentLogs();
    expect(logs.length).toBeGreaterThanOrEqual(2);
    const fileLog = logs.find((l) => l.action === 'create_project');
    expect(fileLog).toBeTruthy();
    expect(fileLog?.category).toBe('file');
    expect(fileLog?.action).toBe('create_project');
  });

  it('should sanitize sensitive parameters', () => {
    service.log('system', 'test_action', {
      parameters: { password: 'secret123', token: 'abc' },
    });

    const logs = service.getRecentLogs();
    const testLog = logs.find((l) => l.action === 'test_action');
    expect(testLog).toBeTruthy();
    expect(testLog?.parameters?.['password']).toBe('[REDACTED]');
    expect(testLog?.parameters?.['token']).toBe('[REDACTED]');
  });

  it('should track success and failure status', () => {
    service.log('layer', 'add_layer', { status: 'success' });
    service.log('layer', 'remove_layer', {
      status: 'failure',
      error: 'Cannot remove last layer',
    });

    const logs = service.getRecentLogs();
    const addLog = logs.find((l) => l.action === 'add_layer');
    const removeLog = logs.find((l) => l.action === 'remove_layer');
    expect(addLog?.status).toBe('success');
    expect(removeLog?.status).toBe('failure');
    expect(removeLog?.error).toBe('Cannot remove last layer');
  });

  it('should query logs by category', () => {
    service.log('file', 'open_project', {});
    service.log('layer', 'add_layer', {});
    service.log('file', 'save_project', {});

    const fileLogs = service.getLogsByCategory('file');
    expect(fileLogs.length).toBe(2);
    expect(fileLogs.every((log) => log.category === 'file')).toBe(true);
  });

  it('should export logs as JSON', () => {
    service.log('file', 'create_project', {});
    const exported = service.exportLogsAsJson();

    expect(exported.version).toBe('1.0.0');
    expect(exported.entries.length).toBeGreaterThan(0);
    expect(exported.sessions.length).toBeGreaterThan(0);
  });

  it('should clear all logs', () => {
    service.log('file', 'test', {});
    service.clearAllLogs();

    const logs = storageService.loadEntries();
    expect(logs.length).toBe(0);
  });
});
