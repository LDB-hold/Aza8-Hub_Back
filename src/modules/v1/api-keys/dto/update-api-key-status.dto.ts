import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateApiKeyStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['ativo', 'suspenso'])
  status!: 'ativo' | 'suspenso';
}

