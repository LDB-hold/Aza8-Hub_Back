import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateGroupStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['ativo', 'suspenso'])
  status!: 'ativo' | 'suspenso';

  @IsOptional()
  @IsString()
  suspendedReason?: string;
}

