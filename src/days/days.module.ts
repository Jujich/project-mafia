import { Module } from '@nestjs/common';
import { DaysController } from './days.controller';
import { DaysService } from './days.service';

@Module({
  controllers: [DaysController],
  providers: [DaysService],
})
export class DaysModule {}
