import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AccountModule } from './account/account.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataLoaderInterceptor } from '../../src'

@Module({
  imports: [
    GraphQLModule.forRoot({
      autoSchemaFile: true,
      debug: true,
    }),
    TypeOrmModule.forRoot({
      type: "sqlite",
      database: "sample",
      entities: [join(__dirname, "./**/*.entity.[t|j]s")],
      synchronize: true,
    }),
    AccountModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: DataLoaderInterceptor,
    }
  ],
})
export class AppModule {}
