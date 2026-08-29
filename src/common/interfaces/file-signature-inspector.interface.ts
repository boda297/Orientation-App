import { Buffer } from 'buffer';

export const FILE_SIGNATURE_INSPECTOR = Symbol('FILE_SIGNATURE_INSPECTOR');

export interface IFileSignatureInspector {
  /**
   * Inspects a file buffer and returns its true MIME type.
   * Returns null if the format is unrecognized.
   */
  inspect(buffer: Buffer): Promise<string | null>;
}
