import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectsModule } from './projects/projects.module';
import { DeveloperModule } from './developer/developer.module';
import { S3Module } from './s3/s3.module';
import { EpisodeModule } from './episode/episode.module';
import { ReelsModule } from './reels/reels.module';
import { FilesModule } from './files/files.module';
import { NewsModule } from './news/news.module';
import { WatchHistoryModule } from './watch-history/watch-history.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { SubscriptionModule } from './subscription/subscription.module';
import { HTTPLoggerMiddleware } from './common/middleware/http-logger.middleware';

@Module({
  imports: [
    // ConfigModule is used to load environment variables from .env file
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // ThrottlerModule is used to prevent brute-force attacks and rate limiting.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    // MongooseModule is used to connect to the MongoDB database
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGO_URL');
        if (!uri) throw new Error('MONGO_URL is not defined');
        return { uri };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    ProjectsModule,
    DeveloperModule,
    S3Module,
    EpisodeModule,
    ReelsModule,
    FilesModule,
    NewsModule,
    WatchHistoryModule,
    SubscriptionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HTTPLoggerMiddleware).forRoutes('*');
  }
}

