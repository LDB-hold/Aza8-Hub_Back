import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateBrandingDto {
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  domain?: string;
}

