import * as vscode from 'vscode';
import { DotFileEntry, ParsedDotFile } from '../types';
import { getConfig, findToggleValues } from '../config/settings';

/**
 * Regular expression to match KEY=VALUE pairs in dot files
 * Supports:
 * - Standard KEY=value
 * - KEY="quoted value"
 * - KEY='single quoted value'
 * - export KEY=value
 * - Hyphenated keys: billing-settings=value
 * - Dotted keys: server.port=value
 * - Comments (lines starting with #)
 */
const KEY_VALUE_REGEX = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/;

/**
 * Parse a single line from a dot file
 */
export function parseLine(line: string, lineNumber: number, toggleValues: string[][]): DotFileEntry | null {
  // Skip empty lines and comments
  const trimmedLine = line.trim();
  if (!trimmedLine || trimmedLine.startsWith('#')) {
    return null;
  }

  // Remove carriage returns from the line (Windows line endings)
  const cleanLine = line.replace(/\r/g, '');
  
  const match = cleanLine.match(KEY_VALUE_REGEX);
  if (!match) {
    return null;
  }

  const [, key, rawValue] = match;
  const value = rawValue.trim();
  
  // Calculate positions using the clean line
  const keyIndex = cleanLine.indexOf(key);
  const equalsIndex = cleanLine.indexOf('=', keyIndex);
  const valueStart = equalsIndex + 1 + (cleanLine.substring(equalsIndex + 1).length - cleanLine.substring(equalsIndex + 1).trimStart().length);
  const valueEnd = valueStart + value.length;

  // Check if this value is toggleable
  const matchedToggleValues = findToggleValues(value, toggleValues);
  const isToggleable = matchedToggleValues !== undefined;

  return {
    key,
    value,
    line: lineNumber,
    valueStart,
    valueEnd,
    isToggleable,
    toggleValues: matchedToggleValues,
    rawLine: line
  };
}

/**
 * Parse a dot file and extract all key-value entries
 */
export async function parseFile(uri: vscode.Uri): Promise<ParsedDotFile> {
  const config = getConfig();
  const document = await vscode.workspace.openTextDocument(uri);
  const content = document.getText();
  const lines = content.split('\n');

  const entries: DotFileEntry[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const entry = parseLine(lines[i], i, config.toggleValues);
    if (entry) {
      entries.push(entry);
    }
  }

  // Get relative path for display
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  const relativePath = workspaceFolder 
    ? vscode.workspace.asRelativePath(uri, false)
    : uri.fsPath;

  return {
    uri,
    relativePath,
    entries,
    toggleableEntries: entries.filter(e => e.isToggleable)
  };
}

/**
 * Parse a document directly (useful for active editors)
 */
export function parseDocument(document: vscode.TextDocument): ParsedDotFile {
  const config = getConfig();
  const content = document.getText();
  const lines = content.split('\n');

  const entries: DotFileEntry[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const entry = parseLine(lines[i], i, config.toggleValues);
    if (entry) {
      entries.push(entry);
    }
  }

  // Get relative path for display
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const relativePath = workspaceFolder 
    ? vscode.workspace.asRelativePath(document.uri, false)
    : document.uri.fsPath;

  return {
    uri: document.uri,
    relativePath,
    entries,
    toggleableEntries: entries.filter(e => e.isToggleable)
  };
}

/**
 * Find all dot files matching the configured patterns
 */
export async function findDotFiles(): Promise<vscode.Uri[]> {
  const config = getConfig();
  const files: vscode.Uri[] = [];

  for (const pattern of config.filePatterns) {
    const matches = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
    files.push(...matches);
  }

  // Remove duplicates
  const uniquePaths = new Set<string>();
  return files.filter(uri => {
    if (uniquePaths.has(uri.fsPath)) {
      return false;
    }
    uniquePaths.add(uri.fsPath);
    return true;
  });
}

/**
 * Parse all dot files in the workspace
 */
export async function parseAllFiles(): Promise<ParsedDotFile[]> {
  const uris = await findDotFiles();
  const parsedFiles: ParsedDotFile[] = [];

  for (const uri of uris) {
    try {
      const parsed = await parseFile(uri);
      parsedFiles.push(parsed);
    } catch (error) {
      console.error(`Failed to parse ${uri.fsPath}:`, error);
    }
  }

  return parsedFiles;
}
