import * as vscode from 'vscode';

/**
 * Represents a parsed key-value entry from a dot file
 */
export interface DotFileEntry {
  /** The key/variable name */
  key: string;
  /** The current value */
  value: string;
  /** Line number in the file (0-indexed) */
  line: number;
  /** Character position where the value starts */
  valueStart: number;
  /** Character position where the value ends */
  valueEnd: number;
  /** Whether this value can be toggled */
  isToggleable: boolean;
  /** The toggle values this value belongs to, if toggleable */
  toggleValues?: string[];
  /** The raw line content */
  rawLine: string;
}

/**
 * Represents a parsed dot file with all its entries
 */
export interface ParsedDotFile {
  /** The URI of the file */
  uri: vscode.Uri;
  /** The relative path for display */
  relativePath: string;
  /** All parsed entries */
  entries: DotFileEntry[];
  /** Only the toggleable entries */
  toggleableEntries: DotFileEntry[];
}

/**
 * Configuration for the extension
 */
export interface DotfileToggleConfig {
  /** Glob patterns for files to monitor */
  filePatterns: string[];
  /** Groups of values that can be cycled through (2 or more values per group) */
  toggleValues: string[][];
  /** Whether to show gitignore warnings */
  showGitignoreWarning: boolean;
  /** Whether to only show toggleable values in the sidebar */
  showOnlyToggleable: boolean;
}

/**
 * Result of a toggle operation
 */
export interface ToggleResult {
  success: boolean;
  newValue?: string;
  error?: string;
  wasGitignoreWarningShown?: boolean;
}

/**
 * Tree item types for the sidebar
 */
export enum TreeItemType {
  File = 'file',
  Entry = 'entry'
}

/**
 * Data associated with tree items
 */
export interface TreeItemData {
  type: TreeItemType;
  file?: ParsedDotFile;
  entry?: DotFileEntry;
  fileUri?: vscode.Uri;
}
