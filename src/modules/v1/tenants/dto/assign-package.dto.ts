import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class AssignPackageDto {
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

