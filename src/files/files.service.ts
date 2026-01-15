import { Injectable, NotFoundException } from '@nestjs/common';
import { Inventory, InventoryDocument } from './entities/inventory.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { File, FileDocument } from './entities/file.entity';
import { S3Service } from 'src/s3/s3.service';
import { Project, ProjectDocument } from 'src/projects/entities/project.entity';
import {
  Developer,
  DeveloperDoc,
} from 'src/developer/entities/developer.entity';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { CreatePdfDto } from './dto/create-pdf.dto';

@Injectable()
export class FilesService {
  constructor(
    @InjectModel(File.name) private fileModel: Model<FileDocument>,
    @InjectModel(Inventory.name)
    private inventoryModel: Model<InventoryDocument>,
    private s3Service: S3Service,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Developer.name) private developerModel: Model<DeveloperDoc>,
  ) {}

  async uploadInventory(
    createInventoryDto: CreateInventoryDto,
    file: Express.Multer.File,
  ) {
    const project = await this.validateProject(createInventoryDto.projectId);

    const developer = await this.developerModel.findById(project.developer);
    if (!developer) {
      throw new NotFoundException('Developer Not Found');
    }

    const { key, url } = await this.s3Service.uploadFile(file, 'inventory');

    const inventory = await this.inventoryModel.create({
      title: createInventoryDto.title,
      project: project._id,
      developer: developer._id,
      s3Key: key,
      inventoryUrl: url,
    });

    // push to project inventory
    await this.projectModel.findByIdAndUpdate(
      project._id,
      { $push: { inventory: inventory._id } },
      { new: true },
    );

    return {
      message: 'Inventory uploaded successfully',
      inventory: inventory,
    };
  }

  async uploadPDF(createPdfDto: CreatePdfDto, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new NotFoundException('PDF file is required');
    }

    const project = await this.validateProject(createPdfDto.projectId);
    const developer = await this.developerModel.findById(project.developer);
    if (!developer) {
      throw new NotFoundException('Developer Not Found');
    }

    const file = files[0];
    const { key, url } = await this.s3Service.uploadFile(file, 'PDF');

    const pdf = await this.fileModel.create({
      title: createPdfDto.title,
      project: project._id,
      developer: developer._id,
      s3Key: key,
      pdfUrl: url,
    });

    // push to project pdfs
    await this.projectModel.findByIdAndUpdate(
      project._id,
      { $push: { pdfs: pdf._id } },
      { new: true },
    );

    return {
      message: 'PDF uploaded successfully',
      pdf: pdf,
    };
  }

  async getInventory() {
    const inventories = await this.inventoryModel
      .find()
      .populate('project', 'title slug')
      .populate('developer')
      .sort({ createdAt: -1 });

    return {
      message: 'Inventories fetched successfully',
      inventories,
    };
  }

  async getInventoryById(id: Types.ObjectId) {
    const inventory = await this.inventoryModel
      .findById(id)
      .populate('project', 'title slug')
      .populate('developer');

    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }

    return {
      message: 'Inventory fetched successfully',
      inventory,
    };
  }

  async getPDF() {
    const pdfs = await this.fileModel
      .find()
      .populate('project', 'title slug')
      .populate('developer', 'name logoUrl')
      .sort({ createdAt: -1 });

    return {
      message: 'PDFs fetched successfully',
      pdfs,
    };
  }

  async getPDFById(id: Types.ObjectId) {
    const pdf = await this.fileModel
      .findById(id)
      .populate('project', 'title slug')
      .populate('developer', 'name logoUrl');

    if (!pdf) {
      throw new NotFoundException('PDF not found');
    }

    return {
      message: 'PDF fetched successfully',
      pdf,
    };
  }

  async deleteInventory(id: Types.ObjectId) {
    const inventory = await this.inventoryModel.findByIdAndDelete(id);
    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }

    // Delete file from S3
    await this.s3Service.deleteFile(inventory.s3Key);

    // Also remove inventory reference from project
    await this.projectModel.findByIdAndUpdate(
      inventory.project,
      { $pull: { inventory: inventory._id } },
      { new: true },
    );

    return {
      message: 'Inventory deleted successfully',
    };
  }

  async deletePDF(id: Types.ObjectId) {
    const pdf = await this.fileModel.findByIdAndDelete(id);
    if (!pdf) {
      throw new NotFoundException('PDF not found');
    }

    // Delete file from S3
    await this.s3Service.deleteFile(pdf.s3Key);

    // Also remove pdf reference from project
    await this.projectModel.findByIdAndUpdate(
      pdf.project,
      { $pull: { pdfs: pdf._id } },
      { new: true },
    );

    return {
      message: 'PDF deleted successfully',
    };
  }

  // helper functions
  private async validateProject(projectId: Types.ObjectId) {
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }
}
