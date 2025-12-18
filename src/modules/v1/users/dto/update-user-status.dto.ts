import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateUserStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['ativo', 'suspenso'])
  status!: 'ativo' | 'suspenso';

  @IsOptional()
  @IsString()
  suspendedReason?: string;
}

