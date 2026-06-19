import { Module } from '@nestjs/common';
import { NightsController } from './nights.controller';
import { NightsService } from './nights.service';

@Module({
  controllers: [NightsController],
  providers: [NightsService],
})
export class NightsModule {}
