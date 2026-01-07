import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { DeveloperService } from './developer.service';
import { CreateDeveloperDto } from './dto/create-developer.dto';
import { UpdateDeveloperDto } from './dto/update-developer.dto';
import { MongoIdDto } from 'src/common/mongoId.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/roles/roles.guard';
import { Roles } from 'src/roles/roles.decorator';
import { Role } from 'src/roles/roles.enum';
import { UpdateDeveloperScriptDto } from './dto/update-developer-project.dto';

@Controller('developer')
export class DeveloperController {
  constructor(private readonly developerService: DeveloperService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  findAll() {
    return this.developerService.findAllDevelopers();
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  findOne(@Param() params: MongoIdDto) {
    return this.developerService.findOneDeveloper(params.id);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
    ]),
  )
  create(
    @Body() createDeveloperDto: CreateDeveloperDto,
    @UploadedFiles()
    files: {
      logo?: Express.Multer.File[];
    },
  ) {
    const logo = files?.logo?.[0];
    return this.developerService.createDeveloper(
      createDeveloperDto,
      logo,
    );
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  update(
    @Param() params: MongoIdDto,
    @Body() updateDeveloperDto: UpdateDeveloperDto,
  ) {
    return this.developerService.updateDeveloper(params.id, updateDeveloperDto);
  }


  // update developer project script
  @Patch(':id/project')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.DEVELOPER, Role.ADMIN, Role.SUPERADMIN)
  updateDeveloperProject(@Param() params: MongoIdDto, @Body() updateDeveloperScriptDto: UpdateDeveloperScriptDto) {  
    return this.developerService.updateDeveloperScript(params.id, updateDeveloperScriptDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  remove(@Param() params: MongoIdDto) {
    return this.developerService.remove(params.id);
  }
}
