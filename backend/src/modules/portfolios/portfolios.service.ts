import { forwardRef, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PortfolioType, RiskLevel, UserRole } from '../../constants/enums';
import { ROLE_LIMITS } from '../../constants/permissions';
import { CurrentUser } from '../../types/request';
import { HoldingsService } from '../holdings/holdings.service';
import { MarketService } from '../market/market.service';
import { ComparePortfoliosDto } from './dto/compare-portfolios.dto';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';

export interface PortfolioRecord {
  id: number;
  userId: number;
  name: string;
  description: string;
  type: PortfolioType;
  riskLevel: RiskLevel;
  totalValue: number;
  createdAt: string;
}

@Injectable()
export class PortfoliosService {
  private readonly portfolios: PortfolioRecord[] = [
    { id: 1, userId: 1, name: '长期价值组合', description: '宽基 ETF + 龙头股票', type: PortfolioType.MIXED, riskLevel: RiskLevel.MODERATE, totalValue: 3000, createdAt: new Date().toISOString() },
  ];
  private nextId = 2;

  constructor(
    @Inject(forwardRef(() => HoldingsService))
    private readonly holdingsService: HoldingsService,
    private readonly marketService: MarketService,
  ) {}

  list(user: CurrentUser) {
    return user.role === UserRole.ADMIN ? this.portfolios : this.portfolios.filter((item) => item.userId === user.id);
  }

  findOwned(id: number, user: CurrentUser) {
    const portfolio = this.portfolios.find((item) => item.id === id);
    if (!portfolio) throw new NotFoundException('portfolio not found');
    if (user.role !== UserRole.ADMIN && portfolio.userId !== user.id) throw new ForbiddenException('not portfolio owner');
    return portfolio;
  }

  create(dto: CreatePortfolioDto, user: CurrentUser) {
    const ownedCount = this.portfolios.filter((item) => item.userId === user.id).length;
    if (ownedCount >= ROLE_LIMITS[user.role].maxPortfolios) throw new ForbiddenException('portfolio limit reached');

    const portfolio: PortfolioRecord = {
      id: this.nextId++,
      userId: user.id,
      name: dto.name,
      description: dto.description ?? '',
      type: dto.type,
      riskLevel: dto.riskLevel,
      totalValue: 0,
      createdAt: new Date().toISOString(),
    };
    this.portfolios.push(portfolio);
    return portfolio;
  }

  update(id: number, dto: UpdatePortfolioDto, user: CurrentUser) {
    const portfolio = this.findOwned(id, user);
    Object.assign(portfolio, dto);
    return portfolio;
  }

  delete(id: number, user: CurrentUser) {
    const portfolio = this.findOwned(id, user);
    const index = this.portfolios.findIndex((item) => item.id === portfolio.id);
    this.portfolios.splice(index, 1);
    return { deleted: true, id };
  }

  setTotalValue(id: number, value: number) {
    const portfolio = this.portfolios.find((item) => item.id === id);
    if (portfolio) portfolio.totalValue = Number(value.toFixed(2));
  }

  performance(id: number, user: CurrentUser) {
    const portfolio = this.findOwned(id, user);
    return {
      portfolioId: portfolio.id,
      totalValue: portfolio.totalValue,
      daily: 0.38,
      weekly: 1.24,
      monthly: 3.9,
      yearly: 12.6,
      points: ['日', '周', '月', '年'].map((label, index) => ({ label, returnPercent: [0.38, 1.24, 3.9, 12.6][index] })),
    };
  }

  compare(dto: ComparePortfoliosDto, user: CurrentUser) {
    const { portfolioIds } = dto;
    const uniqueIds = [...new Set(portfolioIds)];

    const result = uniqueIds.map((id) => {
      const portfolio = this.findOwned(id, user);
      const performance = this.performance(id, user);
      const holdings = this.holdingsService.listByPortfolio(id, user);

      const sectorMap = new Map<string, number>();
      let totalHoldingsValue = 0;
      for (const holding of holdings) {
        let sector = 'Unknown';
        try {
          const quote = this.marketService.quote(holding.symbol);
          sector = quote.sector;
        } catch {
          // quote not found, keep default
        }
        const value = holding.currentPrice * holding.quantity;
        totalHoldingsValue += value;
        sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + value);
      }

      const sectorBreakdown = Array.from(sectorMap.entries())
        .map(([sector, value]) => ({
          sector,
          value: Number(value.toFixed(2)),
          percent: totalHoldingsValue > 0 ? Number(((value / totalHoldingsValue) * 100).toFixed(2)) : 0,
        }))
        .sort((a, b) => b.value - a.value);

      return {
        portfolioId: portfolio.id,
        name: portfolio.name,
        riskLevel: portfolio.riskLevel,
        totalValue: portfolio.totalValue,
        performance: {
          daily: performance.daily,
          weekly: performance.weekly,
          monthly: performance.monthly,
          yearly: performance.yearly,
          points: performance.points,
        },
        sectorBreakdown,
      };
    });

    return result;
  }
}

