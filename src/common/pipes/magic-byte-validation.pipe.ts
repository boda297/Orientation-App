import {
  Inject,
  Injectable,
  PipeTransform,
  BadRequestException,
} from '@nestjs/common';
import {
  FILE_SIGNATURE_INSPECTOR,
  IFileSignatureInspector,
} from '../interfaces/file-signature-inspector.interface';

export interface MagicBytePipeOptions {
  allowedMimeTypes: string[];
}

@Injectable()
export class MagicByteValidationPipe implements PipeTransform<
  Express.Multer.File | undefined
> {
  constructor(
    @Inject(FILE_SIGNATURE_INSPECTOR)
    private readonly signatureInspector: IFileSignatureInspector,
    private readonly options: MagicBytePipeOptions,
  ) {}

  async transform(
    file?: Express.Multer.File,
  ): Promise<Express.Multer.File | undefined> {
    if (!file) {
      return file;
    }

    if (!file.buffer) {
      throw new BadRequestException('No file buffer provided.');
    }

    const detectedMime = await this.signatureInspector.inspect(file.buffer);

    if (
      !detectedMime ||
      !this.options.allowedMimeTypes.includes(detectedMime)
    ) {
      throw new BadRequestException(
        `Invalid file type. Allowed formats: ${this.options.allowedMimeTypes.join(', ')}`,
      );
    }

    // Overwrite client-provided mimetype with verified magic-byte type
    file.mimetype = detectedMime;

    return file;
  }
}

@Injectable()
export class PdfMagicByteValidationPipe extends MagicByteValidationPipe {
  constructor(
    @Inject(FILE_SIGNATURE_INSPECTOR)
    signatureInspector: IFileSignatureInspector,
  ) {
    super(signatureInspector, {
      allowedMimeTypes: ['application/pdf'],
    });
  }
}

@Injectable()
export class InventoryMagicByteValidationPipe extends MagicByteValidationPipe {
  constructor(
    @Inject(FILE_SIGNATURE_INSPECTOR)
    signatureInspector: IFileSignatureInspector,
  ) {
    super(signatureInspector, {
      allowedMimeTypes: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ],
    });
  }
}
