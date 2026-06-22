import { forwardRef, Module } from '@nestjs/common';
import { HoldingsModule } from '../holdings/holdings.module';
import { MarketModule } from '../market/market.module';
import { PortfoliosController } from './portfolios.controller';
import { PortfoliosService } from './portfolios.service';

@Module({
  imports: [forwardRef(() => HoldingsModule), MarketModule],
  controllers: [PortfoliosController],
  providers: [PortfoliosService],
  exports: [PortfoliosService],
})
export class PortfoliosModule {}

