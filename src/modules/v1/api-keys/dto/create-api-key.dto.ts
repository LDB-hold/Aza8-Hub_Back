import { ArrayNotEmpty, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ValidateIf((o: CreateApiKeyDto) => o.profile === undefined)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsOptional()
  toolActionKeys?: string[];

  @ValidateIf((o: CreateApiKeyDto) => o.toolActionKeys === undefined)
  @IsOptional()
  @IsIn(['read-only', 'write', 'admin'])
  profile?: 'read-only' | 'write' | 'admin';
}

