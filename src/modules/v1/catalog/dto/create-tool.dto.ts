import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateToolDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['ativo', 'suspenso'])
  status?: 'ativo' | 'suspenso';
}

