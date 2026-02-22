import * as vscode from 'vscode';
import { DotfileValueToggleConfig } from '../types';

/**
 * Get the current extension configuration
 */
export function getConfig(): DotfileValueToggleConfig {
  const config = vscode.workspace.getConfiguration('dotfileValueToggle');
  
  return {
    filePatterns: config.get<string[]>('filePatterns', [
      '**/.env*',
      '**/.flags',
      '**/.config'
    ]),
    toggleValues: config.get<string[][]>('toggleValues', [
      ['true', 'false'],
      ['TRUE', 'FALSE'],
      ['yes', 'no'],
      ['YES', 'NO'],
      ['1', '0'],
      ['on', 'off'],
      ['ON', 'OFF'],
      ['enabled', 'disabled'],
      ['ENABLED', 'DISABLED'],
      ['production', 'development'],
      ['prod', 'dev']
    ]),
    showGitignoreWarning: config.get<boolean>('showGitignoreWarning', true),
    showOnlyToggleable: config.get<boolean>('showOnlyToggleable', true)
  };
}

/**
 * Find the toggle values group that contains a given value
 */
export function findToggleValues(value: string, toggleValues: string[][]): string[] | undefined {
  // Trim whitespace and carriage returns
  const trimmedValue = value.trim().replace(/\r/g, '');
  // Remove surrounding quotes if present
  const unquotedValue = trimmedValue.replace(/^["']|["']$/g, '');
  
  // Skip empty values
  if (!unquotedValue) {
    return undefined;
  }
  
  for (const group of toggleValues) {
    // Case-sensitive exact match
    if (group.includes(unquotedValue)) {
      return group;
    }
    // Also try lowercase comparison for flexibility
    const lowerValue = unquotedValue.toLowerCase();
    const lowerGroup = group.map(v => v.toLowerCase());
    if (lowerGroup.includes(lowerValue)) {
      // Return the original group with correct casing
      return group;
    }
  }
  return undefined;
}

/**
 * Get the next value in a toggle values group (cycles through all values)
 */
export function getNextValue(value: string, toggleValues: string[]): string {
  const trimmedValue = value.trim();
  // Check if value has quotes
  const hasDoubleQuotes = trimmedValue.startsWith('"') && trimmedValue.endsWith('"');
  const hasSingleQuotes = trimmedValue.startsWith("'") && trimmedValue.endsWith("'");
  const unquotedValue = trimmedValue.replace(/^["']|["']$/g, '');
  
  const currentIndex = toggleValues.indexOf(unquotedValue);
  if (currentIndex === -1) {
    return value; // Return original if not found
  }
  
  // Get next value in the group (cyclic)
  const nextIndex = (currentIndex + 1) % toggleValues.length;
  const newValue = toggleValues[nextIndex];
  
  // Preserve quotes
  if (hasDoubleQuotes) {
    return `"${newValue}"`;
  } else if (hasSingleQuotes) {
    return `'${newValue}'`;
  }
  
  return newValue;
}

/**
 * Listen for configuration changes
 */
export function onConfigChange(callback: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('dotfileValueToggle')) {
      callback();
    }
  });
}
