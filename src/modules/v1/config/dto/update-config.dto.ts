import { IsObject, IsOptional } from 'class-validator';

export class UpdateConfigDto {
  @IsOptional()
  @IsObject()
  flags?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  limits?: Record<string, unknown>;
}

