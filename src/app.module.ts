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
import { ScheduleModule } from '@nestjs/schedule';
import { SubscriptionModule } from './subscription/subscription.module';
import { HTTPLoggerMiddleware } from './common/middleware/http-logger.middleware';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';

@Module({
  imports: [
    // ConfigModule is used to load environment variables from .env file
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // ThrottlerModule: three named tiers used via @Throttle() decorators.
    // The guard is registered as APP_GUARD below so it runs globally.
    //
    //  default  — 100 req / min  — general read endpoints
    //  strict   —   5 req / min  — payment mutations (checkout, cancel, reactivate)
    //  webhook  —  20 req / min  — unauthenticated Paymob callback (server-to-server)
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,  // ms
        limit: 100,
      },
      {
        name: 'strict',
        ttl: 60_000,
        limit: 5,
      },
      {
        name: 'webhook',
        ttl: 60_000,
        limit: 20,
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
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // CustomThrottlerGuard was defined but never wired up — registering it
    // as APP_GUARD activates rate limiting globally across all controllers.
    // Individual endpoints override the tier via @Throttle().
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HTTPLoggerMiddleware).forRoutes('*');
  }
}

