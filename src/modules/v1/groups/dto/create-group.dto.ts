import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGroupDto {
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

