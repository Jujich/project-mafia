import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { DictionariesModule } from './dictionaries/dictionaries.module';
import { GamesModule } from './games/games.module';
import { NightsModule } from './nights/nights.module';
import { DaysModule } from './days/days.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    DictionariesModule,
    GamesModule,
    NightsModule,
    DaysModule,
  ],
})
export class AppModule {}
