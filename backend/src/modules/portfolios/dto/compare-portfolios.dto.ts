import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class ComparePortfoliosDto {
  @ApiProperty({ example: [1, 2, 3], description: '要对比的组合ID数组' })
  @IsArray()
  @ArrayNotEmpty({ message: '组合ID数组不能为空' })
  @IsInt({ each: true, message: '组合ID必须是整数' })
  portfolioIds: number[];
}
