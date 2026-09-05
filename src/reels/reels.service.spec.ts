jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

import { Test, TestingModule } from '@nestjs/testing';
import { ReelsService } from './reels.service';
import { getModelToken } from '@nestjs/mongoose';
import { Reel } from './entities/reel.entity';
import { ProjectsService } from 'src/projects/projects.service';
import { DeveloperService } from 'src/developer/developer.service';
import { UsersService } from 'src/users/users.service';
import { S3Service } from 'src/s3/s3.service';
import { Types } from 'mongoose';

describe('ReelsService - TikTok FYP Algorithm', () => {
  let service: ReelsService;

  const mockReelModel: any = {
    find: jest.fn(),
  };

  const mockProjectsService = {
    findProjectById: jest.fn(),
    addReelToProject: jest.fn(),
    removeReelFromProject: jest.fn(),
  };

  const mockDeveloperService = {
    findOneDeveloper: jest.fn(),
  };

  const mockUsersService = {
    getSavedReelIds: jest.fn().mockResolvedValue([]),
  };

  const mockS3Service = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReelsService,
        { provide: getModelToken(Reel.name), useValue: mockReelModel },
        { provide: ProjectsService, useValue: mockProjectsService },
        { provide: DeveloperService, useValue: mockDeveloperService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: S3Service, useValue: mockS3Service },
      ],
    }).compile();

    service = module.get<ReelsService>(ReelsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllReels (FYP Algorithm)', () => {
    const project1Id = new Types.ObjectId();
    const project2Id = new Types.ObjectId();

    const sampleReels = [
      {
        _id: new Types.ObjectId(),
        title: 'Reel 1 - High Score',
        videoUrl: 'https://cdn.example.com/reel1.mp4',
        thumbnail: 'https://cdn.example.com/thumb1.jpg',
        viewCount: 5000,
        saveCount: 200,
        createdAt: new Date(),
        developerId: new Types.ObjectId(),
        projectId: {
          _id: project1Id,
          title: 'Project 1',
          logoUrl: 'https://cdn.example.com/logo1.png',
          whatsappNumber: '+201011111111',
        },
      },
      {
        _id: new Types.ObjectId(),
        title: 'Reel 2 - Medium Score',
        videoUrl: 'https://cdn.example.com/reel2.mp4',
        thumbnail: 'https://cdn.example.com/thumb2.jpg',
        viewCount: 500,
        saveCount: 20,
        createdAt: new Date(Date.now() - 2 * 3600 * 1000), // 2 hours ago
        developerId: new Types.ObjectId(),
        projectId: {
          _id: project1Id, // Same project
          title: 'Project 1',
          logoUrl: 'https://cdn.example.com/logo1.png',
          whatsappNumber: '+201011111111',
        },
      },
      {
        _id: new Types.ObjectId(),
        title: 'Reel 3 - Diverse Project',
        videoUrl: 'https://cdn.example.com/reel3.mp4',
        thumbnail: 'https://cdn.example.com/thumb3.jpg',
        viewCount: 1000,
        saveCount: 50,
        createdAt: new Date(Date.now() - 5 * 3600 * 1000),
        developerId: new Types.ObjectId(),
        projectId: {
          _id: project2Id, // Different project
          title: 'Project 2',
          logoUrl: 'https://cdn.example.com/logo2.png',
          whatsappNumber: '+201022222222',
        },
      },
    ];

    it('should return reels with the exact requested fields', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([...sampleReels]),
      };
      mockReelModel.find.mockReturnValue(mockQuery);

      const result = await service.findAllReels();

      expect(result.length).toBe(3);
      for (const reel of result) {
        expect(reel).toHaveProperty('_id');
        expect(reel).toHaveProperty('title');
        expect(reel).toHaveProperty('videoUrl');
        expect(reel).toHaveProperty('thumbnail');
        expect(reel).toHaveProperty('viewCount');
        expect(reel).toHaveProperty('createdAt');
        expect(reel).toHaveProperty('developerId');
        expect(reel).toHaveProperty('projectId');
        expect(reel.projectId).toHaveProperty('title');
        expect(reel.projectId).toHaveProperty('logoUrl');
        expect(reel.projectId).toHaveProperty('whatsappNumber');
      }
    });

    it('should support pagination (limit & page)', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([...sampleReels]),
      };
      mockReelModel.find.mockReturnValue(mockQuery);

      const paginatedResult = await service.findAllReels({ page: 1, limit: 2 });
      expect(paginatedResult.length).toBe(2);
    });

    it('should return empty array if no reels found', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      mockReelModel.find.mockReturnValue(mockQuery);

      const result = await service.findAllReels();
      expect(result).toEqual([]);
    });
  });
});
