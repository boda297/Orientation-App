import { Injectable } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { IFileSignatureInspector } from '../interfaces/file-signature-inspector.interface';

@Injectable()
export class FileTypeSignatureAdapter implements IFileSignatureInspector {
  async inspect(buffer: Buffer): Promise<string | null> {
    if (!buffer) return null;

    const result = await fileTypeFromBuffer(buffer);
    return result ? result.mime : null;
  }
}
